# MODEL_ROUTER.md

## Task To Model

Model routing must be explicit.
Each task must use the assigned model.
Do not route tasks to unapproved models.

### Task Map

- `query_generation` -> `openai/gpt-4o-mini`
- `job_scoring` -> `openai/gpt-4o-mini`
- `email_generation` -> `anthropic/claude-3.5-sonnet`
- `resume_tailoring` -> `anthropic/claude-3.5-sonnet`
- `resume_extraction` -> `openai/gpt-4o`
- `career_path_suggestion` -> `openai/gpt-4o-mini`
- `resume_analysis` -> `openai/gpt-4o-mini`
- `job_preference_extraction` -> `openai/gpt-4o-mini`
- `resume_summary` -> `google/gemini-pro-1.5`
- `text_improvement` -> `anthropic/claude-3.5-sonnet`
- `recruiter_email_extraction` -> `openai/gpt-4o-mini`
- `interview_questions` -> `anthropic/claude-3.5-sonnet`
- `salary_insights` -> `anthropic/claude-3.5-sonnet`

### Roles

#### The Scout Router

Model:
`openai/gpt-4o-mini`

Use cases:
- query generation
- career path suggestion
- resume analysis
- job preference extraction
- recruiter email extraction
- job scoring

Rule:
Use this model for lightweight structured generation and extraction tasks where speed matters more than deep writing quality.

OpenRouter ID:
`openai/gpt-4o-mini`

#### The Auditor (`The Brain`)

Model:
`google/gemini-pro-1.5`

Use cases:
- resume summarization
- high-context ranking inputs

Rule:
Use this model where the system needs stronger reasoning over many jobs or a denser candidate context.
This model is the main ranking engine.

OpenRouter ID:
`google/gemini-pro-1.5`

#### The Ghostwriter (`Auto-Outreach & Resumes`)

Model:
`anthropic/claude-3.5-sonnet`

Use cases:
- tailored resume generation
- cold email generation
- auto-sender outreach content
- text rewriting and self-fix passes

Rule:
Use this model for high-quality user-facing writing where tone and polish matter most.

OpenRouter ID:
`anthropic/claude-3.5-sonnet`

#### The Specialist (`Structured Extraction`)

Model:
`openai/gpt-4o`

Use cases:
- structured resume extraction
- higher-precision JSON object generation

Rule:
Use this model for structured profile extraction when schema fidelity matters more than speed.

OpenRouter ID:
`openai/gpt-4o`

#### The Interviewer (`Coaching Content`)

Model:
`anthropic/claude-3.5-sonnet`

Use cases:
- interview question generation
- salary insight generation

Rule:
Use this model for coaching-style content that benefits from strong writing quality but does not require the heavier resume and outreach model.

OpenRouter ID:
`anthropic/claude-3.5-sonnet`

### Fallback Order

The router must always attempt recovery in this order:

1. primary model
2. fail-safe deterministic fallback or empty safe result, depending on task

### Fallback Rule

If the primary model fails, times out, or returns invalid output, use the task-specific fallback path.
For job generation tasks, prefer deterministic fallback behavior.
For content tasks, prefer guarded failure or the safest empty result over fabricated output.
Do not silently skip failures.
