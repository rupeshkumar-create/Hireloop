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
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { generateColdEmail, tailorResume, generateInterviewQuestions, improveTextWithAI, updateLearningProfile } from '../services/aiService';
import { ResumePreviewModal } from '../components/dashboard/ResumePreviewModal';

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
  const { user, profile, updateProfile } = useAuth();
  const [jobs, setJobs] = useState<TrackedJob[]>([]);
  const [viewMode, setViewMode] = useState<'board' | 'list'>(() => {
    return (localStorage.getItem('jobTrackerViewMode') as 'board' | 'list') || 'board';
  });
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailText, setEmailText] = useState('');
  const [emailInstruction, setEmailInstruction] = useState('');
  const [editingResume, setEditingResume] = useState(false);
  const [resumeText, setResumeText] = useState('');
  const [resumeInstruction, setResumeInstruction] = useState('');
  const [previewResumeData, setPreviewResumeData] = useState<{text: string, company: string} | null>(null);

  // When expanding a new job, reset edit states
  useEffect(() => {
    if (expandedJobId) {
      setEditingEmail(false);
      setEditingResume(false);
      const job = jobs.find(j => j.id === expandedJobId);
      if (job) {
        setEmailText(job.coldEmail || '');
        setResumeText(job.tailoredResume || '');
      }
    }
  }, [expandedJobId, jobs]);

  useEffect(() => {
    localStorage.setItem('jobTrackerViewMode', viewMode);
  }, [viewMode]);
  
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

  const handleImproveText = async (job: TrackedJob, type: 'email' | 'resume') => {
    const loadingKey = `${job.id}-${type}-improve`;
    setActionLoading(prev => ({ ...prev, [loadingKey]: true }));
    try {
      if (type === 'email') {
        const newText = await improveTextWithAI(emailText, emailInstruction, profile?.learningProfile?.writingStyle);
        setEmailText(newText);
        setEmailInstruction('');
        toast.success('Cold email improved!');
      } else {
        const newText = await improveTextWithAI(resumeText, resumeInstruction, profile?.learningProfile?.writingStyle);
        setResumeText(newText);
        setResumeInstruction('');
        toast.success('Tailored resume improved!');
      }
    } catch (e) {
      toast.error('Failed to improve text.');
    } finally {
      setActionLoading(prev => ({ ...prev, [loadingKey]: false }));
    }
  };

  const handleSaveEditedText = async (job: TrackedJob, type: 'email' | 'resume') => {
    try {
      const updateData = type === 'email' ? { coldEmail: emailText } : { tailoredResume: resumeText };
      await updateDoc(doc(db, 'trackedJobs', job.id), {
        ...updateData,
        updatedAt: new Date().toISOString()
      });
      toast.success('Changes saved!');
      
      // Update learning profile
      if (profile && updateProfile) {
        const actionType = type === 'email' ? 'edit_email' : 'edit_resume';
        const actionData = type === 'email' ? emailText : resumeText;
        updateLearningProfile(actionType, actionData, profile.learningProfile?.writingStyle)
          .then(newStyle => {
            updateProfile({
              learningProfile: { ...profile.learningProfile, writingStyle: newStyle }
            });
          });
      }

      if (type === 'email') setEditingEmail(false);
      else setEditingResume(false);
    } catch (e) {
      toast.error('Failed to save changes.');
    }
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
    const mailBody = encodeURIComponent(`${job.coldEmail}\n\nJob URL: ${job.url}\n\n[Please see my resume attached]`);
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
                        <div className="space-y-3 relative">
                          {profile?.plan !== 'pro' && (
                            <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-lg border border-zinc-200">
                              <p className="text-sm font-medium text-zinc-900 mb-2">Pro Feature</p>
                              <Button size="sm" onClick={() => window.location.href = '/settings'}>Upgrade to Unlock</Button>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm text-zinc-900 flex items-center"><Mail className="mr-2 h-4 w-4 text-zinc-500" /> Cold Email</h4>
                            <div className="flex gap-2">
                              {job.coldEmail && !editingEmail && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingEmail(true)}>Edit</Button>
                              )}
                              {!job.coldEmail && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleGenerateAsset(job, 'email')} disabled={actionLoading[`${job.id}-email`]}>
                                  {actionLoading[`${job.id}-email`] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate'}
                                </Button>
                              )}
                            </div>
                          </div>
                          {editingEmail ? (
                            <div className="space-y-2">
                              <textarea 
                                className="w-full h-48 text-xs p-3 border border-zinc-200 rounded-md focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                                value={emailText}
                                onChange={(e) => setEmailText(e.target.value)}
                              />
                              <div className="flex gap-2 items-center">
                                <input 
                                  type="text" 
                                  placeholder="e.g. Make it shorter and more aggressive" 
                                  className="flex-1 text-xs border border-indigo-200 bg-indigo-50/30 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  value={emailInstruction}
                                  onChange={(e) => setEmailInstruction(e.target.value)}
                                />
                                <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!emailInstruction || actionLoading[`${job.id}-email-improve`]} onClick={() => handleImproveText(job, 'email')}>
                                  {actionLoading[`${job.id}-email-improve`] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'AI Improve'}
                                </Button>
                              </div>
                              <div className="flex justify-end gap-2 mt-2">
                                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingEmail(false)}>Cancel</Button>
                                <Button size="sm" className="h-8 text-xs" onClick={() => handleSaveEditedText(job, 'email')}>Save Changes</Button>
                              </div>
                            </div>
                          ) : job.coldEmail ? (
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
                            {job.coldEmail && !editingEmail && (
                              <Button size="sm" className="text-xs h-8 whitespace-nowrap" onClick={() => sendEmail(job)}>
                                Send via Gmail
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Tailored Resume Section */}
                        <div className="space-y-3 relative">
                          {profile?.plan !== 'pro' && (
                            <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-lg border border-zinc-200">
                              <p className="text-sm font-medium text-zinc-900 mb-2">Pro Feature</p>
                              <Button size="sm" onClick={() => window.location.href = '/settings'}>Upgrade to Unlock</Button>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm text-zinc-900 flex items-center"><FileText className="mr-2 h-4 w-4 text-zinc-500" /> Tailored Resume</h4>
                            <div className="flex gap-2">
                              {job.tailoredResume && !editingResume && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingResume(true)}>Edit</Button>
                              )}
                              {!job.tailoredResume && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleGenerateAsset(job, 'resume')} disabled={actionLoading[`${job.id}-resume`]}>
                                  {actionLoading[`${job.id}-resume`] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate'}
                                </Button>
                              )}
                            </div>
                          </div>
                          {editingResume ? (
                            <div className="space-y-2">
                              <textarea 
                                className="w-full h-48 text-xs p-3 border border-zinc-200 rounded-md focus:ring-2 focus:ring-zinc-900 focus:outline-none font-mono"
                                value={resumeText}
                                onChange={(e) => setResumeText(e.target.value)}
                              />
                              <div className="flex gap-2 items-center">
                                <input 
                                  type="text" 
                                  placeholder="e.g. Focus more on Leadership skills" 
                                  className="flex-1 text-xs border border-indigo-200 bg-indigo-50/30 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  value={resumeInstruction}
                                  onChange={(e) => setResumeInstruction(e.target.value)}
                                />
                                <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!resumeInstruction || actionLoading[`${job.id}-resume-improve`]} onClick={() => handleImproveText(job, 'resume')}>
                                  {actionLoading[`${job.id}-resume-improve`] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'AI Improve'}
                                </Button>
                              </div>
                              <div className="flex justify-end gap-2 mt-2">
                                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingResume(false)}>Cancel</Button>
                                <Button size="sm" className="h-8 text-xs" onClick={() => handleSaveEditedText(job, 'resume')}>Save Changes</Button>
                              </div>
                            </div>
                          ) : job.tailoredResume ? (
                            <div id={`resume-${job.id}`} className="bg-white border border-zinc-200 rounded-md p-3 text-xs text-zinc-600 max-h-48 overflow-y-auto markdown-body prose prose-sm max-w-none">
                              <ReactMarkdown>{job.tailoredResume}</ReactMarkdown>
                            </div>
                          ) : (
                            <div className="text-xs text-zinc-400 italic">No tailored resume generated yet.</div>
                          )}
                          {job.tailoredResume && !editingResume && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => setPreviewResumeData({text: job.tailoredResume!, company: job.company})}>
                                <FileText className="mr-2 h-3 w-3" /> Preview & Download
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Interview Prep Section */}
                        <div className="space-y-3 relative">
                          {profile?.plan !== 'pro' && (
                            <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-lg border border-zinc-200">
                              <p className="text-sm font-medium text-zinc-900 mb-2">Pro Feature</p>
                              <Button size="sm" onClick={() => window.location.href = '/settings'}>Upgrade to Unlock</Button>
                            </div>
                          )}
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
      <ResumePreviewModal 
        isOpen={!!previewResumeData}
        onClose={() => setPreviewResumeData(null)}
        resumeText={previewResumeData?.text || ''}
        companyName={previewResumeData?.company || ''}
      />
    </div>
  );
}
