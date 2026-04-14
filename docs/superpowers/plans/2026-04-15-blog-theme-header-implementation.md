# Blog Redesign, Theme Toggle, And Header Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the blog, add shared light/dark mode with light as the default, remove `How it works` from the public header, fix sidebar text visibility, and commit/push the finished work.

**Architecture:** Add a root-level theme context that owns default-light initialization, persistence, and root `dark` class application, then surface that through one reusable toggle used by both the public and authenticated shells. After the shared shell work is stable, redesign the blog index and post templates as a higher-conversion editorial system while fixing the sidebar active-state contrast bug in the same shared UI pass.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Lucide React, Sonner

---

## File Structure

- **Theme infrastructure**
  - Create: `src/contexts/ThemeContext.tsx`
  - Create: `src/components/ui/theme-toggle.tsx`
  - Modify: `src/main.tsx`
  - Modify: `src/index.css`
- **Shared shells**
  - Modify: `src/App.tsx`
  - Modify: `src/components/WebsiteLayout.tsx`
  - Modify: `src/components/Sidebar.tsx`
- **Blog experience**
  - Modify: `src/pages/blog/BlogIndex.tsx`
  - Modify: `src/pages/blog/BlogPost.tsx`
- **Final verification and release**
  - Modify: `docs/superpowers/plans/2026-04-15-blog-theme-header-implementation.md`

### Task 1: Add Shared Theme State

**Files:**
- Create: `src/contexts/ThemeContext.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create a root theme context with light as the default**

```tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'hireschema-theme';

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY);
    const initialTheme: Theme = storedTheme === 'dark' ? 'dark' : 'light';
    setThemeState(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
```

- [ ] **Step 2: Wrap the app once in the theme provider**

```tsx
import { ThemeProvider } from './contexts/ThemeContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
```

- [ ] **Step 3: Verify the shared theme layer compiles**

Run: `npx tsc --noEmit`

Expected: PASS with no context or import errors.

- [ ] **Step 4: Commit the theme state layer**

```bash
git add src/contexts/ThemeContext.tsx src/main.tsx
git commit -m "feat(theme): add shared theme provider"
```

### Task 2: Add Theme Toggle And Dark-Mode Tokens

**Files:**
- Create: `src/components/ui/theme-toggle.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Create one reusable theme toggle component**

```tsx
import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from './button';
import { useTheme } from '../../contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-10 w-10 rounded-full border-border bg-surface text-foreground"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
```

- [ ] **Step 2: Strengthen dark-mode tokens and global transitions**

```css
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

.dark {
  --bg-color: #141413;
  --surface-color: #20201e;
  --surface-hover-color: #2b2b29;
  --text-color: #faf9f5;
  --text-muted: #c8c5bb;
  --border-color: #30302e;
  --border-strong-color: #4d4c48;
  --ring-color: #5a5955;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  transition: background-color 0.2s ease, color 0.2s ease;
}
```

- [ ] **Step 3: Verify that the toggle layer compiles cleanly**

Run: `npx tsc --noEmit`

Expected: PASS with no import or type errors.

- [ ] **Step 4: Commit the toggle and token work**

```bash
git add src/components/ui/theme-toggle.tsx src/index.css
git commit -m "feat(theme): add reusable theme toggle"
```

### Task 3: Update Shared Shells And Fix Sidebar Readability

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/WebsiteLayout.tsx`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Add a stable app-shell header area for the toggle**

```tsx
import { ThemeToggle } from './components/ui/theme-toggle';

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-[4.5rem] items-center justify-end border-b border-border bg-background/80 px-6 backdrop-blur-xl md:px-8">
          <ThemeToggle />
        </div>
        <main className="flex-1 overflow-y-auto bg-background px-6 py-8 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Remove `How it works` from the public header and add the toggle**

```tsx
import { ThemeToggle } from './ui/theme-toggle';

<div className="hidden items-center gap-8 text-sm font-medium text-foreground-muted md:flex">
  <Link to="/blog" className="transition-colors hover:text-foreground">Blog</Link>
</div>

<div className="flex items-center gap-3">
  <ThemeToggle />
  {user ? (
    <Link to="/dashboard">
      <Button variant="action" size="sm" className="px-5">Dashboard</Button>
    </Link>
  ) : (
    <>
      <Link to="/login" className="hidden text-sm font-medium text-foreground-muted transition-colors hover:text-foreground sm:block">
        Sign in
      </Link>
      <Link to="/login">
        <Button variant="action" size="sm" className="px-5">Get Started</Button>
      </Link>
    </>
  )}
</div>
```

- [ ] **Step 3: Fix the sidebar active-state contrast so labels never disappear**

```tsx
className={cn(
  "group flex items-center rounded-xl px-3 py-3 text-sm font-medium transition-colors",
  isActive
    ? "bg-foreground text-background shadow-[0_0_0_1px_var(--color-near-black)] dark:bg-surface-hover dark:text-foreground"
    : "text-foreground-muted hover:bg-surface-hover hover:text-foreground"
)}
```

```tsx
<Icon
  className={cn(
    "mr-3 h-4 w-4 shrink-0",
    isActive ? "text-background dark:text-foreground" : "text-foreground-muted group-hover:text-foreground"
  )}
/>
<span className="truncate">{item.name}</span>
```

- [ ] **Step 4: Verify shared shell behavior in both themes**

Run: `npm run build`

Expected: PASS with no shell layout or import failures.

- [ ] **Step 5: Commit the shell/header/sidebar work**

```bash
git add src/App.tsx src/components/WebsiteLayout.tsx src/components/Sidebar.tsx
git commit -m "feat(shell): add theme toggle and fix navigation contrast"
```

### Task 4: Redesign The Blog Index As A Higher-Conversion Content Hub

**Files:**
- Modify: `src/pages/blog/BlogIndex.tsx`

- [ ] **Step 1: Split the sorted posts into a featured post and supporting posts**

```tsx
const sortedPosts = [...blogPosts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
const [featuredPost, ...secondaryPosts] = sortedPosts;
```

- [ ] **Step 2: Replace the simple list layout with a stronger editorial hero and card grid**

```tsx
return (
  <div className="py-16 md:py-20">
    <div className="mx-auto max-w-6xl px-6">
      <section className="mb-14 rounded-[36px] border border-border bg-surface p-8 shadow-[0_8px_32px_rgba(0,0,0,0.05)] md:p-12">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted">
          Hireschema Journal
        </p>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
          <div>
            <h1 className="mb-5 text-5xl leading-[1.02] tracking-tight text-foreground md:text-6xl">
              Practical remote-job strategy, written for people who want better outcomes.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-foreground-muted">
              Tactics, sourcing ideas, and AI-driven workflows to help serious remote candidates find stronger roles faster.
            </p>
          </div>
          <div className="rounded-[28px] border border-border bg-background/80 p-6">
            <p className="mb-2 text-sm font-medium text-foreground">Get the full workflow</p>
            <p className="mb-5 text-sm leading-6 text-foreground-muted">
              Read the strategy, then put it into action with Hireschema's automated remote job workflow.
            </p>
            <Link to="/login" className="inline-flex items-center text-sm font-medium text-primary">
              Start free <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
```

- [ ] **Step 3: Add a featured-story block and a supporting article grid**

```tsx
<div className="mb-16 grid gap-8 lg:grid-cols-[1.35fr_0.65fr]">
  <Link
    to={`/blog/${featuredPost.slug}`}
    className="group rounded-[32px] border border-border bg-surface p-8 shadow-[0_8px_32px_rgba(0,0,0,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_48px_rgba(0,0,0,0.08)]"
  >
    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Featured article</p>
    <h2 className="mb-4 text-4xl leading-tight text-foreground">{featuredPost.title}</h2>
    <p className="mb-6 max-w-2xl leading-7 text-foreground-muted">{featuredPost.excerpt}</p>
    <div className="flex items-center gap-3 text-sm text-foreground-muted">
      <Calendar className="h-4 w-4" />
      {new Date(featuredPost.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    </div>
  </Link>

  <div className="space-y-4">
    {secondaryPosts.map((post) => (
      <Link
        key={post.slug}
        to={`/blog/${post.slug}`}
        className="block rounded-[28px] border border-border bg-surface p-6 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(0,0,0,0.07)]"
      >
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-foreground-muted">
          <Calendar className="h-3.5 w-3.5" />
          {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <h3 className="mb-2 text-2xl leading-tight text-foreground">{post.title}</h3>
        <p className="text-sm leading-6 text-foreground-muted">{post.excerpt}</p>
      </Link>
    ))}
  </div>
</div>
```

- [ ] **Step 4: Add a bottom conversion section that still feels editorial**

```tsx
<section className="rounded-[32px] border border-border bg-foreground px-8 py-10 text-surface shadow-[0_18px_48px_rgba(20,20,19,0.18)] md:px-12">
  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-surface/70">Turn reading into action</p>
  <h2 className="mb-4 text-4xl leading-tight">Use Hireschema to apply the playbook, not just read it.</h2>
  <p className="mb-6 max-w-2xl text-base leading-7 text-surface/78">
    Upload your resume, get curated remote matches, tailor assets faster, and keep the whole search organized in one system.
  </p>
  <Link to="/login" className="inline-flex items-center rounded-full bg-surface px-5 py-3 text-sm font-medium text-foreground">
    Start your free workflow <ArrowRight className="ml-2 h-4 w-4" />
  </Link>
</section>
```

- [ ] **Step 5: Verify the new blog hub builds**

Run: `npx tsc --noEmit`

Expected: PASS with no JSX or route import errors.

- [ ] **Step 6: Commit the blog index redesign**

```bash
git add src/pages/blog/BlogIndex.tsx
git commit -m "feat(blog): redesign blog index as conversion hub"
```

### Task 5: Redesign The Blog Post Template

**Files:**
- Modify: `src/pages/blog/BlogPost.tsx`

- [ ] **Step 1: Add stronger article hero framing and cleaner metadata**

```tsx
<div className="mx-auto max-w-5xl py-12 md:py-16">
  <div className="rounded-[36px] border border-border bg-surface p-8 shadow-[0_8px_32px_rgba(0,0,0,0.05)] md:p-12">
    <Link to="/blog" className="mb-10 inline-flex items-center text-sm text-foreground-muted transition-colors hover:text-foreground">
      <ArrowLeft className="mr-2 h-4 w-4" /> Back to Blog
    </Link>

    <header className="mb-12 border-b border-border pb-8">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Remote job strategy</p>
      <h1 className="mb-6 max-w-4xl text-4xl leading-tight tracking-tight text-foreground md:text-6xl">
        {post.title}
      </h1>
      <div className="flex flex-wrap items-center gap-5 text-sm text-foreground-muted">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" />
          {post.author}
        </div>
      </div>
    </header>
```

- [ ] **Step 2: Improve reading rhythm and constrain the article width**

```tsx
<article className="markdown-body mx-auto mb-16 max-w-3xl text-[1.04rem] leading-8 text-foreground md:text-[1.08rem]">
  <ReactMarkdown>{post.content}</ReactMarkdown>
</article>
```

- [ ] **Step 3: Replace the basic share section with a polished post-footer CTA stack**

```tsx
<div className="mx-auto max-w-3xl space-y-8">
  <div className="rounded-[28px] border border-border bg-background/80 p-6">
    <h3 className="mb-4 flex items-center gap-2 text-xl text-foreground">
      <Share2 className="h-5 w-5 text-primary" /> Share this article
    </h3>
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" className="gap-2" onClick={() => window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${shareUrl}&title=${shareTitle}&summary=${encodeURIComponent(post.excerpt)}`, '_blank')}>
        <Linkedin className="h-4 w-4" /> LinkedIn
      </Button>
      <Button variant="outline" className="gap-2" onClick={() => window.open(`https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}%0A%0A${encodeURIComponent(post.excerpt)}`, '_blank')}>
        <Twitter className="h-4 w-4" /> X (Twitter)
      </Button>
      <Button variant="outline" className="gap-2" onClick={() => window.open(`https://reddit.com/submit?url=${shareUrl}&title=${shareTitle}`, '_blank')}>
        <MessageCircle className="h-4 w-4" /> Reddit
      </Button>
      <Button variant="outline" className="gap-2" onClick={() => {
        navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
      }}>
        <LinkIcon className="h-4 w-4" /> Copy Link
      </Button>
    </div>
  </div>

  <div className="rounded-[30px] border border-border bg-foreground px-7 py-8 text-surface shadow-[0_18px_48px_rgba(20,20,19,0.18)]">
    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-surface/70">Ready to apply this?</p>
    <h3 className="mb-3 text-3xl leading-tight">Use Hireschema to turn this strategy into your actual workflow.</h3>
    <p className="mb-5 max-w-2xl text-sm leading-7 text-surface/78">
      Find better-fit remote roles, tailor outreach faster, and keep your search moving without losing momentum.
    </p>
    <Link to="/login" className="inline-flex items-center rounded-full bg-surface px-5 py-3 text-sm font-medium text-foreground">
      Start free <ArrowRight className="ml-2 h-4 w-4" />
    </Link>
  </div>
</div>
```

- [ ] **Step 4: Verify the article page builds**

Run: `npm run build`

Expected: PASS with no blog route or icon import failures.

- [ ] **Step 5: Commit the blog post redesign**

```bash
git add src/pages/blog/BlogPost.tsx
git commit -m "feat(blog): modernize blog article template"
```

### Task 6: Final QA, Commit Everything, And Push

**Files:**
- Modify: `src/contexts/ThemeContext.tsx`
- Modify: `src/components/ui/theme-toggle.tsx`
- Modify: `src/index.css`
- Modify: `src/App.tsx`
- Modify: `src/components/WebsiteLayout.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/pages/blog/BlogIndex.tsx`
- Modify: `src/pages/blog/BlogPost.tsx`

- [ ] **Step 1: Run the final verification suite**

Run: `npx tsc --noEmit && npm run build`

Expected: both commands PASS.

- [ ] **Step 2: Smoke-test the core routes in both themes**

```txt
/
/blog
/blog/<existing-slug>
/login
/dashboard
```

Expected:
- light mode loads by default
- dark mode persists after refresh
- `How it works` is gone from the public header
- the theme toggle appears in both shell contexts
- the sidebar active text stays readable
- the new blog layout feels more modern and conversion-oriented

- [ ] **Step 3: Commit all remaining local changes**

```bash
git add src docs/superpowers/specs docs/superpowers/plans
git commit -m "feat: add theme toggle and modernize blog experience"
```

- [ ] **Step 4: Push to the configured remote**

Run: `git push origin main`

Expected: PASS if local GitHub credentials and remote access are already configured. If push fails due to auth or remote policy, stop there and report the exact error instead of retrying destructive commands.
