/** Canonical super-admin email allowlist (lowercase). Keep this list minimal. */
export const ADMIN_EMAILS = [
  'rupesh7126@gmail.com',
  'kv3244@gmail.com',
] as const;

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase() as (typeof ADMIN_EMAILS)[number]);
}
