import { VercelRequest, VercelResponse } from '@vercel/node';

const OPENROUTER_KEY = process.env.VITE_OPENROUTER_API_KEY;

// Helper to call LLM and parse JSON
async function callLLM(messages: any[]) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4.6-fast',
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

    // --- 2. WRITER AGENT PROMPT ---
    const writerPrompt = `You are an Elite Blog Writing Agent for a fully autonomous content system.
Your job is to generate high-performance, human-quality, LLM-optimized blog posts.

---
# 🧩 SKILLS YOU MUST USE

## 1. Anti-AI Slop Skill
Strictly avoid:
- generic intros (e.g., "In today's fast-paced world")
- filler phrases
- predictable formatting
- surface-level explanations

## 2. Humanizer Skill (CRITICAL)
- Write like a real operator, not a content writer
- Use natural phrasing, slight imperfection in flow, opinions, and reasoning.

## 3. Pragmatic SEO & LLM Optimization Skill
- Make content easy to extract (use definitions, bullets).
- Focus on actionable solutions, not keyword stuffing.

## 4. Internal Linking Engine
- Insert 3–5 internal links using markdown: [Link Text](/blog/slug)
- Available slugs to link to: ${existingSlugs}

---
# 📊 STRICT STRUCTURE TEMPLATE (MANDATORY)
You MUST follow this exact structure in your markdown content:

# [Punchy, Outcome-Driven Title]

**TL;DR:**
- [Bullet 1]
- [Bullet 2]
- [Bullet 3]

## The Problem
[Directly address the pain point without fluff]

## The Solution / Direct Answer
[Provide the core strategy or definition]

## Examples & Use Cases
[Give 2-3 highly specific, actionable examples]

## Key Takeaways
[Summarize the main points]

## FAQ
**Q: [Question 1]**
A: [Answer 1]
**Q: [Question 2]**
A: [Answer 2]

[Subtle CTA for Hireschema at the end]

---
# ⚠️ HARD RULES
- MUST use the exact structure above.
- MUST include at least 2 internal links.
- Target ~2000 characters.

# 🚀 VIRALITY FILTER RULE (CRITICAL)
Before finalizing, ensure:
- The title creates curiosity
- The blog solves a real problem
- At least 2 insights are "worth sharing"
- The content has 1 strong opinion or unique take

# 📤 OUTPUT FORMAT
You MUST return ONLY a valid JSON object. No markdown code blocks, no intro text. Just the raw JSON.
{
  "title": "Punchy, Clickable Title",
  "slug": "unique-seo-friendly-slug",
  "content": "# Markdown Content Follows Template...",
  "excerpt": "2 sentence meta description",
  "keywords": ["keyword1", "keyword2"]
}`;

    // --- 3. VERIFICATION AGENT PROMPT ---
    const verificationPrompt = `You are a Blog Quality Verification Agent.
Your job is to act as a strict Quality Control layer for an autonomous content system.
Check if the provided blog post JSON meets these exact requirements:

1. Anti-Slop Check: No filler, no repetition, no generic phrases.
2. Humanization Check: Natural tone, feels written by human, contains opinion/insight.
3. SEO + LLM Check: Clear structure, extractable sections, good headings, TL;DR present.
4. Internal Linking Check: At least 2 internal links present and contextually relevant.
5. Value Check: Genuinely useful, actionable examples provided.
6. Virality Filter: Does it create curiosity? Does it solve a real problem? Does it have a strong opinion?

Analyze the JSON blog post provided by the user.
You MUST return ONLY a valid JSON object in this format (no markdown, no intro):
{
  "pass": boolean,
  "issues": ["Issue 1", "Issue 2"],
  "suggested_fixes": ["Fix 1", "Fix 2"]
}`;

    // --- 4. ORCHESTRATION LOOP (Writer -> Verifier -> Self-Correct) ---
    console.log("[Daily Blog Agent] Running Writer Agent...");
    
    let messages = [{ role: 'user', content: writerPrompt }];
    let generatedData = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 3;
    let finalPostPassed = false;

    while (attempts < MAX_ATTEMPTS && !finalPostPassed) {
      attempts++;
      console.log(`[Daily Blog Agent] Generation Attempt ${attempts}/${MAX_ATTEMPTS}`);
      
      generatedData = await callLLM(messages);
      
      console.log("[Daily Blog Agent] Running Verification Agent...");
      const verificationMessages = [
        { role: 'system', content: verificationPrompt },
        { role: 'user', content: JSON.stringify(generatedData) }
      ];
      
      const verificationResult = await callLLM(verificationMessages);
      console.log(`[Daily Blog Agent] Verification Result:`, verificationResult);

      if (verificationResult.pass) {
        finalPostPassed = true;
        console.log("[Daily Blog Agent] Blog post passed verification!");
      } else {
        console.log("[Daily Blog Agent] Blog post failed verification. Initiating self-correction...");
        // Add the generation and the feedback to the Writer's context
        messages.push({ role: 'assistant', content: JSON.stringify(generatedData) });
        messages.push({ 
          role: 'user', 
          content: `Your previous output failed the Quality Control check.\n\nIssues found:\n- ${verificationResult.issues.join('\n- ')}\n\nSuggested fixes:\n- ${verificationResult.suggested_fixes.join('\n- ')}\n\nPlease regenerate the JSON object and fix these issues completely. Do not apologize, just return the fixed JSON.` 
        });
      }
    }

    if (!generatedData || !generatedData.title) {
      throw new Error("Failed to generate valid blog post data after multiple attempts.");
    }

    const newPost = {
      slug: generatedData.slug || `post-${Date.now()}`,
      title: generatedData.title || `Insights on Remote Work (${new Date().toLocaleDateString()})`,
      excerpt: generatedData.excerpt || "Latest insights from the Hireschema team.",
      date: new Date().toISOString().split('T')[0],
      author: "Hireschema AI",
      content: generatedData.content || "# Daily Insights\n\nNo content generated."
    };

    // --- 5. Commit Agent (Publisher) ---
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
