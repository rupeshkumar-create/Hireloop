import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Sidebar } from './components/Sidebar';
import { WebsiteLayout } from './components/WebsiteLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { JobTracker } from './pages/JobTracker';
import { Settings } from './pages/Settings';
import { AdminDashboard } from './pages/AdminDashboard';
import { Onboarding } from './pages/Onboarding';
import { LandingPage } from './pages/LandingPage';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { Toaster } from 'sonner';
import { ThemeToggle } from './components/ui/theme-toggle';
import { useState, useEffect } from 'react';

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
    realUser.getIdTokenResult(false)
      .then(r => setStatus(r.claims.superAdmin === true ? 'allowed' : 'denied'))
      .catch(() => setStatus('denied'));
  }, [realUser, loading]);

  if (loading || status === 'checking') {
    return <div className="flex h-screen items-center justify-center bg-background">Checking access...</div>;
  }
  if (status === 'denied') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-background px-6 py-8 md:px-8">
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
          <Route path="/" element={<WebsiteLayout><LandingPage /></WebsiteLayout>} />
          <Route path="/login" element={<Login />} />
          <Route path="/privacy" element={<WebsiteLayout><PrivacyPolicy /></WebsiteLayout>} />
          <Route path="/terms" element={<WebsiteLayout><TermsOfService /></WebsiteLayout>} />
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
          <Route path="/tracker" element={
            <PrivateRoute>
              <AppLayout>
                <JobTracker />
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
          <Route path="/kingdomofkumar" element={
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
