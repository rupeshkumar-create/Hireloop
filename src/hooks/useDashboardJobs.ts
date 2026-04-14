import { useState, useMemo, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Job, SortOption } from '../types/dashboard';
import { generateDailyJobs, generateColdEmail, tailorResume, generateInterviewQuestions, updateLearningProfile } from '../services/aiService';
import { jobFingerprint } from '../services/serperService';
import { sendDailyJobAlertsEmail } from '../services/emailService';

// Max fingerprints to store per user (~10/day × 30 days = 300)
const MAX_SEEN_FINGERPRINTS = 300;

// Helper to determine the most recent 8:00 AM IST (which is 2:30 AM UTC)
function getMostRecent8AMIST(): Date {
  const now = new Date();
  const mostRecent = new Date(now);
  mostRecent.setUTCHours(2, 30, 0, 0);

  // If current UTC time is before 2:30 AM, the most recent 8:00 AM IST was yesterday
  if (now.getUTCHours() < 2 || (now.getUTCHours() === 2 && now.getUTCMinutes() < 30)) {
    mostRecent.setUTCDate(mostRecent.getUTCDate() - 1);
  }

  return mostRecent;
}

export function useDashboardJobs(user: any, profile: any, updateProfile: any) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  
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

  // Load jobs from profile if they exist
  useEffect(() => {
    if (profile?.dailyJobs && jobs.length === 0 && !loadingJobs) {
      setJobs(profile.dailyJobs);
    }
  }, [profile?.dailyJobs]);

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

  const fetchJobs = async (forceRefresh: boolean = false) => {
    if (!profile?.careerPaths || profile.careerPaths.length === 0) {
      toast.error("Please set your Career Paths in Settings first.");
      return;
    }

    // Determine if we actually need to fetch
    const mostRecent8AM = getMostRecent8AMIST();
    const lastFetch = profile.lastJobFetchTime ? new Date(profile.lastJobFetchTime) : null;
    
    // If not forcing, and we already fetched after the most recent 8 AM IST, just use cached jobs
    if (!forceRefresh && lastFetch && lastFetch >= mostRecent8AM && profile.dailyJobs && profile.dailyJobs.length > 0) {
      setJobs(profile.dailyJobs);
      return;
    }

    setLoadingJobs(true);
    try {
      // Load fingerprints of jobs already shown to this user (deduplication)
      const seenFingerprints: string[] = profile.seenJobFingerprints || [];

      // Pro gets 10, free gets 1
      const limit = profile?.plan === 'pro' ? 10 : 1;
      const results = await generateDailyJobs(
        profile.careerPaths,
        'remote',
        profile.minSalary || null,
        profile.resumeText || '',
        limit,
        seenFingerprints,
        profile.learningProfile?.jobPreferences || ''
      );
      setJobs(results);

      // Build updated fingerprint list - append new jobs, cap at MAX_SEEN_FINGERPRINTS
      const newFingerprints = results.map((j: Job) => jobFingerprint(j.title, j.company));
      const updatedSeen = [
        ...new Set([...seenFingerprints, ...newFingerprints])
      ].slice(-MAX_SEEN_FINGERPRINTS);

      // Save jobs + updated seen list to profile
      const fetchTime = new Date().toISOString();
      const todayDate = fetchTime.split('T')[0];
      
      await setDoc(doc(db, 'users', user.uid), {
        dailyJobs: results,
        lastJobFetchTime: fetchTime,
        seenJobFingerprints: updatedSeen,
      }, { merge: true });

      // Save historical matches by date
      if (results.length > 0) {
        await setDoc(doc(db, 'users', user.uid, 'daily_matches', todayDate), {
          jobs: results,
          fetchedAt: fetchTime
        }, { merge: true });
      }

      // Send the job alerts email via Resend if enabled
      if (results.length > 0 && user?.email && profile?.receiveDailyAlerts !== false) {
        sendDailyJobAlertsEmail(user.email, results).catch(console.error);
      }

      if (results.length === 0) {
        toast.error("Could not find any matching jobs right now. Please try adjusting your preferences.");
      } else {
        toast.success(`Found ${results.length} new jobs matching your profile!`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch jobs.");
    } finally {
      setLoadingJobs(false);
    }
  };

  const saveJob = async (job: Job) => {
    if (!user) return;
    try {
      const docRef = await addDoc(collection(db, 'trackedJobs'), {
        userId: user.uid,
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary,
        status: 'saved',
        url: job.url,
        notes: job.description,
        createdAt: new Date().toISOString(),
        aiAssets: null // Will be populated if Pro
      });
      toast.success('Job saved to tracker!');
      fetchStats();

      // Pro features: Auto-generate AI assets & trigger self-learning
      if (profile?.plan === 'pro' && profile?.resumeText) {
        toast.info('Generating AI assets in the background...');
        Promise.all([
          generateColdEmail(job.title, job.company, profile.resumeText, true, profile.learningProfile?.writingStyle),
          tailorResume(job.title, job.description, profile.resumeText, true, profile.learningProfile?.writingStyle),
          generateInterviewQuestions(job.title, job.company, true)
        ]).then(async ([email, resume, questions]) => {
          await setDoc(doc(db, 'trackedJobs', docRef.id), {
            coldEmail: email,
            tailoredResume: resume,
            interviewQuestions: questions
          }, { merge: true });
          toast.success('AI assets ready for ' + job.company);
        }).catch(err => {
          console.error('Background AI generation failed:', err);
        });

        // Trigger Self-Learning Background Process
        if (profile) {
          const actionData = `Saved job: ${job.title} at ${job.company}`;
          updateLearningProfile('save_job', actionData, profile.learningProfile?.jobPreferences)
            .then(newPrefs => {
              updateProfile({
                learningProfile: { ...profile.learningProfile, jobPreferences: newPrefs }
              });
            }).catch(err => console.error('Self-learning failed:', err));
        }
      }
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
    stats,
    statsLoading,
    fetchJobs,
    lastFetchTime: profile?.lastJobFetchTime,
    saveJob,
    filterCompany, setFilterCompany,
    filterLocation, setFilterLocation,
    filterSalary, setFilterSalary,
    sortBy, setSortBy
  };
}
