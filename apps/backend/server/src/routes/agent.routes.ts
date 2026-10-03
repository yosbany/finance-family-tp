/**
 * Agent Routes
 * 
 * Endpoint for the financial agent query.
 * Requires Firebase Authentication.
 * 
 * POST /api/agent/query
 * - Input: { message: string }
 * - Output: { answer: string, toolsUsed: string[] }
 * 
 * SECURITY:
 * - Requires valid Firebase ID Token
 * - User identity from token only
 * - No uid/token in response
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { AuthenticatedContext } from '../auth/authenticatedContext.js';
import { requireAuthMiddleware } from '../middleware/auth.middleware.js';
import LLMClient from '../llm/client.js';
import AgentOrchestrator, { AgentQueryInput } from '../agent/orchestrator.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedContext;
    }
  }
}

export async function registerAgentRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/agent/query
   * 
   * Send a query to the financial agent
   * 
   * Request:
   *   Authorization: Bearer <Firebase ID Token>
   *   Content-Type: application/json
   *   Body: {
   *     message: string (required, max 1000 chars)
   *   }
   * 
   * Response (200):
   *   {
   *     answer: string,
   *     toolsUsed: string[],
   *     toolIterations: number,
   *     requestId: string
   *   }
   * 
   * Response (401): Missing or invalid authentication
   * Response (400): Invalid parameters
   * Response (500): Internal error
   */
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/agent/query',
    { preHandler: requireAuthMiddleware },
    async (request: FastifyRequest & { auth?: AuthenticatedContext }, reply: FastifyReply) => {
      const requestId = randomUUID();
      const startTime = Date.now();

      try {
        const auth = (request as any).auth as AuthenticatedContext;
        if (!auth) {
          return reply.code(401).send({
            error: 'UNAUTHENTICATED',
            message: 'Authentication required',
          });
        }

        // Validate input
        if (!request.body || typeof request.body !== 'object') {
          return reply.code(400).send({
            error: 'INVALID_ARGUMENT',
            message: 'Request body must be an object',
          });
        }

        const input = request.body as AgentQueryInput;

        if (!input.message || typeof input.message !== 'string') {
          return reply.code(400).send({
            error: 'INVALID_ARGUMENT',
            message: 'message field is required and must be a string',
          });
        }

        // Create LLM client and orchestrator
        try {
          const llmClient = new LLMClient();
          const orchestrator = new AgentOrchestrator(llmClient);

          // Execute query
          const result = await orchestrator.query(auth, input, requestId);

          // Log success
          const duration = Date.now() - startTime;
          console.log(
            `[AGENT] ${requestId} success (${duration}ms) tools=${result.toolsUsed.join(',')}`
          );

          return reply.code(200).send(result);
        } catch (orchestrationError) {
          const message =
            orchestrationError instanceof Error
              ? orchestrationError.message
              : String(orchestrationError);

          // Handle specific error types
          if (message.includes('INVALID_ARGUMENT')) {
            return reply.code(400).send({
              error: 'INVALID_ARGUMENT',
              message: message.replace('INVALID_ARGUMENT: ', ''),
            });
          }

          if (message.includes('LLM_CONFIG_ERROR')) {
            console.error('[AGENT] LLM not configured:', message);
            return reply.code(500).send({
              error: 'AGENT_ERROR',
              message: 'Agent not available',
            });
          }

          if (message.includes('TOOL_ITERATION_LIMIT')) {
            return reply.code(400).send({
              error: 'TOOL_ITERATION_LIMIT',
              message: 'Too many tool iterations',
            });
          }

          if (
            message.includes('LLM_TIMEOUT') ||
            message.includes('LLM_NETWORK_ERROR')
          ) {
            return reply.code(504).send({
              error: 'AGENT_UNAVAILABLE',
              message: 'LLM service unavailable',
            });
          }

          if (message.includes('LLM_AUTH_ERROR')) {
            console.error('[AGENT] LLM auth error:', message);
            return reply.code(500).send({
              error: 'AGENT_ERROR',
              message: 'Agent authentication failed',
            });
          }

          // Generic LLM error
          if (message.includes('LLM_')) {
            console.error('[AGENT] LLM error:', message);
            return reply.code(500).send({
              error: 'AGENT_ERROR',
              message: 'Agent error',
            });
          }

          throw orchestrationError;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (message.includes('SECURITY_VIOLATION')) {
          return reply.code(400).send({
            error: 'SECURITY_VIOLATION',
            message: 'Invalid request parameters',
          });
        }

        if (message.includes('USER_NOT_AUTHORIZED')) {
          return reply.code(403).send({
            error: 'PERMISSION_DENIED',
            message: 'User not authorized',
          });
        }

        if (message.includes('UNAUTHENTICATED')) {
          return reply.code(401).send({
            error: 'UNAUTHENTICATED',
            message,
          });
        }

        const duration = Date.now() - startTime;
        console.error(`[AGENT] ${requestId} error (${duration}ms): ${message}`);
        return reply.code(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Internal server error',
        });
      }
    }
  );
}

export default registerAgentRoutes;
