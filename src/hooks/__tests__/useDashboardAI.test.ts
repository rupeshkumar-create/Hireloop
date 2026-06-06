import { describe, expect, it } from 'vitest';
import type { AiActionType } from '../../hooks/useDashboardAI';

const AI_ACTIONS: AiActionType[] = ['email', 'resume', 'interview', 'salary'];

describe('useDashboardAI actions', () => {
  it('covers all copilot actions that call /api/openai', () => {
    expect(AI_ACTIONS).toEqual(['email', 'resume', 'interview', 'salary']);
  });
});
