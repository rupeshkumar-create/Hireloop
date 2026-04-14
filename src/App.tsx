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
import { BlogIndex } from './pages/blog/BlogIndex';
import { BlogPost } from './pages/blog/BlogPost';
import { Onboarding } from './pages/Onboarding';
import { LandingPage } from './pages/LandingPage';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { Toaster } from 'sonner';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background">Loading...</div>;
  }
  
  return user ? <>{children}</> : <Navigate to="/login" />;
}

const ADMIN_EMAILS = ['rupesh7126@gmail.com', 'kv3244@gmail.com'];

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!user.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return <Navigate to="/dashboard" />;
  }
  
  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-surface font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8 bg-surface">
        {children}
      </main>
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
          <Route path="/blog" element={
            <WebsiteLayout>
              <BlogIndex />
            </WebsiteLayout>
          } />
          <Route path="/blog/:slug" element={
            <WebsiteLayout>
              <BlogPost />
            </WebsiteLayout>
          } />
        </Routes>
      </Router>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}
