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
export declare const normalizeText: (text: string | undefined | null) => string;
/**
 * Tokeniza el texto en palabras significativas
 * Elimina stopwords y tokens muy cortos
 */
export declare const tokenize: (text: string) => string[];
/**
 * Genera n-gramas (secuencias de n palabras consecutivas)
 * Útil para detectar frases completas como "tarjeta de credito"
 */
export declare const generateNGrams: (tokens: string[], n: number) => string[];
/**
 * Calcula similitud de Levenshtein (distancia de edición)
 */
export declare const calculateLevenshteinSimilarity: (str1: string, str2: string) => number;
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
export declare const matchKeyword: (text: string, keyword: string) => {
    matches: boolean;
    score: number;
    matchType: "exact" | "partial" | "regex" | "fuzzy";
};
/**
 * Categoriza una transacción usando el motor mejorado
 *
 * THRESHOLD: confidence >= 0.5 para ser considerada válida
 */
export declare const categorizeTransaction: (description: string, categories: any[]) => CategorizationResult | null;
/**
 * Explica qué keywords de una categoría (o del mejor match) coinciden con la descripción.
 */
export declare const explainDescriptionMatch: (description: string, categories: any[], preferredCategoryId?: string) => CategorizationResult | null;
/**
 * Aprende de las clasificaciones manuales del usuario
 * Retorna keywords sugeridas para agregar a las categorías
 */
export declare const learnFromManualClassification: (transaction: any, category: any) => string[];
/**
 * Categoriza múltiples transacciones
 */
export declare const categorizeTransactions: (transactions: any[], categories: any[]) => any[];
/**
 * Calcula el porcentaje de transacciones categorizadas automáticamente
 */
export declare const calculateCategorizationRate: (transactions: any[]) => number;
/**
 * Obtiene las transacciones que requieren clasificación manual
 */
export declare const getPendingTransactions: (transactions: any[]) => any[];
/**
 * Sugiere categorías basándose en transacciones similares previas
 */
export declare const suggestCategory: (description: string, previousTransactions: any[], categories: any[]) => {
    categoryId: string;
    confidence: number;
} | null;
declare const _default: {
    normalizeText: (text: string | undefined | null) => string;
    tokenize: (text: string) => string[];
    generateNGrams: (tokens: string[], n: number) => string[];
    calculateLevenshteinSimilarity: (str1: string, str2: string) => number;
    matchKeyword: (text: string, keyword: string) => {
        matches: boolean;
        score: number;
        matchType: "exact" | "partial" | "regex" | "fuzzy";
    };
    categorizeTransaction: (description: string, categories: any[]) => CategorizationResult | null;
    explainDescriptionMatch: (description: string, categories: any[], preferredCategoryId?: string) => CategorizationResult | null;
    learnFromManualClassification: (transaction: any, category: any) => string[];
    categorizeTransactions: (transactions: any[], categories: any[]) => any[];
    calculateCategorizationRate: (transactions: any[]) => number;
    getPendingTransactions: (transactions: any[]) => any[];
    suggestCategory: (description: string, previousTransactions: any[], categories: any[]) => {
        categoryId: string;
        confidence: number;
    } | null;
};
export default _default;
//# sourceMappingURL=engine.d.ts.map