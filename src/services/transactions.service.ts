import { ref, push, set, get, update, remove, query, orderByChild, equalTo } from 'firebase/database';
import { database } from './firebase';
import { Transaction, ParsedTransaction } from '../types';

// Función auxiliar para limpiar valores undefined
const cleanUndefined = (obj: any): any => {
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
};

export const createTransaction = async (
  userId: string,
  transaction: Omit<Transaction, 'id'>
): Promise<string> => {
  try {
    const transactionsRef = ref(database, `transactions/${userId}`);
    const newTransactionRef = push(transactionsRef);
    const transactionId = newTransactionRef.key!;
    
    const transactionData: Transaction = {
      ...transaction,
      id: transactionId,
      createdAt: Date.now()
    };
    
    // Limpiar valores undefined antes de guardar en Firebase
    const cleanedData = cleanUndefined(transactionData);
    
    await set(newTransactionRef, cleanedData);
    return transactionId;
  } catch (error) {
    console.error('Error al crear transacción:', error);
    throw error;
  }
};

export const createTransactions = async (
  userId: string,
  transactions: Omit<Transaction, 'id' | 'createdAt'>[]
): Promise<string[]> => {
  try {
    const ids: string[] = [];
    
    for (const transaction of transactions) {
      const id = await createTransaction(userId, {
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

export const getTransactions = async (userId: string): Promise<Transaction[]> => {
  try {
    const transactionsRef = ref(database, `transactions/${userId}`);
    const snapshot = await get(transactionsRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    const transactionsData = snapshot.val();
    const transactions = Object.values(transactionsData) as Transaction[];
    
    // Ordenar por fecha (más reciente primero)
    return transactions.sort((a, b) => b.date - a.date);
  } catch (error) {
    console.error('Error al obtener transacciones:', error);
    throw error;
  }
};

export const getTransactionById = async (
  userId: string,
  transactionId: string
): Promise<Transaction | null> => {
  try {
    const transactionRef = ref(database, `transactions/${userId}/${transactionId}`);
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

export const getTransactionsByAccount = async (
  userId: string,
  accountId: string
): Promise<Transaction[]> => {
  try {
    const transactionsRef = ref(database, `transactions/${userId}`);
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
  userId: string,
  status: 'pending' | 'classified' | 'verified'
): Promise<Transaction[]> => {
  try {
    const transactionsRef = ref(database, `transactions/${userId}`);
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
  userId: string,
  transactionId: string,
  updates: Partial<Transaction>
): Promise<void> => {
  try {
    const transactionRef = ref(database, `transactions/${userId}/${transactionId}`);
    await update(transactionRef, updates);
  } catch (error) {
    console.error('Error al actualizar transacción:', error);
    throw error;
  }
};

export const deleteTransaction = async (
  userId: string,
  transactionId: string
): Promise<void> => {
  try {
    const transactionRef = ref(database, `transactions/${userId}/${transactionId}`);
    await remove(transactionRef);
  } catch (error) {
    console.error('Error al eliminar transacción:', error);
    throw error;
  }
};

export const classifyTransaction = async (
  userId: string,
  transactionId: string,
  categoryId: string,
  subcategoryId?: string
): Promise<void> => {
  try {
    await updateTransaction(userId, transactionId, {
      category: categoryId,
      subcategory: subcategoryId,
      status: 'classified'
    });
  } catch (error) {
    console.error('Error al clasificar transacción:', error);
    throw error;
  }
};

export const verifyTransaction = async (
  userId: string,
  transactionId: string
): Promise<void> => {
  try {
    await updateTransaction(userId, transactionId, {
      status: 'verified'
    });
  } catch (error) {
    console.error('Error al verificar transacción:', error);
    throw error;
  }
};

// Convertir ParsedTransaction a Transaction
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

// Made with Bob
