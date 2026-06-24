/**
 * One-time bootstrap: grant super_admin role on a Supabase profile.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../../../supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const secret = process.env.ADMIN_BOOTSTRAP_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'ADMIN_BOOTSTRAP_SECRET is not configured on this server.' });
  }

  const providedSecret = req.headers['x-bootstrap-secret'];
  if (!providedSecret || providedSecret !== secret) {
    return res.status(403).json({ error: 'Invalid bootstrap secret.' });
  }

  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) {
    return res.status(400).json({ error: 'Missing email in request body.' });
  }

  try {
    const { data, error } = await getSupabaseAdmin().auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;

    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      return res.status(404).json({ error: `No user found with email: ${email}` });
    }

    await getSupabaseAdmin()
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', user.id);

    return res.status(200).json({
      ok: true,
      uid: user.id,
      email: user.email,
      message: `super_admin role set on ${email}.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Bootstrap Error]', err);
    return res.status(500).json({ error: message });
  }
}
