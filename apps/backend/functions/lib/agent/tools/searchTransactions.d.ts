/**
 * searchTransactions
 *
 * Herramienta principal de búsqueda de transacciones.
 *
 * SEGURIDAD:
 * - Recibe AuthenticatedContext (uid del token verificado)
 * - NO acepta uid, userId, familyId, o firebasePath
 * - Valida todos los argumentos server-side
 * - Retorna SOLO información necesaria (no objetos completos)
 * - Aplica límites máximos
 *
 * CONTRATO:
 * - Entrada: AuthenticatedContext + filtros
 * - Salida: Transacciones paginadas, conteos, info de truncado
 */
import { AuthenticatedContext } from '../../auth/context';
export declare const DEFAULT_SEARCH_LIMIT = 50;
export declare const MAX_SEARCH_LIMIT = 500;
/**
 * Input para searchTransactions.
 *
 * CRÍTICO: No incluye uid, userId, familyId, firebasePath, etc.
 */
export interface SearchTransactionsInput {
    from?: number;
    to?: number;
    accountId?: string;
    categoryId?: string;
    type?: 'income' | 'expense' | 'transfer';
    currency?: 'UYU' | 'USD';
    description?: string;
    minAmount?: number;
    maxAmount?: number;
    status?: 'pending' | 'classified' | 'verified';
    limit?: number;
    offset?: number;
}
/**
 * Resultado sanitizado de searchTransactions.
 *
 * Contiene SOLO:
 * - Transacciones filtradas
 * - Metadatos de conteo y paginación
 * - NO contiene uid, paths, tokens, credenciales
 */
export interface SearchTransactionsOutput {
    transactions: Array<{
        id: string;
        accountId: string;
        date: number;
        description: string;
        amount: number;
        currency: string;
        type: string;
        category?: string;
        status: string;
    }>;
    pagination: {
        total: number;
        matched: number;
        offset: number;
        limit: number;
        truncated: boolean;
    };
}
/**
 * Valida entrada de searchTransactions.
 *
 * Rechaza:
 * - uid, userId, familyId (parámetros prohibidos)
 * - firebasePath, paths (parámetros prohibidos)
 * - argumentos desconocidos
 * - valores fuera de rango
 */
export declare function validateSearchInput(input: unknown): SearchTransactionsInput;
/**
 * Ejecuta la búsqueda de transacciones.
 *
 * SEGURO: El uid viene del contexto autenticado, no de argumentos.
 */
export declare function searchTransactions(context: AuthenticatedContext, input: unknown): Promise<SearchTransactionsOutput>;
