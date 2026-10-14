/**
 * Trend Analysis Service - TIER 3
 *
 * Análisis de tendencias de vida:
 * - Detección de cambios de estilo de vida
 * - Análisis de gastos correlacionados
 * - Profiling comportamental
 */

import { Transaction } from '../types';

export interface LifestyleTrend {
  id: string;
  title: string;
  description: string;
  confidence: number;
  indicators: string[];
  potentialAnnualSavings: number;
}

export interface BehavioralProfile {
  spendingType: 'conservative' | 'moderate' | 'aggressive';
  topCategories: Array<{ category: string; percentage: number }>;
  weekdayBias: 'weekday_heavy' | 'weekend_heavy' | 'balanced';
  seasonal: boolean;
  consistency: number; // 0-1, qué tan consistente es
}

/**
 * Detecta cambios de estilo de vida
 * Ej: "Detectamos aumento en X (posible mudanza/pareja)"
 */
export function detectLifestyleChanges(
  transactions: Transaction[],
  monthsBack: number = 6
): LifestyleTrend[] {
  const trends: LifestyleTrend[] = [];
  const expenses = transactions.filter(t => t.type === 'expense');

  if (expenses.length < 30) {
    return trends; // Datos insuficientes
  }

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

  const months = Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-monthsBack);

  if (months.length < 3) return trends;

  // Detectar: Mudanza (aumento en servicios + transporte)
  const currentMonth = new Map<string, number>();
  expenses
    .filter(tx => {
      const date = new Date(tx.date);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    })
    .forEach(tx => {
      currentMonth.set(tx.category, (currentMonth.get(tx.category) || 0) + Math.abs(tx.amount));
    });

  const previousMonthAvg = new Map<string, number>();
  expenses
    .filter(tx => {
      const date = new Date(tx.date);
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
      return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
    })
    .forEach(tx => {
      previousMonthAvg.set(tx.category, (previousMonthAvg.get(tx.category) || 0) + Math.abs(tx.amount));
    });

  // Mudanza detection
  const servicesIncrease = ((currentMonth.get('Servicios y Utilidades') || 0) -
    (previousMonthAvg.get('Servicios y Utilidades') || 0)) /
    (previousMonthAvg.get('Servicios y Utilidades') || 1);

  const transportIncrease = ((currentMonth.get('Transporte') || 0) -
    (previousMonthAvg.get('Transporte') || 0)) /
    (previousMonthAvg.get('Transporte') || 1);

  if (servicesIncrease > 0.3 && transportIncrease > 0.3) {
    trends.push({
      id: 'trend-mudanza',
      title: '🏠 Posible mudanza detectada',
      description: 'Tu gasto en servicios e transporte aumentó significativamente. Posibles escenarios: mudanza a nuevo domicilio, cambio de trabajo con mayor transporte.',
      confidence: 0.75,
      indicators: [
        `Servicios: +${(servicesIncrease * 100).toFixed(0)}%`,
        `Transporte: +${(transportIncrease * 100).toFixed(0)}%`,
      ],
      potentialAnnualSavings: 0,
    });
  }

  // Relación detection (aumento en entretenimiento + comida)
  const entertainmentIncrease = ((currentMonth.get('Entretenimiento') || 0) -
    (previousMonthAvg.get('Entretenimiento') || 0)) /
    (previousMonthAvg.get('Entretenimiento') || 1);

  const foodIncrease = ((currentMonth.get('Alimentación') || 0) -
    (previousMonthAvg.get('Alimentación') || 0)) /
    (previousMonthAvg.get('Alimentación') || 1);

  if (entertainmentIncrease > 0.4 && foodIncrease > 0.3) {
    trends.push({
      id: 'trend-relacion',
      title: '💑 Aumento en gastos sociales',
      description: 'Tu gasto en entretenimiento y comida aumentó. Posible: nueva relación, más vida social, cambio de estilo de vida.',
      confidence: 0.65,
      indicators: [
        `Entretenimiento: +${(entertainmentIncrease * 100).toFixed(0)}%`,
        `Alimentación: +${(foodIncrease * 100).toFixed(0)}%`,
      ],
      potentialAnnualSavings: 0,
    });
  }

  // Bienestar detection (aumento en salud + deportes)
  const healthIncrease = ((currentMonth.get('Salud') || 0) -
    (previousMonthAvg.get('Salud') || 0)) /
    (previousMonthAvg.get('Salud') || 1);

  if (healthIncrease > 0.5) {
    trends.push({
      id: 'trend-salud',
      title: '🏃 Inversión en salud',
      description: 'Tu gasto en salud y bienestar aumentó. Posible: gimnasio nuevo, tratamiento médico, inversión en bienestar.',
      confidence: 0.8,
      indicators: [`Salud: +${(healthIncrease * 100).toFixed(0)}%`],
      potentialAnnualSavings: 0,
    });
  }

  return trends.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Calcula perfil comportamental
 */
export function calculateBehavioralProfile(transactions: Transaction[]): BehavioralProfile {
  const expenses = transactions.filter(t => t.type === 'expense');

  if (expenses.length === 0) {
    return {
      spendingType: 'moderate',
      topCategories: [],
      weekdayBias: 'balanced',
      seasonal: false,
      consistency: 0,
    };
  }

  // Gasto tipo
  const total = expenses.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const average = total / expenses.length;
  const highSpends = expenses.filter(tx => Math.abs(tx.amount) > average * 2).length;
  const spendingType: 'conservative' | 'moderate' | 'aggressive' =
    highSpends > expenses.length * 0.3 ? 'aggressive' :
    highSpends < expenses.length * 0.1 ? 'conservative' :
    'moderate';

  // Top categorías
  const byCategory = new Map<string, number>();
  expenses.forEach(tx => {
    byCategory.set(tx.category, (byCategory.get(tx.category) || 0) + Math.abs(tx.amount));
  });

  const topCategories = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, amount]) => ({
      category: cat,
      percentage: (amount / total) * 100,
    }));

  // Bias weekday vs weekend
  const weekdaySpend = expenses.filter(tx => {
    const day = new Date(tx.date).getDay();
    return day >= 1 && day <= 5;
  }).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const weekendSpend = expenses.filter(tx => {
    const day = new Date(tx.date).getDay();
    return day === 0 || day === 6;
  }).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const weekdayBias: 'weekday_heavy' | 'weekend_heavy' | 'balanced' =
    weekdaySpend > weekendSpend * 1.3 ? 'weekday_heavy' :
    weekendSpend > weekdaySpend * 1.3 ? 'weekend_heavy' :
    'balanced';

  // Consistency (desviación estándar de gastos diarios)
  const dailyTotals = new Map<string, number>();
  expenses.forEach(tx => {
    const date = new Date(tx.date).toISOString().split('T')[0];
    dailyTotals.set(date, (dailyTotals.get(date) || 0) + Math.abs(tx.amount));
  });

  const daily = Array.from(dailyTotals.values());
  const dailyAvg = daily.reduce((a, b) => a + b, 0) / daily.length;
  const dailyVariance = daily.reduce((sum, val) => sum + Math.pow(val - dailyAvg, 2), 0) / daily.length;
  const dailyStdDev = Math.sqrt(dailyVariance);
  const consistency = Math.max(0, 1 - (dailyStdDev / dailyAvg)); // 0-1, inverso de variación

  // Seasonal (comparar por mes)
  const byMonth = new Map<number, number>();
  expenses.forEach(tx => {
    const month = new Date(tx.date).getMonth();
    byMonth.set(month, (byMonth.get(month) || 0) + Math.abs(tx.amount));
  });

  const monthlyAmounts = Array.from(byMonth.values());
  const monthlyAvg = monthlyAmounts.reduce((a, b) => a + b, 0) / monthlyAmounts.length;
  const monthlyVariance = monthlyAmounts.reduce((sum, val) => sum + Math.pow(val - monthlyAvg, 2), 0) / monthlyAmounts.length;
  const monthlyStdDev = Math.sqrt(monthlyVariance);
  const seasonal = (monthlyStdDev / monthlyAvg) > 0.2; // >20% variación = seasonal

  return {
    spendingType,
    topCategories,
    weekdayBias,
    seasonal,
    consistency,
  };
}

/**
 * Genera narración del perfil
 */
export function generateProfileNarrative(profile: BehavioralProfile): string {
  let narrative = '👤 TU PERFIL FINANCIERO:\n\n';

  narrative += `Tipo de gasto: ${
    profile.spendingType === 'aggressive' ? '💸 Agresivo - Te gusta vivir bien' :
    profile.spendingType === 'conservative' ? '🏦 Conservador - Cuidadoso con gastos' :
    '⚖️ Moderado - Equilibrado'
  }\n\n`;

  narrative += `Categorías principales:\n`;
  profile.topCategories.forEach(cat => {
    narrative += `- ${cat.category}: ${cat.percentage.toFixed(0)}%\n`;
  });
  narrative += '\n';

  narrative += `Patrón semanal: ${
    profile.weekdayBias === 'weekday_heavy' ? '💼 Gastas más entre semana (trabajo)' :
    profile.weekdayBias === 'weekend_heavy' ? '🎉 Gastas más los fines de semana' :
    '➡️ Gastos balanceados'
  }\n\n`;

  if (profile.seasonal) {
    narrative += '📊 Patrón SEASONAL: Tus gastos varían según la época del año\n';
  }

  narrative += `Consistencia: ${(profile.consistency * 100).toFixed(0)}% (${
    profile.consistency > 0.8 ? 'Muy consistente' :
    profile.consistency > 0.5 ? 'Moderadamente consistente' :
    'Variable'
  })\n`;

  return narrative;
}
