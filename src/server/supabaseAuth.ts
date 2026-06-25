import type { User } from '@supabase/supabase-js';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getSupabaseAdmin } from './supabaseAdmin.js';
import { isAdminEmail } from '../lib/adminEmails.js';

export type VerifiedUser = {
  uid: string;
  email?: string;
  role?: string;
};

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function supabaseProjectUrl(): string {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  if (!url) {
    throw Object.assign(new Error('Supabase is not configured (SUPABASE_URL).'), { status: 500 });
  }
  return url;
}

function getSupabaseJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${supabaseProjectUrl()}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

async function verifyJwtWithJwks(token: string): Promise<VerifiedUser> {
  const url = supabaseProjectUrl();
  const { payload } = await jwtVerify(token, getSupabaseJwks(), {
    issuer: `${url}/auth/v1`,
  });

  const sub = payload.sub;
  if (!sub || typeof sub !== 'string') {
    throw new Error('JWT missing sub claim');
  }

  const role =
    typeof payload.role === 'string'
      ? payload.role
      : typeof payload.app_metadata === 'object' &&
          payload.app_metadata &&
          typeof (payload.app_metadata as Record<string, unknown>).role === 'string'
        ? ((payload.app_metadata as Record<string, unknown>).role as string)
        : undefined;

  return {
    uid: sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    role,
  };
}

export async function verifySupabaseToken(token: string): Promise<VerifiedUser> {
  const trimmed = token.trim();
  if (!trimmed || trimmed.split('.').length < 3) {
    throw Object.assign(new Error('Invalid or expired session.'), { status: 401 });
  }

  // Prefer local JWKS verification — works with Supabase ES256 signing keys and
  // does not depend on the service-role key being accepted by auth.getUser().
  try {
    return await verifyJwtWithJwks(trimmed);
  } catch (jwksError) {
    const { data, error } = await getSupabaseAdmin().auth.getUser(trimmed);
    if (!error && data.user) {
      return mapSupabaseUser(data.user);
    }

    const detail =
      jwksError instanceof Error
        ? jwksError.message
        : error?.message ?? 'no user';
    console.error('[supabaseAuth] token verification failed:', detail);
    throw Object.assign(new Error('Invalid or expired session.'), { status: 401 });
  }
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
