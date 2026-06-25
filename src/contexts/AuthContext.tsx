import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import { fetchProfile, subscribeToProfile, updateProfile as saveProfile } from '../services/profileService';
import { setAiAuthTokenGetter } from '../services/aiAuth';
import { toast } from 'sonner';
import type { AppUser } from '../types/auth';
import type { UserProfile } from '../lib/profileMapper';
import { getOAuthRedirectUrl } from '../lib/oauthRedirect';

export type {
  LearningProfile,
  ContactDetails,
  ExperienceEntry,
  EducationEntry,
  StructuredProfile,
  UserPreferences,
  MatchReadinessSnapshot,
  UserProfile,
} from '../lib/profileMapper';

interface AuthContextType {
  user: AppUser | null;
  realUser: AppUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signingIn: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithLinkedIn: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  impersonateUser: (uid: string, email: string) => void;
  stopImpersonating: () => void;
  isImpersonating: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapSessionUser(session: Session | null): AppUser | null {
  if (!session?.user) return null;
  const meta = session.user.user_metadata || {};
  return {
    uid: session.user.id,
    email: session.user.email ?? null,
    displayName: meta.full_name || meta.name || null,
    photoURL: meta.avatar_url || meta.picture || null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [realUser, setRealUser] = useState<AppUser | null>(null);
  const [realProfile, setRealProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const [impersonatedUid, setImpersonatedUid] = useState<string | null>(sessionStorage.getItem('impersonated_uid'));
  const [impersonatedEmail, setImpersonatedEmail] = useState<string | null>(sessionStorage.getItem('impersonated_email'));
  const [impersonatedProfile, setImpersonatedProfile] = useState<UserProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  const isImpersonating = !!impersonatedUid;
  const user = isImpersonating && realUser
    ? { ...realUser, uid: impersonatedUid!, email: impersonatedEmail }
    : realUser;
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
    const supabase = getSupabaseBrowserClient();

    setAiAuthTokenGetter(async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setRealUser(mapSessionUser(data.session));
      if (!data.session) setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setRealUser(mapSessionUser(nextSession));
      if (!nextSession) {
        setRealProfile(null);
        setLoading(false);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!realUser?.uid || isImpersonating) return;

    const unsubscribe = subscribeToProfile(
      realUser.uid,
      async (nextProfile) => {
        if (!nextProfile) {
          const nowIso = new Date().toISOString();
          const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
          const bootstrap: Partial<UserProfile> = {
            uid: realUser.uid,
            email: realUser.email || '',
            displayName: realUser.displayName || undefined,
            photoURL: realUser.photoURL || undefined,
            plan: 'free',
            jobType: 'remote',
            targetMarkets: [...DEFAULT_TARGET_MARKETS],
            receiveDailyAlerts: true,
            antiSlopEnabled: true,
            deliveryTimezone: browserTimeZone,
            preferredDeliveryHour: 8,
            nextJobDeliveryAt: nowIso,
            matchReadiness: {
              status: 'blocked',
              hasResume: false,
              hasCareerPaths: false,
              blockingReason: 'Profile missing usable resume text and career paths.',
              qualityWarnings: [],
            },
            createdAt: nowIso,
            lastActiveAt: nowIso,
            lastJobFetchTime: '1970-01-01T00:00:00.000Z',
          };
          await saveProfile(realUser.uid, bootstrap).catch(console.error);
          setRealProfile(bootstrap as UserProfile);
          setLoading(false);
          return;
        }

        setRealProfile(nextProfile);

        const stale =
          !nextProfile.lastActiveAt ||
          new Date().getTime() - new Date(nextProfile.lastActiveAt).getTime() > 1000 * 60 * 60;

        if (stale) {
          const nowIso = new Date().toISOString();
          const resumeAutomation =
            nextProfile.automationPausedReason === 'inactive_3d'
              ? {
                  receiveDailyAlerts: true,
                  automationPausedAt: undefined,
                  automationPausedReason: undefined,
                }
              : {};
          saveProfile(realUser.uid, { lastActiveAt: nowIso, ...resumeAutomation }).catch(console.error);
        }

        setLoading(false);
      },
      (error) => {
        console.error('Profile subscription error:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [realUser?.uid, isImpersonating]);

  useEffect(() => {
    if (!isImpersonating || !impersonatedUid) return;

    const unsubscribe = subscribeToProfile(impersonatedUid, setImpersonatedProfile);
    return unsubscribe;
  }, [isImpersonating, impersonatedUid]);

  const signInWithOAuth = async (provider: 'google' | 'linkedin_oidc') => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      const redirectTo = getOAuthRedirectUrl();
      const { error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          ...(provider === 'linkedin_oidc'
            ? { scopes: 'openid profile email' }
            : {}),
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      console.error(`Error signing in with ${provider}:`, error);
      toast.error(`Failed to sign in. ${message}`);
      setSigningIn(false);
    }
  };

  const signInWithGoogle = () => signInWithOAuth('google');
  const signInWithLinkedIn = () => signInWithOAuth('linkedin_oidc');

  const logout = async () => {
    try {
      await getSupabaseBrowserClient().auth.signOut();
      stopImpersonating();
    } catch (error) {
      console.error('Error signing out', error);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      await saveProfile(user.uid, data);
    } catch (error) {
      console.error('Profile update failed:', error);
      toast.error('Failed to save profile changes.');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        realUser,
        profile,
        loading,
        signingIn,
        signInWithGoogle,
        signInWithLinkedIn,
        logout,
        updateProfile,
        impersonateUser,
        stopImpersonating,
        isImpersonating,
      }}
    >
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