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

console.log('Firebase Config for Frontend:');
console.log(`VITE_FIREBASE_PROJECT_ID=${serviceAccount.project_id}`);
console.log(`VITE_FIREBASE_AUTH_DOMAIN=${serviceAccount.project_id}.firebaseapp.com`);
console.log(`VITE_FIREBASE_DATABASE_URL=https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`);
console.log(`VITE_FIREBASE_STORAGE_BUCKET=${serviceAccount.project_id}.appspot.com`);
console.log('');
console.log('Note: VITE_FIREBASE_API_KEY, MESSAGING_SENDER_ID, APP_ID');
console.log('must be found from Firebase Console (public keys only)');
