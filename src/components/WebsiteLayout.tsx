import React from 'react';
import { Link } from 'react-router-dom';
import { HireschemaLogo } from './brand/HireschemaLogo';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggle } from './ui/theme-toggle';
import { WhatsAppSupportLink } from './support/WhatsAppSupportLink';
import { WhatsAppFloatingButton } from './support/WhatsAppFloatingButton';

export function WebsiteLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background font-sans text-foreground">
      <nav className="fixed top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-6">
          <Link to="/" className="inline-flex items-center no-underline">
            <HireschemaLogo height={28} />
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/blog" className="hidden text-sm font-medium text-foreground-muted transition-colors hover:text-foreground sm:block">
              Product guides
            </Link>
            <WhatsAppSupportLink className="hidden text-sm font-medium text-[#128C7E] hover:text-[#075E54] sm:inline-flex" />
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
            <Link to="/" className="mb-4 inline-flex no-underline">
              <HireschemaLogo height={26} />
            </Link>
            <p className="max-w-sm text-sm leading-6 text-foreground-muted">
              The AI-powered platform for job seekers. Scout matches roles to your resume, helps you connect with hiring managers, and coaches your search.
            </p>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-medium uppercase tracking-[0.14em] text-foreground-muted">Product</h4>
            <ul className="space-y-2 text-sm text-foreground-muted">
              <li>
                <Link to={user ? "/dashboard" : "/login"} className="transition-colors hover:text-foreground">
                  {user ? "Dashboard" : "Sign In"}
                </Link>
              </li>
              <li>
                <Link to="/blog" className="transition-colors hover:text-foreground">Hiring Guides</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-medium uppercase tracking-[0.14em] text-foreground-muted">Legal</h4>
            <ul className="space-y-2 text-sm text-foreground-muted">
              <li><Link to="/privacy" className="transition-colors hover:text-foreground">Privacy Policy</Link></li>
              <li><Link to="/terms" className="transition-colors hover:text-foreground">Terms of Service</Link></li>
              <li>
                <WhatsAppSupportLink className="text-[#128C7E] hover:text-[#075E54]" />
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto max-w-7xl border-t border-border px-6 pt-8 text-center text-sm text-foreground-muted">
          <p>© {new Date().getFullYear()} Hireschema. All rights reserved.</p>
        </div>
      </footer>
      <WhatsAppFloatingButton />
    </div>
  );
}
