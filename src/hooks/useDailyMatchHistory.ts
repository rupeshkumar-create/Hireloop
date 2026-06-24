import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import { fetchTrackedJobs } from '../services/trackedJobsService';
import type { DailyJob } from '../types/dailyJob';
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
        const tracked = await fetchTrackedJobs(user.uid);
        const fps = new Set<string>();
        for (const job of tracked) {
          fps.add(jobFingerprint(job.title || '', job.company || ''));
        }
        if (!cancelled) setSavedFingerprints(fps);

        const { data: historyRows, error } = await getSupabaseBrowserClient()
          .from('daily_matches')
          .select('match_date, jobs, meta')
          .eq('user_id', user.uid);

        if (error) throw error;

        const parsed: DailyMatchHistoryDay[] = (historyRows || [])
          .map((row) => {
            const jobs = ((row.jobs || []) as DailyJob[]).map((job) => ({
              ...job,
              saved: fps.has(jobFingerprint(job.title || '', job.company || '')),
            }));
            const meta = (row.meta || {}) as Record<string, unknown>;
            return {
              date: row.match_date as string,
              generatedAt: typeof meta.generatedAt === 'string' ? meta.generatedAt : undefined,
              jobCount: typeof meta.jobCount === 'number' ? meta.jobCount : jobs.length,
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
