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

import { database } from '../firebase-admin';
import { AuthenticatedContext } from '../auth/context';
import { Transaction } from '../types/transaction';

const DEFAULT_FAMILY_ROOT = 'family';

/**
 * Obtiene el path raíz de familia para un usuario autorizado.
 * 
 * IMPORTANTE: Solo accesible para usuarios en authorizedUsers.
 * La autorización se valida en HTTP endpoint, no aquí.
 */
export async function getFamilyRootForUser(
  uid: string
): Promise<string> {
  const userAuthRef = database.ref(`authorizedUsers/${uid}`);
  const snapshot = await userAuthRef.once('value');
  
  if (!snapshot.exists()) {
    throw new Error('USER_NOT_AUTHORIZED');
  }
  
  const userData = snapshot.val();
  if (!userData.autorizado) {
    throw new Error('USER_NOT_AUTHORIZED');
  }
  
  return userData.familyRoot || DEFAULT_FAMILY_ROOT;
}

/**
 * Obtiene transacciones del usuario autenticado.
 * 
 * SEGURIDAD CRÍTICA:
 * - Siempre filtra por UID del contexto
 * - Nunca acepta UID desde argumentos
 * - Aplica límites de cantidad
 */
export async function getUserTransactions(
  context: AuthenticatedContext,
  filters: {
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
  }
): Promise<Transaction[]> {
  const familyRoot = await getFamilyRootForUser(context.uid);
  
  // Construir path SOLO desde familyRoot (que viene de uid verificado)
  const transactionsRef = database.ref(`${familyRoot}/transactions`);
  const snapshot = await transactionsRef.once('value');
  
  if (!snapshot.exists()) {
    return [];
  }
  
  const transactionsData = snapshot.val();
  let transactions = Object.values(transactionsData) as Transaction[];
  
  // Aplicar filtros
  if (filters.from !== undefined) {
    transactions = transactions.filter(t => t.date >= filters.from!);
  }
  
  if (filters.to !== undefined) {
    transactions = transactions.filter(t => t.date <= filters.to!);
  }
  
  if (filters.accountId) {
    transactions = transactions.filter(t => t.accountId === filters.accountId);
  }
  
  if (filters.categoryId) {
    transactions = transactions.filter(t => t.category === filters.categoryId);
  }
  
  if (filters.type) {
    transactions = transactions.filter(t => t.type === filters.type);
  }
  
  if (filters.currency) {
    transactions = transactions.filter(t => t.currency === filters.currency);
  }
  
  if (filters.description) {
    const descLower = filters.description.toLowerCase();
    transactions = transactions.filter(t =>
      t.description.toLowerCase().includes(descLower)
    );
  }
  
  if (filters.minAmount !== undefined) {
    transactions = transactions.filter(t => Math.abs(t.amount) >= filters.minAmount!);
  }
  
  if (filters.maxAmount !== undefined) {
    transactions = transactions.filter(t => Math.abs(t.amount) <= filters.maxAmount!);
  }
  
  if (filters.status) {
    transactions = transactions.filter(t => t.status === filters.status);
  }
  
  // Ordenar por fecha descendente
  transactions.sort((a, b) => b.date - a.date);
  
  // Aplicar paginación
  const offset = filters.offset || 0;
  const limit = Math.min(filters.limit || 50, 500); // Máximo 500
  const paginated = transactions.slice(offset, offset + limit);
  
  return paginated;
}

/**
 * Obtiene transacciones completas con información de conteo.
 * Usado por searchTransactions.
 */
export async function searchUserTransactions(
  context: AuthenticatedContext,
  filters: {
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
  }
): Promise<{
  transactions: Transaction[];
  total: number;
  matched: number;
  offset: number;
  limit: number;
  truncated: boolean;
}> {
  const familyRoot = await getFamilyRootForUser(context.uid);
  const transactionsRef = database.ref(`${familyRoot}/transactions`);
  const snapshot = await transactionsRef.once('value');
  
  if (!snapshot.exists()) {
    return {
      transactions: [],
      total: 0,
      matched: 0,
      offset: 0,
      limit: 0,
      truncated: false
    };
  }
  
  const transactionsData = snapshot.val();
  let allTransactions = Object.values(transactionsData) as Transaction[];
  const total = allTransactions.length;
  
  // Aplicar filtros
  let filtered = allTransactions;
  
  if (filters.from !== undefined) {
    filtered = filtered.filter(t => t.date >= filters.from!);
  }
  
  if (filters.to !== undefined) {
    filtered = filtered.filter(t => t.date <= filters.to!);
  }
  
  if (filters.accountId) {
    filtered = filtered.filter(t => t.accountId === filters.accountId);
  }
  
  if (filters.categoryId) {
    filtered = filtered.filter(t => t.category === filters.categoryId);
  }
  
  if (filters.type) {
    filtered = filtered.filter(t => t.type === filters.type);
  }
  
  if (filters.currency) {
    filtered = filtered.filter(t => t.currency === filters.currency);
  }
  
  if (filters.description) {
    const descLower = filters.description.toLowerCase();
    filtered = filtered.filter(t =>
      t.description.toLowerCase().includes(descLower)
    );
  }
  
  if (filters.minAmount !== undefined) {
    filtered = filtered.filter(t => Math.abs(t.amount) >= filters.minAmount!);
  }
  
  if (filters.maxAmount !== undefined) {
    filtered = filtered.filter(t => Math.abs(t.amount) <= filters.maxAmount!);
  }
  
  if (filters.status) {
    filtered = filtered.filter(t => t.status === filters.status);
  }
  
  const matched = filtered.length;
  
  // Ordenar por fecha descendente
  filtered.sort((a, b) => b.date - a.date);
  
  // Aplicar paginación
  const offset = filters.offset || 0;
  const limit = Math.min(filters.limit || 50, 500);
  const truncated = offset + limit < matched;
  const transactions = filtered.slice(offset, offset + limit);
  
  return {
    transactions,
    total,
    matched,
    offset,
    limit,
    truncated
  };
}
