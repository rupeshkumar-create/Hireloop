import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Briefcase } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggle } from './ui/theme-toggle';

export function WebsiteLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background font-sans text-foreground">
      <nav className="fixed top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground shadow-[0_0_0_1px_var(--color-near-black)]">
              <Briefcase className="h-4 w-4 text-surface" />
            </div>
            <div>
              <span className="font-display text-2xl leading-none tracking-tight">Hireschema</span>
              <p className="mt-0.5 hidden text-[11px] uppercase tracking-[0.16em] text-foreground-muted md:block">
                Remote Job Agent
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/blog" className="hidden text-sm font-medium text-foreground-muted transition-colors hover:text-foreground sm:block">
              Blog
            </Link>
            <ThemeToggle isCollapsed={true} />
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
        </div>
      </nav>

      <main className="flex-1 pt-[4.5rem]">
        {children}
      </main>

      <footer className="mt-auto border-t border-border bg-surface/40 py-14">
        <div className="mx-auto mb-12 grid max-w-7xl grid-cols-2 gap-8 px-6 md:grid-cols-4">
          <div className="col-span-2">
            <Link to="/" className="mb-4 inline-flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-foreground">
                <Briefcase className="h-3 w-3 text-surface" />
              </div>
              <span className="font-display text-2xl tracking-tight">Hireschema</span>
            </Link>
            <p className="max-w-sm text-sm leading-6 text-foreground-muted">
              The AI-powered platform exclusively for remote job seekers. Find, track, and land remote roles from anywhere in the world.
            </p>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-foreground-muted">Product</h4>
            <ul className="space-y-2 text-sm text-foreground-muted">
              <li>
                <Link to={user ? "/dashboard" : "/login"} className="transition-colors hover:text-foreground">
                  {user ? "Dashboard" : "Sign In"}
                </Link>
              </li>
              <li>
                <Link to="/blog" className="transition-colors hover:text-foreground">Blog</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-foreground-muted">Legal</h4>
            <ul className="space-y-2 text-sm text-foreground-muted">
              <li><Link to="/privacy" className="transition-colors hover:text-foreground">Privacy Policy</Link></li>
              <li><Link to="/terms" className="transition-colors hover:text-foreground">Terms of Service</Link></li>
              <li><a href="mailto:support@hireschema.com" className="transition-colors hover:text-foreground">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="mx-auto max-w-7xl border-t border-border px-6 pt-8 text-center text-sm text-foreground-muted">
          <p>© {new Date().getFullYear()} Hireschema. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
