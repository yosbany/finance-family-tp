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

async function exploreNode(path, depth = 0) {
  if (depth > 4) return;
  const indent = '  '.repeat(depth);
  const snapshot = await db.ref(path).once('value');
  const data = snapshot.val();
  
  if (!data) {
    console.log(`${indent}${path}: (empty)`);
    return;
  }
  
  if (typeof data !== 'object') {
    console.log(`${indent}${path}: ${typeof data} = ${String(data).substring(0, 50)}`);
    return;
  }
  
  const keys = Object.keys(data);
  console.log(`${indent}${path}: [${keys.length} keys]`);
  
  if (depth < 2) {
    for (const key of keys.slice(0, 3)) {
      await exploreNode(`${path}/${key}`, depth + 1);
    }
  }
}

async function main() {
  try {
    console.log('\n🌳 FIREBASE STRUCTURE\n');
    await exploreNode('/');
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
}

main();
