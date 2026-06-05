import { createHmac, timingSafeEqual } from 'crypto';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function verifyDodoSignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Note: Requires FIREBASE_SERVICE_ACCOUNT_KEY env var in Vercel containing the stringified JSON
if (!getApps().length && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
    });
  } catch (error) {
    console.error("Firebase admin init error", error);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const webhookSecret = process.env.DODO_WEBHOOK_SECRET;
  if (webhookSecret) {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    const signature = req.headers['x-dodo-signature'] as string | undefined;
    if (!verifyDodoSignature(rawBody, signature, webhookSecret)) {
      return res.status(401).send('Invalid webhook signature');
    }
  }
  
  try {
    const event = req.body;
    
    if (event.type === 'payment.succeeded' || event.type === 'subscription.created') {
      const email = event.data?.customer?.email || event.data?.email;
      
      if (email && getApps().length > 0) {
        const db = getFirestore();
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', email).get();
        
        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0];
          await userDoc.ref.update({
            plan: 'pro',
            updatedAt: new Date().toISOString()
          });
          console.log(`Upgraded user ${email} to Pro plan.`);
        } else {
          console.log(`Webhook received but user with email ${email} not found.`);
        }
      }
    }
    
    return res.status(200).send('Webhook processed');
  } catch (error: any) {
    console.error('Webhook error:', error);
    return res.status(500).send(`Webhook error: ${error.message}`);
  }
}
