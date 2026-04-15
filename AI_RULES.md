# AI_RULES.md

## Core Rules

- No hallucinations. Strict.
- No placeholders.
- Never write stand-ins such as "Company X".
- No generic phrases.
- Every output must be grounded in the relevant source material.
- Do not invent experience, recruiter facts, salary data, or company details.
- If a task lacks enough grounded context, fail safely or fall back deterministically.

## Grounding Rules

- Job scoring and enrichment must stay grounded in retrieved job content and user context.
- Email generation must stay grounded in the role, company, and user resume or resume summary.
- Resume tailoring must stay grounded in the original resume and the target job description.
- Structured extraction must use only information present in the input.

## Anti-Slop Rules

- Never use lines such as "I am excited" or "motivated individual".
- Avoid generic corporate filler and buzzword padding.
- Use short sentences when generating user-facing content.
- Use direct tone.
- Avoid repetition.
- Skip conversational filler around the actual output.

## Task-Specific Rules

### Email Generation

- Missing company name.
- Missing role reference.
- Over 120 words for an email.
- Generic language detected.

### Resume Tailoring

- No fake experience.
- Must align with job keywords.
- Must keep claims grounded in the original resume.
- Prefer clean standard Markdown formatting.

### Query Generation

- Generate precise queries for real job retrieval.
- Avoid broad, vague, or low-signal search queries.
- Prefer approved ATS domains when generating Scout queries.

## Recovery

- If failed, rewrite with stricter constraints.
- If a deterministic fallback exists for the task, use it instead of fabricating.
