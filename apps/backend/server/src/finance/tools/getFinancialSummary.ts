/**
 * getFinancialSummary Tool
 * 
 * Deterministic financial aggregation tool.
 * 
 * Returns calculated income, expenses, net and savings metrics WITHOUT
 * returning individual transactions.
 * 
 * SECURITY:
 * - Receives AuthenticatedContext (uid from verified token)
 * - Does NOT accept uid, userId, familyId, or firebasePath
 * - Validates all arguments server-side
 * - Returns ONLY aggregated data
 * - Applies maximum limits
 * 
 * CONTRACT:
 * - Input: AuthenticatedContext + period filters
 * - Output: Deterministic aggregated summary
 * 
 * FINANCIAL RULES:
 * - income: sum of type='income' transactions
 * - expenses: sum of type='expense' transactions (absolute value)
 * - transfers: NOT counted as income/expense (separate tracking)
 * - net: income - expenses
 * - savingsRate: ((income - expenses) / income) * 100, only if income > 0
 * - Multi-currency: results separated by currency, NO conversion
 */

import { AuthenticatedContext } from '../../auth/authenticatedContext.js';
import { searchUserTransactions } from '../repositories/transactions.repository.js';

/**
 * Input for getFinancialSummary
 * 
 * CRITICAL: Does NOT include uid, userId, familyId, firebasePath, etc.
 */
export interface GetFinancialSummaryInput {
  // Period (timestamps in ms)
  from: number;
  to: number;

  // Optional filters
  currency?: 'UYU' | 'USD';
  accountId?: string;
  categoryId?: string;
}

/**
 * Financial summary for a single currency
 */
export interface CurrencySummary {
  currency: 'UYU' | 'USD';
  income: number;
  expenses: number;
  net: number;
  transfers: number;
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
  transferCount: number;
  savingsRate?: number;
}

/**
 * Output of getFinancialSummary
 * 
 * Contains ONLY:
 * - Aggregated financial metrics
 * - Period information
 * - Counts (no individual transactions)
 * - NO uid, paths, tokens, credentials
 */
export interface GetFinancialSummaryOutput {
  period: {
    from: number;
    to: number;
  };
  // If single currency specified, direct summary
  summary?: CurrencySummary;
  // If multiple currencies, array of summaries
  byCurrency?: CurrencySummary[];
}

/**
 * Validates getFinancialSummary input
 * 
 * Rejects:
 * - uid, userId, familyId (prohibited parameters)
 * - firebasePath, path (prohibited parameters)
 * - unknown arguments
 * - out-of-range values
 * - missing required fields
 */
export function validateFinancialSummaryInput(
  input: unknown
): GetFinancialSummaryInput {
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
  const allowed = new Set(['from', 'to', 'currency', 'accountId', 'categoryId']);

  for (const key in obj) {
    if (!allowed.has(key)) {
      throw new Error(`INVALID_ARGUMENT: Unknown parameter '${key}'`);
    }
  }

  // Validate required: from
  if (!('from' in obj)) {
    throw new Error('INVALID_ARGUMENT: from is required');
  }

  const from = obj.from;
  if (typeof from !== 'number' || !Number.isFinite(from) || from < 0) {
    throw new Error(
      'INVALID_ARGUMENT: from must be a valid positive number (timestamp in milliseconds)'
    );
  }

  // Validate required: to
  if (!('to' in obj)) {
    throw new Error('INVALID_ARGUMENT: to is required');
  }

  const to = obj.to;
  if (typeof to !== 'number' || !Number.isFinite(to) || to < 0) {
    throw new Error(
      'INVALID_ARGUMENT: to must be a valid positive number (timestamp in milliseconds)'
    );
  }

  // Validate that from <= to
  if (from > to) {
    throw new Error('INVALID_ARGUMENT: from must be <= to');
  }

  const result: GetFinancialSummaryInput = { from, to };

  // Validate optional currency
  if ('currency' in obj) {
    const currency = obj.currency;
    if (currency !== undefined) {
      if (!['UYU', 'USD'].includes(currency as string)) {
        throw new Error("INVALID_ARGUMENT: currency must be 'UYU' or 'USD'");
      }
      result.currency = currency as 'UYU' | 'USD';
    }
  }

  // Validate optional accountId
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

  // Validate optional categoryId
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

  return result;
}

/**
 * Calculate a financial summary for a set of transactions
 * 
 * Separates by currency. Transfers are tracked separately and do NOT
 * affect income/expense/net calculations.
 */
function calculateSummaryByCurrency(
  transactions: Array<{
    type: string;
    currency: string;
    amount: number;
  }>,
  currency?: string
): Map<string, CurrencySummary> {
  const summaries = new Map<string, CurrencySummary>();

  for (const tx of transactions) {
    // Skip if currency filter specified and doesn't match
    if (currency && tx.currency !== currency) {
      continue;
    }

    const curr = tx.currency;
    if (!summaries.has(curr)) {
      summaries.set(curr, {
        currency: curr as 'UYU' | 'USD',
        income: 0,
        expenses: 0,
        net: 0,
        transfers: 0,
        transactionCount: 0,
        incomeCount: 0,
        expenseCount: 0,
        transferCount: 0,
      });
    }

    const summary = summaries.get(curr)!;

    // Categorize transaction
    if (tx.type === 'income') {
      summary.income += tx.amount;
      summary.incomeCount += 1;
    } else if (tx.type === 'expense') {
      // Expenses are stored as negative, but we sum absolute value
      summary.expenses += Math.abs(tx.amount);
      summary.expenseCount += 1;
    } else if (tx.type === 'transfer') {
      // Transfers track absolute amount but don't affect net
      summary.transfers += Math.abs(tx.amount);
      summary.transferCount += 1;
    }

    summary.transactionCount += 1;
  }

  // Calculate derived metrics
  for (const summary of summaries.values()) {
    summary.net = summary.income - summary.expenses;

    // Calculate savings rate only if income > 0
    if (summary.income > 0) {
      summary.savingsRate =
        ((summary.income - summary.expenses) / summary.income) * 100;
    }
  }

  return summaries;
}

/**
 * Execute financial summary calculation
 * 
 * SECURE: The uid comes from authenticated context, never from arguments
 */
export async function getFinancialSummary(
  context: AuthenticatedContext,
  input: unknown
): Promise<GetFinancialSummaryOutput> {
  try {
    // Validate input
    const validatedInput = validateFinancialSummaryInput(input);

    // Execute search to get all transactions in the period
    // We fetch without pagination limit to aggregate all data
    const result = await searchUserTransactions(context, {
      from: validatedInput.from,
      to: validatedInput.to,
      accountId: validatedInput.accountId,
      categoryId: validatedInput.categoryId,
      // Set limit to max to get all matching transactions
      limit: 500,
      offset: 0,
    });

    // Handle pagination: if truncated, we have incomplete data
    if (result.truncated) {
      throw new Error(
        'INCOMPLETE_DATA: Period contains more than 500 transactions; cannot calculate accurate summary. Use searchTransactions with filters to reduce data volume.'
      );
    }

    // Calculate summaries by currency
    const summaries = calculateSummaryByCurrency(
      result.transactions,
      validatedInput.currency
    );

    // Build output
    const output: GetFinancialSummaryOutput = {
      period: {
        from: validatedInput.from,
        to: validatedInput.to,
      },
    };

    if (validatedInput.currency) {
      // Single currency requested
      const summary = summaries.get(validatedInput.currency);
      if (summary) {
        output.summary = summary;
      } else {
        // No transactions in that currency, return zero summary
        output.summary = {
          currency: validatedInput.currency,
          income: 0,
          expenses: 0,
          net: 0,
          transfers: 0,
          transactionCount: 0,
          incomeCount: 0,
          expenseCount: 0,
          transferCount: 0,
        };
      }
    } else {
      // No currency specified: if multiple currencies, return array
      const summaryArray = Array.from(summaries.values());
      if (summaryArray.length === 1) {
        // Only one currency, return as summary
        output.summary = summaryArray[0];
      } else if (summaryArray.length > 1) {
        // Multiple currencies, return as array
        output.byCurrency = summaryArray;
      } else {
        // No transactions at all, return empty default
        output.summary = {
          currency: 'UYU', // Default
          income: 0,
          expenses: 0,
          net: 0,
          transfers: 0,
          transactionCount: 0,
          incomeCount: 0,
          expenseCount: 0,
          transferCount: 0,
        };
      }
    }

    return output;
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
  getFinancialSummary,
  validateFinancialSummaryInput,
};
