import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, List, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardJobs } from '../hooks/useDashboardJobs';
import { useDashboardAI } from '../hooks/useDashboardAI';
import { ResumeUploader } from '../components/dashboard/ResumeUploader';
import { OverviewTab } from '../components/dashboard/OverviewTab';
import { MatchesTab } from '../components/dashboard/MatchesTab';
import { JobDetailsPanel } from '../components/dashboard/JobDetailsPanel';
import { Job } from '../types/dashboard';

export function Dashboard() {
  const { profile, user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'matches'>('overview');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const {
    filteredAndSortedJobs, loadingJobs,
    stats, statsLoading, fetchJobs, saveJob,
    filterCompany, setFilterCompany,
    filterLocation, setFilterLocation,
    filterSalary, setFilterSalary,
    sortBy, setSortBy,
    lastFetchTime
  } = useDashboardJobs(user, profile, updateProfile);

  const {
    aiAction, setAiAction,
    aiResult,
    actionLoading,
    handleAiAction,
    downloadResume
  } = useDashboardAI(profile);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      toast.success('Payment processing! Your account will be upgraded shortly.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Automatically fetch jobs if moving to matches and no jobs yet
  useEffect(() => {
    if (profile?.careerPaths && profile.careerPaths.length > 0 && filteredAndSortedJobs.length === 0 && activeTab === 'matches' && !loadingJobs) {
      fetchJobs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, activeTab, loadingJobs]);

  const isRefreshAvailable = () => {
    if (!lastFetchTime) return true;
    const hoursSinceLastFetch = (Date.now() - new Date(lastFetchTime).getTime()) / (1000 * 60 * 60);
    return hoursSinceLastFetch >= 24;
  };

  if (!profile?.resumeText) {
    return <Navigate to="/onboarding" />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top Navigation / Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 font-display">Dashboard</h1>
          <p className="text-zinc-500 mt-1">
            Welcome back, {user?.displayName?.split(' ')[0] || 'Candidate'}. Here are your latest remote matches.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {isRefreshAvailable() && (
            <button 
              onClick={() => fetchJobs(true)} 
              disabled={loadingJobs}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loadingJobs ? 'animate-spin' : ''}`} />
              {loadingJobs ? 'Scanning...' : 'Refresh Matches'}
            </button>
          )}
          
          <div className="flex p-1 bg-zinc-100/80 backdrop-blur-md rounded-xl border border-zinc-200/50 shadow-sm">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'overview' 
                  ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' 
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('matches')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'matches' 
                  ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' 
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
              }`}
            >
              <List className="h-4 w-4" />
              Daily Matches
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'overview' && (
          <OverviewTab 
            stats={stats} 
            statsLoading={statsLoading} 
            profile={profile} 
            setActiveTab={setActiveTab} 
          />
        )}

        {activeTab === 'matches' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full overflow-hidden"
          >
            <MatchesTab 
              jobs={filteredAndSortedJobs}
              loadingJobs={loadingJobs}
              fetchJobs={fetchJobs}
              filterCompany={filterCompany} setFilterCompany={setFilterCompany}
              filterLocation={filterLocation} setFilterLocation={setFilterLocation}
              filterSalary={filterSalary} setFilterSalary={setFilterSalary}
              sortBy={sortBy} setSortBy={setSortBy}
              selectedJob={selectedJob} setSelectedJob={setSelectedJob}
              setAiAction={setAiAction}
            />
          </motion.div>
        )}

        {/* Details Panel Modal */}
        <AnimatePresence>
          {selectedJob && (
            <JobDetailsPanel 
              selectedJob={selectedJob}
              saveJob={saveJob}
              handleAiAction={handleAiAction}
              aiAction={aiAction}
              aiResult={aiResult}
              actionLoading={actionLoading}
              downloadResume={downloadResume}
              onClose={() => setSelectedJob(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
