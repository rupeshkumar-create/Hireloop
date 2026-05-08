import { describe, expect, it } from 'vitest';
import { stripUndefinedDeep } from '../firestoreSanitizer';

describe('stripUndefinedDeep', () => {
  it('removes undefined values from nested Firestore payloads', () => {
    const result = stripUndefinedDeep({
      keep: 'value',
      remove: undefined,
      nested: {
        keepNull: null,
        removeNested: undefined,
      },
      jobs: [
        {
          title: 'Frontend Engineer',
          logoUrl: undefined,
          salaryMin: null,
        },
      ],
    });

    expect(result).toEqual({
      keep: 'value',
      nested: {
        keepNull: null,
      },
      jobs: [
        {
          title: 'Frontend Engineer',
          salaryMin: null,
        },
      ],
    });
  });
});
