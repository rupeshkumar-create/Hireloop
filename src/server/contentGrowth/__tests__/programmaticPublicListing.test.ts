import { describe, expect, it } from 'vitest';
import { getProgrammaticPostSummaries } from '../programmatic/publicListing.js';
import { TARGET_PROGRAMMATIC_COUNT } from '../programmatic/catalog.js';

describe('programmatic public listing', () => {
  it('exposes the full 500-post library for the blog index', () => {
    const posts = getProgrammaticPostSummaries(TARGET_PROGRAMMATIC_COUNT);
    expect(posts.length).toBe(TARGET_PROGRAMMATIC_COUNT);
    expect(posts[0]?.slug).toBeTruthy();
    expect(posts[0]?.title).toBeTruthy();
  });
});
