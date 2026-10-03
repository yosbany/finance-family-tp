import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';
import * as fs from 'fs';

// Parse env
const envContent = fs.readFileSync('./.env.production', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=');
  if (key && !line.startsWith('#')) env[key.trim()] = rest.join('=').trim();
});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

async function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

async function main() {
  console.log('\n📊 FASE 07B5 - MEDICIÓN REAL DATASET PRODUCTIVO ITAÚ YOSBA');
  console.log('='.repeat(70));

  try {
    console.log('\n1️⃣  Leyendo transacciones...');
    const txRef = ref(database, 'family/transactions');
    const txSnapshot = await withTimeout(get(txRef), 10000);
    const transactions = txSnapshot.exists()
      ? Object.entries(txSnapshot.val()).map(([id, data]) => ({ id, ...data }))
      : [];

    console.log('2️⃣  Leyendo categorías...');
    const catRef = ref(database, 'family/categories');
    const catSnapshot = await withTimeout(get(catRef), 10000);
    const categories = catSnapshot.exists()
      ? Object.entries(catSnapshot.val()).map(([id, data]) => ({ id, ...data }))
      : [];

    console.log('\n📈 BASELINE METRICS:');
    console.log('━'.repeat(70));
    const total = transactions.length;
    const pending = transactions.filter(t => !t.category || t.status === 'pending');
    const categorized = transactions.filter(t => t.category && t.status !== 'pending');

    console.log(`  Total:               ${total}`);
    console.log(`  Categorized:         ${categorized.length}`);
    console.log(`  Pending:             ${pending.length}`);

    console.log('\n📅 TEMPORAL DISTRIBUTION:');
    console.log('━'.repeat(70));
    const months = {};
    transactions.forEach(t => {
      const d = new Date(t.date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[k] = (months[k] || 0) + 1;
    });
    Object.entries(months).sort().forEach(([m, c]) => console.log(`  ${m}: ${c}`));

    console.log('\n📊 ANALYSIS COMPLETE');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  }

  process.exit(0);
}

main();
