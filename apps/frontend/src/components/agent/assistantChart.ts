import { Category, Transaction } from '../../types';

export interface CategoryPoint {
  name: string;
  value: number;
  color: string;
}

export interface MonthlyPoint {
  month: string;
  ingresos: number;
  gastos: number;
}

export type AssistantChart =
  | { kind: 'category'; title: string; currency: 'UYU' | 'USD'; data: CategoryPoint[] }
  | { kind: 'monthly'; title: string; currency: 'UYU' | 'USD'; data: MonthlyPoint[] };

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const SHORT_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

function shouldChart(question: string): boolean {
  return /gr[aá]fic|chart|evoluci|tendenc|por categor|desglos|mes a mes|mensual|compar|rubro/.test(question);
}

function wantsCategory(question: string): boolean {
  return /categor|desglos|torta|rubro|en qu[eé] gast/.test(question);
}

function currencyOf(question: string): 'UYU' | 'USD' {
  return /d[oó]lar|usd/.test(question) ? 'USD' : 'UYU';
}

function mentionedMonth(question: string): number | null {
  const index = MONTHS.findIndex(name => new RegExp(`\\b${name}\\b`).test(question));
  return index >= 0 ? index : null;
}

function mentionedYear(question: string): number | null {
  const match = question.match(/20\d{2}/);
  return match ? Number(match[0]) : null;
}

function inRange(tx: Transaction, from: number, to: number): boolean {
  return tx.date >= from && tx.date <= to;
}

export function buildAssistantChart(
  question: string,
  transactions: Transaction[],
  categories: Category[]
): AssistantChart | null {
  const normalized = question.toLowerCase();
  if (!shouldChart(normalized)) return null;

  const currency = currencyOf(normalized);
  const now = new Date();
  const month = mentionedMonth(normalized);
  const year = mentionedYear(normalized) ?? now.getFullYear();
  const scoped = transactions.filter(tx => tx.currency === currency && tx.type !== 'transfer');

  if (wantsCategory(normalized)) {
    const from = month === null
      ? new Date(year, now.getMonth(), 1).getTime()
      : new Date(year, month, 1).getTime();
    const to = month === null
      ? new Date(year, now.getMonth() + 1, 0, 23, 59, 59, 999).getTime()
      : new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
    const periodLabel = month === null ? `${MONTHS[now.getMonth()]} ${year}` : `${MONTHS[month]} ${year}`;

    const totals = new Map<string, number>();
    scoped
      .filter(tx => tx.type === 'expense' && inRange(tx, from, to))
      .forEach(tx => {
        const name = categories.find(c => c.id === tx.category)?.name || 'Sin categoría';
        totals.set(name, (totals.get(name) || 0) + Math.abs(tx.amount));
      });

    const data = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value], index) => ({
        name,
        value: Math.round(value),
        color: categories.find(c => c.name === name)?.color || PALETTE[index % PALETTE.length],
      }));

    if (data.length === 0) return null;
    return {
      kind: 'category',
      title: `Gastos por categoría · ${periodLabel}`,
      currency,
      data,
    };
  }

  const points: MonthlyPoint[] = [];
  const span = month === null ? 6 : 12;
  const start = month === null
    ? new Date(now.getFullYear(), now.getMonth() - 5, 1)
    : new Date(year, 0, 1);

  for (let i = 0; i < span; i += 1) {
    const cursor = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const from = cursor.getTime();
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    const monthTx = scoped.filter(tx => inRange(tx, from, to));
    const ingresos = monthTx
      .filter(tx => tx.type === 'income')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const gastos = monthTx
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    points.push({
      month: `${SHORT_MONTHS[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`,
      ingresos: Math.round(ingresos),
      gastos: Math.round(gastos),
    });
  }

  const series = points;
  if (!series.some(point => point.ingresos > 0 || point.gastos > 0)) return null;

  return {
    kind: 'monthly',
    title: `Ingresos y gastos · ${year}`,
    currency,
    data: series,
  };
}
