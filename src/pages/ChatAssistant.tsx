import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Send, Sparkles, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardJobsContext } from '../contexts/DashboardJobsContext';
import { sendChatMessage } from '../services/chatService';
import { listCandidateIntros } from '../services/connectionService';
import { useVoiceAgent } from '../hooks/useVoiceAgent';
import {
  type AgentChatMessage,
  type AgentChatMode,
  type AgentChatState,
  createAgentMessage,
  JACK_GREETING,
} from '../lib/agentChat';
import { readAgentChatState, agentChatPatch } from '../services/agentChatStorage';
import { JobMatchCard } from '../components/agent/JobMatchCard';
import { IntroRequestCard } from '../components/agent/IntroRequestCard';
import { ConnectWithRecruiterModal } from '../components/dashboard/ConnectWithRecruiterModal';
import { jobFingerprint } from '../services/jobResearcher';
import type { DailyJob } from '../types/dailyJob';
import type { IntroThread } from '../types/jill';

const MODE_CHIPS: { id: AgentChatMode; label: string }[] = [
  { id: 'default', label: 'Chat' },
  { id: 'mock_interview', label: 'Mock interview' },
  { id: 'salary_benchmark', label: 'Salary data' },
  { id: 'negotiation', label: 'Negotiate' },
  { id: 'career_clarity', label: 'Career clarity' },
];

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ChatAssistant() {
  const { profile, updateProfile, user } = useAuth();
  const {
    pendingJobs,
    saveJob,
    dismissJob,
    requestJobs,
    generatingJobs,
    topJobs,
  } = useDashboardJobsContext();

  const [chatState, setChatState] = useState<AgentChatState>(() => readAgentChatState(profile));
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [connectJob, setConnectJob] = useState<DailyJob | null>(null);
  const [trackedJobId, setTrackedJobId] = useState<string | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);
  const introSyncedRef = useRef<Set<string>>(new Set());
  const voiceEnabled = chatState.mode === 'mock_interview';
  const voice = useVoiceAgent(voiceEnabled);
  const [voiceOn, setVoiceOn] = useState(false);

  const persistChat = useCallback(
    async (next: AgentChatState) => {
      setChatState(next);
      if (updateProfile) {
        await updateProfile(agentChatPatch(next));
      }
    },
    [updateProfile]
  );

  useEffect(() => {
    if (!profile || hydratedRef.current) return;
    hydratedRef.current = true;
    const stored = readAgentChatState(profile);
    if (stored.messages.length === 0) {
      void persistChat({
        ...stored,
        messages: [createAgentMessage('assistant', JACK_GREETING)],
      });
    } else {
      setChatState(stored);
    }
  }, [profile, persistChat]);

  const syncIntroUpdates = useCallback(
    async (intros: IntroThread[]) => {
      const updates = intros.filter((intro) => {
        if (!['recruiter_accepted', 'recruiter_declined', 'scheduled'].includes(intro.threadStatus || '')) {
          return false;
        }
        return !introSyncedRef.current.has(`${intro.id}:${intro.threadStatus}`);
      });
      if (!updates.length) return;

      const newMessages = updates.map((intro) => {
        introSyncedRef.current.add(`${intro.id}:${intro.threadStatus}`);
        const status =
          intro.threadStatus === 'recruiter_accepted'
            ? 'recruiter_accepted'
            : intro.threadStatus === 'scheduled'
              ? 'scheduled'
              : 'recruiter_declined';
        return createAgentMessage(
          'assistant',
          intro.jackNarration || `Update on your ${intro.jobTitle} intro.`,
          {
            type: 'intro',
            introId: intro.id,
            company: intro.company,
            jobTitle: intro.jobTitle,
            recruiterName: intro.recruiterName,
            status,
          }
        );
      });

      await persistChat({
        ...chatState,
        messages: [...chatState.messages, ...newMessages],
      });
    },
    [chatState, persistChat]
  );

  useEffect(() => {
    if (!user) return;
    const load = () => {
      listCandidateIntros()
        .then((intros) => void syncIntroUpdates(intros))
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [user, syncIntroUpdates]);

  const systemContext = useMemo(() => {
    const parts: string[] = [];
    if (profile?.displayName) parts.push(`Name: ${profile.displayName}`);
    if (profile?.careerPaths?.length) parts.push(`Career paths: ${profile.careerPaths.join(', ')}`);
    if (profile?.resumeSummary) parts.push(`Resume summary: ${profile.resumeSummary.slice(0, 1200)}`);
    if (profile?.location) parts.push(`Location: ${profile.location}`);
    if (profile?.minSalary) parts.push(`Salary floor: $${profile.minSalary}`);
    if (pendingJobs.length) {
      parts.push(
        `Pending matches (${pendingJobs.length}): ${pendingJobs
          .slice(0, 5)
          .map((j) => `${j.title} at ${j.company}`)
          .join('; ')}`
      );
    }
    if (topJobs.length) {
      parts.push(`Today's top matches: ${topJobs.length} roles scored.`);
    }
    return parts.join('\n');
  }, [profile, pendingJobs, topJobs]);

  const deliverMatches = useCallback(async () => {
    if (!pendingJobs.length) return;
    const date = todayUtc();
    if (chatState.lastMatchDeliveryDate === date && chatState.deliveredMatchFps.length > 0) {
      const undelivered = pendingJobs.filter(
        (j) => !chatState.deliveredMatchFps.includes(jobFingerprint(j.title, j.company))
      );
      if (!undelivered.length) return;
    }

    const toDeliver = pendingJobs.filter(
      (j) => !chatState.deliveredMatchFps.includes(jobFingerprint(j.title, j.company))
    );
    if (!toDeliver.length) return;

    const newMessages: AgentChatMessage[] = [
      createAgentMessage(
        'assistant',
        toDeliver.length === 1
          ? "I found one role worth your time — tell me yes or no and I'll keep refining."
          : `I searched while you were away — here are ${toDeliver.length} roles worth a look.`
      ),
    ];

    const fps: string[] = [...chatState.deliveredMatchFps];
    for (const job of toDeliver.slice(0, 5)) {
      const fp = jobFingerprint(job.title, job.company);
      fps.push(fp);
      newMessages.push(
        createAgentMessage('assistant', '', {
          type: 'job_match',
          job,
          fingerprint: fp,
        })
      );
    }

    await persistChat({
      ...chatState,
      messages: [...chatState.messages, ...newMessages],
      deliveredMatchFps: fps,
      lastMatchDeliveryDate: date,
    });
  }, [pendingJobs, chatState, persistChat]);

  useEffect(() => {
    if (hydratedRef.current && pendingJobs.length > 0) {
      void deliverMatches();
    }
  }, [pendingJobs.length, deliverMatches]);

  const appendMessage = async (msg: AgentChatMessage) => {
    const next = { ...chatState, messages: [...chatState.messages, msg] };
    await persistChat(next);
    return next;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = createAgentMessage('user', text);
    const withUser = { ...chatState, messages: [...chatState.messages, userMsg] };
    setChatState(withUser);
    setInput('');
    setLoading(true);

    try {
      const apiMessages = withUser.messages
        .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content))
        .slice(-16)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const reply = await sendChatMessage(apiMessages, {
        systemContext,
        mode: chatState.mode,
      });

      await persistChat({
        ...withUser,
        messages: [...withUser.messages, createAgentMessage('assistant', reply)],
      });
      if (voiceOn && chatState.mode === 'mock_interview') {
        voice.speak(reply.slice(0, 800));
      }
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Chat failed');
    } finally {
      setLoading(false);
    }
  };

  const handleJobYes = async (job: DailyJob) => {
    setActionBusy(true);
    try {
      const id = await saveJob(job);
      if (id) setTrackedJobId(id);
      await appendMessage(
        createAgentMessage('assistant', `Saved **${job.title}** at ${job.company} to your pipeline. Want me to request an introduction or run a mock interview?`)
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleJobNo = async (job: DailyJob) => {
    setActionBusy(true);
    try {
      await dismissJob(job);
      await appendMessage(
        createAgentMessage('assistant', `Got it — I'll deprioritize similar roles. Still searching for better fits.`)
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleRequestIntro = (job: DailyJob) => {
    setConnectJob(job);
  };

  const setMode = async (mode: AgentChatMode) => {
    const hints: Record<AgentChatMode, string> = {
      default: "Back to general chat — ask me anything about your search.",
      mock_interview: "Let's run a mock interview. Which role should we practice for? I'll ask one question at a time.",
      salary_benchmark: "Tell me the role and location — I'll show market bands and whether your target is competitive.",
      negotiation: "Share the offer you received (or expect). I'll coach you on counters and exact language.",
      career_clarity: "Let's get clear on what you want next. What's the biggest fork in the road for you right now?",
      onboarding: JACK_GREETING,
    };
    await persistChat({
      ...chatState,
      mode,
      messages: [...chatState.messages, createAgentMessage('assistant', hints[mode])],
    });
  };

  const handleRunScout = async () => {
    try {
      await requestJobs();
      await appendMessage(
        createAgentMessage('assistant', "Searching the market now — I'll drop new matches here when they're ready.")
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Scout failed');
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-[var(--hs-app-border)] px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--hs-app-accent)] text-white text-sm font-bold">
              J
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--hs-app-fg)]">Jack</h1>
              <p className="text-xs text-[var(--hs-app-muted)]">Your AI career agent</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleRunScout()}
            disabled={generatingJobs}
            className="hs-btn hs-btn-primary text-sm"
          >
            {generatingJobs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Search jobs
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {MODE_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => void setMode(chip.id)}
              className={[
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                chatState.mode === chip.id
                  ? 'bg-[var(--hs-app-accent)] text-white'
                  : 'border border-[var(--hs-app-border)] text-[var(--hs-app-muted)] hover:border-[var(--hs-app-accent)]',
              ].join(' ')}
            >
              {chip.label}
            </button>
          ))}
          {chatState.mode === 'mock_interview' && voice.supported ? (
            <button
              type="button"
              onClick={() => setVoiceOn((v) => !v)}
              className={[
                'rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1',
                voiceOn ? 'bg-violet-600 text-white' : 'border border-[var(--hs-app-border)] text-[var(--hs-app-muted)]',
              ].join(' ')}
            >
              {voiceOn ? <Volume2 className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
              Voice {voiceOn ? 'on' : 'off'}
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {chatState.messages.map((message) => (
            <div
              key={message.id}
              className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div className="max-w-[95%]">
                {message.content ? (
                  <div
                    className={[
                      'rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                      message.role === 'user'
                        ? 'bg-[var(--hs-app-accent)] text-white'
                        : 'border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] text-[var(--hs-app-fg)]',
                    ].join(' ')}
                  >
                    {message.content}
                  </div>
                ) : null}
                {(() => {
                  const att = message.attachment;
                  if (att?.type !== 'job_match') return null;
                  return (
                    <JobMatchCard
                      job={att.job}
                      busy={actionBusy}
                      onYes={() => void handleJobYes(att.job)}
                      onNo={() => void handleJobNo(att.job)}
                      onIntro={() => handleRequestIntro(att.job)}
                    />
                  );
                })()}
                {message.attachment?.type === 'intro' ? (
                  <IntroRequestCard
                    company={message.attachment.company}
                    jobTitle={message.attachment.jobTitle}
                    recruiterName={message.attachment.recruiterName}
                    status={message.attachment.status}
                  />
                ) : null}
              </div>
            </div>
          ))}
          {loading ? (
            <div className="mr-auto flex items-center gap-2 rounded-2xl border border-[var(--hs-app-border)] px-4 py-3 text-sm text-[var(--hs-app-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Jack is thinking…
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-[var(--hs-app-border)] px-4 py-4 md:px-6">
        <form
          className="mx-auto flex max-w-3xl gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              chatState.mode === 'mock_interview'
                ? "Answer Jack's question…"
                : 'Message Jack…'
            }
            className="flex-1 rounded-xl border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] px-4 py-3 text-sm text-[var(--hs-app-fg)]"
          />
          <button
            type="button"
            onClick={() => {
              if (voice.listening) {
                voice.stopListening();
                return;
              }
              voice.listen((transcript) => {
                setInput(transcript);
              });
            }}
            disabled={!voiceEnabled || !voice.supported}
            className="hs-btn px-3"
            title="Voice input"
          >
            {voice.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="hs-btn hs-btn-primary px-4"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>

      {connectJob && profile ? (
        <ConnectWithRecruiterModal
          job={connectJob}
          profile={profile}
          open={Boolean(connectJob)}
          trackedJobId={trackedJobId}
          onClose={() => setConnectJob(null)}
          onIntroSent={(recruiterName, narration, warm) => {
            void appendMessage(
              createAgentMessage(
                'assistant',
                narration || `Introduction sent to ${recruiterName}. I'll notify you when they respond.`,
                {
                  type: 'intro',
                  introId: `local-${Date.now()}`,
                  company: connectJob.company,
                  jobTitle: connectJob.title,
                  recruiterName,
                  status: 'accepted',
                }
              )
            );
            if (warm) {
              void appendMessage(
                createAgentMessage('assistant', 'This is a warm intro through Jill — skipped the application queue.')
              );
            }
            setConnectJob(null);
          }}
        />
      ) : null}
    </div>
  );
}
