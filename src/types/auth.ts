/** App auth user — provider-agnostic (Supabase-backed). */
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
