import { isAdminEmail } from './adminEmails';
import { isSuperAdminRole } from './admin';

/** Sidebar / mobile nav — email allowlist OR Supabase super_admin profile role. */
export function isAppAdmin(email?: string | null, profileRole?: string | null) {
  if (isSuperAdminRole(profileRole)) return true;
  return isAdminEmail(email);
}
