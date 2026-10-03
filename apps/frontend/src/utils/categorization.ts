/**
 * FASE 07C2 - Frontend Categorization Adapter
 * 
 * Re-exports the shared categorization engine.
 * This maintains backward compatibility with existing frontend imports
 * while ensuring both frontend and backend use the EXACT SAME implementation.
 * 
 * All logic is in: apps/shared/categorization/engine.ts
 */

// Re-export everything from shared engine
export {
  normalizeText,
  tokenize,
  generateNGrams,
  calculateLevenshteinSimilarity,
  matchKeyword,
  categorizeTransaction,
  explainDescriptionMatch,
  learnFromManualClassification,
  categorizeTransactions,
  calculateCategorizationRate,
  getPendingTransactions,
  suggestCategory,
} from '../../../shared/categorization/engine';

export type { KeywordMatchInfo, CategorizationResult } from '../../../shared/categorization/engine';
