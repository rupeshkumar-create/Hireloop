import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Briefcase, Sparkles } from 'lucide-react';

export function Login() {
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="hs-landing min-h-screen flex flex-col">
      <nav className="hs-land-nav">
        <div className="hs-land-container hs-land-nav-inner">
          <Link to="/" className="hs-land-wordmark text-lg text-[var(--hs-land-fg)] no-underline">Hireschema</Link>
          <Link to="/" className="flex items-center gap-2 text-sm text-[var(--hs-land-muted)] no-underline transition hover:text-[var(--hs-land-fg)]">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center py-20">
        <div className="hs-land-container max-w-[480px]">
          <div className="text-center mb-12">
            <div className="hs-land-eyebrow mb-6 text-[var(--hs-land-accent)]">Sign in to Scout</div>
            <h1 className="hs-display text-4xl mb-6">Welcome back.</h1>
            <p className="text-[17px] leading-relaxed text-[var(--hs-land-muted)]">
              Continue your remote job search with a warmer, more deliberate AI workflow.
            </p>
          </div>

          <div className="space-y-6">
            <button 
              onClick={signInWithGoogle}
              className="hs-land-cta w-full flex items-center justify-center gap-3 !py-4 hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="currentColor"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="currentColor"
                  opacity="0.8"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="currentColor"
                  opacity="0.6"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="currentColor"
                  opacity="0.9"
                />
              </svg>
              Continue with Google
            </button>

            <div className="grid grid-cols-1 gap-4 pt-6">
              {[
                { icon: Briefcase, text: 'Curated daily job feed' },
                { icon: Sparkles, text: 'AI-tailored cover letters' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-4 p-4 rounded-xl border border-[var(--hs-land-border)] bg-[var(--hs-land-surface)]">
                  <div className="p-2 rounded-lg bg-[var(--hs-land-bg)]">
                    <item.icon className="h-4 w-4 text-[var(--hs-land-muted)]" />
                  </div>
                  <span className="text-sm font-medium text-[var(--hs-land-fg)]">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-12 text-center text-xs text-[var(--hs-land-muted)] leading-relaxed">
            By signing in, you agree to our <Link to="/terms" className="underline underline-offset-4 hover:text-[var(--hs-land-fg)]">Terms of Service</Link> and <Link to="/privacy" className="underline underline-offset-4 hover:text-[var(--hs-land-fg)]">Privacy Policy</Link>.
          </p>
        </div>
      </main>

      <footer className="hs-land-container py-10">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--hs-land-muted)]">© 2026 Hireschema</span>
      </footer>
    </div>
  );
}
