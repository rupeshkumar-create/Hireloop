# hireschema - Full Context

## Overview
This document provides the complete technical context for hireschema.

## Directory Tree
```text
├── .env.example
├── .gitignore
├── README.md
├── firebase-applet-config.json
├── firebase-blueprint.json
├── firestore.rules
├── index.html
├── metadata.json
├── package-lock.json
├── package.json
├── src
│   ├── App.tsx
│   ├── components
│   │   ├── Sidebar.tsx
│   │   ├── dashboard
│   │   │   ├── JobDetailsPanel.tsx
│   │   │   ├── MatchesTab.tsx
│   │   │   ├── OverviewTab.tsx
│   │   │   └── ResumeUploader.tsx
│   │   └── ui
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       └── textarea.tsx
│   ├── contexts
│   │   └── AuthContext.tsx
│   ├── firebase.ts
│   ├── hooks
│   │   ├── useDashboardAI.ts
│   │   ├── useDashboardJobs.ts
│   │   └── useResumeParser.ts
│   ├── index.css
│   ├── lib
│   │   └── utils.ts
│   ├── main.tsx
│   ├── pages
│   │   ├── Dashboard.tsx
│   │   ├── JobTracker.tsx
│   │   ├── LandingPage.tsx
│   │   ├── Login.tsx
│   │   └── Settings.tsx
│   ├── services
│   │   ├── aiService.ts
│   │   └── emailService.ts
│   └── types
│       └── dashboard.ts
├── tsconfig.json
└── vite.config.ts

```

## Dependencies
```text
{
  "name": "react-example",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port=3000 --host=0.0.0.0",
    "build": "vite build",
    "preview": "vite preview",
    "clean": "rm -rf dist",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@radix-ui/react-tooltip": "^1.2.8",
    "@tailwindcss/vite": "^4.1.14",
    "@vitejs/plugin-react": "^5.0.4",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "dotenv": "^17.2.3",
    "express": "^4.21.2",
    "firebase": "^12.12.0",
    "lucide-react": "^0.546.0",
    "mammoth": "^1.12.0",
    "motion": "^12.23.24",
    "openai": "^6.34.0",
    "pdfjs-dist": "^5.6.205",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-markdown": "^10.1.0",
    "react-router-dom": "^7.14.0",
    "resend": "^6.11.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "vite": "^6.2.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.14.0",
    "autoprefixer": "^10.4.21",
    "tailwindcss": "^4.1.14",
    "tsx": "^4.21.0",
    "typescript": "~5.8.2",
    "vite": "^6.2.0"
  }
}

```

## README Extract
```text
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d612fcdb-7a91-4b68-99fc-cca70ab71581

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `VITE_OPENAI_API_KEY` in [.env](.env) to your OpenAI API key
3. Run the app:
   `npm run dev`

```

## Source Code Dump
### File: firebase-blueprint.json
```
{
  "entities": {
    "UserProfile": {
      "title": "UserProfile",
      "description": "User settings and profile for job searching",
      "type": "object",
      "properties": {
        "uid": { "type": "string", "description": "Firebase Auth UID" },
        "email": { "type": "string", "format": "email" },
        "displayName": { "type": "string" },
        "photoURL": { "type": "string" },
        "jobTitle": { "type": "string", "description": "Desired job title" },
        "jobType": { "type": "string", "enum": ["remote", "hybrid", "onsite", "any"], "description": "Preferred work arrangement" },
        "minSalary": { "type": "number", "description": "Minimum expected salary" },
        "resumeText": { "type": "string", "description": "Parsed text of the user's resume" },
        "createdAt": { "type": "string", "format": "date-time" },
        "updatedAt": { "type": "string", "format": "date-time" }
      },
      "required": ["uid", "email", "createdAt"]
    },
    "TrackedJob": {
      "title": "TrackedJob",
      "description": "A job saved or tracked by the user",
      "type": "object",
      "properties": {
        "userId": { "type": "string", "description": "Owner of this tracked job" },
        "title": { "type": "string" },
        "company": { "type": "string" },
        "location": { "type": "string" },
        "salary": { "type": "string" },
        "status": { "type": "string", "enum": ["saved", "applied", "interviewing", "offered", "rejected"] },
        "url": { "type": "string" },
        "notes": { "type": "string" },
        "coldEmail": { "type": "string" },
        "tailoredResume": { "type": "string" },
        "interviewQuestions": { "type": "array", "items": { "type": "string" } },
        "contactEmail": { "type": "string" },
        "createdAt": { "type": "string", "format": "date-time" },
        "updatedAt": { "type": "string", "format": "date-time" }
      },
      "required": ["userId", "title", "company", "status", "createdAt"]
    }
  },
  "firestore": {
    "/users/{userId}": {
      "schema": { "$ref": "#/entities/UserProfile" },
      "description": "User profiles and settings"
    },
    "/trackedJobs/{jobId}": {
      "schema": { "$ref": "#/entities/TrackedJob" },
      "description": "Jobs tracked by users"
    }
  }
}

```

### File: index.html
```
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Google AI Studio App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>


```

### File: metadata.json
```
{
  "name": "Hireschema",
  "description": "A modern AI-powered job search platform for mid to high-level professionals, featuring personalized job recommendations, AI resume tailoring, and cold email generation.",
  "requestFramePermissions": []
}

```

### File: firebase-applet-config.json
```
{
  "projectId": "gen-lang-client-0015134140",
  "appId": "1:308903720178:web:68f1cba80553cd57404c6b",
  "apiKey": "AIzaSyAukCM4jyEzYxxtccGfeOeLGxg7PGj3N7k",
  "authDomain": "gen-lang-client-0015134140.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-d612fcdb-7a91-4b68-99fc-cca70ab71581",
  "storageBucket": "gen-lang-client-0015134140.firebasestorage.app",
  "messagingSenderId": "308903720178",
  "measurementId": ""
}
```

### File: README.md
```
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d612fcdb-7a91-4b68-99fc-cca70ab71581

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `VITE_OPENAI_API_KEY` in [.env](.env) to your OpenAI API key
3. Run the app:
   `npm run dev`

```

### File: package.json
```
{
  "name": "react-example",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port=3000 --host=0.0.0.0",
    "build": "vite build",
    "preview": "vite preview",
    "clean": "rm -rf dist",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@radix-ui/react-tooltip": "^1.2.8",
    "@tailwindcss/vite": "^4.1.14",
    "@vitejs/plugin-react": "^5.0.4",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "dotenv": "^17.2.3",
    "express": "^4.21.2",
    "firebase": "^12.12.0",
    "lucide-react": "^0.546.0",
    "mammoth": "^1.12.0",
    "motion": "^12.23.24",
    "openai": "^6.34.0",
    "pdfjs-dist": "^5.6.205",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-markdown": "^10.1.0",
    "react-router-dom": "^7.14.0",
    "resend": "^6.11.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "vite": "^6.2.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.14.0",
    "autoprefixer": "^10.4.21",
    "tailwindcss": "^4.1.14",
    "tsx": "^4.21.0",
    "typescript": "~5.8.2",
    "vite": "^6.2.0"
  }
}

```

### File: tsconfig.json
```
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "lib": [
      "ES2022",
      "DOM",
      "DOM.Iterable"
    ],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": [
        "./src/*"
      ]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}

```

### File: vite.config.ts
```
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

```

### File: src/App.tsx
```
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { JobTracker } from './pages/JobTracker';
import { Settings } from './pages/Settings';
import { LandingPage } from './pages/LandingPage';
import { Toaster } from 'sonner';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50">Loading...</div>;
  }
  
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-white font-sans text-slate-900">
      <Sidebar />
      <main className="flex-1 overflow-hidden p-8 bg-white">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={
            <PrivateRoute>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </PrivateRoute>
          } />
          <Route path="/tracker" element={
            <PrivateRoute>
              <AppLayout>
                <JobTracker />
              </AppLayout>
            </PrivateRoute>
          } />
          <Route path="/settings" element={
            <PrivateRoute>
              <AppLayout>
                <Settings />
              </AppLayout>
            </PrivateRoute>
          } />
        </Routes>
      </Router>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

```

### File: src/main.tsx
```
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

```

### File: src/firebase.ts
```
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: any[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

```

### File: src/index.css
```
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
}

body {
  font-family: var(--font-sans);
  background-color: #f8fafc;
  color: #0f172a;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display);
}

/* Markdown Styles */
.markdown-body {
  font-family: var(--font-sans);
}
.markdown-body h1, .markdown-body h2, .markdown-body h3 {
  font-family: var(--font-display);
  font-weight: 600;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  color: #0f172a;
}
.markdown-body p {
  margin-bottom: 1em;
  line-height: 1.6;
}
.markdown-body ul {
  list-style-type: disc;
  padding-left: 1.5em;
  margin-bottom: 1em;
}
.markdown-body strong {
  font-weight: 600;
}

```

### File: src/types/dashboard.ts
```
export interface Job {
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
  url: string;
  requirements: string[];
  matchScore?: number;
  datePosted?: string;
}

export type SortOption = 'matchScore' | 'company' | 'datePosted';

```

### File: src/contexts/AuthContext.tsx
```
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';

import { ResumeAnalysis } from '../services/aiService';

interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  careerPaths?: string[];
  jobType?: string;
  minSalary?: number | null;
  resumeText?: string;
  resumeAnalysis?: ResumeAnalysis;
  createdAt: string;
  updatedAt?: string;
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
                createdAt: new Date().toISOString(),
              };
              setDoc(doc(db, 'users', currentUser.uid), newProfile).catch(e => 
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
    } catch (error) {
      console.error("Error signing in with Google", error);
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
      await setDoc(doc(db, 'users', user.uid), { ...data, updatedAt: new Date().toISOString() }, { merge: true });
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

```

### File: src/components/Sidebar.tsx
```
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Briefcase, LayoutDashboard, Settings, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';

export function Sidebar() {
  const { profile, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: 'Daily Jobs', path: '/', icon: LayoutDashboard },
    { name: 'Job Tracker', path: '/tracker', icon: Briefcase },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r border-zinc-200 bg-zinc-50/50">
      <div className="flex h-16 items-center px-6 border-b border-zinc-200">
        <div className="bg-zinc-900 p-1.5 rounded-md mr-3">
          <Briefcase className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-zinc-900">Hireschema</span>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6">
        <nav className="space-y-1 px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-zinc-900 text-white" 
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                )}
              >
                <Icon className={cn("mr-3 h-4 w-4", isActive ? "text-white" : "text-zinc-400")} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-zinc-200 p-4">
        <div className="flex items-center mb-4 px-2">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="Profile" className="h-8 w-8 rounded-full mr-3 border border-zinc-200" referrerPolicy="no-referrer" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center mr-3 text-zinc-700 font-medium text-sm">
              {profile?.displayName?.charAt(0) || profile?.email?.charAt(0) || 'U'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-900 truncate">{profile?.displayName || 'User'}</p>
            <p className="text-xs text-zinc-500 truncate">{profile?.email}</p>
          </div>
        </div>
        <Button variant="outline" className="w-full justify-start text-zinc-600" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

```

### File: src/components/ui/card.tsx
```
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm", className)} {...props} />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("font-semibold leading-none tracking-tight", className)} {...props} />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-slate-500", className)} {...props} />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }

```

### File: src/components/ui/badge.tsx
```
import * as React from "react"
import { cn } from "@/lib/utils"

const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' }>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2",
          {
            "border-transparent bg-zinc-900 text-white hover:bg-zinc-800": variant === "default",
            "border-transparent bg-zinc-100 text-zinc-900 hover:bg-zinc-200": variant === "secondary",
            "text-zinc-950 border-zinc-200": variant === "outline",
            "border-transparent bg-red-100 text-red-900 hover:bg-red-200": variant === "destructive",
            "border-transparent bg-emerald-100 text-emerald-900 hover:bg-emerald-200": variant === "success",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }

```

### File: src/components/ui/button.tsx
```
import * as React from "react"
import { cn } from "@/lib/utils"

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive', size?: 'default' | 'sm' | 'lg' | 'icon' }>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-zinc-900 text-white hover:bg-zinc-800": variant === "default",
            "bg-zinc-100 text-zinc-900 hover:bg-zinc-200": variant === "secondary",
            "border border-zinc-200 bg-white hover:bg-zinc-100 hover:text-zinc-900": variant === "outline",
            "hover:bg-zinc-100 hover:text-zinc-900": variant === "ghost",
            "bg-red-500 text-white hover:bg-red-600": variant === "destructive",
            "h-10 px-4 py-2": size === "default",
            "h-9 rounded-md px-3": size === "sm",
            "h-11 rounded-md px-8": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }

```

### File: src/components/ui/textarea.tsx
```
import * as React from "react"
import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }

```

### File: src/components/ui/input.tsx
```
import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

```

### File: src/components/dashboard/OverviewTab.tsx
```
import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, Sparkles, TrendingUp, Briefcase } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';

interface OverviewTabProps {
  stats: { saved: number; applied: number; interviewing: number };
  statsLoading: boolean;
  profile: any;
  setActiveTab: (tab: 'overview' | 'matches') => void;
}

export function OverviewTab({ stats, statsLoading, profile, setActiveTab }: OverviewTabProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 overflow-y-auto"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Saved Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display text-zinc-900">
              {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.saved}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Applications Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display text-zinc-900">
              {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.applied}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Interviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display text-zinc-900">
              {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.interviewing}
            </div>
          </CardContent>
        </Card>
      </div>

      {profile?.resumeAnalysis ? (
        <div className="space-y-6">
          <h3 className="text-2xl font-bold text-zinc-900 font-display">Resume Analysis</h3>
          <p className="text-zinc-600">{profile.resumeAnalysis.summary}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-emerald-800 flex items-center gap-2">
                  <Sparkles className="h-5 w-5" /> Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {profile.resumeAnalysis.strengths.map((strength: string, i: number) => (
                    <li key={i} className="text-sm text-emerald-900 flex items-start">
                      <span className="mr-2 mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="leading-relaxed">{strength}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-amber-800 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" /> Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {profile.resumeAnalysis.improvements.map((improvement: string, i: number) => (
                    <li key={i} className="text-sm text-amber-900 flex items-start">
                      <span className="mr-2 mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                      <span className="leading-relaxed">{improvement}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-8 text-center max-w-2xl mx-auto mt-12">
          <Briefcase className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-zinc-900 font-display mb-2">Ready to find your next role?</h3>
          <p className="text-zinc-600 mb-6">We've analyzed your resume and are ready to find the best matches for you. Check your daily matches to see what we found.</p>
          <Button onClick={() => setActiveTab('matches')} size="lg">
            View Daily Matches
          </Button>
        </div>
      )}
    </motion.div>
  );
}

```

### File: src/components/dashboard/JobDetailsPanel.tsx
```
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookmarkPlus, ExternalLink, MapPin, DollarSign, Mail, FileText, MessageSquare, TrendingUp, Sparkles, Download, Loader2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import ReactMarkdown from 'react-markdown';
import { Job } from '../../types/dashboard';
import { AiActionType } from '../../hooks/useDashboardAI';

interface JobDetailsPanelProps {
  selectedJob: Job;
  saveJob: (j: Job) => void;
  handleAiAction: (a: AiActionType, j: Job) => void;
  aiAction: AiActionType;
  aiResult: string | string[];
  actionLoading: boolean;
  downloadResume: (j: Job | null) => void;
}

export function JobDetailsPanel({
  selectedJob, saveJob, handleAiAction, aiAction, aiResult, actionLoading, downloadResume
}: JobDetailsPanelProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="w-[550px] flex-shrink-0 flex flex-col h-full overflow-hidden border border-zinc-200 rounded-2xl bg-white shadow-sm"
    >
      <div className="p-6 border-b border-zinc-100 overflow-y-auto flex-1">
        <div className="flex justify-between items-start mb-1">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 font-display">{selectedJob.title}</h2>
          {selectedJob.matchScore !== undefined && (
            <Badge variant={selectedJob.matchScore >= 80 ? 'success' : 'secondary'} className="font-semibold">
              {selectedJob.matchScore}% Match
            </Badge>
          )}
        </div>
        <p className="text-lg font-medium text-zinc-600 mb-6">{selectedJob.company}</p>
        
        <div className="flex gap-2 mb-6">
          <Button className="flex-1 font-display font-semibold" size="lg" onClick={() => window.open(selectedJob.url, '_blank')}>
            Apply Now <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline" size="lg" onClick={() => saveJob(selectedJob)} title="Save to Tracker">
            <BookmarkPlus className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <Badge variant="outline" className="font-medium px-3 py-1"><MapPin className="mr-1.5 h-3.5 w-3.5" /> {selectedJob.location}</Badge>
          <Badge variant="outline" className="font-medium px-3 py-1"><DollarSign className="mr-1.5 h-3.5 w-3.5" /> {selectedJob.salary}</Badge>
        </div>

        <div className="space-y-6">
          <div>
            <h4 className="font-bold text-zinc-900 font-display mb-3">About the Role</h4>
            <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">{selectedJob.description}</p>
          </div>
          {selectedJob.requirements && selectedJob.requirements.length > 0 && (
            <div>
              <h4 className="font-bold text-zinc-900 font-display mb-3">Requirements</h4>
              <ul className="space-y-2">
                {selectedJob.requirements.map((req, i) => (
                  <li key={i} className="text-sm text-zinc-600 flex items-start">
                    <span className="mr-2 mt-1.5 h-1.5 w-1.5 rounded-full bg-zinc-400 flex-shrink-0" />
                    <span className="leading-relaxed">{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="p-5 bg-zinc-50 border-t border-zinc-200">
        <h4 className="font-bold text-zinc-900 font-display mb-3 text-sm">AI Tools</h4>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Button variant="secondary" size="sm" onClick={() => handleAiAction('email', selectedJob)}>
            <Mail className="mr-2 h-4 w-4" /> Cold Email
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleAiAction('resume', selectedJob)}>
            <FileText className="mr-2 h-4 w-4" /> Tailor Resume
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" onClick={() => handleAiAction('interview', selectedJob)}>
            <MessageSquare className="mr-2 h-4 w-4" /> Interview Prep
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleAiAction('salary', selectedJob)}>
            <TrendingUp className="mr-2 h-4 w-4" /> Salary Insights
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {aiAction && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-6 border-t border-zinc-200 bg-white max-h-[40%] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-zinc-900 font-display flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                {aiAction === 'email' && 'Cold Email Draft'}
                {aiAction === 'resume' && 'Tailored Resume'}
                {aiAction === 'interview' && 'Interview Questions'}
                {aiAction === 'salary' && 'Salary Insights'}
              </h4>
              {aiAction === 'resume' && !actionLoading && (
                <Button variant="outline" size="sm" onClick={() => downloadResume(selectedJob)}>
                  <Download className="mr-2 h-3 w-3" /> Download .md
                </Button>
              )}
            </div>
            
            {actionLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-zinc-900" /></div>
            ) : (
              <div className="text-sm text-zinc-700 bg-zinc-50 p-4 rounded-md border border-zinc-200">
                {aiAction === 'interview' && Array.isArray(aiResult) ? (
                  <ul className="list-decimal pl-5 space-y-2">
                    {aiResult.map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
                ) : (
                  <div className="markdown-body prose prose-sm max-w-none">
                    <ReactMarkdown>{aiResult as string}</ReactMarkdown>
                  </div>
                )}
                
                {aiAction === 'email' && (
                  <Button 
                    className="mt-4 w-full" 
                    onClick={() => {
                      const mailBody = encodeURIComponent(`${aiResult}\n\nJob URL: ${selectedJob.url}`);
                      window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=Application for ${selectedJob.title}&body=${mailBody}`, '_blank');
                    }}
                  >
                    Open in Gmail
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

```

### File: src/components/dashboard/MatchesTab.tsx
```
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Briefcase, MapPin, DollarSign, Calendar, ArrowUpDown } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Job, SortOption } from '../../types/dashboard';

interface MatchesTabProps {
  jobs: Job[];
  loadingJobs: boolean;
  refreshMessage: string | null;
  fetchJobs: () => void;
  filterCompany: string;
  setFilterCompany: (v: string) => void;
  filterLocation: string;
  setFilterLocation: (v: string) => void;
  filterSalary: string;
  setFilterSalary: (v: string) => void;
  sortBy: SortOption;
  setSortBy: (v: SortOption) => void;
  selectedJob: Job | null;
  setSelectedJob: (j: Job | null) => void;
  setAiAction: (v: any) => void;
}

export function MatchesTab({
  jobs, loadingJobs, refreshMessage, fetchJobs,
  filterCompany, setFilterCompany,
  filterLocation, setFilterLocation,
  filterSalary, setFilterSalary,
  sortBy, setSortBy,
  selectedJob, setSelectedJob, setAiAction
}: MatchesTabProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 font-display">Your Daily Matches</h1>
          <p className="text-zinc-500 text-sm mt-1">Curated jobs based on your preferences and resume.</p>
        </div>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {refreshMessage && (
              <motion.span 
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100"
              >
                {refreshMessage}
              </motion.span>
            )}
          </AnimatePresence>
          <Button onClick={fetchJobs} disabled={loadingJobs} variant="outline" size="sm" className="font-medium">
            {loadingJobs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Briefcase className="mr-2 h-4 w-4" />}
            Refresh Jobs
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4 w-full">
        <div className="grid grid-cols-3 gap-3 flex-1 w-full">
          <Input 
            placeholder="Filter by company..." 
            value={filterCompany} 
            onChange={(e) => setFilterCompany(e.target.value)} 
            className="h-9 text-sm w-full"
          />
          <Input 
            placeholder="Filter by location..." 
            value={filterLocation} 
            onChange={(e) => setFilterLocation(e.target.value)} 
            className="h-9 text-sm w-full"
          />
          <Input 
            placeholder="Filter by salary..." 
            value={filterSalary} 
            onChange={(e) => setFilterSalary(e.target.value)} 
            className="h-9 text-sm w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-zinc-400" />
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-9 text-sm border border-zinc-200 rounded-md px-3 bg-white text-zinc-700 outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <option value="matchScore">Match Score</option>
            <option value="datePosted">Newest First</option>
            <option value="company">Company (A-Z)</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3 pb-8">
        {loadingJobs ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-900" />
            <p className="text-zinc-500 font-medium animate-pulse">Scouring the web for the best opportunities...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">No jobs found matching your filters.</div>
        ) : (
          <AnimatePresence>
            {jobs.map((job, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
              >
                <Card 
                  className={`cursor-pointer transition-all hover:border-zinc-400 ${selectedJob === job ? 'border-zinc-900 ring-1 ring-zinc-900 shadow-md' : 'border-zinc-200 shadow-sm'}`}
                  onClick={() => { setSelectedJob(job); setAiAction(null); }}
                >
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-zinc-900 font-display text-lg">{job.title}</h3>
                        <p className="text-zinc-600 font-medium">{job.company}</p>
                      </div>
                      {job.matchScore !== undefined && (
                        <Badge variant={job.matchScore >= 80 ? 'success' : 'secondary'} className="ml-2 font-semibold">
                          {job.matchScore}% Match
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 mt-4 text-sm text-zinc-500">
                      <div className="flex items-center"><MapPin className="mr-1.5 h-4 w-4 text-zinc-400" /> {job.location}</div>
                      <div className="flex items-center"><DollarSign className="mr-1.5 h-4 w-4 text-zinc-400" /> {job.salary}</div>
                      {job.datePosted && (
                        <div className="flex items-center"><Calendar className="mr-1.5 h-4 w-4 text-zinc-400" /> {new Date(job.datePosted).toLocaleDateString()}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

```

### File: src/components/dashboard/ResumeUploader.tsx
```
import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Upload, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { useResumeParser } from '../../hooks/useResumeParser';

interface ResumeUploaderProps {
  updateProfile: (data: any) => Promise<void>;
  profile: any;
  onSuccess: () => void;
}

export function ResumeUploader({ updateProfile, profile, onSuccess }: ResumeUploaderProps) {
  const { analyzingResume, handleFileUpload } = useResumeParser(updateProfile, profile);

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center space-y-6">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-50 p-6 rounded-full"
      >
        <FileText className="h-16 w-16 text-zinc-400" />
      </motion.div>
      <div>
        <h2 className="text-3xl font-bold text-zinc-900 font-display mb-2">Welcome to Hireschema</h2>
        <p className="text-zinc-500 text-lg">You just need to upload your resume once to get started. We'll automatically analyze it and find the best matches.</p>
      </div>
      
      <Card className="w-full mt-8 border-dashed border-2 border-zinc-200">
        <CardContent className="pt-6 pb-8 flex flex-col items-center justify-center">
          {analyzingResume ? (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-900" />
              <p className="text-zinc-600 font-medium">Analyzing your resume...</p>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 text-zinc-400 mb-4" />
              <h3 className="text-lg font-semibold text-zinc-900 mb-1">Upload Resume</h3>
              <p className="text-sm text-zinc-500 mb-6">PDF, DOCX, or TXT (Max 5MB)</p>
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => handleFileUpload(e.target.files?.[0], onSuccess)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Button className="pointer-events-none">Select File</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

```

### File: src/hooks/useResumeParser.ts
```
import { useState } from 'react';
import { toast } from 'sonner';
import { suggestCareerPaths } from '../services/aiService';

export function useResumeParser(updateProfile: (data: any) => Promise<void>, profile: any) {
  const [analyzingResume, setAnalyzingResume] = useState(false);

  const handleFileUpload = async (file: File | undefined, onSuccess: () => void) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large. Please upload a file smaller than 5MB.");
      return;
    }

    setAnalyzingResume(true);
    let text = '';
    
    try {
      if (file.type === 'text/plain' || file.name.endsWith('.md')) {
        text = await file.text();
      } else if (file.type === 'application/pdf') {
        // @ts-ignore
        const pdfWorkerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          // @ts-ignore
          const pageText = textContent.items.map((item) => item.str).join(' ');
          text += pageText + '\n';
        }
      } else if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else {
        toast.error("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
        setAnalyzingResume(false);
        return;
      }
    } catch (err) {
      console.error("Error parsing file", err);
      toast.error("Could not parse the file. Please try a different format.");
      setAnalyzingResume(false);
      return;
    }

    try {
      let paths = profile?.careerPaths || [];
      let analysis = profile?.resumeAnalysis;

      if (text.trim()) {
        toast.info("Analyzing resume for career paths and feedback...");
        const suggestedPaths = await suggestCareerPaths(text);
        if (suggestedPaths && suggestedPaths.length > 0) {
          paths = suggestedPaths;
          toast.success("Career paths automatically detected!");
        }
        
        const { analyzeResume } = await import('../services/aiService');
        const resumeAnalysis = await analyzeResume(text, paths);
        if (resumeAnalysis) {
          analysis = resumeAnalysis;
          toast.success("Resume analysis complete!");
        }
      }

      await updateProfile({
        resumeText: text,
        careerPaths: paths,
        resumeAnalysis: analysis,
      });
      toast.success("Resume uploaded successfully!");
      onSuccess();
    } catch (error) {
      toast.error("Failed to save resume.");
    } finally {
      setAnalyzingResume(false);
    }
  };

  return { analyzingResume, handleFileUpload };
}

```

### File: src/hooks/useDashboardJobs.ts
```
import { useState, useMemo, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { Job, SortOption } from '../types/dashboard';
import { generateDailyJobs } from '../services/aiService';

export function useDashboardJobs(user: any, profile: any) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  
  const [stats, setStats] = useState({ saved: 0, applied: 0, interviewing: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  // Filters & Sorting
  const [filterCompany, setFilterCompany] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterSalary, setFilterSalary] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('matchScore');

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;
    setStatsLoading(true);
    try {
      const q = query(collection(db, 'trackedJobs'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      let saved = 0, applied = 0, interviewing = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'saved') saved++;
        if (data.status === 'applied') applied++;
        if (data.status === 'interviewing') interviewing++;
      });
      setStats({ saved, applied, interviewing });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchJobs = async () => {
    if (!profile?.careerPaths || profile.careerPaths.length === 0) {
      toast.error("Please set your Career Paths in Settings first.");
      return;
    }
    setLoadingJobs(true);
    setRefreshMessage("Searching the web for the best matches...");
    try {
      const results = await generateDailyJobs(profile.careerPaths, profile.jobType || 'any', profile.minSalary || null, profile.resumeText || '');
      setJobs(results);
      setRefreshMessage(`Found ${results.length} new jobs!`);
      toast.success(`Found ${results.length} new jobs matching your profile!`);
      setTimeout(() => setRefreshMessage(null), 4000);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch jobs.");
      setRefreshMessage(null);
    } finally {
      setLoadingJobs(false);
    }
  };

  const saveJob = async (job: Job) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'trackedJobs'), {
        userId: user.uid,
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary,
        status: 'saved',
        url: job.url,
        notes: job.description,
        createdAt: new Date().toISOString()
      });
      toast.success('Job saved to tracker!');
      fetchStats();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'trackedJobs');
      toast.error('Failed to save job.');
    }
  };

  // Memoize filtered and sorted jobs for performance
  const filteredAndSortedJobs = useMemo(() => {
    return jobs
      .filter((job) => {
        const matchCompany = job.company.toLowerCase().includes(filterCompany.toLowerCase());
        const matchLocation = job.location.toLowerCase().includes(filterLocation.toLowerCase());
        const matchSalary = job.salary.toLowerCase().includes(filterSalary.toLowerCase());
        return matchCompany && matchLocation && matchSalary;
      })
      .sort((a, b) => {
        if (sortBy === 'matchScore') return (b.matchScore || 0) - (a.matchScore || 0);
        if (sortBy === 'company') return a.company.localeCompare(b.company);
        if (sortBy === 'datePosted') {
          const dateA = a.datePosted ? new Date(a.datePosted).getTime() : 0;
          const dateB = b.datePosted ? new Date(b.datePosted).getTime() : 0;
          return dateB - dateA;
        }
        return 0;
      });
  }, [jobs, filterCompany, filterLocation, filterSalary, sortBy]);

  return {
    jobs,
    filteredAndSortedJobs,
    loadingJobs,
    refreshMessage,
    stats,
    statsLoading,
    fetchJobs,
    saveJob,
    filterCompany, setFilterCompany,
    filterLocation, setFilterLocation,
    filterSalary, setFilterSalary,
    sortBy, setSortBy
  };
}

```

### File: src/hooks/useDashboardAI.ts
```
import { useState } from 'react';
import { toast } from 'sonner';
import { Job } from '../types/dashboard';

export type AiActionType = 'email' | 'resume' | 'interview' | 'salary' | null;

export function useDashboardAI(profile: any) {
  const [aiAction, setAiAction] = useState<AiActionType>(null);
  const [aiResult, setAiResult] = useState<string | string[]>('');
  const [actionLoading, setActionLoading] = useState(false);

  const handleAiAction = async (action: AiActionType, job: Job) => {
    setAiAction(action);
    setActionLoading(true);
    setAiResult('');

    try {
      // Dynamically import only the necessary functions
      const aiService = await import('../services/aiService');

      if (action === 'email') {
        const email = await aiService.generateColdEmail(job.title, job.company, profile?.resumeText || '');
        setAiResult(email);
      } else if (action === 'resume') {
        const resume = await aiService.tailorResume(job.title, job.description, profile?.resumeText || '');
        setAiResult(resume);
      } else if (action === 'interview') {
        const questions = await aiService.generateInterviewQuestions(job.title, job.company);
        setAiResult(questions);
      } else if (action === 'salary') {
        const insights = await aiService.generateSalaryInsights(job.title, job.location);
        setAiResult(insights);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to generate AI content.");
    }
    
    setActionLoading(false);
  };

  const downloadResume = (job: Job | null) => {
    if (!aiResult || typeof aiResult !== 'string') return;
    const blob = new Blob([aiResult], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tailored_Resume_${job?.company?.replace(/\\s+/g, '_') || 'Job'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Resume downloaded successfully!");
  };

  return {
    aiAction, setAiAction,
    aiResult, setAiResult,
    actionLoading,
    handleAiAction,
    downloadResume
  };
}

```

### File: src/lib/utils.ts
```
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

```

### File: src/pages/Settings.tsx
```
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Save, Upload, X, Plus, Loader2 } from 'lucide-react';
import { suggestCareerPaths } from '../services/aiService';

const PREDEFINED_PATHS = [
  "Software Engineer", "Frontend Developer", "Backend Developer", "Full Stack Developer",
  "Product Manager", "Project Manager", "Data Scientist", "Data Analyst",
  "UX Designer", "UI Designer", "DevOps Engineer", "Marketing Manager"
];

export function Settings() {
  const { profile, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [formData, setFormData] = useState({
    careerPaths: [] as string[],
    jobType: 'remote',
    minSalary: '',
    resumeText: '',
    resumeAnalysis: undefined as any,
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        careerPaths: profile.careerPaths || [],
        jobType: profile.jobType || 'remote',
        minSalary: profile.minSalary?.toString() || '',
        resumeText: profile.resumeText || '',
        resumeAnalysis: profile.resumeAnalysis,
      });
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddPath = (path: string) => {
    if (path.trim() && !formData.careerPaths.includes(path.trim()) && formData.careerPaths.length < 10) {
      setFormData(prev => ({ ...prev, careerPaths: [...prev.careerPaths, path.trim()] }));
      setNewPath('');
    }
  };

  const handleRemovePath = (pathToRemove: string) => {
    setFormData(prev => ({ ...prev, careerPaths: prev.careerPaths.filter(p => p !== pathToRemove) }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Please upload a file smaller than 5MB.");
      return;
    }

    setAnalyzing(true);
    let text = '';
    
    try {
      if (file.type === 'text/plain' || file.name.endsWith('.md')) {
        text = await file.text();
      } else if (file.type === 'application/pdf') {
        const pdfWorkerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          text += pageText + '\n';
        }
      } else if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else {
        alert("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
        setAnalyzing(false);
        return;
      }
    } catch (err) {
      console.error("Error parsing file", err);
      alert("Could not parse the file. Please try a different format or paste the text directly.");
      setAnalyzing(false);
      return;
    }

    setFormData(prev => ({ ...prev, resumeText: text }));
    
    // Analyze resume for career paths and feedback
    if (text.trim()) {
      const paths = await suggestCareerPaths(text);
      if (paths && paths.length > 0) {
        setFormData(prev => ({ ...prev, careerPaths: paths }));
      }
      
      const { analyzeResume } = await import('../services/aiService');
      const analysis = await analyzeResume(text, paths || []);
      if (analysis) {
        setFormData(prev => ({ ...prev, resumeAnalysis: analysis }));
      }
    }
    setAnalyzing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await updateProfile({
      careerPaths: formData.careerPaths,
      jobType: formData.jobType,
      minSalary: formData.minSalary ? parseInt(formData.minSalary, 10) : null,
      resumeText: formData.resumeText,
      resumeAnalysis: formData.resumeAnalysis,
    });
    setSaving(false);
  };

  return (
    <div className="h-full overflow-y-auto pb-12 pr-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Settings</h1>
          <p className="text-zinc-500 mt-1">Manage your job search preferences and resume.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Job Preferences</CardTitle>
            <CardDescription>These preferences are used to curate your daily job feed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-700">Career Paths / Desired Titles</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.careerPaths.map(path => (
                  <div key={path} className="flex items-center bg-zinc-100 text-zinc-800 px-3 py-1.5 rounded-md text-sm border border-zinc-200">
                    {path}
                    <button onClick={() => handleRemovePath(path)} className="ml-2 text-zinc-400 hover:text-zinc-700">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {formData.careerPaths.length === 0 && (
                  <span className="text-sm text-zinc-500 italic">No career paths added. Upload your resume to auto-generate!</span>
                )}
              </div>
              
              <div className="flex gap-2 max-w-md mb-4">
                <Input 
                  placeholder="Add a custom career path..." 
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPath(newPath)}
                  disabled={formData.careerPaths.length >= 10}
                />
                <Button variant="secondary" onClick={() => handleAddPath(newPath)} disabled={!newPath.trim() || formData.careerPaths.length >= 10}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div>
                <p className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">Suggestions</p>
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_PATHS.filter(p => !formData.careerPaths.includes(p)).map(path => (
                    <button
                      key={path}
                      onClick={() => handleAddPath(path)}
                      disabled={formData.careerPaths.length >= 10}
                      className="text-xs bg-white border border-zinc-200 text-zinc-600 px-2.5 py-1 rounded-full hover:border-zinc-400 hover:text-zinc-900 transition-colors disabled:opacity-50"
                    >
                      + {path}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-100">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Work Type</label>
                <select 
                  name="jobType" 
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
                  value={formData.jobType}
                  onChange={handleChange}
                >
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                  <option value="any">Any</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Minimum Salary (USD)</label>
                <Input 
                  name="minSalary" 
                  type="number" 
                  placeholder="e.g. 120000" 
                  value={formData.minSalary} 
                  onChange={handleChange} 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resume</CardTitle>
            <CardDescription>Upload your resume (PDF/DOCX/TXT) or paste it below. This is used to tailor applications and calculate match scores.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button variant="outline" className="relative overflow-hidden" disabled={analyzing}>
                {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {analyzing ? 'Analyzing Resume...' : 'Upload Resume'}
                <input 
                  type="file" 
                  accept=".pdf,.txt,.md,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={analyzing}
                />
              </Button>
              <span className="text-xs text-zinc-500">Supports .pdf, .docx, .txt. Max 5MB. Uploading will auto-generate career paths.</span>
            </div>
            <Textarea 
              name="resumeText" 
              placeholder="Or paste your full resume text here..." 
              className="min-h-[300px] font-mono text-xs"
              value={formData.resumeText}
              onChange={handleChange}
            />
          </CardContent>
          <CardFooter className="flex justify-end border-t border-zinc-100 pt-6">
            <Button onClick={handleSave} disabled={saving || analyzing}>
              {saving ? 'Saving...' : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Preferences
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

```

### File: src/pages/Login.tsx
```
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Briefcase } from 'lucide-react';

export function Login() {
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-sm border border-zinc-200">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-zinc-900 mb-6">
            <Briefcase className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">Hireschema</h2>
          <p className="mt-2 text-sm text-zinc-500">
            The modern platform for mid to high-level job seekers.
          </p>
        </div>

        <div className="space-y-6 pt-4">
          <div className="rounded-lg bg-zinc-50 p-5 border border-zinc-100">
            <ul className="text-sm text-zinc-600 space-y-3">
              <li className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-2"></span> Curated daily job feed</li>
              <li className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-2"></span> Personalized cold emails</li>
              <li className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-2"></span> Resume tailoring</li>
              <li className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-2"></span> Kanban job tracking</li>
            </ul>
          </div>

          <Button className="w-full h-12 text-base" onClick={signInWithGoogle}>
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
              <path d="M1 1h22v22H1z" fill="none" />
            </svg>
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  );
}

```

### File: src/pages/Dashboard.tsx
```
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, List } from 'lucide-react';
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
    filteredAndSortedJobs, loadingJobs, refreshMessage,
    stats, statsLoading, fetchJobs, saveJob,
    filterCompany, setFilterCompany,
    filterLocation, setFilterLocation,
    filterSalary, setFilterSalary,
    sortBy, setSortBy
  } = useDashboardJobs(user, profile);

  const {
    aiAction, setAiAction,
    aiResult,
    actionLoading,
    handleAiAction,
    downloadResume
  } = useDashboardAI(profile);

  // Automatically fetch jobs if moving to matches and no jobs yet
  React.useEffect(() => {
    if (profile?.careerPaths && profile.careerPaths.length > 0 && filteredAndSortedJobs.length === 0 && activeTab === 'matches') {
      fetchJobs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, activeTab]);

  if (!profile?.resumeText) {
    return (
      <ResumeUploader 
        updateProfile={updateProfile} 
        profile={profile} 
        onSuccess={() => setActiveTab('overview')} 
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top Navigation / Tabs */}
      <div className="flex items-center gap-4 mb-6 border-b border-zinc-200 pb-4">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'overview' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
        >
          <LayoutDashboard className="h-4 w-4" /> Overview
        </button>
        <button 
          onClick={() => setActiveTab('matches')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'matches' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
        >
          <List className="h-4 w-4" /> Daily Matches
        </button>
      </div>

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
          className="flex h-full gap-6 overflow-hidden"
        >
          <MatchesTab 
            jobs={filteredAndSortedJobs}
            loadingJobs={loadingJobs}
            refreshMessage={refreshMessage}
            fetchJobs={fetchJobs}
            filterCompany={filterCompany} setFilterCompany={setFilterCompany}
            filterLocation={filterLocation} setFilterLocation={setFilterLocation}
            filterSalary={filterSalary} setFilterSalary={setFilterSalary}
            sortBy={sortBy} setSortBy={setSortBy}
            selectedJob={selectedJob} setSelectedJob={setSelectedJob}
            setAiAction={setAiAction}
          />

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
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

```

### File: src/pages/JobTracker.tsx
```
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ExternalLink, Trash2, MapPin, LayoutGrid, List, ChevronUp, ChevronDown, Mail, FileText, MessageSquare, Download, Loader2 } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { generateColdEmail, tailorResume, generateInterviewQuestions } from '../services/aiService';

interface TrackedJob {
  id: string;
  userId: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  status: string;
  url: string;
  notes: string;
  createdAt: string;
  updatedAt?: string;
  coldEmail?: string;
  tailoredResume?: string;
  interviewQuestions?: string | string[];
  contactEmail?: string;
}

const STATUSES = ['saved', 'applied', 'interviewing', 'offered', 'rejected'];

export function JobTracker() {
  const { user, profile } = useAuth();
  const [jobs, setJobs] = useState<TrackedJob[]>([]);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  
  // AI Action States for List View
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'trackedJobs'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobsData: TrackedJob[] = [];
      snapshot.forEach((doc) => {
        jobsData.push({ id: doc.id, ...doc.data() } as TrackedJob);
      });
      // Sort by created at descending
      jobsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setJobs(jobsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'trackedJobs');
    });

    return () => unsubscribe();
  }, [user]);

  const updateStatus = async (jobId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'trackedJobs', jobId), { status: newStatus, updatedAt: new Date().toISOString() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trackedJobs/${jobId}`);
    }
  };

  const removeJob = async (jobId: string) => {
    if (window.confirm('Are you sure you want to remove this job?')) {
      try {
        await deleteDoc(doc(db, 'trackedJobs', jobId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `trackedJobs/${jobId}`);
      }
    }
  };

  const handleGenerateAsset = async (job: TrackedJob, type: 'email' | 'resume' | 'interview') => {
    const loadingKey = `${job.id}-${type}`;
    setActionLoading(prev => ({ ...prev, [loadingKey]: true }));
    
    try {
      let updateData: Partial<TrackedJob> = {};
      
      if (type === 'email') {
        const email = await generateColdEmail(job.title, job.company, profile?.resumeText || '');
        updateData = { coldEmail: email };
      } else if (type === 'resume') {
        const resume = await tailorResume(job.title, job.notes || '', profile?.resumeText || '');
        updateData = { tailoredResume: resume };
      } else if (type === 'interview') {
        const questions = await generateInterviewQuestions(job.title, job.company);
        updateData = { interviewQuestions: questions };
      }

      await updateDoc(doc(db, 'trackedJobs', job.id), {
        ...updateData,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error generating asset:", error);
      alert("Failed to generate content. Please try again.");
    } finally {
      setActionLoading(prev => ({ ...prev, [loadingKey]: false }));
    }
  };

  const downloadResume = (resumeText: string, company: string) => {
    const blob = new Blob([resumeText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tailored_Resume_${company.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const updateContactEmail = async (jobId: string, email: string) => {
    try {
      await updateDoc(doc(db, 'trackedJobs', jobId), { contactEmail: email, updatedAt: new Date().toISOString() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trackedJobs/${jobId}`);
    }
  };

  const sendEmail = (job: TrackedJob) => {
    if (!job.coldEmail) return;
    const mailBody = encodeURIComponent(`${job.coldEmail}\n\nJob URL: ${job.url}`);
    const to = job.contactEmail ? `&to=${encodeURIComponent(job.contactEmail)}` : '';
    window.open(`https://mail.google.com/mail/?view=cm&fs=1${to}&su=Application for ${job.title}&body=${mailBody}`, '_blank');
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Job Tracker</h1>
          <p className="text-zinc-500 mt-1">Manage and track your job applications.</p>
        </div>
        <div className="flex bg-zinc-100 p-1 rounded-lg border border-zinc-200">
          <Button 
            variant={viewMode === 'board' ? 'default' : 'ghost'} 
            size="sm" 
            className={`h-8 px-3 ${viewMode === 'board' ? 'shadow-sm' : 'text-zinc-500'}`}
            onClick={() => setViewMode('board')}
          >
            <LayoutGrid className="h-4 w-4 mr-2" /> Board
          </Button>
          <Button 
            variant={viewMode === 'list' ? 'default' : 'ghost'} 
            size="sm" 
            className={`h-8 px-3 ${viewMode === 'list' ? 'shadow-sm' : 'text-zinc-500'}`}
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4 mr-2" /> History List
          </Button>
        </div>
      </div>

      {viewMode === 'board' ? (
        <Tooltip.Provider delayDuration={200}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 flex-1">
            {STATUSES.map(status => (
              <div key={status} className="bg-zinc-50/50 rounded-xl p-4 border border-zinc-200 h-[calc(100vh-180px)] flex flex-col">
                <h3 className="font-medium text-zinc-900 capitalize mb-4 flex items-center justify-between">
                  {status}
                  <Badge variant="secondary" className="font-normal">{jobs.filter(j => j.status === status).length}</Badge>
                </h3>
                
                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                  <AnimatePresence>
                    {jobs.filter(j => j.status === status).map((job, idx) => (
                      <motion.div
                        key={job.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card className="cursor-pointer hover:border-zinc-400 transition-colors">
                          <CardContent className="p-4">
                            <h4 className="font-medium text-sm text-zinc-900 leading-tight mb-1">{job.title}</h4>
                            <p className="text-xs text-zinc-600 mb-3">{job.company}</p>
                            
                            <div className="flex flex-wrap gap-1 mb-3">
                              {job.location && <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal"><MapPin className="mr-1 h-2 w-2" />{job.location}</Badge>}
                            </div>

                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-100">
                              <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                  <select 
                                    className="text-xs border-none bg-transparent text-zinc-500 cursor-pointer focus:ring-0 p-0 font-medium"
                                    value={job.status}
                                    onChange={(e) => updateStatus(job.id, e.target.value)}
                                  >
                                    {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                  </select>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                  <Tooltip.Content className="bg-zinc-900 text-white text-xs rounded py-1.5 px-2.5 shadow-md z-50" sideOffset={5}>
                                    <div className="font-medium mb-1">Status: {job.status.charAt(0).toUpperCase() + job.status.slice(1)}</div>
                                    <div className="text-zinc-300">Updated {formatDistanceToNow(new Date(job.updatedAt || job.createdAt), { addSuffix: true })}</div>
                                    <Tooltip.Arrow className="fill-zinc-900" />
                                  </Tooltip.Content>
                                </Tooltip.Portal>
                              </Tooltip.Root>
                              
                              <div className="flex gap-1">
                                {job.url && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-zinc-900" onClick={() => window.open(job.url, '_blank')}>
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeJob(job.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        </Tooltip.Provider>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 space-y-4 pb-8">
          {jobs.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">No jobs tracked yet.</div>
          ) : (
            jobs.map(job => (
              <Card key={job.id} className="overflow-hidden border-zinc-200">
                <div 
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-zinc-50 transition-colors"
                  onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                >
                  <div className="flex-1 grid grid-cols-4 gap-4 items-center">
                    <div className="col-span-2">
                      <h3 className="font-semibold text-zinc-900">{job.title}</h3>
                      <p className="text-sm text-zinc-500">{job.company} {job.location && `• ${job.location}`}</p>
                    </div>
                    <div>
                      <select 
                        className="text-sm border border-zinc-200 rounded-md bg-white text-zinc-700 px-2 py-1 focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                        value={job.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => { e.stopPropagation(); updateStatus(job.id, e.target.value); }}
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                      </select>
                    </div>
                    <div className="text-right text-sm text-zinc-400">
                      {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    {job.url && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900" onClick={(e) => { e.stopPropagation(); window.open(job.url, '_blank'); }}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900">
                      {expandedJobId === job.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedJobId === job.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-zinc-100 bg-zinc-50/50"
                    >
                      <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Cold Email Section */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm text-zinc-900 flex items-center"><Mail className="mr-2 h-4 w-4 text-zinc-500" /> Cold Email</h4>
                            {!job.coldEmail && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleGenerateAsset(job, 'email')} disabled={actionLoading[`${job.id}-email`]}>
                                {actionLoading[`${job.id}-email`] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate'}
                              </Button>
                            )}
                          </div>
                          {job.coldEmail ? (
                            <div className="bg-white border border-zinc-200 rounded-md p-3 text-xs text-zinc-600 max-h-48 overflow-y-auto whitespace-pre-wrap">
                              {job.coldEmail}
                            </div>
                          ) : (
                            <div className="text-xs text-zinc-400 italic">No cold email generated yet.</div>
                          )}
                          <div className="flex gap-2 items-center">
                            <input 
                              type="email" 
                              placeholder="Contact Email (Optional)" 
                              className="flex-1 text-xs border border-zinc-200 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                              value={job.contactEmail || ''}
                              onChange={(e) => updateContactEmail(job.id, e.target.value)}
                            />
                            {job.coldEmail && (
                              <Button size="sm" className="text-xs h-8 whitespace-nowrap" onClick={() => sendEmail(job)}>
                                Send via Gmail
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Tailored Resume Section */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm text-zinc-900 flex items-center"><FileText className="mr-2 h-4 w-4 text-zinc-500" /> Tailored Resume</h4>
                            {!job.tailoredResume && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleGenerateAsset(job, 'resume')} disabled={actionLoading[`${job.id}-resume`]}>
                                {actionLoading[`${job.id}-resume`] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate'}
                              </Button>
                            )}
                          </div>
                          {job.tailoredResume ? (
                            <div className="bg-white border border-zinc-200 rounded-md p-3 text-xs text-zinc-600 max-h-48 overflow-y-auto markdown-body prose prose-sm max-w-none">
                              <ReactMarkdown>{job.tailoredResume}</ReactMarkdown>
                            </div>
                          ) : (
                            <div className="text-xs text-zinc-400 italic">No tailored resume generated yet.</div>
                          )}
                          {job.tailoredResume && (
                            <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => downloadResume(job.tailoredResume!, job.company)}>
                              <Download className="mr-2 h-3 w-3" /> Download .md
                            </Button>
                          )}
                        </div>

                        {/* Interview Prep Section */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm text-zinc-900 flex items-center"><MessageSquare className="mr-2 h-4 w-4 text-zinc-500" /> Interview Q&A</h4>
                            {!job.interviewQuestions && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleGenerateAsset(job, 'interview')} disabled={actionLoading[`${job.id}-interview`]}>
                                {actionLoading[`${job.id}-interview`] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate'}
                              </Button>
                            )}
                          </div>
                          {job.interviewQuestions ? (
                            <div className="bg-white border border-zinc-200 rounded-md p-3 text-xs text-zinc-600 max-h-48 overflow-y-auto">
                              {Array.isArray(job.interviewQuestions) ? (
                                <ul className="list-decimal pl-4 space-y-2">
                                  {job.interviewQuestions.map((q, i) => <li key={i}>{q}</li>)}
                                </ul>
                              ) : (
                                <div className="markdown-body prose prose-sm max-w-none">
                                  <ReactMarkdown>{job.interviewQuestions as string}</ReactMarkdown>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-zinc-400 italic">No interview questions generated yet.</div>
                          )}
                        </div>
                      </div>
                      <div className="px-5 pb-4 flex justify-end">
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8" onClick={() => removeJob(job.id)}>
                          <Trash2 className="mr-2 h-3 w-3" /> Delete Job
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

```

### File: src/pages/LandingPage.tsx
```
import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Briefcase, Sparkles, Mail, FileText, LayoutGrid, TrendingUp, ArrowRight, CheckCircle2, Star, Zap, Shield, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

export function LandingPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50">Loading...</div>;
  }

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-zinc-200 overflow-x-hidden">
      {/* Navigation */}
      <nav className="border-b border-zinc-100 bg-white/80 backdrop-blur-md fixed top-0 w-full z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900">
              <Briefcase className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">Hireschema</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-500">
            <a href="#features" className="hover:text-zinc-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-zinc-900 transition-colors">How it Works</a>
            <a href="#pricing" className="hover:text-zinc-900 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors hidden sm:block">
              Sign in
            </Link>
            <Link to="/login">
              <Button size="sm" className="rounded-full px-5 shadow-sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-zinc-100/80 blur-[100px] rounded-full -z-10 pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-zinc-200 text-xs font-medium text-zinc-600 mb-8 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-zinc-900" />
              <span>Hireschema AI 2.0 is now live</span>
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-zinc-900 mb-6 leading-[1.1]">
              The unfair advantage <br className="hidden md:block" />
              <span className="text-zinc-400">for your job search.</span>
            </h1>
            <p className="text-lg md:text-xl text-zinc-500 mb-10 max-w-2xl mx-auto leading-relaxed">
              Stop endlessly scrolling job boards. Let AI find real, open roles, write your cold emails, tailor your resume, and track your applications.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/login">
                <Button size="lg" className="h-14 px-8 text-base rounded-full shadow-md hover:shadow-lg transition-all">
                  Start your search <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <span className="text-sm text-zinc-400 font-medium">No credit card required</span>
            </div>
          </motion.div>

          {/* Hero Abstract UI */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mt-20 relative mx-auto max-w-5xl"
          >
            <div className="rounded-2xl border border-zinc-200/80 bg-white/50 backdrop-blur-xl shadow-2xl p-2 md:p-4 overflow-hidden">
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 md:p-8">
                <div className="flex items-center justify-between mb-8 border-b border-zinc-200 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-200 animate-pulse"></div>
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-zinc-200 rounded animate-pulse"></div>
                      <div className="h-3 w-24 bg-zinc-100 rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="h-8 w-24 bg-zinc-900 rounded-full"></div>
                </div>
                <div className="space-y-4">
                  {[
                    { title: "Senior Frontend Engineer", company: "Vercel", time: "2h ago" },
                    { title: "Product Engineer", company: "Stripe", time: "5h ago" },
                    { title: "Full Stack Developer", company: "Linear", time: "1d ago" }
                  ].map((job, i) => (
                    <div key={i} className="h-20 w-full bg-white border border-zinc-100 rounded-lg shadow-sm p-4 flex items-center justify-between">
                      <div className="space-y-2 w-2/3">
                        <div className="text-sm font-semibold text-zinc-900">{job.title}</div>
                        <div className="text-xs text-zinc-500">{job.company} • {job.time}</div>
                      </div>
                      <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center">
                        <Briefcase className="h-4 w-4 text-zinc-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section id="features" className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16 md:mb-24">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Everything you need. <br className="hidden md:block"/> Nothing you don't.</h2>
            <p className="text-zinc-500 text-lg max-w-xl">We've automated the most tedious parts of the job search so you can focus on interviewing and landing offers.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Large Feature */}
            <div className="md:col-span-2 bg-zinc-50 rounded-3xl p-8 md:p-12 border border-zinc-100 relative overflow-hidden group">
              <div className="relative z-10">
                <div className="h-12 w-12 rounded-xl bg-white shadow-sm border border-zinc-200 flex items-center justify-center mb-6">
                  <Globe className="h-6 w-6 text-zinc-900" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Live Web Grounding</h3>
                <p className="text-zinc-500 max-w-md leading-relaxed">
                  Our AI doesn't hallucinate. It actively searches the web for real, currently open job postings from the last 48 hours that match your exact profile.
                </p>
              </div>
              {/* Decorative element */}
              <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 w-64 h-64 bg-zinc-200/50 rounded-full blur-3xl group-hover:bg-zinc-300/50 transition-colors"></div>
            </div>

            {/* Small Feature */}
            <div className="bg-zinc-900 text-white rounded-3xl p-8 md:p-12 relative overflow-hidden">
              <div className="h-12 w-12 rounded-xl bg-zinc-800 flex items-center justify-center mb-6">
                <Mail className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3">1-Click Cold Emails</h3>
              <p className="text-zinc-400 leading-relaxed">
                Instantly generate highly personalized cold emails for hiring managers based on the specific job.
              </p>
            </div>

            {/* Small Feature */}
            <div className="bg-white rounded-3xl p-8 md:p-12 border border-zinc-200 shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center mb-6">
                <FileText className="h-6 w-6 text-zinc-900" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Tailored Resumes</h3>
              <p className="text-zinc-500 leading-relaxed">
                Stop sending generic resumes. Automatically tweak your resume to highlight exact keywords.
              </p>
            </div>

            {/* Large Feature */}
            <div className="md:col-span-2 bg-zinc-50 rounded-3xl p-8 md:p-12 border border-zinc-100">
              <div className="h-12 w-12 rounded-xl bg-white shadow-sm border border-zinc-200 flex items-center justify-center mb-6">
                <LayoutGrid className="h-6 w-6 text-zinc-900" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Kanban Job Tracker</h3>
              <p className="text-zinc-500 max-w-md leading-relaxed">
                Keep your applications organized. Track statuses, notes, and generated assets in one place with our intuitive board and list views.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 bg-zinc-900 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">How it works</h2>
            <p className="text-zinc-400 text-lg">A streamlined workflow designed to get you hired faster.</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 relative">
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-px bg-zinc-800"></div>

            {[
              {
                step: "01",
                title: "Upload Resume",
                desc: "Drop in your current resume and set your desired salary, location, and job type."
              },
              {
                step: "02",
                title: "Review Matches",
                desc: "Check your dashboard daily for fresh, highly relevant, real-world job postings."
              },
              {
                step: "03",
                title: "Generate Assets",
                desc: "With one click, generate a tailored resume and a personalized cold email."
              },
              {
                step: "04",
                title: "Track Progress",
                desc: "Move jobs across your Kanban board from 'Applied' to 'Offered'."
              }
            ].map((item, i) => (
              <div key={i} className="relative pt-8 md:pt-0">
                <div className="w-12 h-12 rounded-full bg-zinc-800 border-4 border-zinc-900 flex items-center justify-center font-mono text-sm font-bold absolute top-0 left-0 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-10">
                  {item.step}
                </div>
                <div className="md:text-center md:pt-12 pl-16 md:pl-0">
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 md:py-32 bg-zinc-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Don't just take our word for it</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "I was spending 3 hours a day tweaking my resume for different jobs. Hireschema does it in 5 seconds. I got 4 interviews in my first week.",
                author: "Sarah J.",
                role: "Product Designer"
              },
              {
                quote: "The cold email generator is magic. It actually reads the job description and my resume and writes something that sounds like me, not a robot.",
                author: "Michael T.",
                role: "Frontend Engineer"
              },
              {
                quote: "Finally, a job tracker that actually helps you get the job instead of just being a glorified spreadsheet. The live web grounding is a game changer.",
                author: "Elena R.",
                role: "Marketing Manager"
              }
            ].map((t, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm">
                <div className="flex gap-1 mb-6">
                  {[1,2,3,4,5].map(star => <Star key={star} className="w-4 h-4 fill-zinc-900 text-zinc-900" />)}
                </div>
                <p className="text-zinc-700 leading-relaxed mb-6">"{t.quote}"</p>
                <div>
                  <p className="font-semibold text-zinc-900">{t.author}</p>
                  <p className="text-sm text-zinc-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 md:py-32">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Simple, transparent pricing</h2>
            <p className="text-zinc-500 text-lg">Start for free, upgrade when you need more power.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Tier */}
            <div className="bg-white p-8 md:p-10 rounded-3xl border border-zinc-200 shadow-sm">
              <h3 className="text-2xl font-bold mb-2">Basic</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-zinc-500">/forever</span>
              </div>
              <p className="text-zinc-500 mb-8 pb-8 border-b border-zinc-100">Perfect for casual job seekers getting started.</p>
              <ul className="space-y-4 mb-8">
                {['10 daily AI job matches', 'Basic resume tailoring', 'Standard Kanban board', 'Community support'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-zinc-700">
                    <CheckCircle2 className="w-5 h-5 text-zinc-900" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link to="/login">
                <Button className="w-full h-12 rounded-xl" variant="outline">Get Started Free</Button>
              </Link>
            </div>

            {/* Pro Tier */}
            <div className="bg-zinc-900 text-white p-8 md:p-10 rounded-3xl border border-zinc-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-white text-zinc-900 text-xs font-bold px-3 py-1 rounded-bl-lg">POPULAR</div>
              <h3 className="text-2xl font-bold mb-2">Pro</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold">$19</span>
                <span className="text-zinc-400">/month</span>
              </div>
              <p className="text-zinc-400 mb-8 pb-8 border-b border-zinc-800">For serious professionals who want to land offers fast.</p>
              <ul className="space-y-4 mb-8">
                {['Unlimited AI job matches', 'Advanced resume tailoring', '1-Click Cold Emails', 'Interview Q&A Generation', 'Salary Insights'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-zinc-300">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link to="/login">
                <Button className="w-full h-12 rounded-xl bg-white text-zinc-900 hover:bg-zinc-100">Upgrade to Pro</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-zinc-50 border-t border-zinc-100 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Ready to upgrade your job search?</h2>
          <p className="text-zinc-500 text-lg mb-10">
            Join professionals who are landing interviews faster with AI-powered tools.
          </p>
          <Link to="/login">
            <Button size="lg" className="h-14 px-8 text-base rounded-full shadow-md">
              Start your free search
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-12 border-t border-zinc-100">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-zinc-900">
                <Briefcase className="h-3 w-3 text-white" />
              </div>
              <span className="font-bold tracking-tight">Hireschema</span>
            </div>
            <p className="text-zinc-500 text-sm max-w-xs">The modern platform for mid to high-level job seekers to find, track, and land their dream roles.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li><a href="#features" className="hover:text-zinc-900">Features</a></li>
              <li><a href="#pricing" className="hover:text-zinc-900">Pricing</a></li>
              <li><a href="#" className="hover:text-zinc-900">Changelog</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li><a href="#" className="hover:text-zinc-900">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-zinc-900">Terms of Service</a></li>
              <li><a href="#" className="hover:text-zinc-900">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-zinc-100 text-center text-zinc-400 text-sm">
          <p>© {new Date().getFullYear()} Hireschema. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

```

### File: src/services/aiService.ts
```
import OpenAI from 'openai';

// Safely try to get the API key depending on environment (Vite vs Node)
const getApiKey = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_OPENAI_API_KEY) {
    return import.meta.env.VITE_OPENAI_API_KEY;
  }
  if (typeof process !== 'undefined' && process.env && process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }
  return 'MISSING_API_KEY';
};

const openai = new OpenAI({ 
  apiKey: getApiKey(),
  dangerouslyAllowBrowser: true // Required for client-side usage
});

export async function generateDailyJobs(careerPaths: string[], jobType: string, minSalary: number | null, resumeText: string) {
  const prompt = `You are an expert technical recruiter. Find 5 REAL, CURRENTLY OPEN job postings.
DO NOT generate dummy or fake jobs. Every job must be a realistic, recently open position found online.

Search for jobs matching these User Preferences:
- Career Paths/Desired Titles: ${careerPaths.join(', ')}
- Work Type: ${jobType}
- Minimum Salary: ${minSalary ? '$' + minSalary : 'Any'}

User Resume Context:
${resumeText.substring(0, 3000)}

INSTRUCTIONS:
1. Find recent job postings matching the user's career paths and work type.
2. Extract the exact job title, company, and location.
3. Calculate a "matchScore" (0-100) prioritizing how well the job aligns with the user's preferences and resume.

Return the results as a JSON array of objects with the following keys:
- title (string)
- company (string)
- location (string)
- salary (string)
- description (string)
- url (string) - Set this EXACTLY to: https://www.google.com/search?q=job+[Title]+at+[Company] (Replace [Title] and [Company] with the actual URL-encoded title and company name).
- requirements (array of strings)
- matchScore (number)
- datePosted (string) - The date the job was posted in ISO format (e.g. "2023-10-25T00:00:00Z"). If exact date is unknown, estimate based on "X days ago".

Respond ONLY with the JSON array. Do not include markdown formatting like \`\`\`json.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    if (response.choices[0]?.message?.content) {
      let text = response.choices[0].message.content.trim();
      // Sometimes the model still includes markdown despite instructions
      if (text.startsWith('```json')) {
        text = text.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (text.startsWith('```')) {
        text = text.replace(/^```/, '').replace(/```$/, '').trim();
      }
      return JSON.parse(text);
    }
    return [];
  } catch (error: any) {
    console.error("Error generating jobs:", error);
    if (error?.status === 429 || error?.message?.includes('quota')) {
      throw new Error("AI quota exceeded. Please try again later or check your API key plan.");
    }
    return [];
  }
}

export async function suggestCareerPaths(resumeText: string): Promise<string[]> {
  const prompt = `You are an expert career counselor. Based on the following resume, suggest 4 highly relevant and realistic career paths (job titles) that this person is well-suited for.
Keep the titles concise (e.g., "Senior Frontend Engineer", "Product Manager").

Resume Text:
${resumeText.substring(0, 3000)}

Return the results as a JSON array of 4 strings. Respond ONLY with the JSON array.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    if (response.choices[0]?.message?.content) {
      const parsed = JSON.parse(response.choices[0].message.content);
      return Array.isArray(parsed) ? parsed : (parsed.careerPaths || parsed.paths || Object.values(parsed)[0] || []);
    }
    return [];
  } catch (error) {
    console.error("Error suggesting career paths:", error);
    return [];
  }
}

export interface ResumeAnalysis {
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  summary: string;
}

export async function analyzeResume(resumeText: string, careerPaths: string[]): Promise<ResumeAnalysis | null> {
  const prompt = `You are an expert career coach and technical recruiter. Analyze the following resume in the context of the user's desired career paths: ${careerPaths.join(', ')}.
Provide a detailed breakdown highlighting strengths, weaknesses, and specific areas for improvement based on common job market trends.

Resume Text:
${resumeText.substring(0, 3000)}

Return the results as a JSON object with the following structure:
{
  "strengths": ["strength 1", "strength 2", ...],
  "weaknesses": ["weakness 1", "weakness 2", ...],
  "improvements": ["improvement 1", "improvement 2", ...],
  "summary": "A brief overall summary of the resume's effectiveness."
}

Respond ONLY with the JSON object.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    if (response.choices[0]?.message?.content) {
      return JSON.parse(response.choices[0].message.content);
    }
    return null;
  } catch (error) {
    console.error("Error analyzing resume:", error);
    return null;
  }
}

export async function generateColdEmail(jobTitle: string, company: string, resumeText: string) {
  const prompt = `You are an expert career coach. Write a highly personalized, professional, and concise cold email to a hiring manager or recruiter at ${company} for the ${jobTitle} position.
Use the following resume text to highlight the most relevant skills and experiences. Keep it under 200 words.

Resume Text:
${resumeText}

Return ONLY the email body.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });
    return response.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("Error generating cold email:", error);
    return "Error generating email. Please try again.";
  }
}

export async function generateInterviewQuestions(jobTitle: string, company: string) {
  const prompt = `You are an expert technical interviewer. Generate 5 highly relevant, challenging interview questions for a ${jobTitle} position at ${company}.
Include a mix of behavioral and technical/domain-specific questions.

Return the results as a JSON array of strings. Respond ONLY with the JSON array.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });
    
    if (response.choices[0]?.message?.content) {
      let text = response.choices[0].message.content.trim();
      if (text.startsWith('```json')) {
        text = text.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (text.startsWith('```')) {
        text = text.replace(/^```/, '').replace(/```$/, '').trim();
      }
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : (parsed.questions || Object.values(parsed)[0] || []);
    }
    return [];
  } catch (error) {
    console.error("Error generating interview questions:", error);
    return [];
  }
}

export async function generateSalaryInsights(jobTitle: string, location: string) {
  const prompt = `You are an expert compensation analyst. Provide brief, realistic salary insights for a "${jobTitle}" position in "${location}".
Include the estimated low, median, and high ranges, and briefly mention 2-3 factors that influence this salary (e.g., years of experience, specific skills).
Format the response in clean Markdown. Keep it concise.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });
    return response.choices[0]?.message?.content || "Could not generate salary insights.";
  } catch (error) {
    console.error("Error generating salary insights:", error);
    return "Error generating salary insights. Please try again.";
  }
}

export async function tailorResume(jobTitle: string, jobDescription: string, resumeText: string) {
  const prompt = `You are an expert resume writer. Tailor the following resume to better match the job description for a ${jobTitle} position.
Highlight the most relevant skills and experiences, and use keywords from the job description.

Job Description:
${jobDescription}

Original Resume:
${resumeText}

Return the tailored resume in Markdown format.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });
    return response.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("Error tailoring resume:", error);
    return "Error tailoring resume. Please try again.";
  }
}

```

### File: src/services/emailService.ts
```
import { Resend } from 'resend';

const getResendApiKey = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_RESEND_API_KEY) {
    return import.meta.env.VITE_RESEND_API_KEY;
  }
  return 'MISSING_API_KEY';
};

// Note: Using Resend from the frontend directly is not recommended for production
// because it exposes your API key. In a real app, this should be a backend endpoint.
const resend = new Resend(getResendApiKey());

export const sendSignupEmail = async (userEmail: string, userName: string) => {
  try {
    const data = await resend.emails.send({
      from: 'Hireschema <onboarding@resend.dev>',
      to: [userEmail],
      subject: 'Welcome to Hireschema!',
      html: `
        <div>
          <h1>Welcome to Hireschema, ${userName || 'Job Seeker'}!</h1>
          <p>We are thrilled to have you on board. Start by uploading your resume to let AI find the perfect roles for you.</p>
          <p>Happy job hunting!</p>
        </div>
      `,
    });
    return data;
  } catch (error) {
    console.error("Error sending signup email:", error);
    return null;
  }
};

export const sendDailyJobAlertsEmail = async (userEmail: string, jobs: any[]) => {
  if (!jobs || jobs.length === 0) return null;

  try {
    const data = await resend.emails.send({
      from: 'Hireschema Alerts <alerts@resend.dev>',
      to: [userEmail],
      subject: `Your Daily Job Matches - ${jobs.length} New Roles`,
      html: `
        <div>
          <h2>We found ${jobs.length} new jobs for you today!</h2>
          <ul>
            ${jobs.map(job => `
              <li style="margin-bottom: 12px;">
                <strong>${job.title}</strong> at ${job.company}<br/>
                <a href="${job.url}">Apply Here</a>
              </li>
            `).join('')}
          </ul>
        </div>
      `,
    });
    return data;
  } catch (error) {
    console.error("Error sending daily job alerts email:", error);
    return null;
  }
};

export const sendColdEmailViaResend = async (
  fromEmail: string,
  toEmail: string,
  subject: string,
  body: string,
  resumeFileName: string,
  resumeBase64: string
) => {
  try {
    // Note: Resend requires a verified domain. If 'fromEmail' is a gmail address, Resend will reject it.
    // For testing, we use the Resend testing domain.
    const data = await resend.emails.send({
      from: 'Hireschema Cold Email <onboarding@resend.dev>',
      to: [toEmail],
      reply_to: fromEmail,
      subject: subject,
      html: `<div><p>${body.replace(/\n/g, '<br/>')}</p></div>`,
      attachments: [
        {
          filename: resumeFileName,
          content: resumeBase64,
        },
      ],
    });
    return data;
  } catch (error) {
    console.error("Error sending cold email:", error);
    return null;
  }
};

```

