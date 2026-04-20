---
description: Add or update a model assignment in MODEL_ROUTER and wire it into the codebase
---

Add or update an AI model task assignment for HireSchema.

## What I need from you

Tell me:
1. The task name (e.g. `resume_critique`)
2. The OpenRouter model ID (e.g. `anthropic/claude-opus-4.6`)
3. Where this task is called — which service file and function
4. Why this model was chosen (brief reasoning)

## Steps I will follow

1. **Update `MODEL_ROUTER.md`** — add the task to the Task Map table and assign it to the right Role section (Scout, Auditor, Ghostwriter, Specialist, or Interviewer). If the model is new, add a new Role block.

2. **Update the service file** — ensure the model string in the actual API call matches the MODEL_ROUTER entry exactly. The call must go through `api/openai.ts` (OpenRouter proxy).

3. **Verify no task is left unrouted** — grep for any hardcoded model strings that bypass MODEL_ROUTER.

4. **Run `npm run lint`** after changes.

## Routing rules (from MODEL_ROUTER.md)

- Scout (`openai/gpt-4o-mini`): lightweight extraction + query gen, speed > quality
- Auditor (`google/gemini-3.1-pro`): scoring, ranking, high-context reasoning
- Ghostwriter (`anthropic/claude-opus-4.6`): high-quality user-facing writing
- Specialist (`openai/gpt-5.4-pro`): structured JSON extraction, schema fidelity
- Interviewer (`anthropic/claude-3.5-sonnet`): coaching content, moderate writing quality

Never route a task to an unapproved model without updating MODEL_ROUTER.md first.
