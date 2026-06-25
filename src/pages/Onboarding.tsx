import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Send, Upload, Linkedin, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { isOnboardingComplete } from '../lib/onboarding';
import { createAgentMessage, JACK_ONBOARDING_GREETING, type AgentChatMessage } from '../lib/agentChat';
import { sendChatMessage } from '../services/chatService';
import { triggerScoutRun } from '../lib/triggerScout';
import { ResumeUploader } from '../components/dashboard/ResumeUploader';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { useResumeParser } from '../hooks/useResumeParser';
import { useLinkedInImporter } from '../hooks/useLinkedInImporter';
import { JobMatchCard } from '../components/agent/JobMatchCard';
import type { DailyJob } from '../types/dailyJob';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import {
  buildResumeTextFromOAuthUser,
  extractLinkedInProfileUrlFromUser,
  signedInWithLinkedIn,
} from '../lib/authOAuth';
import { normalizeLinkedInProfileUrl } from '../lib/linkedinUrl';

type OnboardingPhase = 'chat' | 'resume' | 'linkedin_confirm' | 'scout' | 'matches';

export function Onboarding() {
  const { profile, updateProfile, loading } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<AgentChatMessage[]>([
    createAgentMessage('assistant', JACK_ONBOARDING_GREETING),
  ]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [phase, setPhase] = useState<OnboardingPhase>('chat');
  const [scoutRunning, setScoutRunning] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scoutStartedRef = useRef(false);

  const { processResumeText } = useResumeParser(updateProfile, profile);
  const {
    importFromLinkedIn,
    importing,
    linkedinInput,
    setLinkedinInput,
    preview,
    loadLinkedInPreview,
    confirmPreview,
    setOAuthPreview,
    clearPreview,
  } = useLinkedInImporter(updateProfile, profile, processResumeText);

  const linkedinBootstrapRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, phase, preview]);

  useEffect(() => {
    if (loading || !profile || linkedinBootstrapRef.current) return;
    if (profile.resumeText?.trim()) return;

    void (async () => {
      const { data } = await getSupabaseBrowserClient().auth.getUser();
      const user = data.user;
      if (!signedInWithLinkedIn(user)) return;

      linkedinBootstrapRef.current = true;
      setPhase('linkedin_confirm');
      setMessages((prev) => [
        ...prev,
        createAgentMessage(
          'assistant',
          "You're signed in with LinkedIn — I'll pull your profile so you can confirm it before we search for roles."
        ),
      ]);

      const linkedinUrl = extractLinkedInProfileUrlFromUser(user);
      if (linkedinUrl) {
        setLinkedinInput(linkedinUrl);
        const loaded = await loadLinkedInPreview(linkedinUrl);
        if (loaded) return;
      }

      const fallbackText = buildResumeTextFromOAuthUser(user);
      if (fallbackText.length >= 10) {
        const guessedUrl =
          linkedinUrl ||
          (typeof user?.user_metadata?.provider_id === 'string'
            ? normalizeLinkedInProfileUrl(`https://linkedin.com/in/${user.user_metadata.provider_id}`)
            : null) ||
          '';
        if (guessedUrl) setLinkedinInput(guessedUrl);
        setOAuthPreview({
          linkedinUrl: guessedUrl,
          resumeText: fallbackText,
          displayName: user?.user_metadata?.full_name || user?.user_metadata?.name || profile.displayName,
          headline: user?.user_metadata?.headline,
          photoUrl: user?.user_metadata?.avatar_url || user?.user_metadata?.picture || profile.photoURL,
        });
      }
    })();
  }, [loading, profile?.uid, profile?.resumeText]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background">Loading...</div>;
  }
  if (isOnboardingComplete(profile)) {
    return <Navigate to="/chat" replace />;
  }

  const hasResume = Boolean(profile?.resumeText?.trim());
  const hasPaths = (profile?.careerPaths?.length || 0) > 0;
  const hasMatches = (profile?.dailyJobs?.length || 0) > 0;

  const finish = async () => {
    const now = new Date().toISOString();
    await updateProfile({
      onboardingCompletedAt: now,
      firstSessionCompletedAt: now,
    });
    navigate('/chat?welcome=1');
  };

  const pushAssistant = (content: string, attachment?: AgentChatMessage['attachment']) => {
    setMessages((prev) => [...prev, createAgentMessage('assistant', content, attachment)]);
  };

  const handleChatSend = async () => {
    const text = input.trim();
    if (!text || chatLoading) return;

    const userMsg = createAgentMessage('user', text);
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setChatLoading(true);

    try {
      const ctx = [
        profile?.displayName ? `Name: ${profile.displayName}` : '',
        hasResume ? 'Resume: uploaded' : 'Resume: not yet',
        hasPaths ? `Paths: ${profile?.careerPaths?.join(', ')}` : 'Paths: pending',
      ]
        .filter(Boolean)
        .join('\n');

      const reply = await sendChatMessage(
        next.filter((m) => m.content).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })).slice(-12),
        { systemContext: ctx, mode: 'onboarding' }
      );
      pushAssistant(reply);

      if (!hasResume && /linkedin|resume|upload|cv|paste/i.test(text)) {
        setPhase('resume');
        pushAssistant('Perfect — paste your LinkedIn URL below or upload your resume. I\'ll parse it and pick your top career paths.');
      } else if (hasResume && !hasPaths) {
        setPhase('resume');
        pushAssistant('I\'m parsing your background — confirm your career paths on the next screen, then I\'ll search the market.');
      } else if (hasResume && hasPaths && !scoutStartedRef.current) {
        scoutStartedRef.current = true;
        setPhase('scout');
        void startScout();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chat failed');
    } finally {
      setChatLoading(false);
    }
  };

  const startScout = async () => {
    setScoutRunning(true);
    pushAssistant("I'm searching live listings while you wait — usually under a minute for your first batch.");
    try {
      await updateProfile({ onboardingScoutStartedAt: new Date().toISOString() });
      await triggerScoutRun();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Scout failed');
    }
  };

  useEffect(() => {
    if (!scoutRunning) return;
    if ((profile?.dailyJobs?.length || 0) > 0) {
      setScoutRunning(false);
      setPhase('matches');
      const jobs = profile!.dailyJobs as DailyJob[];
      setMessages((prev) => {
        if (prev.some((m) => m.attachment?.type === 'job_match')) return prev;
        const intro = createAgentMessage(
          'assistant',
          `Here are your first matches — tell me yes or no on each and I'll keep learning.`
        );
        const cards = jobs.slice(0, 3).map((job) =>
          createAgentMessage('assistant', '', {
            type: 'job_match',
            job,
            fingerprint: `${job.title}::${job.company}`,
          })
        );
        return [...prev, intro, ...cards];
      });
      return;
    }
    const timeout = setTimeout(() => {
      setScoutRunning(false);
      if (!(profile?.dailyJobs?.length || 0)) {
        pushAssistant("Scout is still running — you can continue to Jack and matches will appear when ready.");
        void finish();
      }
    }, 120_000);
    return () => clearTimeout(timeout);
  }, [scoutRunning, profile?.dailyJobs?.length]);

  const onResumeReady = useCallback(async () => {
    pushAssistant('Great — your profile is loaded. I picked career paths from your experience. Starting Scout now.');
    if ((profile?.careerPaths?.length || 0) > 0) {
      scoutStartedRef.current = true;
      setPhase('scout');
      await startScout();
    }
  }, [profile?.careerPaths]);

  const handleLinkedInConfirm = async () => {
    if (preview?.resumeText?.trim()) {
      await confirmPreview(async () => {
        await onResumeReady();
      });
      return;
    }
    const normalized = normalizeLinkedInProfileUrl(linkedinInput);
    if (!normalized) {
      toast.error('Add your LinkedIn profile URL to continue.');
      return;
    }
    const loaded = await loadLinkedInPreview(normalized);
    if (loaded) {
      await confirmPreview(async () => {
        await onResumeReady();
      });
    }
  };

  const handleLinkedInImport = async () => {
    try {
      await importFromLinkedIn(async () => {
        await onResumeReady();
      });
    } catch {
      /* toast handled in hook */
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-background">
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-foreground-muted">
              Talk to Jack · ~10 minutes
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">Let's find your next role</h1>
          </div>

          {messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className="max-w-[95%]">
                {m.content ? (
                  <div
                    className={[
                      'rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                      m.role === 'user'
                        ? 'bg-[var(--hs-app-accent)] text-white'
                        : 'border border-border bg-surface text-foreground',
                    ].join(' ')}
                  >
                    {m.content}
                  </div>
                ) : null}
                {m.attachment?.type === 'job_match' ? (
                  <JobMatchCard
                    job={m.attachment.job}
                    onYes={() => toast.success('Saved — open Jack after onboarding to continue')}
                    onNo={() => toast.message('Noted — Jack will refine your search')}
                  />
                ) : null}
              </div>
            </div>
          ))}

          {phase === 'linkedin_confirm' && !hasResume ? (
            <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Linkedin className="h-4 w-4" /> Confirm your LinkedIn profile
              </div>
              {importing && !preview ? (
                <div className="flex items-center gap-2 text-sm text-foreground-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading your LinkedIn profile…
                </div>
              ) : preview ? (
                <div className="flex gap-4 rounded-xl border border-border bg-background p-4">
                  {preview.photoUrl ? (
                    <img
                      src={preview.photoUrl}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-full object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground">{preview.displayName || 'Your profile'}</div>
                    {preview.headline ? (
                      <p className="mt-1 text-sm text-foreground-muted">{preview.headline}</p>
                    ) : null}
                    {preview.linkedinUrl ? (
                      <p className="mt-2 truncate text-xs text-foreground-muted">{preview.linkedinUrl}</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground-muted">
                  Paste your public LinkedIn URL if it is not already filled in.
                </p>
              )}
              <Input
                value={linkedinInput}
                onChange={(e) => {
                  setLinkedinInput(e.target.value);
                  if (preview) clearPreview();
                }}
                placeholder={
                  preview?.displayName
                    ? 'Edit URL only if this is not your profile'
                    : 'https://linkedin.com/in/your-handle'
                }
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  disabled={importing}
                  onClick={() => void handleLinkedInConfirm()}
                  className="flex-1"
                >
                  {importing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Yes, that's me — continue
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={importing}
                  onClick={() => {
                    clearPreview();
                    setPhase('resume');
                  }}
                >
                  Use resume instead
                </Button>
              </div>
            </div>
          ) : null}

          {phase === 'resume' && !hasResume ? (
            <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Linkedin className="h-4 w-4" /> LinkedIn URL
              </div>
              <Input
                value={linkedinInput}
                onChange={(e) => setLinkedinInput(e.target.value)}
                placeholder={
                  preview?.displayName
                    ? 'Edit URL only if this is not your profile'
                    : 'https://linkedin.com/in/your-handle'
                }
              />
              <Button
                type="button"
                disabled={importing || !linkedinInput.trim()}
                onClick={() => void handleLinkedInImport()}
                className="w-full"
              >
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Import from LinkedIn
              </Button>
              <div className="relative text-center text-xs text-foreground-muted">
                <span className="bg-surface px-2 relative z-10">or</span>
                <div className="absolute inset-x-0 top-1/2 border-t border-border" />
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Upload className="h-4 w-4" /> Upload resume
              </div>
              <ResumeUploader
                profile={profile}
                updateProfile={updateProfile}
                onSuccess={() => void onResumeReady()}
                quiet
              />
            </div>
          ) : null}

          {phase === 'scout' && scoutRunning ? (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-foreground-muted">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--hs-app-accent)]" />
              Jack is searching live job boards…
            </div>
          ) : null}

          {phase === 'matches' && hasMatches ? (
            <div className="pt-2">
              <Button onClick={() => void finish()} className="w-full">
                Continue to Jack
              </Button>
            </div>
          ) : null}

          {chatLoading ? (
            <div className="flex items-center gap-2 text-sm text-foreground-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Jack is thinking…
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      {phase === 'chat' || (phase === 'resume' && hasResume) ? (
        <div className="border-t border-border px-4 py-4 md:px-8">
          <form
            className="mx-auto flex max-w-2xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleChatSend();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell Jack what you're looking for…"
              className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm"
            />
            <button type="submit" disabled={chatLoading || !input.trim()} className="hs-btn hs-btn-primary px-4">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
