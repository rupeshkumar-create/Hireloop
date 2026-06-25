import { describe, expect, it } from 'vitest';
import { extractLinkedInProfileUrlFromUser } from '../authOAuth';

describe('extractLinkedInProfileUrlFromUser', () => {
  it('builds URL from LinkedIn OIDC provider_id / sub', () => {
    const url = extractLinkedInProfileUrlFromUser({
      id: 'u1',
      app_metadata: { provider: 'linkedin_oidc', providers: ['linkedin_oidc'] },
      user_metadata: {
        full_name: 'Rupesh Kumar',
        provider_id: 'jTItE-xtg3',
      },
      identities: [
        {
          provider: 'linkedin_oidc',
          identity_data: { sub: 'jTItE-xtg3' },
        } as never,
      ],
    } as never);

    expect(url).toBe('https://linkedin.com/in/jTItE-xtg3');
  });
});
