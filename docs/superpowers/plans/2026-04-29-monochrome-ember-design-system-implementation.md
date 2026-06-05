# Monochrome + Ember Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current UI theme with “Monochrome + Ember”, delete legacy design specs, and enforce the new system across core UI primitives and all key pages.

**Architecture:** Use CSS custom properties as the token source of truth, map a small semantic layer for Tailwind utilities, refactor UI primitives to enforce rules, then sweep pages for violations (shadows, 700 weights, mismatched radii, incorrect focus rings).

**Tech Stack:** React 19, Vite 6, Tailwind v4 (`@theme`), lucide-react, motion.

---

## Files to change

**Docs**
- Create: `DESIGN.md`
- Delete: `docs/superpowers/specs/*-design.md` (including the new adoption spec after its content is moved into `DESIGN.md`)

**Theme**
- Modify: `src/index.css`

**UI primitives**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/ui/badge.tsx` (if it uses accents or inconsistent radii)
- Modify: `src/components/ui/textarea.tsx` (if it exists and matches input styling)
- Modify: `src/components/ui/theme-toggle.tsx` (if it uses accent colors incorrectly)

**Website + app pages (sweep)**
- Inspect & adjust (as needed): `src/pages/*` and `src/components/*`

---

### Task 1: Replace design docs with single root DESIGN.md

**Files:**
- Create: `/Users/rupesh/Desktop/Side projects/hireschema/DESIGN.md`
- Delete: `/Users/rupesh/Desktop/Side projects/hireschema/docs/superpowers/specs/*-design.md`

- [ ] **Step 1: Copy the user-provided “Monochrome + Ember” content into `DESIGN.md`**

- [ ] **Step 2: Delete all legacy design specs**
  - Delete every file matching `docs/superpowers/specs/*-design.md`

- [ ] **Step 3: Verify no remaining references assume the deleted docs**
  - Search for `docs/superpowers/specs/` references.

- [ ] **Step 4: Run sanity check**

Run:
```bash
npm run lint
```
Expected: exit code 0

- [ ] **Step 5: Commit**
```bash
git add DESIGN.md docs/superpowers/specs
git commit -m "docs: replace legacy design specs with DESIGN.md"
```

---

### Task 2: Implement Monochrome + Ember tokens in `src/index.css`

**Files:**
- Modify: `/Users/rupesh/Desktop/Side projects/hireschema/src/index.css`

- [ ] **Step 1: Update font imports**
  - Keep Inter and JetBrains Mono.
  - Remove EB Garamond usage (and any `--font-display` usage).

- [ ] **Step 2: Replace the existing “Anthropic Design System Colors” tokens with the new token sets**
  - Add dark + light token blocks from the user spec.
  - Keep `:root` for light mode and `.dark` for dark mode (or invert if currently dark-first).

- [ ] **Step 3: Implement semantic mappings used by Tailwind utilities**
  - Ensure these exist and are mapped:
    - `--color-background`
    - `--color-surface`
    - `--color-surface-hover`
    - `--color-foreground`
    - `--color-foreground-muted`
    - `--color-border`
    - `--color-border-strong`
    - `--color-ring`
    - `--color-primary`

- [ ] **Step 4: Implement global focus-visible rules**
  - Replace blue focus ring styling with ember glow.
  - Ensure focus ring does not rely on drop shadows.

- [ ] **Step 5: Run typecheck + build**

Run:
```bash
npm run lint
npm run build
```
Expected: both succeed

- [ ] **Step 6: Commit**
```bash
git add src/index.css
git commit -m "style: add monochrome + ember tokens"
```

---

### Task 3: Refactor `Button` to enforce “ember only on interaction”

**Files:**
- Modify: `/Users/rupesh/Desktop/Side projects/hireschema/src/components/ui/button.tsx`
- Test: `/Users/rupesh/Desktop/Side projects/hireschema/src/components/dashboard/__tests__/MatchesTab.test.ts` (smoke compile) and/or add a focused snapshot-like test if present patterns exist

- [ ] **Step 1: Update base classes**
  - Enforce pill radius for action shapes.
  - Replace hard-coded focus ring (`[#3898ec]`) with semantic ring token.
  - Remove default-state filled ember backgrounds.

- [ ] **Step 2: Define variants per system**
  - `default` (monochrome)
  - `action` (still monochrome by default; ember appears on hover/focus/active)
  - `ghost`, `outline`, `secondary`, `destructive` (signals only for destructive)

- [ ] **Step 3: Run tests**

Run:
```bash
npm run test
```
Expected: pass

- [ ] **Step 4: Commit**
```bash
git add src/components/ui/button.tsx
git commit -m "style: align button with monochrome + ember"
```

---

### Task 4: Refactor `Input`/`Textarea` to match 8px radius + ember focus

**Files:**
- Modify: `/Users/rupesh/Desktop/Side projects/hireschema/src/components/ui/input.tsx`
- Modify (if present): `/Users/rupesh/Desktop/Side projects/hireschema/src/components/ui/textarea.tsx`

- [ ] **Step 1: Input**
  - Set radius to 8px.
  - Remove hard-coded focus ring.
  - Ensure hover changes border strength (no shadow).

- [ ] **Step 2: Textarea (if applicable)**
  - Mirror input styles and tokens.

- [ ] **Step 3: Run tests**

Run:
```bash
npm run test
```
Expected: pass

- [ ] **Step 4: Commit**
```bash
git add src/components/ui/input.tsx src/components/ui/textarea.tsx
git commit -m "style: align inputs with monochrome + ember"
```

---

### Task 5: Refactor `Card` to remove drop shadows and use border-only elevation

**Files:**
- Modify: `/Users/rupesh/Desktop/Side projects/hireschema/src/components/ui/card.tsx`

- [ ] **Step 1: Remove any `shadow-*` classes**
- [ ] **Step 2: Set card radius to 12px**
- [ ] **Step 3: Ensure hover uses border strength only**
- [ ] **Step 4: Run tests + build**

Run:
```bash
npm run test
npm run build
```
Expected: pass

- [ ] **Step 5: Commit**
```bash
git add src/components/ui/card.tsx
git commit -m "style: align card elevation with monochrome + ember"
```

---

### Task 6: Sweep app + website pages for design system violations (full sweep)

**Files:**
- Modify as needed in:
  - `/Users/rupesh/Desktop/Side projects/hireschema/src/pages/*`
  - `/Users/rupesh/Desktop/Side projects/hireschema/src/components/*`

- [ ] **Step 1: Remove serif display headings**
  - Ensure headings use `--font-sans` and weights 400/500.

- [ ] **Step 2: Replace any blue rings or arbitrary accents**
  - Ensure focus uses ember glow.

- [ ] **Step 3: Remove drop shadows and hover-lift animations on cards**
  - Convert to border-only interactions.

- [ ] **Step 4: Normalize radii**
  - Inputs 8px, cards 12px, modals 16px, buttons pill.

- [ ] **Step 5: Run full verification**

Run:
```bash
npm run lint
npm run test
npm run build
```
Expected: all succeed

- [ ] **Step 6: Manual smoke test (local)**
  - Start dev server and click through:
    - `/` (Landing)
    - `/blog`
    - `/login`
    - Post-login: dashboard and job tracker
    - Toggle dark/light
  - Confirm no console errors beyond expected local analytics failures.

- [ ] **Step 7: Commit**
```bash
git add src/pages src/components src/index.css
git commit -m "style: apply monochrome + ember across pages"
```

---

## Self-review (plan)

**Spec coverage**
- Docs deletion + single `DESIGN.md`: Task 1
- Tokens + semantic mappings: Task 2
- Core primitives enforcement: Tasks 3–5
- Full app + website sweep: Task 6

**Placeholder scan**
- No TODO/TBD steps required to proceed.

---

Plan complete and saved to:
- `/Users/rupesh/Desktop/Side projects/hireschema/docs/superpowers/plans/2026-04-29-monochrome-ember-design-system-implementation.md`

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks
2. **Inline Execution** — execute tasks here step-by-step with checkpoints

Which approach?

