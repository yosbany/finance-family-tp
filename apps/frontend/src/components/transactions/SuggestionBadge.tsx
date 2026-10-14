/**
 * FASE 07C - Suggestion Badge Component
 * 
 * Muestra la sugerencia de categoría para una transacción pendiente.
 * Pequeño badge inline que se integra en la fila de la tabla.
 */

import { useEffect, useState } from 'react';
import { getSuggestionForTransaction, ClassificationSuggestion } from '../../services/classificationSuggestion.service';

interface SuggestionBadgeProps {
  transactionId: string;
  categoryColor?: string;
}

export const SuggestionBadge = ({ transactionId, categoryColor = '#6B7280' }: SuggestionBadgeProps) => {
  const [suggestion, setSuggestion] = useState<ClassificationSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuggestion = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getSuggestionForTransaction(transactionId);
        setSuggestion(result);
      } catch (err) {
        setError('Error loading suggestion');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestion();
  }, [transactionId]);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Analizando...</span>
      </div>
    );
  }

  if (error || !suggestion || !suggestion.suggestedCategoryId) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
        <span>Sin sugerencia</span>
      </div>
    );
  }

  const confidencePercent = Math.round(suggestion.confidence * 100);
  const confidenceBgColor = confidencePercent >= 90 ? '#10b981' : confidencePercent >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex items-center gap-2">
      <div
        className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white"
        style={{
          backgroundColor: categoryColor || '#6B7280',
        }}
        title={suggestion.reasoningSummary}
      >
        {suggestion.suggestedCategoryId}
      </div>
      <div
        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white"
        style={{
          backgroundColor: confidenceBgColor,
        }}
        title={`Confianza: ${suggestion.reasoningSummary}`}
      >
        {confidencePercent}%
      </div>
    </div>
  );
};

export default SuggestionBadge;
