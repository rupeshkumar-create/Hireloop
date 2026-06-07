import { isAdminEmail } from './adminEmails';
import { hasSuperAdminClaim } from './admin';

/** Sidebar / mobile nav — email allowlist OR Firebase superAdmin claim. */
export function isAppAdmin(email?: string | null, tokenClaims?: { superAdmin?: boolean }) {
  if (tokenClaims?.superAdmin === true) return true;
  return isAdminEmail(email);
}
