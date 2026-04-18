import type { DailyJob } from './dailyJob';
import type { ScoutLearningContext } from '../services/learningSignals';

export type GhostModeRunMode = 'preview' | 'persist';
export type GhostModeInputMode = 'saved' | 'override';

/** Alias kept for backwards compat inside the admin UI */
export type GhostModeJob = DailyJob;

export interface DailyJobsDebugResult {
  // Harvest stats
  harvestedCount: number;
  dedupedCount: number;
  unseenCount: number;
  seenCount: number;
  usedBackfill: boolean;
  sourceBreakdown: Record<string, number>;

  // Matching stats
  scoredCount: number;
  enrichedCount: number;

  // Results
  finalJobs: DailyJob[];
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
  learningProfile?: { jobPreferences?: string };
  learningSignals?: ScoutLearningContext;
}

export interface GhostModeRunResult {
  persisted: boolean;
  requestedLimit: number;
  effectiveProfile: GhostModeProfileInput;
  debug: DailyJobsDebugResult;
}
