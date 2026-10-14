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

/**
 * Calcula similitud de Levenshtein entre dos strings
 * Retorna valor 0-1 (1 = idéntico, 0 = completamente diferente)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const maxLen = Math.max(len1, len2);
  const distance = matrix[len1][len2];
  return 1 - distance / maxLen;
}

/**
 * Extrae palabras clave de descripción
 * Elimina stopwords y normaliza
 */
function extractKeywords(description: string): string[] {
  const stopwords = [
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'de', 'del', 'y', 'e', 'o', 'u', 'por', 'para', 'en', 'con'
  ];

  return description
    .toLowerCase()
    .replace(/[^a-záéíóú\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopwords.includes(word));
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

      // Filtro 4: Monto similar (dentro del 1%)
      const amountDiff = Math.abs(tx.amount - otherTx.amount);
      const amountThreshold = Math.max(Math.abs(tx.amount), Math.abs(otherTx.amount)) * 0.01;
      if (amountDiff > amountThreshold) continue;

      // Filtro 5: Dentro de 24 horas
      const timeDiff = Math.abs(tx.date - otherTx.date);
      const oneDay = 24 * 60 * 60 * 1000;
      if (timeDiff > oneDay) continue;

      // Ahora calculamos similitud de descripción
      const descSimilarity = calculateStringSimilarity(tx.description, otherTx.description);

      // Heurística: si descripción es >80% similar, es probablemente un duplicado
      if (descSimilarity > 0.8) {
        candidates.push({
          tx: otherTx,
          similarity: descSimilarity,
          reason: `Descripción ${Math.round(descSimilarity * 100)}% similar`
        });
      }

      // Heurística 2: descripción exacta + monto exacto = duplicado seguro
      if (tx.description === otherTx.description && amountDiff < 0.01) {
        candidates.push({
          tx: otherTx,
          similarity: 1.0,
          reason: 'Descripción y monto idénticos'
        });
      }
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
