# Real Job Pipeline Redesign

## Goal

Redesign the daily job-matching pipeline so it returns higher-trust remote jobs by staying inside live search, validating links aggressively, expanding queries intelligently, and ranking jobs with a richer scoring model.

## Scope

This design applies to:

- `src/services/aiService.ts`
- `src/services/serperService.ts`

In scope:
- Remove AI-generated job fallback
- Upgrade search-query generation for ATS-only precision
- Add link validation and strict job validation
- Add real-search expansion logic to fill the requested limit
- Add weighted ranking beyond raw AI match score
- Add company quality scoring
- Add salary prediction when salary is missing
- Add hot-job detection for urgent hiring signals
- Add debug logging around every pipeline phase

Out of scope:
- New external enrichment vendors or paid company-data APIs
- UI changes for rendering additional badges or explanations
- Changes to resume/email writing flows
- Changes to the daily blog agent

## Existing Problems

The current job pipeline has four quality risks:

1. Search queries are too broad and still include generic boards
2. The Perplexity fallback can invent jobs and break trust
3. Apply links are not validated against final ATS destinations
4. Final ranking depends too heavily on one AI `matchScore`

The current code also separates retrieval and ranking cleanly enough that these can be fixed without changing the consumer-facing API.

## Proposed Architecture

The new pipeline is:

1. Generate 5 high-precision ATS-only queries
2. Search Serper with those queries
3. Deduplicate results
4. Validate final apply links
5. Run strict job-shape validation
6. If below the requested limit, expand with additional real-search query sets
7. Score surviving jobs with AI plus deterministic ranking features
8. Return the top jobs sorted by `finalScore`

This keeps the system anchored to real job postings and removes hallucinated inventory from the flow.

## Components

### 1. Precision Query Generator

Replace the current query prompt with a recruiter-style precision prompt that:

- Requires the term `remote`
- Requires one job title
- Requires two core skills
- Restricts results to ATS domains only
- Excludes LinkedIn, Indeed, Naukri, and similar noisy boards
- Returns exactly 5 queries

Primary model:
- `google/gemini-2.0-flash`

Prompt requirements:
- Resume snippet capped around 1000 characters
- Career paths included explicitly
- ATS clause:
  - `site:greenhouse.io`
  - `site:lever.co`
  - `site:ashbyhq.com`
  - `site:workable.com`
  - `site:jobs.workday.com`

Fallback behavior:
- If query generation fails, derive deterministic ATS queries from the first few career paths and top inferred skills
- Do not fall back to generic broad web-search queries

### 2. Link Validation Engine

Add `validateJobLink(url: string): Promise<boolean>` in `src/services/serperService.ts`.

Behavior:
- Send a `HEAD` request with redirects enabled
- Reject any non-2xx result
- Inspect the final resolved URL
- Accept only URLs that resolve to trusted ATS/company-career patterns

Fallback behavior:
- If `HEAD` is rejected by the destination with `405` or an equivalent method restriction, retry with a lightweight `GET`
- Still evaluate the final resolved URL after redirects

Initial allowed patterns:
- `greenhouse.io`
- `lever.co`
- `workable.com`
- `ashbyhq.com`
- `workday.com`
- `jobs.`

Usage:
- Validate each `finalLink` before adding the job to the results list
- If validation fails, skip the job

This is a hard gate, not a soft preference.

### 3. Strict Job Validation

Add `isValidJob(job)` before any candidate job enters the scoring pool.

Validation rules:
- `title.length > 3`
- `company.length > 2`
- `applyLink.startsWith('http')`
- `location` includes `remote`

Additional recommended checks:
- Description is non-empty
- Title is not a placeholder like `job` or `opening`
- Company is not empty after trimming

If validation fails, skip the job immediately.

### 4. Search Expansion Engine

Remove `searchJobsWithAI(...)` entirely from `src/services/aiService.ts`.

Do not fabricate jobs under any circumstance.

Replace it with multi-pass real-search expansion:

#### Pass 1: Primary Queries

- Use the 5 precision queries returned by Gemini

#### Pass 2: Skill-Narrowed Queries

- Generate deterministic variants such as:
  - `remote backend engineer node.js aws site:greenhouse.io`
  - `remote full stack engineer react typescript site:lever.co`

#### Pass 3: Title-Synonym Expansion

- Expand title vocabulary using close synonyms:
  - `software engineer`
  - `developer`
  - `backend engineer`
  - `full stack engineer`
  - `platform engineer`

Loop behavior:
- Continue requesting more Serper results while `realJobs.length < limit` and expansion query sets remain
- Merge and deduplicate after every pass
- Stay inside real search only

Success rule:
- Aim to fill the requested `limit`
- If live search still produces fewer real jobs, return fewer jobs rather than inventing listings

### 5. Deduplication

Keep existing fingerprint-based deduplication using title + company.

Apply deduplication at all stages:
- Within one Serper response
- Across multiple query passes
- Against already-seen user fingerprints

### 6. Ranking Engine

Replace single-signal ranking with a multi-factor `finalScore`.

Formula:

`finalScore = (aiScore * 0.45) + (freshnessScore * 0.15) + (atsQualityScore * 0.15) + (companyQualityScore * 0.15) + (hotJobScore * 0.10)`

Where:

- `aiScore` is the model-evaluated resume fit
- `freshnessScore` is derived from `postedAt`
- `atsQualityScore` is derived from link/domain quality
- `companyQualityScore` reflects startup/funding quality signals
- `hotJobScore` reflects urgency and near-term hiring momentum

Initial deterministic rules:

- `freshnessScore`
  - `daysOld === 0` -> `100`
  - otherwise `max(20, 80 - daysOld * 10)`

- `atsQualityScore`
  - Greenhouse, Lever, Ashby -> `100`
  - Workable, Workday -> `85`
  - Generic `jobs.` domains -> `75`

The returned jobs should be sorted by `finalScore` descending.

### 7. Company Quality Scoring

Add `companyQualityScore` as a second-layer signal used for ranking explanation and future UI badges.

Because there is no current external company-intelligence API, use a hybrid approach:

- Deterministic signal from ATS quality
- AI-assisted inference from company name, job title, and description
- Heuristics for startup/funding cues

The scoring pass should classify:

- `isYC`
- `isFundedStartup`
- `companyQualityScore`
- `companyQualityReason`

Scoring guidance:
- YC or clearly venture-backed startup -> higher score
- Strong startup signal but unclear funding -> medium-high score
- Unknown company with limited signals -> neutral score

This keeps the feature implementable now without blocking on new infrastructure.

### 8. Salary Prediction Engine

Add `salaryPrediction` when a posting does not include explicit salary.

Behavior:
- If Serper already provides salary, preserve it as the displayed salary
- If salary is missing, ask the scoring model to infer a reasonable range from:
  - job title
  - seniority implied in description
  - company type
  - skills
  - location constraints, if any

Required outputs:
- `salaryPrediction`
- `salaryConfidence`
- `salarySource`

Rules:
- Never overwrite a real salary with a prediction
- Mark predictions as estimated
- Prefer a range like `$140k-$170k` over a fake precise number

### 9. Hot Job Detection

Add `hotJobScore` and `hotSignals` to capture urgent hiring intent.

Signals may include:
- `just posted`
- `posted today`
- multiple open roles in the same function
- phrases like `urgent`, `immediate`, `hiring now`, `rapidly growing`
- startup urgency language in the description

Output fields:
- `hotJobScore`
- `hotSignals`
- optional boolean `isHotJob`

This is not a hard filter. It is a ranking enhancer and future badge source.

### 10. Scoring Model Contract

Use `openai/gpt-4o-mini` for the ranking pass.

The model should return, per job:

- `matchScore`
- `requirements`
- `salaryPrediction`
- `salaryConfidence`
- `salarySource`
- `companyQualityScore`
- `companyQualityReason`
- `isYC`
- `isFundedStartup`
- `hotJobScore`
- `hotSignals`

Then deterministic code should compute:

- `freshnessScore`
- `atsQualityScore`
- `finalScore`

This keeps the LLM responsible for semantic judgment and the code responsible for consistent ranking math.

## Data Flow

### Retrieval Phase

- Input: `careerPaths`, `minSalary`, `resumeText`, `limit`, `seenFingerprints`
- Output: validated, deduplicated, real Serper jobs

### Scoring Phase

- Input: top retrieved jobs, candidate resume, career goals
- Output: enriched jobs with match and enrichment fields

### Ranking Phase

- Input: enriched jobs + deterministic freshness/domain logic
- Output: final jobs sorted by `finalScore`

## Logging

Add logs for every key phase:

- `console.log("Queries:", optimizedQueries);`
- `console.log("Serper Jobs:", realJobs.length);`
- `console.log("After Validation:", filteredJobs.length);`
- `console.log("After Seen Filter:", unseenJobs.length);`
- `console.log("After Scoring:", scoredJobs.length);`
- `console.log("Top Final Scores:", topJobs.map(j => ({ title: j.title, finalScore: j.finalScore })));`

Logging should make it obvious whether failure happens in:
- query generation
- retrieval volume
- link validation
- strict validation
- deduplication
- scoring

## Return Shape

The current return structure should remain backward-compatible where possible.

Additive fields may include:
- `finalScore`
- `freshnessScore`
- `atsQualityScore`
- `companyQualityScore`
- `companyQualityReason`
- `isYC`
- `isFundedStartup`
- `salaryPrediction`
- `salaryConfidence`
- `salarySource`
- `hotJobScore`
- `hotSignals`
- `isHotJob`

Existing consumers should continue to work if they ignore unknown fields.

## Error Handling

Failure strategy:

- If one query batch fails, continue with the remaining queries
- If link validation fails for a job, skip that job
- If the scoring pass fails, return validated real jobs with a conservative fallback ranking instead of switching to fake jobs
- If no real jobs survive validation, return an empty array and log the reason clearly

No phase should reintroduce fabricated jobs as a fallback.

## Testing And Verification

Implementation verification should include:

- TypeScript diagnostics for `aiService.ts` and `serperService.ts`
- Local production build
- Manual dry run through:
  - query generation
  - ATS validation
  - deduplication
  - scoring math

No automated tests are required for the first pass because the behavior is heavily prompt- and integration-driven, but the functions should be structured so tests can be added later.

## Risks

- Some ATS endpoints may not respond well to `HEAD` requests
- Company quality signals are partly heuristic without a dedicated enrichment API
- Salary prediction quality will vary for thin job descriptions
- Very narrow ATS-only queries may underfill some niche roles

These are acceptable trade-offs because they improve trust and reduce junk results, which is the priority for this redesign.

## Implementation Notes

- Keep retrieval validation in `serperService.ts`
- Keep query generation, expansion, and scoring orchestration in `aiService.ts`
- Remove all Perplexity-specific logic and references
- Preserve current public function signatures where possible
- Prefer small helper functions for:
  - query expansion
  - ATS scoring
  - freshness scoring
  - fallback ranking if LLM scoring fails
