import { getSupabaseBrowserClient } from './supabaseClient';

/** Fires a one-shot Scout request via /api/jobs (does not change matching engine). */
export async function triggerScoutRun(): Promise<'dispatched' | 'ready'> {
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  const idToken = data.session?.access_token;
  if (!idToken) throw new Error('Not authenticated.');
  const res = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ mode: 'request', firstRun: true }),
  });
  if (res.ok && res.status !== 202) {
    const payload = await res.json().catch(() => ({}));
    if (Array.isArray((payload as { jobs?: unknown[] }).jobs) && (payload as { jobs: unknown[] }).jobs.length > 0) {
      return 'ready';
    }
  }
  if (res.status === 202 || res.status === 409 || res.ok) {
    return res.status === 202 ? 'dispatched' : 'ready';
  }
  const text = await res.text().catch(() => '');
  throw new Error(`Scout request failed (${res.status}). ${text}`);
}
