/** Stagger publish dates to avoid burst indexing (anti-spam). */
const STAGGER_MS = 6 * 60 * 60 * 1000;
const BASE_DATE = Date.UTC(2026, 6, 1, 8, 0, 0);

export function staggeredPublish(globalIndex: number): string {
  return new Date(BASE_DATE + globalIndex * STAGGER_MS).toISOString();
}

export function applyStaggeredPublishDates<T extends { publishedAt: string }>(
  specs: T[]
): T[] {
  return specs.map((spec, index) => ({
    ...spec,
    publishedAt: staggeredPublish(index),
  }));
}
