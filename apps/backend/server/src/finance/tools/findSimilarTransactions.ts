/**
 * findSimilarTransactions Tool
 * 
 * FASE 07C3D - READ-ONLY tool for classification agent
 * 
 * Permite al agente de clasificación consultar el historial categorizado
 * para obtener contexto sobre cómo el usuario ha categorizado transacciones similares.
 * 
 * SECURITY:
 * - Receives AuthenticatedContext (uid from verified token)
 * - Does NOT accept uid, userId, familyId, or firebasePath
 * - Only searches categorized transactions (status !== 'pending')
 * - Returns READ-ONLY metadata, no sensitive fields
 * - Validates all arguments server-side
 * 
 * CONTRACT:
 * - Input: { query?: string, transactionId?: string, limit?: number }
 * - Output: Array of similar transactions with aggregated category distribution
 * 
 * SEARCH BEHAVIOR:
 * - By query: substring + merchant normalization matching
 * - By transactionId: extracts description/merchant from current tx, finds similar
 * - Returns up to 20 results per query
 * - Shows category distribution to inform classification decision
 * 
 * CONSTRAINTS:
 * - Only categorized transactions (excludes pending)
 * - Maximum 20 results
 * - No embeddings/vector search in this phase
 */

import { AuthenticatedContext } from '../../auth/authenticatedContext.js';
import { searchUserTransactions } from '../repositories/transactions.repository.js';
import { normalizeMerchant } from '../services/classificationSuggestion.service.js';

/**
 * Input validation for findSimilarTransactions
 * 
 * STRICTLY prohibits:
 * - uid, userId, familyId
 * - firebasePath, path
 * - any write parameters
 * 
 * Requires at least: query OR transactionId
 */
export interface FindSimilarTransactionsInput {
  query?: string;
  transactionId?: string;
  limit?: number;
}

/**
 * Individual transaction result (minimal, READ-ONLY)
 * 
 * Does NOT include:
 * - uid, familyRoot, Firebase paths
 * - accountId technical details
 * - sensitive metadata
 */
export interface SimilarTransactionResult {
  id: string;
  description: string;
  normalizedDescription?: string;
  category?: string;
  categoryName?: string;
  type: string;
  date: number;
  amount: number;
  currency: string;
  status: string;
}

/**
 * Aggregated category distribution for context
 * 
 * Shows how this type of transaction has historically been categorized
 */
export interface CategoryDistribution {
  categoryId: string;
  categoryName: string;
  count: number;
  percentage: number;
}

/**
 * Output: results + category distribution summary
 */
export interface FindSimilarTransactionsOutput {
  matchCount: number;
  results: SimilarTransactionResult[];
  categoryDistribution: CategoryDistribution[];
  totalMatches: number;
  note: string;
}

/**
 * Map category IDs to friendly names
 */
const CATEGORY_NAMES: Record<string, string> = {
  'cat_alimentacion': 'Alimentación',
  'cat_salud': 'Salud y Bienestar',
  'cat_educacion': 'Educación',
  'cat_entretenimiento': 'Entretenimiento',
  'cat_transporte': 'Transporte',
  'cat_servicios': 'Servicios y Utilidades',
  'cat_ropa': 'Ropa y Accesorios',
  'cat_vivienda': 'Vivienda',
  'cat_diversion': 'Diversión y Ocio',
  'cat_ingresos': 'Ingresos',
  'cat_reingreso_iva': 'Reingreso IVA',
  'cat_sueldos': 'Sueldos',
  'cat_transferencias': 'Transferencias',
  'cat_otros': 'Otros',
};

/**
 * Validates input for findSimilarTransactions
 * 
 * CRITICAL SECURITY: Rejects all prohibited parameters
 */
export function validateFindSimilarInput(input: unknown): FindSimilarTransactionsInput {
  if (typeof input !== 'object' || input === null) {
    throw new Error('INVALID_ARGUMENT: Input must be an object');
  }

  const obj = input as Record<string, unknown>;

  // Reject PROHIBITED parameters
  const prohibitedParams = [
    'uid',
    'userId',
    'familyId',
    'familyRoot',
    'firebasePath',
    'path',
  ];

  for (const param of prohibitedParams) {
    if (param in obj) {
      throw new Error(
        `SECURITY_VIOLATION: Parameter '${param}' is not allowed`
      );
    }
  }

  // Validate known parameters
  const allowed = new Set(['query', 'transactionId', 'limit']);
  for (const key in obj) {
    if (!allowed.has(key)) {
      throw new Error(`INVALID_ARGUMENT: Unknown parameter '${key}'`);
    }
  }

  // Validate query (optional string, max 256 chars)
  let query: string | undefined;
  if ('query' in obj) {
    const q = obj.query;
    if (typeof q !== 'string' || q.length === 0 || q.length > 256) {
      throw new Error(
        'INVALID_ARGUMENT: query must be a non-empty string (max 256 chars)'
      );
    }
    query = q.trim();
  }

  // Validate transactionId (optional string, max 128 chars)
  let transactionId: string | undefined;
  if ('transactionId' in obj) {
    const tid = obj.transactionId;
    if (typeof tid !== 'string' || tid.length === 0 || tid.length > 128) {
      throw new Error(
        'INVALID_ARGUMENT: transactionId must be a non-empty string (max 128 chars)'
      );
    }
    transactionId = tid;
  }

  // Require at least one: query or transactionId
  if (!query && !transactionId) {
    throw new Error(
      'INVALID_ARGUMENT: Must provide at least one of: query or transactionId'
    );
  }

  // Validate limit (optional, 1-20, default 10)
  let limit = 10;
  if ('limit' in obj) {
    const l = obj.limit;
    if (typeof l !== 'number' || !Number.isFinite(l) || l < 1 || l > 20) {
      throw new Error(
        'INVALID_ARGUMENT: limit must be a number between 1 and 20 (default 10)'
      );
    }
    limit = l;
  }

  return { query, transactionId, limit };
}

/**
 * Calculate text similarity between two strings
 * 
 * Uses simple token-based similarity:
 * - Normalize both strings
 * - Extract tokens (words)
 * - Count matching tokens
 * - Return score 0.0-1.0
 */
function calculateSimilarity(s1: string, s2: string): number {
  const normalize = (s: string): string =>
    s.toUpperCase().trim().replace(/[^\w\s]/g, '');

  const s1norm = normalize(s1);
  const s2norm = normalize(s2);

  // Exact match
  if (s1norm === s2norm) {
    return 1.0;
  }

  // Substring match
  if (s1norm.includes(s2norm) || s2norm.includes(s1norm)) {
    return 0.8;
  }

  // Token-based similarity
  const tokens1 = new Set(s1norm.split(/\s+/).filter(t => t.length > 0));
  const tokens2 = new Set(s2norm.split(/\s+/).filter(t => t.length > 0));

  const intersection = [...tokens1].filter(t => tokens2.has(t));
  const union = new Set([...tokens1, ...tokens2]);

  const similarity = intersection.length / union.size;
  return similarity;
}

/**
 * Find similar transactions by query string
 * 
 * Search strategy:
 * 1. Merchant normalization match (high priority)
 * 2. Substring match on description (case-insensitive)
 * 3. Token-based similarity (0.6 threshold)
 */
function findSimilarByQuery(
  query: string,
  allCategorized: any[],
  limit: number
): any[] {
  const queryNorm = normalizeMerchant(query);
  const queryLower = query.toLowerCase();

  // Score each transaction
  const scored = allCategorized.map(tx => {
    let score = 0;

    // 1. Merchant normalization match
    const txMerchantNorm = normalizeMerchant(tx.description);
    if (txMerchantNorm === queryNorm) {
      score = 1.0;
    } else if (txMerchantNorm.includes(queryNorm) || queryNorm.includes(txMerchantNorm)) {
      score = 0.9;
    } else {
      // 2. Substring match
      if (tx.description.toLowerCase().includes(queryLower)) {
        score = 0.7;
      } else {
        // 3. Token-based similarity
        score = calculateSimilarity(tx.description, query);
      }
    }

    return { tx, score };
  });

  // Filter by minimum similarity and sort
  const filtered = scored
    .filter(item => item.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return filtered.map(item => item.tx);
}

/**
 * Execute findSimilarTransactions
 * 
 * SECURE: uid comes from authenticated context, never from arguments
 */
export async function findSimilarTransactions(
  context: AuthenticatedContext,
  input: unknown
): Promise<FindSimilarTransactionsOutput> {
  try {
    // Validate input
    const validatedInput = validateFindSimilarInput(input);
    const { query, transactionId, limit } = validatedInput;

    // Fetch all categorized transactions (only categorized, exclude pending)
    const result = await searchUserTransactions(context, {
      status: 'classified',
      limit: 500,
      offset: 0,
    });

    let allCategorized = result.transactions;

    // If transactionId provided, get its description and search for similar
    let searchQuery = query;
    let currentTxDescription: string | null = null;

    if (transactionId) {
      // Fetch all transactions (not just categorized) to find the current one
      const allTxResult = await searchUserTransactions(context, {
        limit: 500,
        offset: 0,
      });

      const currentTx = allTxResult.transactions.find(t => t.id === transactionId);
      if (!currentTx) {
        return {
          matchCount: 0,
          results: [],
          categoryDistribution: [],
          totalMatches: 0,
          note: `Transaction ${transactionId} not found.`,
        };
      }

      currentTxDescription = currentTx.description;
      searchQuery = currentTx.description;
    }

    // If we have nothing to search, return empty
    if (!searchQuery) {
      return {
        matchCount: 0,
        results: [],
        categoryDistribution: [],
        totalMatches: 0,
        note: 'No search query provided.',
      };
    }

    // Find similar transactions
    const similar = findSimilarByQuery(searchQuery, allCategorized, limit || 20);

    // Build results
    const results: SimilarTransactionResult[] = similar.map(tx => ({
      id: tx.id,
      description: tx.description,
      normalizedDescription: normalizeMerchant(tx.description),
      category: tx.category,
      categoryName: tx.category ? CATEGORY_NAMES[tx.category] || tx.category : undefined,
      type: tx.type,
      date: tx.date,
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
    }));

    // Calculate category distribution
    const categoryCounts = new Map<string, number>();
    similar.forEach(tx => {
      if (tx.category) {
        categoryCounts.set(tx.category, (categoryCounts.get(tx.category) || 0) + 1);
      }
    });

    const categoryDistribution: CategoryDistribution[] = Array.from(categoryCounts.entries())
      .map(([catId, count]) => ({
        categoryId: catId,
        categoryName: CATEGORY_NAMES[catId] || catId,
        count,
        percentage: Math.round((count / similar.length) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // Build note about legacy data
    const noteBasics = transactionId
      ? `Found ${similar.length} categorized transaction(s) similar to this one.`
      : `Found ${similar.length} categorized transaction(s) matching "${searchQuery}".`;

    const note = similar.length > 0
      ? `${noteBasics} Note: Historical category assignments are evidence, not absolute ground truth. Review distribution carefully.`
      : `${noteBasics} No historical evidence available for this transaction.`;

    return {
      matchCount: similar.length,
      results,
      categoryDistribution,
      totalMatches: allCategorized.length,
      note,
    };
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
  findSimilarTransactions,
  validateFindSimilarInput,
};
