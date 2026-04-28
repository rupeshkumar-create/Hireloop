# Marketing Site Design Language (Intercom-like) — Design

## Goal

Apply a consistent, clean, Intercom-inspired marketing design language across the marketing website pages while leaving the in-app dashboard experience unchanged.

## In Scope (Marketing Website Only)

Routes that render inside `WebsiteLayout`:

- `/` (LandingPage)
- `/blog` (Blog)
- `/blog/:slug` (BlogPost)
- `/privacy` (PrivacyPolicy)
- `/terms` (TermsOfService)

Explicitly out of scope:

- `/dashboard`, `/tracker`, `/settings`, `/onboarding` and any other pages rendered inside the app layout
- Any sidebar/dashboard components

## Design Language

### Visual attributes (from reference)

- Minimal navigation with one primary CTA.
- Large editorial headline + short supporting paragraph.
- Lots of whitespace; no heavy gradients; use subtle borders and soft surfaces.
- Feature cards in a calm grid (rounded corners, subtle border, small icon, short title + copy).
- Illustration-led hero with playful line-art feel.

### Marketing theme tokens

Implement marketing tokens as a layer on top of the existing theme:

- Add `.marketing` wrapper on `WebsiteLayout` root.
- Define `.marketing` CSS variables for surfaces, borders, typography rhythm.
- Define `.dark .marketing` equivalents (keep theme toggle functional).

This guarantees the “app” remains visually unchanged because it is not wrapped in `.marketing`.

## Component/Pattern System

Introduce a small set of repeatable patterns (no new component library required):

- `MarketingContainer`: max width + padding rules
- `MarketingSection`: consistent vertical spacing
- `MarketingCard`: shared border/radius/surface/shadow rules
- `MarketingKicker`: small uppercase label style
- `MarketingH1/H2`: consistent typographic scale

These patterns are implemented via Tailwind class composition and (where necessary) shared CSS classes in `src/index.css`.

## Homepage (LandingPage) layout

- Hero becomes a 2-column layout on desktop:
  - Left: kicker, headline, supporting paragraph, primary CTA + secondary CTA
  - Right: new illustration image (generated; no placeholders)
- Replace the “abstract grid/floating shapes” aesthetic with calmer, marketing-style surfaces.
- Keep motion minimal and optional (avoid “app-like” dashboard animations).

## Blog + Legal pages

- Blog list uses the same card system as the homepage feature grid.
- Blog post page uses the same container width and “document card” treatment as legal pages.
- Privacy/Terms pages retain markdown styles but adopt the shared document card + spacing system.

## Acceptance Criteria

- Marketing pages share the same header rhythm, spacing, card styling, and CTA styling.
- Dark mode works on marketing pages and maintains the same design language.
- No changes to app layout or dashboard components.

