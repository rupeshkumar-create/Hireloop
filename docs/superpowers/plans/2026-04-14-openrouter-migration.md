# AI Model Separation & Pricing Update Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the backend API proxy to use OpenRouter, separate models based on task complexity (cheap vs smart), and update pricing copy across the app.

**Architecture:** 
1. The `api/openai.ts` serverless function will be renamed/repurposed to `api/openrouter.ts` (or we can just change the URL/headers in the existing file to point to OpenRouter).
2. `src/services/aiService.ts` will explicitly request different models depending on the function.
    - **Cheap/Fast Model (e.g. `google/gemini-2.5-flash` or `meta-llama/llama-3-8b-instruct`)**: Used for background processing like scoring 20 jobs, extracting preferences, suggesting career paths.
    - **Smart/Writing Model (e.g. `anthropic/claude-3.5-sonnet` or `openai/gpt-4o`)**: Used for high-quality generation like Cold Emails, Tailored Resumes, and Interview Questions.
3. Update pricing on LandingPage and Settings to $9/mo and $79/yr.

**Tech Stack:** React, Vite, OpenRouter API.

---

### Task 1: Update API Proxy for OpenRouter

**Files:**
- Modify: `api/openai.ts`

- [ ] **Step 1: Switch OpenAI SDK to OpenRouter endpoint**
```typescript
import { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://hireschema.com',
    'X-Title': 'Hireschema',
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { messages, response_format, model } = req.body;
    
    // Fallback to a cheap model if none provided
    const selectedModel = model || 'google/gemini-2.5-flash';
    
    const response = await openai.chat.completions.create({
      model: selectedModel,
      messages,
      ...(response_format && { response_format })
    });
    return res.status(200).json(response);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
```

### Task 2: Assign Specific Models in `aiService.ts`

**Files:**
- Modify: `src/services/aiService.ts`

- [ ] **Step 1: Update `callOpenAI` to accept `model` parameter**
```typescript
async function callOpenAI(messages: any[], response_format?: any, model: string = 'google/gemini-2.5-flash') {
  const response = await fetch('/api/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, response_format, model })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to call AI proxy');
  }
  return response.json();
}
```

- [ ] **Step 2: Assign Cheap Model (`google/gemini-2.5-flash`) for processing tasks**
Update the `callOpenAI` calls in:
- `generateDailyJobs` (both scoring and fallback)
- `suggestCareerPaths`
- `analyzeResume`
- `extractJobPreferences`
*(They can just use the default parameter or explicitly pass `'google/gemini-2.5-flash'`)*

- [ ] **Step 3: Assign Smart Model (`anthropic/claude-3.5-sonnet`) for writing tasks**
Update the `callOpenAI` calls in:
- `generateColdEmail`: `await callOpenAI(..., undefined, 'anthropic/claude-3.5-sonnet')`
- `tailorResume`: `await callOpenAI(..., undefined, 'anthropic/claude-3.5-sonnet')`
- `generateInterviewQuestions`: `await callOpenAI(..., undefined, 'anthropic/claude-3.5-sonnet')`
- `generateSalaryInsights`: `await callOpenAI(..., undefined, 'anthropic/claude-3.5-sonnet')`

### Task 3: Update Pricing Copy

**Files:**
- Modify: `src/pages/LandingPage.tsx`
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Update `LandingPage.tsx`**
Change `$19/month` to `$9/month`.
*(Assuming there's a yearly price mentioned, update it to $79. If not, just ensure monthly is $9).*

- [ ] **Step 2: Update `Settings.tsx`**
Change Monthly Pro display to `$9/mo`.
Change Yearly Pro display to `$79/yr`.
Ensure the Dodo Payment URLs are preserved (since the actual billing happens in Dodo, changing the frontend text just aligns the UX. The user must update Dodo products on their end).

### Task 4: Update Environment Variable Docs

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Replace `VITE_OPENAI_API_KEY` with `VITE_OPENROUTER_API_KEY`**
```env
VITE_OPENROUTER_API_KEY=your_openrouter_api_key_here
```
*(Also inform the user in the final message that they need to update Vercel to use `VITE_OPENROUTER_API_KEY` instead of `VITE_OPENAI_API_KEY`)*
