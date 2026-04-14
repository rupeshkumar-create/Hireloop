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
    const prompt = `You are an elite Pragmatic SEO expert and content strategist for 'Hireschema', an AI remote job search platform.
Generate ONE highly optimized, humanized, anti-AI slop blog post based on current trending topics in remote work or AI job hunting.

Rules:
1. Anti-AI Slop: Do NOT use words like "In today's fast-paced world", "delve into", "tapestry", "crucial", or "unlock". Write like a cynical Silicon Valley recruiter.
2. Geo-optimized: Mention global remote hubs (US, EU, LatAm).
3. Internal Linking: Naturally weave in markdown links to the homepage [Hireschema](/) and mention related topics (Available slugs to link to: ${existingSlugs}).
4. You MUST return ONLY a valid JSON object. No markdown code blocks, no intro text, no outro text. Just the raw JSON.

Format required:
{
  "slug": "unique-seo-friendly-slug-with-dashes",
  "title": "Punchy, Clickable Title",
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