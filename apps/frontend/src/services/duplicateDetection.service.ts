/**
 * Servicio de Detección de Duplicados
 * 
 * Identifica transacciones duplicadas usando:
 * - Matching exacto (monto + descripción + fecha)
 * - Fuzzy matching (semejanza de Levenshtein)
 * - Heurísticas temporales
 */

import { Transaction } from '../types';

export interface DuplicateGroup {
  primaryId: string;
  duplicates: Transaction[];
  confidence: number; // 0-1
  reason: string;
  suggestedAction: 'merge' | 'review' | 'ignore';
}

export interface DuplicateAnalysis {
  totalTransactions: number;
  duplicateGroups: DuplicateGroup[];
  potentialDuplicates: number;
  estimatedSavings: number;
}

function calendarDay(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function normalizeDescription(description: string): string {
  return description.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Cuotas de tarjeta: cada cuota es un cargo distinto, aunque el comercio y el monto coincidan. */
function isCreditInstallment(description: string): boolean {
  const text = description.toLowerCase();
  return /\bcuotas?\b/.test(text) || /\bcta\.?\s*\d+\s*\/\s*\d+/.test(text);
}

/**
 * Detecta transacciones duplicadas en un conjunto
 */
export function detectDuplicates(transactions: Transaction[]): DuplicateAnalysis {
  const duplicateGroups: DuplicateGroup[] = [];
  const processedIds = new Set<string>();

  // 1. Búsqueda de duplicados exactos y similares
  for (let i = 0; i < transactions.length; i++) {
    if (processedIds.has(transactions[i].id)) continue;

    const tx = transactions[i];
    const candidates: Array<{ tx: Transaction; similarity: number; reason: string }> = [];

    for (let j = i + 1; j < transactions.length; j++) {
      if (processedIds.has(transactions[j].id)) continue;

      const otherTx = transactions[j];

      // Filtro 1: Misma cuenta
      if (tx.accountId !== otherTx.accountId) continue;

      // Filtro 2: Mismo tipo de transacción
      if (tx.type !== otherTx.type) continue;

      // Filtro 3: Misma moneda
      if (tx.currency !== otherTx.currency) continue;

      if (isCreditInstallment(tx.description) || isCreditInstallment(otherTx.description)) continue;

      const amountDiff = Math.abs(tx.amount - otherTx.amount);
      if (amountDiff > 0.009) continue;

      if (calendarDay(tx.date) !== calendarDay(otherTx.date)) continue;

      const sameDescription = normalizeDescription(tx.description) === normalizeDescription(otherTx.description);
      if (!sameDescription) continue;

      candidates.push({
        tx: otherTx,
        similarity: 1,
        reason: 'Mismo día, misma cuenta, mismo monto y misma descripción'
      });
    }

    // Si encontramos candidatos, crear grupo
    if (candidates.length > 0) {
      candidates.forEach(c => processedIds.add(c.tx.id));
      processedIds.add(tx.id);

      const avgSimilarity = candidates.reduce((sum, c) => sum + c.similarity, 0) / candidates.length;
      const confidence = Math.min(avgSimilarity, 0.99);
      const suggestedAction: 'merge' | 'review' | 'ignore' =
        confidence > 0.95 ? 'merge' :
        confidence > 0.85 ? 'review' : 'ignore';

      duplicateGroups.push({
        primaryId: tx.id,
        duplicates: candidates.map(c => c.tx),
        confidence,
        reason: candidates[0].reason,
        suggestedAction
      });
    }
  }

  // 2. Calcular ahorros potenciales (si se fusionan)
  const estimatedSavings = duplicateGroups.reduce((sum, group) => {
    return sum + (group.duplicates.length * Math.abs(group.duplicates[0].amount));
  }, 0);

  const potentialDuplicates = duplicateGroups.reduce((sum, group) => {
    return sum + group.duplicates.length;
  }, 0);

  return {
    totalTransactions: transactions.length,
    duplicateGroups,
    potentialDuplicates,
    estimatedSavings
  };
}

/**
 * Fusiona dos transacciones en una
 */
export function mergeDuplicates(
  primary: Transaction,
  duplicates: Transaction[]
): Transaction {
  // Mantener la más antigua como referencia temporal
  const dates = [primary.date, ...duplicates.map(d => d.date)];
  const earliestDate = Math.min(...dates);

  // Combinar descripciones únicas
  const descriptions = [primary.description, ...duplicates.map(d => d.description)];
  const uniqueDesc = [...new Set(descriptions)].join(' | ');

  return {
    ...primary,
    date: earliestDate,
    description: uniqueDesc
  };
}

/**
 * Obtiene transacciones marcadas como duplicadas
 */
export function getPotentialDuplicates(
  transactions: Transaction[],
  minConfidence: number = 0.85
): DuplicateGroup[] {
  const analysis = detectDuplicates(transactions);
  return analysis.duplicateGroups.filter(g => g.confidence >= minConfidence);
}

/**
 * Genera reporte de duplicados
 */
export function generateDuplicateReport(analysis: DuplicateAnalysis) {
  return {
    summary: {
      total: analysis.totalTransactions,
      potentialDuplicates: analysis.potentialDuplicates,
      duplicateRate: ((analysis.potentialDuplicates / analysis.totalTransactions) * 100).toFixed(2) + '%',
      estimatedSavings: analysis.estimatedSavings
    },
    groups: analysis.duplicateGroups.map(g => ({
      primary: g.primaryId,
      count: g.duplicates.length,
      confidence: (g.confidence * 100).toFixed(0) + '%',
      action: g.suggestedAction,
      reason: g.reason
    }))
  };
}

export default {
  detectDuplicates,
  mergeDuplicates,
  getPotentialDuplicates,
  generateDuplicateReport
};
