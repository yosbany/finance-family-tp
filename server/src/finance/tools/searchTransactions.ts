/**
 * searchTransactions Tool
 * 
 * Main transaction search tool.
 * 
 * SECURITY:
 * - Receives AuthenticatedContext (uid from verified token)
 * - Does NOT accept uid, userId, familyId, or firebasePath
 * - Validates all arguments server-side
 * - Returns ONLY necessary information (not full objects)
 * - Applies maximum limits
 * 
 * CONTRACT:
 * - Input: AuthenticatedContext + filters
 * - Output: Paginated transactions, counts, truncation info
 */

import { AuthenticatedContext } from '../../auth/authenticatedContext.js';
import { searchUserTransactions } from '../repositories/transactions.repository.js';

export const DEFAULT_SEARCH_LIMIT = 50;
export const MAX_SEARCH_LIMIT = 500;

/**
 * Input for searchTransactions
 * 
 * CRITICAL: Does NOT include uid, userId, familyId, firebasePath, etc.
 */
export interface SearchTransactionsInput {
  // Period (timestamps in ms)
  from?: number;
  to?: number;

  // Filters
  accountId?: string;
  categoryId?: string;
  type?: 'income' | 'expense' | 'transfer';
  currency?: 'UYU' | 'USD';
  description?: string;

  // Amount range (absolute value)
  minAmount?: number;
  maxAmount?: number;

  // Classification status
  status?: 'pending' | 'classified' | 'verified';

  // Pagination
  limit?: number;
  offset?: number;
}

/**
 * Sanitized result of searchTransactions
 * 
 * Contains ONLY:
 * - Filtered transactions
 * - Pagination metadata
 * - NO uid, paths, tokens, credentials
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
 * Validates searchTransactions input
 * 
 * Rejects:
 * - uid, userId, familyId (prohibited parameters)
 * - firebasePath, path (prohibited parameters)
 * - unknown arguments
 * - out-of-range values
 */
export function validateSearchInput(input: unknown): SearchTransactionsInput {
  if (typeof input !== 'object' || input === null) {
    throw new Error('INVALID_ARGUMENT: Input must be an object');
  }

  const obj = input as Record<string, unknown>;

  // Reject prohibited parameters
  const prohibitedParams = ['uid', 'userId', 'familyId', 'firebasePath', 'path'];
  for (const param of prohibitedParams) {
    if (param in obj) {
      throw new Error(
        `SECURITY_VIOLATION: Parameter '${param}' is not allowed`
      );
    }
  }

  // Validate known parameters
  const allowed = new Set([
    'from',
    'to',
    'accountId',
    'categoryId',
    'type',
    'currency',
    'description',
    'minAmount',
    'maxAmount',
    'status',
    'limit',
    'offset',
  ]);

  for (const key in obj) {
    if (!allowed.has(key)) {
      throw new Error(`INVALID_ARGUMENT: Unknown parameter '${key}'`);
    }
  }

  const result: SearchTransactionsInput = {};

  // Validate from
  if ('from' in obj) {
    const from = obj.from;
    if (typeof from !== 'number' || !Number.isFinite(from) || from < 0) {
      throw new Error(
        'INVALID_ARGUMENT: from must be a valid positive number (timestamp)'
      );
    }
    result.from = from;
  }

  // Validate to
  if ('to' in obj) {
    const to = obj.to;
    if (typeof to !== 'number' || !Number.isFinite(to) || to < 0) {
      throw new Error(
        'INVALID_ARGUMENT: to must be a valid positive number (timestamp)'
      );
    }
    result.to = to;
  }

  // Validate that from <= to
  if (
    result.from !== undefined &&
    result.to !== undefined &&
    result.from > result.to
  ) {
    throw new Error('INVALID_ARGUMENT: from must be <= to');
  }

  // Validate accountId
  if ('accountId' in obj) {
    const accountId = obj.accountId;
    if (
      typeof accountId !== 'string' ||
      accountId.length === 0 ||
      accountId.length > 128
    ) {
      throw new Error(
        'INVALID_ARGUMENT: accountId must be a non-empty string (max 128 chars)'
      );
    }
    result.accountId = accountId;
  }

  // Validate categoryId
  if ('categoryId' in obj) {
    const categoryId = obj.categoryId;
    if (
      typeof categoryId !== 'string' ||
      categoryId.length === 0 ||
      categoryId.length > 128
    ) {
      throw new Error(
        'INVALID_ARGUMENT: categoryId must be a non-empty string (max 128 chars)'
      );
    }
    result.categoryId = categoryId;
  }

  // Validate type
  if ('type' in obj) {
    const type = obj.type;
    if (!['income', 'expense', 'transfer'].includes(type as string)) {
      throw new Error(
        "INVALID_ARGUMENT: type must be 'income', 'expense', or 'transfer'"
      );
    }
    result.type = type as 'income' | 'expense' | 'transfer';
  }

  // Validate currency
  if ('currency' in obj) {
    const currency = obj.currency;
    if (!['UYU', 'USD'].includes(currency as string)) {
      throw new Error("INVALID_ARGUMENT: currency must be 'UYU' or 'USD'");
    }
    result.currency = currency as 'UYU' | 'USD';
  }

  // Validate description
  if ('description' in obj) {
    const description = obj.description;
    if (
      typeof description !== 'string' ||
      description.length === 0 ||
      description.length > 256
    ) {
      throw new Error(
        'INVALID_ARGUMENT: description must be a non-empty string (max 256 chars)'
      );
    }
    result.description = description;
  }

  // Validate minAmount
  if ('minAmount' in obj) {
    const minAmount = obj.minAmount;
    if (typeof minAmount !== 'number' || !Number.isFinite(minAmount) || minAmount < 0) {
      throw new Error(
        'INVALID_ARGUMENT: minAmount must be a valid non-negative number'
      );
    }
    result.minAmount = minAmount;
  }

  // Validate maxAmount
  if ('maxAmount' in obj) {
    const maxAmount = obj.maxAmount;
    if (typeof maxAmount !== 'number' || !Number.isFinite(maxAmount) || maxAmount < 0) {
      throw new Error(
        'INVALID_ARGUMENT: maxAmount must be a valid non-negative number'
      );
    }
    result.maxAmount = maxAmount;
  }

  // Validate that minAmount <= maxAmount
  if (
    result.minAmount !== undefined &&
    result.maxAmount !== undefined &&
    result.minAmount > result.maxAmount
  ) {
    throw new Error('INVALID_ARGUMENT: minAmount must be <= maxAmount');
  }

  // Validate status
  if ('status' in obj) {
    const status = obj.status;
    if (!['pending', 'classified', 'verified'].includes(status as string)) {
      throw new Error(
        "INVALID_ARGUMENT: status must be 'pending', 'classified', or 'verified'"
      );
    }
    result.status = status as 'pending' | 'classified' | 'verified';
  }

  // Validate limit
  if ('limit' in obj) {
    const limit = obj.limit;
    if (
      typeof limit !== 'number' ||
      !Number.isFinite(limit) ||
      limit < 1 ||
      limit > MAX_SEARCH_LIMIT
    ) {
      throw new Error(
        `INVALID_ARGUMENT: limit must be between 1 and ${MAX_SEARCH_LIMIT}`
      );
    }
    result.limit = limit;
  }

  // Validate offset
  if ('offset' in obj) {
    const offset = obj.offset;
    if (typeof offset !== 'number' || !Number.isFinite(offset) || offset < 0) {
      throw new Error(
        'INVALID_ARGUMENT: offset must be a valid non-negative number'
      );
    }
    result.offset = offset;
  }

  return result;
}

/**
 * Execute transaction search
 * 
 * SECURE: The uid comes from authenticated context, never from arguments
 */
export async function searchTransactions(
  context: AuthenticatedContext,
  input: unknown
): Promise<SearchTransactionsOutput> {
  try {
    // Validate input
    const validatedInput = validateSearchInput(input);

    // Execute search (uid comes from context, never from arguments)
    const result = await searchUserTransactions(context, {
      from: validatedInput.from,
      to: validatedInput.to,
      accountId: validatedInput.accountId,
      categoryId: validatedInput.categoryId,
      type: validatedInput.type,
      currency: validatedInput.currency,
      description: validatedInput.description,
      minAmount: validatedInput.minAmount,
      maxAmount: validatedInput.maxAmount,
      status: validatedInput.status,
      limit: validatedInput.limit,
      offset: validatedInput.offset,
    });

    // Sanitize result: return ONLY necessary information
    const sanitized: SearchTransactionsOutput = {
      transactions: result.transactions.map((tx) => ({
        id: tx.id,
        accountId: tx.accountId,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        currency: tx.currency,
        type: tx.type,
        category: tx.category,
        status: tx.status,
      })),
      pagination: {
        total: result.total,
        matched: result.matched,
        offset: result.offset,
        limit: result.limit,
        truncated: result.truncated,
      },
    };

    return sanitized;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Do not expose internal details
    if (message.includes('USER_NOT_AUTHORIZED')) {
      throw new Error('UNAUTHENTICATED: User not authorized for this operation');
    }

    throw error;
  }
}

export default {
  searchTransactions,
  validateSearchInput,
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
};
