# Claude Design System Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Claude-inspired design system across the full Hireschema website and app while preserving existing product behavior.

**Architecture:** Use `npx getdesign@latest add claude` to seed the design foundation, then consolidate the generated output into the existing token and primitive layer instead of keeping a second parallel UI system. Roll out the new system from shared styles to shared shells to route-level surfaces so the most reusable changes land first and dashboard risk stays contained.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Firebase Auth, Firestore, Lucide React, Framer Motion

---

## File Structure

- **Shared foundation**
  - Modify: `package.json`
  - Modify: `package-lock.json`
  - Modify: `src/index.css`
- **Shared UI primitives**
  - Modify: `src/components/ui/button.tsx`
  - Modify: `src/components/ui/card.tsx`
  - Modify: `src/components/ui/input.tsx`
  - Modify: `src/components/ui/textarea.tsx`
  - Modify: `src/components/ui/badge.tsx`
  - Create: `src/components/ui/page-shell.tsx`
- **Shared shells**
  - Modify: `src/App.tsx`
  - Modify: `src/components/WebsiteLayout.tsx`
  - Modify: `src/components/Sidebar.tsx`
- **Public pages**
  - Modify: `src/pages/LandingPage.tsx`
  - Modify: `src/pages/blog/BlogIndex.tsx`
  - Modify: `src/pages/blog/BlogPost.tsx`
  - Modify: `src/pages/PrivacyPolicy.tsx`
  - Modify: `src/pages/TermsOfService.tsx`
- **Auth and onboarding**
  - Modify: `src/pages/Login.tsx`
  - Modify: `src/pages/Onboarding.tsx`
- **Product pages**
  - Modify: `src/pages/Dashboard.tsx`
  - Modify: `src/components/dashboard/OverviewTab.tsx`
  - Modify: `src/components/dashboard/MatchesTab.tsx`
  - Modify: `src/components/dashboard/JobDetailsPanel.tsx`
  - Modify: `src/pages/JobTracker.tsx`
  - Modify: `src/pages/Settings.tsx`
  - Modify: `src/pages/AdminDashboard.tsx`

### Task 1: Seed And Consolidate The Design Foundation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/index.css`

- [ ] **Step 1: Run the Claude design generator**

```bash
npx getdesign@latest add claude
```

Expected: the command completes without errors and updates the local UI foundation or dependencies.

- [ ] **Step 2: Inspect the generated diff before editing manually**

```bash
git diff -- package.json package-lock.json src/index.css src/components/ui
```

Expected: the diff shows what the generator changed so the next edits can merge it into the existing system instead of duplicating it.

- [ ] **Step 3: Consolidate `src/index.css` into one token source of truth**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=EB+Garamond:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "EB Garamond", Georgia, serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;

  --color-parchment: #f5f4ed;
  --color-ivory: #faf9f5;
  --color-near-black: #141413;
  --color-terracotta: #c96442;
  --color-warm-sand: #e8e6dc;
  --color-olive-gray: #5e5d59;
  --color-stone-gray: #87867f;
  --color-border-cream: #f0eee6;

  --color-background: var(--bg-color);
  --color-surface: var(--surface-color);
  --color-surface-hover: var(--surface-hover-color);
  --color-foreground: var(--text-color);
  --color-foreground-muted: var(--text-muted);
  --color-border: var(--border-color);
  --color-border-strong: var(--border-strong-color);
  --color-ring: var(--ring-color);
  --color-primary: var(--color-terracotta);
  --color-primary-foreground: var(--color-ivory);
}

:root {
  --bg-color: var(--color-parchment);
  --surface-color: var(--color-ivory);
  --surface-hover-color: var(--color-warm-sand);
  --text-color: var(--color-near-black);
  --text-muted: var(--color-olive-gray);
  --border-color: var(--color-border-cream);
  --border-strong-color: var(--color-warm-sand);
  --ring-color: #d1cfc5;
}

body {
  font-family: var(--font-sans);
  background-color: var(--color-background);
  color: var(--color-foreground);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display);
}
```

- [ ] **Step 4: Preserve markdown readability for blog and AI content**

```css
.markdown-body {
  font-family: var(--font-sans);
  color: var(--color-foreground);
  line-height: 1.7;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3 {
  font-family: var(--font-display);
  color: var(--color-foreground);
}
```

- [ ] **Step 5: Verify the foundation state before moving on**

```bash
npx tsc --noEmit
```

Expected: PASS with no new type errors introduced by the generator merge.

- [ ] **Step 6: Commit the foundation**

```bash
git add package.json package-lock.json src/index.css
git commit -m "feat(ui): add claude design foundation"
```

### Task 2: Upgrade Shared UI Primitives

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/textarea.tsx`
- Modify: `src/components/ui/badge.tsx`
- Create: `src/components/ui/page-shell.tsx`

- [ ] **Step 1: Update the button variants to match the warm Claude system**

```tsx
const buttonVariants = {
  default: "bg-foreground text-surface shadow-[0_0_0_1px_var(--color-near-black)] hover:opacity-95",
  action: "bg-primary text-primary-foreground shadow-[0_0_0_1px_var(--color-terracotta)] hover:brightness-95",
  secondary: "bg-surface-hover text-foreground shadow-[0_0_0_1px_var(--color-ring)] hover:bg-border",
  outline: "border border-border bg-surface text-foreground hover:bg-surface-hover",
  ghost: "text-foreground-muted hover:bg-surface-hover hover:text-foreground",
  destructive: "bg-red-700 text-surface hover:bg-red-800",
};
```

- [ ] **Step 2: Make cards use softer borders, warmer surfaces, and gentler rounding**

```tsx
<div
  ref={ref}
  className={cn(
    "rounded-2xl border border-border bg-surface text-foreground shadow-[0_4px_24px_rgba(0,0,0,0.04)]",
    className
  )}
  {...props}
/>
```

- [ ] **Step 3: Align inputs and textareas with the shared focus and radius rules**

```tsx
className={cn(
  "flex h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3898ec] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  className
)}
```

- [ ] **Step 4: Make badges support product-safe Claude variants**

```tsx
{
  "border-transparent bg-foreground text-surface": variant === "default",
  "border-transparent bg-surface-hover text-foreground": variant === "secondary",
  "border-border bg-surface text-foreground": variant === "outline",
  "border-transparent bg-orange-100 text-orange-900": variant === "success",
}
```

- [ ] **Step 5: Create a shared page shell helper for consistent headers and widths**

```tsx
import React from 'react';
import { cn } from '@/lib/utils';

export function PageShell({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl space-y-8", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl text-foreground">{title}</h1>
          {description ? <p className="mt-2 text-foreground-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 6: Verify the shared UI layer**

```bash
npx tsc --noEmit
```

Expected: PASS after the primitive API updates.

- [ ] **Step 7: Commit the shared components**

```bash
git add src/components/ui/button.tsx src/components/ui/card.tsx src/components/ui/input.tsx src/components/ui/textarea.tsx src/components/ui/badge.tsx src/components/ui/page-shell.tsx
git commit -m "feat(ui): refresh shared claude primitives"
```

### Task 3: Unify Application Shells

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/WebsiteLayout.tsx`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Update `AppLayout` so product pages inherit a warmer app frame**

```tsx
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background px-6 py-8 md:px-8">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Restyle `WebsiteLayout` navigation and footer with the new editorial system**

```tsx
<nav className="fixed top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-xl">
  <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6">
    <span className="text-xl text-foreground">Hireschema</span>
    <Button variant="action" size="sm">Get Started</Button>
  </div>
</nav>
```

- [ ] **Step 3: Refactor `Sidebar` active states and profile/footer blocks to use the shared button and badge language**

```tsx
className={cn(
  "flex items-center rounded-xl px-3 py-2.5 text-sm transition-colors",
  isActive
    ? "bg-foreground text-surface shadow-[0_0_0_1px_var(--color-near-black)]"
    : "text-foreground-muted hover:bg-surface-hover hover:text-foreground"
)}
```

- [ ] **Step 4: Keep all existing routes and auth guards intact**

```tsx
<Route path="/dashboard" element={
  <PrivateRoute>
    <AppLayout>
      <Dashboard />
    </AppLayout>
  </PrivateRoute>
} />
```

- [ ] **Step 5: Run a build after the shell changes**

```bash
npm run build
```

Expected: PASS with no routing or import errors.

- [ ] **Step 6: Commit the shell updates**

```bash
git add src/App.tsx src/components/WebsiteLayout.tsx src/components/Sidebar.tsx
git commit -m "feat(ui): unify website and app shells"
```

### Task 4: Restyle Public Website Routes

**Files:**
- Modify: `src/pages/LandingPage.tsx`
- Modify: `src/pages/blog/BlogIndex.tsx`
- Modify: `src/pages/blog/BlogPost.tsx`
- Modify: `src/pages/PrivacyPolicy.tsx`
- Modify: `src/pages/TermsOfService.tsx`

- [ ] **Step 1: Rework the landing page hero away from hard-edged utility styling**

```tsx
<section className="relative overflow-hidden px-6 py-24 md:py-32">
  <div className="mx-auto max-w-6xl text-center">
    <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-xs uppercase tracking-[0.18em] text-foreground-muted">
      <Globe className="h-3.5 w-3.5" />
      Remote Jobs Only
    </div>
    <h1 className="text-5xl leading-tight text-foreground md:text-7xl">
      Your AI agent for remote job hunting.
    </h1>
    <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-foreground-muted">
      Built exclusively for remote job seekers. Upload your resume and let the agent find, filter, and prepare opportunities worldwide.
    </p>
  </div>
</section>
```

- [ ] **Step 2: Replace remaining blog and legal hard-coded zinc/white colors with shared tokens**

```tsx
className="rounded-[28px] border border-border bg-surface p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.06)]"
```

- [ ] **Step 3: Keep blog markdown content readable while using the new type ramp**

```tsx
<article className="markdown-body max-w-none text-[1.02rem] leading-8 text-foreground">
  <ReactMarkdown>{post.content}</ReactMarkdown>
</article>
```

- [ ] **Step 4: Keep legal pages simple but visually aligned**

```tsx
<div className="mx-auto max-w-4xl py-12">
  <div className="rounded-[28px] border border-border bg-surface p-8 md:p-12">
    <h1>Privacy Policy</h1>
  </div>
</div>
```

- [ ] **Step 5: Verify the marketing routes manually**

```bash
npm run dev
```

Expected: `/`, `/blog`, `/blog/:slug`, `/privacy`, and `/terms` all render with the same Claude-inspired palette and typography.

- [ ] **Step 6: Commit the public pages**

```bash
git add src/pages/LandingPage.tsx src/pages/blog/BlogIndex.tsx src/pages/blog/BlogPost.tsx src/pages/PrivacyPolicy.tsx src/pages/TermsOfService.tsx
git commit -m "feat(site): restyle public pages with claude system"
```

### Task 5: Restyle Login And Onboarding

**Files:**
- Modify: `src/pages/Login.tsx`
- Modify: `src/pages/Onboarding.tsx`

- [ ] **Step 1: Turn the login screen into a branded editorial auth surface**

```tsx
<div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
  <div className="w-full max-w-md rounded-[28px] border border-border bg-surface p-10 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
    <h2 className="text-4xl text-foreground">Hireschema</h2>
    <p className="mt-3 text-foreground-muted">
      Sign in to continue your remote job search.
    </p>
  </div>
</div>
```

- [ ] **Step 2: Wrap onboarding in the shared page shell and reduce one-off classes**

```tsx
<PageShell
  title="Welcome to Hireschema"
  description="Upload your current resume and we’ll configure your AI recruiting agent around your experience."
  className="max-w-3xl"
>
  <div className="rounded-[28px] border border-border bg-surface p-2 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
    <ResumeUploader
      updateProfile={updateProfile}
      profile={profile}
      onSuccess={() => navigate('/dashboard')}
    />
  </div>
</PageShell>
```

- [ ] **Step 3: Verify auth flow behavior remains unchanged**

```bash
npx tsc --noEmit
```

Expected: PASS, and manual login still redirects authenticated users to `/dashboard`.

- [ ] **Step 4: Commit the auth surfaces**

```bash
git add src/pages/Login.tsx src/pages/Onboarding.tsx
git commit -m "feat(auth): align login and onboarding with claude styling"
```

### Task 6: Restyle Dashboard And Job Match Surfaces

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/components/dashboard/OverviewTab.tsx`
- Modify: `src/components/dashboard/MatchesTab.tsx`
- Modify: `src/components/dashboard/JobDetailsPanel.tsx`

- [ ] **Step 1: Replace repeated dashboard header markup with `PageShell`**

```tsx
<PageShell
  title="Dashboard"
  description={`Welcome back, ${user?.displayName?.split(' ')[0] || 'Candidate'}. Here are your latest remote matches.`}
  actions={isRefreshAvailable() ? (
    <Button variant="secondary" onClick={() => fetchJobs(true)} disabled={loadingJobs}>
      <RefreshCw className={`mr-2 h-4 w-4 ${loadingJobs ? 'animate-spin' : ''}`} />
      {loadingJobs ? 'Scanning...' : 'Refresh Matches'}
    </Button>
  ) : null}
>
```

- [ ] **Step 2: Normalize overview cards and empty states around the updated `Card` system**

```tsx
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm text-foreground-muted">Saved Jobs</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-3xl text-foreground">{stats.saved}</div>
  </CardContent>
</Card>
```

- [ ] **Step 3: Restyle the match filters and list cards without changing their data flow**

```tsx
<div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
  <Input
    placeholder="Filter by company..."
    value={filterCompany}
    onChange={(e) => setFilterCompany(e.target.value)}
  />
  <Input
    placeholder="Filter by location..."
    value={filterLocation}
    onChange={(e) => setFilterLocation(e.target.value)}
  />
  <Input
    placeholder="Filter by salary..."
    value={filterSalary}
    onChange={(e) => setFilterSalary(e.target.value)}
  />
</div>
```

```tsx
<Card
  className={cn(
    "cursor-pointer transition-all hover:border-border-strong",
    selectedJob === job ? "border-border-strong ring-1 ring-ring" : ""
  )}
>
```

- [ ] **Step 4: Keep the job details modal premium-looking but product-dense**

```tsx
className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[32px] border border-border bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.12)]"
```

- [ ] **Step 5: Verify the dashboard surfaces**

```bash
npm run build
```

Expected: PASS, and manual checks confirm tab switching, modal opening, AI actions, and job refresh still work.

- [ ] **Step 6: Commit the dashboard refresh**

```bash
git add src/pages/Dashboard.tsx src/components/dashboard/OverviewTab.tsx src/components/dashboard/MatchesTab.tsx src/components/dashboard/JobDetailsPanel.tsx
git commit -m "feat(dashboard): restyle dashboard match experience"
```

### Task 7: Restyle Tracker, Settings, And Admin Pages

**Files:**
- Modify: `src/pages/JobTracker.tsx`
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/AdminDashboard.tsx`

- [ ] **Step 1: Apply the shared page shell and card language to `JobTracker`**

```tsx
<PageShell
  title="Job Tracker"
  description="Manage and track your job applications."
  actions={
    <div className="flex rounded-xl border border-border bg-surface-hover p-1">
      <Button
        variant={viewMode === 'board' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setViewMode('board')}
      >
        <LayoutGrid className="mr-2 h-4 w-4" />
        Board
      </Button>
      <Button
        variant={viewMode === 'list' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setViewMode('list')}
      >
        <List className="mr-2 h-4 w-4" />
        History List
      </Button>
    </div>
  }
>
```

- [ ] **Step 2: Replace remaining orange-only ad hoc controls in `Settings` with design-system variants**

```tsx
<div className="rounded-2xl border border-border bg-background p-4">
  <p className="font-semibold text-foreground">
    Current Plan: <span className="text-primary uppercase">{profile?.plan || 'Free'}</span>
  </p>
</div>
```

- [ ] **Step 3: Make the admin table and modal match the product system without touching admin logic**

```tsx
<div className="overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
  <table className="w-full text-sm text-left">
```

```tsx
<motion.div className="w-full max-w-md rounded-[28px] border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(0,0,0,0.12)]">
```

- [ ] **Step 4: Verify product pages that changed behavior-adjacent UI**

```bash
npx tsc --noEmit && npm run build
```

Expected: PASS for both commands.

- [ ] **Step 5: Commit the remaining product surfaces**

```bash
git add src/pages/JobTracker.tsx src/pages/Settings.tsx src/pages/AdminDashboard.tsx
git commit -m "feat(app): align remaining product pages with claude system"
```

### Task 8: Final QA And Cleanup

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/WebsiteLayout.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/pages/LandingPage.tsx`
- Modify: `src/pages/Login.tsx`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/JobTracker.tsx`
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/AdminDashboard.tsx`

- [ ] **Step 1: Search for leftover hard-coded legacy colors that should now use shared tokens**

```bash
rg "zinc-|orange-5|bg-white|text-white|rounded-none" src
```

Expected: only intentional exceptions remain.

- [ ] **Step 2: Run the final verification suite**

```bash
npx tsc --noEmit
npm run build
```

Expected: both commands PASS.

- [ ] **Step 3: Smoke-test the highest-risk routes**

```txt
/ 
/blog
/blog/<existing-slug>
/login
/dashboard
/tracker
/settings
/kingdomofkumar
```

Expected: shared typography, colors, spacing, buttons, cards, and shells feel coherent across public and authenticated routes.

- [ ] **Step 4: Commit the cleanup pass**

```bash
git add src
git commit -m "refactor(ui): clean up claude design system rollout"
```
