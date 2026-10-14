import { useEffect, useState } from 'react';
import { getTransactions, deleteTransaction } from '../../services/transactions.service';
import { Transaction } from '../../types';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { DuplicateDetector } from './DuplicateDetector';

export const DuplicatesPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setTransactions(await getTransactions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los movimientos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleMerge = async (primary: Transaction, duplicates: Transaction[]) => {
    await Promise.all(duplicates.map(tx => deleteTransaction(tx.id)));
    setTransactions(prev => prev.filter(tx => !duplicates.some(d => d.id === tx.id) || tx.id === primary.id));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-1">Duplicados</h2>
      <p className="text-gray-400 mb-6">
        Movimientos parecidos de la misma cuenta, detectados por monto, fecha y descripción.
      </p>
      {error && (
        <p className="mb-4 text-sm text-red-400">{error}</p>
      )}
      <DuplicateDetector transactions={transactions} onMerge={handleMerge} />
    </div>
  );
};
