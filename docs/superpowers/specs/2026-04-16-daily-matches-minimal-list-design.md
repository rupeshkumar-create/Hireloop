# Daily Matches Minimal List Design

**Goal:** Redesign the `Daily Matches` dashboard surface into a clearer, more modern minimal-list experience without changing the underlying jobs, filtering, save, dismissal, selection, or paywall logic.

**Scope:** This change covers the layout and styling of `src/components/dashboard/MatchesTab.tsx` and may include a light visual adjustment to the tab switcher in `src/pages/Dashboard.tsx` so the screen feels cohesive. It does not change data fetching, ranking, billing rules, job details behavior, or AI actions.

## Current Context

The current Daily Matches surface already has the necessary product behavior:

- `src/pages/Dashboard.tsx` owns the tab switcher and passes the current matches state into `MatchesTab`
- `src/components/dashboard/MatchesTab.tsx` owns the filters, sorting, loading state, empty state, unlocked jobs, and locked teaser rows
- selecting a job opens the existing details panel
- saving and dismissal already work from the list surface
- free vs pro behavior is already enforced through the existing plan-aware feed items

The main issue is visual, not functional.

The current screen feels heavier than necessary because it combines:

- a large boxed filter panel
- oversized card treatments for each job
- strong rounded corners and shadow on many surfaces
- weak separation between primary content and secondary metadata

This makes the layout feel less modern and less readable than it should.

## Design Summary

The redesign keeps the current behavior but changes the presentation model:

```text
Dashboard tab
-> compact matches header
-> compact filter/sort toolbar
-> minimal stacked job rows
-> optional locked rows for free users
-> existing details panel on row selection
```

Core outcomes:

1. the matches view reads like a clean feed instead of a stack of bulky cards
2. the title, company, metadata, score, and actions have a clearer hierarchy
3. filters remain easy to use but no longer dominate the screen
4. paywalled rows remain visible for free users but feel integrated into the list
5. all existing interactions and business rules stay intact

## Architecture

### 1. Ownership Boundaries

Keep the redesign local to the current UI boundary:

- `src/components/dashboard/MatchesTab.tsx` remains the main rendering owner
- `src/pages/Dashboard.tsx` may receive a small styling adjustment for the tab control
- no hook or service changes are required
- no prop contract changes are required

This keeps the redesign low risk and avoids unnecessary regressions in job generation, saving, or details behavior.

### 2. Screen Structure

The screen should use three clear zones:

1. a lightweight header
2. a compact toolbar
3. a stacked list feed

Recommended structure:

- header with `Your Daily Matches` and one muted supporting sentence
- inline toolbar with three compact filters and one sort control
- scrollable feed with full-width rows separated by subtle borders and spacing

The toolbar should feel like a control strip rather than a large content card.

### 3. Minimal List Row Model

Each unlocked job should render as a restrained list row rather than a large card.

Recommended row anatomy:

- left: title and company
- below left: metadata line for location, salary, date, and relocation if present
- right: match badge plus compact `Save` and dismiss actions

Layout goals:

- title is the strongest text on the row
- company is secondary but still easy to scan
- metadata uses quieter text and smaller visual weight
- actions remain visible without overpowering the content
- selected state uses a subtle border or ring rather than a raised-card effect

The row should still be fully clickable for opening job details, with action buttons preserving event stop behavior.

### 4. Toolbar Design

The existing three filters and sort control stay available at all times, but the container becomes lighter and more compact.

Recommended toolbar behavior:

- keep company, location, and salary filters visible
- keep the existing sort dropdown
- reduce padding and rounded treatment
- remove the oversized boxed appearance
- allow the row to wrap cleanly on smaller screens

The goal is easy access without visual bulk.

### 5. Visual Styling

The redesign should express modernity through restraint rather than decoration.

Recommended styling direction:

- thinner borders
- less shadow
- calmer backgrounds
- more whitespace between content groups
- smaller, cleaner badges
- more consistent alignment between copy and controls

Avoid:

- deep shadows
- oversized pill shapes
- large floating-card treatments
- decorative effects that compete with content readability

### 6. Locked Row Treatment

The existing free-tier locked teaser model remains intact, but the presentation should match the new list-based feed.

Recommended locked-row behavior:

- render locked items as muted list rows rather than heavy cards
- keep the lock message and `Upgrade to Pro` CTA
- keep the teaser copy visible
- keep the row clearly non-interactive as a real job

The locked section should feel like part of the feed, not a separate visual system.

### 7. Responsive Behavior

On wider screens:

- row content can remain horizontal with metadata under the title block
- score and actions can stay right-aligned

On narrower screens:

- toolbar controls wrap into multiple lines
- job row content stacks naturally
- actions move below or beside score as needed without crowding the title

The design should prioritize readability before preserving desktop alignment.

## Data Flow and Behavior

This redesign does not change the existing logic flow:

- filters still update via the same controlled props
- sorting still updates via `setSortBy`
- `selectedJob` still controls the details panel
- `saveJob()` still drives the save action
- `dismissJob()` still removes jobs
- free/pro feed behavior still comes from the existing `buildMatchFeedItems()` path

This is intentionally a presentation-only redesign.

## Error Handling and Edge States

The redesign keeps current states but updates their presentation so they feel consistent with the flatter visual language.

Required states:

- loading: keep the current centered loading state
- empty results: keep the current empty message with cleaner spacing
- selected row: keep current behavior with a lighter visual cue
- saving state: keep the inline save spinner and button disable state

No new error classes or retry flows are introduced.

## Testing

Testing should stay focused on protecting behavior rather than snapshotting styling.

Required verification:

- existing `MatchesTab` rendering tests continue to pass
- locked placeholders and upgrade CTA remain present for free users
- save and saved states still render correctly
- edited files are checked with diagnostics after implementation

Only add or update tests when visible text or structural output changes enough to break existing assertions.

## Success Criteria

The redesign is successful when:

- the Daily Matches screen feels lighter, clearer, and more modern
- filters stay easy to access in a compact row
- job rows are easier to scan quickly
- the screen keeps the current details-panel workflow and row actions
- paywalled rows still communicate upgrade value without visually overpowering the feed
- the implementation remains styling-focused and low risk
