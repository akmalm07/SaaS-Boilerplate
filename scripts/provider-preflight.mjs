import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function parseDotenv(source) {
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, raw] = match;
    values[key] = raw.replace(/^(['"])(.*)\1$/, '$2').replace(/\\n/g, '\n');
  }
  return values;
}

const local = parseDotenv(await readFile(resolve('.env'), 'utf8'));
for (const [key, value] of Object.entries(local)) if (!process.env[key]) process.env[key] = value;
const has = (...keys) => keys.every((key) => Boolean(process.env[key]));
const results = [];
async function firebaseCredential() {
  // FIREBASE_SERVICE_ACCOUNT_JSON is designed for a CI secret. Keep the
  // original spelling as a local-file-compatible fallback for this workspace.
  const source =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? process.env.FIREBASE_ACCOUNT_CRIDENTIALS;
  if (!source)
    throw new Error('missing FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_ACCOUNT_CRIDENTIALS');
  return JSON.parse(
    source.trim().startsWith('{') ? source : await readFile(resolve(source), 'utf8'),
  );
}
async function check(name, required, test) {
  if (!has(...required)) {
    results.push({
      name,
      state: 'SKIP',
      message: `missing ${required.filter((key) => !process.env[key]).join(', ')}`,
    });
    return;
  }
  try {
    await test();
    results.push({ name, state: 'PASS', message: 'reachable' });
  } catch (error) {
    results.push({
      name,
      state: 'FAIL',
      message:
        error instanceof Error
          ? error.message.replace(/https?:\/\/[^\s]+/g, '[redacted-url]')
          : 'unknown error',
    });
  }
}

await check('Public tunnel', ['FRONTEND_URL'], async () => {
  const response = await fetch(process.env.FRONTEND_URL, {
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok && response.status !== 301 && response.status !== 302)
    throw new Error(`HTTP ${response.status}`);
});
await check('PostgreSQL / Neon', ['DATABASE_URL'], async () => {
  const { Client } = await import('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
  });
  try {
    await client.connect();
    await client.query('SELECT 1');
  } finally {
    await client.end().catch(() => undefined);
  }
});
await check('MongoDB', ['MONGODB_URI'], async () => {
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  try {
    await client.db(process.env.MONGODB_DATABASE).command({ ping: 1 });
  } finally {
    await client.close();
  }
});
await check('Firebase Firestore', ['FIREBASE_PROJECT_ID'], async () => {
  const { cert, getApps, initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const credential = await firebaseCredential();
  const app =
    getApps().find((item) => item.name === 'preflight') ??
    initializeApp(
      { credential: cert(credential), projectId: process.env.FIREBASE_PROJECT_ID },
      'preflight',
    );
  await getFirestore(app).listCollections();
});
await check('Firebase Storage', ['FIREBASE_PROJECT_ID', 'FIREBASE_STORAGE_BUCKET'], async () => {
  const { cert, getApps, initializeApp } = await import('firebase-admin/app');
  const { getStorage } = await import('firebase-admin/storage');
  const credential = await firebaseCredential();
  const app =
    getApps().find((item) => item.name === 'preflight-storage') ??
    initializeApp(
      {
        credential: cert(credential),
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      },
      'preflight-storage',
    );
  const [exists] = await getStorage(app).bucket().exists();
  if (!exists) throw new Error('configured bucket was not found');
});
await check('Twilio Email', ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'], async () => {
  const token = Buffer.from(
    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
  ).toString('base64');
  const response = await fetch('https://comms.twilio.com/v1/Emails?pageSize=1', {
    headers: { authorization: `Basic ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
});
await check('Stripe', ['STRIPE_SECRET_KEY'], async () => {
  const response = await fetch('https://api.stripe.com/v1/balance', {
    headers: {
      authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Stripe-Version': process.env.STRIPE_API_VERSION ?? '2026-06-24.dahlia',
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
});

for (const result of results)
  console.log(`${result.state.padEnd(4)} ${result.name}: ${result.message}`);
if (results.some((result) => result.state === 'FAIL')) process.exitCode = 1;
