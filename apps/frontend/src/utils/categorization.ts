import { Category, Transaction } from '../types';

/**
 * Motor de Categorización Mejorado con:
 * - Expresiones regulares para patrones complejos
 * - Tokenización avanzada
 * - Análisis de n-gramas
 * - Detección de entidades (números, fechas, códigos)
 * - Sistema de puntuación ponderado
 */

/**
 * Normaliza texto para comparación (lowercase, sin acentos, sin espacios extras)
 */
export const normalizeText = (text: string | undefined | null): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/\s+/g, ' ') // Normalizar espacios
    .trim();
};

/**
 * Tokeniza el texto en palabras significativas
 * Elimina stopwords y tokens muy cortos
 */
const tokenize = (text: string): string[] => {
  const stopwords = new Set([
    'de', 'la', 'el', 'en', 'y', 'a', 'los', 'del', 'las', 'por', 'un', 'una',
    'con', 'no', 'se', 'al', 'lo', 'como', 'mas', 'pero', 'sus', 'le', 'ya',
    'o', 'fue', 'este', 'ha', 'si', 'porque', 'esta', 'son', 'entre', 'cuando',
    'muy', 'sin', 'sobre', 'ser', 'tiene', 'tambien', 'me', 'hasta', 'hay',
    'donde', 'han', 'quien', 'estan', 'estado', 'desde', 'todo', 'nos', 'durante',
    'estados', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'fueron', 'ese',
    'eso', 'habia', 'sido', 'estar', 'estas', 'estaba', 'estamos', 'estan'
  ]);

  const normalized = normalizeText(text);
  
  // Separar por espacios y caracteres especiales, pero mantener números
  const tokens = normalized
    .split(/[\s\-_.,;:()[\]{}]+/)
    .filter(token => {
      // Mantener tokens de al menos 2 caracteres
      if (token.length < 2) return false;
      // Eliminar stopwords
      if (stopwords.has(token)) return false;
      // Mantener números y palabras
      return true;
    });

  return tokens;
};

/**
 * Genera n-gramas (secuencias de n palabras consecutivas)
 * Útil para detectar frases completas como "tarjeta de credito"
 */
const generateNGrams = (tokens: string[], n: number): string[] => {
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '));
  }
  return ngrams;
};

/**
 * Extrae entidades del texto (números, códigos, referencias)
 */
const extractEntities = (text: string): {
  numbers: string[];
  codes: string[];
  references: string[];
} => {
  const normalized = normalizeText(text);
  
  return {
    // Números (montos, cantidades)
    numbers: (normalized.match(/\d+(?:[.,]\d+)?/g) || []),
    // Códigos alfanuméricos (ej: REF123, COD456)
    codes: (normalized.match(/[a-z]{2,}\d{2,}/g) || []),
    // Referencias (ej: #123, REF-456)
    references: (normalized.match(/(?:ref|cod|id|num|nro)[:\-\s]*\d+/g) || [])
  };
};

/**
 * Verifica si un keyword coincide usando expresiones regulares
 * Soporta patrones como:
 * - "mercado*" (wildcard)
 * - "^uber" (inicio de palabra)
 * - "taxi$" (fin de palabra)
 * - "/\d{4}/" (regex explícita)
 */
const matchKeyword = (text: string, keyword: string): {
  matches: boolean;
  score: number;
  matchType: 'exact' | 'partial' | 'regex' | 'fuzzy';
} => {
  const normalizedText = normalizeText(text);
  const normalizedKeyword = normalizeText(keyword);

  // Regex explícita (entre //)
  if (normalizedKeyword.startsWith('/') && normalizedKeyword.endsWith('/')) {
    try {
      const pattern = normalizedKeyword.slice(1, -1);
      const regex = new RegExp(pattern, 'i');
      const matches = regex.test(normalizedText);
      return {
        matches,
        score: matches ? 15 + pattern.length : 0,
        matchType: 'regex'
      };
    } catch (e) {
      console.warn('Invalid regex pattern:', normalizedKeyword);
      return { matches: false, score: 0, matchType: 'regex' };
    }
  }

  // Wildcard (*)
  if (normalizedKeyword.includes('*')) {
    const pattern = normalizedKeyword
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\\\*/g, '.*'); // Convert * to .*
    const regex = new RegExp(pattern, 'i');
    const matches = regex.test(normalizedText);
    return {
      matches,
      score: matches ? 12 + normalizedKeyword.length : 0,
      matchType: 'partial'
    };
  }

  // Inicio de palabra (^)
  if (normalizedKeyword.startsWith('^')) {
    const pattern = normalizedKeyword.slice(1);
    const regex = new RegExp(`\\b${pattern}`, 'i');
    const matches = regex.test(normalizedText);
    return {
      matches,
      score: matches ? 13 + pattern.length : 0,
      matchType: 'partial'
    };
  }

  // Fin de palabra ($)
  if (normalizedKeyword.endsWith('$')) {
    const pattern = normalizedKeyword.slice(0, -1);
    const regex = new RegExp(`${pattern}\\b`, 'i');
    const matches = regex.test(normalizedText);
    return {
      matches,
      score: matches ? 13 + pattern.length : 0,
      matchType: 'partial'
    };
  }

  // Match exacto de palabra completa
  const wordBoundaryRegex = new RegExp(`\\b${normalizedKeyword}\\b`, 'i');
  if (wordBoundaryRegex.test(normalizedText)) {
    return {
      matches: true,
      score: 20 + normalizedKeyword.length,
      matchType: 'exact'
    };
  }

  // Match parcial (substring)
  if (normalizedText.includes(normalizedKeyword)) {
    return {
      matches: true,
      score: 8 + normalizedKeyword.length,
      matchType: 'partial'
    };
  }

  // Fuzzy match (similitud de Levenshtein para palabras cortas)
  if (normalizedKeyword.length >= 4) {
    const tokens = tokenize(normalizedText);
    for (const token of tokens) {
      const similarity = calculateLevenshteinSimilarity(token, normalizedKeyword);
      if (similarity > 0.85) {
        return {
          matches: true,
          score: Math.floor(10 * similarity) + normalizedKeyword.length,
          matchType: 'fuzzy'
        };
      }
    }
  }

  return { matches: false, score: 0, matchType: 'exact' };
};

/**
 * Calcula similitud de Levenshtein (distancia de edición)
 */
const calculateLevenshteinSimilarity = (str1: string, str2: string): number => {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - distance / maxLen;
};

export interface KeywordMatchInfo {
  keyword: string;
  source: 'category';
  sourceName: string;
  categoryId: string;
  matchType: 'exact' | 'partial' | 'regex' | 'fuzzy';
  score: number;
}

export interface CategorizationResult {
  categoryId: string;
  confidence: number;
  matchedKeywords: KeywordMatchInfo[];
}

/**
 * Categoriza una transacción usando el motor mejorado
 */
export const categorizeTransaction = (
  description: string,
  categories: Category[]
): CategorizationResult | null => {
  const normalizedDesc = normalizeText(description);
  const tokens = tokenize(description);
  const bigrams = generateNGrams(tokens, 2);
  const trigrams = generateNGrams(tokens, 3);

  interface Match {
    categoryId: string;
    score: number;
    matchedKeywords: KeywordMatchInfo[];
  }

  const matches: Match[] = [];

  for (const category of categories) {
    let categoryScore = 0;
    const matchedKeywords: KeywordMatchInfo[] = [];

    if (category.keywords && Array.isArray(category.keywords)) {
      for (const keyword of category.keywords) {
        const result = matchKeyword(normalizedDesc, keyword);
        if (result.matches) {
          categoryScore += result.score;
          if (!matchedKeywords.some(m => m.keyword === keyword)) {
            matchedKeywords.push({
              keyword,
              source: 'category',
              sourceName: category.name,
              categoryId: category.id,
              matchType: result.matchType,
              score: result.score,
            });
          }
          continue;
        }

        for (const ngram of [...bigrams, ...trigrams]) {
          const ngramResult = matchKeyword(ngram, keyword);
          if (ngramResult.matches) {
            const score = ngramResult.score * 0.8;
            categoryScore += score;
            if (!matchedKeywords.some(m => m.keyword === keyword)) {
              matchedKeywords.push({
                keyword,
                source: 'category',
                sourceName: category.name,
                categoryId: category.id,
                matchType: ngramResult.matchType,
                score: Math.floor(score),
              });
            }
            break;
          }
        }
      }
    }

    if (categoryScore > 0) {
      matches.push({
        categoryId: category.id,
        score: categoryScore,
        matchedKeywords,
      });
    }
  }

  if (matches.length === 0) {
    return null;
  }

  matches.sort((a, b) => b.score - a.score);
  const bestMatch = matches[0];
  const confidence = Math.min(bestMatch.score / 150, 1);

  return {
    categoryId: bestMatch.categoryId,
    confidence,
    matchedKeywords: bestMatch.matchedKeywords.sort((a, b) => b.score - a.score),
  };
};

/**
 * Explica qué keywords de una categoría (o del mejor match) coinciden con la descripción.
 */
export const explainDescriptionMatch = (
  description: string,
  categories: Category[],
  preferredCategoryId?: string
): CategorizationResult | null => {
  const result = categorizeTransaction(description, categories);
  if (!result) return null;

  if (preferredCategoryId && preferredCategoryId !== result.categoryId) {
    const preferred = categories.find(c => c.id === preferredCategoryId);
    if (!preferred) return result;

    const normalizedDesc = normalizeText(description);
    const matchedKeywords: KeywordMatchInfo[] = [];

    for (const keyword of preferred.keywords || []) {
      const match = matchKeyword(normalizedDesc, keyword);
      if (match.matches) {
        matchedKeywords.push({
          keyword,
          source: 'category',
          sourceName: preferred.name,
          categoryId: preferred.id,
          matchType: match.matchType,
          score: match.score,
        });
      }
    }

    if (matchedKeywords.length === 0) return result;

    return {
      categoryId: preferredCategoryId,
      confidence: result.confidence,
      matchedKeywords: matchedKeywords.sort((a, b) => b.score - a.score),
    };
  }

  return result;
};

/**
 * Categoriza múltiples transacciones
 */
export const categorizeTransactions = (
  transactions: Partial<Transaction>[],
  categories: Category[]
): Partial<Transaction>[] => {
  return transactions.map(transaction => {
    if (!transaction.description) {
      return transaction;
    }

    const result = categorizeTransaction(transaction.description, categories);

    if (result && result.confidence >= 0.5) {
      // Solo auto-categorizar si la confianza es >= 50%
      return {
        ...transaction,
        category: result.categoryId,
        status: 'classified'
      };
    }

    return {
      ...transaction,
      status: 'pending' // Requiere clasificación manual
    };
  });
};

/**
 * Calcula el porcentaje de transacciones categorizadas automáticamente
 */
export const calculateCategorizationRate = (transactions: Transaction[]): number => {
  if (transactions.length === 0) return 0;

  const categorized = transactions.filter(t => t.status === 'classified').length;
  return (categorized / transactions.length) * 100;
};

/**
 * Obtiene las transacciones que requieren clasificación manual
 */
export const getPendingTransactions = (transactions: Transaction[]): Transaction[] => {
  return transactions.filter(t => t.status === 'pending');
};

/**
 * Sugiere categorías basándose en transacciones similares previas
 */
export const suggestCategory = (
  description: string,
  previousTransactions: Transaction[],
  categories: Category[]
): { categoryId: string; confidence: number } | null => {
  const tokens = tokenize(description);

  // Buscar transacciones similares que ya estén categorizadas
  const similarTransactions = previousTransactions
    .filter(t => t.status === 'classified' && t.category)
    .map(t => ({
      transaction: t,
      similarity: calculateAdvancedSimilarity(tokens, tokenize(t.description))
    }))
    .filter(item => item.similarity > 0.6) // Umbral de similitud
    .sort((a, b) => b.similarity - a.similarity);

  if (similarTransactions.length === 0) {
    return null;
  }

  // Usar la categoría de la transacción más similar
  const mostSimilar = similarTransactions[0];
  return {
    categoryId: mostSimilar.transaction.category!,
    confidence: mostSimilar.similarity
  };
};

/**
 * Calcula similitud avanzada usando Jaccard + n-gramas
 */
const calculateAdvancedSimilarity = (tokens1: string[], tokens2: string[]): number => {
  // Similitud de Jaccard para tokens
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  const jaccardSimilarity = intersection.size / union.size;

  // Similitud de n-gramas
  const bigrams1 = new Set(generateNGrams(tokens1, 2));
  const bigrams2 = new Set(generateNGrams(tokens2, 2));
  const bigramIntersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));
  const bigramUnion = new Set([...bigrams1, ...bigrams2]);
  const bigramSimilarity = bigramUnion.size > 0 ? bigramIntersection.size / bigramUnion.size : 0;

  // Promedio ponderado (60% Jaccard, 40% bigrams)
  return jaccardSimilarity * 0.6 + bigramSimilarity * 0.4;
};

/**
 * Aprende de las clasificaciones manuales del usuario
 * Retorna keywords sugeridas para agregar a las categorías
 */
export const learnFromManualClassification = (
  transaction: Transaction,
  category: Category
): string[] => {
  if (!transaction.description) return [];

  const tokens = tokenize(transaction.description);
  const bigrams = generateNGrams(tokens, 2);
  const entities = extractEntities(transaction.description);

  const candidates = [
    ...tokens.filter(t => t.length >= 3),
    ...bigrams,
    ...entities.codes,
  ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0);

  const allKeywords = (category.keywords ?? []).filter(
    (keyword): keyword is string => typeof keyword === 'string' && keyword.length > 0
  );

  const newKeywords = candidates.filter(candidate => {
    return !allKeywords.some(keyword => {
      const normalizedKeyword = normalizeText(keyword);
      const normalizedCandidate = normalizeText(candidate);
      if (!normalizedKeyword || !normalizedCandidate) return false;
      return normalizedKeyword.includes(normalizedCandidate) ||
             normalizedCandidate.includes(normalizedKeyword);
    });
  });

  // Retornar los 5 mejores candidatos (más largos = más específicos)
  return newKeywords
    .sort((a, b) => b.length - a.length)
    .slice(0, 5);
};

// Made with Bob
