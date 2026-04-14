import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end('Unauthorized');
  }

  try {
    console.log("Running daily alerts cron");
    
    if (getApps().length > 0) {
      const db = getFirestore();
      // In a real application we would batch process users:
      // 1. Fetch users where receiveDailyAlerts is true
      // 2. Call the AI service to generate jobs for them
      // 3. Email them
      // For this fix, we are just executing the cron endpoint
      console.log("Connected to Firebase, cron processed.");
    }
    
    return res.status(200).send('Cron executed');
  } catch (error: any) {
    console.error('Cron error:', error);
    return res.status(500).send(error.message);
  }
}
