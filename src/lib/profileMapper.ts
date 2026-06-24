import type { ResumeAnalysis } from '../services/aiService';
import type { LearningSignals } from '../services/learningSignals';
import type { TargetMarket } from '../lib/targetMarkets';
import type { AgentChatState } from './agentChat';

export interface LearningProfile {
  jobPreferences?: string;
  writingStyle?: string;
}

export interface ContactDetails {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

export interface ExperienceEntry {
  id: string;
  title: string;
  company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  highlights?: string[];
}

export interface EducationEntry {
  id: string;
  school: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
}

export interface StructuredProfile {
  skills: string[];
  techStack: string[];
  seniority: string;
  roles: string[];
  industries: string[];
  contact?: ContactDetails;
  experience?: ExperienceEntry[];
  education?: EducationEntry[];
  certifications?: string[];
  languages?: string[];
}

export interface UserPreferences {
  remoteOnly: boolean;
  salaryFloor: number | null;
  locations: string[];
}

export interface MatchReadinessSnapshot {
  status: 'ready' | 'partial' | 'blocked';
  hasResume: boolean;
  hasCareerPaths: boolean;
  blockingReason: string | null;
  qualityWarnings: string[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  careerPaths?: string[];
  jobType?: string;
  location?: string;
  minSalary?: number | null;
  resumeText?: string;
  resumeRaw?: string;
  resumeCleaned?: string;
  resumeStoragePath?: string;
  resumeStorageBucket?: string;
  resumeFileName?: string;
  resumeSummary?: string;
  structuredProfile?: StructuredProfile;
  preferences?: UserPreferences;
  matchingPreferences?: UserPreferences;
  deliveryTimezone?: string;
  preferredDeliveryHour?: number;
  nextJobDeliveryAt?: string;
  lastSuccessfulJobRunLocalDate?: string;
  matchReadiness?: MatchReadinessSnapshot;
  resumeAnalysis?: ResumeAnalysis;
  careerPathSuggestions?: Array<{ id: string; title: string; rationale?: string; queryHints?: string[] }>;
  selectedCareerPathId?: string;
  onboardingCompletedAt?: string;
  onboardingScoutStartedAt?: string;
  firstSessionCompletedAt?: string;
  tourCompletedAt?: string;
  activatedAt?: string;
  plan?: 'free' | 'pro';
  role?: 'user' | 'super_admin';
  receiveDailyAlerts?: boolean;
  automationPausedAt?: string;
  automationPausedReason?: string;
  antiSlopEnabled?: boolean;
  dailyJobs?: any[];
  dailyJobsMeta?: Record<string, any>;
  lastJobFetchTime?: string;
  seenJobFingerprints?: string[];
  createdAt: string;
  updatedAt?: string;
  lastActiveAt?: string;
  inactiveScoutPromptShownAt?: string;
  learningProfile?: LearningProfile;
  learningSignals?: LearningSignals;
  targetMarkets?: TargetMarket[];
  agentChat?: AgentChatState;
}

export type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  photo_url: string | null;
  plan: string;
  role?: 'user' | 'super_admin';
  receive_daily_alerts: boolean;
  last_job_fetch_time: string | null;
  next_job_delivery_at: string | null;
  created_at: string;
  updated_at: string;
  data: Record<string, unknown>;
};

const PROFILE_COLUMNS = new Set([
  'uid', 'email', 'displayName', 'photoURL', 'plan', 'role', 'receiveDailyAlerts',
  'lastJobFetchTime', 'nextJobDeliveryAt', 'createdAt', 'updatedAt',
]);

export function rowToProfile(row: ProfileRow): UserProfile {
  const data = (row.data || {}) as Record<string, unknown>;
  return {
    ...(data as unknown as UserProfile),
    uid: row.id,
    email: row.email,
    displayName: row.display_name || undefined,
    photoURL: row.photo_url || undefined,
    plan: (row.plan as UserProfile['plan']) || 'free',
    role: (row.role as UserProfile['role']) || 'user',
    receiveDailyAlerts: row.receive_daily_alerts,
    lastJobFetchTime: row.last_job_fetch_time || undefined,
    nextJobDeliveryAt: row.next_job_delivery_at || undefined,
    createdAt: (data.createdAt as string) || row.created_at,
    updatedAt: row.updated_at,
  };
}

export function profileToRow(userId: string, patch: Partial<UserProfile>): Partial<ProfileRow> {
  const dataPatch: Record<string, unknown> = {};
  const row: Partial<ProfileRow> = { id: userId };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    switch (key) {
      case 'uid': break;
      case 'email': row.email = String(value); break;
      case 'displayName': row.display_name = value ? String(value) : null; break;
      case 'photoURL': row.photo_url = value ? String(value) : null; break;
      case 'plan': row.plan = String(value); break;
      case 'role': row.role = String(value) as ProfileRow['role']; break;
      case 'receiveDailyAlerts': row.receive_daily_alerts = Boolean(value); break;
      case 'lastJobFetchTime': row.last_job_fetch_time = value ? String(value) : null; break;
      case 'nextJobDeliveryAt': row.next_job_delivery_at = value ? String(value) : null; break;
      default:
        if (!PROFILE_COLUMNS.has(key)) dataPatch[key] = value;
        break;
    }
  }

  if (Object.keys(dataPatch).length > 0) row.data = dataPatch;
  return row;
}
