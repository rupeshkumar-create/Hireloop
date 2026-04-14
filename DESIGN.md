# Hireschema Design System & Guidelines

## 1. Core Philosophy
Hireschema follows a **minimalist, monochromatic (Black & White) design language** with a single, deliberate accent color: **Muted Orange**. This creates a professional, distraction-free environment that feels premium and executive.

## 2. Color Palette
- **Primary Backgrounds**: White (`bg-white`) or very light gray (`bg-zinc-50`).
- **Typography & Dark Elements**: Deep zinc/black (`text-zinc-900`, `bg-zinc-900`).
- **Action Color**: Muted Orange (`orange-500` / `#f97316`). Used strictly for primary calls-to-action (CTAs), key interactive elements, and critical highlights.
- **Borders & Separators**: Soft zinc (`border-zinc-200` or `border-white/40` in glass elements).
- **Prohibitions**: No indigo, emerald, rose, or blue. All semantic feedback (success, warning, error) should either be communicated through muted monochrome states, standard icons, or the primary action orange where appropriate.

## 3. Glassmorphism & iOS Aesthetics
- **Modals & Overlays**: All modals, popups, and focus-stealing elements must utilize an **iOS-style full-screen glassmorphism** effect.
  - Background overlay: `bg-black/40 backdrop-blur-md`
  - Modal surface: `bg-white/80 backdrop-blur-2xl border border-white/40 shadow-2xl rounded-3xl`
- **Cards & Floating Elements**: Use subtle translucency (`bg-white/50 backdrop-blur-sm`) to create depth without harsh drop-shadows.

## 4. Motion & Animation (Framer Motion)
- **Subtle & Fluid**: All animations should feel native and fluid, matching iOS transition curves.
- **Entry Animations**: Use a combination of fade and slight scale/translate.
  - Example: `initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}`
- **Exit Animations**: Reverse the entry smoothly.
  - Example: `exit={{ opacity: 0, scale: 0.95, y: 20 }}`
- **Interactions**: Buttons and interactive cards should have a very subtle hover lift (`hover:-translate-y-0.5`) and shadow expansion.

## 5. Typography
- Keep fonts clean and highly legible (system-ui, -apple-system, sans-serif).
- Use `font-display` for major headings and numbers.
- Maintain high contrast: `text-zinc-900` for primary text, `text-zinc-500` for secondary.

## 6. Components
### Buttons
- **Default (Secondary)**: `bg-zinc-900 text-white hover:bg-zinc-800`
- **Action (Primary)**: `bg-orange-500 text-white hover:bg-orange-600` (Used for "Apply Now", "Get Started", "Upgrade to Pro")
- **Outline**: `border border-zinc-200 bg-transparent hover:bg-zinc-100 text-zinc-900`

### Badges
- **Neutral**: `bg-zinc-100 text-zinc-600`
- **Success/Highlight**: `bg-orange-100 text-orange-900`

## 7. Execution Checklist
- [x] All primary CTA buttons use the Muted Orange `action` variant.
- [x] All modals (Job Details, Resume Preview, Change Plan) use full-screen glassmorphism wrappers with `backdrop-blur`.
- [x] Removed all extraneous colors (indigo, emerald, blue, rose) from the codebase.
- [x] Framer motion applied to all modal mounts and unmounts.
