import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import type { ValidationResult } from './validator';

export type GuardedTaskName =
  | 'query_generation'
  | 'job_scoring'
  | 'email_generation'
  | 'resume_tailoring'
  | 'validation';

export interface AILogRecord {
  taskName: GuardedTaskName;
  input: unknown;
  output: unknown;
  validation: ValidationResult;
  latency: number;
  createdAt: string;
  status: 'passed' | 'self_fixed' | 'failed';
  errorMessage?: string;
  userId?: string;
}

export class GuardrailError extends Error {
  taskName: GuardedTaskName;
  validation?: ValidationResult;
  latency?: number;

  constructor(
    message: string,
    taskName: GuardedTaskName,
    validation?: ValidationResult,
    latency?: number
  ) {
    super(message);
    this.name = 'GuardrailError';
    this.taskName = taskName;
    this.validation = validation;
    this.latency = latency;
  }
}

interface GuardrailTaskConfig<TInput, TOutput> {
  validateOutput: (
    output: TOutput,
    input: TInput
  ) => Promise<ValidationResult> | ValidationResult;
  selfFix?: (
    output: TOutput,
    input: TInput,
    validation: ValidationResult
  ) => Promise<TOutput>;
  logAI?: (record: AILogRecord) => Promise<void>;
}

const taskRegistry = new Map<GuardedTaskName, GuardrailTaskConfig<any, any>>();

async function writeAILog(record: AILogRecord): Promise<void> {
  const { taskName, userId, input, output, validation, latency, createdAt, status, errorMessage } =
    record;
  const { error } = await getSupabaseBrowserClient().from('ai_logs').insert({
    user_id: userId ?? null,
    data: {
      taskName,
      input,
      output,
      validation,
      latency,
      createdAt,
      status,
      ...(errorMessage ? { errorMessage } : {}),
    },
  });
  if (error) throw error;
}

export function registerGuardrailTask<TInput, TOutput>(
  taskName: GuardedTaskName,
  config: GuardrailTaskConfig<TInput, TOutput>
) {
  taskRegistry.set(taskName, config);
}

export function resetGuardrailRegistryForTests() {
  taskRegistry.clear();
}

export async function runWithGuardrails<TInput, TOutput>(
  taskName: GuardedTaskName,
  fn: (input: TInput) => Promise<TOutput>,
  input: TInput
): Promise<TOutput> {
  const config = taskRegistry.get(taskName);
  if (!config) {
    throw new Error(`No guardrail config registered for task "${taskName}".`);
  }

  const start = Date.now();
  let output: TOutput | undefined;
  let validation: ValidationResult = {
    passed: false,
    reason: 'Validation did not run.',
  };
  let status: AILogRecord['status'] = 'failed';
  let errorMessage: string | undefined;

  try {
    output = await fn(input);
    validation = await config.validateOutput(output, input);

    if (!validation.passed) {
      if (!config.selfFix) {
        throw new GuardrailError(
          validation.reason || 'Validation failed.',
          taskName,
          validation,
          Date.now() - start
        );
      }

      output = await config.selfFix(output, input, validation);
      validation = await config.validateOutput(output, input);

      if (!validation.passed) {
        throw new GuardrailError(
          validation.reason || 'Validation failed after self-fix.',
          taskName,
          validation,
          Date.now() - start
        );
      }

      status = 'self_fixed';
    } else {
      status = 'passed';
    }

    return output;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    if (error instanceof GuardrailError) {
      throw error;
    }

    throw new GuardrailError(
      errorMessage,
      taskName,
      validation,
      Date.now() - start
    );
  } finally {
    const latency = Date.now() - start;
    let userId: string | undefined;
    try {
      const { data } = await getSupabaseBrowserClient().auth.getSession();
      userId = data.session?.user?.id;
    } catch {
      // non-fatal
    }

    const logRecord: AILogRecord = {
      taskName,
      input,
      output: output as TOutput,
      validation,
      latency,
      createdAt: new Date().toISOString(),
      status,
      ...(errorMessage ? { errorMessage } : {}),
      ...(userId ? { userId } : {}),
    };

    try {
      const logFn = config.logAI ?? writeAILog;
      await logFn(logRecord);
    } catch (logError) {
      console.error('Failed to write aiLogs record:', logError);
    }
  }
}
