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
    console.log('\n🏠 /family STRUCTURE\n');

    const familySnapshot = await db.ref('/family').once('value');
    const familyData = familySnapshot.val();
    
    console.log('Family keys:', Object.keys(familyData).join(', '));
    console.log('');

    // Check accounts
    const accountsSnapshot = await db.ref('/family/accounts').once('value');
    const accountsData = accountsSnapshot.val();
    console.log(`📊 /family/accounts: ${Object.keys(accountsData || {}).length} accounts`);
    
    if (accountsData) {
      const sampleAccountId = Object.keys(accountsData)[0];
      console.log(`Sample account: ${sampleAccountId}`);
      const sampleAccount = accountsData[sampleAccountId];
      console.log(`  - Keys: ${Object.keys(sampleAccount).join(', ')}`);
      
      // Check if account has transactions
      if (sampleAccount.transactions) {
        const txCount = Object.keys(sampleAccount.transactions).length;
        console.log(`  - Transactions: ${txCount}`);
        
        // Get status counts
        const txData = sampleAccount.transactions;
        let pending = 0, categorized = 0;
        for (const tx of Object.values(txData)) {
          if (tx.status === 'pending') pending++;
          else categorized++;
        }
        console.log(`    - Pending: ${pending}, Categorized: ${categorized}`);
      }
    }

    // Check categories
    const categoriesSnapshot = await db.ref('/family/categories').once('value');
    const categoriesData = categoriesSnapshot.val();
    console.log(`\n🏷️  /family/categories: ${Object.keys(categoriesData || {}).length} categories`);
    if (categoriesData) {
      console.log(`Sample categories: ${Object.values(categoriesData).map((c, i) => i < 3 ? c.name : null).filter(Boolean).join(', ')}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
}

main();
