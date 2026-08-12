import { ref, push, set, get, update, remove } from 'firebase/database';
import { database } from './firebase';
import { familyPath } from './familyPaths';
import { Account, Transaction } from '../types';
import { getTransactions, updateTransaction } from './transactions.service';
import { reassignUploadHistoryAccount } from './uploadHistory.service';

export const createAccount = async (account: Omit<Account, 'id'>): Promise<string> => {
  try {
    const accountsRef = ref(database, familyPath('accounts'));
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

export const getAccounts = async (): Promise<Account[]> => {
  try {
    const accountsRef = ref(database, familyPath('accounts'));
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

export const getAccountById = async (accountId: string): Promise<Account | null> => {
  try {
    const accountRef = ref(database, familyPath('accounts', accountId));
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

export const updateAccount = async (accountId: string, updates: Partial<Account>): Promise<void> => {
  try {
    const accountRef = ref(database, familyPath('accounts', accountId));
    await update(accountRef, {
      ...updates,
      lastSync: Date.now()
    });
  } catch (error) {
    console.error('Error al actualizar cuenta:', error);
    throw error;
  }
};

export const deleteAccount = async (accountId: string): Promise<void> => {
  try {
    const accountRef = ref(database, familyPath('accounts', accountId));
    await remove(accountRef);
  } catch (error) {
    console.error('Error al eliminar cuenta:', error);
    throw error;
  }
};

export const updateAccountBalance = async (accountId: string, newBalance: number): Promise<void> => {
  try {
    await updateAccount(accountId, { balance: newBalance });
  } catch (error) {
    console.error('Error al actualizar balance:', error);
    throw error;
  }
};

export const recalculateAccountBalance = async (accountId: string): Promise<number> => {
  try {
    const account = await getAccountById(accountId);
    if (!account) {
      throw new Error('Cuenta no encontrada');
    }

    const transactions = await getTransactions();
    const accountTransactions = transactions.filter(tx => tx.accountId === accountId);

    const balance = accountTransactions.reduce((sum, tx) => {
      if (tx.type === 'income') {
        return sum + Math.abs(tx.amount);
      } else if (tx.type === 'expense') {
        return sum - Math.abs(tx.amount);
      } else if (tx.type === 'transfer') {
        return sum;
      }
      return sum;
    }, account.initialBalance || 0);

    const roundedBalance = Math.round(balance * 100) / 100;
    await updateAccountBalance(accountId, roundedBalance);

    return roundedBalance;
  } catch (error) {
    console.error('Error al recalcular balance:', error);
    throw error;
  }
};

export const recalculateAllAccountBalances = async (): Promise<void> => {
  try {
    const accounts = await getAccounts();
    const transactions = await getTransactions();

    const transactionsByAccount = transactions.reduce((acc, tx) => {
      if (!acc[tx.accountId]) {
        acc[tx.accountId] = [];
      }
      acc[tx.accountId].push(tx);
      return acc;
    }, {} as Record<string, Transaction[]>);

    for (const account of accounts) {
      const accountTransactions = transactionsByAccount[account.id] || [];

      const balance = accountTransactions.reduce((sum, tx) => {
        if (tx.type === 'income') {
          return sum + Math.abs(tx.amount);
        } else if (tx.type === 'expense') {
          return sum - Math.abs(tx.amount);
        } else if (tx.type === 'transfer') {
          return sum;
        }
        return sum;
      }, account.initialBalance || 0);

      const roundedBalance = Math.round(balance * 100) / 100;
      await updateAccountBalance(account.id, roundedBalance);
    }

    console.log(`✅ Balances recalculados para ${accounts.length} cuentas`);
  } catch (error) {
    console.error('Error al recalcular todos los balances:', error);
    throw error;
  }
};

export const initializeDefaultAccounts = async (): Promise<void> => {
  try {
    const defaultAccounts = [
      { name: "BROU Pesos", type: "debit" as const, currency: "UYU" as const, bank: "BROU", owner: "Yosba", balance: 0, initialBalance: 0 },
      { name: "BROU Dólares", type: "debit" as const, currency: "USD" as const, bank: "BROU", owner: "Yosba", balance: 0, initialBalance: 0 },
      { name: "Itaú Pesos", type: "debit" as const, currency: "UYU" as const, bank: "Itaú", owner: "Yosba", balance: 0, initialBalance: 0 },
      { name: "Itaú Dólares", type: "debit" as const, currency: "USD" as const, bank: "Itaú", owner: "Yosba", balance: 0, initialBalance: 0 },
      { name: "Itaú Visa", type: "credit" as const, currency: "UYU" as const, bank: "Itaú", owner: "Yosba", balance: 0, initialBalance: 0, creditLimit: 0 },
      { name: "OCA Master 1", type: "credit" as const, currency: "UYU" as const, bank: "OCA", owner: "Yosba", balance: 0, initialBalance: 0, creditLimit: 0 },
      { name: "OCA Visa", type: "credit" as const, currency: "UYU" as const, bank: "OCA", owner: "Yosba", balance: 0, initialBalance: 0, creditLimit: 0 },
      { name: "Prex", type: "debit" as const, currency: "UYU" as const, bank: "Prex", owner: "Yosba", balance: 0, initialBalance: 0 },
      { name: "Santander Pesos", type: "debit" as const, currency: "UYU" as const, bank: "Santander", owner: "Yane", balance: 0, initialBalance: 0 },
      { name: "Santander Dólares", type: "debit" as const, currency: "USD" as const, bank: "Santander", owner: "Yane", balance: 0, initialBalance: 0 },
      { name: "Santander Visa", type: "credit" as const, currency: "UYU" as const, bank: "Santander", owner: "Yane", balance: 0, initialBalance: 0, creditLimit: 0 },
      { name: "OCA Master 2", type: "credit" as const, currency: "UYU" as const, bank: "OCA", owner: "Yane", balance: 0, initialBalance: 0, creditLimit: 0 },
      { name: "BHU YO AHORRO", type: "debit" as const, currency: "UYU" as const, bank: "BHU", owner: "Núcleo", balance: 0, initialBalance: 0 },
      { name: "IBM Inversiones", type: "investment" as const, currency: "USD" as const, bank: "IBM", owner: "Yosba", balance: 0, initialBalance: 0 }
    ];

    for (const account of defaultAccounts) {
      await createAccount({ ...account, lastSync: Date.now() });
    }
  } catch (error) {
    console.error('Error al inicializar cuentas predeterminadas:', error);
    throw error;
  }
};

/**
 * Una sola cuenta Prex (UYU). Fusiona Prex Pesos/Dólares si existían.
 */
export const ensureUnifiedPrexAccount = async (): Promise<string> => {
  const accounts = await getAccounts();
  const prexAccounts = accounts.filter(a => a.bank === 'Prex');

  if (prexAccounts.length === 0) {
    return createAccount({
      name: 'Prex',
      type: 'debit',
      currency: 'UYU',
      bank: 'Prex',
      owner: 'Yosba',
      balance: 0,
      initialBalance: 0,
      lastSync: Date.now(),
    });
  }

  const keep =
    prexAccounts.find(a => a.name === 'Prex') ||
    prexAccounts.find(a => a.currency === 'UYU') ||
    prexAccounts[0];

  await updateAccount(keep.id, {
    name: 'Prex',
    currency: 'UYU',
    type: 'debit',
  });

  const transactions = await getTransactions();
  for (const other of prexAccounts.filter(a => a.id !== keep.id)) {
    const toMove = transactions.filter(tx => tx.accountId === other.id);
    for (const tx of toMove) {
      await updateTransaction(tx.id, {
        accountId: keep.id,
        currency: 'UYU',
      });
    }
    await reassignUploadHistoryAccount(other.id, keep.id);
    await deleteAccount(other.id);
  }

  await recalculateAccountBalance(keep.id);
  return keep.id;
};
