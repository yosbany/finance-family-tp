"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugVerifyToken = exports.health = exports.searchTransactionsEndpoint = void 0;
const functions = __importStar(require("firebase-functions"));
const searchTransactions_1 = require("./agent/tools/searchTransactions");
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
exports.searchTransactionsEndpoint = functions
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
        const authenticatedContext = {
            uid
        };
        // Ejecutar tool
        const result = await (0, searchTransactions_1.searchTransactions)(authenticatedContext, data);
        return result;
    }
    catch (error) {
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
exports.health = functions
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
exports.debugVerifyToken = functions
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
//# sourceMappingURL=index.js.map