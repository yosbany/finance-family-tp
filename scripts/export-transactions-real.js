#!/usr/bin/env node

/**
 * FASE 07C2 - Export Real Transactions from Firebase
 * 
 * USAGE:
 *   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/firebase-service-account.json"
 *   node scripts/export-transactions-real.js
 * 
 * OUTPUT:
 *   - Prints dataset statistics to stdout
 *   - Exports JSON to: ./transactions-real.json
 */

require('dotenv').config();
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (!credentialsPath) {
  console.error('ERROR: GOOGLE_APPLICATION_CREDENTIALS not set');
  console.error('');
  console.error('Usage:');
  console.error('  export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"');
  console.error('  node scripts/export-transactions-real.js');
  process.exit(1);
}

if (!fs.existsSync(credentialsPath)) {
  console.error(`ERROR: Credentials file not found: ${credentialsPath}`);
  process.exit(1);
}

let credentials;
try {
  credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
} catch (e) {
  console.error(`ERROR: Failed to parse credentials: ${e.message}`);
  process.exit(1);
}

console.log('🔐 Initializing Firebase Admin SDK...');

try {
  admin.initializeApp({
    credential: admin.credential.cert(credentials),
    projectId: credentials.project_id,
    databaseURL: `https://${credentials.project_id}-default-rtdb.firebaseio.com`
  });
} catch (e) {
  if (!e.message.includes('already initialized')) {
    console.error(`ERROR: Failed to initialize Firebase: ${e.message}`);
    process.exit(1);
  }
}

async function exportTransactions() {
  try {
    const db = admin.database();

    console.log('📍 Reading authorized users...');
    const authRef = db.ref('authorizedUsers');
    const authSnap = await authRef.once('value');
    const authData = authSnap.val();

    if (!authData || Object.keys(authData).length === 0) {
      console.error('ERROR: No authorized users found');
      process.exit(1);
    }

    const firstUid = Object.keys(authData)[0];
    const familyRoot = authData[firstUid].familyRoot || 'family';

    console.log(`✅ Family root: ${familyRoot}`);
    console.log('');
    console.log('📥 Fetching transactions...');

    const txRef = db.ref(`${familyRoot}/transactions`);
    const txSnap = await txRef.once('value');
    const transactionsRaw = txSnap.val() || {};

    const transactionsArray = Object.entries(transactionsRaw).map(([id, data]) => ({
      id,
      ...data
    }));

    const pending = transactionsArray.filter(t => t.status === 'pending');
    const classified = transactionsArray.filter(t => t.status === 'classified');
    const categories = new Set(classified.map(t => t.category).filter(c => c));

    console.log('');
    console.log('📊 DATASET SUMMARY');
    console.log('═'.repeat(60));
    console.log(`  Total transactions: ${transactionsArray.length}`);
    console.log(`  Classified: ${classified.length}`);
    console.log(`  Pending: ${pending.length}`);
    console.log(`  Unique categories: ${categories.size}`);
    console.log('═'.repeat(60));
    console.log('');

    // Sample pending transactions
    if (pending.length > 0) {
      console.log('📋 Sample pending transactions:');
      pending.slice(0, 5).forEach((tx, idx) => {
        console.log(`  ${idx + 1}. "${tx.description}" (${tx.amount} ${tx.currency})`);
      });
      if (pending.length > 5) {
        console.log(`  ... and ${pending.length - 5} more`);
      }
      console.log('');
    }

    // Prepare export
    const exportData = {
      exported: new Date().toISOString(),
      exportedFrom: familyRoot,
      dataset: {
        total: transactionsArray.length,
        classified: classified.length,
        pending: pending.length,
        categories: categories.size,
        categoryList: Array.from(categories)
      },
      transactions: transactionsArray
    };

    const outputPath = path.join(process.cwd(), 'transactions-real.json');
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));

    console.log(`✅ Exported to: ${outputPath}`);
    console.log('');

    // Security check
    console.log('🔒 SECURITY CHECK');
    console.log('═'.repeat(60));
    const pendingSample = pending[0];
    if (pendingSample) {
      console.log('✅ Pending transaction structure:');
      console.log(`   - Has id: ${!!pendingSample.id}`);
      console.log(`   - Has description: ${!!pendingSample.description}`);
      console.log(`   - Has status: ${pendingSample.status}`);
      console.log(`   - Has category: ${!!pendingSample.category}`);
      console.log(`   - NO uid in transaction: ${!pendingSample.uid}`);
      console.log(`   - NO firebasePath in transaction: ${!pendingSample.firebasePath}`);
    }
    console.log('═'.repeat(60));
    console.log('');

    console.log('✅ EXPORT COMPLETE');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Copy to test data: cp transactions-real.json test-data-fase07c2.json');
    console.log('  2. Run pipeline: npm run phase07c2:test');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

exportTransactions();
