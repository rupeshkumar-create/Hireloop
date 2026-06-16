import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
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

    const q = query(collection(db, 'trackedJobs'), where('userId', '==', userId));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TrackedJob, 'id'>) }));
        rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setJobs(rows);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [userId]);

  return { trackedJobs: jobs, loadingTrackedJobs: loading };
}
