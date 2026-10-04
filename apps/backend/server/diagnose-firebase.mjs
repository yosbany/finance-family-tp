import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const credPath = path.join(__dirname, '../../../finance-family-tp-firebase-adminsdk-fbsvc-99a701a97e.json');

if (!fs.existsSync(credPath)) {
  console.error(`ERROR: Credentials not found`);
  process.exit(1);
}

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
    console.log('\n🔍 FIREBASE DIAGNOSTIC\n');
    console.log('Project ID:', serviceAccount.project_id);
    console.log('Database URL: https://finance-family-tp-default-rtdb.firebaseio.com\n');

    console.log('Checking root nodes...\n');

    const rootRef = db.ref('/');
    const rootSnapshot = await rootRef.once('value');
    const rootData = rootSnapshot.val();

    if (!rootData) {
      console.log('❌ Root is empty or null\n');
    } else {
      console.log('✅ Root data found');
      console.log('Root keys:', Object.keys(rootData).join(', '));
      console.log('');
      
      // Check transactions
      const txSnapshot = await db.ref('/transactions').once('value');
      const txData = txSnapshot.val();
      const txCount = txData ? Object.keys(txData).length : 0;
      console.log(`📊 transactions: ${txCount} items`);

      // Check categories
      const catSnapshot = await db.ref('/categories').once('value');
      const catData = catSnapshot.val();
      const catCount = catData ? Object.keys(catData).length : 0;
      console.log(`🏷️  categories: ${catCount} items`);

      // Sample a transaction
      if (txCount > 0) {
        const txId = Object.keys(txData)[0];
        console.log(`\nSample transaction (${txId}):`);
        console.log(JSON.stringify(txData[txId], null, 2));
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
