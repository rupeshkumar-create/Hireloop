import { useEffect, useState } from 'react';
import { subscribeTrackedJobs } from '../services/trackedJobsService';
import type { TrackedJob } from '../lib/trackedJob';

export function useTrackedJobsList(userId: string | undefined) {
  const [jobs, setJobs] = useState<TrackedJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setJobs([]);
      setLoading(false);
      return;
    }

    const unsub = subscribeTrackedJobs(
      userId,
      (rows) => {
        const sorted = [...rows].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setJobs(sorted);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [userId]);

  return { trackedJobs: jobs, loadingTrackedJobs: loading };
}
