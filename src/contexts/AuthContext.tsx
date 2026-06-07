import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot, deleteField } from 'firebase/firestore';
import { stripUndefinedDeep } from '../lib/firestoreSanitizer';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';

import { ResumeAnalysis } from '../services/aiService';
import { setAiAuthTokenGetter } from '../services/aiAuth';
import { toast } from 'sonner';
import type { LearningSignals } from '../services/learningSignals';

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
  jobType?: string; // e.g. 'remote', 'onsite', 'both'
  location?: string;
  minSalary?: number | null;
  resumeText?: string;
  resumeRaw?: string;
  resumeCleaned?: string;
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
  /** Set when step 3 (Scout) starts — lets refresh resume on matches even with 0 jobs. */
  onboardingScoutStartedAt?: string;
  /** Set when the user saves their first Pipeline role or skips guided first dashboard. */
  firstSessionCompletedAt?: string;
  tourCompletedAt?: string;
  activatedAt?: string;
  plan?: 'free' | 'pro';
  receiveDailyAlerts?: boolean;
  automationPausedAt?: string;
  automationPausedReason?: string;
  antiSlopEnabled?: boolean;
  dailyJobs?: any[];
  dailyJobsMeta?: Record<string, any>;
  lastJobFetchTime?: string;
  createdAt: string;
  updatedAt?: string;
  lastActiveAt?: string;
  learningProfile?: LearningProfile;
  learningSignals?: LearningSignals;
}

interface AuthContextType {
  user: User | null;
  realUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signingIn: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  impersonateUser: (uid: string, email: string) => void;
  stopImpersonating: () => void;
  isImpersonating: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [realUser, setRealUser] = useState<User | null>(null);
  const [realProfile, setRealProfile] = useState<UserProfile | null>(null);
  
  const [impersonatedUid, setImpersonatedUid] = useState<string | null>(sessionStorage.getItem('impersonated_uid'));
  const [impersonatedEmail, setImpersonatedEmail] = useState<string | null>(sessionStorage.getItem('impersonated_email'));
  const [impersonatedProfile, setImpersonatedProfile] = useState<UserProfile | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  // Effective user/profile to expose
  const isImpersonating = !!impersonatedUid;
  
  const user = isImpersonating && realUser ? { ...realUser, uid: impersonatedUid, email: impersonatedEmail } as User : realUser;
  const profile = isImpersonating ? impersonatedProfile : realProfile;

  const impersonateUser = (uid: string, email: string) => {
    sessionStorage.setItem('impersonated_uid', uid);
    sessionStorage.setItem('impersonated_email', email);
    setImpersonatedUid(uid);
    setImpersonatedEmail(email);
  };

  const stopImpersonating = () => {
    sessionStorage.removeItem('impersonated_uid');
    sessionStorage.removeItem('impersonated_email');
    setImpersonatedUid(null);
    setImpersonatedEmail(null);
    setImpersonatedProfile(null);
  };

  useEffect(() => {
    setAiAuthTokenGetter(async () => {
      const current = auth.currentUser;
      if (!current) return null;
      return current.getIdToken();
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setRealUser(currentUser);
      if (currentUser) {
        // Listen to real profile changes
        const unsubscribeProfile = onSnapshot(
          doc(db, 'users', currentUser.uid),
          (docSnap) => {
            if (docSnap.exists()) {
              setRealProfile(docSnap.data() as UserProfile);
              // Update lastActiveAt every time they load the app
              if (
                !docSnap.data().lastActiveAt || 
                new Date().getTime() - new Date(docSnap.data().lastActiveAt).getTime() > 1000 * 60 * 60
              ) {
                const nowIso = new Date().toISOString();
                const resumeAutomation =
                  docSnap.data().automationPausedReason === 'inactive_3d'
                    ? {
                        receiveDailyAlerts: true,
                        automationPausedAt: deleteField(),
                        automationPausedReason: deleteField(),
                      }
                    : {};
                setDoc(
                  doc(db, 'users', currentUser.uid),
                  { lastActiveAt: nowIso, updatedAt: nowIso, ...resumeAutomation },
                  { merge: true }
                );
              }
            } else {
              // Create initial profile
              const browserTimeZone =
                Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
              const newProfile: UserProfile = {
                uid: currentUser.uid,
                email: currentUser.email || '',
                displayName: currentUser.displayName || '',
                photoURL: currentUser.photoURL || '',
                plan: 'free',
                jobType: 'remote',
                receiveDailyAlerts: true,
                antiSlopEnabled: true,
                deliveryTimezone: browserTimeZone,
                preferredDeliveryHour: 8,
                nextJobDeliveryAt: new Date().toISOString(),
                matchReadiness: {
                  status: 'blocked',
                  hasResume: false,
                  hasCareerPaths: false,
                  blockingReason: 'Profile missing usable resume text and career paths.',
                  qualityWarnings: [],
                },
                createdAt: new Date().toISOString(),
                lastActiveAt: new Date().toISOString(),
                // Sentinel so the daily-alerts cron (orderBy lastJobFetchTime asc)
                // always includes this user. Without this field Firestore's orderBy
                // silently excludes the document.
                lastJobFetchTime: '1970-01-01T00:00:00.000Z',
              };
              setDoc(doc(db, 'users', currentUser.uid), newProfile)
                .catch(e =>
                  handleFirestoreError(e, OperationType.CREATE, `users/${currentUser.uid}`)
                );
              setRealProfile(newProfile);
            }
            setLoading(false);
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
            setLoading(false);
          }
        );
        return () => unsubscribeProfile();
      } else {
        setRealProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen to impersonated profile if active
  useEffect(() => {
    if (isImpersonating && impersonatedUid) {
      const unsubscribeImp = onSnapshot(
        doc(db, 'users', impersonatedUid),
        (docSnap) => {
          if (docSnap.exists()) {
            setImpersonatedProfile(docSnap.data() as UserProfile);
          } else {
            setImpersonatedProfile(null);
          }
        }
      );
      return () => unsubscribeImp();
    }
  }, [isImpersonating, impersonatedUid]);

  const signInWithGoogle = async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
      toast.error("Failed to sign in with Google. " + (error.message || "Please try again."));
    } finally {
      setSigningIn(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      // Firestore rejects any `undefined` value anywhere in the document
      // tree (only `null` or omitted keys are valid). The previous filter
      // only stripped top-level undefined — nested ones (e.g.
      // `structuredProfile.contact.phone`) slipped through and threw at
      // write time. Use the shared deep stripper so this can't regress.
      const cleanData = stripUndefinedDeep(data);
      await setDoc(
        doc(db, 'users', user.uid),
        { ...cleanData, updatedAt: new Date().toISOString() },
        { merge: true },
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      realUser,
      profile, 
      loading, 
      signingIn,
      signInWithGoogle, 
      logout, 
      updateProfile,
      impersonateUser,
      stopImpersonating,
      isImpersonating
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
