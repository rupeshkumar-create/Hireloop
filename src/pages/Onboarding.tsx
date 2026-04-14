import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ResumeUploader } from '../components/dashboard/ResumeUploader';

export function Onboarding() {
  const { profile, updateProfile, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50">Loading...</div>;
  }

  // If they already have a resume, send them to the dashboard
  if (profile?.resumeText) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="h-full overflow-y-auto pb-12 pr-4 flex flex-col items-center justify-center pt-20">
      <div className="max-w-2xl w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 mb-4">Welcome to Hireschema</h1>
          <p className="text-zinc-500 text-lg">Let's set up your AI recruiting agent. Upload your current resume and we'll automatically configure your job preferences.</p>
        </div>
        
        <div className="text-left bg-white rounded-none border border-zinc-200 shadow-xl overflow-hidden p-1">
          <ResumeUploader 
            updateProfile={updateProfile} 
            profile={profile} 
            onSuccess={() => navigate('/dashboard')} 
          />
        </div>
      </div>
    </div>
  );
}
