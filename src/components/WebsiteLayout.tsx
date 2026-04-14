import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Briefcase } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function WebsiteLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-border overflow-x-hidden flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-border bg-surface/90 backdrop-blur-xl fixed top-0 w-full z-50 shadow-sm transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-none bg-foreground shadow-md">
              <Briefcase className="h-4 w-4 text-surface" />
            </div>
            <span className="font-bold text-xl tracking-tight">Hireschema</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-500">
            <Link to="/#agent-workflow" className="hover:text-zinc-900 transition-colors">How it works</Link>
            <Link to="/blog" className="hover:text-zinc-900 transition-colors">Blog</Link>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <Link to="/dashboard">
                <Button variant="action" size="sm" className="rounded-none shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all px-5">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-foreground-muted hover:text-foreground transition-colors hidden sm:block">
                  Sign in
                </Link>
                <Link to="/login">
                  <Button variant="action" size="sm" className="rounded-none shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all px-5">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 pt-16">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-background/80 backdrop-blur-xl py-12 border-t border-border/50 mt-auto">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4 inline-flex">
              <div className="flex h-6 w-6 items-center justify-center rounded-none bg-foreground">
                <Briefcase className="h-3 w-3 text-surface" />
              </div>
              <span className="font-bold tracking-tight">Hireschema</span>
            </Link>
            <p className="text-foreground-muted text-sm max-w-xs">The AI-powered platform exclusively for remote job seekers. Find, track, and land remote roles - from anywhere in the world.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-foreground-muted">
              <li>
                <Link to={user ? "/dashboard" : "/login"} className="hover:text-foreground">
                  {user ? "Dashboard" : "Sign In"}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-foreground-muted">
              <li><Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-foreground">Terms of Service</Link></li>
              <li><a href="mailto:support@hireschema.com" className="hover:text-foreground">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-border text-center text-foreground-muted text-sm">
          <p>© {new Date().getFullYear()} Hireschema. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
