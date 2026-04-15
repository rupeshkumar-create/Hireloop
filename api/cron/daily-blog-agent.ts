import { VercelRequest, VercelResponse } from '@vercel/node';

const OPENROUTER_KEY = process.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_MODEL = 'anthropic/claude-opus-4.6';

interface TopicData {
  title: string;
  angle: string;
  target_keyword: string;
  search_intent: string;
  why_this_matters: string;
}

interface GeneratedBlogPost {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  keywords: string[];
}

interface VerificationResult {
  pass: boolean;
  score: number;
  issues: string[];
  fixes: string[];
}

// Helper to call LLM and parse JSON
async function callLLM(messages: any[]) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages
    })
  });
  if (!res.ok) throw new Error(`OpenRouter API Error: ${res.statusText}`);
  const data = await res.json();
  let content = data.choices?.[0]?.message?.content || '{}';
  
  // Clean up potential markdown formatting around JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) content = jsonMatch[0];
  
  return JSON.parse(content);
}

async function callLLMText(messages: any[]) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages
    })
  });
  if (!res.ok) throw new Error(`OpenRouter API Error: ${res.statusText}`);
  const data = await res.json();
  return String(data.choices?.[0]?.message?.content || '').trim();
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Daily Blog Agent Error: missing or invalid "${fieldName}"`);
  }
  return value.trim();
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end('Unauthorized');
  }

  const GITHUB_TOKEN = process.env.GITHUB_PAT;
  const REPO_OWNER = 'Rupesh7128';
  const REPO_NAME = 'Hireschema';
  const FILE_PATH = 'src/data/blogPosts.json';

  if (!GITHUB_TOKEN || !OPENROUTER_KEY) {
    return res.status(500).send('Missing required environment variables (GITHUB_PAT or VITE_OPENROUTER_API_KEY)');
  }

  try {
    console.log("[Daily Blog Agent] Starting Multi-Agent Orchestration Flow...");

    // --- 1. Fetch current blog posts from GitHub ---
    const githubFileUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const fileRes = await fetch(githubFileUrl, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });
    
    if (!fileRes.ok) throw new Error(`GitHub API Error: ${fileRes.statusText}`);
    
    const fileData = await fileRes.json();
    const currentSha = fileData.sha;
    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
    const blogPosts = JSON.parse(currentContent);
    const existingSlugs = blogPosts.map((p: any) => p.slug).join(', ');

    // --- 2. TOPIC AGENT ---
    const topicPrompt = `
You are a Topic Selection Agent.

Your job is to select ONE high-impact blog topic.

Context:
- Product: Hireschema (AI hiring / recruitment / automation)
- Audience: founders, recruiters, operators
- Goal: traffic + conversions

# TASK

Generate ONE blog idea:

Return JSON:
{
  "title": "",
  "angle": "",
  "target_keyword": "",
  "search_intent": "",
  "why_this_matters": ""
}
`;

    console.log("[Daily Blog Agent] Running Topic Agent...");
    const topicData = await callLLM([{ role: 'user', content: topicPrompt }]) as TopicData;
    requireString(topicData.title, 'topicData.title');
    requireString(topicData.angle, 'topicData.angle');
    requireString(topicData.target_keyword, 'topicData.target_keyword');
    requireString(topicData.search_intent, 'topicData.search_intent');

    // --- 3. WRITER AGENT PROMPT ---
    const writerPrompt = `
You are an elite blog writer.

You are writing THIS specific blog:

TITLE: ${topicData.title}
ANGLE: ${topicData.angle}
KEYWORD: ${topicData.target_keyword}
INTENT: ${topicData.search_intent}

---

# CONTEXT

Product: Hireschema
Audience: founders, recruiters, operators

---

# WRITING RULES

## Anti-Slop
- No generic intros
- No filler
- No repetition

## Humanization
- Write like someone who has done this
- Add opinions, not just explanations
- Use natural phrasing

## Depth
- Must include:
  - real examples
  - specific insights
  - trade-offs

## Internal Linking
Use these slugs naturally:
${existingSlugs}

---

# STRUCTURE (FLEXIBLE, NOT RIGID)

Include:
- Strong hook (first 3 lines)
- Direct answer early
- 2–4 sections max
- Examples
- FAQ (optional if useful)

DO NOT force structure if it hurts quality.

---

# VIRALITY RULE

- Strong title
- Clear problem
- At least 1 unique insight

---

# OUTPUT

Return ONLY JSON:
{
  "title": "",
  "slug": "",
  "content": "",
  "excerpt": "",
  "keywords": []
}
`;

    // --- 4. VERIFICATION AGENT PROMPT ---
    const verificationPrompt = `
You are a ruthless content critic.

Your job is to REJECT mediocre content.

---

# CHECK:

1. Is this generic?
2. Does it sound like AI?
3. Is there ANY unique insight?
4. Would a real founder actually learn something?
5. Is the hook strong?
6. Are examples specific?

---

# SCORING

Give score out of 10.

---

# OUTPUT

{
  "pass": false,
  "score": 0,
  "issues": [],
  "fixes": []
}

---

# RULE

If score < 7 -> FAIL
`;

    // --- 5. ORCHESTRATION LOOP (Writer -> Verifier -> Rewrite) ---
    console.log("[Daily Blog Agent] Running Writer Agent...");
    
    let messages = [{ role: 'user', content: writerPrompt }];
    let generatedData: GeneratedBlogPost | null = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 3;
    let finalPostPassed = false;

    while (attempts < MAX_ATTEMPTS && !finalPostPassed) {
      attempts++;
      console.log(`[Daily Blog Agent] Generation Attempt ${attempts}/${MAX_ATTEMPTS}`);
      
      const generated = await callLLM(messages) as GeneratedBlogPost;
      generatedData = {
        title: requireString(generated.title, 'generatedData.title'),
        slug: requireString(generated.slug, 'generatedData.slug'),
        content: requireString(generated.content, 'generatedData.content'),
        excerpt: requireString(generated.excerpt, 'generatedData.excerpt'),
        keywords: normalizeStringArray(generated.keywords)
      };
      
      console.log("[Daily Blog Agent] Running Verification Agent...");
      const verificationMessages = [
        { role: 'system', content: verificationPrompt },
        { role: 'user', content: JSON.stringify(generatedData) }
      ];
      
      const verificationResult = await callLLM(verificationMessages) as VerificationResult;
      console.log(`[Daily Blog Agent] Verification Result:`, verificationResult);

      const pass =
        verificationResult.pass === true &&
        typeof verificationResult.score === 'number' &&
        verificationResult.score >= 7;

      if (pass) {
        finalPostPassed = true;
        console.log("[Daily Blog Agent] Blog post passed verification!");
      } else {
        console.log("[Daily Blog Agent] Blog post failed verification. Initiating rewrite mode...");
        messages.push({ role: 'assistant', content: JSON.stringify(generatedData) });
        const issues = Array.isArray(verificationResult.issues) ? verificationResult.issues : [];
        messages.push({ 
          role: 'user', 
          content: `
Rewrite the blog to fix these issues:

${issues.join('\n')}

Improve:
- clarity
- originality
- human tone

Do NOT start from scratch. Improve it.
` 
        });
      }
    }

    if (!generatedData || !generatedData.title) {
      throw new Error("Failed to generate valid blog post data after multiple attempts.");
    }

    // --- 6. LINKING AGENT ---
    console.log("[Daily Blog Agent] Running Linking Agent...");
    const linkingPrompt = `
Insert 2–3 natural internal links into this blog.

Available slugs:
${existingSlugs}

Return updated content only.
`;

    const linkedContent = await callLLMText([
      { role: 'user', content: `${linkingPrompt}\n\n${generatedData.content}` }
    ]);
    generatedData.content = requireString(linkedContent, 'generatedData.content');

    const newPost = {
      slug: generatedData.slug || `post-${Date.now()}`,
      title: generatedData.title || `Insights on Remote Work (${new Date().toLocaleDateString()})`,
      excerpt: generatedData.excerpt || "Latest insights from the Hireschema team.",
      date: new Date().toISOString().split('T')[0],
      author: "Hireschema AI",
      content: generatedData.content || "# Daily Insights\n\nNo content generated."
    };

    // --- 7. Commit Agent (Publisher) ---
    blogPosts.unshift(newPost);
    const updatedContent = JSON.stringify(blogPosts, null, 2);

    console.log(`[Daily Blog Agent] Pushing commit for: ${newPost.title}`);
    
    const commitRes = await fetch(githubFileUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `feat(blog): autonomous multi-agent post published - ${newPost.title}`,
        content: Buffer.from(updatedContent).toString('base64'),
        sha: currentSha,
        branch: 'main'
      })
    });

    if (!commitRes.ok) throw new Error(`GitHub Commit Error: ${commitRes.statusText}`);

    console.log(`[Daily Blog Agent] Successfully committed new post: ${newPost.slug}`);
    return res.status(200).send(`Multi-Agent blog post generated and committed to GitHub. Vercel will now rebuild the site.`);
  } catch (error: any) {
    console.error('Blog Agent Error:', error);
    return res.status(500).send(error.message);
  }
}
