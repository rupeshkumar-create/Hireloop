# Daily Blog Agent Upgrade Design

## Goal

Upgrade the autonomous blog cron job from a single generate-and-verify loop into a multi-step content pipeline that produces better topic selection, stronger drafts, stricter quality control, rewrite-based improvement, and cleaner internal linking.

## Scope

This design applies to `api/cron/daily-blog-agent.ts` only.

In scope:
- Add a topic-selection step before writing
- Replace the writer prompt with a topic-aware version
- Replace the verification prompt with score-based rejection criteria
- Change retry behavior from full regeneration to guided rewrite
- Move internal-link insertion into a post-processing pass
- Change the default model to `anthropic/claude-3.7-sonnet`

Out of scope:
- Weekly trend scanner
- Strategy agent
- Refactoring the cron handler into multiple files
- Changes to publishing destination or GitHub commit flow

## Existing Constraints

- The cron handler already orchestrates the full flow: fetch current posts, generate content with OpenRouter, verify content, then commit a new blog post JSON entry back to GitHub.
- The current `callLLM()` helper assumes JSON output and parses the first JSON object found in the response body.
- Existing slugs are loaded from `src/data/blogPosts.json`.
- The publish step expects a final object with `title`, `slug`, `content`, and `excerpt`.

## Proposed Architecture

The upgraded pipeline is:

1. Load current blog posts and extract existing slugs
2. Run Topic Agent to select one blog idea
3. Run Writer Agent using the selected topic
4. Run Verifier Agent on the generated draft
5. If verification fails, rewrite the existing draft using the verifier issues
6. Repeat verification and rewrite until pass or max attempts reached
7. Run Linker Agent to insert 2-3 natural internal links into the final content
8. Build the final post payload and commit it to GitHub

This preserves the existing publish mechanism while improving quality at each decision point.

## Components

### 1. Topic Agent

Add a new `topicPrompt` before the writer step. The prompt requests exactly one high-impact blog topic and must return JSON with:

- `title`
- `angle`
- `target_keyword`
- `search_intent`
- `why_this_matters`

The Topic Agent uses the existing JSON-return LLM helper.

Failure behavior:
- If topic generation returns invalid JSON or misses required fields, fail the cron job with a clear error.

### 2. Writer Agent

Replace the current writer prompt with a topic-aware version that injects:

- `topicData.title`
- `topicData.angle`
- `topicData.target_keyword`
- `topicData.search_intent`
- `existingSlugs`

Writer rules:
- Remove the fixed `~2000 characters` constraint
- Keep JSON-only output
- Emphasize anti-slop, human tone, examples, trade-offs, strong hook, early direct answer, and one unique insight
- Mention available slugs as contextual input, but do not require forced linking in the draft itself

Expected writer output remains:

- `title`
- `slug`
- `content`
- `excerpt`
- `keywords`

### 3. Verifier Agent

Replace the current verification prompt with a stricter critic prompt that:

- Checks for generic writing
- Checks for AI-sounding phrasing
- Checks for unique insight
- Checks for founder usefulness
- Checks hook strength
- Checks example specificity

Expected verifier output:

- `pass`
- `score`
- `issues`
- `fixes`

Decision rule:
- If `score < 7`, mark the draft as failed even if the model returns `pass: true`
- A valid pass requires both `pass === true` and `score >= 7`

### 4. Rewrite Mode

Instead of restarting from scratch when verification fails, feed the previously generated JSON back into the writer conversation and request targeted revision.

Rewrite message content:
- Include verifier issues
- Instruct the model to improve clarity, originality, and human tone
- Explicitly say not to start from scratch

This preserves strong sections while improving weak ones.

### 5. Linker Agent

Add a post-processing internal-link pass after the draft passes verification.

Requirements:
- Insert 2-3 natural internal links into the blog content
- Use the available slugs from `existingSlugs`
- Return updated content only

Implementation detail:
- Add a second helper, `callLLMText()`, for plain-text output
- Keep the existing JSON helper for topic, writer, and verifier

Failure behavior:
- If linking fails or returns empty content, fail the cron job instead of publishing an incomplete post

## Data Flow

### Input Data

- GitHub file contents from `src/data/blogPosts.json`
- Existing slugs derived from current posts
- Topic JSON returned by Topic Agent

### Intermediate Data

- `topicData` drives the writer prompt
- `generatedData` stores the current blog draft JSON
- `verificationResult` stores pass/fail state, score, issues, and fixes

### Final Data

The publish step still constructs:

- `slug`
- `title`
- `excerpt`
- `date`
- `author`
- `content`

Only `generatedData.content` is modified during the linking pass.

## Model Selection

Change the default model from `anthropic/claude-opus-4.6-fast` to `anthropic/claude-3.7-sonnet`.

Reasoning:
- Better balance between quality and stability for structured writing tasks
- More suitable for iterative critique and revision loops than the current configuration

## Control Flow

### Attempt Loop

Keep `MAX_ATTEMPTS = 3`.

Per attempt:

1. Generate or rewrite the draft
2. Verify the draft
3. Stop if pass threshold is met
4. Otherwise push the prior draft and targeted rewrite instructions into the writer message history

### Success Condition

The pipeline succeeds only when:

- A valid draft JSON exists
- The verifier returns a score of at least 7
- The linker returns non-empty updated content

### Failure Condition

The pipeline fails when:

- Topic generation is invalid
- Writer output is invalid
- All attempts fail verification
- Link insertion fails
- GitHub fetch or commit fails

## Error Handling

Add explicit validation checks for required fields after topic generation and writer generation.

Recommended required fields:

- Topic: `title`, `angle`, `target_keyword`, `search_intent`
- Draft: `title`, `content`
- Verifier: `issues`, `fixes`, `score`

On validation failure, throw descriptive errors that identify which phase failed.

## Testing And Verification

Implementation validation should include:

- TypeScript diagnostics on the edited file
- A local production build
- Manual review that prompt strings interpolate the expected variables

No automated tests are required for this change because the cron logic is prompt-driven and there is no existing targeted test harness around the Vercel function.

## Risks

- JSON parsing remains sensitive to malformed model output
- The rewrite loop still depends on the model respecting instructions
- The linker may insert awkward links if slug context is weak

These risks are acceptable for this iteration because the pipeline adds stronger quality gating and clear failure behavior instead of silently publishing weak output.

## Implementation Notes

- Keep the change in one file to minimize deployment risk
- Prefer small local helper functions over a large file split
- Do not change the GitHub commit contract
- Do not change cron paths or Vercel routing as part of this work
