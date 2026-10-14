/**
 * Componente DuplicateDetector
 * 
 * Detecta y gestiona transacciones duplicadas
 * Permite fusionar, revisar o ignorar duplicados
 */

import { useEffect, useState } from 'react';
import { Transaction } from '../../types';
import { detectDuplicates, mergeDuplicates, DuplicateAnalysis, DuplicateGroup } from '../../services/duplicateDetection.service';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface DuplicateDetectorProps {
  transactions: Transaction[];
  onMerge?: (primary: Transaction, duplicates: Transaction[]) => Promise<void>;
  onIgnore?: (groupId: string) => void;
}

export const DuplicateDetector = ({
  transactions,
  onMerge,
  onIgnore
}: DuplicateDetectorProps) => {
  const [analysis, setAnalysis] = useState<DuplicateAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    performAnalysis();
  }, [transactions]);

  const performAnalysis = () => {
    try {
      setLoading(true);
      setError(null);
      const result = detectDuplicates(transactions);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al analizar duplicados');
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async (group: DuplicateGroup) => {
    if (!onMerge) return;

    const primary = transactions.find(t => t.id === group.primaryId);
    if (!primary) return;

    try {
      setMerging(group.primaryId);
      await onMerge(primary, group.duplicates);
      
      // Actualizar análisis
      setTimeout(performAnalysis, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al fusionar');
    } finally {
      setMerging(null);
    }
  };

  const handleIgnore = (group: DuplicateGroup) => {
    if (onIgnore) {
      onIgnore(group.primaryId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (!analysis || analysis.duplicateGroups.length === 0) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">✅</span>
          <h3 className="font-semibold text-green-800 dark:text-green-300">
            Sin Duplicados Detectados
          </h3>
        </div>
        <p className="text-sm text-green-700 dark:text-green-400">
          Tus {analysis.totalTransactions} transacciones están limpias
        </p>
      </div>
    );
  }

  const duplicateRate = ((analysis.potentialDuplicates / analysis.totalTransactions) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">Error</h3>
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="text-2xl font-bold text-primary">
            {analysis.potentialDuplicates}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Transacciones Duplicadas
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="text-2xl font-bold text-amber-600">
            {duplicateRate}%
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Tasa de Duplicación
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="text-2xl font-bold text-green-600">
            {analysis.duplicateGroups.length}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Grupos de Duplicados
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="text-2xl font-bold text-blue-600">
            ${analysis.estimatedSavings.toFixed(2)}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Ahorros Potenciales
          </p>
        </div>
      </div>

      {/* Duplicate Groups */}
      <div className="space-y-3">
        <h3 className="font-semibold text-lg">Grupos de Duplicados</h3>
        
        {analysis.duplicateGroups.map(group => {
          const primary = transactions.find(t => t.id === group.primaryId);
          const isExpanded = expandedGroup === group.primaryId;
          const isMerging = merging === group.primaryId;

          if (!primary) return null;

          return (
            <div
              key={group.primaryId}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Group Header */}
              <div
                className="bg-gray-50 dark:bg-gray-800 p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                onClick={() => setExpandedGroup(isExpanded ? null : group.primaryId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {primary.description}
                        </span>
                        <span className="text-xs font-medium px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded">
                          {group.duplicates.length} duplicado{group.duplicates.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span>${Math.abs(primary.amount).toFixed(2)}</span>
                        <span>{new Date(primary.date).toLocaleDateString('es-UY')}</span>
                        <span className="text-xs">{group.reason}</span>
                      </div>
                    </div>
                  </div>

                  {/* Confidence Badge */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {(group.confidence * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Confianza
                      </div>
                    </div>

                    {/* Action Indicator */}
                    <div
                      className={`px-3 py-1 rounded text-xs font-medium ${
                        group.suggestedAction === 'merge'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                          : group.suggestedAction === 'review'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                          : 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {group.suggestedAction === 'merge' ? '✓ Fusionar' : 'Revisar'}
                    </div>

                    {/* Expand Icon */}
                    <span
                      className={`text-gray-400 transition transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    >
                      ▼
                    </span>
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                  <div className="space-y-3 mb-4">
                    <h4 className="font-semibold text-sm">Transacciones Duplicadas:</h4>
                    {group.duplicates.map((dup, idx) => (
                      <div
                        key={dup.id}
                        className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium">Duplicado {idx + 1}</span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {dup.id.substring(0, 8)}...
                          </span>
                        </div>
                        <div className="text-gray-700 dark:text-gray-300">
                          {dup.description}
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>${Math.abs(dup.amount).toFixed(2)}</span>
                          <span>{new Date(dup.date).toLocaleDateString('es-UY')}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleMerge(group)}
                      disabled={isMerging || !onMerge}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition disabled:cursor-not-allowed"
                    >
                      {isMerging ? 'Fusionando...' : '✓ Fusionar Duplicados'}
                    </button>
                    <button
                      onClick={() => handleIgnore(group)}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg font-medium transition"
                    >
                      Ignorar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DuplicateDetector;
