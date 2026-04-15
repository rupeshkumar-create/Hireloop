# Phase 2.5 Manual Resume Ingestion Design

**Goal:** Make pasted or manually edited resume text run through the same structured onboarding pipeline as file uploads so both input paths produce the same stored artifacts, validation behavior, and compatibility fields.

**Scope:** This phase unifies resume ingestion behavior. It does not redesign onboarding UI, add live extraction while typing, or change the profile schema introduced in Phase 2. It focuses on reuse, consistency, and safe save-time processing.

## Current Context

Phase 2 introduced a structured onboarding pipeline that stores:

- `resumeRaw`
- `resumeCleaned`
- `resumeSummary`
- `structuredProfile`
- `preferences`

File uploads already run through this pipeline in `src/hooks/useResumeParser.ts`.

However, the manual textarea flow in `src/pages/Settings.tsx` still behaves differently:

- user edits `resumeText`
- save writes raw `resumeText`
- structured extraction does not rerun
- structured profile artifacts can become stale

That creates two resume ingestion systems, which is exactly what the data engine should avoid.

## Design Summary

Phase 2.5 extracts the structured resume pipeline into a shared text-processing path inside `useResumeParser.ts`.

Two public paths will exist:

- `handleFileUpload(file, onSuccess)`
- `processResumeText(rawText, options)`

`handleFileUpload()` becomes a thin file-parsing wrapper that delegates to `processResumeText()`.

`Settings.tsx` uses `processResumeText()` on save when the pasted or manually edited resume text has changed from the last saved cleaned version.

This makes file upload and manual paste behavior consistent.

## Architecture

### 1. Shared Resume Processing Function

`useResumeParser.ts` should expose a shared async function:

```ts
processResumeText(rawText: string, options?: { onSuccess?: () => void }): Promise<void>
```

Responsibilities:

- normalize `rawText` into `resumeCleaned`
- reject empty cleaned input
- run `extractJobPreferences()`
- normalize nested `preferences`
- sync legacy fields
- run `extractResume()`
- run `summarizeResume()`
- run `suggestCareerPaths()`
- run `analyzeResume()`
- save the full payload through `updateProfile()`

This becomes the single source of truth for resume ingestion.

### 2. File Parsing Stays Separate

`handleFileUpload()` should keep responsibility for:

- file size validation
- file type parsing
- PDF/DOCX/TXT extraction
- parse-failure messaging

Once it has `rawText`, it should immediately call `processResumeText(rawText, { onSuccess })`.

This separation keeps parsing and ingestion distinct.

### 3. Settings Save Behavior

`Settings.tsx` should not run AI extraction on every keystroke.

Instead:

- keep textarea edits local in form state
- on save, compare current text to the last saved cleaned version
- if unchanged, run the cheap settings-only save path
- if changed, call `processResumeText(formData.resumeText)`

This matches the chosen save-time trigger and avoids wasteful AI calls.

## Change Detection

Phase 2.5 needs a deterministic helper to detect whether the user actually changed the resume content.

Recommended helper:

```ts
hasResumeTextChanged(savedResumeCleaned: string, draftResumeText: string): boolean
```

Behavior:

- normalize the draft using the same cleaning logic
- compare normalized draft to saved cleaned resume
- return `true` only when the normalized content differs

This prevents unnecessary extractions when the user only changes whitespace or formatting noise.

## Data Flow

### File Upload Path

1. parse file into raw text
2. call `processResumeText(rawText)`
3. save full structured payload

### Manual Paste Path

1. user edits textarea
2. click `Save Preferences`
3. check whether normalized text differs from saved cleaned resume
4. if unchanged, save only settings/preferences edits
5. if changed, call `processResumeText(formData.resumeText)`
6. save full structured payload

## Save Semantics

When the manual path triggers `processResumeText()`:

- `resumeRaw` should store the pasted text as entered
- `resumeCleaned` should store the normalized result
- `resumeText` should continue mirroring `resumeCleaned`
- `structuredProfile` and `resumeSummary` should refresh
- `preferences` and legacy compatibility fields should stay synchronized

If the draft is unchanged:

- do not rerun extraction
- do not overwrite structured fields unnecessarily

## Error Handling

### Empty Draft

If the pasted draft normalizes to an empty string:

- do not run AI
- show a clear error toast
- do not overwrite the saved structured resume artifacts

### AI Failure

If extraction fails after change detection:

- surface the same quota and processing errors as file upload
- do not partially save a broken structured profile

### Unchanged Resume

If the draft is semantically unchanged:

- skip ingestion
- continue saving non-resume settings updates

## Testing Strategy

### Unit tests

Add focused tests for:

- `hasResumeTextChanged()`
- unchanged text after normalization
- changed text after semantic edits

### Integration-oriented helper tests

Add tests for shared ingestion behavior where practical:

- file path and manual path both call the same processing function
- preferences and legacy fields remain synchronized after manual save

### Manual verification

Verify:

1. upload a file and confirm full structured data is stored
2. paste a changed resume in settings and save
3. confirm `structuredProfile`, `resumeSummary`, and cleaned fields refresh
4. paste only whitespace formatting changes and save
5. confirm extraction does not rerun unnecessarily

## File Responsibilities

### `src/hooks/useResumeParser.ts`

- own shared resume ingestion logic
- expose both file-based and text-based entry points

### `src/pages/Settings.tsx`

- detect changed manual resume text
- choose between cheap save and full ingestion path

### `src/services/validator.ts`

- own normalization-based text comparison helper
- keep comparison deterministic

## Out Of Scope

- live extraction while typing
- blur-triggered extraction
- onboarding UI redesign
- schema changes beyond reused Phase 2 fields
- automatic diff visualizations

## Recommended Outcome

After Phase 2.5:

- file uploads and pasted resumes share one ingestion engine
- structured profile data stays fresh regardless of input path
- unnecessary AI calls are avoided for unchanged text
- settings editing remains responsive
- resume ingestion behavior becomes consistent across the app
