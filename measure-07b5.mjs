import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';
import { readFileSync } from 'fs';
import { normalizeText, tokenize, generateNGrams, matchKeyword, suggestCategory, categorizeTransaction } from './apps/frontend/src/utils/categorization.ts';

// Parse env
const envContent = readFileSync('./.env.production', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

async function getData() {
  const txRef = ref(database, 'family/transactions');
  const catRef = ref(database, 'family/categories');
  
  const [txSnap, catSnap] = await Promise.all([get(txRef), get(catRef)]);
  
  const transactions = txSnap.exists() ? Object.entries(txSnap.val()).map(([id, data]) => ({ id, ...data })) : [];
  const categories = catSnap.exists() ? Object.entries(catSnap.val()).map(([id, data]) => ({ id, ...data })) : [];
  
  return { transactions, categories };
}

async function main() {
  console.log('📊 FASE 07B5 - MEDICIÓN REAL');
  const { transactions, categories } = await getData();
  
  console.log(`Total: ${transactions.length}`);
  console.log(`Categories: ${categories.length}`);
  
  const pending = transactions.filter(t => !t.category);
  console.log(`Pending: ${pending.length}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
