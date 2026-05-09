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
  doc,
  getDoc,
  setDoc,
  onSnapshot,
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
import { resolveDeliveryTimeZone, resolveLocalDateForLastFetch, resolveTodayLocalDateKey } from '../lib/localDate';


type GeneratedTrackedJobAssets = {
  coldEmail?: string;
  tailoredResume?: string;
  interviewQuestions?: string | string[];
};

export function useDashboardJobs(user: any, profile: any, updateProfile: any) {
  const [jobs, setJobs] = useState<DailyJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(null);
  const [dailyJobsMeta, setDailyJobsMeta] = useState<Record<string, any> | null>(null);
  const [dismissedFingerprints, setDismissedFingerprints] = useState<string[]>([]);

  const [stats, setStats] = useState({ saved: 0, applied: 0, interviewing: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  // Filters & sorting
  const [filterCompany, setFilterCompany] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterSalary, setFilterSalary] = useState('');
  const [filterWorkType, setFilterWorkType] = useState<'remote' | 'all'>('remote');
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

  useEffect(() => {
    if (!user) return;
    setStatsLoading(true);

    const q = query(collection(db, 'trackedJobs'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let saved = 0, applied = 0, interviewing = 0;
      snapshot.forEach((d) => {
        const data = d.data();
        const status = data.status || 'saved';
        if (status === 'saved') saved++;
        if (status === 'applied') applied++;
        if (status === 'interviewing') interviewing++;
      });
      
      const nextStats = {
        saved,
        applied,
        interviewing,
        total: snapshot.size
      };
      setStats(nextStats as any);
      setStatsLoading(false);
    }, (error) => {
      console.error('[useDashboardJobs] stats listener failed:', error);
      setStatsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const fetchStats = () => {
    // No-op now as we use onSnapshot
  };


  // ── Load jobs from Firestore ────────────────────────────────────────────────

  const loadJobs = async () => {
    if (!user || !profile) return;
    setLoadingJobs(true);

    try {
      const now = new Date();
      const timeZone = resolveDeliveryTimeZone(profile);
      const today = resolveTodayLocalDateKey(now, profile);
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
          setDailyJobsMeta({
            requestedLimit: record.requestedLimit ?? limit,
            returnedCount: record.returnedCount ?? fetched.length,
            qualityFilteredCount: record.qualityFilteredCount ?? 0,
            dedupedCount: record.dedupedCount ?? 0,
            qualityLimited: record.qualityLimited === true,
            warnings: record.warnings || [],
            deliveryTimezone: record.deliveryTimezone || timeZone,
            deliveryLocalDate: record.deliveryLocalDate || today,
          });
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
        const fetchDate = resolveLocalDateForLastFetch(profile, now);
        if (fetchDate && fetchDate === today) {
          const cached: DailyJob[] = (profile.dailyJobs || []).slice(0, limit);
          setJobs(cached);
          setDailyJobsMeta(profile.dailyJobsMeta || null);
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

    const now = new Date();
    const today = resolveTodayLocalDateKey(now, profile);
    const fetchDate = resolveLocalDateForLastFetch(profile, now);

    if (fetchDate === today && profile.dailyJobs && profile.dailyJobs.length > 0) {
      const limit = getDailyMatchLimit(profile?.plan);
      const freshJobs = (profile.dailyJobs as DailyJob[]).slice(0, limit);
      setJobs(freshJobs);
      setDailyJobsMeta(profile.dailyJobsMeta || null);
      setLastFetchTime(profile.lastJobFetchTime || null);
      if (generatingJobs) {
        setGeneratingJobs(false);
        toast.success(`${freshJobs.length} jobs curated for you!`);
      }
    } else if (fetchDate === today && generatingJobs) {
      // Pipeline completed today but stored 0 jobs — clear spinner and inform user.
      setGeneratingJobs(false);
      toast.info(
        "No matching jobs found this time. Try adding more career paths or uploading a more detailed resume.",
        { duration: 8000 }
      );
    }
  }, [profile?.lastJobFetchTime]);

  // ── On-demand job generation ────────────────────────────────────────────────

  const requestJobs = async () => {
    if (!user || generatingJobs) return;

    // Prevent redundant runs only when today's batch is already at the
    // plan cap. A Pro user who upgraded after a Free run (1 stored job)
    // must still be able to regenerate up to 10.
    //
    // VITE_ALLOW_UNLIMITED_REGEN=true (in .env or Vercel env) lifts this
    // gate entirely — useful while iterating on the matching pipeline.
    // Leave it unset (or "false") in production so users don't burn
    // Apify/OpenRouter credits with rapid re-clicks.
    const allowUnlimitedRegen =
      String(import.meta.env.VITE_ALLOW_UNLIMITED_REGEN || '').toLowerCase() === 'true';
    const now = new Date();
    const today = resolveTodayLocalDateKey(now, profile);
    const fetchDate = resolveLocalDateForLastFetch(profile, now);
    const planCap = getDailyMatchLimit(profile?.plan);

    if (!allowUnlimitedRegen && fetchDate === today && jobs.length >= planCap) {
      toast.info("Scout has already found your matches for today. Come back tomorrow for a fresh batch!");
      return;
    }

    setGeneratingJobs(true);


    // Track whether we handed off to GitHub Actions async pipeline.
    // If true we must NOT clear generatingJobs in finally — the reactive
    // useEffect above will clear it when Firestore delivers the jobs.
    let asyncDispatched = false;

    try {
      const idToken = await user.getIdToken(true);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout

      // ── Path A: async dispatch via GitHub Actions (preferred) ──────────────
      // Returns 202 immediately; GitHub Actions runs the full pipeline and
      // writes results to Firestore; the useEffect above displays them.
      const requestResponse = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ mode: 'request' }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (requestResponse.ok && requestResponse.status !== 202) {
        const payload = await requestResponse.json().catch(() => ({}));
        const fetchedJobs: DailyJob[] = Array.isArray((payload as any).jobs)
          ? (payload as any).jobs.slice(0, getDailyMatchLimit(profile?.plan))
          : [];

        setJobs(fetchedJobs);
        setDailyJobsMeta({
          requestedLimit: (payload as any).requestedLimit ?? getDailyMatchLimit(profile?.plan),
          returnedCount: (payload as any).jobCount ?? fetchedJobs.length,
          deliveryLocalDate: (payload as any).runDate,
          deliveryTimezone: resolveDeliveryTimeZone(profile),
          qualityLimited: fetchedJobs.length === 0,
        });
        setLastFetchTime(new Date().toISOString());

        if (fetchedJobs.length > 0) {
          toast.success(`${fetchedJobs.length} jobs curated for you!`);
        } else {
          toast.info(
            (payload as any).message ||
            "No matching jobs found this time. Try broadening your career paths or work preferences.",
            { duration: 8000 }
          );
        }
        return;
      }

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

      let message = `Job dispatch failed (HTTP ${requestResponse.status})`;
      try {
        const reqErr = await requestResponse.json().catch(() => ({}));
        if (reqErr && typeof (reqErr as any).error === 'string' && (reqErr as any).error.trim()) {
          message = (reqErr as any).error.trim();
          const debug = (reqErr as any).debug;
          const detail =
            debug && typeof debug === 'object'
              ? ((debug as any).failureReason || (debug as any).emptyReason)
              : (reqErr as any).detail;
          if (typeof detail === 'string' && detail.trim()) {
            message = `${message}: ${detail.trim()}`;
          }
        } else {
          const text = await requestResponse.text().catch(() => '');
          const trimmed = text.trim();
          if (trimmed) {
            message = trimmed.slice(0, 400);
          }
        }
      } catch {
        // keep default message
      }
      toast.error(message);
      return;
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
        const passesWorkType =
          filterWorkType === 'all' ||
          job.workType === 'remote' ||
          (job.location || '').toLowerCase().includes('remote');
        return (
          !dismissedFingerprints.includes(fp) &&
          passesWorkType &&
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
  }, [jobs, dismissedFingerprints, filterWorkType, filterCompany, filterLocation, filterSalary, sortBy]);

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
    dailyJobsMeta,
    nextJobDeliveryAt: profile?.nextJobDeliveryAt || null,
    matchReadiness: profile?.matchReadiness || null,
    saveJob,
    dismissJob,
    trackJobClick,
    filterCompany, setFilterCompany,
    filterLocation, setFilterLocation,
    filterSalary, setFilterSalary,
    filterWorkType, setFilterWorkType,
    sortBy, setSortBy,
  };
}
