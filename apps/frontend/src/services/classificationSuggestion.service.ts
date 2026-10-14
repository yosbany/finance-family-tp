/**
 * FASE 07C - Classification Suggestion Service (Frontend)
 * 
 * Llama a la tool backend suggestTransactionCategory para obtener sugerencias.
 * Mantiene metadata local de aceptación de sugerencias.
 */

import { agentApi } from './agentApi.service';

/**
 * Tipo para sugerencia de clasificación
 */
export interface ClassificationSuggestion {
  transactionId: string;
  suggestedCategoryId: string | null;
  confidence: number; // 0-1
  reasoningSummary: string;
}

/**
 * Metadata de seguimiento de sugerencias
 */
export interface SuggestionMetadata {
  transactionId: string;
  suggestionSource: string;
  suggestedCategoryId: string | null;
  accepted: boolean;
  actualCategoryId?: string;
  timestamp: number;
}

/**
 * Obtiene una sugerencia para una transacción pendiente
 * 
 * @param transactionId ID de la transacción pendiente
 * @returns Sugerencia o null si hay error
 */
export async function getSuggestionForTransaction(
  transactionId: string
): Promise<ClassificationSuggestion | null> {
  try {
    const result = await agentApi.callTool('suggestTransactionCategory', {
      transactionId,
    });

    if (!result || result.error) {
      console.error(`Error getting suggestion: ${result?.error}`);
      return null;
    }

    // Parsear resultado de la tool
    if (result.result && typeof result.result === 'object') {
      const toolOutput = result.result as any;
      
      if (toolOutput.suggestion) {
        return {
          transactionId,
          suggestedCategoryId: toolOutput.suggestion.categoryId || null,
          confidence: toolOutput.suggestion.confidence || 0,
          reasoningSummary: toolOutput.suggestion.reasoningSummary || '',
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error in getSuggestionForTransaction:', error);
    return null;
  }
}

/**
 * Obtiene sugerencias para múltiples transacciones pendientes
 * 
 * @param transactionIds Array de IDs pendientes
 * @returns Array de sugerencias (puede contener nulls si hay errores)
 */
export async function getSuggestionsForTransactions(
  transactionIds: string[]
): Promise<(ClassificationSuggestion | null)[]> {
  const suggestions = await Promise.all(
    transactionIds.map(txId => getSuggestionForTransaction(txId))
  );
  return suggestions;
}

/**
 * Registra metadata de aceptación/rechazo de sugerencia
 * (para futuras métricas de aceptación)
 */
export function recordSuggestionOutcome(
  metadata: SuggestionMetadata
): void {
  // TODO: Persistir en Firebase o local storage para análisis posterior
  console.log('Suggestion outcome recorded:', metadata);
}

export default {
  getSuggestionForTransaction,
  getSuggestionsForTransactions,
  recordSuggestionOutcome,
};
