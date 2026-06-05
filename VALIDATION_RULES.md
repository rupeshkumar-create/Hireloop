# VALIDATION_RULES.md

## Principles

- validation must happen before later stages rely on the output
- hard job filters run before AI scoring
- validation output should include a pass or fail decision and a machine-readable code when possible
- later stages must not silently rescue failed hard validation

## Job Rules

### Hard Filters Before AI

- must have a valid HTTP URL
- must be remote if the user selected remote-only
- must respect the user salary floor when a parsable salary is present
- must match a preferred location when location preferences exist and the job is not remote
- must be posted within the recency window, currently 7 days by default

### Batch Validation Rules

- batch output must include both `accepted` and `rejected`
- accepted count plus rejected count must equal the number of input jobs

## Query Generation Rules

- output must be an array
- output must contain exactly the expected number of queries
- every query must be a non-empty string
- normalized queries must be unique

## Job Scoring Rules

- output must be an array
- output length must match the number of jobs scored
- each scored item must be an object
- each scored item must include a numeric `matchScore`

## Structured Profile Rules

- structured profile must be an object
- `skills`, `techStack`, `roles`, and `industries` must be arrays
- `seniority` must be a string

## Email Rules

- must not be empty
- must include company
- must include role
- max 120 words
- no generic phrases such as "I am excited" or "motivated individual"

## Resume Rules

- must not be empty
- must align with job-description keywords
- alignment is currently validated by checking for at least one normalized keyword match
