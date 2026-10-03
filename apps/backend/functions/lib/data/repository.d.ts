/**
 * Data Repository
 *
 * Capa de acceso a datos que GARANTIZA AISLAMIENTO POR UID.
 *
 * El repositorio:
 * - Nunca construye paths desde argumentos de cliente
 * - Siempre DERIVA el path desde AuthenticatedContext.uid
 * - Implementa validación server-side de argumentos
 * - Retorna ÚNICAMENTE información sanitizada
 *
 * Firebase Admin saltará reglas de seguridad, por lo que
 * este código es la BARRERA DE SEGURIDAD real.
 */
import { AuthenticatedContext } from '../auth/context';
import { Transaction } from '../types/transaction';
/**
 * Obtiene el path raíz de familia para un usuario autorizado.
 *
 * IMPORTANTE: Solo accesible para usuarios en authorizedUsers.
 * La autorización se valida en HTTP endpoint, no aquí.
 */
export declare function getFamilyRootForUser(uid: string): Promise<string>;
/**
 * Obtiene transacciones del usuario autenticado.
 *
 * SEGURIDAD CRÍTICA:
 * - Siempre filtra por UID del contexto
 * - Nunca acepta UID desde argumentos
 * - Aplica límites de cantidad
 */
export declare function getUserTransactions(context: AuthenticatedContext, filters: {
    from?: number;
    to?: number;
    accountId?: string;
    categoryId?: string;
    type?: string;
    currency?: string;
    description?: string;
    minAmount?: number;
    maxAmount?: number;
    status?: string;
    limit?: number;
    offset?: number;
}): Promise<Transaction[]>;
/**
 * Obtiene transacciones completas con información de conteo.
 * Usado por searchTransactions.
 */
export declare function searchUserTransactions(context: AuthenticatedContext, filters: {
    from?: number;
    to?: number;
    accountId?: string;
    categoryId?: string;
    type?: string;
    currency?: string;
    description?: string;
    minAmount?: number;
    maxAmount?: number;
    status?: string;
    limit?: number;
    offset?: number;
}): Promise<{
    transactions: Transaction[];
    total: number;
    matched: number;
    offset: number;
    limit: number;
    truncated: boolean;
}>;
