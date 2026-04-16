# Job Source Quality And Strict Match Design

**Goal:** Improve Daily Matches quality by rejecting aggregator-only destination links, preferring direct employer application pages, and enforcing stricter pre-AI relevance validation so users do not see weak foreign-language or wrong-region jobs with misleading match scores.

**Scope:** This change covers the search/link-validation pipeline, deterministic job validation, and the parts of resume-preference ingestion that influence strict matching defaults. It does not redesign the dashboard UI, add a user-facing match-mode setting, or change billing and paywall behavior.

## Current Context

The current jobs pipeline already has strong building blocks:

- `src/services/serperService.ts` searches jobs, collects candidate links, and validates the final application URL
- `api/validate-job-link.ts` follows redirects and decides whether a final destination is acceptable
- `src/services/validator.ts` applies deterministic pre-AI filters for remote, salary, freshness, and basic location matching
- `src/services/aiService.ts` only scores jobs after they survive the deterministic validation pass
- `src/hooks/useResumeParser.ts` writes inferred preferences from resume ingestion into profile fields used by the jobs flow

However, the current behavior still allows two quality failures:

1. source quality is not expressed as a hard product rule against aggregator-style destinations such as Jobicy-style board pages
2. strict relevance is too weak for remote jobs that clearly target a different region or language market

Those gaps create visible product problems:

- users can land on another platform instead of the original employer application page
- jobs that obviously do not fit the user's real market can survive validation
- AI scoring can still label those jobs as moderate matches, which undermines trust

## Design Summary

The fix hardens the pipeline in two coordinated layers:

```text
search result
-> collect candidate links
-> resolve redirects
-> keep direct ATS/company destination or reject aggregator-only result
-> deterministic strict validation
-> AI scoring for only valid jobs
-> dashboard feed
```

Core outcomes:

1. the feed no longer accepts aggregator-only destinations as valid application links
2. the system attempts to convert aggregator-style links to direct employer destinations when possible
3. remote jobs targeting the wrong region or language are rejected before scoring
4. match score becomes a ranking signal for already-valid jobs instead of a bandage for bad candidates
5. if inventory is light, the system returns fewer but better jobs instead of weak mismatches

## Architecture

### 1. Source Quality Ownership

Source quality should be enforced in the existing link-selection and link-validation path rather than only in the UI.

Primary ownership:

- `src/services/serperService.ts` owns candidate-link collection and best-link selection
- `api/validate-job-link.ts` owns redirect resolution and final-destination acceptance

Required rule:

- a job is valid only if its surviving destination is a direct ATS page or a real company careers/application page

Aggregator domains should be treated as blocked final destinations, even if they initially appear in the candidate-link list.

### 2. Aggregator Conversion Rule

The system should support a conversion-first policy for aggregator-style links:

1. if a search result exposes multiple links, prefer direct ATS or company career links first
2. if only an aggregator-style link is present, follow redirects and inspect the final destination
3. if the final destination resolves to a direct ATS or company career page, keep the resolved link
4. if the final destination is still an aggregator or generic board page, reject the job

This matches the product requirement:

- do not send users to another platform unless the link truly resolves to the original employer destination

### 3. Blocked And Allowed Link Rules

The current allowlist model should remain, but final-destination blocking should become stricter.

Allowed final destinations:

- direct ATS/application domains already supported by the product, such as `greenhouse.io`, `lever.co`, `ashbyhq.com`, `workable.com`, and `workday.com`
- real company career pages when `allowCompanyCareerPages` is enabled and the URL looks like a real application surface

Blocked final destinations:

- aggregator and board destinations such as `jobicy.com`
- existing blocked boards such as `linkedin.com`, `indeed.com`, `glassdoor.com`, `ziprecruiter.com`
- generic search or listing pages that do not represent a direct application surface

Important constraint:

- blocking should apply to the final resolved destination, not just the original candidate URL

### 4. Strict Matching Ownership

Strict matching should stay deterministic and happen before AI scoring.

Primary ownership:

- `src/services/validator.ts`

The validator should continue to own rule-based decisions for:

- remote mismatch
- salary floor mismatch
- freshness
- location mismatch

It should be extended to cover:

- obvious region mismatch for remote jobs
- obvious foreign-language mismatch
- stricter interpretation of profile location when strict mode is the default

### 5. Region Mismatch Rules

The current validator only rejects location mismatches when the job is not remote.

That is too permissive for remote roles because many remote jobs still require a specific country, timezone, or market.

Required strict behavior:

- if the job text or location clearly indicates a different required market than the user profile, reject it before AI scoring
- this must apply even if the job is remote

Examples of signals that should trigger rejection:

- country-only restrictions such as `France only`, `Canada only`, `US only`
- strong regional signals such as `EMEA`, `APAC`, or market-specific territory requirements when they conflict with the user's explicit location
- role titles or metadata that clearly target another geography

The implementation should prefer conservative, deterministic heuristics over speculative AI interpretation.

### 6. Language Mismatch Rules

The validator should reject jobs that clearly require a language the user profile does not support.

Default strict behavior:

- if a job title, location, or description strongly indicates French-language targeting, reject it unless the user's stored profile explicitly supports French or a compatible French-speaking market

Examples of signals:

- French-language terms in title or description
- explicit wording such as `French required`, `French speaking`, `Francophone`, `Paris`, `France`, or `Quebec` when paired with language-specific role requirements

Important rule:

- absence of French in the resume/profile should be treated as lack of evidence for support, not as a maybe

This avoids jobs surviving simply because the model scored them on general role similarity.

### 7. Preference Source Of Truth

Strict matching should not be overly dependent on AI-inferred guesses from resume ingestion.

Recommended source-of-truth order:

1. explicit stored profile fields set by the user
2. normalized stored preferences already saved on the profile
3. AI-inferred resume preferences only when explicit data is missing

This means:

- if the user has explicitly set location or job type, those values win
- AI resume parsing should not silently override clearer manual settings
- strict validation should read the stored normalized preference shape consistently

### 8. Scoring Boundary

`matchScore` should remain useful, but only after source quality and strict validation have already passed.

Required rule:

- scoring must never be the mechanism that compensates for jobs that should have been rejected deterministically

Practical effect:

- users should not see obviously wrong-market or foreign-language roles rated as `60% Match`

## Data Flow

Recommended pipeline:

```text
generate queries
-> search jobs
-> collect candidate links
-> score candidate links with direct-destination preference
-> resolve final destination
-> reject aggregator-only final links
-> run deterministic strict validation
-> score only accepted jobs
-> persist accepted ranked jobs
```

This preserves the current architecture while making the acceptance gate stricter.

## Error Handling And Inventory Behavior

The system should prefer quality over forced quantity.

Required behavior:

- if strict validation removes weak jobs, the product may return fewer matches for that day
- if no valid direct destination exists after conversion attempts, reject the job silently and continue
- if the live market is light, use the existing lighter-inventory messaging rather than filling with poor fits

This is preferable to showing low-trust results.

## Testing

Testing should focus on deterministic behavior:

- link-selection tests for preferring direct ATS/company links over aggregator links
- redirect-resolution tests for accepting converted direct links and rejecting aggregator-only final destinations
- validator tests for remote region mismatch
- validator tests for obvious French-language mismatch when the user profile does not support it
- regression coverage to ensure valid direct ATS links still pass

Add focused tests only where they materially protect the new rules.

## Success Criteria

The fix is successful when:

- Daily Matches no longer sends users to aggregator-only platform pages
- converted links are kept only when they end at a direct employer or ATS application destination
- obviously wrong-region remote jobs are filtered out before scoring
- obviously foreign-language jobs such as French-targeted roles are filtered out by default unless profile data supports them
- users no longer see trust-breaking moderate scores on clearly irrelevant jobs
- the pipeline remains deterministic, testable, and easy to extend later
