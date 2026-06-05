/**
 * Pipeline step tracker — logs each stage with timing for admin visibility.
 */

export type PipelineStepId =
  | 'load_strategy'
  | 'research'
  | 'generate'
  | 'internal_links'
  | 'quality_gate'
  | 'cover_image'
  | 'schema'
  | 'publish'
  | 'cluster_update'
  | 'bidirectional_links'
  | 'strategy_update';

export interface PipelineStep {
  id: PipelineStepId;
  label: string;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'error';
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  detail?: Record<string, unknown>;
}

export interface PipelineRun {
  id: string;
  mode: 'live' | 'dry_run';
  steps: PipelineStep[];
  startedAt: string;
  completedAt?: string;
  totalDurationMs?: number;
  result?: Record<string, unknown>;
  error?: string;
}

const STEP_DEFINITIONS: { id: PipelineStepId; label: string }[] = [
  { id: 'load_strategy', label: 'Load content strategy' },
  { id: 'research', label: 'Research topic (Perplexity)' },
  { id: 'generate', label: 'Generate article (Claude Opus)' },
  { id: 'internal_links', label: 'Build internal links' },
  { id: 'quality_gate', label: 'Quality gate (SEO + LLM score)' },
  { id: 'cover_image', label: 'Generate cover SVG' },
  { id: 'schema', label: 'Build JSON-LD schema' },
  { id: 'publish', label: 'Publish to Firestore' },
  { id: 'cluster_update', label: 'Update topical cluster' },
  { id: 'bidirectional_links', label: 'Backlink from related posts' },
  { id: 'strategy_update', label: 'Update strategy queue' },
];

export function createPipelineRun(mode: 'live' | 'dry_run'): PipelineRun {
  return {
    id: `run-${Date.now()}`,
    mode,
    startedAt: new Date().toISOString(),
    steps: STEP_DEFINITIONS.map((s) => ({
      id: s.id,
      label: s.label,
      status: 'pending' as const,
    })),
  };
}

export class PipelineTracker {
  private run: PipelineRun;

  constructor(mode: 'live' | 'dry_run' = 'live') {
    this.run = createPipelineRun(mode);
  }

  getRun(): PipelineRun {
    return this.run;
  }

  start(stepId: PipelineStepId): void {
    const step = this.run.steps.find((s) => s.id === stepId);
    if (!step) return;
    step.status = 'running';
    step.startedAt = new Date().toISOString();
  }

  complete(stepId: PipelineStepId, detail?: Record<string, unknown>): void {
    const step = this.run.steps.find((s) => s.id === stepId);
    if (!step) return;
    step.status = 'done';
    step.completedAt = new Date().toISOString();
    if (step.startedAt) {
      step.durationMs = new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime();
    }
    if (detail) step.detail = detail;
  }

  skip(stepId: PipelineStepId, reason?: string): void {
    const step = this.run.steps.find((s) => s.id === stepId);
    if (!step) return;
    step.status = 'skipped';
    if (reason) step.detail = { reason };
  }

  fail(stepId: PipelineStepId, error: string): void {
    const step = this.run.steps.find((s) => s.id === stepId);
    if (!step) return;
    step.status = 'error';
    step.completedAt = new Date().toISOString();
    step.detail = { error };
    this.run.error = error;
  }

  finish(result?: Record<string, unknown>): PipelineRun {
    this.run.completedAt = new Date().toISOString();
    this.run.totalDurationMs =
      new Date(this.run.completedAt).getTime() - new Date(this.run.startedAt).getTime();
    if (result) this.run.result = result;
    return this.run;
  }
}

export function getCronSchedule() {
  return [
    {
      id: 'daily-blog',
      name: 'Daily Publish',
      path: '/api/cron/daily-blog',
      schedule: '0 8 * * *',
      utcTime: '08:00 UTC daily',
      description: 'Research → write → validate → publish one hiring guide',
      aiCalls: 2,
    },
    {
      id: 'weekly-analysis',
      name: 'Weekly Intelligence',
      path: '/api/cron/weekly-analysis',
      schedule: '0 6 * * 6',
      utcTime: '06:00 UTC every Saturday',
      description: 'Keyword discovery + competitor analysis + strategy refresh',
      aiCalls: 3,
    },
    {
      id: 'monthly-learning',
      name: 'Monthly Learning Loop',
      path: '/api/cron/monthly-learning',
      schedule: '0 7 1 * *',
      utcTime: '07:00 UTC on the 1st of each month',
      description: 'Analyze winners/losers, refresh content, update monthly plan',
      aiCalls: 2,
    },
  ];
}
