import type { User } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabaseAdmin.js';
import { isAdminEmail } from '../lib/adminEmails.js';

export type VerifiedUser = {
  uid: string;
  email?: string;
  role?: string;
};

export async function verifySupabaseToken(token: string): Promise<VerifiedUser> {
  const trimmed = token.trim();
  if (!trimmed || trimmed.split('.').length < 3) {
    throw Object.assign(new Error('Invalid or expired session.'), { status: 401 });
  }

  const { data, error } = await getSupabaseAdmin().auth.getUser(trimmed);
  if (error || !data.user) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[supabaseAuth] getUser failed:', error?.message ?? 'no user');
    }
    throw Object.assign(new Error('Invalid or expired session.'), { status: 401 });
  }
  return mapSupabaseUser(data.user);
}

export function mapSupabaseUser(user: User): VerifiedUser {
  return {
    uid: user.id,
    email: user.email ?? undefined,
    role: (user.app_metadata?.role as string | undefined) ?? undefined,
  };
}

export async function verifySuperAdmin(token: string): Promise<VerifiedUser> {
  const verified = await verifySupabaseToken(token);
  const email = verified.email?.toLowerCase();

  const { data: profile } = await getSupabaseAdmin()
    .from('profiles')
    .select('role')
    .eq('id', verified.uid)
    .maybeSingle();

  const isSuperAdmin = profile?.role === 'super_admin' || isAdminEmail(email);
  if (!isSuperAdmin) {
    throw Object.assign(new Error('Not authorized as super admin.'), { status: 403 });
  }

  return { ...verified, role: 'super_admin' };
}
