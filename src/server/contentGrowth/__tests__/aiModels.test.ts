import { describe, expect, it } from 'vitest';
import { MODELS } from '../ai.js';

describe('contentGrowth MODELS', () => {
  it('uses OpenRouter dot-notation Claude model IDs', () => {
    expect(MODELS.writing).toBe('anthropic/claude-opus-4.6');
    expect(MODELS.outline).toBe('anthropic/claude-sonnet-4.6');
    expect(MODELS.writing).not.toContain('claude-opus-4-6');
  });
});
