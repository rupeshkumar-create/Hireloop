# Superadmin UI/UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the Superadmin panel so the `Edit`, `View`, `Ghost`, and `Delete` flows share a clean, consistent modal/action system and the broken edit modal no longer feels cramped or unstable.

**Architecture:** Keep the existing Superadmin data flow and API behavior unchanged. Refactor the local modal presentation in `src/pages/AdminDashboard.tsx` to match the stronger shell already used by `src/components/admin/GhostModeModal.tsx`, then tighten the action row styling so every user action reads as part of one admin system. Use one focused component test to protect the new action/button behavior and rely on manual modal verification for layout polish.

**Tech Stack:** React 19, TypeScript, Tailwind utility classes, existing `Button` component, Vitest

---

## File Map (Planned Changes)

**Modify**
- `src/pages/AdminDashboard.tsx`
  - Restyle `UserDetailModal`
  - Restyle `EditUserModal`
  - Restyle `DeleteConfirm`
  - Improve the row action button group
- `src/components/admin/GhostModeModal.tsx`
  - Nudge spacing/buttons only if needed so it matches the shared Superadmin modal family
- `src/components/dashboard/__tests__/MatchesTab.test.ts`
  - Use as a pattern reference only if needed for current test style

**Create**
- `src/pages/__tests__/AdminDashboard.test.tsx`
  - Focused rendering test for the action row / modal trigger styling contract

## Task 1: Add a Focused Admin Dashboard UI Test

**Files:**
- Create: `src/pages/__tests__/AdminDashboard.test.tsx`

- [ ] **Step 1: Write a focused test for action buttons and modal trigger labels**

Create `src/pages/__tests__/AdminDashboard.test.tsx`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AdminDashboard } from '../AdminDashboard';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    realUser: {
      uid: 'admin_1',
      email: 'rupesh7126@gmail.com',
      getIdToken: vi.fn().mockResolvedValue('token'),
    },
  }),
}));

vi.mock('../../firebase', () => ({
  db: {},
}));

vi.mock('../../services/adminGhostMode', () => ({
  runAdminGhostMode: vi.fn(),
}));

vi.mock('../../services/jobHarvester', () => ({
  harvestJobs: vi.fn(),
  buildSearchTerms: vi.fn(() => []),
}));

vi.mock('../../services/jobMatchingEngine', () => ({
  matchAndRankJobs: vi.fn(),
}));

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  text: async () =>
    JSON.stringify({
      users: [
        {
          id: 'user_1',
          email: 'person@example.com',
          displayName: 'Person',
          plan: 'free',
          createdAt: '2026-04-15T00:00:00.000Z',
          lastActiveAt: '2026-04-16T00:00:00.000Z',
          careerPaths: ['Product Operations'],
        },
      ],
    }),
}) as any;

describe('AdminDashboard', () => {
  it('renders the expected Superadmin action buttons for each user row', async () => {
    render(<AdminDashboard />);

    expect(await screen.findByText('person@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ghost' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('opens the edit modal when Edit is clicked', async () => {
    render(<AdminDashboard />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

    expect(await screen.findByText('Edit User')).toBeInTheDocument();
    expect(screen.getByDisplayValue('free')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the new test to verify the current UI contract**

Run:

```bash
npm test -- src/pages/__tests__/AdminDashboard.test.tsx
```

Expected: the test may fail initially if the current implementation does not yet expose a stable modal title or button structure.

- [ ] **Step 3: Commit**

```bash
git add src/pages/__tests__/AdminDashboard.test.tsx
git commit -m "test(admin): cover superadmin action row and edit modal"
```

## Task 2: Introduce a Shared Superadmin Modal Shell in AdminDashboard

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`

- [ ] **Step 1: Add local modal shell helpers near the current modal subcomponents**

At the top of the modal section in `src/pages/AdminDashboard.tsx`, add small helpers:

```tsx
function AdminModalFrame({
  children,
  onClose,
  maxWidth = 'max-w-2xl',
}: {
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-[28px] border border-border bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.12)]`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function AdminModalHeader({
  title,
  subtitle,
  aside,
  onClose,
}: {
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        {subtitle ? (
          <p className="mt-1 break-all text-sm text-foreground-muted">{subtitle}</p>
        ) : null}
        {aside ? <div className="mt-3">{aside}</div> : null}
      </div>
      <Button variant="ghost" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Run type-check after adding the shared shell**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AdminDashboard.tsx
git commit -m "refactor(admin): add shared superadmin modal shell"
```

## Task 3: Rebuild the Edit Modal Layout

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`

- [ ] **Step 1: Replace the current `EditUserModal` wrapper with the shared modal shell**

Update `EditUserModal` to use the new shared modal structure and a clearer one-column form:

```tsx
return (
  <AdminModalFrame onClose={onClose} maxWidth="max-w-xl">
    <AdminModalHeader
      title="Edit User"
      subtitle={user.email || 'Unknown user'}
      aside={<PlanBadge plan={plan} />}
      onClose={onClose}
    />

    <form onSubmit={handleSubmit} className="px-6 py-5">
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground-muted">Plan</label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as Plan)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
          >
            <option value="free">Free</option>
            <option value="pro">Pro</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground-muted">Job Type</label>
          <select
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
          >
            <option value="both">Both</option>
            <option value="remote">Remote</option>
            <option value="onsite">On-site</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground-muted">Location</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
            placeholder="e.g. New York, NY"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground-muted">Min Salary (USD)</label>
          <input
            type="number"
            value={minSalary}
            onChange={(e) => setMinSalary(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
            placeholder="e.g. 45000"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground-muted">Career Paths</label>
          <textarea
            value={careerPaths}
            onChange={(e) => setCareerPaths(e.target.value)}
            className="min-h-[110px] w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
            placeholder="Remote Customer Success Manager, Product Operations"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="action" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  </AdminModalFrame>
);
```

- [ ] **Step 2: Run the focused test**

Run:

```bash
npm test -- src/pages/__tests__/AdminDashboard.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AdminDashboard.tsx
git commit -m "fix(admin): rebuild superadmin edit modal layout"
```

## Task 4: Align Detail and Delete Modals with the Shared Shell

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`

- [ ] **Step 1: Update `UserDetailModal` to use the same shell**

Refactor `UserDetailModal` to use `AdminModalFrame` and `AdminModalHeader`:

```tsx
return (
  <AdminModalFrame onClose={onClose} maxWidth="max-w-3xl">
    <AdminModalHeader
      title="User Details"
      subtitle={user.email || 'No email found'}
      onClose={onClose}
    />

    <div className="space-y-4 px-6 py-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {fields.map(([label, val]) =>
          val != null && val !== '' ? (
            <div key={label} className="rounded-2xl border border-border bg-background/60 p-4">
              <p className="text-xs uppercase tracking-wider text-foreground-muted">{label}</p>
              <p className="mt-2 break-words text-sm text-foreground">{String(val)}</p>
            </div>
          ) : null
        )}
      </div>
    </div>
  </AdminModalFrame>
);
```

For `Resume`, keep the existing long-text handling by rendering the actual resume text block separately beneath the summary cards.

- [ ] **Step 2: Update `DeleteConfirm` to use the same shell family**

Change `DeleteConfirm` to:

```tsx
return (
  <AdminModalFrame onClose={onClose} maxWidth="max-w-md">
    <AdminModalHeader
      title="Delete User"
      subtitle={user.email || 'Unknown user'}
      onClose={onClose}
    />

    <div className="px-6 py-5">
      <p className="text-sm text-foreground-muted">
        This will permanently delete this user from Firebase Auth, Firestore, and tracked jobs.
        This action cannot be undone.
      </p>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete User'}
        </Button>
      </div>
    </div>
  </AdminModalFrame>
);
```

- [ ] **Step 3: Run type-check**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AdminDashboard.tsx
git commit -m "fix(admin): align detail and delete modal presentation"
```

## Task 5: Clean Up the Table Action Row

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`

- [ ] **Step 1: Replace plain text buttons with a compact wrapped action group**

Update the action cell from ad hoc text buttons to a grouped layout:

```tsx
<td className="px-4 py-3">
  <div className="flex flex-wrap items-center gap-2">
    <Button size="sm" variant="outline" onClick={() => handleViewDetail(u)}>
      View
    </Button>
    <Button size="sm" variant="outline" onClick={() => setEditUser(u)}>
      Edit
    </Button>
    <Button size="sm" variant="ghost" onClick={() => handleOpenGhost(u)}>
      Ghost
    </Button>
    <Button size="sm" variant="destructive" onClick={() => setDeleteUser(u)}>
      Delete
    </Button>
  </div>
</td>
```

If the current `Button` component does not support the exact variants above, map the actions to the nearest existing visual hierarchy already used in the codebase, keeping `Delete` clearly destructive and `Ghost` visually distinct from neutral actions.

- [ ] **Step 2: Re-run the focused test**

Run:

```bash
npm test -- src/pages/__tests__/AdminDashboard.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AdminDashboard.tsx src/pages/__tests__/AdminDashboard.test.tsx
git commit -m "fix(admin): polish superadmin action row hierarchy"
```

## Task 6: Optional Ghost Mode Spacing Alignment

**Files:**
- Modify: `src/components/admin/GhostModeModal.tsx`

- [ ] **Step 1: Compare the updated local admin modals to `GhostModeModal`**

If the page now looks inconsistent because `GhostModeModal` spacing is noticeably different, make only small alignment edits such as:

```tsx
className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-[28px] border border-border bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.12)]"
```

and ensure footer buttons follow the same ordering:

```tsx
<div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
  ...
</div>
```

Do not redesign the Ghost Mode result payload or field list in this task.

- [ ] **Step 2: Run type-check**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/GhostModeModal.tsx
git commit -m "style(admin): align ghost mode modal spacing"
```

## Task 7: Final Verification

**Files:**
- No new files required

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run final type-check**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Manual Superadmin verification**

Run the app:

```bash
npm run dev
```

Open the Superadmin page and verify:

- `Edit` modal header is readable and no longer cramped
- long email values do not break the header
- `Career Paths` input wraps cleanly inside the modal
- `View`, `Edit`, `Ghost`, and `Delete` look like one action system
- `Delete` is visually destructive
- `View`, `Edit`, and `Delete` close/open cleanly without layout jump
- `Ghost` still works and still matches the shared modal family

---

## Spec Coverage Self-Review

- Broken `Edit` display: covered by the dedicated modal rebuild in Task 3.
- Shared modal family across `View`, `Edit`, `Ghost`, and `Delete`: covered by Tasks 2, 4, and 6.
- Action row cleanup: covered by Task 5.
- Responsive and long-content handling: covered by Tasks 3, 4, and 7 manual verification.
