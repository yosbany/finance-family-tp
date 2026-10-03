/**
 * FASE 07C - Classification Suggestion Service
 * 
 * READ-ONLY pipeline para sugerir categorías a transacciones pendientes.
 * 
 * Pipeline:
 * 1. RULES - motor existente (categorizeTransaction)
 * 2. HISTORICAL_EXACT - merchant normalizado, todas las apariciones → misma categoría
 * 3. HISTORICAL_CONSENSUS - distribuir por categoría, mayoría prevalece
 * 4. AGENT - fallback cuando history no resuelve (no implementado aún)
 * 5. NONE - no hay sugerencia confiable
 * 
 * NO modifica Firebase. Solo lee y sugiere.
 */

import { AuthenticatedContext } from '../../auth/authenticatedContext.js';

/**
 * Tipos para sugerencias
 */

export type SuggestionSource = 
  | 'rules' 
  | 'historical_exact' 
  | 'historical_consensus' 
  | 'agent' 
  | 'none';

export interface ClassificationSuggestion {
  transactionId: string;
  suggestedCategoryId: string | null;
  source: SuggestionSource;
  confidence: number; // 0.0 - 1.0
  reason: string;
  metadata?: {
    matchedKeywords?: string[];
    merchantNormalized?: string;
    sampleSize?: number;
    consensusPercentage?: number;
    ruleConfidence?: number;
  };
}

/**
 * Normaliza texto de merchant para matching
 * 
 * Ejemplos:
 * - "REDIVA 19210SKIN FACTORY" → "SKIN FACTORY"
 * - "COMPRA FROG" → "FROG"
 */
export function normalizeMerchant(description: string): string {
  if (!description) return '';

  let normalized = description
    .toUpperCase()
    .trim();

  // Remover prefijos frecuentes
  const prefixes = ['REDIVA', 'COMPRA', 'PAGO', 'TRANSFERENCIA', 'TRF', 'TRA'];
  for (const prefix of prefixes) {
    const regex = new RegExp(`^${prefix}\\s+\\d*\\s*`, 'i');
    normalized = normalized.replace(regex, '').trim();
  }

  // Remover números al inicio (códigos de referencia)
  normalized = normalized.replace(/^\d+\s*/, '').trim();

  // Normalizar espacios
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Busca coincidencias exactas en historial
 * 
 * Si el mismo merchant normalizado aparece N veces y TODAS son la misma categoría → sugiere
 */
async function suggestFromHistoricalExact(
  transaction: any,
  historicalTransactions: any[]
): Promise<ClassificationSuggestion | null> {
  const merchantNorm = normalizeMerchant(transaction.description);
  
  if (!merchantNorm) {
    return null;
  }

  // Buscar coincidencias de merchant normalizado
  const matches = historicalTransactions.filter(tx => {
    const txMerchantNorm = normalizeMerchant(tx.description);
    return txMerchantNorm === merchantNorm;
  });

  if (matches.length === 0) {
    return null;
  }

  // Verificar que TODAS tienen la misma categoría
  const categories = new Set(matches.map(m => m.category).filter(c => c));
  
  if (categories.size === 1) {
    // Todas las apariciones históricas tienen la misma categoría
    const categoryId = [...categories][0];
    return {
      transactionId: transaction.id,
      suggestedCategoryId: categoryId,
      source: 'historical_exact',
      confidence: 1.0,
      reason: `Comercio coincide exactamente con ${matches.length} transacción(es) anterior(es), todas categorizadas como "${categoryId}".`,
      metadata: {
        merchantNormalized: merchantNorm,
        sampleSize: matches.length,
      }
    };
  }

  return null;
}

/**
 * Busca consenso en historial
 * 
 * Si el mismo merchant aparece varias veces con diferentes categorías pero una predomina → sugiere
 */
async function suggestFromHistoricalConsensus(
  transaction: any,
  historicalTransactions: any[]
): Promise<ClassificationSuggestion | null> {
  const merchantNorm = normalizeMerchant(transaction.description);
  
  if (!merchantNorm) {
    return null;
  }

  // Buscar coincidencias de merchant normalizado
  const matches = historicalTransactions.filter(tx => {
    const txMerchantNorm = normalizeMerchant(tx.description);
    return txMerchantNorm === merchantNorm;
  });

  if (matches.length < 2) {
    // Necesitamos al menos 2 apariciones para consenso
    return null;
  }

  // Contar por categoría
  const categoryCounts = new Map<string, number>();
  matches.forEach(m => {
    if (m.category) {
      categoryCounts.set(m.category, (categoryCounts.get(m.category) || 0) + 1);
    }
  });

  if (categoryCounts.size === 0) {
    return null;
  }

  // Encontrar categoría con más apariciones
  let maxCategory = '';
  let maxCount = 0;
  for (const [cat, count] of categoryCounts) {
    if (count > maxCount) {
      maxCategory = cat;
      maxCount = count;
    }
  }

  if (!maxCategory) {
    return null;
  }

  const consensus = maxCount / matches.length;
  
  // Solo sugerir si hay consenso razonable (> 50% pero siendo flexible)
  if (consensus > 0.5) {
    return {
      transactionId: transaction.id,
      suggestedCategoryId: maxCategory,
      source: 'historical_consensus',
      confidence: consensus,
      reason: `Comercio aparece en ${matches.length} transacción(es) anterior(es). ${maxCount} de ellas están categorizadas como "${maxCategory}" (${(consensus * 100).toFixed(0)}%).`,
      metadata: {
        merchantNormalized: merchantNorm,
        sampleSize: matches.length,
        consensusPercentage: Math.round(consensus * 100),
      }
    };
  }

  return null;
}

/**
 * Pipeline principal de sugerencias
 * 
 * Ejecuta secuencialmente:
 * 1. Exact match
 * 2. Consensus
 * 3. Si nada coincide, retorna 'none'
 * 
 * (RULES y AGENT se implementan en el llamador, fuera del servicio)
 */
async function suggestFromHistory(
  transaction: any,
  historicalTransactions: any[]
): Promise<ClassificationSuggestion | null> {
  // 1. EXACT
  const exactSuggestion = await suggestFromHistoricalExact(
    transaction,
    historicalTransactions
  );
  if (exactSuggestion) {
    return exactSuggestion;
  }

  // 2. CONSENSUS
  const consensusSuggestion = await suggestFromHistoricalConsensus(
    transaction,
    historicalTransactions
  );
  if (consensusSuggestion) {
    return consensusSuggestion;
  }

  return null;
}

/**
 * Genera sugerencia para una transacción pendiente
 * 
 * Pipeline completo:
 * 1. Historical exact
 * 2. Historical consensus
 * 3. None (agent se deja para futuro o llamador externo)
 * 
 * @param context Contexto autenticado
 * @param transactionId ID de transacción pendiente a sugerir
 * @param allTransactions Array de todas las transacciones (para historial)
 */
export async function generateSuggestion(
  context: AuthenticatedContext,
  transactionId: string,
  allTransactions: any[]
): Promise<ClassificationSuggestion> {
  // Encontrar la transacción pendiente
  const transaction = allTransactions.find(t => t.id === transactionId);
  
  if (!transaction) {
    return {
      transactionId,
      suggestedCategoryId: null,
      source: 'none',
      confidence: 0,
      reason: 'Transacción no encontrada.'
    };
  }

  // Separar transacciones categorizadas (para historial)
  const categorized = allTransactions.filter(
    t => t.category && t.status !== 'pending' && t.id !== transactionId
  );

  if (categorized.length === 0) {
    return {
      transactionId,
      suggestedCategoryId: null,
      source: 'none',
      confidence: 0,
      reason: 'Sin historial de transacciones categorizadas para comparar.'
    };
  }

  // Intentar obtener sugerencia del historial
  const historySuggestion = await suggestFromHistory(
    transaction,
    categorized
  );

  if (historySuggestion) {
    return historySuggestion;
  }

  // Sin sugerencia confiable
  return {
    transactionId,
    suggestedCategoryId: null,
    source: 'none',
    confidence: 0,
    reason: 'No se encontró patrón histórico consistente para esta transacción. Requiere revisión manual o clasificación con reglas.'
  };
}

/**
 * Procesa batch de transacciones pendientes y retorna sugerencias
 * 
 * @param context Contexto autenticado
 * @param pendingTransactions Transacciones pendientes a procesar
 * @param allTransactions Todas las transacciones (para historial)
 * @returns Array de sugerencias (una por pendiente)
 */
export async function suggestBatch(
  context: AuthenticatedContext,
  pendingTransactions: any[],
  allTransactions: any[]
): Promise<ClassificationSuggestion[]> {
  const suggestions: ClassificationSuggestion[] = [];

  for (const tx of pendingTransactions) {
    const suggestion = await generateSuggestion(context, tx.id, allTransactions);
    suggestions.push(suggestion);
  }

  return suggestions;
}

export default {
  normalizeMerchant,
  generateSuggestion,
  suggestBatch,
};
