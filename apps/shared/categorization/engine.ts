/**
 * FASE 07C2 - Motor de Categorización Compartido
 * 
 * Motor PURO de categorización reutilizable en frontend Y backend.
 * 
 * SIN CAMBIOS en:
 * - rules threshold = 0.5
 * - keywords
 * - regex
 * - fuzzy matching
 * - scoring
 * - normalización funcional
 * 
 * Exporta funciones determinísticas para ambas plataformas.
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
export const tokenize = (text: string): string[] => {
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
export const generateNGrams = (tokens: string[], n: number): string[] => {
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '));
  }
  return ngrams;
};

/**
 * Calcula similitud de Levenshtein (distancia de edición)
 */
export const calculateLevenshteinSimilarity = (str1: string, str2: string): number => {
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
 * Verifica si un keyword coincide usando expresiones regulares
 * Soporta patrones como:
 * - "mercado*" (wildcard)
 * - "^uber" (inicio de palabra)
 * - "taxi$" (fin de palabra)
 * - "/\d{4}/" (regex explícita)
 */
export const matchKeyword = (text: string, keyword: string): {
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
 * Categoriza una transacción usando el motor mejorado
 * 
 * THRESHOLD: confidence >= 0.5 para ser considerada válida
 */
export const categorizeTransaction = (
  description: string,
  categories: any[]
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

export default {
  normalizeText,
  tokenize,
  generateNGrams,
  calculateLevenshteinSimilarity,
  matchKeyword,
  categorizeTransaction,
};
