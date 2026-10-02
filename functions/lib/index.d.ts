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
export declare const searchTransactionsEndpoint: functions.HttpsFunction & functions.Runnable<any>;
/**
 * HTTP Health check endpoint
 *
 * Verifica que el servidor esté activo.
 * No requiere autenticación.
 */
export declare const health: functions.HttpsFunction;
/**
 * Debug endpoint (solo desarrollo)
 *
 * Verifica que el token ID puede ser verificado.
 * SOLO en desarrollo. Eliminar en producción.
 */
export declare const debugVerifyToken: functions.HttpsFunction & functions.Runnable<any>;
