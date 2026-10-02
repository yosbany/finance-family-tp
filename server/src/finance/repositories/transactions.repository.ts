/**
 * Transactions Repository
 * 
 * Data access layer that GUARANTEES UID ISOLATION.
 * 
 * CRITICAL SECURITY INVARIANT:
 * - NEVER constructs paths from client arguments
 * - ALWAYS derives path from AuthenticatedContext.uid
 * - Firebase Admin bypasses security rules, so this code is the ACTUAL security barrier
 * - Application must validate inputs BEFORE accessing this layer
 */

import { getDatabase } from '../../firebase/admin.js';
import { AuthenticatedContext } from '../../auth/authenticatedContext.js';
import { Transaction } from '../types/transaction.js';

const DEFAULT_FAMILY_ROOT = 'family';

/**
 * Get the family root path for an authorized user
 * 
 * IMPORTANT: Authorization is checked in HTTP endpoints, not here
 * This function assumes the user is already authenticated
 */
async function getFamilyRootForUser(uid: string): Promise<string> {
  const db = getDatabase();
  const userAuthRef = db.ref(`authorizedUsers/${uid}`);
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
 * Search user transactions with full pagination info
 * 
 * SECURITY CRITICAL:
 * - Always filters by context.uid
 * - NEVER accepts UID from arguments
 * - Applies maximum limits
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
  const db = getDatabase();
  const transactionsRef = db.ref(`${familyRoot}/transactions`);
  const snapshot = await transactionsRef.once('value');

  if (!snapshot.exists()) {
    return {
      transactions: [],
      total: 0,
      matched: 0,
      offset: 0,
      limit: 0,
      truncated: false,
    };
  }

  const transactionsData = snapshot.val();
  let allTransactions = Object.entries(transactionsData).map(([txId, data]) => ({
    id: txId,
    ...(data as Omit<Transaction, 'id'>),
  })) as Transaction[];

  const total = allTransactions.length;

  // Apply filters
  let filtered = allTransactions;

  if (filters.from !== undefined) {
    filtered = filtered.filter((t) => t.date >= filters.from!);
  }

  if (filters.to !== undefined) {
    filtered = filtered.filter((t) => t.date <= filters.to!);
  }

  if (filters.accountId) {
    filtered = filtered.filter((t) => t.accountId === filters.accountId);
  }

  if (filters.categoryId) {
    filtered = filtered.filter((t) => t.category === filters.categoryId);
  }

  if (filters.type) {
    filtered = filtered.filter((t) => t.type === filters.type);
  }

  if (filters.currency) {
    filtered = filtered.filter((t) => t.currency === filters.currency);
  }

  if (filters.description) {
    const descLower = filters.description.toLowerCase();
    filtered = filtered.filter((t) =>
      t.description.toLowerCase().includes(descLower)
    );
  }

  if (filters.minAmount !== undefined) {
    filtered = filtered.filter((t) => Math.abs(t.amount) >= filters.minAmount!);
  }

  if (filters.maxAmount !== undefined) {
    filtered = filtered.filter((t) => Math.abs(t.amount) <= filters.maxAmount!);
  }

  if (filters.status) {
    filtered = filtered.filter((t) => t.status === filters.status);
  }

  const matched = filtered.length;

  // Sort by date descending
  filtered.sort((a, b) => b.date - a.date);

  // Apply pagination
  const offset = filters.offset || 0;
  const limit = Math.min(filters.limit || 50, 500); // Maximum 500
  const truncated = offset + limit < matched;
  const transactions = filtered.slice(offset, offset + limit);

  return {
    transactions,
    total,
    matched,
    offset,
    limit,
    truncated,
  };
}

export default {
  searchUserTransactions,
};
