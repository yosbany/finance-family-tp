/**
 * suggestTransactionCategory Tool
 * 
 * FASE 07C - READ-ONLY tool for suggesting categories to pending transactions.
 * 
 * SECURITY:
 * - Receives AuthenticatedContext (uid from verified token)
 * - Does NOT accept uid, userId, familyId, or firebasePath
 * - Does NOT accept categoryOverride or any write parameters
 * - Does NOT write to Firebase
 * - Validates all arguments server-side
 * - Returns ONLY suggestion, no sensitive data
 * 
 * CONTRACT:
 * - Input: { transactionId }
 * - Output: { transactionId, suggestion: { categoryId, confidence, reasoningSummary } }
 * 
 * OUTPUT DOES NOT INCLUDE:
 * - Internal reasoning details (chain-of-thought)
 * - Full metadata (kept for internal analytics)
 * - Any paths or internal structure
 */

import { AuthenticatedContext } from '../../auth/authenticatedContext.js';
import { searchUserTransactions } from '../repositories/transactions.repository.js';
import { generateSuggestion } from '../services/classificationSuggestion.service.js';

/**
 * Input validation for suggestTransactionCategory
 * 
 * STRICTLY prohibits:
 * - uid, userId, familyId
 * - firebasePath, path
 * - categoryOverride
 * - writeMode, autoApply, forceWrite
 * - any other injected parameters
 */
export interface SuggestTransactionCategoryInput {
  transactionId: string;
}

/**
 * Output: cleaned suggestion suitable for client
 * 
 * Does NOT include:
 * - metadata.sampleSize, metadata.consensusPercentage
 * - internal reasoning details
 * - categoryName (client already has categories)
 */
export interface SuggestTransactionCategoryOutput {
  transactionId: string;
  suggestion: {
    categoryId: string | null;
    confidence: number;
    reasoningSummary: string;
  };
}

/**
 * Validates input for suggestTransactionCategory
 * 
 * CRITICAL SECURITY: Rejects all prohibited parameters
 */
export function validateSuggestInput(input: unknown): SuggestTransactionCategoryInput {
  if (typeof input !== 'object' || input === null) {
    throw new Error('INVALID_ARGUMENT: Input must be an object');
  }

  const obj = input as Record<string, unknown>;

  // Reject PROHIBITED parameters
  const prohibitedParams = [
    'uid',
    'userId',
    'familyId',
    'firebasePath',
    'path',
    'categoryOverride',
    'writeMode',
    'autoApply',
    'forceWrite',
  ];

  for (const param of prohibitedParams) {
    if (param in obj) {
      throw new Error(
        `SECURITY_VIOLATION: Parameter '${param}' is not allowed`
      );
    }
  }

  // Validate allowed parameters
  const allowed = new Set(['transactionId']);
  for (const key in obj) {
    if (!allowed.has(key)) {
      throw new Error(`INVALID_ARGUMENT: Unknown parameter '${key}'`);
    }
  }

  // Validate required: transactionId
  if (!('transactionId' in obj)) {
    throw new Error('INVALID_ARGUMENT: transactionId is required');
  }

  const transactionId = obj.transactionId;
  if (typeof transactionId !== 'string' || transactionId.length === 0 || transactionId.length > 128) {
    throw new Error(
      'INVALID_ARGUMENT: transactionId must be a non-empty string (max 128 chars)'
    );
  }

  return { transactionId };
}

/**
 * Execute suggestion generation
 * 
 * SECURE: uid comes from authenticated context, never from arguments
 */
export async function suggestTransactionCategory(
  context: AuthenticatedContext,
  input: unknown
): Promise<SuggestTransactionCategoryOutput> {
  try {
    // Validate input
    const validatedInput = validateSuggestInput(input);

    // Fetch all transactions for this user (needed for historical context)
    // Using searchUserTransactions with limit=500 to get all categorized transactions
    const result = await searchUserTransactions(context, {
      limit: 500,
      offset: 0,
    });

    if (result.truncated) {
      throw new Error(
        'INCOMPLETE_DATA: User has too many transactions. Cannot generate reliable suggestions with incomplete data.'
      );
    }

    // Build full transaction list
    const allTransactions = result.transactions;

    // Find the specific transaction
    const transaction = allTransactions.find(t => t.id === validatedInput.transactionId);

    if (!transaction) {
      return {
        transactionId: validatedInput.transactionId,
        suggestion: {
          categoryId: null,
          confidence: 0,
          reasoningSummary: 'Transaction not found.',
        },
      };
    }

    // Generate suggestion using the classification service
    const suggestion = await generateSuggestion(
      context,
      validatedInput.transactionId,
      allTransactions as any[]
    );

    // Sanitize output: remove internal metadata, keep only essential info
    const output: SuggestTransactionCategoryOutput = {
      transactionId: suggestion.transactionId,
      suggestion: {
        categoryId: suggestion.suggestedCategoryId,
        confidence: Math.round(suggestion.confidence * 100) / 100,
        reasoningSummary: suggestion.reason,
      },
    };

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
  suggestTransactionCategory,
  validateSuggestInput,
};
