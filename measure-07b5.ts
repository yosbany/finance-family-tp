/**
 * FASE 07B5 - SCRIPT DE MEDICIÓN REAL
 * 
 * Uso:
 * 1. Copiar este código a la consola del navegador en la app de producción
 * 2. O compilar + ejecutar con node/tsx
 * 
 * IMPORTANTE: READ-ONLY / DRY-RUN
 * - NO modifica datos
 * - NO ejecuta re-categorización persistente
 * - Solo captura métricas
 */

import { getDatabase, ref, get } from 'firebase/database';
import { categorizeTransaction, suggestCategory, normalizeText, tokenize } from './apps/frontend/src/utils/categorization';
import type { Transaction, Category } from './apps/frontend/src/types';

interface MeasurementResult {
  dataset: {
    totalTransactions: number;
    totalCategories: number;
    periods: Record<string, number>;
  };
  baseline: {
    categorized: number;
    pending: number;
  };
  bySource: {
    rules: number;
    history: number;
    manual: number;
    agent: number;
    legacy: number;
  };
  byVerification: {
    verified: number;
    unverified: number;
  };
  pendingAnalysis: {
    total: number;
    uniquePatterns: number;
    repeatedPatterns: number;
    patterns: Array<{ pattern: string; occurrences: number }>;
  };
  rulesDryRun: {
    wouldClassify: number;
    wouldRemainPending: number;
    coverage: number;
    confidenceDistribution: {
      veryLow: number;
      low: number;
      medium: number;
      high: number;
    };
  };
  historySuggestion: {
    available: number;
    notAvailable: number;
    coverage: number;
  };
  semanticClassification: {
    repeatedRuleCandidate: number;
    semanticAgentCandidate: number;
    ambiguous: number;
    opaque: number;
  };
  keywordOpportunities: number;
  funnel: {
    total: number;
    categorized: number;
    pending: number;
    resolvableByRules: number;
    resolvableByHistory: number;
    resolvableByKeywords: number;
    resolvableByAgent: number;
    manualOnly: number;
  };
}

async function measure(): Promise<MeasurementResult> {
  const db = getDatabase();
  
  console.log('📊 FASE 07B5 - INICIANDO MEDICIÓN REAL');
  console.log('='.repeat(70));

  // 1. CARGAR DATOS
  console.log('\n1️⃣  Leyendo datos de Firebase...');
  
  const txRef = ref(db, 'family/transactions');
  const txSnapshot = await get(txRef);
  const transactions: Transaction[] = txSnapshot.exists()
    ? Object.entries(txSnapshot.val()).map(([id, data]) => ({ id, ...data } as Transaction))
    : [];

  const catRef = ref(db, 'family/categories');
  const catSnapshot = await get(catRef);
  const categories: Category[] = catSnapshot.exists()
    ? Object.entries(catSnapshot.val()).map(([id, data]) => ({ id, ...data } as Category))
    : [];

  console.log(`  ✅ ${transactions.length} transacciones`);
  console.log(`  ✅ ${categories.length} categorías`);

  // 2. BASELINE
  console.log('\n2️⃣  Calculando baseline...');
  const pending = transactions.filter(t => !t.category || t.status === 'pending');
  const categorized = transactions.filter(t => t.category && t.status !== 'pending');

  // 3. TEMPORAL DISTRIBUTION
  const periods: Record<string, number> = {};
  transactions.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    periods[key] = (periods[key] || 0) + 1;
  });

  // 4. SOURCE ANALYSIS
  const sources = {
    rules: categorized.filter(t => t.classificationSource === 'rules').length,
    history: categorized.filter(t => t.classificationSource === 'history').length,
    manual: categorized.filter(t => t.classificationSource === 'manual').length,
    agent: categorized.filter(t => t.classificationSource === 'agent').length,
    legacy: categorized.filter(t => !t.classificationSource).length,
  };

  // 5. VERIFICATION
  const verified = categorized.filter(t => t.classificationVerified === 'verified').length;
  const unverified = categorized.filter(t => t.classificationVerified === 'unverified').length;

  // 6. PENDING PATTERNS
  console.log('\n3️⃣  Analizando pendientes...');
  const merchantMap: Record<string, number> = {};
  pending.forEach(t => {
    const normalized = normalizeText(t.description).split(/\s+/)[0];
    merchantMap[normalized] = (merchantMap[normalized] || 0) + 1;
  });
  
  const repeatedPatterns = Object.entries(merchantMap)
    .filter(([_, count]) => count > 1)
    .map(([pattern, count]) => ({ pattern, occurrences: count }))
    .sort((a, b) => b.occurrences - a.occurrences);

  // 7. RULES DRY-RUN
  console.log('\n4️⃣  Ejecutando Rules DRY-RUN...');
  let rulesWouldClassify = 0;
  const confidenceDistribution = { veryLow: 0, low: 0, medium: 0, high: 0 };
  
  pending.forEach(t => {
    const result = categorizeTransaction(t.description, categories);
    if (result && result.confidence >= 0.5) {
      rulesWouldClassify++;
      if (result.confidence < 0.50) confidenceDistribution.veryLow++;
      else if (result.confidence < 0.75) confidenceDistribution.low++;
      else if (result.confidence < 0.90) confidenceDistribution.medium++;
      else confidenceDistribution.high++;
    }
  });

  // 8. HISTORY DRY-RUN
  console.log('\n5️⃣  Analizando History Suggestions...');
  let historySuggestionAvailable = 0;
  pending.forEach(t => {
    const suggestion = suggestCategory(t.description, categorized, categories);
    if (suggestion) historySuggestionAvailable++;
  });

  // 9. SEMANTIC CLASSIFICATION
  console.log('\n6️⃣  Clasificación semántica...');
  let repeatedRuleCandidate = 0;
  let semanticAgentCandidate = 0;
  let ambiguous = 0;
  let opaque = 0;

  const pendingNotResolved = pending.filter(t => {
    const rules = categorizeTransaction(t.description, categories);
    const history = suggestCategory(t.description, categorized, categories);
    return !rules && !history;
  });

  pendingNotResolved.forEach(t => {
    const normalized = normalizeText(t.description);
    const tokens = tokenize(t.description);
    
    // Check if repeated
    const merchant = tokens[0];
    const count = (merchantMap[merchant] || 0);
    
    if (count >= 3) {
      repeatedRuleCandidate++;
    } else if (tokens.length >= 2 && tokens.some(t => t.length > 4)) {
      semanticAgentCandidate++;
    } else if (tokens.length >= 1) {
      ambiguous++;
    } else {
      opaque++;
    }
  });

  // 10. KEYWORD OPPORTUNITIES
  const keywordOpportunities = repeatedPatterns.filter(
    p => !categories.some(c => c.keywords?.some(k => k.includes(p.pattern)))
  ).length;

  // 11. FUNNEL
  const result: MeasurementResult = {
    dataset: {
      totalTransactions: transactions.length,
      totalCategories: categories.length,
      periods,
    },
    baseline: {
      categorized: categorized.length,
      pending: pending.length,
    },
    bySource: sources,
    byVerification: { verified, unverified },
    pendingAnalysis: {
      total: pending.length,
      uniquePatterns: Object.keys(merchantMap).length,
      repeatedPatterns: repeatedPatterns.length,
      patterns: repeatedPatterns.slice(0, 10),
    },
    rulesDryRun: {
      wouldClassify: rulesWouldClassify,
      wouldRemainPending: pending.length - rulesWouldClassify,
      coverage: (rulesWouldClassify / pending.length) * 100,
      confidenceDistribution,
    },
    historySuggestion: {
      available: historySuggestionAvailable,
      notAvailable: pending.length - historySuggestionAvailable,
      coverage: (historySuggestionAvailable / pending.length) * 100,
    },
    semanticClassification: {
      repeatedRuleCandidate,
      semanticAgentCandidate,
      ambiguous,
      opaque,
    },
    keywordOpportunities,
    funnel: {
      total: transactions.length,
      categorized: categorized.length,
      pending: pending.length,
      resolvableByRules: rulesWouldClassify,
      resolvableByHistory: historySuggestionAvailable,
      resolvableByKeywords: keywordOpportunities,
      resolvableByAgent: semanticAgentCandidate,
      manualOnly: Math.max(0, pending.length - rulesWouldClassify - historySuggestionAvailable),
    },
  };

  // 12. REPORT
  console.log('\n📊 RESULTADOS:');
  console.log('='.repeat(70));
  console.table(result);
  
  return result;
}

// Export for use
export default measure;

// For direct execution in browser console:
if (typeof window !== 'undefined') {
  (window as any).measure07b5 = measure;
  console.log('✅ Función disponible como: measure07b5()');
}
