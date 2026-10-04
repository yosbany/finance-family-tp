import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const credPath = path.join(__dirname, '../../../finance-family-tp-firebase-adminsdk-fbsvc-99a701a97e.json');

const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf-8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://finance-family-tp-default-rtdb.firebaseio.com'
  });
}

const db = admin.database();

async function main() {
  try {
    console.log('\n📊 TRANSACTION COUNTS\n');

    // Get all transactions
    const txSnapshot = await db.ref('/family/transactions').once('value');
    const txData = txSnapshot.val() || {};
    const allTx = Object.values(txData);
    
    console.log(`Total transactions: ${allTx.length}`);

    let pending = 0;
    let categorized = 0;
    for (const tx of allTx) {
      if (tx.status === 'pending') pending++;
      else categorized++;
    }

    console.log(`  - Categorized: ${categorized}`);
    console.log(`  - Pending: ${pending}`);

    // Get categories
    const catSnapshot = await db.ref('/family/categories').once('value');
    const catData = catSnapshot.val() || {};
    console.log(`  - Categories: ${Object.keys(catData).length}\n`);

    // Verify expected numbers
    if (allTx.length === 672 && categorized === 596 && pending === 76) {
      console.log('✅ NUMBERS MATCH EXPECTED VALUES!');
    } else {
      console.log('⚠️  Numbers differ from expected (672/596/76)');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
}

main();
