/**
 * useDashboardJobs
 *
 * Reads today's pre-computed daily job matches from Firestore.
 * Job generation happens entirely server-side (cron pipeline) — this hook
 * never calls external APIs or LLMs directly.
 *
 * Data flow:
 *   Cron → Firestore users/{uid}/daily_matches/{date}
 *   Hook  → reads that document → exposes jobs to the UI
 *
 * Falls back to the last-fetched cache on the user doc when today's record
 * does not yet exist (e.g. before midnight cron fires).
 */
import { useState, useMemo, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { toast } from 'sonner';
import type { DailyJob } from '../types/dailyJob';
import type { Job, SortOption } from '../types/dashboard';
import {
  generateColdEmail,
  tailorResume,
  generateInterviewQuestions,
  updateLearningProfile,
} from '../services/aiService';
import { jobFingerprint } from '../services/jobResearcher';
import {
  applyLearningEvent,
  type LearningEventJob,
  type LearningSignals,
} from '../services/learningSignals';
import { getDailyMatchLimit, isProPlan } from '../lib/planLimits';
import { resolveJobApplicationUrl } from '../lib/jobLinks';


type GeneratedTrackedJobAssets = {
  coldEmail?: string;
  tailoredResume?: string;
  interviewQuestions?: string | string[];
};

/** Returns today's date string in YYYY-MM-DD (IST, UTC+5:30). */
function getTodayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split('T')[0];
}

export function useDashboardJobs(user: any, profile: any, updateProfile: any) {
  const [jobs, setJobs] = useState<DailyJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(null);
  const [dismissedFingerprints, setDismissedFingerprints] = useState<string[]>([]);

  const [stats, setStats] = useState({ saved: 0, applied: 0, interviewing: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  // Filters & sorting
  const [filterCompany, setFilterCompany] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterSalary, setFilterSalary] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('matchScore');

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  // Auto-load jobs when the profile is ready, or when the cron updates lastJobFetchTime
  useEffect(() => {
    if (profile && user && !loadingJobs) {
      loadJobs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.uid ?? profile?.email, profile?.lastJobFetchTime]);

  // ── Stats ───────────────────────────────────────────────────────────────────

  const fetchStats = async () => {
    if (!user) return;
    setStatsLoading(true);
    try {
      const q = query(collection(db, 'trackedJobs'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      let saved = 0, applied = 0, interviewing = 0;
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.status === 'saved') saved++;
        if (data.status === 'applied') applied++;
        if (data.status === 'interviewing') interviewing++;
      });
      setStats({ saved, applied, interviewing });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // ── Load jobs from Firestore ────────────────────────────────────────────────

  const loadJobs = async () => {
    if (!user || !profile) return;
    setLoadingJobs(true);

    try {
      const today = getTodayIST();
      const limit = getDailyMatchLimit(profile?.plan);

      // 1. Try today's pre-computed record from the daily_matches subcollection.
      //    Read errors (e.g. rules not yet deployed) are caught separately so they
      //    never block the fallback paths below.
      let foundInDaily = false;
      try {
        const dailyRef = doc(db, 'users', user.uid, 'daily_matches', today);
        const dailySnap = await getDoc(dailyRef);
        if (dailySnap.exists()) {
          const record = dailySnap.data();
          const fetched: DailyJob[] = (record.jobs || []).slice(0, limit);
          setJobs(fetched);
          setLastFetchTime(record.generatedAt || today);
          foundInDaily = true;
        }
      } catch (subErr) {
        // Permission-denied or network error on the subcollection — fall through
        console.warn('[useDashboardJobs] daily_matches read failed, trying profile cache:', subErr);
      }
      if (foundInDaily) return;

      // 2. Fall back to today's cached batch on the user doc — only if it's from today
      if (profile.dailyJobs && profile.dailyJobs.length > 0) {
        const fetchDate = profile.lastJobFetchTime
          ? profile.lastJobFetchTime.split('T')[0]
          : null;
        if (fetchDate === today) {
          const cached: DailyJob[] = (profile.dailyJobs || []).slice(0, limit);
          setJobs(cached);
          setLastFetchTime(profile.lastJobFetchTime || null);
          return;
        }
        // stale cache from a previous day — fall through to empty state
      }

      // 3. No jobs at all — show empty state (handled in the UI via jobs.length === 0)
    } catch (error) {
      console.error('[useDashboardJobs] loadJobs failed:', error);
    } finally {
      setLoadingJobs(false);
    }
  };

  // Kept for Dashboard backward-compat (called when tab switches to Matches)
  const fetchJobs = async (_forceRefresh: boolean = false) => {
    await loadJobs();
  };

  // ── On-demand job generation ────────────────────────────────────────────────

  const [generatingJobs, setGeneratingJobs] = useState(false);

  // ── Reactive: show jobs as soon as Firestore delivers them ─────────────────
  // AuthContext's onSnapshot keeps `profile` in sync with Firestore.
  // When the scheduled cron or the "Generate now" button writes new dailyJobs
  // to the user document, this effect picks them up immediately — no page refresh.
  useEffect(() => {
    if (!profile) return;

    const today = getTodayIST();
    const fetchDate = profile.lastJobFetchTime
      ? profile.lastJobFetchTime.split('T')[0]
      : null;

    if (fetchDate === today && profile.dailyJobs && profile.dailyJobs.length > 0) {
      const limit = getDailyMatchLimit(profile?.plan);
      const freshJobs = (profile.dailyJobs as DailyJob[]).slice(0, limit);
      setJobs(freshJobs);
      setLastFetchTime(profile.lastJobFetchTime || null);
      if (generatingJobs) {
        setGeneratingJobs(false);
        toast.success(`${freshJobs.length} jobs curated for you!`);
      }
    }
  }, [profile?.lastJobFetchTime]);

  // ── On-demand job generation ────────────────────────────────────────────────

  const requestJobs = async () => {
    if (!user || generatingJobs) return;
    setGeneratingJobs(true);

    // Track whether we handed off to GitHub Actions async pipeline.
    // If true we must NOT clear generatingJobs in finally — the reactive
    // useEffect above will clear it when Firestore delivers the jobs.
    let asyncDispatched = false;

    try {
      const idToken = await user.getIdToken();

      // ── Path A: async dispatch via GitHub Actions (preferred) ──────────────
      // Returns 202 immediately; GitHub Actions runs the full pipeline and
      // writes results to Firestore; the useEffect above displays them.
      const requestResponse = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ mode: 'request' }),
      });

      if (requestResponse.status === 202) {
        asyncDispatched = true;
        toast.info(
          'Searching live job boards for your top matches… ' +
          'Your dashboard will update automatically in about 2 minutes.',
          { duration: 10000 }
        );
        // Safety valve: clear spinner after 6 minutes regardless
        setTimeout(() => setGeneratingJobs(false), 6 * 60 * 1000);
        return;
      }

      // Any 5xx here means the async dispatch path is unavailable, so fall back
      // to the synchronous trigger endpoint instead of leaving the user stuck.
      // Only non-server errors like 401/4xx should surface immediately.
      if (requestResponse.status < 500) {
        const reqErr = await requestResponse.json().catch(() => ({}));
        toast.error((reqErr as any).error || `Job dispatch failed (HTTP ${requestResponse.status})`);
        return;
      }

      // ── Path B: synchronous fallback (GitHub Actions not configured) ───────
      // Falls back to the merged /api/jobs endpoint in trigger mode and runs inline. Works on Vercel Pro
      // or any plan with a function timeout ≥ 90 seconds.
      const triggerResponse = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ mode: 'trigger' }),
      });

      if (!triggerResponse.ok) {
        const errBody = await triggerResponse.json().catch(() => ({}));
        const msg = (errBody as any).error || `Job generation failed (HTTP ${triggerResponse.status})`;
        toast.error(msg);
        return;
      }

      const data = await triggerResponse.json();
      const generated: DailyJob[] = data.jobs || [];
      if (generated.length > 0) {
        const limit = getDailyMatchLimit(profile?.plan);
        setJobs(generated.slice(0, limit));
        toast.success(`${generated.length} jobs curated for you!`);
      } else {
        toast.info(
          "We couldn't find matching jobs right now. " +
          'Try adding career paths or uploading a more detailed resume.'
        );
      }
    } catch (err) {
      console.error('[useDashboardJobs] requestJobs failed:', err);
      toast.error('Failed to generate jobs. Please try again.');
    } finally {
      // Only clear the spinner here if we did NOT hand off to the async pipeline.
      // On the async (202) path the spinner is cleared by the reactive effect
      // (or the 6-minute safety-valve timeout set above).
      if (!asyncDispatched) {
        setGeneratingJobs(false);
      }
    }
  };

  // ── Learning signal persistence ─────────────────────────────────────────────

  const persistLearningSignals = async (signals: LearningSignals) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), { learningSignals: signals }, { merge: true });
  };

  const recordLearningEvent = async (
    eventType: 'saved' | 'dismissed' | 'applied' | 'clicked',
    job: LearningEventJob
  ) => {
    const nextSignals = applyLearningEvent(profile?.learningSignals, eventType, job);
    await persistLearningSignals(nextSignals);
    if (updateProfile) await updateProfile({ learningSignals: nextSignals });
  };

  // ── Tracked-job asset persistence ──────────────────────────────────────────

  const persistTrackedJobAssets = async (
    jobId: string,
    assets: GeneratedTrackedJobAssets
  ) => {
    const timestamp = new Date().toISOString();
    const entries = Object.entries(assets).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return typeof value === 'string' && value.trim().length > 0;
    }) as Array<[keyof GeneratedTrackedJobAssets, string | string[]]>;

    for (const [field, value] of entries) {
      await setDoc(
        doc(db, 'trackedJobs', jobId),
        { [field]: value, updatedAt: timestamp },
        { merge: true }
      );
    }
  };

  // ── Save job ────────────────────────────────────────────────────────────────

  const saveJob = async (job: Job): Promise<boolean> => {
    if (!user) return false;
    try {
      const applicationUrl = resolveJobApplicationUrl(job);
      const docRef = await addDoc(collection(db, 'trackedJobs'), {
        userId: user.uid,
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary,
        status: 'saved',
        url: applicationUrl || '',
        notes: job.description,
        createdAt: new Date().toISOString(),
      });

      try {
        await recordLearningEvent('saved', {
          title: job.title,
          company: job.company,
          description: job.description,
          requirements: job.requirements,
        });
      } catch (err) {
        console.error('Failed to record saved-job learning event:', err);
      }

      toast.success('Job saved to tracker!');
      fetchStats();

      // Pro: auto-generate AI assets in the background
      if (isProPlan(profile?.plan) && profile?.resumeText) {
        toast.info('Generating AI assets in the background…');
        Promise.allSettled([
          generateColdEmail(job.title, job.company, profile.resumeText, true, profile.learningProfile?.writingStyle),
          tailorResume(job.title, job.description, profile.resumeText, true, profile.learningProfile?.writingStyle),
          generateInterviewQuestions(job.title, job.company, true),
        ]).then(async (results) => {
          const generatedAssets: GeneratedTrackedJobAssets = {};
          const [emailRes, resumeRes, interviewRes] = results;
          if (emailRes.status === 'fulfilled') generatedAssets.coldEmail = emailRes.value;
          if (resumeRes.status === 'fulfilled') generatedAssets.tailoredResume = resumeRes.value;
          if (interviewRes.status === 'fulfilled') generatedAssets.interviewQuestions = interviewRes.value;

          if (Object.keys(generatedAssets).length > 0) {
            await persistTrackedJobAssets(docRef.id, generatedAssets);
            toast.success('AI assets ready for ' + job.company);
          }
        }).catch(console.error);

        // Trigger self-learning
        if (profile) {
          updateLearningProfile('save_job', `Saved job: ${job.title} at ${job.company}`, profile.learningProfile?.jobPreferences)
            .then((newPrefs) => {
              updateProfile({ learningProfile: { ...profile.learningProfile, jobPreferences: newPrefs } });
            })
            .catch(console.error);
        }
      }

      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'trackedJobs');
      toast.error('Failed to save job.');
      return false;
    }
  };

  // ── Dismiss / track click ───────────────────────────────────────────────────

  const dismissJob = async (job: Job) => {
    const fp = jobFingerprint(job.title, job.company);
    setDismissedFingerprints((cur) => (cur.includes(fp) ? cur : [...cur, fp]));
    try {
      await recordLearningEvent('dismissed', {
        title: job.title,
        company: job.company,
        description: job.description,
        requirements: job.requirements,
      });
    } catch (err) {
      console.error('Failed to record dismissed-job learning event:', err);
    }
  };

  const trackJobClick = async (job: Job) => {
    try {
      await recordLearningEvent('clicked', {
        title: job.title,
        company: job.company,
        description: job.description,
        requirements: job.requirements,
      });
    } catch (err) {
      console.error('Failed to record clicked-job learning event:', err);
    }
  };

  // ── Memoized filtered + sorted list ────────────────────────────────────────

  const filteredAndSortedJobs = useMemo(() => {
    return jobs
      .filter((job) => {
        const fp = jobFingerprint(job.title || '', job.company || '');
        return (
          !dismissedFingerprints.includes(fp) &&
          (job.company || '').toLowerCase().includes(filterCompany.toLowerCase()) &&
          (job.location || '').toLowerCase().includes(filterLocation.toLowerCase()) &&
          (job.salary || '').toLowerCase().includes(filterSalary.toLowerCase())
        );
      })
      .sort((a, b) => {
        if (sortBy === 'matchScore') return (b.matchScore ?? 0) - (a.matchScore ?? 0);
        if (sortBy === 'company') return a.company.localeCompare(b.company);
        if (sortBy === 'datePosted') {
          return new Date(b.postedAt ?? 0).getTime() - new Date(a.postedAt ?? 0).getTime();
        }
        return 0;
      });
  }, [jobs, dismissedFingerprints, filterCompany, filterLocation, filterSalary, sortBy]);

  return {
    jobs,
    filteredAndSortedJobs,
    loadingJobs,
    generatingJobs,
    requestJobs,
    stats,
    statsLoading,
    fetchJobs,
    lastFetchTime,
    saveJob,
    dismissJob,
    trackJobClick,
    filterCompany, setFilterCompany,
    filterLocation, setFilterLocation,
    filterSalary, setFilterSalary,
    sortBy, setSortBy,
  };
}
