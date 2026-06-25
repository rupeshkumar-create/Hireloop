import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isOnboardingComplete } from '../lib/onboarding';
import { HireloopLogo } from '../components/brand/HireloopLogo';
import { WhatsAppSupportLink } from '../components/support/WhatsAppSupportLink';
import { SeoHead } from '../components/seo/SeoHead';
import { SITE_URL } from '../lib/siteSeo';
import { ArrowLeft, Briefcase, Sparkles, Upload, Compass, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { BRAND_LOGIN_DESCRIPTION } from '../lib/brand';
import { isSupabaseBrowserConfigured } from '../lib/supabaseClient';

const FLOW_STEPS = [
  { icon: Upload, label: 'Resume or LinkedIn', detail: 'We extract skills and suggest career paths' },
  { icon: Compass, label: 'Confirm paths', detail: 'Pick 1–3 roles Scout should search' },
  { icon: Rocket, label: 'See matches', detail: 'Scout finds roles scored to your profile' },
];

export function Login() {
  const { user, profile, loading, signInWithGoogle, signInWithLinkedIn, signingIn } = useAuth();
  const navigate = useNavigate();
  const isNewUser = !profile?.resumeText && !isOnboardingComplete(profile);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const authError =
      params.get('error_description') ||
      params.get('error') ||
      hashParams.get('error_description') ||
      hashParams.get('error');
    if (authError) {
      toast.error(decodeURIComponent(authError.replace(/\+/g, ' ')));
      window.history.replaceState({}, '', '/login');
    }
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    navigate(isOnboardingComplete(profile) ? '/dashboard' : '/onboarding');
  }, [user, profile, loading, navigate]);

  return (
    <div className="hs-landing min-h-screen flex flex-col">
      <SeoHead
        title="Sign in — Hireloop"
        description={BRAND_LOGIN_DESCRIPTION}
        canonicalUrl={`${SITE_URL}/login`}
        ogType="website"
        noIndex
      />
      <nav className="hs-land-nav">
        <div className="hs-land-container hs-land-nav-inner">
          <Link to="/" className="inline-flex no-underline">
            <HireloopLogo height={26} />
          </Link>
          <Link to="/" className="flex items-center gap-2 text-sm text-[var(--hs-land-muted)] no-underline transition hover:text-[var(--hs-land-fg)]">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center py-20">
        <div className="hs-land-container max-w-[520px]">
          <div className="text-center mb-10">
            <div className="hs-land-eyebrow mb-6 text-[var(--hs-land-accent)]">
              {isNewUser ? 'Get started free' : 'Sign in to Scout'}
            </div>
            <h1 className="hs-display text-4xl mb-6">
              {isNewUser ? 'Your first matches in ~2 minutes.' : 'Welcome back.'}
            </h1>
            <p className="text-[17px] leading-relaxed text-[var(--hs-land-muted)]">
              {isNewUser
                ? 'Sign in with Google or LinkedIn, add your resume or LinkedIn URL, and Scout delivers roles matched to your profile.'
                : 'Continue your job search with Scout matches, connect, and Scout Chat.'}
            </p>
          </div>

          <div className="space-y-6">
            {!isSupabaseBrowserConfigured() ? (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                Sign-in is not configured on this deployment. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, then redeploy.
              </p>
            ) : null}
            <button
              onClick={signInWithGoogle}
              disabled={signingIn}
              className="hs-land-cta w-full flex items-center justify-center gap-3 !py-4 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
            >
              {signingIn ? (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
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
              )}
              {signingIn ? 'Signing in…' : 'Continue with Google'}
            </button>

            <button
              type="button"
              onClick={signInWithLinkedIn}
              disabled={signingIn}
              className="w-full flex items-center justify-center gap-3 rounded-xl border border-[var(--hs-land-border)] bg-[var(--hs-land-surface)] px-4 py-4 text-sm font-medium text-[var(--hs-land-fg)] transition hover:border-[var(--hs-land-fg)] disabled:opacity-60 disabled:pointer-events-none"
            >
              {signingIn ? (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 114.128 0 2.063 2.063 0 01-2.065 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              )}
              {signingIn ? 'Signing in…' : 'Continue with LinkedIn'}
            </button>

            {isNewUser ? (
              <div className="grid grid-cols-1 gap-3 pt-2">
                {FLOW_STEPS.map((step, index) => (
                  <div
                    key={step.label}
                    className="flex items-start gap-4 rounded-xl border border-[var(--hs-land-border)] bg-[var(--hs-land-surface)] p-4 text-left"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--hs-land-bg)] font-mono text-xs font-bold text-[var(--hs-land-muted)]">
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-[var(--hs-land-fg)]">
                        <step.icon className="h-4 w-4 text-[var(--hs-land-muted)]" />
                        {step.label}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--hs-land-muted)]">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
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
            )}
          </div>

          <p className="mt-12 text-center text-xs text-[var(--hs-land-muted)] leading-relaxed">
            By signing in, you agree to our <Link to="/terms" className="underline underline-offset-4 hover:text-[var(--hs-land-fg)]">Terms of Service</Link> and <Link to="/privacy" className="underline underline-offset-4 hover:text-[var(--hs-land-fg)]">Privacy Policy</Link>.
          </p>
        </div>
      </main>

      <footer className="hs-land-container flex flex-wrap items-center justify-between gap-3 py-10">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--hs-land-muted)]">© 2026 Hireloop</span>
        <WhatsAppSupportLink className="text-xs font-medium text-[#128C7E] hover:underline" />
      </footer>
    </div>
  );
}
