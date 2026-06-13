import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../src/server/firebaseAdmin.js';
import {
  extractCustomerEmail,
  readWebhookRawBody,
  resolvePlanFromEvent,
  verifyStandardWebhookSignature,
} from '../../src/server/dodoWebhook.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const webhookSecret =
    process.env.DODO_WEBHOOK_SECRET?.trim() ||
    process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim();
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

  if (isProduction && !webhookSecret) {
    console.error('DODO_WEBHOOK_SECRET is required in production');
    return res.status(503).send('Webhook verification not configured');
  }

  let rawBody: string;
  try {
    rawBody = await readWebhookRawBody(req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to read webhook body:', message);
    return res.status(400).send('Invalid webhook body');
  }

  if (webhookSecret) {
    const verified = verifyStandardWebhookSignature(rawBody, webhookSecret, {
      id: req.headers['webhook-id'] as string | undefined,
      timestamp: req.headers['webhook-timestamp'] as string | undefined,
      signature: req.headers['webhook-signature'] as string | undefined,
    });
    if (!verified) {
      console.error('Invalid Dodo webhook signature');
      return res.status(401).send('Invalid webhook signature');
    }
  }

  try {
    const event = JSON.parse(rawBody) as Record<string, unknown>;
    const eventType = String(event.type || '');
    const nextPlan = resolvePlanFromEvent(eventType, event);

    if (nextPlan) {
      const email = extractCustomerEmail(event);

      if (email) {
        const db = getAdminDb();
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', email).get();

        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0];
          await userDoc.ref.update({
            plan: nextPlan,
            updatedAt: new Date().toISOString(),
            subscriptionStatus: nextPlan === 'pro' ? 'active' : eventType,
          });
          console.log(`${nextPlan === 'pro' ? 'Upgraded' : 'Downgraded'} user ${email} to ${nextPlan}.`);
        } else {
          console.log(`Webhook received but user with email ${email} not found.`);
        }
      } else {
        console.log(`Webhook ${eventType} received without customer email.`);
      }
    }

    return res.status(200).send('Webhook processed');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Webhook error:', message);
    return res.status(500).send(`Webhook error: ${message}`);
  }
}
