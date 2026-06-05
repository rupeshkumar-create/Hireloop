/**
 * One-time script: grants superAdmin custom claim to a Firebase user.
 * Run with: node scripts/bootstrap-admin.mjs <email>
 *
 * Reads FIREBASE_SERVICE_ACCOUNT_KEY from .env.local first, falling back to
 * .env (handles raw newlines in private_key).
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// ── Parse env file manually ───────────────────────────────────────────────────
function loadEnvLocal() {
  const candidates = ['.env.local', '.env'];
  const envPath = candidates
    .map((file) => resolve(process.cwd(), file))
    .find((p) => existsSync(p));
  if (!envPath) {
    throw new Error('No .env.local or .env file found in current directory.');
  }
  const content = readFileSync(envPath, 'utf8');
  const env = {};
  // Split on lines that start a new KEY= assignment
  const lines = content.split('\n');
  let currentKey = null;
  let currentVal = [];

  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) {
      if (currentKey) env[currentKey] = currentVal.join('\n');
      currentKey = match[1];
      currentVal = [match[2].replace(/^["']|["']$/g, '')];
    } else if (currentKey) {
      currentVal.push(line);
    }
  }
  if (currentKey) env[currentKey] = currentVal.join('\n');
  return env;
}

const envVars = loadEnvLocal();
const raw = envVars['FIREBASE_SERVICE_ACCOUNT_KEY'];
if (!raw) {
  console.error('FIREBASE_SERVICE_ACCOUNT_KEY not found in .env.local');
  process.exit(1);
}

// Step 1: convert all literal \n sequences → actual newlines (makes structural
//         whitespace valid, but breaks string values that contain newlines)
let fixedJson = raw.replace(/\\n/g, '\n');

// Step 2: the private_key field now has bare newlines inside its JSON string value
//         which is invalid — re-escape them back to \n
fixedJson = fixedJson.replace(
  /"private_key"\s*:\s*"([\s\S]*?)"/,
  (_, keyBody) => `"private_key": "${keyBody.replace(/\n/g, '\\n')}"`
);

const sa = JSON.parse(fixedJson);

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const TARGET_EMAIL = process.argv[2] || 'rupesh7128@gmail.com';

const { initializeApp, cert, getApps } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');

if (!getApps().length) initializeApp({ credential: cert(sa) });

const auth = getAuth();

try {
  const user = await auth.getUserByEmail(TARGET_EMAIL);
  await auth.setCustomUserClaims(user.uid, { superAdmin: true });

  // Verify it was set
  const updated = await auth.getUser(user.uid);
  const claims = updated.customClaims;

  if (claims?.superAdmin === true) {
    console.log('✓ SUCCESS — superAdmin claim set');
    console.log('  uid   :', user.uid);
    console.log('  email :', user.email);
    console.log('');
    console.log('  → Sign out and back in to receive the updated token.');
    console.log('  → Then visit /kingdomofkumar — no password needed.');
  } else {
    console.error('✗ Claim was not set correctly. Got:', claims);
    process.exit(1);
  }
} catch (err) {
  console.error('✗ FAILED:', err.message);
  process.exit(1);
}
