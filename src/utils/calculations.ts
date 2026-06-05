import { Account, Transaction, Asset, KPIData } from '../types';

/**
 * Calcula el balance total por moneda
 */
export const calculateTotalBalance = (accounts: Account[]): { UYU: number; USD: number } => {
  return accounts.reduce(
    (acc, account) => {
      if (account.type === 'credit') {
        // Para tarjetas de crédito, el balance es negativo (deuda)
        acc[account.currency] -= Math.abs(account.balance);
      } else {
        acc[account.currency] += account.balance;
      }
      return acc;
    },
    { UYU: 0, USD: 0 }
  );
};

/**
 * Calcula los ingresos de un período (excluyendo transferencias internas)
 */
export const calculateIncome = (
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): number => {
  return transactions
    .filter(
      t =>
        t.type === 'income' &&
        t.date >= startDate.getTime() &&
        t.date <= endDate.getTime()
    )
    .reduce((sum, t) => sum + t.amount, 0);
};

/**
 * Calcula los gastos de un período (excluyendo transferencias internas)
 */
export const calculateExpenses = (
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): number => {
  return transactions
    .filter(
      t =>
        t.type === 'expense' &&
        t.date >= startDate.getTime() &&
        t.date <= endDate.getTime()
    )
    .reduce((sum, t) => sum + t.amount, 0);
};

/**
 * Calcula el ahorro de un período
 */
export const calculateSavings = (
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): number => {
  const income = calculateIncome(transactions, startDate, endDate);
  const expenses = calculateExpenses(transactions, startDate, endDate);
  return income - expenses;
};

/**
 * Calcula gastos por categoría (excluyendo transferencias internas)
 */
export const calculateExpensesByCategory = (
  transactions: Transaction[]
): Map<string, number> => {
  const expensesByCategory = new Map<string, number>();

  transactions
    .filter(t => t.type === 'expense' && t.category)
    .forEach(t => {
      const current = expensesByCategory.get(t.category!) || 0;
      expensesByCategory.set(t.category!, current + t.amount);
    });

  return expensesByCategory;
};

/**
 * Calcula la deuda total en tarjetas de crédito
 */
export const calculateTotalDebt = (accounts: Account[]): { UYU: number; USD: number } => {
  return accounts
    .filter(account => account.type === 'credit')
    .reduce(
      (acc, account) => {
        acc[account.currency] += Math.abs(account.balance);
        return acc;
      },
      { UYU: 0, USD: 0 }
    );
};

/**
 * Calcula el patrimonio neto
 */
export const calculateNetWorth = (
  accounts: Account[],
  assets: Asset[],
  exchangeRate: number = 40 // Tasa de cambio USD a UYU
): number => {
  // Sumar balances de cuentas (en UYU)
  const accountsBalance = accounts.reduce((sum, account) => {
    const balance = account.type === 'credit' ? -Math.abs(account.balance) : account.balance;
    return sum + (account.currency === 'USD' ? balance * exchangeRate : balance);
  }, 0);

  // Sumar valor de activos (en UYU)
  const assetsValue = assets.reduce((sum, asset) => {
    return sum + (asset.currency === 'USD' ? asset.value * exchangeRate : asset.value);
  }, 0);

  return accountsBalance + assetsValue;
};

/**
 * Calcula todos los KPIs principales
 */
export const calculateKPIs = (
  accounts: Account[],
  transactions: Transaction[],
  assets: Asset[],
  exchangeRate: number = 40
): KPIData => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const totalBalance = calculateTotalBalance(accounts);
  const monthlyIncome = calculateIncome(transactions, startOfMonth, endOfMonth);
  const monthlyExpenses = calculateExpenses(transactions, startOfMonth, endOfMonth);
  const totalDebt = calculateTotalDebt(accounts);

  return {
    totalBalanceUYU: totalBalance.UYU,
    totalBalanceUSD: totalBalance.USD,
    monthlyIncome,
    monthlyExpenses,
    monthlySavings: monthlyIncome - monthlyExpenses,
    totalDebt: totalDebt.UYU + totalDebt.USD * exchangeRate,
    netWorth: calculateNetWorth(accounts, assets, exchangeRate)
  };
};

/**
 * Calcula la tendencia mensual (últimos N meses)
 */
export const calculateMonthlyTrend = (
  transactions: Transaction[],
  months: number = 12
): Array<{ month: string; income: number; expenses: number }> => {
  const now = new Date();
  const trend: Array<{ month: string; income: number; expenses: number }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const income = calculateIncome(transactions, startOfMonth, endOfMonth);
    const expenses = calculateExpenses(transactions, startOfMonth, endOfMonth);

    trend.push({
      month: date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
      income,
      expenses
    });
  }

  return trend;
};

/**
 * Calcula el promedio de gastos mensuales
 */
export const calculateAverageMonthlyExpenses = (
  transactions: Transaction[],
  months: number = 6
): number => {
  const trend = calculateMonthlyTrend(transactions, months);
  const totalExpenses = trend.reduce((sum, item) => sum + item.expenses, 0);
  return totalExpenses / months;
};

/**
 * Calcula el porcentaje de uso de crédito
 */
export const calculateCreditUtilization = (accounts: Account[]): number => {
  const creditAccounts = accounts.filter(a => a.type === 'credit');
  
  if (creditAccounts.length === 0) return 0;

  const totalUsed = creditAccounts.reduce((sum, a) => sum + Math.abs(a.balance), 0);
  const totalLimit = creditAccounts.reduce((sum, a) => sum + (a.creditLimit || 0), 0);

  if (totalLimit === 0) return 0;

  return (totalUsed / totalLimit) * 100;
};

/**
 * Formatea un monto con separadores de miles y decimales
 */
export const formatCurrency = (amount: number, currency: 'UYU' | 'USD' = 'UYU'): string => {
  const symbol = currency === 'USD' ? 'US$' : '$';
  return `${symbol} ${amount.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Convierte entre monedas
 */
export const convertCurrency = (
  amount: number,
  from: 'UYU' | 'USD',
  to: 'UYU' | 'USD',
  exchangeRate: number = 40
): number => {
  if (from === to) return amount;
  if (from === 'USD') return amount * exchangeRate;
  return amount / exchangeRate;
};

// Made with Bob
