/**
 * Fastify Application Factory
 * 
 * Creates and configures the Fastify application with:
 * - CORS
 * - Middleware
 * - Routes
 * - Error handling
 */

import fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from '../config/env.js';
import { errorHandler } from '../middleware/error.middleware.js';
import registerHealthRoutes from '../routes/health.routes.js';
import registerToolsRoutes from '../routes/tools.routes.js';

export async function createApp() {
  const app = fastify({
    logger: {
      level: config.isDevelopment() ? 'debug' : 'warn',
    },
  });

  // CORS Configuration
  await app.register(cors, {
    origin: config.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // Health check routes (public)
  await registerHealthRoutes(app);

  // Tools routes (authenticated)
  await registerToolsRoutes(app);

  // Global error handler
  app.setErrorHandler(
    errorHandler as Parameters<typeof app.setErrorHandler>[0]
  );

  return app;
}

export default createApp;
