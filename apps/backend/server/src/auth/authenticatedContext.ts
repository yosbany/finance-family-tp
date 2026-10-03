/**
 * Authenticated Context
 * 
 * Represents the security context of an authenticated request.
 * The uid is OBTAINED EXCLUSIVELY from the verified Firebase ID Token.
 * 
 * CRITICAL INVARIANT:
 * - uid comes ONLY from token verification
 * - NEVER from request body, query params, or headers (except Authorization)
 * - This module is the single source of truth for authenticated identity
 */

import { verifyIdToken } from '../firebase/admin.js';

export interface AuthenticatedContext {
  uid: string;
}

/**
 * Extract and verify Firebase ID Token from Authorization header
 * 
 * Expected format: "Bearer <idToken>"
 * 
 * SECURITY:
 * - Validates token format
 * - Verifies token with Firebase Admin SDK
 * - Returns only uid (no sensitive data)
 */
export async function extractAuthContext(
  authHeader: string | undefined
): Promise<AuthenticatedContext> {
  if (!authHeader) {
    throw new Error('UNAUTHENTICATED: Missing Authorization header');
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new Error('UNAUTHENTICATED: Invalid Authorization header format');
  }

  const token = parts[1];
  if (!token) {
    throw new Error('UNAUTHENTICATED: Empty token');
  }

  try {
    const decodedToken = await verifyIdToken(token);
    return {
      uid: decodedToken.uid,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`UNAUTHENTICATED: ${message}`);
  }
}

export default {
  extractAuthContext,
};
