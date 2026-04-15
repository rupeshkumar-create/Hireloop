# DATABASE_SCHEMA.md

## Upgrade

Learning and debugging are first-class system concerns.

### `users/{uid}`

Primary user record.
Stores identity, preferences, learning signals, and system generation state.

#### `profile`

- `name: string`
- `email: string`
- `plan: string`
- `resumeSummary: string`
- `careerPaths: string[]`
- `preferences: Record<string, unknown>`

#### `learningProfile`

Tracks user feedback over time.
Used to improve job quality, filtering, and future generation.

- `likedKeywords: string[]`
- `dislikedKeywords: string[]`
- `dismissedCategories: string[]`
- `appliedRoles: string[]`

#### `system`

Tracks generation activity for reliability and debugging.

- `lastGeneratedAt: Timestamp`
- `generationAttempts: number`

### `jobsCache/{uid}`

Cached generated jobs for the user.
Used to reduce repeated generation and speed up reloads.

- `jobs: Job[]`
- `generatedAt: Timestamp`

### `aiLogs/{id}`

Structured log for every AI task.
Used for debugging, validation tracing, and model performance review.

- `userId: string`
- `taskType: string`
- `input: unknown`
- `output: unknown`
- `validation: unknown`
- `modelUsed: string`
- `latency: number`
