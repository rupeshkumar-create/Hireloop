/** Stagger publish dates backward from a fixed anchor so posts read as already published. */
const STAGGER_MS = 6 * 60 * 60 * 1000;
/** Latest catalog post date — June 1, 2026 08:00 UTC (month is 0-indexed). */
const END_ANCHOR_MS = Date.UTC(2026, 5, 1, 8, 0, 0);

export function staggeredPublish(globalIndex: number, totalCount: number): string {
  const spanMs = Math.max(totalCount - 1, 0) * STAGGER_MS;
  const startMs = END_ANCHOR_MS - spanMs;
  return new Date(startMs + globalIndex * STAGGER_MS).toISOString();
}

export function applyStaggeredPublishDates<T extends { publishedAt: string }>(
  specs: T[]
): T[] {
  const total = specs.length;
  return specs.map((spec, index) => ({
    ...spec,
    publishedAt: staggeredPublish(index, total),
  }));
}
