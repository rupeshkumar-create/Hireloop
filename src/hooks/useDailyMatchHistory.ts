import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { DailyJob } from '../types/dailyJob';
import type { DailyMatchRecord } from '../types/dailyJob';
import { jobFingerprint } from '../services/jobResearcher';

export interface HistoryJob extends DailyJob {
  saved: boolean;
}

export interface DailyMatchHistoryDay {
  date: string;
  generatedAt?: string;
  jobCount: number;
  jobs: HistoryJob[];
}

export function useDailyMatchHistory(user: { uid: string } | null | undefined) {
  const [days, setDays] = useState<DailyMatchHistoryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedFingerprints, setSavedFingerprints] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.uid) {
      setDays([]);
      setSavedFingerprints(new Set());
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const trackedSnap = await getDocs(
          query(collection(db, 'trackedJobs'), where('userId', '==', user.uid))
        );
        const fps = new Set<string>();
        trackedSnap.forEach((docSnap) => {
          const data = docSnap.data();
          fps.add(jobFingerprint(data.title || '', data.company || ''));
        });
        if (!cancelled) setSavedFingerprints(fps);

        const historySnap = await getDocs(
          collection(db, 'users', user.uid, 'daily_matches')
        );

        const parsed: DailyMatchHistoryDay[] = historySnap.docs
          .map((docSnap) => {
            const record = docSnap.data() as DailyMatchRecord;
            const jobs = (record.jobs || []).map((job) => ({
              ...job,
              saved: fps.has(jobFingerprint(job.title || '', job.company || '')),
            }));
            return {
              date: docSnap.id,
              generatedAt: record.generatedAt,
              jobCount: record.jobCount ?? jobs.length,
              jobs,
            };
          })
          .filter((day) => day.jobs.length > 0)
          .sort((a, b) => b.date.localeCompare(a.date));

        if (!cancelled) setDays(parsed);
      } catch (error) {
        console.error('[useDailyMatchHistory] load failed:', error);
        if (!cancelled) setDays([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const totals = useMemo(() => {
    let jobs = 0;
    let saved = 0;
    for (const day of days) {
      jobs += day.jobs.length;
      saved += day.jobs.filter((job) => job.saved).length;
    }
    return { days: days.length, jobs, saved, unsaved: jobs - saved };
  }, [days]);

  return { days, loading, totals, savedFingerprints };
}
