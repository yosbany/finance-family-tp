/**
 * Firebase Admin SDK Initialization
 * 
 * Initializes Firebase Admin SDK for server-side access to:
 * - Firebase Authentication (verifyIdToken)
 * - Realtime Database
 * 
 * SECURITY:
 * - Credentials must be provided via GOOGLE_APPLICATION_CREDENTIALS env var
 * - Or via Application Default Credentials
 * - Credentials are NEVER in code or .env files (must be in secured secrets)
 * - Admin SDK bypasses security rules, so application code is the actual security barrier
 */

import * as admin from 'firebase-admin';
import { config } from '../config/env.js';

let app: admin.app.App | null = null;

/**
 * Initialize Firebase Admin SDK
 * Logs helpful messages if initialization fails
 */
export function initializeFirebase(): admin.app.App {
  if (app) {
    return app;
  }

  try {
    app = admin.initializeApp({
      projectId: config.firebaseProjectId,
      databaseURL: config.firebaseDatabaseUrl,
    });

    console.log(
      `✅ Firebase initialized: ${config.firebaseProjectId}`
    );

    return app;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error);
    console.error('\nMake sure GOOGLE_APPLICATION_CREDENTIALS is set to a valid service account JSON file');
    process.exit(1);
  }
}

/**
 * Get Firebase Database instance
 */
export function getDatabase(): admin.database.Database {
  if (!app) {
    initializeFirebase();
  }
  return admin.database(app!);
}

/**
 * Get Firebase Auth instance
 */
export function getAuth(): admin.auth.Auth {
  if (!app) {
    initializeFirebase();
  }
  return admin.auth(app!);
}

/**
 * Verify Firebase ID Token
 * CRITICAL SECURITY: This is the authentication boundary
 */
export async function verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken> {
  try {
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`UNAUTHENTICATED: Invalid or expired token - ${message}`);
  }
}

export default {
  initializeFirebase,
  getDatabase,
  getAuth,
  verifyIdToken,
};
