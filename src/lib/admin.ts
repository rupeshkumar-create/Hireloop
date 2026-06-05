import type { IdTokenResult } from 'firebase/auth';

/** Returns true if the Firebase ID token carries the superAdmin custom claim. */
export function hasSuperAdminClaim(tokenResult: IdTokenResult): boolean {
  return tokenResult.claims.superAdmin === true;
}
