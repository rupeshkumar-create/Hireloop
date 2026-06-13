import { createHmac, timingSafeEqual } from 'crypto';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../src/server/firebaseAdmin.js';

function verifyDodoSignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const webhookSecret = process.env.DODO_WEBHOOK_SECRET;
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

  if (isProduction && !webhookSecret) {
    console.error('DODO_WEBHOOK_SECRET is required in production');
    return res.status(503).send('Webhook verification not configured');
  }

  if (webhookSecret) {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    const signature = req.headers['x-dodo-signature'] as string | undefined;
    if (!verifyDodoSignature(rawBody, signature, webhookSecret)) {
      return res.status(401).send('Invalid webhook signature');
    }
  }

  try {
    const event = req.body;
    const eventType = String(event.type || '');

    const upgradeEvents = new Set(['payment.succeeded', 'subscription.created', 'subscription.renewed']);
    const downgradeEvents = new Set([
      'subscription.cancelled',
      'subscription.canceled',
      'subscription.expired',
      'subscription.paused',
      'payment.failed',
    ]);

    if (upgradeEvents.has(eventType) || downgradeEvents.has(eventType)) {
      const email = event.data?.customer?.email || event.data?.email;

      if (email) {
        const db = getAdminDb();
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', email).get();

        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0];
          const nextPlan = downgradeEvents.has(eventType) ? 'free' : 'pro';
          await userDoc.ref.update({
            plan: nextPlan,
            updatedAt: new Date().toISOString(),
            ...(downgradeEvents.has(eventType)
              ? { subscriptionStatus: eventType }
              : { subscriptionStatus: 'active' }),
          });
          console.log(`${downgradeEvents.has(eventType) ? 'Downgraded' : 'Upgraded'} user ${email} to ${nextPlan}.`);
        } else {
          console.log(`Webhook received but user with email ${email} not found.`);
        }
      }
    }

    return res.status(200).send('Webhook processed');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Webhook error:', message);
    return res.status(500).send(`Webhook error: ${message}`);
  }
}
