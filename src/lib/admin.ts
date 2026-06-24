/** Returns true when the profile carries the super_admin role (Supabase profiles.role). */
export function isSuperAdminRole(role?: string | null): boolean {
  return role === 'super_admin';
}
