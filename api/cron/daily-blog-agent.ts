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
    const prompt = `You are an elite blog writer in 2026 specializing in LLM-optimized, human-first content.
Your task is to write a blog that:
1. Ranks in AI search systems (ChatGPT, Claude, Perplexity)
2. Feels deeply human and impossible to detect as AI-written
3. Avoids all forms of AI-generated "slop"

---

## PART 1: REMOVE AI SLOP (STRICT RULES)
You MUST follow these rules:
- No generic filler phrases: (avoid: "In today's fast-paced world", "In conclusion", "It's important to note")
- No repetitive sentence structures
- No predictable patterns: (avoid always listing 3–5 bullet points in every section)
- No over-explaining obvious concepts
- No robotic transitions: (avoid: "Additionally", "Moreover", "Furthermore")
- No keyword stuffing
- No fake enthusiasm or hype tone
- No vague statements: Every claim must be specific, grounded, or example-backed
- DO NOT use em dashes (—). Use hyphens (-) or rephrase.

---

## PART 2: HUMANIZATION LAYER (MANDATORY)
Write like a real person with:
- Natural imperfections in flow (slight variation in sentence length)
- Occasional opinionated statements
- Subtle personality (dry humor, sharp clarity, or contrarian takes)
- Real-world framing: (talk like someone who has actually done the thing)
- Use conversational phrasing: (e.g., "Here's where it gets interesting", "Most people get this wrong")
- Avoid sounding like a teacher or textbook
- Add "thinking patterns": Show reasoning, not just conclusions

---

## PART 3: LLM OPTIMIZATION (CRITICAL)
Structure the content so AI systems can extract it:
- 1. Clear Topic Framing: A specific, unambiguous title, defined audience, and clear problem solved. (e.g., "How Recruiters Can Use AI Tools to Reduce Hiring Time by 40%")
- 2. Structured Headings: H1 -> Main topic, H2 -> Core sections, H3 -> Sub-points.
- 3. Direct Answer Blocks (VERY IMPORTANT): Include a TL;DR section, Definition block, and Step-by-step summaries right at the top.
- 4. Chunkable Content: Use bullet points, numbered lists, and short paragraphs (2-4 lines max).
- 5. Entity-Rich Content (CRITICAL): Include specific People, Tools, Companies, and Concepts (e.g., "Tools like ChatGPT, Claude, and Perplexity").
- 6. Context + Depth: Answer What, Why, How, When, and Alternatives. Include Examples, Use cases, and Comparisons.
- 7. FAQ Section (AI Goldmine): Add 5-10 questions at the end (What is X? How does X work? Alternatives to X?).
- 8. Internal + External Linking: Include Markdown links to the homepage [Hireschema](/) and other relevant slugs: ${existingSlugs}.
- Write at least 3 "quote-worthy" lines

---

## PART 4: DEPTH & ORIGINALITY
- Add at least 2 unique insights or perspectives
- Include real or realistic examples
- Include trade-offs (pros vs cons)
- Avoid surface-level explanations
- MUST be around 2000 characters in length.

---

## PART 5: STYLE CONSTRAINTS
- Tone: smart, slightly informal, grounded
- Avoid buzzwords unless necessary
- Write like you're explaining to an intelligent friend

---

## OUTPUT FORMAT
You MUST return ONLY a valid JSON object. No markdown code blocks, no intro text, no outro text. Just the raw JSON.
Format required:
{
  "slug": "unique-seo-friendly-slug-with-dashes",
  "title": "Punchy, Clickable, LLM-Optimized Title",
  "excerpt": "2 sentence meta description",
  "content": "# Markdown Content Goes Here\\n\\nKeep paragraphs short."
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