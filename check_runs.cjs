const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const sa = JSON.parse(fs.readFileSync('.env', 'utf8').match(/FIREBASE_SERVICE_ACCOUNT_KEY='(.*?)'/)[1].replace(/\\n/g, '\n'));
const dbId = fs.readFileSync('.env', 'utf8').match(/FIRESTORE_DATABASE_ID="(.*?)"/)[1];

initializeApp({ credential: cert(sa) });
const db = getFirestore();

async function check() {
  const snapshot = await db.collection('cronRuns').orderBy('startedAt', 'desc').limit(5).get();
  snapshot.forEach(doc => {
    console.log(doc.id, doc.data());
  });
}
check().catch(console.error);
