import type { DailyJob } from '../types/dailyJob';

export type AgentChatMode =
  | 'default'
  | 'mock_interview'
  | 'salary_benchmark'
  | 'negotiation'
  | 'career_clarity'
  | 'onboarding';

export type AgentMessageAttachment =
  | { type: 'job_match'; job: DailyJob; fingerprint: string }
  | {
      type: 'intro';
      introId: string;
      company: string;
      jobTitle: string;
      recruiterName: string;
      status: 'pending' | 'accepted' | 'skipped' | 'recruiter_accepted' | 'recruiter_declined' | 'scheduled';
    }
  | { type: 'salary_band'; role: string; location: string; p50: number; p90: number; target?: number };

export type AgentChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  attachment?: AgentMessageAttachment;
};

export type AgentChatState = {
  messages: AgentChatMessage[];
  mode: AgentChatMode;
  deliveredMatchFps: string[];
  lastMatchDeliveryDate?: string;
  mockInterviewJobId?: string;
};

export const JACK_GREETING =
  "I'm Jack — your AI career agent. I search live roles daily, bring you only what's worth your time, and help you land them — intros, mock interviews, and salary coaching included. What would you like to work on?";

export const JACK_ONBOARDING_GREETING =
  "Hey — I'm Jack. In about 10 minutes we'll shape your search, scan the market, and show your first matches. First: paste your LinkedIn URL or tell me what kind of role you're targeting.";

export function createAgentMessage(
  role: AgentChatMessage['role'],
  content: string,
  attachment?: AgentMessageAttachment
): AgentChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    attachment,
  };
}

export function emptyAgentChatState(): AgentChatState {
  return {
    messages: [],
    mode: 'default',
    deliveredMatchFps: [],
  };
}
