import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load credentials
const serviceAccount = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../nrd-db-firebase-adminsdk-fbsvc-72fa84a31a.json'), 
  'utf8'
));

// Initialize Firebase Admin
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'nrd-db',
  databaseURL: 'https://nrd-db-default-rtdb.firebaseio.com'
});

// Get database
const db = admin.database(app);

// Test read
console.log('🔍 Testing database connection...');
db.ref('/').once('value', (snapshot) => {
  if (snapshot.exists()) {
    console.log('✅ Database connected');
    const data = snapshot.val();
    const keys = Object.keys(data).slice(0, 5);
    console.log('   Sample data keys:', keys);
    
    // Try to find a user
    if (data.users) {
      const userKeys = Object.keys(data.users).slice(0, 1);
      if (userKeys.length > 0) {
        console.log('   Found user UIDs:', userKeys);
      }
    }
  } else {
    console.log('📊 Database is empty or no read permissions');
  }
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.error('❌ Timeout - database not responding');
  process.exit(1);
}, 5000);
