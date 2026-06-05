import type { DailyJob } from './dailyJob';

/**
 * Legacy alias kept so existing components that import `Job` from this module
 * continue to compile without changes.
 */
export type Job = DailyJob;

export type SortOption = 'matchScore' | 'company' | 'datePosted';
