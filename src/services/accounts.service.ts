import { ref, push, set, get, update, remove } from 'firebase/database';
import { database } from './firebase';
import { Account, Transaction } from '../types';
import { getTransactions } from './transactions.service';

export const createAccount = async (userId: string, account: Omit<Account, 'id'>): Promise<string> => {
  try {
    const accountsRef = ref(database, `accounts/${userId}`);
    const newAccountRef = push(accountsRef);
    const accountId = newAccountRef.key!;
    
    const accountData: Account = {
      ...account,
      id: accountId,
      lastSync: Date.now()
    };
    
    await set(newAccountRef, accountData);
    return accountId;
  } catch (error) {
    console.error('Error al crear cuenta:', error);
    throw error;
  }
};

export const getAccounts = async (userId: string): Promise<Account[]> => {
  try {
    const accountsRef = ref(database, `accounts/${userId}`);
    const snapshot = await get(accountsRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    const accountsData = snapshot.val();
    return Object.values(accountsData) as Account[];
  } catch (error) {
    console.error('Error al obtener cuentas:', error);
    throw error;
  }
};

export const getAccountById = async (userId: string, accountId: string): Promise<Account | null> => {
  try {
    const accountRef = ref(database, `accounts/${userId}/${accountId}`);
    const snapshot = await get(accountRef);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    return snapshot.val() as Account;
  } catch (error) {
    console.error('Error al obtener cuenta:', error);
    throw error;
  }
};

export const updateAccount = async (userId: string, accountId: string, updates: Partial<Account>): Promise<void> => {
  try {
    const accountRef = ref(database, `accounts/${userId}/${accountId}`);
    await update(accountRef, {
      ...updates,
      lastSync: Date.now()
    });
  } catch (error) {
    console.error('Error al actualizar cuenta:', error);
    throw error;
  }
};

export const deleteAccount = async (userId: string, accountId: string): Promise<void> => {
  try {
    const accountRef = ref(database, `accounts/${userId}/${accountId}`);
    await remove(accountRef);
  } catch (error) {
    console.error('Error al eliminar cuenta:', error);
    throw error;
  }
};

export const updateAccountBalance = async (userId: string, accountId: string, newBalance: number): Promise<void> => {
  try {
    await updateAccount(userId, accountId, { balance: newBalance });
  } catch (error) {
    console.error('Error al actualizar balance:', error);
    throw error;
  }
};

/**
 * Recalcula y actualiza el balance de una cuenta basándose en el balance inicial y todas sus transacciones
 */
export const recalculateAccountBalance = async (userId: string, accountId: string): Promise<number> => {
  try {
    const account = await getAccountById(userId, accountId);
    if (!account) {
      throw new Error('Cuenta no encontrada');
    }
    
    const transactions = await getTransactions(userId);
    const accountTransactions = transactions.filter(tx => tx.accountId === accountId);
    
    // Calcular balance partiendo del balance inicial y sumando todas las transacciones
    const balance = accountTransactions.reduce((sum, tx) => {
      if (tx.type === 'income') {
        return sum + Math.abs(tx.amount);
      } else if (tx.type === 'expense') {
        return sum - Math.abs(tx.amount);
      } else if (tx.type === 'transfer') {
        // Las transferencias no afectan el balance (se manejan por separado)
        return sum;
      }
      return sum;
    }, account.initialBalance || 0);
    
    // Redondear a 2 decimales
    const roundedBalance = Math.round(balance * 100) / 100;
    
    // Actualizar el balance en Firebase
    await updateAccountBalance(userId, accountId, roundedBalance);
    
    return roundedBalance;
  } catch (error) {
    console.error('Error al recalcular balance:', error);
    throw error;
  }
};

/**
 * Recalcula los balances de todas las cuentas basándose en el balance inicial y sus transacciones
 */
export const recalculateAllAccountBalances = async (userId: string): Promise<void> => {
  try {
    const accounts = await getAccounts(userId);
    const transactions = await getTransactions(userId);
    
    // Agrupar transacciones por cuenta
    const transactionsByAccount = transactions.reduce((acc, tx) => {
      if (!acc[tx.accountId]) {
        acc[tx.accountId] = [];
      }
      acc[tx.accountId].push(tx);
      return acc;
    }, {} as Record<string, Transaction[]>);
    
    // Calcular y actualizar balance para cada cuenta
    for (const account of accounts) {
      const accountTransactions = transactionsByAccount[account.id] || [];
      
      const balance = accountTransactions.reduce((sum, tx) => {
        if (tx.type === 'income') {
          return sum + Math.abs(tx.amount);
        } else if (tx.type === 'expense') {
          return sum - Math.abs(tx.amount);
        } else if (tx.type === 'transfer') {
          // Las transferencias no afectan el balance
          return sum;
        }
        return sum;
      }, account.initialBalance || 0);
      
      // Redondear a 2 decimales
      const roundedBalance = Math.round(balance * 100) / 100;
      
      await updateAccountBalance(userId, account.id, roundedBalance);
    }
    
    console.log(`✅ Balances recalculados para ${accounts.length} cuentas`);
  } catch (error) {
    console.error('Error al recalcular todos los balances:', error);
    throw error;
  }
};

// Inicializar cuentas predeterminadas para un nuevo usuario
export const initializeDefaultAccounts = async (userId: string): Promise<void> => {
  try {
    const defaultAccounts = [
      // Yosba
      { name: "BROU Pesos", type: "debit" as const, currency: "UYU" as const, bank: "BROU", owner: "Yosba", balance: 0, initialBalance: 0 },
      { name: "BROU Dólares", type: "debit" as const, currency: "USD" as const, bank: "BROU", owner: "Yosba", balance: 0, initialBalance: 0 },
      { name: "Itaú Pesos", type: "debit" as const, currency: "UYU" as const, bank: "Itaú", owner: "Yosba", balance: 0, initialBalance: 0 },
      { name: "Itaú Dólares", type: "debit" as const, currency: "USD" as const, bank: "Itaú", owner: "Yosba", balance: 0, initialBalance: 0 },
      { name: "Itaú Visa", type: "credit" as const, currency: "UYU" as const, bank: "Itaú", owner: "Yosba", balance: 0, initialBalance: 0, creditLimit: 0 },
      { name: "OCA Master 1", type: "credit" as const, currency: "UYU" as const, bank: "OCA", owner: "Yosba", balance: 0, initialBalance: 0, creditLimit: 0 },
      { name: "OCA Visa", type: "credit" as const, currency: "UYU" as const, bank: "OCA", owner: "Yosba", balance: 0, initialBalance: 0, creditLimit: 0 },
      { name: "Prex Pesos", type: "debit" as const, currency: "UYU" as const, bank: "Prex", owner: "Yosba", balance: 0, initialBalance: 0 },
      { name: "Prex Dólares", type: "debit" as const, currency: "USD" as const, bank: "Prex", owner: "Yosba", balance: 0, initialBalance: 0 },
      
      // Yane
      { name: "Santander Pesos", type: "debit" as const, currency: "UYU" as const, bank: "Santander", owner: "Yane", balance: 0, initialBalance: 0 },
      { name: "Santander Dólares", type: "debit" as const, currency: "USD" as const, bank: "Santander", owner: "Yane", balance: 0, initialBalance: 0 },
      { name: "Santander Visa", type: "credit" as const, currency: "UYU" as const, bank: "Santander", owner: "Yane", balance: 0, initialBalance: 0, creditLimit: 0 },
      { name: "OCA Master 2", type: "credit" as const, currency: "UYU" as const, bank: "OCA", owner: "Yane", balance: 0, initialBalance: 0, creditLimit: 0 },
      
      // Núcleo (antes "Ambos")
      { name: "BHU YO AHORRO", type: "debit" as const, currency: "UYU" as const, bank: "BHU", owner: "Núcleo", balance: 0, initialBalance: 0 },
      { name: "IBM Inversiones", type: "investment" as const, currency: "USD" as const, bank: "IBM", owner: "Yosba", balance: 0, initialBalance: 0 }
    ];
    
    for (const account of defaultAccounts) {
      await createAccount(userId, { ...account, lastSync: Date.now() });
    }
  } catch (error) {
    console.error('Error al inicializar cuentas predeterminadas:', error);
    throw error;
  }
};

// Made with Bob
