import * as admin from 'firebase-admin';

// Firebase Admin SDK will use GOOGLE_APPLICATION_CREDENTIALS environment variable
// in production, or the application default credentials.
const app = admin.initializeApp();

export const database = admin.database(app);
export const auth = admin.auth(app);

export default app;
