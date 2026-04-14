# AI Job Search Fallback (Perplexity/Claude) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a hybrid search system. Serper (Google Search) remains the fast primary scraper, but if it returns fewer than the required limit (e.g., < 10 jobs), the system automatically triggers an AI-powered web search (using Perplexity via OpenRouter) to scour the live internet and find the remaining jobs.

**Architecture:** 
1. Create `searchJobsWithAI` in `aiService.ts`. It will use `perplexity/llama-3.1-sonar-small-128k-online` (which has live internet access) to search for jobs.
2. In `generateDailyJobs`, after deduplicating Serper results, check if `realJobs.length < limit`.
3. If so, calculate `missingCount = limit - realJobs.length` and call `searchJobsWithAI(missingCount, ...)`.
4. Merge the AI-found jobs with the Serper jobs, deduplicate again, and then proceed to the scoring phase.

**Tech Stack:** TypeScript, OpenRouter (Perplexity Online models).

---

### Task 1: Create the AI Fallback Search Function

**Files:**
- Modify: `src/services/aiService.ts`

- [ ] **Step 1: Write the `searchJobsWithAI` function**
```typescript
async function searchJobsWithAI(
  careerPaths: string[],
  minSalary: number | null,
  missingCount: number,
  resumeText: string
): Promise<any[]> {
  const prompt = `You are a live web-searching AI. Search the internet right now for EXACTLY ${missingCount} active, remote job openings that match these career paths: ${careerPaths.join(', ')}.
  
Rules:
1. The jobs MUST be 100% remote.
2. They MUST have been posted within the last 7 days.
3. ${minSalary ? `They MUST have a salary of at least $${minSalary}.` : 'Salary is preferred but optional.'}
4. Prioritize direct company career pages (Greenhouse, Lever, Workable) over generic job boards.
5. Return the results as a raw JSON array of objects. Do not include markdown code blocks, just the JSON.

Required JSON format for each object:
{
  "title": "Job Title",
  "company": "Company Name",
  "location": "Remote",
  "description": "Brief 2-sentence summary of the role",
  "applyLink": "https://actual-link-to-apply.com",
  "salary": "$XXX,XXX",
  "postedAt": "2 days ago"
}`;

  try {
    // We use a Perplexity model with online capabilities via OpenRouter
    const response = await callOpenAI([{ role: 'user', content: prompt }], undefined, 'perplexity/llama-3.1-sonar-small-128k-online');
    const content = response.choices?.[0]?.message?.content || '[]';
    
    // Safely parse the JSON out of the response (sometimes AI wraps it in markdown)
    const jsonMatch = content.match(/\\[[\\s\\S]*\\]/);
    const jsonString = jsonMatch ? jsonMatch[0] : content;
    
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('AI Fallback Search failed:', error);
    return [];
  }
}
```

### Task 2: Integrate Fallback into `generateDailyJobs`

**Files:**
- Modify: `src/services/aiService.ts`

- [ ] **Step 1: Update the job collection logic**
After deduplicating the `realJobs` from Serper, check if we need more.

```typescript
  // ---- Deduplicate: remove jobs this user has already seen ----
  if (seenFingerprints.length > 0) {
    realJobs = realJobs.filter(job => {
      const fp = `${job.company.toLowerCase()}|${job.title.toLowerCase()}`;
      return !seenFingerprints.includes(fp);
    });
  }

  // ---- NEW STEP: AI Fallback Search ----
  // If Serper didn't find enough fresh, unseen jobs, use Perplexity AI to scour the live web for the rest!
  if (realJobs.length < limit) {
    const missingCount = limit - realJobs.length;
    console.log(`Serper found ${realJobs.length} jobs. Falling back to AI Search to find ${missingCount} more...`);
    
    const aiFoundJobs = await searchJobsWithAI(careerPaths, minSalary, missingCount, resumeText);
    
    // Merge and deduplicate against existing seen list AND the newly found Serper jobs
    for (const aiJob of aiFoundJobs) {
      const fp = `${aiJob.company.toLowerCase()}|${aiJob.title.toLowerCase()}`;
      const alreadyInSerper = realJobs.some(rj => `${rj.company.toLowerCase()}|${rj.title.toLowerCase()}` === fp);
      
      if (!seenFingerprints.includes(fp) && !alreadyInSerper) {
        realJobs.push(aiJob);
      }
    }
  }

  // Final slice just to be absolutely sure we don't exceed the limit
  if (realJobs.length > limit) {
    realJobs = realJobs.slice(0, limit);
  }
```