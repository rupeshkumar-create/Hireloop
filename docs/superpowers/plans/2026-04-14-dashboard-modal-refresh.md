# Job Details Modal & Refresh Automation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Job Details side panel into an iOS-style glassmorphism modal popup. Update the Job Search logic to fetch direct apply links (not Google links), strictly enforce 7-day freshness, limit Pro users to 10 jobs daily, and implement a smart 24-hour Refresh button logic.

**Architecture:** 
1. **Glass Modal:** `JobDetailsPanel` will be refactored into `JobDetailsModal`, covering the full screen with `backdrop-blur` and a close button.
2. **Refresh Logic:** Update `Dashboard.tsx` to conditionally render the "Refresh Jobs" button based on `Date.now() - lastJobFetchTime > 24h`. When clicked, it bypasses the 24h cache and forces a new search.
3. **Direct Apply Links:** Serper returns `apply_options[0].link` which contains the direct ATS link (Greenhouse/Lever). We will update `serperService.ts` to prioritize this over the generic `job.link`.
4. **AI Agent Updates:** Update the `aiService.ts` prompt to include 23-step verification and strict rules for expert sourcing.

**Tech Stack:** React, Tailwind, Framer Motion, Serper API.

---

### Task 1: Direct Apply Links & 7-Day Freshness

**Files:**
- Modify: `src/services/serperService.ts`

- [ ] **Step 1: Extract direct apply links from Serper**
Serper Google Jobs API returns an array `apply_options` containing direct links. We should use the first one if available.

```typescript
// Inside searchRemoteJobs loop in serperService.ts
        // ── 3. 7-day staleness filter ─────────────────────────────────────
        const postedAt: string = job.detected_extensions?.posted_at || '';
        const daysOld = parsePostedDaysAgo(postedAt);
        if (daysOld > 7) continue;

        // Try to get the direct ATS link from apply_options
        let directApplyLink = '';
        if (job.apply_options && job.apply_options.length > 0) {
          directApplyLink = job.apply_options[0].link;
        }

        allJobs.push({
          title: job.title || '',
          company: job.company_name || '',
          location: loc || 'Remote',
          description: job.description || '',
          applyLink:
            directApplyLink ||
            job.apply_link ||
            job.link ||
            `https://www.google.com/search?q=${encodeURIComponent(
              `${job.title} ${job.company_name} remote job apply`
            )}`,
          salary: job.detected_extensions?.salary || '',
          postedAt,
        });
```

### Task 2: 23-Step Expert Verification Prompt

**Files:**
- Modify: `src/services/aiService.ts`

- [ ] **Step 1: Update `queryPrompt` in `generateDailyJobs`**
```typescript
  const queryPrompt = `You are an elite Executive Technical Sourcer with 20 years of experience. Your goal is to find highly relevant, active remote jobs for this candidate by bypassing generic job boards and searching ATS (Applicant Tracking System) platforms directly.
  
Execute a 23-step internal verification process to analyze the candidate's core competencies, seniority, and domain expertise. Based on this deep analysis of the resume and target career paths, generate 3 highly optimized Boolean search queries for Google.

Hidden User Preferences learned from past behavior: ${learningContext}
Incorporate these preferences when generating the search queries.

Strict Rules:
1. Every query MUST include the word "remote".
2. Extract the 2-3 most important technical skills or domain expertise from the resume and include them in the query (e.g., "React" AND "TypeScript").
3. Append ATS site operators to find direct company listings. Use this exact string at the end of every query: (site:greenhouse.io OR site:lever.co OR site:workable.com OR site:jobs.ashbyhq.com)
4. If a minimum salary is provided (${minSalary ? '$' + minSalary : 'none'}), append it logically.
5. EXCLUDE old jobs by adding "when:7d" or similar logic if applicable to your boolean strategy.

Example Output format:
"remote" AND ("Frontend" OR "Full Stack") AND "TypeScript" AND "React" (site:greenhouse.io OR site:lever.co OR site:workable.com)

Target Paths: ${careerPaths.join(', ')}
Resume Snippet: ${resumeText.substring(0, 1000)}

Return a JSON array of exactly 3 strings. Respond ONLY with the JSON array.`;
```

### Task 3: 24-Hour Refresh Button Logic

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/hooks/useDashboardJobs.ts`

- [ ] **Step 1: Update `useDashboardJobs.ts` to export `fetchJobs` and `lastFetchTime`**
Make sure `useDashboardJobs` exposes `lastJobFetchTime` and the `fetchJobs` function so the UI can call it manually.
```typescript
  const fetchJobs = async (forceRefresh: boolean = false) => {
    // Modify existing fetchJobs logic to respect forceRefresh
    // ...
  }
  
  return {
    jobs, loading, fetchJobs, lastFetchTime: profile?.lastJobFetchTime
  };
```

- [ ] **Step 2: Add Conditional Refresh Button in `Dashboard.tsx`**
```tsx
// Inside Dashboard.tsx
  const isRefreshAvailable = () => {
    if (!profile?.lastJobFetchTime) return true;
    const hoursSinceLastFetch = (Date.now() - new Date(profile.lastJobFetchTime).getTime()) / (1000 * 60 * 60);
    return hoursSinceLastFetch >= 24;
  };

// In the header section of the Dashboard
  {isRefreshAvailable() && (
    <Button onClick={() => fetchJobs(true)} disabled={loading}>
      <RefreshCw className="mr-2 h-4 w-4" /> Refresh Jobs
    </Button>
  )}
```

### Task 4: Glassmorphism Job Details Modal

**Files:**
- Modify: `src/components/dashboard/JobDetailsPanel.tsx` -> Rename/Refactor to `JobDetailsModal`

- [ ] **Step 1: Transform into an iOS Glass Modal**
```tsx
import { X } from 'lucide-react';

// Add onClose to props
export function JobDetailsPanel({
  selectedJob, saveJob, handleAiAction, aiAction, aiResult, actionLoading, downloadResume, onClose
}: JobDetailsPanelProps & { onClose: () => void }) {
  
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden rounded-3xl bg-white/80 backdrop-blur-2xl border border-white/40 shadow-2xl"
        >
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 bg-black/5 hover:bg-black/10 rounded-full backdrop-blur-md transition-colors"
          >
            <X className="h-5 w-5 text-zinc-700" />
          </button>
          
          {/* Existing Content with updated glass styling */}
          <div className="p-6 md:p-8 overflow-y-auto flex-1">
            {/* ... Rest of the job details ... */}
```

- [ ] **Step 2: Update `Dashboard.tsx` to render it as a Modal**
Remove the side-by-side flex layout for the panel and render it absolutely/fixed over the UI when `selectedJob` is not null. Pass `onClose={() => setSelectedJob(null)}`.
