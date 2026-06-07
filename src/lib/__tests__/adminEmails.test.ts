import { describe, expect, it } from 'vitest';
import { ADMIN_EMAILS, isAdminEmail } from '../adminEmails';

describe('isAdminEmail', () => {
  it('allows canonical admin emails case-insensitively', () => {
    for (const email of ADMIN_EMAILS) {
      expect(isAdminEmail(email)).toBe(true);
      expect(isAdminEmail(email.toUpperCase())).toBe(true);
    }
  });

  it('includes rratanranjeet790395@gmail.com', () => {
    expect(isAdminEmail('Rratanranjeet790395@gmail.com')).toBe(true);
  });

  it('rejects non-admin emails', () => {
    expect(isAdminEmail('random@example.com')).toBe(false);
  });
});
