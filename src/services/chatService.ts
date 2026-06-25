import { fetchWithAuth } from './aiAuth';
import type { AgentChatMode } from '../lib/agentChat';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function sendChatMessage(
  messages: ChatMessage[],
  options?: {
    systemContext?: string;
    mode?: AgentChatMode;
    model?: string;
  }
): Promise<string> {
  const response = await fetchWithAuth('/api/chat/message', {
    method: 'POST',
    body: JSON.stringify({
      messages,
      systemContext: options?.systemContext,
      mode: options?.mode,
      model: options?.model,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `Chat failed (${response.status})`);
  }

  return String((data as { content?: string }).content || '').trim();
}
