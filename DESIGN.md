# Monochrome + Ember
### A design system for interfaces that respond with precision

---

## 0 · Thesis

> **Monochrome defines structure. Ember defines interaction.**

Color is not decoration. It is **behavior**. The interface is calm, almost dormant at rest — and only *animates* into chromatic life under the user's hand. There is no flair. No applause. Every motion is intentional, every shade is earned.

The system feels like:

- A **studio reading lamp** — quiet, precise, warm only where you're working.
- A **mechanical instrument** — minimum friction, maximum confidence.
- A **silent room** that resonates only when spoken to.

---

## 1 · Foundations

### 1.1 Color — Neutrals (dark mode native)

No pure black. Layered grays create depth through *value*, not shadow.

| Token | Value | Role |
|---|---|---|
| `--bg-canvas` | `#0b0b0b` | Page void — the deepest layer |
| `--bg-primary` | `#171717` | Default surface |
| `--bg-secondary` | `#0f0f0f` | Recessed surface (inputs, deep panels) |
| `--bg-elevated` | `#1c1c1c` | Modal, popover, raised card |
| `--border-subtle` | `#242424` | Hairline dividers |
| `--border-default` | `#2e2e2e` | Card / button stroke |
| `--border-strong` | `#3a3a3a` | Hover stroke |
| `--text-primary` | `#fafafa` | Headlines, primary text |
| `--text-secondary` | `#c2c2c2` | Body, supporting copy |
| `--text-muted` | `#898989` | Labels, metadata |
| `--text-disabled` | `#5a5a5a` | Disabled states |

### 1.2 Color — Light mode

Light mode inverts with **warm off-whites**, never pure white.

| Token | Value | Role |
|---|---|---|
| `--bg-canvas` | `#f7f6f3` | Warm paper |
| `--bg-primary` | `#fcfbf8` | Default surface |
| `--bg-secondary` | `#f1efe9` | Recessed surface |
| `--bg-elevated` | `#ffffff` | Modal, raised |
| `--border-subtle` | `#ece9e0` | Hairline |
| `--border-default` | `#dcd8cc` | Card stroke |
| `--border-strong` | `#c4bfae` | Hover stroke |
| `--text-primary` | `#171717` | Headlines |
| `--text-secondary` | `#3d3d3a` | Body |
| `--text-muted` | `#7a7770` | Labels |
| `--text-disabled` | `#aeaba3` | Disabled |

### 1.3 Color — Ember (the action color)

A muted, earthen orange. Not a sunset, not a highlighter. It reads as **considered heat** — warm, alive, restrained.

```css
--ember-50:  #f9efe6;
--ember-100: #f0d9c2;
--ember-200: #e1b48f;
--ember-300: #cc8e63;
--ember-400: #b8693d;
--ember-500: #a25a32;
--ember-600: #874a29;

--ember-glow: 0 0 0 3px rgba(184, 105, 61, 0.18);
--ember-tint: rgba(184, 105, 61, 0.08);
```

### 1.4 Usage rules — when ember appears

| State | Ember? | Treatment |
|---|---|---|
| Default | ❌ | Pure monochrome |
| Hover | ✅ | Stroke + icon |
| Focus | ✅ | Outer ring (`--ember-glow`) |
| Active / Pressed | ✅ | Surface tint (`--ember-tint`) |
| Loading | ✅ | Progress geometry only |
| Selected | ✅ | Stroke + tint |
| Error | ❌ | Use `--signal-error` |

> **Hard rule:** Ember is *never* used as a fill on default state. No filled orange buttons. No orange card backgrounds. No orange hero blocks.

### 1.5 Signal colors

Used sparingly, only for status semantics. Never decorative.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--signal-success` | `#7fb893` | `#3d8a5a` | Confirmation, valid |
| `--signal-warn` | `#d4a85a` | `#a07a2a` | Caution |
| `--signal-error` | `#d96e6e` | `#b04545` | Destructive, invalid |

---

## 2 · Typography

### 2.1 Families

```css
--font-sans: "Inter", "Söhne", system-ui, sans-serif;
--font-mono: "JetBrains Mono", "Berkeley Mono", ui-monospace, monospace;
```

- **Sans** for everything except labels and tabular data.
- **Mono** for labels, eyebrows, code, timestamps, numeric meters.

### 2.2 Scale

| Role | Size | Weight | Line height | Tracking |
|---|---|---|---|---|
| Hero | 72 / 88px | 400 | 1.02 | -0.02em |
| Display | 48px | 400 | 1.08 | -0.02em |
| Section | 36px | 400 | 1.20 | -0.015em |
| Title | 24px | 400 | 1.30 | -0.01em |
| Subtitle | 18px | 500 | 1.40 | 0 |
| Body | 16px | 400 | 1.55 | 0 |
| Body small | 14px | 400 | 1.50 | 0 |
| Button | 14px | 500 | 1.20 | 0 |
| Caption | 12px | 400 | 1.40 | 0 |
| Label (mono) | 11px | 500 | 1.30 | 0.14em (UPPERCASE) |

### 2.3 Rules

- **No 700 bold.** Hierarchy through size and color, not weight. Maximum weight is 500.
- **Mono labels are uppercase, wide-tracked.** They read as instrumentation, not copy.
- Body line-height is generous (1.55) — the warmth of ember balances the density.
- Headlines are tracked slightly negative; body is neutral.

---

## 3 · Shape

| Element | Radius | Why |
|---|---|---|
| Primary action button | `9999px` (pill) | Action shape |
| Secondary / ghost button | `9999px` (pill) | Consistency |
| Icon button | `9999px` (circle) | |
| Input | `8px` | Soft rectangle |
| Card | `12px` | Soft rectangle |
| Modal | `16px` | Larger soft rectangle |
| Tag / chip | `6px` | Tight, dense |
| Tab indicator | `6px` | Tight |

> **Rule:** Pills are reserved for actions. Everything else is a soft rectangle. Mixing shapes within a family (e.g. circle + pill in the same toolbar) is forbidden.

---

## 4 · Spacing

8px base unit. Steps:

```
4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128
```

- **Sections** breathe at 96–128px vertical.
- **Cards** internal at 24–32px.
- **Form rows** at 16–24px.
- **Inline** clusters at 8–12px.

> Separation comes from **borders**, not shadows. If you reach for a shadow, ask: would a 1px stroke do the job?

---

## 5 · Elevation

No drop shadows. Depth comes from **value layering** and **stroke contrast**.

| Level | Token | Technique |
|---|---|---|
| `e0` Ground | `--bg-canvas` | Page void |
| `e1` Surface | `--bg-primary` | Default content |
| `e2` Card | `--bg-primary` + `--border-default` | Stroked container |
| `e3` Hover | `+ --border-strong` | Stroke shifts |
| `e4` Modal | `--bg-elevated` + `--border-default` | Lifts via lighter value |
| `e5` Focus | `+ ember-glow ring` | Ember outer ring |

The **only** allowed shadow in the entire system is the focus ring:

```css
--shadow-focus-ring: 0 0 0 3px rgba(184, 105, 61, 0.18);
```

Modals get a single-pixel halo, not a shadow:

```css
--shadow-modal-halo: 0 0 0 1px var(--border-subtle), 0 0 0 9999px rgba(0,0,0,0.55);
```

---

## 6 · Motion

Motion is **cinematic** — slower than typical, deliberate, layered. Never playful.

### 6.1 Duration tokens

```css
--dur-instant: 80ms;
--dur-fast:    180ms;
--dur-base:    260ms;
--dur-slow:    420ms;
--dur-cinema:  600ms;
--dur-loop:    1800ms;
```

### 6.2 Easing tokens

```css
--ease-out:     cubic-bezier(0.22, 1, 0.36, 1);
--ease-in-out:  cubic-bezier(0.65, 0, 0.35, 1);
--ease-stage:   cubic-bezier(0.16, 1, 0.3, 1);
--ease-spring:  cubic-bezier(0.34, 1.32, 0.64, 1);
```

> **Default to `--ease-out`.** Reach for spring only on toggles or selection commits.

### 6.3 Movement budget

| Element | Travel |
|---|---|
| Icon shift on hover | 4–6px |
| Text shift on hover | 1–2px |
| Card hover | 0px (border only — no lift) |
| Modal enter | 12px y-translate |
| Toast enter | 16px y-translate |

Cards do **not** lift on hover. The interaction is in the *stroke*. Lift is reserved for things that genuinely move (modals, toasts, dragged items).

### 6.4 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

All ember **state changes** still occur (color flips happen instantly) — only the *travel* is removed.

---

## 7 · Components

### 7.1 Button — Primary action (pill)

```
Default
  background  : --bg-secondary
  border      : 1px solid --border-default
  color       : --text-primary
  radius      : 9999px
  padding     : 10px 22px
  font        : 14px / 500
  icon        : 14px stroke 1.5 — currentColor

Hover (260ms ease-out)
  border      : --ember-400
  icon-color  : --ember-400
  icon-x      : translateX(4px)
  text-x      : translateX(1px)
  bg          : rgba(255,255,255,0.02)

Focus-visible
  ring        : --ember-glow

Active / Pressed
  bg          : --ember-tint
  scale       : 0.985

Loading
  text        : opacity 0
  spinner     : ember progress arc, centered, 16px
  border      : --border-default (does NOT turn ember while loading)

Disabled
  opacity     : 0.4, no interaction
```

### 7.2 Button — Secondary (ghost)

```
Default      : transparent bg, no border, --text-secondary
Hover        : --text-primary, underline-from-center (ember)
Focus        : ember ring
```

### 7.3 Button — Icon

Pill made circle. 36×36, 16px icon. Same hover rules — icon turns ember, no movement (the icon is alone, has nowhere to shift).

### 7.4 Input

```
Default
  bg          : --bg-secondary
  border      : 1px solid --border-default
  radius      : 8px
  padding     : 10px 14px
  font        : 14px / 400
  color       : --text-primary
  placeholder : --text-muted

Hover
  border      : --border-strong

Focus
  border      : --ember-400
  ring        : --ember-glow
  transition  : border 180ms, box-shadow 260ms ease-out

Filled (has value)
  border      : --border-strong

Error
  border      : --signal-error
  ring        : 0 0 0 3px rgba(217,110,110,0.16)

Success
  border      : --signal-success (very subtle, only when explicit)
```

### 7.5 Card

```
bg            : --bg-primary
border        : 1px solid --border-default
radius        : 12px
padding       : 24px
shadow        : none

Hover (260ms)
  border      : --border-strong

Selected
  border      : --ember-400
  bg-overlay  : --ember-tint
```

### 7.6 Tabs / Segmented control

Inline group of pill buttons inside a `--bg-secondary` track, 4px inset.

```
Inactive     : transparent, --text-muted
Hover        : --text-primary
Active       : --bg-primary background, --text-primary, ember underline OR ember left dot
Indicator    : 2px ember bar, animated 260ms ease-out as it slides between tabs
```

### 7.7 Modal

```
Backdrop     : rgba(0,0,0,0.55), backdrop-filter blur(8px)
Surface      : --bg-elevated, 1px solid --border-default, radius 16px
Enter        : opacity 0→1 + translateY(12px → 0), 420ms ease-stage
Exit         : reverse, 260ms
Close        : icon button, top-right, 32px from edge
Focus trap   : required
```

### 7.8 Sidebar / Nav

```
bg           : --bg-canvas
border-right : 1px solid --border-subtle
width        : 248px (expanded), 64px (collapsed)
item-padding : 8px 12px
item-radius  : 8px

Item default   : --text-secondary, transparent
Item hover     : --text-primary, --bg-primary background
Item active    : --text-primary, --bg-primary, ember 2px left dot or stroke
Icon           : 16px, stroke 1.5
```

---

## 8 · Loading & async patterns

Ember belongs to loading. It is the visual contract that **the system is working**.

### 8.1 Spinner — circular progress

- Diameter: 14, 16, 20, 24, 32px.
- Stroke: 2px, ember-400.
- Rotation: 1.4s linear infinite.
- Tail length: 0.6 of circumference (270° arc).
- Use inside buttons, on row meters, and as the page-level indicator.

### 8.2 Linear progress

- Height: 2px.
- Track: `--border-default`.
- Bar: `--ember-400`.
- Indeterminate: 1.6s ease-in-out, scaleX 0.3 sliding 0% → 100%.

### 8.3 Skeleton

- Background: `--bg-secondary`.
- Shimmer: 1.6s linear infinite, gradient from `--bg-secondary` → `--bg-primary` → `--bg-secondary`.
- Radius: matches the element being placeheld.

### 8.4 Button loading

When a button is loading, **the label fades to 0 opacity and a spinner replaces it in the same width**. The button does **not** resize. Border stays neutral — ember appears only in the spinner.

### 8.5 Empty state

No spinner. Single line of muted copy + ghost button to act. Ember does not appear in empty states (nothing is happening to warrant it).

---

## 9 · Form validation

Validation is **late and forgiving** — fires on blur, not on every keystroke.

| State | Treatment |
|---|---|
| Pristine | Default border |
| Focused | Ember border + ring |
| Filled valid | Strong border, no ember |
| Invalid (after blur) | Error border + helper text in `--signal-error` |
| Invalid + focused | Error border + ember ring (focus wins visually) |
| Submitting | Input disabled, button shows spinner |
| Submitted success | Inline check + `--signal-success` helper, 2s, then fade |

Helper text sits 6px below the input, 12px size, `--text-muted` (or signal color when erroring).

---

## 10 · Iconography

- **Library:** `https://lucide.dev` — single source, no mixing.
- **Stroke:** 1.5px (Lucide default).
- **Sizes:** 12 / 14 / 16 / 20 / 24 / 32px. Match the typographic anchor.
- **Color:** `currentColor`. Always inherits from the text it sits with.
- **Filled icons:** banned. The system is line-only.
- **Decorative icons:** banned. If an icon doesn't carry meaning, remove it.

Icon spacing inside buttons: 8px gap between icon and label. The icon sits left of label by default; arrows go right.

---

## 11 · Accessibility

### 11.1 Contrast (WCAG)

All token pairs in this system meet **AA** at body size; primary text on primary bg meets **AAA**.

| Pair | Ratio | Grade |
|---|---|---|
| `--text-primary` on `--bg-primary` (dark) | 16.8:1 | AAA |
| `--text-secondary` on `--bg-primary` (dark) | 9.4:1 | AAA |
| `--text-muted` on `--bg-primary` (dark) | 4.6:1 | AA |
| `--ember-400` on `--bg-primary` (dark) | 4.5:1 | AA |
| `--text-primary` on `--bg-primary` (light) | 14.2:1 | AAA |
| `--ember-500` on `--bg-primary` (light) | 4.7:1 | AA |

### 11.2 Focus

- **Always visible** on `:focus-visible`.
- Outer ring: `--ember-glow` (3px, 18% alpha).
- Never `outline: none` without a replacement.
- Ring sits *outside* the element's border — never replaces it.

### 11.3 Hit targets

- Minimum **40×40** for any interactive element.
- Pill buttons compute height including padding to clear 40.

### 11.4 Motion

- Honor `prefers-reduced-motion` (see §6.4).
- Avoid parallax, infinite zoom, autoplay video.
- Looping animations (spinners) pause when off-screen.

### 11.5 Screen readers

- Loading buttons set `aria-busy="true"`.
- Spinners carry `role="status"` + `aria-label="Loading"`.
- Tab indicators announce via `role="tablist"` / `role="tab"` / `aria-selected`.

---

## 12 · Voice

Direct, instrumental, calm. The interface speaks like a precise tool.

- Sentence case for headings. **No Title Case.**
- UPPERCASE + tracked for eyebrows and instrument labels only.
- Short sentences. Active verbs. No adjectives that mean nothing ("seamless", "powerful").
- No emoji. No exclamation marks. No "we're excited".
- Errors describe the cause and the fix, in that order.

---

## 13 · Do / Don't

### ✅ Do

- Keep the resting interface fully monochrome.
- Use ember only on interaction, focus, loading, and selection.
- Build depth from value and stroke, not shadow.
- Honor reduced-motion.
- Default to `--ease-out`; reach for spring rarely.

### ❌ Don't

- Don't fill ember as a background on a default-state element.
- Don't mix shapes inside a component family.
- Don't use shadows for elevation.
- Don't introduce a second accent color.
- Don't animate decoratively. Every animation answers a user input or a system state.

---

## 14 · Identity

> *"A silent interface that responds with precision."*

Quiet at rest. Warm where touched. Nothing wasted.

