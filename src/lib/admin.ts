export const SUPER_ADMIN_EMAILS = [
  'rupesh7126@gmail.com',
  'kv3244@gmail.com',
  'rupesh7128@gmail.com',
];

export function normalizeEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase();
}

export function isAllowedAdminEmail(email: string | null | undefined): boolean {
  return SUPER_ADMIN_EMAILS.includes(normalizeEmail(email));
}
