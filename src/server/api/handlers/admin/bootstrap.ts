/**
 * One-time bootstrap endpoint to grant superAdmin custom claim to a Firebase user.
 *
 * Usage (run once per admin account):
 *   curl -X POST https://your-domain.com/api/admin/bootstrap \
 *     -H "Content-Type: application/json" \
 *     -H "X-Bootstrap-Secret: <ADMIN_BOOTSTRAP_SECRET>" \
 *     -d '{"email": "you@example.com"}'
 *
 * After calling this, the user must sign out and back in (or wait ~1 hour
 * for their ID token to expire) to receive the new custom claim.
 *
 * Set ADMIN_BOOTSTRAP_SECRET in Vercel env vars — never expose it to the client.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminAuth } from '../../../firebaseAdmin.js';

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
    const auth = getAdminAuth();

    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch {
      return res.status(404).json({ error: `No Firebase user found with email: ${email}` });
    }

    await auth.setCustomUserClaims(userRecord.uid, { superAdmin: true });

    return res.status(200).json({
      ok: true,
      uid: userRecord.uid,
      email: userRecord.email,
      message: `superAdmin claim set on ${email}. User must sign out and back in to receive the updated token.`,
    });
  } catch (err: any) {
    console.error('[Bootstrap Error]', err);
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
