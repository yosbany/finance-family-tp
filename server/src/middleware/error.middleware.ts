/**
 * Error Handling Middleware
 * 
 * Centralized error handling that:
 * - Does NOT expose internal details (stack traces, paths, credentials)
 * - Provides appropriate HTTP status codes
 * - Logs errors securely
 */

import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode?: number;
}

/**
 * Global error handler
 */
export async function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);

  // Security: Do NOT expose internal details
  const isDeveloping = process.env.NODE_ENV === 'development';

  // Determine error type and status code
  let statusCode = 500;
  let errorType = 'INTERNAL_ERROR';
  let errorMessage = 'Internal server error';

  if (message.includes('UNAUTHENTICATED')) {
    statusCode = 401;
    errorType = 'UNAUTHENTICATED';
    errorMessage = 'Authentication required or invalid credentials';
  } else if (message.includes('SECURITY_VIOLATION')) {
    statusCode = 400;
    errorType = 'SECURITY_VIOLATION';
    errorMessage = 'Invalid request parameters';
  } else if (message.includes('INVALID_ARGUMENT')) {
    statusCode = 400;
    errorType = 'INVALID_ARGUMENT';
    errorMessage = message.includes(':') ? message.split(':')[1].trim() : 'Invalid request';
  } else if (message.includes('USER_NOT_AUTHORIZED')) {
    statusCode = 403;
    errorType = 'PERMISSION_DENIED';
    errorMessage = 'User not authorized for this operation';
  } else if (
    'statusCode' in error &&
    typeof error.statusCode === 'number'
  ) {
    statusCode = error.statusCode;
  }

  // Log error securely (no sensitive data)
  const logData = {
    timestamp: new Date().toISOString(),
    path: request.url,
    method: request.method,
    statusCode,
    errorType,
  };

  if (isDeveloping) {
    console.error('[ERROR]', logData, message);
  } else {
    console.error('[ERROR]', logData);
  }

  // Send response
  const response: ErrorResponse = {
    error: errorType,
    message: errorMessage,
    statusCode,
  };

  reply.code(statusCode).send(response);
}

export default {
  errorHandler,
};
