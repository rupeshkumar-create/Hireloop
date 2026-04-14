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
  jobType?: string;
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
  learningProfile?: LearningProfile;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Listen to profile changes
        const unsubscribeProfile = onSnapshot(
          doc(db, 'users', currentUser.uid),
          (docSnap) => {
            if (docSnap.exists()) {
              setProfile(docSnap.data() as UserProfile);
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
              setProfile(newProfile);
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
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

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
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, logout, updateProfile }}>
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
