import { ref, push, set, get, update, remove } from 'firebase/database';
import { database } from './firebase';
import { familyPath } from './familyPaths';
import { Transaction, ParsedTransaction } from '../types';

const cleanUndefined = (obj: Record<string, unknown>): Record<string, unknown> => {
  const cleaned: Record<string, unknown> = {};
  for (const key in obj) {
    const value = obj[key];
    if (value === undefined) continue;
    if (typeof value === 'number' && !Number.isFinite(value)) continue;
    cleaned[key] = value;
  }
  return cleaned;
};

export const createTransaction = async (
  transaction: Omit<Transaction, 'id'>
): Promise<string> => {
  try {
    if (!Number.isFinite(transaction.amount)) {
      throw new Error(`Monto inválido en transacción: ${transaction.description}`);
    }

    const transactionsRef = ref(database, familyPath('transactions'));
    const newTransactionRef = push(transactionsRef);
    const transactionId = newTransactionRef.key!;

    const transactionData: Transaction = {
      ...transaction,
      id: transactionId,
      amount: Number(transaction.amount),
      createdAt: Date.now()
    };

    const cleanedData = cleanUndefined(transactionData as unknown as Record<string, unknown>);
    await set(newTransactionRef, cleanedData);
    return transactionId;
  } catch (error) {
    console.error('Error al crear transacción:', error);
    throw error;
  }
};

export const createTransactions = async (
  transactions: Omit<Transaction, 'id' | 'createdAt'>[]
): Promise<string[]> => {
  try {
    const ids: string[] = [];
    const validTransactions = transactions.filter(tx => Number.isFinite(tx.amount));

    if (validTransactions.length === 0) {
      throw new Error('No hay transacciones con montos válidos para guardar');
    }

    for (const transaction of validTransactions) {
      const id = await createTransaction({
        ...transaction,
        createdAt: Date.now()
      });
      ids.push(id);
    }

    return ids;
  } catch (error) {
    console.error('Error al crear transacciones:', error);
    throw error;
  }
};

export const getTransactions = async (): Promise<Transaction[]> => {
  try {
    const transactionsRef = ref(database, familyPath('transactions'));
    const snapshot = await get(transactionsRef);

    if (!snapshot.exists()) {
      return [];
    }

    const transactionsData = snapshot.val();
    const transactions = Object.values(transactionsData) as Transaction[];

    return transactions.sort((a, b) => b.date - a.date);
  } catch (error) {
    console.error('Error al obtener transacciones:', error);
    throw error;
  }
};

export const getTransactionById = async (transactionId: string): Promise<Transaction | null> => {
  try {
    const transactionRef = ref(database, familyPath('transactions', transactionId));
    const snapshot = await get(transactionRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.val() as Transaction;
  } catch (error) {
    console.error('Error al obtener transacción:', error);
    throw error;
  }
};

export const getTransactionsByAccount = async (accountId: string): Promise<Transaction[]> => {
  try {
    const transactionsRef = ref(database, familyPath('transactions'));
    const snapshot = await get(transactionsRef);

    if (!snapshot.exists()) {
      return [];
    }

    const transactionsData = snapshot.val();
    const transactions = Object.values(transactionsData) as Transaction[];

    return transactions
      .filter(t => t.accountId === accountId)
      .sort((a, b) => b.date - a.date);
  } catch (error) {
    console.error('Error al obtener transacciones por cuenta:', error);
    throw error;
  }
};

export const getTransactionsByStatus = async (
  status: 'pending' | 'classified' | 'verified'
): Promise<Transaction[]> => {
  try {
    const transactionsRef = ref(database, familyPath('transactions'));
    const snapshot = await get(transactionsRef);

    if (!snapshot.exists()) {
      return [];
    }

    const transactionsData = snapshot.val();
    const transactions = Object.values(transactionsData) as Transaction[];

    return transactions
      .filter(t => t.status === status)
      .sort((a, b) => b.date - a.date);
  } catch (error) {
    console.error('Error al obtener transacciones por estado:', error);
    throw error;
  }
};

export const updateTransaction = async (
  transactionId: string,
  updates: Partial<Transaction>
): Promise<void> => {
  try {
    const transactionRef = ref(database, familyPath('transactions', transactionId));
    await update(transactionRef, updates);
  } catch (error) {
    console.error('Error al actualizar transacción:', error);
    throw error;
  }
};

export const deleteTransaction = async (transactionId: string): Promise<void> => {
  try {
    const transactionRef = ref(database, familyPath('transactions', transactionId));
    await remove(transactionRef);
  } catch (error) {
    console.error('Error al eliminar transacción:', error);
    throw error;
  }
};

export const deleteTransactionsByFilter = async (filter: {
  accountId?: string;
  month?: number;
  year?: number;
}): Promise<number> => {
  const transactions = await getTransactions();
  const toDelete = transactions.filter(tx => {
    if (filter.accountId && tx.accountId !== filter.accountId) return false;
    if (filter.month !== undefined || filter.year !== undefined) {
      const date = new Date(tx.date);
      if (filter.month !== undefined && date.getMonth() + 1 !== filter.month) return false;
      if (filter.year !== undefined && date.getFullYear() !== filter.year) return false;
    }
    return true;
  });

  for (const tx of toDelete) {
    await deleteTransaction(tx.id);
  }

  return toDelete.length;
};

export const deleteTransactionsByIds = async (ids: string[]): Promise<number> => {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  for (const id of uniqueIds) {
    await deleteTransaction(id);
  }
  return uniqueIds.length;
};

export const deleteAllTransactions = async (): Promise<number> => {
  const transactionsRef = ref(database, familyPath('transactions'));
  const snapshot = await get(transactionsRef);
  if (!snapshot.exists()) return 0;

  const count = Object.keys(snapshot.val()).length;
  await remove(transactionsRef);
  return count;
};

export const classifyTransaction = async (
  transactionId: string,
  categoryId: string
): Promise<void> => {
  try {
    await updateTransaction(transactionId, {
      category: categoryId,
      status: 'classified'
    });
  } catch (error) {
    console.error('Error al clasificar transacción:', error);
    throw error;
  }
};

export const verifyTransaction = async (transactionId: string): Promise<void> => {
  try {
    await updateTransaction(transactionId, {
      status: 'verified'
    });
  } catch (error) {
    console.error('Error al verificar transacción:', error);
    throw error;
  }
};

export const parsedToTransaction = (
  parsed: ParsedTransaction,
  accountId: string,
  uploadId?: string
): Omit<Transaction, 'id' | 'createdAt'> => {
  return {
    accountId,
    date: parsed.date.getTime(),
    description: parsed.description,
    amount: parsed.amount,
    currency: parsed.currency,
    type: parsed.type,
    isRecurring: false,
    notes: '',
    status: 'pending',
    uploadId
  };
};
