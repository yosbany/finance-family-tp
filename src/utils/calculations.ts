import { Account, Transaction, Asset, KPIData, Currency, ExchangeRates, ConvertibleCurrency } from '../types';
import { DEFAULT_EXCHANGE_RATES } from '../services/settings.service';

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
 * Convierte un monto a pesos uruguayos usando las tasas configuradas.
 */
export const toUyu = (
  amount: number,
  currency: ConvertibleCurrency,
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES
): number => {
  if (currency === 'UYU') return amount;
  if (currency === 'USD') return amount * rates.usdToUyu;
  if (currency === 'BRL') return amount * rates.brlToUyu;
  return amount * rates.uiToUyu;
};

/**
 * Calcula el patrimonio neto en UYU
 */
export const calculateNetWorth = (
  accounts: Account[],
  assets: Asset[],
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES
): number => {
  const accountsBalance = accounts.reduce((sum, account) => {
    const balance = account.type === 'credit' ? -Math.abs(account.balance) : account.balance;
    return sum + toUyu(balance, account.currency, rates);
  }, 0);

  const assetsValue = assets.reduce((sum, asset) => {
    return sum + toUyu(asset.value, asset.currency, rates);
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
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES
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
    totalDebt: toUyu(totalDebt.UYU, 'UYU', rates) + toUyu(totalDebt.USD, 'USD', rates),
    netWorth: calculateNetWorth(accounts, assets, rates)
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
export const formatCurrency = (amount: number, currency: ConvertibleCurrency = 'UYU'): string => {
  if (currency === 'USD') {
    return `US$ ${amount.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (currency === 'UI') {
    return `${amount.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} UI`;
  }
  if (currency === 'BRL') {
    return `R$ ${amount.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$ ${amount.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Convierte entre UYU, USD y UI usando las tasas configuradas.
 */
export const convertCurrency = (
  amount: number,
  from: ConvertibleCurrency,
  to: ConvertibleCurrency,
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES
): number => {
  if (from === to) return amount;
  const inUyu = toUyu(amount, from, rates);
  if (to === 'UYU') return inUyu;
  if (to === 'USD') return inUyu / rates.usdToUyu;
  if (to === 'BRL') return inUyu / rates.brlToUyu;
  return inUyu / rates.uiToUyu;
};

/**
 * Calcula el monto actual de un objetivo según los saldos de las cuentas vinculadas
 */
export const calculateGoalCurrentAmount = (
  goal: { currency: Currency; linkedAccountIds?: string[]; currentAmount: number },
  accounts: Account[],
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES
): number => {
  if (!goal.linkedAccountIds?.length) {
    return goal.currentAmount;
  }

  const total = goal.linkedAccountIds.reduce((sum, accountId) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return sum;

    const value = account.type === 'credit'
      ? -Math.abs(account.balance)
      : account.balance;

    return sum + convertCurrency(value, account.currency, goal.currency, rates);
  }, 0);

  return Math.round(total * 100) / 100;
};
