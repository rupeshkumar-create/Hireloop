# Daily Blog Agent Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the cron-driven blog generator to use topic selection, stricter verification, guided rewrites, and post-processing internal linking.

**Architecture:** Keep the work inside `api/cron/daily-blog-agent.ts` with two small helpers: one for JSON-return LLM calls and one for plain-text linking output. Preserve the GitHub publish flow while replacing the prompt and retry logic.

**Tech Stack:** Vercel functions, TypeScript, OpenRouter, GitHub Contents API

---

### Task 1: Upgrade LLM Helpers

**Files:**
- Modify: `api/cron/daily-blog-agent.ts`

- [ ] **Step 1: Add helper validation and a text-return helper**

```ts
function requireString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Daily Blog Agent: missing required field "${field}"`);
  }
}

async function callLLMText(messages: any[]) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.7-sonnet',
      messages,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter API Error: ${res.statusText}`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}
```

- [ ] **Step 2: Update JSON helper to the new default model**

```ts
body: JSON.stringify({
  model: 'anthropic/claude-3.7-sonnet',
  messages
})
```

### Task 2: Add Topic And Writer Flow

**Files:**
- Modify: `api/cron/daily-blog-agent.ts`

- [ ] **Step 1: Insert topic generation before the writer loop**

```ts
const topicPrompt = `
You are a Topic Selection Agent.

Your job is to select ONE high-impact blog topic.

Context:
- Product: Hireschema (AI hiring / recruitment / automation)
- Audience: founders, recruiters, operators
- Goal: traffic + conversions

# TASK
Generate ONE blog idea.

Return JSON:
{
  "title": "",
  "angle": "",
  "target_keyword": "",
  "search_intent": "",
  "why_this_matters": ""
}
`;

const topicData = await callLLM([{ role: 'user', content: topicPrompt }]);
requireString(topicData.title, 'topic.title');
requireString(topicData.angle, 'topic.angle');
requireString(topicData.target_keyword, 'topic.target_keyword');
requireString(topicData.search_intent, 'topic.search_intent');
```

- [ ] **Step 2: Replace `writerPrompt` with the topic-aware prompt from the approved spec**

```ts
const writerPrompt = `
You are an elite blog writer.

You are writing THIS specific blog:

TITLE: ${topicData.title}
ANGLE: ${topicData.angle}
KEYWORD: ${topicData.target_keyword}
INTENT: ${topicData.search_intent}

Product: Hireschema
Audience: founders, recruiters, operators

Use these slugs naturally when useful:
${existingSlugs}

Return ONLY JSON:
{
  "title": "",
  "slug": "",
  "content": "",
  "excerpt": "",
  "keywords": []
}
`;
```

### Task 3: Replace Verifier And Rewrite Logic

**Files:**
- Modify: `api/cron/daily-blog-agent.ts`

- [ ] **Step 1: Replace `verificationPrompt` with score-based rejection**

```ts
const verificationPrompt = `
You are a ruthless content critic.

Check:
1. Is this generic?
2. Does it sound like AI?
3. Is there any unique insight?
4. Would a real founder actually learn something?
5. Is the hook strong?
6. Are examples specific?

Return JSON:
{
  "pass": false,
  "score": 0,
  "issues": [],
  "fixes": []
}

If score < 7, fail it.
`;
```

- [ ] **Step 2: Rewrite the loop to improve the existing draft instead of regenerating blindly**

```ts
const verificationResult = await callLLM(verificationMessages);
const passed = verificationResult.pass === true && Number(verificationResult.score) >= 7;

if (!passed) {
  messages.push({ role: 'assistant', content: JSON.stringify(generatedData) });
  messages.push({
    role: 'user',
    content: `
Rewrite the blog to fix these issues:

${verificationResult.issues.join('\n')}

Improve:
- clarity
- originality
- human tone

Do NOT start from scratch. Improve it.
`,
  });
}
```

### Task 4: Add Linking Pass And Final Validation

**Files:**
- Modify: `api/cron/daily-blog-agent.ts`

- [ ] **Step 1: Add the post-processing linking prompt**

```ts
const linkingPrompt = `
Insert 2-3 natural internal links into this blog.

Available slugs:
${existingSlugs}

Return updated content only.
`;

generatedData.content = await callLLMText([
  { role: 'user', content: `${linkingPrompt}\n\n${generatedData.content}` },
]);
requireString(generatedData.content, 'generatedData.content');
```

- [ ] **Step 2: Keep final post assembly unchanged except for stronger defaults**

```ts
const newPost = {
  slug: generatedData.slug || `post-${Date.now()}`,
  title: generatedData.title,
  excerpt: generatedData.excerpt || 'Latest insights from the Hireschema team.',
  date: new Date().toISOString().split('T')[0],
  author: 'Hireschema AI',
  content: generatedData.content,
};
```

### Task 5: Verify

**Files:**
- Modify: `api/cron/daily-blog-agent.ts`

- [ ] **Step 1: Run diagnostics**

```bash
npx tsc --noEmit
```

Expected: no TypeScript errors from `api/cron/daily-blog-agent.ts`.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Vite build completes successfully.
