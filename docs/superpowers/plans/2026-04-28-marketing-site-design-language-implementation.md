# Marketing Site Design Language (Intercom-like) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a consistent Intercom-inspired marketing design language across website pages rendered in `WebsiteLayout`, without changing the in-app dashboard UI.

**Architecture:** Add a `.marketing` wrapper on `WebsiteLayout` and introduce marketing-specific CSS tokens (light + dark). Refactor LandingPage/Blog/BlogPost/Privacy/Terms to use shared spacing and card patterns.

**Tech Stack:** React, Tailwind v4 (`@import "tailwindcss"`), CSS variables in `src/index.css`, react-router

---

## File Map

**Modify**
- `src/components/WebsiteLayout.tsx`
- `src/index.css`
- `src/pages/LandingPage.tsx`
- `src/pages/Blog.tsx`
- `src/pages/BlogPost.tsx`
- `src/pages/PrivacyPolicy.tsx`
- `src/pages/TermsOfService.tsx`

**Create**
- `src/assets/marketing/hero-illustration.png` (generated image)

---

### Task 1: Add Marketing Wrapper + Tokens (Light/Dark)

**Files:**
- Modify: `src/components/WebsiteLayout.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add `.marketing` wrapper to WebsiteLayout**

Update `src/components/WebsiteLayout.tsx` root container from:

```tsx
<div className="flex min-h-screen flex-col overflow-x-hidden bg-background font-sans text-foreground">
```

to:

```tsx
<div className="marketing flex min-h-screen flex-col overflow-x-hidden bg-background font-sans text-foreground">
```

- [ ] **Step 2: Add marketing tokens to `src/index.css`**

Append to `src/index.css` (near other theme/token definitions):

```css
.marketing {
  --marketing-bg: var(--color-parchment);
  --marketing-surface: var(--color-ivory);
  --marketing-surface-2: var(--color-warm-sand);
  --marketing-border: var(--color-border-cream);
  --marketing-text: var(--color-near-black);
  --marketing-muted: var(--color-olive-gray);
  --marketing-accent: var(--color-terracotta);
  --marketing-accent-2: var(--color-coral);
  --marketing-shadow: 0 10px 40px rgba(0, 0, 0, 0.06);
}

.dark .marketing {
  --marketing-bg: #111110;
  --marketing-surface: #1a1a18;
  --marketing-surface-2: #242421;
  --marketing-border: #2b2b29;
  --marketing-text: #faf9f5;
  --marketing-muted: rgba(250, 249, 245, 0.72);
  --marketing-accent: var(--color-coral);
  --marketing-accent-2: var(--color-terracotta);
  --marketing-shadow: 0 14px 55px rgba(0, 0, 0, 0.35);
}

.marketing .marketing-container {
  max-width: 72rem;
  margin-left: auto;
  margin-right: auto;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
}

.marketing .marketing-card {
  border: 1px solid var(--marketing-border);
  background: var(--marketing-surface);
  border-radius: 24px;
  box-shadow: var(--marketing-shadow);
}

.marketing .marketing-kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--marketing-muted);
}
```

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS

---

### Task 2: Create Hero Illustration Asset

**Files:**
- Create: `src/assets/marketing/hero-illustration.png`

- [ ] **Step 1: Generate illustration image**

Use this URL pattern to generate a new illustration:

`https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt={prompt}&image_size=portrait_4_3`

Prompt guidance (URL-encode the prompt):
- clean line-art illustration
- parachute + boat vibe (inspired by reference but not copied)
- limited palette that works in light and dark

- [ ] **Step 2: Save image at**

`src/assets/marketing/hero-illustration.png`

---

### Task 3: Refactor LandingPage to Marketing Layout

**Files:**
- Modify: `src/pages/LandingPage.tsx`
- Use: `src/assets/marketing/hero-illustration.png`

- [ ] **Step 1: Replace hero section with 2-column marketing hero**

Implement:
- left content: kicker + H1 + paragraph + CTA row (primary + secondary)
- right content: `<img>` illustration
- remove the abstract grid + floating shapes + terminal-like heavy visuals

- [ ] **Step 2: Add Feature grid section using `.marketing-card`**

Add a “Why Hireschema?” section with 4 cards:
- Remote-only matches
- Link-verified jobs
- Daily delivery (Free 1 / Pro 10)
- Tailored AI help (resume + outreach)

- [ ] **Step 3: Keep existing button components**

Use the existing `Button` variant(s); do not introduce a new button system.

- [ ] **Step 4: Run `npm run build`**

```bash
npm run build
```

Expected: build succeeds

---

### Task 4: Align Blog Listing Page to Marketing Cards

**Files:**
- Modify: `src/pages/Blog.tsx`

- [ ] **Step 1: Update outer container**

Change container to use consistent marketing layout:
- `className="marketing-container py-16"` at the top-level wrapper

- [ ] **Step 2: Update post cards**

Apply `.marketing-card` and consistent hover:
- remove custom shadows where redundant

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: PASS

---

### Task 5: Align Blog Post + Legal Pages to Document Card Style

**Files:**
- Modify: `src/pages/BlogPost.tsx`
- Modify: `src/pages/PrivacyPolicy.tsx`
- Modify: `src/pages/TermsOfService.tsx`

- [ ] **Step 1: Wrap markdown content in `.marketing-container`**

Use:
- Outer: `marketing-container py-12 md:py-16`
- Inner: `marketing-card p-8 md:p-12` plus `markdown-body`

- [ ] **Step 2: Ensure Back link styling matches marketing (muted → foreground hover)**

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: PASS

---

### Task 6: Visual Verification (Local Preview)

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify pages manually**

Verify:
- `/` hero 2-column + illustration
- `/blog` cards match homepage cards
- `/blog/:slug` uses same document card style as `/privacy` and `/terms`
- Toggle light/dark in navbar affects marketing pages only
- Dashboard routes unchanged visually

