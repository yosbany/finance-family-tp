/**
 * Authentication Middleware
 * 
 * Verifies Authorization header and extracts authenticated context.
 * Adds context to request for use in route handlers.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { extractAuthContext, AuthenticatedContext } from '../auth/authenticatedContext.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedContext;
    }
  }
}

/**
 * Add authenticated context to request if Authorization header is present
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    if (authHeader) {
      (request as any).auth = await extractAuthContext(authHeader);
    }
  } catch (error) {
    // Continue without auth - endpoint will require it if needed
  }
}

/**
 * Require authenticated context - reject if missing or invalid
 */
export async function requireAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return reply.code(401).send({
        error: 'UNAUTHENTICATED',
        message: 'Missing Authorization header',
      });
    }

    (request as any).auth = await extractAuthContext(authHeader);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return reply.code(401).send({
      error: 'UNAUTHENTICATED',
      message,
    });
  }
}

export default {
  optionalAuthMiddleware,
  requireAuthMiddleware,
};
