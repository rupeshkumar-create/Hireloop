import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { sendSignupEmail } from '../services/emailService';

import { ResumeAnalysis } from '../services/aiService';

export interface LearningProfile {
  jobPreferences?: string;
  writingStyle?: string;
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
  resumeAnalysis?: ResumeAnalysis;
  plan?: 'free' | 'pro';
  receiveDailyAlerts?: boolean;
  antiSlopEnabled?: boolean;
  dailyJobs?: any[];
  lastJobFetchTime?: string;
  createdAt: string;
  updatedAt?: string;
  lastActiveAt?: string;
  learningProfile?: LearningProfile;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
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
                setDoc(doc(db, 'users', currentUser.uid), { lastActiveAt: new Date().toISOString() }, { merge: true });
              }
            } else {
              // Create initial profile
              const newProfile: UserProfile = {
                uid: currentUser.uid,
                email: currentUser.email || '',
                displayName: currentUser.displayName || '',
                photoURL: currentUser.photoURL || '',
                plan: 'free',
                receiveDailyAlerts: true,
                antiSlopEnabled: true,
                createdAt: new Date().toISOString(),
                lastActiveAt: new Date().toISOString(),
              };
              setDoc(doc(db, 'users', currentUser.uid), newProfile)
                .then(() => {
                  // Send signup email when profile is successfully created
                  if (newProfile.email) {
                    sendSignupEmail(newProfile.email, newProfile.displayName || '');
                  }
                })
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
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
      alert("Failed to sign in with Google. " + (error.message || "Please try again."));
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
      // Remove any undefined values before saving to Firestore
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
      );
      await setDoc(doc(db, 'users', user.uid), { ...cleanData, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
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
