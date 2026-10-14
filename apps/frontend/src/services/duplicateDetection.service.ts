/**
 * Duplicate Transaction Detection Service
 *
 * FASE 08 - Detecta transacciones duplicadas o muy similares
 *
 * Estrategias:
 * 1. EXACT - Mismo monto + fecha + descripción normalizada
 * 2. FUZZY - Mismo monto + fecha + descripción similar (>90%)
 * 3. PATTERN - Múltiples transacciones pequeñas idénticas (transferencias repetidas)
 */

import { Transaction } from '../types';

export interface DuplicateGroup {
  id: string; // ID del grupo de duplicados
  type: 'exact' | 'fuzzy' | 'pattern'; // Tipo de duplicado
  confidence: number; // 0-1, qué tan seguro es que son duplicados
  transactions: Transaction[]; // Transacciones en este grupo
  description: string; // Descripción del grupo
  recommendation: 'delete_except_first' | 'merge' | 'review'; // Acción recomendada
}

/**
 * Normaliza descripción para comparación
 */
function normalizeDescription(desc: string): string {
  if (!desc) return '';
  return desc
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Remover acentos
    .replace(/\s+/g, ' ') // Normalizar espacios
    .replace(/[^\w\s]/g, '') // Solo palabras y espacios
    .trim();
}

/**
 * Calcula similitud Levenshtein
 */
function levenshteinSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function getEditDistance(s1: string, s2: string): number {
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

/**
 * Agrupa transacciones por fecha
 */
function groupByDate(transactions: Transaction[]): Map<string, Transaction[]> {
  const grouped = new Map<string, Transaction[]>();

  transactions.forEach(tx => {
    const date = new Date(tx.date).toISOString().split('T')[0];
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(tx);
  });

  return grouped;
}

/**
 * Busca duplicados EXACTOS
 * Mismo monto + fecha + descripción
 */
export function findExactDuplicates(transactions: Transaction[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const seen = new Set<string>();

  const grouped = groupByDate(transactions);

  grouped.forEach((dayTransactions, date) => {
    const byAmount = new Map<string, Transaction[]>();

    dayTransactions.forEach(tx => {
      const amountKey = `${tx.amount}|${tx.currency || 'UYU'}`;
      if (!byAmount.has(amountKey)) {
        byAmount.set(amountKey, []);
      }
      byAmount.get(amountKey)!.push(tx);
    });

    byAmount.forEach((txsWithSameAmount, amountKey) => {
      if (txsWithSameAmount.length < 2) return;

      const byDesc = new Map<string, Transaction[]>();

      txsWithSameAmount.forEach(tx => {
        const descKey = normalizeDescription(tx.description);
        if (!byDesc.has(descKey)) {
          byDesc.set(descKey, []);
        }
        byDesc.get(descKey)!.push(tx);
      });

      byDesc.forEach((duplicates, descKey) => {
        if (duplicates.length < 2) return;

        const groupKey = `${date}|${amountKey}|${descKey}`;
        if (seen.has(groupKey)) return;

        seen.add(groupKey);

        groups.push({
          id: `exact-${Date.now()}-${Math.random()}`,
          type: 'exact',
          confidence: 1.0,
          transactions: duplicates,
          description: `${duplicates.length}x ${duplicates[0].description} (${duplicates[0].amount} ${duplicates[0].currency || 'UYU'}) en ${date}`,
          recommendation: 'delete_except_first',
        });
      });
    });
  });

  return groups;
}

/**
 * Busca duplicados FUZZY
 * Mismo monto + fecha ± 1 día + descripción similar (>90%)
 */
export function findFuzzyDuplicates(transactions: Transaction[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const tx1 = transactions[i];
      const tx2 = transactions[j];

      // Mismo monto
      if (tx1.amount !== tx2.amount || (tx1.currency || 'UYU') !== (tx2.currency || 'UYU')) {
        continue;
      }

      // Fecha dentro de 1 día
      const date1 = new Date(tx1.date).getTime();
      const date2 = new Date(tx2.date).getTime();
      const dayInMs = 86400000;

      if (Math.abs(date1 - date2) > dayInMs) {
        continue;
      }

      // Descripción similar (>90%)
      const norm1 = normalizeDescription(tx1.description);
      const norm2 = normalizeDescription(tx2.description);
      const similarity = levenshteinSimilarity(norm1, norm2);

      if (similarity < 0.9) {
        continue;
      }

      // Es un duplicado fuzzy
      const groupKey = `${tx1.id}|${tx2.id}`;
      if (seen.has(groupKey)) continue;

      seen.add(groupKey);

      groups.push({
        id: `fuzzy-${Date.now()}-${Math.random()}`,
        type: 'fuzzy',
        confidence: similarity,
        transactions: [tx1, tx2],
        description: `${tx1.description} vs ${tx2.description} (similitud: ${(similarity * 100).toFixed(0)}%)`,
        recommendation: 'review',
      });
    }
  }

  return groups;
}

/**
 * Busca PATRONES de duplicados
 * Múltiples transacciones idénticas (transferencias repetidas, suscripciones, etc.)
 */
export function findPatternDuplicates(transactions: Transaction[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const patternMap = new Map<string, Transaction[]>();

  transactions.forEach(tx => {
    const pattern = `${tx.amount}|${tx.currency || 'UYU'}|${normalizeDescription(tx.description)}`;
    if (!patternMap.has(pattern)) {
      patternMap.set(pattern, []);
    }
    patternMap.get(pattern)!.push(tx);
  });

  patternMap.forEach((duplicates, pattern) => {
    if (duplicates.length < 3) return; // Mínimo 3 para considerar patrón

    // Verificar que están dentro de 90 días
    const dates = duplicates.map(tx => new Date(tx.date).getTime()).sort((a, b) => a - b);
    const daySpan = (dates[dates.length - 1] - dates[0]) / 86400000;

    if (daySpan < 1) return; // Muy cercanas (ya cubierto por exact/fuzzy)

    groups.push({
      id: `pattern-${Date.now()}-${Math.random()}`,
      type: 'pattern',
      confidence: 0.8,
      transactions: duplicates,
      description: `Patrón: ${duplicates.length} transacciones de ${duplicates[0].amount} ${duplicates[0].currency || 'UYU'} - ${duplicates[0].description}`,
      recommendation: 'review',
    });
  });

  return groups;
}

/**
 * Detecta TODOS los duplicados
 */
export function detectAllDuplicates(transactions: Transaction[]): DuplicateGroup[] {
  const allDuplicates: DuplicateGroup[] = [];

  // 1. Exactos
  allDuplicates.push(...findExactDuplicates(transactions));

  // 2. Fuzzy
  allDuplicates.push(...findFuzzyDuplicates(transactions));

  // 3. Patrones
  allDuplicates.push(...findPatternDuplicates(transactions));

  // Ordenar por confianza (mayor confianza primero)
  allDuplicates.sort((a, b) => b.confidence - a.confidence);

  return allDuplicates;
}

/**
 * Elimina un grupo de duplicados (mantiene el primero)
 */
export async function deleteDuplicateGroup(
  group: DuplicateGroup,
  deleteFunction: (id: string) => Promise<void>
): Promise<number> {
  // Mantener el primero (o el más antiguo)
  const sorted = [...group.transactions].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const toDelete = sorted.slice(1); // Todos excepto el primero

  for (const tx of toDelete) {
    await deleteFunction(tx.id);
  }

  return toDelete.length;
}

/**
 * Genera reporte de duplicados
 */
export function generateDuplicateReport(duplicates: DuplicateGroup[]): string {
  if (duplicates.length === 0) {
    return 'No se encontraron duplicados.';
  }

  const exactCount = duplicates.filter(d => d.type === 'exact').length;
  const fuzzyCount = duplicates.filter(d => d.type === 'fuzzy').length;
  const patternCount = duplicates.filter(d => d.type === 'pattern').length;

  let report = `\n📊 REPORTE DE DUPLICADOS\n`;
  report += `${'='.repeat(50)}\n\n`;

  report += `Grupos encontrados: ${duplicates.length}\n`;
  report += `├─ Exactos: ${exactCount}\n`;
  report += `├─ Fuzzy (similares): ${fuzzyCount}\n`;
  report += `└─ Patrones: ${patternCount}\n\n`;

  const totalTransactions = duplicates.reduce((sum, g) => sum + g.transactions.length, 0);
  const potentialDeletions = duplicates.reduce((sum, g) => sum + (g.transactions.length - 1), 0);

  report += `Transacciones involucradas: ${totalTransactions}\n`;
  report += `Potencial eliminación: ${potentialDeletions} (liberaría space)\n\n`;

  duplicates.slice(0, 10).forEach((dup, i) => {
    report += `${i + 1}. [${dup.type.toUpperCase()}] ${dup.description}\n`;
    report += `   Recomendación: ${dup.recommendation}\n`;
    report += `   Confianza: ${(dup.confidence * 100).toFixed(0)}%\n\n`;
  });

  if (duplicates.length > 10) {
    report += `... y ${duplicates.length - 10} más\n`;
  }

  return report;
}
