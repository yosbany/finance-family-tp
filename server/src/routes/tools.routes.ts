/**
 * Finance Tools Routes
 * 
 * Endpoints for finance tools (search-transactions, etc.)
 * All endpoints require authentication.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { searchTransactions } from '../finance/tools/searchTransactions.js';
import { AuthenticatedContext } from '../auth/authenticatedContext.js';
import { requireAuthMiddleware } from '../middleware/auth.middleware.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedContext;
    }
  }
}

export async function registerToolsRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/tools/search-transactions
   * 
   * Search transactions with filters
   * 
   * Request:
   *   Authorization: Bearer <Firebase ID Token>
   *   Content-Type: application/json
   *   Body: {
   *     from?: number,
   *     to?: number,
   *     accountId?: string,
   *     categoryId?: string,
   *     type?: 'income' | 'expense' | 'transfer',
   *     currency?: 'UYU' | 'USD',
   *     description?: string,
   *     minAmount?: number,
   *     maxAmount?: number,
   *     status?: 'pending' | 'classified' | 'verified',
   *     limit?: number,
   *     offset?: number
   *   }
   * 
   * Response (200):
   *   {
   *     transactions: [...],
   *     pagination: { total, matched, offset, limit, truncated }
   *   }
   * 
   * Response (401): Missing or invalid authentication
   * Response (400): Invalid parameters
   * Response (500): Internal error
   */
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/tools/search-transactions',
    { preHandler: requireAuthMiddleware },
    async (request: FastifyRequest & { auth?: AuthenticatedContext }, reply: FastifyReply) => {
      try {
        const auth = (request as any).auth as AuthenticatedContext;
        if (!auth) {
          return reply.code(401).send({
            error: 'UNAUTHENTICATED',
            message: 'Authentication required',
          });
        }

        const result = await searchTransactions(auth, request.body);
        return reply.code(200).send(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        // Handle specific error types
        if (message.includes('SECURITY_VIOLATION')) {
          return reply.code(400).send({
            error: 'SECURITY_VIOLATION',
            message: 'Invalid request parameters',
          });
        }

        if (message.includes('INVALID_ARGUMENT')) {
          const detail = message.split(':')[1]?.trim() || 'Invalid argument';
          return reply.code(400).send({
            error: 'INVALID_ARGUMENT',
            message: detail,
          });
        }

        if (message.includes('USER_NOT_AUTHORIZED')) {
          return reply.code(403).send({
            error: 'PERMISSION_DENIED',
            message: 'User not authorized for this operation',
          });
        }

        if (message.includes('UNAUTHENTICATED')) {
          return reply.code(401).send({
            error: 'UNAUTHENTICATED',
            message,
          });
        }

        console.error('[ERROR] searchTransactions:', message);
        return reply.code(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Internal server error',
        });
      }
    }
  );
}

export default registerToolsRoutes;
