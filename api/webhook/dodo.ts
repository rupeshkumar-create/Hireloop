import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
