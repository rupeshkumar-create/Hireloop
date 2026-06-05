import { describe, expect, it, vi } from 'vitest';
import {
  GuardrailError,
  registerGuardrailTask,
  resetGuardrailRegistryForTests,
  runWithGuardrails,
} from '../systemEngine';

describe('runWithGuardrails', () => {
  it('returns output when validation passes', async () => {
    resetGuardrailRegistryForTests();
    const logAI = vi.fn().mockResolvedValue(undefined);

    registerGuardrailTask('email_generation', {
      validateOutput: () => ({ passed: true }),
      logAI,
    });

    const result = await runWithGuardrails(
      'email_generation',
      async (input: { message: string }) => input.message,
      { message: 'hello' }
    );

    expect(result).toBe('hello');
    expect(logAI).toHaveBeenCalledTimes(1);
    expect(logAI.mock.calls[0][0].status).toBe('passed');
  });

  it('runs self-fix once when validation fails first', async () => {
    resetGuardrailRegistryForTests();
    const logAI = vi.fn().mockResolvedValue(undefined);
    const validateOutput = vi
      .fn()
      .mockReturnValueOnce({ passed: false, reason: 'too generic' })
      .mockReturnValueOnce({ passed: true });
    const selfFix = vi.fn().mockResolvedValue('fixed email');

    registerGuardrailTask('email_generation', {
      validateOutput,
      selfFix,
      logAI,
    });

    const result = await runWithGuardrails(
      'email_generation',
      async () => 'draft email',
      { company: 'Acme' }
    );

    expect(result).toBe('fixed email');
    expect(selfFix).toHaveBeenCalledTimes(1);
    expect(logAI).toHaveBeenCalledTimes(1);
    expect(logAI.mock.calls[0][0].status).toBe('self_fixed');
  });

  it('throws GuardrailError when output still fails after repair', async () => {
    resetGuardrailRegistryForTests();

    registerGuardrailTask('email_generation', {
      validateOutput: vi
        .fn()
        .mockReturnValueOnce({ passed: false, reason: 'missing company' })
        .mockReturnValueOnce({ passed: false, reason: 'still missing company' }),
      selfFix: vi.fn().mockResolvedValue('broken email'),
      logAI: vi.fn().mockResolvedValue(undefined),
    });

    await expect(
      runWithGuardrails('email_generation', async () => 'draft', { company: 'Acme' })
    ).rejects.toBeInstanceOf(GuardrailError);
  });

  it('wraps unexpected errors with GuardrailError', async () => {
    resetGuardrailRegistryForTests();

    registerGuardrailTask('resume_tailoring', {
      validateOutput: vi.fn().mockReturnValue({ passed: true }),
      logAI: vi.fn().mockResolvedValue(undefined),
    });

    await expect(
      runWithGuardrails(
        'resume_tailoring',
        async () => {
          throw new Error('upstream exploded');
        },
        { resumeText: 'x' }
      )
    ).rejects.toMatchObject({
      name: 'GuardrailError',
      taskName: 'resume_tailoring',
      message: 'upstream exploded',
    });
  });

  it('supports guarded query generation', async () => {
    resetGuardrailRegistryForTests();
    const logAI = vi.fn().mockResolvedValue(undefined);

    registerGuardrailTask('query_generation', {
      validateOutput: () => ({ passed: true }),
      logAI,
    });

    const result = await runWithGuardrails(
      'query_generation',
      async () => ['frontend developer remote react'],
      { profile: 'x' }
    );

    expect(result).toEqual(['frontend developer remote react']);
    expect(logAI).toHaveBeenCalledTimes(1);
  });
});
