export interface ValidationResult {
  passed: boolean;
  reason?: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface GuardrailUserContext {
  preferences?: {
    remoteOnly?: boolean;
    salaryFloor?: number | null;
    locations?: string[];
  };
}

export interface GuardrailJobInput {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  postedAt: string;
  isRemote: boolean;
  salary?: string;
}

export interface JobValidationBatchResult<TJob> {
  accepted: TJob[];
  rejected: Array<{
    job: TJob;
    validation: ValidationResult;
  }>;
}

export interface JobScoringValidationInput {
  jobCount: number;
}

function normalizeWordSet(text: string): Set<string> {
  const matches = text.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? [];
  return new Set(matches);
}

export interface UserPreferencesInput {
  remoteOnly?: unknown;
  salaryFloor?: unknown;
  locations?: unknown;
}

export interface NormalizedUserPreferences {
  remoteOnly: boolean;
  salaryFloor: number | null;
  locations: string[];
}

export interface LegacyPreferenceFields {
  jobType: 'remote' | 'both';
  minSalary: number | null;
  location: string;
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function parseSalaryFloorCandidate(salaryText: string): number | null {
  const matches = salaryText.replace(/,/g, '').match(/\d{2,}/g);
  if (!matches || matches.length === 0) return null;
  return Math.max(...matches.map((value) => Number.parseInt(value, 10)));
}

export function normalizeResumeText(text: string): string {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim());

  const collapsed: string[] = [];
  for (const line of normalized) {
    if (line.length === 0) {
      if (collapsed.length > 0 && collapsed[collapsed.length - 1] !== '') {
        collapsed.push('');
      }
      continue;
    }
    collapsed.push(line);
  }

  while (collapsed[0] === '') collapsed.shift();
  while (collapsed[collapsed.length - 1] === '') collapsed.pop();

  return collapsed.join('\n').trim();
}

export function hasResumeTextChanged(
  savedResumeCleaned: string,
  draftResumeText: string
): boolean {
  const normalizedSaved = normalizeResumeText(savedResumeCleaned || '');
  const normalizedDraft = normalizeResumeText(draftResumeText || '');
  return normalizedSaved !== normalizedDraft;
}

export function normalizeUserPreferences(
  input: UserPreferencesInput
): NormalizedUserPreferences {
  const remoteOnly =
    input.remoteOnly === true ||
    input.remoteOnly === 'true' ||
    input.remoteOnly === 'remote';

  const salaryFloorRaw =
    typeof input.salaryFloor === 'string'
      ? Number.parseInt(input.salaryFloor, 10)
      : typeof input.salaryFloor === 'number'
        ? input.salaryFloor
        : null;

  const salaryFloor =
    typeof salaryFloorRaw === 'number' &&
    Number.isFinite(salaryFloorRaw) &&
    salaryFloorRaw > 0
      ? salaryFloorRaw
      : null;

  const rawLocations = Array.isArray(input.locations)
    ? input.locations
    : typeof input.locations === 'string'
      ? input.locations.split(',')
      : [];

  const locations = dedupeStrings(
    rawLocations
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean)
  );

  return { remoteOnly, salaryFloor, locations };
}

export function syncLegacyPreferenceFields(
  preferences: NormalizedUserPreferences
): LegacyPreferenceFields {
  return {
    jobType: preferences.remoteOnly ? 'remote' : 'both',
    minSalary: preferences.salaryFloor,
    location: preferences.locations[0] || '',
  };
}

export function jobMatchesUserPreferences(
  job: { isRemote: boolean; salary?: string; location: string },
  preferences: NormalizedUserPreferences
): ValidationResult {
  if (preferences.remoteOnly && !job.isRemote) {
    return {
      passed: false,
      code: 'REMOTE_MISMATCH',
      reason: 'Job does not match the remote-only preference.',
    };
  }

  if (preferences.salaryFloor !== null) {
    const parsedSalary = parseSalaryFloorCandidate(job.salary || '');
    if (parsedSalary !== null && parsedSalary < preferences.salaryFloor) {
      return {
        passed: false,
        code: 'SALARY_FLOOR_MISMATCH',
        reason: 'Job salary is below the required salary floor.',
      };
    }
  }

  if (preferences.locations.length > 0) {
    const normalizedLocation = job.location.toLowerCase();
    const matchesLocation = preferences.locations.some((location) =>
      normalizedLocation.includes(location.toLowerCase())
    );

    if (!matchesLocation && !job.isRemote) {
      return {
        passed: false,
        code: 'LOCATION_MISMATCH',
        reason: 'Job location does not match preferred locations.',
      };
    }
  }

  return { passed: true };
}

export function isRecent(postedAt: string, maxDaysOld: number = 7): boolean {
  const parsed = new Date(postedAt);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const ageMs = Date.now() - parsed.getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  return ageDays <= maxDaysOld;
}

export function validateJob(
  job: GuardrailJobInput,
  user: GuardrailUserContext,
  maxDaysOld: number = 7
): ValidationResult {
  const normalizedPreferences = normalizeUserPreferences(user.preferences || {});

  if (!job.url || !job.url.startsWith('http')) {
    return {
      passed: false,
      code: 'MISSING_URL',
      reason: 'Job must include a valid URL before AI processing.',
    };
  }

  const preferenceValidation = jobMatchesUserPreferences(
    {
      isRemote: job.isRemote,
      salary: job.salary,
      location: job.location,
    },
    normalizedPreferences
  );
  if (!preferenceValidation.passed) {
    return preferenceValidation;
  }

  if (!isRecent(job.postedAt, maxDaysOld)) {
    return {
      passed: false,
      code: 'STALE_JOB',
      reason: `Job is older than ${maxDaysOld} days.`,
    };
  }

  return { passed: true };
}

export function validateJobsBeforeAI<TJob extends GuardrailJobInput>(
  jobs: TJob[],
  user: GuardrailUserContext,
  maxDaysOld: number = 7
): JobValidationBatchResult<TJob> {
  const accepted: TJob[] = [];
  const rejected: Array<{ job: TJob; validation: ValidationResult }> = [];

  for (const job of jobs) {
    const validation = validateJob(job, user, maxDaysOld);
    if (validation.passed) {
      accepted.push(job);
    } else {
      rejected.push({ job, validation });
    }
  }

  return { accepted, rejected };
}

export function validateJobValidationBatchOutput<TJob>(
  output: JobValidationBatchResult<TJob>,
  input: { expectedCount: number }
): ValidationResult {
  if (
    !output ||
    !Array.isArray(output.accepted) ||
    !Array.isArray(output.rejected)
  ) {
    return {
      passed: false,
      code: 'INVALID_VALIDATION_BATCH',
      reason: 'Validation batch output must include accepted and rejected arrays.',
    };
  }

  const total = output.accepted.length + output.rejected.length;
  if (total !== input.expectedCount) {
    return {
      passed: false,
      code: 'VALIDATION_COUNT_MISMATCH',
      reason: 'Validation batch output does not account for every input job.',
      details: { expectedCount: input.expectedCount, actualCount: total },
    };
  }

  return { passed: true };
}

export function validateJobScoringOutput(
  output: unknown,
  input: JobScoringValidationInput
): ValidationResult {
  if (!Array.isArray(output)) {
    return {
      passed: false,
      code: 'INVALID_SCORING_OUTPUT',
      reason: 'Job scoring output must be an array.',
    };
  }

  if (output.length !== input.jobCount) {
    return {
      passed: false,
      code: 'SCORING_COUNT_MISMATCH',
      reason: 'Job scoring output count does not match the input jobs.',
      details: { expectedCount: input.jobCount, actualCount: output.length },
    };
  }

  for (const item of output) {
    if (!item || typeof item !== 'object') {
      return {
        passed: false,
        code: 'INVALID_SCORING_ITEM',
        reason: 'Each scored job must be an object.',
      };
    }

    const matchScore = (item as { matchScore?: unknown }).matchScore;
    if (typeof matchScore !== 'number' || Number.isNaN(matchScore)) {
      return {
        passed: false,
        code: 'MISSING_MATCH_SCORE',
        reason: 'Each scored job must include a numeric matchScore.',
      };
    }
  }

  return { passed: true };
}

export function validateQueryGenerationOutput(
  output: unknown,
  input: { expectedCount: number }
): ValidationResult {
  if (!Array.isArray(output)) {
    return {
      passed: false,
      code: 'INVALID_QUERY_OUTPUT',
      reason: 'Query generation output must be an array.',
    };
  }

  if (output.length !== input.expectedCount) {
    return {
      passed: false,
      code: 'QUERY_COUNT_MISMATCH',
      reason: `Query generation must return exactly ${input.expectedCount} queries.`,
      details: {
        expectedCount: input.expectedCount,
        actualCount: output.length,
      },
    };
  }

  const seen = new Set<string>();
  for (const query of output) {
    if (typeof query !== 'string' || query.trim().length === 0) {
      return {
        passed: false,
        code: 'INVALID_QUERY_ITEM',
        reason: 'Every generated query must be a non-empty string.',
      };
    }

    const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
    if (seen.has(normalized)) {
      return {
        passed: false,
        code: 'DUPLICATE_QUERY',
        reason: 'Generated queries must be unique after normalization.',
      };
    }
    seen.add(normalized);
  }

  return { passed: true };
}

export function validateStructuredProfile(profile: unknown): ValidationResult {
  if (!profile || typeof profile !== 'object') {
    return {
      passed: false,
      code: 'INVALID_STRUCTURED_PROFILE',
      reason: 'Structured profile must be an object.',
    };
  }

  const candidate = profile as Record<string, unknown>;
  const requiredArrayKeys = ['skills', 'techStack', 'roles', 'industries'];

  for (const key of requiredArrayKeys) {
    if (!Array.isArray(candidate[key])) {
      return {
        passed: false,
        code: 'INVALID_STRUCTURED_PROFILE',
        reason: `Structured profile field "${key}" must be an array.`,
      };
    }
  }

  if (typeof candidate.seniority !== 'string') {
    return {
      passed: false,
      code: 'INVALID_STRUCTURED_PROFILE',
      reason: 'Structured profile field "seniority" must be a string.',
    };
  }

  return { passed: true };
}

export function validateGeneratedEmail(
  output: string,
  input: { company: string; jobTitle: string }
): ValidationResult {
  const trimmed = output.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  if (!trimmed) {
    return {
      passed: false,
      code: 'EMPTY_EMAIL',
      reason: 'Generated email must not be empty.',
    };
  }

  if (!trimmed.toLowerCase().includes(input.company.toLowerCase())) {
    return {
      passed: false,
      code: 'MISSING_COMPANY',
      reason: 'Generated email must include the company name.',
    };
  }

  if (!trimmed.toLowerCase().includes(input.jobTitle.toLowerCase())) {
    return {
      passed: false,
      code: 'MISSING_ROLE',
      reason: 'Generated email must reference the role.',
    };
  }

  if (wordCount > 120) {
    return {
      passed: false,
      code: 'EMAIL_TOO_LONG',
      reason: 'Generated email exceeds 120 words.',
    };
  }

  if (/\b(i am excited|motivated individual)\b/i.test(trimmed)) {
    return {
      passed: false,
      code: 'GENERIC_LANGUAGE',
      reason: 'Generated email contains generic language.',
    };
  }

  return { passed: true };
}

export function validateAssetForgeEmail(
  output: string,
  input: { company: string; jobTitle: string }
): ValidationResult {
  return validateGeneratedEmail(output, input);
}

export function validateTailoredResumeOutput(
  output: string,
  input: { jobDescription: string }
): ValidationResult {
  const trimmed = output.trim();
  if (!trimmed) {
    return {
      passed: false,
      code: 'EMPTY_RESUME',
      reason: 'Tailored resume must not be empty.',
    };
  }

  const outputWords = normalizeWordSet(trimmed);
  const jobWords = Array.from(normalizeWordSet(input.jobDescription));
  const keywordMatches = jobWords.filter((word) => outputWords.has(word));

  if (keywordMatches.length === 0) {
    return {
      passed: false,
      code: 'NO_KEYWORD_ALIGNMENT',
      reason: 'Tailored resume must align with job keywords.',
      details: { checkedKeywordCount: jobWords.length },
    };
  }

  return { passed: true, details: { matchedKeywordCount: keywordMatches.length } };
}
