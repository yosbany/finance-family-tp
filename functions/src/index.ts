/**
 * Firebase Cloud Functions - Agent API
 * 
 * Punto de entrada de todas las funciones callable.
 * 
 * ARQUITECTURA:
 * 
 * Firebase Callable (HTTP)
 *     ↓
 * Verifica ID Token
 *     ↓
 * Construye AuthenticatedContext
 *     ↓
 * Ejecuta Tool (searchTransactions, etc)
 *     ↓
 * Retorna resultado sanitizado
 * 
 * El uid NUNCA viene de argumentos. Siempre del token verificado.
 */

import * as functions from 'firebase-functions';
import { AuthenticatedContext } from './auth/context';
import { searchTransactions } from './agent/tools/searchTransactions';

/**
 * HTTP Cloud Function que ejecuta searchTransactions
 * 
 * Request:
 * - headers: { Authorization: "Bearer <idToken>" }
 * - body: { from?, to?, accountId?, ... }
 * 
 * Response:
 * - 200: { transactions: [...], pagination: {...} }
 * - 401: No autenticado
 * - 400: Argumentos inválidos
 * - 500: Error interno
 */
export const searchTransactionsEndpoint = functions
  .region('us-east1')
  .https
  .onCall(async (data, context) => {
    try {
      // Verificar autenticación
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
      }
      
      const uid = context.auth.uid;
      
      // Construir contexto autenticado
      // IMPORTANTE: El uid viene SOLO del contexto autenticado de Firebase
      // NO del request.data
      const authenticatedContext: AuthenticatedContext = {
        uid
      };
      
      // Ejecutar tool
      const result = await searchTransactions(authenticatedContext, data);
      
      return result;
    } catch (error) {
      console.error('Error in searchTransactionsEndpoint:', error);
      
      const message = error instanceof Error ? error.message : String(error);
      
      if (message.includes('SECURITY_VIOLATION')) {
        throw new functions.https.HttpsError('invalid-argument', message);
      }
      
      if (message.includes('INVALID_ARGUMENT')) {
        throw new functions.https.HttpsError('invalid-argument', message);
      }
      
      if (message.includes('UNAUTHENTICATED')) {
        throw new functions.https.HttpsError('unauthenticated', message);
      }
      
      if (message.includes('USER_NOT_AUTHORIZED')) {
        throw new functions.https.HttpsError('permission-denied', 'User not authorized');
      }
      
      throw new functions.https.HttpsError('internal', 'Internal server error');
    }
  });

/**
 * HTTP Health check endpoint
 * 
 * Verifica que el servidor esté activo.
 * No requiere autenticación.
 */
export const health = functions
  .region('us-east1')
  .https
  .onRequest((_req, res) => {
    res.json({
      status: 'ok',
      timestamp: Date.now()
    });
  });

/**
 * Debug endpoint (solo desarrollo)
 * 
 * Verifica que el token ID puede ser verificado.
 * SOLO en desarrollo. Eliminar en producción.
 */
export const debugVerifyToken = functions
  .region('us-east1')
  .https
  .onCall(async (_data, context) => {
    if (process.env.NODE_ENV === 'production') {
      throw new functions.https.HttpsError('permission-denied', 'Not available in production');
    }
    
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    
    return {
      uid: context.auth.uid,
      verified: true
    };
  });
