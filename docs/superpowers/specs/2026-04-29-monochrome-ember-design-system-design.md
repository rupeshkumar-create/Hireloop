# Monochrome + Ember Design System (Adoption Spec)

## Goal

Replace the current visual language with the “Monochrome + Ember” system and apply it consistently across:

- Marketing website routes (Landing, Blog, Legal pages)
- App routes (Dashboard, Onboarding, Job Tracker, Admin)
- Core UI primitives (buttons, inputs, cards, modals, tabs, toasts)

Also remove legacy design spec documents so a single source of truth remains.

## Scope

### Docs

- Delete all existing files matching: `docs/superpowers/specs/*-design.md`
- Add a single root design system document: `DESIGN.md` (this becomes the canonical design reference)

### Visual system adoption

- Replace global tokens in `src/index.css` with the new neutral + ember tokens
- Update UI primitives in `src/components/ui/*` (and any other shared components) to conform
- Sweep key pages to remove leftover styles that conflict with the new rules (shadows, bold 700, decorative accent fills, inconsistent radii)

## Non-goals

- No feature changes (no new pages, flows, or product behavior changes)
- No re-copywriting / content strategy changes unless required by typography/layout constraints
- No new design libraries; reuse existing Tailwind + existing component patterns

## Source of truth

- `DESIGN.md` (repo root) contains the complete “Monochrome + Ember” system exactly as provided by the user.
- `src/index.css` contains the implemented token layer and global defaults.
- UI primitives enforce the rules; product pages should avoid custom “one-off” styling.

## Token model

The app already uses Tailwind v4 with `@theme` plus CSS custom properties in `src/index.css`. The adoption will keep that approach:

- Define the “Monochrome + Ember” tokens as CSS variables
- Map a small semantic set of Tailwind-facing variables (background, surface, border, foreground, ring, primary) to those tokens
- Use those semantic variables in components instead of hardcoded colors

### Tokens to implement

#### Dark mode (native)

- Background/surfaces/borders/text:
  - `--bg-canvas`, `--bg-primary`, `--bg-secondary`, `--bg-elevated`
  - `--border-subtle`, `--border-default`, `--border-strong`
  - `--text-primary`, `--text-secondary`, `--text-muted`, `--text-disabled`
- Ember scale:
  - `--ember-50` … `--ember-600`
  - `--ember-glow`, `--ember-tint`
- Signals:
  - `--signal-success`, `--signal-warn`, `--signal-error`

#### Light mode

Implement the light mode equivalents from the provided system so the theme toggle remains functional.

### Tailwind semantic mappings

Map these semantic variables so existing Tailwind utility usage continues to work:

- `--color-background` → `--bg-canvas`
- `--color-surface` → `--bg-primary`
- `--color-surface-hover` → use a subtle surface blend (no ember)
- `--color-foreground` → `--text-primary`
- `--color-foreground-muted` → `--text-muted`
- `--color-border` → `--border-default`
- `--color-border-strong` → `--border-strong`
- `--color-ring` → focus ring color, based on ember glow
- `--color-primary` → `--ember-400` (but components must still obey “ember only on interaction”)

## Typography model

The system requires:

- Sans: Inter (weights 400/500 only)
- Mono: JetBrains Mono (labels, meta)
- No display serif headings
- Avoid weight 700; max weight 500

Adoption changes:

- Remove the display font usage from headings (`--font-display`)
- Ensure headings inherit `--font-sans` (with weight 400/500)
- Keep `--font-mono` for labels, timestamps, code

## Shape + elevation rules

- Pills reserved for actions (buttons)
- Inputs: 8px radius
- Cards: 12px radius
- Modals: 16px radius
- No drop shadows (remove existing shadows from Card, buttons, etc.)
- Depth comes from value layering and borders
- Allowed:
  - Focus ring glow
  - Modal halo + backdrop overlay

## Component enforcement plan

### Button

- Primary action is a pill
- Default state is monochrome (no ember fill)
- Ember appears only on hover, focus-visible, active, selected, and loading geometry (spinner/progress)
- Replace blue focus ring with ember glow

### Input

- 8px radius
- Monochrome default
- Ember border + ring on focus-visible
- Error uses `--signal-error`

### Card

- Remove shadow
- Use border default/strong on hover
- Selected uses ember stroke + ember tint overlay

### Tabs / segmented controls

- Monochrome track + monochrome inactive text
- Active indicator uses ember bar/dot
- No shadow/lift

### Modal

- Use `--bg-elevated` + border
- Backdrop overlay, optional blur
- Entry/exit motion uses the cinematic durations/eases

### Toast / notifications

- Monochrome by default
- Ember only for progress/loading or focus/selection emphasis

## Page sweep checklist

Across website + app pages:

- Remove decorative shadows and hover-lift animations on cards
- Remove any default-state orange fills or orange blocks
- Ensure spacing uses 8px unit steps
- Replace any bold-700 typography with 400/500
- Ensure interactive focus states are ember glow, not blue

## File operations

### Deletions

Delete:

- `docs/superpowers/specs/*-design.md`

### Additions

- `DESIGN.md` (root): user-provided “Monochrome + Ember” content

## Rollout and verification

- Compile-time verification: `npm run lint`, `npm run build`
- Unit tests: `npm run test`
- Manual smoke test (local):
  - Landing page, Blog, Login
  - Dashboard (post-login)
  - Onboarding (resume upload UI)
  - Job tracker (cards, buttons, inputs, tabs)
  - Theme toggle: confirm light/dark mappings

## Acceptance criteria

- The site/app visually conforms to the “Monochrome + Ember” rules:
  - Calm monochrome resting state
  - Ember appears only for interaction/focus/loading/selection
  - No drop shadows (except focus ring + modal halo)
  - Typography uses Inter/JetBrains Mono, no display serif headings, no 700 weights
- Existing functionality remains intact (no broken routes, no console errors introduced)
- All existing tests pass

