/**
 * Definición Simplificada de Herramientas para Agente Financiero
 * 
 * FASE 02: Se eliminó diseño especulativo. 
 * Se mantienen SOLO las herramientas necesarias para MVP.
 * 
 * Herramientas definidas (contratos únicamente, NO implementadas):
 * 1. searchTransactions - Buscar transacciones
 * 2. getExpenseSummary - Resumen de gastos
 * 3. getIncomeSummary - Resumen de ingresos
 * 4. getCategoryBreakdown - Desglose por categoría
 * 5. comparePeriods - Comparar períodos
 * 6. getCashflow - Flujo de caja
 * 7. getNetWorth - Patrimonio neto
 * 8. categorizeTransactions - Categorizar transacciones
 */

import { Transaction, Category } from '../types';

/**
 * Resultado base para todas las herramientas
 */
export interface AgentToolResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    executionTime?: number;
    dataSourceCount?: number;
  };
}

// ============================================================================
// HERRAMIENTA 1: Buscar Transacciones
// ============================================================================

export interface SearchTransactionsInput {
  startDate?: number;
  endDate?: number;
  description?: string;
  categoryId?: string;
  minAmount?: number;
  maxAmount?: number;
  accountId?: string;
  status?: 'pending' | 'classified' | 'verified';
  limit?: number;
  offset?: number;
}

export interface SearchTransactionsOutput {
  transactions: Transaction[];
  total: number;
  matched: number;
}

// ============================================================================
// HERRAMIENTA 2: Resumen de Gastos
// ============================================================================

export interface GetExpenseSummaryInput {
  startDate: number;
  endDate: number;
  groupBy?: 'category' | 'account' | 'day' | 'week' | 'month';
  accountId?: string;
}

export interface ExpenseSummaryItem {
  label: string;
  amount: number;
  currency: string;
  percentage: number;
  transactionCount: number;
}

export interface GetExpenseSummaryOutput {
  totalExpenses: number;
  currency: string;
  period: string;
  breakdown: ExpenseSummaryItem[];
}

// ============================================================================
// HERRAMIENTA 3: Resumen de Ingresos
// ============================================================================

export interface GetIncomeSummaryInput {
  startDate: number;
  endDate: number;
  groupBy?: 'category' | 'account' | 'day' | 'week' | 'month';
  accountId?: string;
}

export interface GetIncomeSummaryOutput {
  totalIncome: number;
  currency: string;
  period: string;
  breakdown: ExpenseSummaryItem[];
  averageTransactionAmount: number;
  transactionCount: number;
}

// ============================================================================
// HERRAMIENTA 4: Desglose por Categoría
// ============================================================================

export interface GetCategoryBreakdownInput {
  categoryId: string;
  startDate: number;
  endDate: number;
  accountId?: string;
}

export interface GetCategoryBreakdownOutput {
  categoryName: string;
  totalAmount: number;
  transactionCount: number;
  averageTransaction: number;
  percentageOfTotal: number;
  pendingTransactions: number;
}

// ============================================================================
// HERRAMIENTA 5: Comparar Períodos
// ============================================================================

export interface ComparePeriodInput {
  period1Start: number;
  period1End: number;
  period2Start: number;
  period2End: number;
  accountId?: string;
  groupBy?: 'category' | 'type';
}

export interface ComparePeriodOutput {
  period1Label: string;
  period2Label: string;
  expensesComparison: {
    period1: number;
    period2: number;
    percentageChange: number;
    direction: 'up' | 'down' | 'stable';
  };
  incomeComparison: {
    period1: number;
    period2: number;
    percentageChange: number;
    direction: 'up' | 'down' | 'stable';
  };
  savingsComparison: {
    period1: number;
    period2: number;
    percentageChange: number;
    direction: 'up' | 'down' | 'stable';
  };
}

// ============================================================================
// HERRAMIENTA 6: Flujo de Caja
// ============================================================================

export interface GetCashflowInput {
  startDate: number;
  endDate: number;
  accountId?: string;
  groupBy?: 'day' | 'week' | 'month';
}

export interface CashflowDataPoint {
  date: string;
  income: number;
  expenses: number;
  net: number;
  runningBalance: number;
}

export interface GetCashflowOutput {
  period: string;
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  savingsRate: number;
  dataPoints: CashflowDataPoint[];
}

// ============================================================================
// HERRAMIENTA 7: Patrimonio Neto
// ============================================================================

export interface GetNetWorthInput {
  date?: number;
}

export interface NetWorthBreakdown {
  category: string;
  items: Array<{
    name: string;
    currency: string;
    amount: number;
    type: 'asset' | 'liability';
  }>;
  subtotal: number;
}

export interface GetNetWorthOutput {
  asOfDate: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  breakdown: NetWorthBreakdown[];
}

// ============================================================================
// HERRAMIENTA 8: Categorizar Transacciones
// ============================================================================

export interface CategorizeTransactionsInput {
  transactionIds?: string[];
  accountId?: string;
  categoryId?: string;
}

export interface CategorizeTransactionsOutput {
  totalPending: number;
  categorized: number;
  suggestions: Array<{
    transactionId: string;
    description: string;
    suggestedCategoryId: string;
    suggestedCategoryName: string;
    confidence: number;
  }>;
}

// ============================================================================
// REGISTRO DE HERRAMIENTAS
// ============================================================================

export const AGENT_TOOLS_REGISTRY = {
  searchTransactions: {
    name: 'searchTransactions',
    description: 'Buscar transacciones por criterios (período, descripción, categoría, monto)',
    implemented: false,
  },
  getExpenseSummary: {
    name: 'getExpenseSummary',
    description: 'Obtener resumen de gastos por período y categoría',
    implemented: false,
  },
  getIncomeSummary: {
    name: 'getIncomeSummary',
    description: 'Obtener resumen de ingresos por período y fuente',
    implemented: false,
  },
  getCategoryBreakdown: {
    name: 'getCategoryBreakdown',
    description: 'Análisis profundo de una categoría específica',
    implemented: false,
  },
  comparePeriods: {
    name: 'comparePeriods',
    description: 'Comparar dos períodos (mes anterior vs actual, etc.)',
    implemented: false,
  },
  getCashflow: {
    name: 'getCashflow',
    description: 'Calcular flujo de caja (ingresos - gastos)',
    implemented: false,
  },
  getNetWorth: {
    name: 'getNetWorth',
    description: 'Calcular patrimonio neto (activos - pasivos)',
    implemented: false,
  },
  categorizeTransactions: {
    name: 'categorizeTransactions',
    description: 'Sugerir categorías para transacciones pendientes',
    implemented: false,
  },
};

// ============================================================================
// NOTA IMPORTANTE
// ============================================================================
//
// Herramientas NO implementadas en FASE 02.
// Se mantuvo el diseño de contratos para futuro agente.
//
// Herramientas ELIMINADAS (especulativas, sin necesidad actual):
// - generateInsights
// - suggestBudget
// - forecast
// - recommendations
//
// Futuro: Cada tool se implementará cuando el agente esté listo.
//
// SEGURIDAD: Ninguna tool debe aceptar userId/uid/familyId como parámetro.
// La identidad debe obtenerse del contexto autenticado del servidor.
// ============================================================================

// Made with Bob
