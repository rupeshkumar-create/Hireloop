import type { AgentChatState } from '../lib/agentChat';
import { emptyAgentChatState } from '../lib/agentChat';
import type { UserProfile } from '../lib/profileMapper';

export function readAgentChatState(profile: UserProfile | null | undefined): AgentChatState {
  const raw = (profile as UserProfile & { agentChat?: AgentChatState })?.agentChat;
  if (!raw || !Array.isArray(raw.messages)) return emptyAgentChatState();
  return {
    ...emptyAgentChatState(),
    ...raw,
    messages: raw.messages,
  };
}

export function agentChatPatch(state: AgentChatState): Partial<UserProfile> {
  return { agentChat: state } as Partial<UserProfile>;
}
