import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Sidebar } from './components/Sidebar';
import { WebsiteLayout } from './components/WebsiteLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { JobTracker } from './pages/JobTracker';
import { Settings } from './pages/Settings';
import { SavedJobs } from './pages/SavedJobs';
import { ResumeProfile } from './pages/ResumeProfile';
import { CoverLetters } from './pages/CoverLetters';
import { InterviewPrep } from './pages/InterviewPrep';
import { AdminDashboard } from './pages/AdminDashboard';
import { Onboarding } from './pages/Onboarding';
import { LandingPage } from './pages/LandingPage';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { Blog } from './pages/Blog';
import { BlogPost } from './pages/BlogPost';
import { Toaster } from 'sonner';
import { useState, useEffect } from 'react';
import { ArrowRight, Search } from 'lucide-react';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background">Loading...</div>;
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { realUser, loading } = useAuth();
  const [status, setStatus] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    if (loading) return;
    if (!realUser) { setStatus('denied'); return; }
    setStatus('checking');
    const ADMIN_EMAILS = ['rupesh7126@gmail.com', 'kv3244@gmail.com'];
    const userEmail = realUser.email?.toLowerCase();

    realUser.getIdTokenResult(false)
      .then(r => setStatus((r.claims.superAdmin === true || ADMIN_EMAILS.includes(userEmail || '')) ? 'allowed' : 'denied'))
      .catch(() => setStatus(ADMIN_EMAILS.includes(userEmail || '') ? 'allowed' : 'denied'));
  }, [realUser, loading]);

  if (loading || status === 'checking') {
    return <div className="flex h-screen items-center justify-center bg-background">Checking access...</div>;
  }
  if (status === 'denied') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const meta: Record<string, { eyebrow: string; title: string }> = {
    '/dashboard': { eyebrow: "Today's matches", title: 'Fresh roles for you.' },
    '/settings': { eyebrow: 'Account', title: 'Settings.' },
    '/saved': { eyebrow: 'Your Library', title: 'Saved roles.' },
    '/resume': { eyebrow: 'Parsed profile', title: 'Your Resume Profile.' },
    '/cover-letters': { eyebrow: 'AI-generated', title: 'Cover Letters.' },
    '/interview-prep': { eyebrow: 'AI-generated', title: 'Interview Prep.' },
    '/onboarding': { eyebrow: 'Setup', title: 'Calibrate your Scout.' },
    '/kingdomofkumar': { eyebrow: 'Admin', title: 'Kingdom dashboard.' },
    '/superadmin': { eyebrow: 'Admin', title: 'Kingdom dashboard.' },
  };
  const current = meta[location.pathname] || meta['/dashboard'];

  return (
    <div className="hs-app-frame">
      <Sidebar />
      <div className="hs-main">
        <header className="hs-topbar">
          <div>
            <div className="hs-label">{current.eyebrow}</div>
            <div className="hs-topbar-title">{current.title}</div>
          </div>
          <div className="hs-actions flex items-center gap-2">
            <Link to="/dashboard" className="hs-btn">
              <Search className="h-3.5 w-3.5" />
              Search all matches
            </Link>
            <Link to="/dashboard" className="hs-btn hs-btn-primary">
              Run Scout now
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>
        <main>
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/privacy" element={<WebsiteLayout><PrivacyPolicy /></WebsiteLayout>} />
          <Route path="/terms" element={<WebsiteLayout><TermsOfService /></WebsiteLayout>} />
          <Route path="/blog" element={<WebsiteLayout><Blog /></WebsiteLayout>} />
          <Route path="/blog/:slug" element={<WebsiteLayout><BlogPost /></WebsiteLayout>} />
          <Route path="/dashboard" element={
            <PrivateRoute>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </PrivateRoute>
          } />
          <Route path="/onboarding" element={
            <PrivateRoute>
              <AppLayout>
                <Onboarding />
              </AppLayout>
            </PrivateRoute>
          } />

          <Route path="/settings" element={
            <PrivateRoute>
              <AppLayout>
                <Settings />
              </AppLayout>
            </PrivateRoute>
          } />
          <Route path="/saved" element={
            <PrivateRoute>
              <AppLayout>
                <SavedJobs />
              </AppLayout>
            </PrivateRoute>
          } />
          <Route path="/saved/:jobId" element={
            <PrivateRoute>
              <AppLayout>
                <SavedJobs />
              </AppLayout>
            </PrivateRoute>
          } />
          <Route path="/resume" element={
            <PrivateRoute>
              <AppLayout>
                <ResumeProfile />
              </AppLayout>
            </PrivateRoute>
          } />

          <Route path="/cover-letters" element={
            <PrivateRoute>
              <AppLayout>
                <CoverLetters />
              </AppLayout>
            </PrivateRoute>
          } />

          <Route path="/interview-prep" element={
            <PrivateRoute>
              <AppLayout>
                <InterviewPrep />
              </AppLayout>
            </PrivateRoute>
          } />

          <Route path="/kingdomofkumar" element={
            <AdminRoute>
              <AppLayout>
                <AdminDashboard />
              </AppLayout>
            </AdminRoute>
          } />

          <Route path="/superadmin" element={
            <AdminRoute>
              <AppLayout>
                <AdminDashboard />
              </AppLayout>
            </AdminRoute>
          } />
        </Routes>
      </Router>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}
