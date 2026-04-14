import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ResumeUploader } from '../components/dashboard/ResumeUploader';
import { PageShell } from '../components/ui/page-shell';

export function Onboarding() {
  const { profile, updateProfile, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background">Loading...</div>;
  }

  // If they already have a resume, send them to the dashboard
  if (profile?.resumeText) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="h-full overflow-y-auto pb-12 pt-6">
      <PageShell
        title="Set up your AI recruiting agent"
        description="Upload your current resume once and Hireschema will configure your job preferences, analysis, and matching workflow around it."
        className="max-w-3xl"
      >
        <div className="overflow-hidden rounded-[32px] border border-border bg-surface p-2 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
          <ResumeUploader 
            updateProfile={updateProfile} 
            profile={profile} 
            onSuccess={() => navigate('/dashboard')} 
          />
        </div>
      </PageShell>
    </div>
  );
}
