import type { Job } from './dashboard';
import type { ScoutLearningContext } from '../services/learningSignals';

export type GhostModeRunMode = 'preview' | 'persist';
export type GhostModeInputMode = 'saved' | 'override';

export interface GhostModeJob extends Job {
  finalScore?: number;
}

export interface GhostModeRejectedJob {
  job: GhostModeJob;
  code: string;
}

export interface DailyJobsDebugResult {
  queries: string[];
  harvestedCount: number;
  dedupedCount: number;
  validatedCount: number;
  unseenCount: number;
  seenCount: number;
  usedBackfill: boolean;
  acceptedJobs: GhostModeJob[];
  rejectedJobs: GhostModeRejectedJob[];
  rejectionCodeCounts: Record<string, number>;
  finalJobs: GhostModeJob[];
}

export interface GhostModeProfileInput {
  plan?: 'free' | 'pro';
  email?: string;
  careerPaths: string[];
  jobType: string;
  minSalary: number | null;
  resumeText: string;
  location: string;
  seenFingerprints: string[];
  learningContext: string;
  learningSignals?: ScoutLearningContext;
}

export interface GhostModeOverrides {
  careerPaths?: string[];
  jobType?: string;
  minSalary?: number | null;
  resumeText?: string;
  location?: string;
  learningContext?: string;
  learningSignals?: ScoutLearningContext;
}

export interface GhostModeTargetUser {
  id: string;
  email?: string;
  plan?: 'free' | 'pro';
  careerPaths?: string[];
  jobType?: string;
  minSalary?: number | null;
  resumeText?: string;
  location?: string;
  seenJobFingerprints?: string[];
  learningProfile?: {
    jobPreferences?: string;
  };
  learningSignals?: ScoutLearningContext;
}

export interface GhostModeRunResult {
  persisted: boolean;
  requestedLimit: number;
  effectiveProfile: GhostModeProfileInput;
  debug: DailyJobsDebugResult;
}
