import { useState, useEffect } from 'react';
import { Transaction } from '../../types';
import {
  detectAllDuplicates,
  DuplicateGroup,
  deleteDuplicateGroup,
  generateDuplicateReport,
} from '../../services/duplicateDetection.service';
import { deleteTransactionsByIds } from '../../services/transactions.service';
import { useModal } from '../../hooks/useModal';

interface DuplicateDetectorProps {
  transactions: Transaction[];
  onDuplicatesDetected?: (count: number) => void;
}

export const DuplicateDetector = ({ transactions, onDuplicatesDetected }: DuplicateDetectorProps) => {
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const { showSuccess, showError, showConfirm, ModalComponent } = useModal();

  const handleDetectDuplicates = async () => {
    setDetecting(true);
    try {
      const found = detectAllDuplicates(transactions);
      setDuplicates(found);

      if (onDuplicatesDetected) {
        onDuplicatesDetected(found.length);
      }

      if (found.length === 0) {
        showSuccess('✅ No se encontraron transacciones duplicadas');
      } else {
        showSuccess(`⚠️ Se encontraron ${found.length} grupos de duplicados`);
      }
    } catch (error) {
      console.error('Error detectando duplicados:', error);
      showError('Error al detectar duplicados');
    } finally {
      setDetecting(false);
    }
  };

  const handleDeleteGroup = async (group: DuplicateGroup) => {
    const message = `¿Eliminar ${group.transactions.length - 1} transacción(es) duplicada(s)?\n\nSe mantiene: ${group.transactions[0]?.description}`;

    showConfirm(message, async () => {
      setDeleting(true);
      try {
        const idsToDelete = group.transactions.slice(1).map(tx => tx.id);
        await deleteTransactionsByIds(idsToDelete);

        const updated = duplicates.filter(d => d.id !== group.id);
        setDuplicates(updated);

        showSuccess(`✅ Eliminadas ${idsToDelete.length} transacciones`);
      } catch (error) {
        console.error('Error eliminando duplicados:', error);
        showError('Error al eliminar transacciones');
      } finally {
        setDeleting(false);
      }
    });
  };

  const handleDeleteAll = async () => {
    const totalToDelete = duplicates.reduce((sum, g) => sum + (g.transactions.length - 1), 0);

    showConfirm(
      `¿Eliminar ${totalToDelete} transacciones duplicadas?\n\nEsto mantendrá la primera de cada grupo.`,
      async () => {
        setDeleting(true);
        try {
          for (const group of duplicates) {
            const idsToDelete = group.transactions.slice(1).map(tx => tx.id);
            await deleteTransactionsByIds(idsToDelete);
          }

          setDuplicates([]);
          showSuccess(`✅ Eliminadas ${totalToDelete} transacciones duplicadas`);
        } catch (error) {
          console.error('Error eliminando todos los duplicados:', error);
          showError('Error al eliminar transacciones');
        } finally {
          setDeleting(false);
        }
      }
    );
  };

  if (duplicates.length === 0 && !showReport) {
    return (
      <>
        <button
          onClick={handleDetectDuplicates}
          disabled={detecting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {detecting ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Detectando...
            </>
          ) : (
            <>
              🔍 Detectar Duplicados
            </>
          )}
        </button>
        <ModalComponent />
      </>
    );
  }

  const totalTransactions = duplicates.reduce((sum, g) => sum + g.transactions.length, 0);
  const potentialDeletions = duplicates.reduce((sum, g) => sum + (g.transactions.length - 1), 0);

  return (
    <>
      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100">
              ⚠️ {duplicates.length} Grupos de Duplicados Encontrados
            </h3>
            <p className="text-sm text-orange-800 dark:text-orange-200 mt-2">
              {totalTransactions} transacciones en total, {potentialDeletions} marcadas para eliminación
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowReport(!showReport)}
              className="px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
            >
              📊 Reporte
            </button>
            {potentialDeletions > 0 && (
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : '🗑️ Eliminar Todo'}
              </button>
            )}
            <button
              onClick={handleDetectDuplicates}
              disabled={detecting}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50"
            >
              🔄 Re-detectar
            </button>
          </div>
        </div>

        {showReport && (
          <pre className="mt-4 text-xs bg-white dark:bg-gray-800 p-3 rounded overflow-auto max-h-64">
            {generateDuplicateReport(duplicates)}
          </pre>
        )}
      </div>

      <div className="space-y-3">
        {duplicates.map((group) => (
          <div
            key={group.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 cursor-pointer" onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {group.type === 'exact' && '🔴'}
                    {group.type === 'fuzzy' && '🟡'}
                    {group.type === 'pattern' && '🔵'}
                  </span>
                  <div>
                    <p className="font-medium text-sm">{group.description}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {group.transactions.length} transacciones • Confianza: {(group.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDeleteGroup(group)}
                disabled={deleting}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
              >
                🗑️ Eliminar
              </button>
            </div>

            {expandedGroup === group.id && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                {group.transactions.map((tx, idx) => (
                  <div
                    key={tx.id}
                    className={`text-sm p-2 rounded ${
                      idx === 0
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex justify-between">
                      <span className="font-mono text-xs">
                        {idx === 0 ? '✅ MANTENER' : '❌ ELIMINAR'}
                      </span>
                      <span className="font-mono text-xs">
                        {new Date(tx.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-1">{tx.description}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {tx.amount} {tx.currency || 'UYU'} • {tx.status}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <ModalComponent />
    </>
  );
};
