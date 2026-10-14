/**
 * Expense Analysis Tools - For LLM Agent
 *
 * TIER 1 + 2: Financial advisor tools
 * - getExpenseAnalysis: Anomalías y patrones
 * - getRecommendations: Recomendaciones inteligentes
 * - getCashflowPrediction: Predicción de gastos
 */

import { AuthenticatedContext } from '../../auth/authenticatedContext.js';
import { searchUserTransactions } from '../repositories/transactions.repository.js';
import { getCategories } from '../repositories/categories.repository.js';

/**
 * Tool: Get Expense Analysis
 * Detecta anomalías y patrones en gastos
 */
export interface GetExpenseAnalysisInput {
  category?: string; // Opcional: analizar categoría específica
  timeframe?: 'thisMonth' | 'lastMonth' | 'last3Months' | 'lastYear';
}

export async function getExpenseAnalysis(
  context: AuthenticatedContext,
  input: unknown
): Promise<any> {
  const args = input as GetExpenseAnalysisInput || {};

  try {
    // Obtener transacciones
    const transactions = await searchUserTransactions(context.uid, {
      type: 'expense',
      status: 'classified', // Solo transacciones categorizadas
    });

    if (transactions.length === 0) {
      return {
        success: true,
        message: 'No hay transacciones categorizadas para analizar',
        data: null,
      };
    }

    // Filtrar por período
    let filtered = transactions;
    const now = new Date();

    switch (args.timeframe) {
      case 'thisMonth':
        filtered = transactions.filter(tx => {
          const txDate = new Date(tx.date);
          return txDate.getMonth() === now.getMonth() &&
                 txDate.getFullYear() === now.getFullYear();
        });
        break;
      case 'lastMonth':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
        filtered = transactions.filter(tx => {
          const txDate = new Date(tx.date);
          return txDate.getMonth() === lastMonth.getMonth() &&
                 txDate.getFullYear() === lastMonth.getFullYear();
        });
        break;
      case 'last3Months':
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3);
        filtered = transactions.filter(tx => new Date(tx.date) >= threeMonthsAgo);
        break;
      case 'lastYear':
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth());
        filtered = transactions.filter(tx => new Date(tx.date) >= oneYearAgo);
        break;
    }

    // Agrupar por categoría y calcular stats
    const byCategory = new Map<string, number[]>();
    filtered.forEach(tx => {
      if (!byCategory.has(tx.category)) {
        byCategory.set(tx.category, []);
      }
      byCategory.get(tx.category)!.push(Math.abs(tx.amount));
    });

    const analysis: any[] = [];
    byCategory.forEach((amounts, categoryId) => {
      const total = amounts.reduce((a, b) => a + b, 0);
      const average = total / amounts.length;
      const sorted = amounts.sort((a, b) => a - b);
      const median = sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];

      const variance = amounts.reduce((sum, a) => sum + Math.pow(a - average, 2), 0) / amounts.length;
      const stdDev = Math.sqrt(variance);

      analysis.push({
        category: categoryId,
        total: Math.round(total * 100) / 100,
        average: Math.round(average * 100) / 100,
        median: Math.round(median * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100,
        count: amounts.length,
        min: Math.min(...amounts),
        max: Math.max(...amounts),
      });
    });

    // Detectar anomalías (z-score > 2.5)
    const anomalies: any[] = [];
    filtered.forEach(tx => {
      const categoryStats = analysis.find(a => a.category === tx.category);
      if (!categoryStats || categoryStats.stdDev === 0) return;

      const zScore = Math.abs((Math.abs(tx.amount) - categoryStats.average) / categoryStats.stdDev);
      if (zScore > 2.5) {
        anomalies.push({
          transactionId: tx.id,
          description: tx.description,
          amount: tx.amount,
          category: tx.category,
          zScore: Math.round(zScore * 100) / 100,
          severity: zScore > 3.5 ? 'high' : zScore > 3 ? 'medium' : 'low',
        });
      }
    });

    return {
      success: true,
      data: {
        period: args.timeframe || 'all',
        transactionCount: filtered.length,
        totalSpent: Math.round(filtered.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) * 100) / 100,
        analysis: analysis.sort((a, b) => b.total - a.total),
        anomalies: anomalies.sort((a, b) => b.zScore - a.zScore),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Tool: Get Recommendations
 * Genera recomendaciones inteligentes
 */
export interface GetRecommendationsInput {
  category?: string; // Opcional: recomendaciones para categoría específica
  type?: 'savings' | 'automation' | 'all'; // Tipo de recomendación
}

export async function getRecommendations(
  context: AuthenticatedContext,
  input: unknown
): Promise<any> {
  const args = input as GetRecommendationsInput || {};

  try {
    const transactions = await searchUserTransactions(context.uid, {
      type: 'expense',
      status: 'classified',
    });

    const recommendations: any[] = [];

    // Análisis de este vs mes anterior
    const now = new Date();
    const thisMonth = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === now.getMonth() &&
             txDate.getFullYear() === now.getFullYear();
    });

    const lastMonth = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === now.getMonth() - 1 &&
             txDate.getFullYear() === now.getFullYear();
    });

    // Agrupar por categoría
    const analyzeMonth = (txs: any[]) => {
      const byCategory = new Map<string, number>();
      txs.forEach(tx => {
        byCategory.set(tx.category, (byCategory.get(tx.category) || 0) + Math.abs(tx.amount));
      });
      return byCategory;
    };

    const thisMonthStats = analyzeMonth(thisMonth);
    const lastMonthStats = analyzeMonth(lastMonth);

    thisMonthStats.forEach((amount, category) => {
      const lastAmount = lastMonthStats.get(category) || 0;

      if (lastAmount > 0) {
        const changePercent = ((amount - lastAmount) / lastAmount) * 100;

        // Recomendación: Reducir gasto alto
        if (changePercent > 20) {
          recommendations.push({
            id: `rec-increase-${category}`,
            title: `Reducir gasto en ${category}`,
            description: `Tu gasto en ${category} aumentó ${changePercent.toFixed(0)}% este mes ($${amount.toFixed(2)} vs $${lastAmount.toFixed(2)}).`,
            category,
            potentialSavings: amount * 0.1,
            confidence: 0.75,
            type: 'savings',
          });
        }

        // Recomendación: Automatizar gasto estable
        const variance = Math.abs(amount - lastAmount) / lastAmount;
        if (variance < 0.15 && amount > 50) {
          recommendations.push({
            id: `rec-auto-${category}`,
            title: `Automatizar ${category}`,
            description: `Este gasto es muy consistente. Considera automatizarlo.`,
            category,
            potentialSavings: 0,
            confidence: 0.9,
            type: 'automation',
          });
        }
      }
    });

    // Filtrar por tipo si se especifica
    if (args.type && args.type !== 'all') {
      recommendations = recommendations.filter(r => r.type === args.type);
    }

    // Filtrar por categoría si se especifica
    if (args.category) {
      recommendations = recommendations.filter(r => r.category === args.category);
    }

    return {
      success: true,
      data: {
        recommendations: recommendations.slice(0, 5), // Top 5
        totalPotentialSavings: recommendations.reduce((sum, r) => sum + r.potentialSavings, 0),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Tool: Get Cashflow Prediction
 * Predice gasto para próximos meses
 */
export interface GetCashflowPredictionInput {
  months?: number; // Default 3
}

export async function getCashflowPrediction(
  context: AuthenticatedContext,
  input: unknown
): Promise<any> {
  const args = input as GetCashflowPredictionInput || { months: 3 };

  try {
    const transactions = await searchUserTransactions(context.uid, {
      type: 'expense',
      status: 'classified',
    });

    // Agrupar por mes
    const byMonth = new Map<string, number>();
    transactions.forEach(tx => {
      const date = new Date(tx.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) || 0) + Math.abs(tx.amount));
    });

    const monthlyTotals = Array.from(byMonth.entries())
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-(args.months || 3));

    if (monthlyTotals.length === 0) {
      return {
        success: true,
        message: 'No hay datos históricos suficientes',
        data: null,
      };
    }

    // Calcular promedio y desviación
    const totals = monthlyTotals.map(m => m.total);
    const average = totals.reduce((a, b) => a + b, 0) / totals.length;
    const variance = totals.reduce((sum, t) => sum + Math.pow(t - average, 2), 0) / totals.length;
    const stdDev = Math.sqrt(variance);

    // Predicción
    const now = new Date();
    const predictions: any[] = [];

    for (let i = 1; i <= 3; i++) {
      const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`;

      predictions.push({
        month: monthStr,
        predictedTotal: Math.round(average * 100) / 100,
        confidenceInterval: {
          low: Math.max(0, Math.round((average - stdDev) * 100) / 100),
          high: Math.round((average + stdDev) * 100) / 100,
        },
      });
    }

    return {
      success: true,
      data: {
        historicalMonths: monthlyTotals,
        predictions,
        averageMonthly: Math.round(average * 100) / 100,
        variability: Math.round(stdDev * 100) / 100,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Tool: Get Learning Classification
 * Obtiene transacciones categorizadas por el usuario para entrenar el modelo
 */
export interface GetLearningDataInput {
  limit?: number;
  category?: string;
}

export async function getLearningData(
  context: AuthenticatedContext,
  input: unknown
): Promise<any> {
  const args = input as GetLearningDataInput || { limit: 50 };

  try {
    const transactions = await searchUserTransactions(context.uid, {
      status: 'classified',
      limit: args.limit || 50,
    });

    if (args.category) {
      return {
        success: true,
        data: {
          category: args.category,
          examples: transactions
            .filter(tx => tx.category === args.category)
            .map(tx => ({
              description: tx.description,
              category: tx.category,
              frequency: 1, // Can be enhanced with actual frequency
            }))
            .slice(0, 10),
        },
      };
    }

    // Agrupar por categoría
    const byCat = new Map<string, string[]>();
    transactions.forEach(tx => {
      if (!byCat.has(tx.category)) {
        byCat.set(tx.category, []);
      }
      byCat.get(tx.category)!.push(tx.description);
    });

    const learning: any[] = [];
    byCat.forEach((descriptions, category) => {
      learning.push({
        category,
        examples: descriptions.slice(0, 5),
        frequency: descriptions.length,
      });
    });

    return {
      success: true,
      data: {
        learningData: learning,
        totalTransactions: transactions.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export const expenseAnalysisToolsExport = {
  getExpenseAnalysis,
  getRecommendations,
  getCashflowPrediction,
  getLearningData,
};
