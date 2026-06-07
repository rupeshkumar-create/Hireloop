import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';
import { useDashboardJobs } from '../hooks/useDashboardJobs';

type DashboardJobsContextValue = ReturnType<typeof useDashboardJobs>;

const DashboardJobsContext = createContext<DashboardJobsContextValue | null>(null);

export function DashboardJobsProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, updateProfile } = useAuth();
  const value = useDashboardJobs(user, profile, updateProfile);

  return (
    <DashboardJobsContext.Provider value={value}>
      {children}
    </DashboardJobsContext.Provider>
  );
}

export function useDashboardJobsContext() {
  const context = useContext(DashboardJobsContext);
  if (!context) {
    throw new Error('useDashboardJobsContext must be used within DashboardJobsProvider');
  }
  return context;
}
