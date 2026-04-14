# Multi-Page Blog Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a `/blog` section in the app to support content marketing and SEO, allowing the user to publish articles about remote work and AI sourcing.

**Architecture:** 
1. **Data Store:** Create `src/data/blogPosts.ts` to hold the markdown content, slugs, and metadata for the blog posts.
2. **Blog Index Page:** Create `src/pages/blog/BlogIndex.tsx` to list all available articles.
3. **Blog Post Page:** Create `src/pages/blog/BlogPost.tsx` to read the `:slug` from the URL, find the matching markdown, and render it using `ReactMarkdown`.
4. **Routing:** Update `App.tsx` to include the new `/blog` and `/blog/:slug` routes.
5. **Navigation:** Update the landing page header to include a "Blog" link.

**Tech Stack:** React, React Router, ReactMarkdown, Tailwind.

---

### Task 1: Create the Blog Data Store

**Files:**
- Create: `src/data/blogPosts.ts`

- [ ] **Step 1: Define the `BlogPost` interface and mock data**
```typescript
export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  author: string;
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'how-to-find-hidden-remote-jobs-2026',
    title: 'How to Find Hidden Remote Jobs in 2026',
    excerpt: 'The landscape of remote work has changed. Here is how to bypass the noise of generic job boards and find the roles companies actually want to fill.',
    date: '2026-04-14',
    author: 'Hireschema Team',
    content: `
# How to Find Hidden Remote Jobs in 2026

The remote job market has never been more competitive. With thousands of applicants spamming the "Easy Apply" button on LinkedIn and Indeed, standing out is nearly impossible.

## The Problem with Job Boards
Most generic job boards are filled with "ghost jobs"—postings that companies leave up to collect resumes, but have no intention of hiring for right now. 

## The Solution: Direct ATS Sourcing
Instead of searching on job boards, you need to search the Applicant Tracking Systems (ATS) directly. Companies use platforms like Greenhouse, Lever, and Workable to manage their actual, active hiring pipelines.

By using advanced Boolean search strings on Google (like \`site:greenhouse.io\`), you can completely bypass the job board aggregators and find the raw, active listings.

## Enter Hireschema
At Hireschema, our AI Agent does this automatically. It reads your resume, extracts your core competencies, and scours the internet for the exact ATS listings that match your profile.
    `
  }
];
```

### Task 2: Create the Blog Index Page

**Files:**
- Create: `src/pages/blog/BlogIndex.tsx`

- [ ] **Step 1: Write the `BlogIndex` component**
```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { blogPosts } from '../../data/blogPosts';
import { ArrowRight, Calendar } from 'lucide-react';

export function BlogIndex() {
  return (
    <div className="min-h-screen bg-zinc-50 pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-6">
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 mb-4 font-display">
            The Hireschema Blog
          </h1>
          <p className="text-xl text-zinc-500">
            Insights, strategies, and guides on landing the best remote jobs.
          </p>
        </div>

        <div className="grid gap-8">
          {blogPosts.map((post) => (
            <Link 
              key={post.slug} 
              to={`/blog/${post.slug}`}
              className="block bg-white border border-zinc-200 p-8 hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              <div className="flex items-center text-sm text-zinc-500 mb-3 gap-2">
                <Calendar className="w-4 h-4" />
                {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 mb-3 font-display">
                {post.title}
              </h2>
              <p className="text-zinc-600 mb-6 leading-relaxed">
                {post.excerpt}
              </p>
              <div className="text-orange-500 font-medium flex items-center">
                Read article <ArrowRight className="ml-2 w-4 h-4" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Task 3: Create the Blog Post Page

**Files:**
- Create: `src/pages/blog/BlogPost.tsx`

- [ ] **Step 1: Write the `BlogPost` component**
```tsx
import React, { useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { blogPosts } from '../../data/blogPosts';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Calendar, User } from 'lucide-react';

export function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = blogPosts.find(p => p.slug === slug);

  // Scroll to top on load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!post) {
    return <Navigate to="/blog" />;
  }

  return (
    <div className="min-h-screen bg-white pt-24 pb-12">
      <div className="max-w-3xl mx-auto px-6">
        <Link to="/blog" className="inline-flex items-center text-zinc-500 hover:text-zinc-900 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Blog
        </Link>
        
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 mb-6 font-display leading-tight">
            {post.title}
          </h1>
          <div className="flex items-center gap-6 text-sm text-zinc-500 border-y border-zinc-100 py-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {post.author}
            </div>
          </div>
        </header>

        <article className="prose prose-zinc lg:prose-lg max-w-none markdown-body text-zinc-800 leading-relaxed">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
```

### Task 4: Integrate Routing and Navigation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/LandingPage.tsx`

- [ ] **Step 1: Update `App.tsx`**
Import the components and add the routes under `AppLayout`.
```tsx
import { BlogIndex } from './pages/blog/BlogIndex';
import { BlogPost } from './pages/blog/BlogPost';

// Inside the Routes block:
          <Route path="/blog" element={
            <AppLayout>
              <BlogIndex />
            </AppLayout>
          } />
          <Route path="/blog/:slug" element={
            <AppLayout>
              <BlogPost />
            </AppLayout>
          } />
```

- [ ] **Step 2: Update Header in `LandingPage.tsx`**
Add a link to the blog in the top navigation bar.
```tsx
// Inside LandingPage.tsx, around the navigation links:
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-500">
            <a href="#agent-workflow" className="hover:text-zinc-900 transition-colors">How it works</a>
            <Link to="/blog" className="hover:text-zinc-900 transition-colors">Blog</Link>
          </div>
```
