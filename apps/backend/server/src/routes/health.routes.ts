/**
 * Health Check Routes
 * 
 * Public endpoint for monitoring server health.
 * No authentication required.
 */

import { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /health
   * 
   * Returns server health status
   */
  fastify.get('/health', async (_request, _reply) => {
    return {
      status: 'ok',
      timestamp: Date.now(),
    };
  });

  /**
   * GET /health/ready
   * 
   * Detailed readiness check (for Kubernetes-style deployments)
   */
  fastify.get('/health/ready', async (_request, _reply) => {
    return {
      status: 'ready',
      timestamp: Date.now(),
      version: '1.0.0',
    };
  });
}

export default registerHealthRoutes;
