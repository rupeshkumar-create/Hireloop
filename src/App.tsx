import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppChromeProvider, useAppChrome } from './contexts/AppChromeContext';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { DashboardJobsProvider } from './contexts/DashboardJobsContext';
import { WebsiteLayout } from './components/WebsiteLayout';
import { BlogLayout } from './components/blog/BlogLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { Onboarding } from './pages/Onboarding';
import { LandingPage } from './pages/LandingPage';
import { RemoteJobsPage } from './pages/RemoteJobsPage';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { Blog } from './pages/Blog';
import { BlogPost } from './pages/BlogPost';
import { Toaster } from 'sonner';
import { ArrowRight, Search } from 'lucide-react';
import { isAdminEmail } from './lib/adminEmails';
import { isOnboardingComplete } from './lib/onboarding';
import { HireschemaLogo } from './components/brand/HireschemaLogo';
import { GoogleAnalytics } from './components/GoogleAnalytics';
import { shouldHideManualScoutControls } from './lib/inactiveScout';

const JobTracker = lazy(() => import('./pages/JobTracker').then((m) => ({ default: m.JobTracker })));
const ResumeProfile = lazy(() => import('./pages/ResumeProfile').then((m) => ({ default: m.ResumeProfile })));
const CoverLetters = lazy(() => import('./pages/CoverLetters').then((m) => ({ default: m.CoverLetters })));
const InterviewPrep = lazy(() => import('./pages/InterviewPrep').then((m) => ({ default: m.InterviewPrep })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));

function PageLoader() {
  return (
    <div className="flex h-full min-h-[40vh] items-center justify-center p-10 text-sm text-[var(--hs-app-muted)]">
      Loading…
    </div>
  );
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const onOnboarding = location.pathname === '/onboarding';
  const onboardingDone = isOnboardingComplete(profile);

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background">Loading...</div>;
  }

  if (!user) return <Navigate to="/login" />;

  if (!onOnboarding && !onboardingDone) {
    return <Navigate to="/onboarding" replace />;
  }

  if (onOnboarding && onboardingDone) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { realUser, loading } = useAuth();
  const [status, setStatus] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    if (loading) return;
    if (!realUser) { setStatus('denied'); return; }
    setStatus('checking');
    const userEmail = realUser.email;

    realUser.getIdTokenResult(false)
      .then(r => setStatus((r.claims.superAdmin === true || isAdminEmail(userEmail)) ? 'allowed' : 'denied'))
      .catch(() => setStatus(isAdminEmail(userEmail) ? 'allowed' : 'denied'));
  }, [realUser, loading]);

  if (loading || status === 'checking') {
    return <div className="flex h-screen items-center justify-center bg-background">Checking access...</div>;
  }
  if (status === 'denied') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] px-6 py-4">
        <Link to="/" className="inline-flex no-underline">
          <HireschemaLogo height={26} />
        </Link>
        <p className="mt-1 text-xs text-[var(--hs-app-muted)]">
          About 2 minutes to your first matched roles
        </p>
      </header>
      <main>{children}</main>
    </div>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { minimal } = useAppChrome();
  const { profile } = useAuth();
  const hideManualScout = shouldHideManualScoutControls(profile);
  const meta: Record<string, { eyebrow: string; title: string }> = {
    '/dashboard': { eyebrow: "Today's matches", title: 'Discover fresh roles from Scout.' },
    '/settings': { eyebrow: 'Account', title: 'Settings.' },
    '/jobs': { eyebrow: 'Pipeline', title: 'Track saved roles and ship applications.' },
    '/resume': { eyebrow: 'Parsed profile', title: 'Your Resume Profile.' },
    '/cover-letters': { eyebrow: 'AI-generated', title: 'Cover Letters.' },
    '/interview-prep': { eyebrow: 'AI-generated', title: 'Interview Prep.' },
    '/onboarding': { eyebrow: 'Setup', title: 'Calibrate your Scout.' },
    '/kingdomofkumar': { eyebrow: 'Admin', title: 'Kingdom dashboard.' },
    '/superadmin': { eyebrow: 'Admin', title: 'Kingdom dashboard.' },
  };
  const current = meta[location.pathname] || meta['/dashboard'];
  const onDashboard = location.pathname === '/dashboard';

  if (minimal) {
    return (
      <DashboardJobsProvider>
        <div className="hs-app-frame hs-app-frame-minimal">
          <header className="hs-minimal-header">
            <Link to="/" className="inline-flex no-underline">
              <HireschemaLogo height={24} />
            </Link>
            <p className="text-[11px] text-[var(--hs-app-muted)]">Step 1 — review your first matches</p>
          </header>
          <main className="hs-main hs-main-minimal">{children}</main>
        </div>
      </DashboardJobsProvider>
    );
  }

  return (
    <DashboardJobsProvider>
      <div className="hs-app-frame">
        <Sidebar />
        <div className="hs-main">
          <header className="hs-topbar">
            <div>
              <div className="hs-label">{current.eyebrow}</div>
              <div className="hs-topbar-title">{current.title}</div>
            </div>
            <div className="hs-actions flex items-center gap-2">
              <Link to="/dashboard#matches" className="hs-btn">
                <Search className="h-3.5 w-3.5" />
                View matches
              </Link>
              {!onDashboard && !hideManualScout ? (
                <Link to="/dashboard?scout=1" className="hs-btn hs-btn-primary">
                  Run Scout
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          </header>
          <main>
            {children}
          </main>
        </div>
        <MobileNav />
      </div>
    </DashboardJobsProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppChromeProvider>
      <Router>
        <GoogleAnalytics />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/remote-jobs" element={<RemoteJobsPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/privacy" element={<WebsiteLayout><PrivacyPolicy /></WebsiteLayout>} />
          <Route path="/terms" element={<WebsiteLayout><TermsOfService /></WebsiteLayout>} />
          <Route path="/blog" element={<BlogLayout><Blog /></BlogLayout>} />
          <Route path="/blog/:slug" element={<BlogLayout><BlogPost /></BlogLayout>} />
          <Route path="/dashboard" element={
            <PrivateRoute>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </PrivateRoute>
          } />
          <Route path="/onboarding" element={
            <PrivateRoute>
              <OnboardingLayout>
                <Onboarding />
              </OnboardingLayout>
            </PrivateRoute>
          } />

          <Route path="/settings" element={
            <PrivateRoute>
              <AppLayout>
                <Settings />
              </AppLayout>
            </PrivateRoute>
          } />
          {/* Pipeline (canonical) — the richer kanban + metrics + search +
              exports view. /saved is kept as a redirect for older URLs. */}
          <Route path="/jobs" element={
            <PrivateRoute>
              <AppLayout>
                <LazyPage><JobTracker /></LazyPage>
              </AppLayout>
            </PrivateRoute>
          } />
          <Route path="/saved" element={<Navigate to="/jobs" replace />} />
          <Route path="/saved/:jobId" element={<Navigate to="/jobs" replace />} />
          <Route path="/resume" element={
            <PrivateRoute>
              <AppLayout>
                <LazyPage><ResumeProfile /></LazyPage>
              </AppLayout>
            </PrivateRoute>
          } />

          <Route path="/cover-letters" element={
            <PrivateRoute>
              <AppLayout>
                <LazyPage><CoverLetters /></LazyPage>
              </AppLayout>
            </PrivateRoute>
          } />

          <Route path="/interview-prep" element={
            <PrivateRoute>
              <AppLayout>
                <LazyPage><InterviewPrep /></LazyPage>
              </AppLayout>
            </PrivateRoute>
          } />

          <Route path="/kingdomofkumar" element={
            <AdminRoute>
              <AppLayout>
                <LazyPage><AdminDashboard /></LazyPage>
              </AppLayout>
            </AdminRoute>
          } />

          <Route path="/superadmin" element={
            <AdminRoute>
              <AppLayout>
                <LazyPage><AdminDashboard /></LazyPage>
              </AppLayout>
            </AdminRoute>
          } />
        </Routes>
      </Router>
      </AppChromeProvider>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}
