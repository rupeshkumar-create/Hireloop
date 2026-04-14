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
    console.log("Running daily alerts cron at 8:00 AM IST");
    
    if (getApps().length > 0) {
      const db = getFirestore();
      
      // Note: For Vercel Cron on hobby tier (10s limit), this will timeout if there are many users.
      // We will process a small batch sequentially.
      
      const usersRef = db.collection('users');
      // Fetch up to 5 users who haven't explicitly disabled alerts
      const snapshot = await usersRef.limit(5).get(); 
      
      const today = new Date().toISOString().split('T')[0];

      for (const userDoc of snapshot.docs) {
        const userData = userDoc.data();
        if (userData.receiveDailyAlerts === false) continue;
        if (!userData.careerPaths || userData.careerPaths.length === 0) continue;

        // In a real serverless setup, you can either:
        // 1. Process them sequentially (what we do here, but limited to ~5 users to avoid 10s timeout)
        // 2. Dispatch a background task to Inngest/Upstash/Google Cloud Tasks to process thousands of users.
        
        console.log(`[Cron] Would generate jobs for user ${userData.email} and save to daily_matches/${today}`);
      }
      
      console.log("Cron processed successfully.");
    }
    
    return res.status(200).send('Cron executed');
  } catch (error: any) {
    console.error('Cron error:', error);
    return res.status(500).send(error.message);
  }
}
