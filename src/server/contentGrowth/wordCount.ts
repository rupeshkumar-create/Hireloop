/** Minimum word count for published blog posts. */
export const BLOG_TARGET_WORD_COUNT = 2000;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function meetsMinimumWordCount(text: string, minimum = BLOG_TARGET_WORD_COUNT): boolean {
  return countWords(text) >= minimum;
}

export function wordsNeeded(text: string, target = BLOG_TARGET_WORD_COUNT): number {
  return Math.max(0, target - countWords(text));
}
