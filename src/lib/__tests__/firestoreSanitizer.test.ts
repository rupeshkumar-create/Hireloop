import { describe, expect, it } from 'vitest';
import { stripUndefinedDeep } from '../firestoreSanitizer';

describe('stripUndefinedDeep', () => {
  it('removes the exact nested-contact shape that caused the resume-upload regression', () => {
    // Reproduces the production error:
    //   "Unsupported field value: undefined (found in field
    //    structuredProfile.contact.phone in document users/UEg…)"
    const cleaned = stripUndefinedDeep({
      structuredProfile: {
        contact: {
          fullName: 'Rupesh Kumar',
          email: 'rupesh@example.com',
          phone: undefined,       // <- the offending field
          location: undefined,
          linkedin: 'linkedin.com/in/rupesh',
        },
        experience: [
          { id: 'a', title: 'Engineer', company: 'Acme', startDate: undefined, current: false },
        ],
      },
    });
    expect(cleaned).toEqual({
      structuredProfile: {
        contact: {
          fullName: 'Rupesh Kumar',
          email: 'rupesh@example.com',
          linkedin: 'linkedin.com/in/rupesh',
        },
        experience: [
          { id: 'a', title: 'Engineer', company: 'Acme', current: false },
        ],
      },
    });
  });

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
