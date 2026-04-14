# Advanced Automation, Self-Learning, & Pro Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement daily historical job tracking, 8:00 AM IST automated cron jobs, a hidden self-learning engine based on user behavior, automatic generation of AI assets on job save (Pro only), and editable/downloadable resumes and emails.

**Architecture:** 
1. **Cron & History:** Update `vercel.json` to run at 2:30 AM UTC (8:00 AM IST). Update the cron endpoint to generate jobs, save them by date in Firestore (`users/{uid}/daily_matches/{date}`), and email the user.
2. **Self-Learning Engine:** Add a hidden `learningProfile` object to the user document. When a user saves a job, or edits a generated email/resume, an async background task analyzes the action using Gemini Flash and updates their `learningProfile.jobPreferences` or `learningProfile.writingStyle`. These strings are then injected into future Serper Query and Sonnet Writing prompts.
3. **Pro Auto-Generation:** When a Pro user saves a job, we immediately trigger `generateColdEmail`, `tailorResume`, and `generateInterviewQuestions` and save the results directly to the job document in Firestore so they are instantly accessible everywhere. Free users are locked out of this via UI overlays.
4. **Editing & Exporting:** Add textareas for Pro users to manually edit or "AI Improve" their emails/resumes. Add PDF/DOCX export functionality using client-side libraries.

**Tech Stack:** React, Firestore, OpenRouter (Gemini Flash & Claude Opus), Vercel Cron, html2pdf.js, docx.

---

### Task 1: Update User Profile & Setup Export Libraries

**Files:**
- Modify: `package.json`
- Modify: `src/contexts/AuthContext.tsx`

- [ ] **Step 1: Install export libraries**
Run: `npm install html2pdf.js docx file-saver`
Run: `npm install -D @types/file-saver`

- [ ] **Step 2: Update UserProfile interface**
Add the learning profile and history structures to `AuthContext.tsx`.
```typescript
export interface LearningProfile {
  jobPreferences: string;
  writingStyle: string;
}

// Update UserProfile interface
  learningProfile?: LearningProfile;
```

### Task 2: Implement the Hidden Self-Learning Engine

**Files:**
- Modify: `src/services/aiService.ts`

- [ ] **Step 1: Create `updateLearningProfile` function**
Create a function that takes an action type ('save_job', 'edit_email', 'edit_resume'), the action payload, and the current learning profile, and uses Gemini Flash to return an updated, concise learning profile string.
```typescript
export async function updateLearningProfile(
  actionType: 'save_job' | 'edit_email' | 'edit_resume',
  actionData: string,
  currentContext: string = ''
): Promise<string> {
  const prompt = `You are a hidden AI background processor analyzing user behavior to improve future generations.
Current learned context: "${currentContext}"
New user action: ${actionType}
Action details: ${actionData}

Update the learned context. Keep it under 50 words. Be highly concise. Focus only on what this tells us about their job preferences (if save_job) or writing style preferences (if edit).
Respond ONLY with the updated context string.`;

  try {
    const response = await callOpenAI([{ role: 'user', content: prompt }], undefined, 'google/gemini-3-flash-preview');
    return response.choices?.[0]?.message?.content || currentContext;
  } catch (e) {
    return currentContext;
  }
}
```

- [ ] **Step 2: Inject Learning Profile into Job Search & Writing Prompts**
Modify `generateDailyJobs` to accept and use `learningContext: string`.
```typescript
// Inside generateDailyJobs queryPrompt:
Hidden User Preferences learned from past behavior: ${learningContext}
Incorporate these preferences when generating the search queries.
```
Modify `generateColdEmail` and `tailorResume` to accept and use `writingStyleContext: string`.
```typescript
// Inside prompts:
User's specific writing style preferences learned from past edits: ${writingStyleContext}
Strictly adhere to these stylistic preferences.
```

### Task 3: Auto-Generation & Pro Restrictions on Save

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/JobTracker.tsx`

- [ ] **Step 1: Update Job saving logic in Dashboard**
When a Pro user saves a job, trigger the generations concurrently, save to Firestore, and trigger the learning update.
```typescript
// Pseudo-logic for handleSaveJob
const isPro = profile?.plan === 'pro';
let generatedData = {};

if (isPro && profile?.resumeText) {
  toast.info('Generating AI assets in background...');
  // Run these asynchronously so UI doesn't block
  Promise.all([
    generateColdEmail(job.title, job.company, profile.resumeText, true, profile.learningProfile?.writingStyle),
    tailorResume(job.title, job.description, profile.resumeText, true, profile.learningProfile?.writingStyle),
    generateInterviewQuestions(job.title, job.company, true)
  ]).then(async ([email, resume, questions]) => {
    // Update firestore job document with these assets
    // ...
  });
}

// Trigger background learning
if (profile?.learningProfile) {
  updateLearningProfile('save_job', `Saved role: ${job.title} at ${job.company}`, profile.learningProfile.jobPreferences)
    .then(newPrefs => updateProfile({ learningProfile: { ...profile.learningProfile, jobPreferences: newPrefs } }));
}
```

- [ ] **Step 2: Lock Free Users out of AI Tabs**
In `JobTracker.tsx` (or wherever the tabs are displayed), check `profile.plan === 'pro'`. If false, show a blurred overlay with an "Upgrade to Pro" button over the Cold Email, Resume, and Interview tabs.

### Task 4: Editable AI Assets & Exporting (PDF/DOCX)

**Files:**
- Modify: `src/pages/JobTracker.tsx` (or the specific components rendering the assets)

- [ ] **Step 1: Make Email and Resume editable**
Replace static Markdown renders with a Toggle (View / Edit). In Edit mode, show a `<Textarea>`. 
Add an "Improve with AI" button that takes a user instruction (e.g., "Make it shorter") and regenerates the content using Claude.
When the user saves their manual edits, trigger `updateLearningProfile('edit_email', editedText)`.

- [ ] **Step 2: Implement PDF and DOCX Download**
Add two buttons: "Download PDF" and "Download DOCX".
Use `html2pdf.js` for PDF generation of the rendered markdown.
Use `docx` and `file-saver` to generate and save a `.docx` file containing the text.

### Task 5: 8:00 AM IST Cron & Daily History

**Files:**
- Modify: `vercel.json`
- Modify: `api/cron/daily-alerts.ts`

- [ ] **Step 1: Update Vercel Cron Schedule**
Change `vercel.json` schedule to `"30 2 * * *"` (which is 2:30 AM UTC = 8:00 AM IST).

- [ ] **Step 2: Rewrite `daily-alerts.ts`**
The cron job must:
1. Fetch all users where `receiveDailyAlerts == true`.
2. For each user, call `generateDailyJobs` (passing their `learningProfile.jobPreferences`).
3. Save the results to Firestore under `users/{uid}/daily_matches/{YYYY-MM-DD}`.
4. Send an email via Resend summarizing the top jobs.
*(Note: Because Vercel serverless functions timeout after 10s-60s on hobby tiers, implement a batched approach or acknowledge that in a real production environment this would trigger a Pub/Sub queue. For this plan, we will implement a basic loop with a strict limit to prevent timeouts).*
