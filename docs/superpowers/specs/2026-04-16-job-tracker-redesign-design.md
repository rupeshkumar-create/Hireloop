# Job Tracker Redesign Design

**Goal:** Redesign the user `Job Tracker` page so it feels clear, modern, and responsive instead of visually stuck, while preserving the current tracking workflow, status updates, and AI asset actions.

**Scope:** This change covers the overall `Job Tracker` page shell, the board view, the history list view, and the expanded AI asset area inside `src/pages/JobTracker.tsx`. It does not change Firestore data shape, AI generation logic, billing rules, or the existing modals and actions.

## Current Context

The current `Job Tracker` page already supports the core workflow:

- loading tracked jobs from Firestore
- switching between `board` and `list` views
- updating application status
- opening the original job link
- deleting a tracked job
- generating and editing AI assets for pro users

Functionally, the page is capable.

The main problem is that the UI feels rigid and heavy:

- the board uses five equally rigid columns with large fixed-height lanes
- empty space dominates the view and makes the screen feel frozen
- the header controls feel boxed and visually separate from the main content
- the list view is dense and serviceable, but not especially clear or modern
- the expanded AI asset area is powerful but visually heavy and harder to scan than it should be

This creates a product impression that the tracker is busy yet static, rather than active and easy to use.

## Design Summary

The redesign keeps the existing behavior but restructures the screen into a more modern tracker layout:

```text
Page shell
-> compact summary strip
-> flatter controls row
-> board or list main view
-> refined AI asset detail sections
```

Core outcomes:

1. the page feels alive immediately through a visible summary layer
2. the board no longer feels like a stuck five-column wall
3. the history list becomes easier to scan and expand
4. AI asset sections feel structured instead of crowded
5. the redesign remains UI-focused and low risk

## Architecture

### 1. Ownership Boundaries

Keep the redesign centered in the existing page boundary:

- `src/pages/JobTracker.tsx` remains the main owner of layout and interaction
- existing modals such as `AssetEditorModal` and `ResumePreviewModal` continue unchanged
- Firestore reads, writes, and status transitions remain unchanged
- AI generation and learning-signal behavior remain unchanged

Small presentational helpers may be extracted only if they make the page easier to understand, but broad refactoring is out of scope.

### 2. Page Structure

The redesigned page should have four clear layers:

1. page header
2. summary strip
3. control bar
4. main tracker surface

Recommended structure:

- `Job Tracker` title and supporting description remain in `PageShell`
- a summary strip sits directly below the header and shows counts for `Saved`, `Applied`, `Interviewing`, `Offered`, and `Rejected`
- a flatter control bar contains the view switcher and `Backfill Missing AI Assets` action
- the main surface renders either the board view or the history list

This gives the page a stronger top-down hierarchy and makes it feel purposeful before the user interacts.

### 3. Summary Strip

The summary strip should be compact and calm, not oversized dashboard chrome.

Recommended behavior:

- render five lightweight summary tiles or pills, one per status
- show status label and count clearly
- keep styling flatter than the current large tracker lanes
- use the strip as orientation, not as a second dashboard

This gives users immediate signal without adding visual noise.

### 4. Control Bar

The current board/list toggle should remain, but it should feel lighter and more integrated with the page.

Recommended control bar:

- flatter view switcher
- better spacing and wrapping on smaller screens
- optional supportive metadata such as total tracked jobs if it fits cleanly
- `Backfill Missing AI Assets` remains visible for pro users but should not dominate the page

The controls should read like a toolbar, not a floating widget.

### 5. Board View

The board view should remain available because it is a good mental model for application stages, but it needs a more flexible and modern layout.

Recommended board behavior:

- keep the five statuses as separate lanes
- reduce the visual weight of each lane
- improve lane header clarity with cleaner count badges
- reduce the sense of trapped height by using more responsive lane sizing
- make empty lanes feel intentional through compact empty states instead of blank walls

Recommended visual model:

- lane headers are tight and readable
- cards are smaller, lighter, and easier to scan
- spacing inside lanes is consistent
- shadows are reduced
- borders and typography carry the hierarchy

The board should feel like a working tracker, not like a static kanban template.

### 6. Board Card Model

Each board card should prioritize the most important job information:

- title
- company
- location
- current status/action affordance

Recommended card anatomy:

- title first
- company second
- lightweight metadata chip or inline row for location
- compact bottom row for status select and actions

The current actions should remain:

- status change
- open original job
- delete job

The redesign should make these actions more legible without increasing bulk.

### 7. History List View

The list view should become the more detailed, editorial view of the same tracked data.

Recommended behavior:

- keep one-row-per-job collapsed summaries
- tighten the top row so title, company, status, age, and actions align more clearly
- use better whitespace and separators to improve scanning
- keep expandable details as the place for AI asset work

The list should feel cleaner and more premium than the current utilitarian row layout.

### 8. Expanded AI Asset Area

The expanded section is valuable, but currently reads as a long heavy block of nested surfaces.

Recommended redesign:

- keep the three existing sections: `Cold Email`, `Tailored Resume`, `Interview Q&A`
- make section headers more consistent
- make content panels calmer and easier to parse
- make generate/edit actions easier to find
- make locked-pro treatment more integrated and less visually noisy

Important rule:

- preserve the current generate, edit, preview, download, Gmail send, and auto-find-email actions

This section should feel like a structured workspace rather than a dense stack of independent boxes.

### 9. Responsive Behavior

The page should adapt more gracefully across screen sizes.

On wider screens:

- summary strip can render in one row
- board lanes can remain visible together with improved spacing
- list rows can align metadata and actions cleanly

On narrower screens:

- summary strip wraps
- controls wrap without crowding
- board lanes should stack or scroll in a way that still feels intentional
- list row layout should collapse into clearer vertical groupings

The redesign should prioritize usability before preserving desktop symmetry.

## Data Flow And Behavior

This redesign does not change the underlying workflow:

- tracked jobs still load from Firestore
- status updates still call `updateStatus()`
- deletion still calls `removeJob()`
- outbound job links still use `openTrackedJobLink()`
- AI asset generation and editing still use the existing handlers
- pro gating still follows the current plan checks

This is a presentation-focused redesign, not a product-logic rewrite.

## Error Handling And Edge States

The page should keep current behavior while improving presentation for edge states.

Required states:

- no tracked jobs
- empty lane inside board view
- loading state for AI actions
- no generated content for individual asset sections
- pro-locked asset sections

Each of these should feel deliberate and readable rather than like leftover placeholder space.

## Testing

Testing should stay practical and focused:

- verify the page still renders tracked jobs in both views
- verify core actions remain reachable
- verify expanded asset sections still render correctly
- run diagnostics on edited files after implementation

Only add tests if they meaningfully protect the redesigned structure or preserved behavior.

## Success Criteria

The redesign is successful when:

- the Job Tracker no longer feels visually stuck or cramped
- the page has a clear hierarchy from summary to controls to content
- board lanes feel lighter and more usable
- the history list is easier to scan
- the AI asset workspace feels organized and modern
- all existing job-tracking and AI workflows continue to work without logic changes
