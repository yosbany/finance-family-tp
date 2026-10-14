/**
 * Expense Analysis Service - TIER 1 + 2
 *
 * Análisis de gastos para:
 * - Detección de anomalías
 * - Patrones de gasto
 * - Recomendaciones
 * - Predicciones
 */

import { Transaction, Category } from '../types';

export interface ExpenseStats {
  total: number;
  average: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  count: number;
}

export interface AnomalyResult {
  transactionId: string;
  description: string;
  amount: number;
  category: string;
  isAnomaly: boolean;
  zScore: number;
  severity: 'low' | 'medium' | 'high'; // z-score magnitude
  reason: string;
}

export interface SpendingPattern {
  category: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
  average: number;
  lastMonth: number;
  currentMonth: number;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  potentialSavings: number;
  confidence: number; // 0-1
  actionItems: string[];
}

export interface CashflowPrediction {
  month: string;
  predictedTotal: number;
  confidenceInterval: {
    low: number;
    high: number;
  };
  breakdown: {
    category: string;
    predicted: number;
  }[];
}

/**
 * Calcula estadísticas de gastos por categoría
 */
export function calculateCategoryStats(
  transactions: Transaction[],
  category?: string
): ExpenseStats {
  let relevant = transactions.filter(t => t.type === 'expense');

  if (category) {
    relevant = relevant.filter(t => t.category === category);
  }

  if (relevant.length === 0) {
    return {
      total: 0,
      average: 0,
      median: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      count: 0,
    };
  }

  const amounts = relevant.map(t => Math.abs(t.amount)).sort((a, b) => a - b);
  const total = amounts.reduce((sum, a) => sum + a, 0);
  const average = total / amounts.length;
  const median = amounts.length % 2 === 0
    ? (amounts[amounts.length / 2 - 1] + amounts[amounts.length / 2]) / 2
    : amounts[Math.floor(amounts.length / 2)];

  const variance = amounts.reduce((sum, a) => sum + Math.pow(a - average, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);

  return {
    total,
    average,
    median,
    stdDev,
    min: Math.min(...amounts),
    max: Math.max(...amounts),
    count: amounts.length,
  };
}

/**
 * Detecta anomalías usando Z-score
 * Z > 2.5 es anómalo (más de 2.5 desviaciones estándar)
 */
export function detectAnomalies(
  transactions: Transaction[],
  categories: Category[]
): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];
  const expenses = transactions.filter(t => t.type === 'expense');

  // Por cada categoría, detectar anomalías
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));
  const groupedByCategory = new Map<string, Transaction[]>();

  expenses.forEach(tx => {
    if (!groupedByCategory.has(tx.category)) {
      groupedByCategory.set(tx.category, []);
    }
    groupedByCategory.get(tx.category)!.push(tx);
  });

  groupedByCategory.forEach((txs, categoryId) => {
    const stats = calculateCategoryStats(txs);

    if (stats.count < 3 || stats.stdDev === 0) return;

    txs.forEach(tx => {
      const zScore = Math.abs((Math.abs(tx.amount) - stats.average) / stats.stdDev);

      if (zScore > 2.5) {
        const severity = zScore > 3.5 ? 'high' : zScore > 3 ? 'medium' : 'low';

        anomalies.push({
          transactionId: tx.id,
          description: tx.description,
          amount: tx.amount,
          category: categoryMap.get(categoryId) || categoryId,
          isAnomaly: true,
          zScore,
          severity,
          reason: `Gasto de $${Math.abs(tx.amount).toFixed(2)} es ${zScore.toFixed(1)}x la desviación estándar (promedio: $${stats.average.toFixed(2)})`,
        });
      }
    });
  });

  return anomalies.sort((a, b) => b.zScore - a.zScore);
}

/**
 * Detecta patrones de gasto comparando períodos
 */
export function detectSpendingPatterns(
  transactions: Transaction[],
  categories: Category[]
): SpendingPattern[] {
  const patterns: SpendingPattern[] = [];
  const expenses = transactions.filter(t => t.type === 'expense');

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);

  const categoryMap = new Map(categories.map(c => [c.id, c.name]));

  // Agrupar por categoría y mes
  const byCategory = new Map<string, { current: number[]; last: number[] }>();

  expenses.forEach(tx => {
    const txDate = new Date(tx.date);
    const txMonth = txDate.getMonth();
    const txYear = txDate.getFullYear();

    if (!byCategory.has(tx.category)) {
      byCategory.set(tx.category, { current: [], last: [] });
    }

    const amount = Math.abs(tx.amount);

    if (txMonth === currentMonth && txYear === currentYear) {
      byCategory.get(tx.category)!.current.push(amount);
    } else if (txMonth === lastMonthDate.getMonth() && txYear === lastMonthDate.getFullYear()) {
      byCategory.get(tx.category)!.last.push(amount);
    }
  });

  byCategory.forEach((amounts, categoryId) => {
    const currentAvg = amounts.current.length > 0
      ? amounts.current.reduce((a, b) => a + b, 0) / amounts.current.length
      : 0;

    const lastAvg = amounts.last.length > 0
      ? amounts.last.reduce((a, b) => a + b, 0) / amounts.last.length
      : 0;

    if (currentAvg === 0 && lastAvg === 0) return;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let changePercent = 0;

    if (lastAvg > 0) {
      changePercent = ((currentAvg - lastAvg) / lastAvg) * 100;
      if (changePercent > 10) trend = 'increasing';
      else if (changePercent < -10) trend = 'decreasing';
    }

    patterns.push({
      category: categoryMap.get(categoryId) || categoryId,
      trend,
      changePercent,
      average: (currentAvg + lastAvg) / 2,
      lastMonth: lastAvg,
      currentMonth: currentAvg,
    });
  });

  return patterns.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}

/**
 * Genera recomendaciones basadas en análisis
 */
export function generateRecommendations(
  transactions: Transaction[],
  categories: Category[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const patterns = detectSpendingPatterns(transactions, categories);
  const stats = calculateCategoryStats(transactions);

  // Recomendación 1: Categorías con gasto muy alto
  patterns.forEach((pattern, idx) => {
    if (pattern.trend === 'increasing' && pattern.changePercent > 20) {
      const savings = pattern.currentMonth * 0.1; // 10% potencial

      recommendations.push({
        id: `rec-${idx}-1`,
        title: `Reducir gasto en ${pattern.category}`,
        description: `Tu gasto en ${pattern.category} aumentó ${pattern.changePercent.toFixed(0)}% este mes. Podrías ahorrar $${savings.toFixed(2)} si reduces 10%.`,
        category: pattern.category,
        potentialSavings: savings,
        confidence: 0.75,
        actionItems: [
          'Revisar transacciones recientes en esta categoría',
          'Identificar gastos innecesarios',
          'Establecer presupuesto mensual',
        ],
      });
    }
  });

  // Recomendación 2: Categorías estables (automatizable)
  patterns.forEach((pattern, idx) => {
    if (pattern.trend === 'stable' && pattern.currentMonth > 50) {
      recommendations.push({
        id: `rec-${idx}-2`,
        title: `Automatizar pago de ${pattern.category}`,
        description: `${pattern.category} es muy consistente ($${pattern.currentMonth.toFixed(2)}/mes). Considera automatizar.`,
        category: pattern.category,
        potentialSavings: 0,
        confidence: 0.9,
        actionItems: [
          'Evaluar si es suscripción o pago recurrente',
          'Configurar pago automático si es posible',
          'Establecer recordatorio de revisión anual',
        ],
      });
    }
  });

  return recommendations.slice(0, 5); // Top 5
}

/**
 * Predice gasto del próximo mes
 */
export function predictCashflow(
  transactions: Transaction[],
  months: number = 3
): CashflowPrediction[] {
  const predictions: CashflowPrediction[] = [];
  const expenses = transactions.filter(t => t.type === 'expense');

  // Agrupar por mes
  const byMonth = new Map<string, number[]>();

  expenses.forEach(tx => {
    const date = new Date(tx.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!byMonth.has(key)) {
      byMonth.set(key, []);
    }
    byMonth.get(key)!.push(Math.abs(tx.amount));
  });

  const monthlyTotals = Array.from(byMonth.entries())
    .map(([month, amounts]) => ({
      month,
      total: amounts.reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-months); // Últimos N meses

  if (monthlyTotals.length === 0) {
    return [];
  }

  // Calcular promedio y desviación
  const totals = monthlyTotals.map(m => m.total);
  const average = totals.reduce((a, b) => a + b, 0) / totals.length;
  const variance = totals.reduce((sum, t) => sum + Math.pow(t - average, 2), 0) / totals.length;
  const stdDev = Math.sqrt(variance);

  // Generar predicción para próximos 3 meses
  const now = new Date();
  for (let i = 1; i <= 3; i++) {
    const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`;

    predictions.push({
      month: monthStr,
      predictedTotal: average,
      confidenceInterval: {
        low: Math.max(0, average - stdDev),
        high: average + stdDev,
      },
      breakdown: [], // Placeholder
    });
  }

  return predictions;
}

/**
 * Genera resumen analítico en texto
 */
export function generateAnalysisSummary(
  transactions: Transaction[],
  categories: Category[]
): string {
  const stats = calculateCategoryStats(transactions);
  const anomalies = detectAnomalies(transactions, categories);
  const patterns = detectSpendingPatterns(transactions, categories);
  const recommendations = generateRecommendations(transactions, categories);

  let summary = '📊 ANÁLISIS DE GASTOS\n\n';

  summary += `💰 Resumen:\n`;
  summary += `- Total gastado: $${stats.total.toFixed(2)}\n`;
  summary += `- Promedio por transacción: $${stats.average.toFixed(2)}\n`;
  summary += `- Rango: $${stats.min.toFixed(2)} - $${stats.max.toFixed(2)}\n\n`;

  if (patterns.length > 0) {
    summary += `📈 Patrones principales:\n`;
    patterns.slice(0, 3).forEach(p => {
      summary += `- ${p.category}: ${p.trend} (${p.changePercent > 0 ? '+' : ''}${p.changePercent.toFixed(0)}%)\n`;
    });
    summary += '\n';
  }

  if (anomalies.length > 0) {
    summary += `⚠️ Anomalías detectadas:\n`;
    anomalies.slice(0, 3).forEach(a => {
      summary += `- ${a.description}: $${Math.abs(a.amount).toFixed(2)} (${a.severity})\n`;
    });
    summary += '\n';
  }

  if (recommendations.length > 0) {
    summary += `💡 Recomendaciones:\n`;
    recommendations.slice(0, 3).forEach(r => {
      if (r.potentialSavings > 0) {
        summary += `- ${r.title} (potencial ahorro: $${r.potentialSavings.toFixed(2)})\n`;
      } else {
        summary += `- ${r.title}\n`;
      }
    });
  }

  return summary;
}
