import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return res.status(401).end('Unauthorized');
  // }

  const GITHUB_TOKEN = process.env.GITHUB_PAT;
  const REPO_OWNER = 'Rupesh7128';
  const REPO_NAME = 'Hireschema';
  const FILE_PATH = 'src/data/blogPosts.json';
  const OPENROUTER_KEY = process.env.VITE_OPENROUTER_API_KEY;

  if (!GITHUB_TOKEN || !OPENROUTER_KEY) {
    return res.status(500).send('Missing required environment variables (GITHUB_PAT or VITE_OPENROUTER_API_KEY)');
  }

  try {
    console.log("[Daily Blog Agent] Waking up to generate and commit new blog post...");

    // 1. Fetch current blog posts from GitHub
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

    // 2. Generate the new post via OpenRouter
    const prompt = `You are an Elite Blog Writing Agent for a fully autonomous content system.
Your job is to generate high-performance, human-quality, LLM-optimized blog posts.

---

# 🧩 SKILLS YOU MUST USE

## 1. Anti-AI Slop Skill
Strictly avoid:
- generic intros
- filler phrases
- predictable formatting
- repeated sentence structures
- surface-level explanations

Every sentence must add value.

---

## 2. Humanizer Skill (CRITICAL)
- Write like a real operator, not a content writer
- Use:
  - natural phrasing
  - slight imperfection in flow
  - opinions and perspective
  - reasoning ("here’s why this works")

- Avoid:
  - robotic tone
  - textbook explanation

---

## 3. Pragmatic SEO Skill
- Focus on:
  - real user problems
  - actionable solutions
  - outcome-driven titles

- Do NOT chase keywords blindly

---

## 4. LLM Optimization Skill
- Make content:
  - easy to extract
  - structured
  - quotable

Include:
- definition-style sentences
- bullet points (only where useful)
- clear hierarchy

---

## 5. Internal Linking Skill
- Use provided slugs
- Naturally link 3–5 relevant blogs
- Contextual placement only (no spam)
Available slugs to link to: ${existingSlugs}

---

## 6. Depth & Insight Skill
- Add:
  - real examples
  - trade-offs
  - unique insights

---

# 🧾 KEYWORD USAGE RULE

- Use primary keyword naturally (no stuffing)
- Include semantic variations
- Focus on meaning, not repetition

---

# 📊 STRUCTURE (MANDATORY)

1. Title (specific + outcome-driven)
2. TL;DR (3–5 bullets)
3. Direct Answer
4. Main Sections (H2/H3)
5. Examples / Use Cases
6. Internal Links (natural placement)
7. FAQ (5–8 questions)
8. Key Takeaways
9. Subtle CTA

---

# 🎯 HOOK RULE (VERY IMPORTANT)

First 3 lines must:
- create curiosity OR
- call out a real problem OR
- challenge a belief

---

# ⚠️ HARD RULES

- No fluff
- No repetition
- No generic advice
- No keyword stuffing
- MUST be around 2000 characters in length.

---

# 📤 OUTPUT FORMAT

You MUST return ONLY a valid JSON object. No markdown code blocks, no intro text, no outro text. Just the raw JSON.
Format required:
{
  "title": "Punchy, Clickable, LLM-Optimized Title",
  "slug": "unique-seo-friendly-slug-with-dashes",
  "content": "# Markdown Content Goes Here\\n\\nKeep paragraphs short.",
  "excerpt": "2 sentence meta description",
  "keywords": ["keyword1", "keyword2"]
}`;

    console.log("[Daily Blog Agent] Requesting AI Generation...");
    
    // We use Claude 3.5 Sonnet for writing quality, or Perplexity if live search is preferred.
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!aiRes.ok) throw new Error(`OpenRouter API Error: ${aiRes.statusText}`);

    const aiData = await aiRes.json();
    let contentString = aiData.choices?.[0]?.message?.content || '{}';
    
    // Clean up potential markdown formatting around JSON
    const jsonMatch = contentString.match(/\{[\s\S]*\}/);
    if (jsonMatch) contentString = jsonMatch[0];

    const generatedData = JSON.parse(contentString);

    const newPost = {
      slug: generatedData.slug || `post-${Date.now()}`,
      title: generatedData.title || `Insights on Remote Work (${new Date().toLocaleDateString()})`,
      excerpt: generatedData.excerpt || "Latest insights from the Hireschema team.",
      date: new Date().toISOString().split('T')[0],
      author: "Hireschema AI",
      content: generatedData.content || "# Daily Insights\n\nNo content generated."
    };

    // 3. Update the array
    blogPosts.unshift(newPost);
    const updatedContent = JSON.stringify(blogPosts, null, 2);

    // 4. Commit back to GitHub
    console.log(`[Daily Blog Agent] Pushing commit for: ${newPost.title}`);
    
    const commitRes = await fetch(githubFileUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `feat(blog): autonomous daily post published - ${newPost.title}`,
        content: Buffer.from(updatedContent).toString('base64'),
        sha: currentSha,
        branch: 'main'
      })
    });

    if (!commitRes.ok) throw new Error(`GitHub Commit Error: ${commitRes.statusText}`);

    console.log(`[Daily Blog Agent] Successfully committed new post: ${newPost.slug}`);
    return res.status(200).send(`Blog post generated and committed to GitHub. Vercel will now rebuild the site.`);
  } catch (error: any) {
    console.error('Blog Agent Error:', error);
    return res.status(500).send(error.message);
  }
}