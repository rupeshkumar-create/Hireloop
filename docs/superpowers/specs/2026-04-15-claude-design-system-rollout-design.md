# Claude Design System Rollout Design

## Goal

Adopt the Claude-inspired design system across the full Hireschema product by using `npx getdesign@latest add claude` as the design foundation, then refactoring the current website, auth flow, onboarding flow, and dashboard to share one coherent visual system.

## Scope

This design applies to the shared frontend UI layer and the main user-facing routes in the Vite app.

In scope:
- Run `npx getdesign@latest add claude` and inspect the generated output
- Consolidate generated tokens and styles into the existing frontend styling system
- Update shared primitives in `src/components/ui`
- Update global styling in `src/index.css`
- Restyle the marketing website, blog pages, legal pages, login flow, onboarding flow, and dashboard screens
- Preserve existing business logic and route behavior while upgrading presentation

Out of scope:
- Backend, API, or Firebase logic changes unrelated to UI integration
- Rewriting app flows purely to match generated markup
- Large feature additions during the design pass
- Replacing working dashboard interactions unless the current layout blocks design-system adoption

## Existing Constraints

- The app is a single Vite frontend with both public website pages and authenticated product routes.
- A Claude-inspired visual reference already exists in `DESIGN.md`, and the current app already defines warm color tokens in `src/index.css`.
- Shared UI primitives already exist in `src/components/ui`, but they are only partially aligned with the intended Claude look and are not yet consistently used across all routes.
- The current landing page and shared website layout use many page-local utility classes and inline visual decisions, which makes whole-app consistency harder.
- Dashboard and workflow screens contain denser, stateful product UI and should keep usability and scanability ahead of strict editorial styling.

## Proposed Architecture

The rollout uses a CLI-first integration model:

1. Run `npx getdesign@latest add claude`
2. Inspect generated tokens, utility assumptions, and component output
3. Merge the generated design foundation into the current shared styling layer
4. Normalize the app around upgraded shared primitives and shells
5. Restyle routes in a controlled order from broadest surface to most stateful surface

The design system should have three layers:

### 1. Foundation Layer

This layer owns the canonical design tokens and type ramp:

- Warm background and surface tokens
- Claude-style text and border colors
- Shared spacing, radius, ring, and shadow decisions
- Serif-forward display typography and sans UI typography

Primary home:
- `src/index.css`

The generated CLI output is the starting point, but this project should end with one token source of truth rather than parallel token sets.

### 2. Primitive Layer

This layer owns reusable components that should absorb most visual decisions:

- `Button`
- `Card`
- `Input`
- `Textarea`
- `Badge`
- Shared container and section wrappers if repeated patterns emerge

Primary home:
- `src/components/ui`

These primitives should expose variants that reflect the Claude system while keeping the current app ergonomics intact.

### 3. Shell And Page Layer

This layer applies the system to major app structures:

- `WebsiteLayout`
- Shared page containers
- Dashboard shell and panels
- Auth and onboarding wrappers

Route-level pages should consume the shared layers instead of redefining colors, spacing, and interaction styles ad hoc.

## Rollout Order

The implementation order is:

1. CLI generation and inspection
2. Foundation token consolidation
3. Shared primitive upgrades
4. Website shell updates
5. Marketing, blog, and legal page restyling
6. Login and onboarding restyling
7. Dashboard shell and panel restyling
8. Focused cleanup of repeated local classes

Reasoning:
- Global tokens and primitives create the highest leverage with the lowest behavioral risk
- Website and auth surfaces are easier to validate visually
- Dashboard work should happen after the system is stable so dense product UI can be adapted carefully

## Component Strategy

### Shared Principles

- Use the generated Claude system as the visual baseline, not as an untouchable code template
- Prefer reusable primitives over page-local styling
- Preserve current component APIs where reasonable to reduce regression risk
- Keep one styling language across public and private routes

### Website Surfaces

Public pages should lean hardest into the editorial Claude feel:

- Serif-led headings
- Warm parchment backgrounds
- Terracotta primary actions
- Soft borders and ring-based containment
- More generous vertical spacing
- Stronger section rhythm and marketing hierarchy

Applicable routes:
- Landing page
- Blog index and post pages
- Privacy and terms pages
- Shared website navigation and footer

### Auth And Onboarding Surfaces

These routes should feel like the same product as the website while remaining compact and task-focused:

- Shared tokens and button treatments
- Cleaner form surfaces and inputs
- Balanced spacing between editorial branding and form usability

Applicable routes:
- Login
- Onboarding

### Dashboard Surfaces

Dashboard pages should use the same design language with tighter product-specific behavior:

- Same tokens, borders, and CTA language
- Tighter spacing than the website
- Clear grouping of cards and panels
- Emphasis on readability for job data, tabs, uploads, and detail panels

Applicable routes:
- Dashboard
- Admin dashboard
- Job tracker
- Settings
- Shared dashboard components

## Data And Behavior Boundaries

This rollout is intentionally presentation-first.

Must remain unchanged unless a small structural fix is required:
- Auth flows
- Resume parsing behavior
- Job search and ranking logic
- Outreach generation logic
- Existing route structure
- Existing hooks and service contracts

Allowed structural changes:
- Extract repeated page sections into shared layout wrappers
- Replace duplicated styling with shared component variants
- Adjust markup where necessary to support accessible and consistent visual structure

## Error Handling And Integration Rules

### CLI Integration Risks

Potential risks:
- Generated styles may overlap with existing token names
- Generated component assumptions may not match the current Tailwind v4 setup exactly
- Multiple competing button or card patterns may appear during integration

Rules:
- Do not keep parallel primitive systems if they serve the same purpose
- Prefer merging generator output into the existing shared UI layer
- If the generator produces incompatible assumptions, adapt the output to the current app instead of forcing a full rewrite
- Remove duplicate visual patterns once equivalent shared primitives exist

### Product Usability Guardrail

If a dashboard surface becomes less usable under the full editorial treatment:
- Keep the same tokens and component language
- Reduce decorative spacing or typography intensity
- Favor clarity, density, and action visibility over strict visual mimicry

## Testing And Verification

Validation should be route-based and behavior-preserving.

Required verification:
- Run TypeScript diagnostics after substantive edits
- Run a local production build
- Smoke-test the main routes after the design pass

Priority manual checks:
- Landing page
- Website navigation and footer
- Blog index and blog post pages
- Login
- Onboarding
- Dashboard
- Key dashboard panels and resume upload surfaces
- Settings or admin pages touched during rollout

Success criteria:
- Website and app share one coherent Claude-inspired visual language
- Shared primitives drive the majority of styling decisions
- No important auth or dashboard workflows regress
- Dense product surfaces remain readable and efficient

## Implementation Notes

- The current `DESIGN.md` should be treated as a reference for tone and design intent, but the final implementation should use the generated CLI foundation plus the app's consolidated token and primitive system.
- Inline styling and repeated local utility patterns should be reduced where they block consistency, but small route-specific utilities are acceptable when they express layout rather than reusable design decisions.
- The rollout should optimize for a stable, maintainable system that future pages can inherit without copying large blocks of custom classes.
