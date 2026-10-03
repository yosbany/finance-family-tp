/**
 * FASE 07C2 - Execute Pipeline on Real Transactions
 * 
 * USAGE:
 *   npm run phase07c2:test
 * 
 * REQUIRES:
 *   - transactions-real.json in project root (from export-transactions-real.js)
 * 
 * OUTPUTS:
 *   - Console: funnel statistics
 *   - File: FASE_07C2_RESULTS.json (detailed results)
 */

import * as fs from 'fs';
import * as path from 'path';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: number;
  type: string;
  currency: string;
  category?: string;
  status: 'pending' | 'classified';
}

interface ClassificationSuggestion {
  transactionId: string;
  suggestedCategoryId: string | null;
  source: 'rules' | 'historical_exact' | 'historical_consensus' | 'agent' | 'none';
  confidence: number;
  reason: string;
  metadata?: any;
}

interface FunnelStats {
  total: number;
  historical_exact: number;
  historical_consensus: number;
  none: number;
}

// Core pipeline functions (same as service.ts)

function normalizeMerchant(description: string): string {
  if (!description) return '';

  let normalized = description.toUpperCase().trim();

  const prefixes = ['REDIVA', 'COMPRA', 'PAGO', 'TRANSFERENCIA', 'TRF', 'TRA'];
  for (const prefix of prefixes) {
    const regex = new RegExp(`^${prefix}\\s+\\d*\\s*`, 'i');
    normalized = normalized.replace(regex, '').trim();
  }

  normalized = normalized.replace(/^\d+\s*/, '').trim();
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

async function suggestFromHistoricalExact(
  transaction: Transaction,
  historicalTransactions: Transaction[]
): Promise<ClassificationSuggestion | null> {
  const merchantNorm = normalizeMerchant(transaction.description);
  
  if (!merchantNorm) return null;

  const matches = historicalTransactions.filter(tx => {
    const txMerchantNorm = normalizeMerchant(tx.description);
    return txMerchantNorm === merchantNorm;
  });

  if (matches.length === 0) return null;

  const categories = new Set(matches.map(m => m.category).filter(c => c));
  
  if (categories.size === 1) {
    const categoryId = [...categories][0];
    return {
      transactionId: transaction.id,
      suggestedCategoryId: categoryId,
      source: 'historical_exact',
      confidence: 1.0,
      reason: `Comercio coincide exactamente con ${matches.length} transacción(es) anterior(es), todas categorizadas como "${categoryId}".`,
      metadata: {
        merchantNormalized: merchantNorm,
        sampleSize: matches.length,
      }
    };
  }

  return null;
}

async function suggestFromHistoricalConsensus(
  transaction: Transaction,
  historicalTransactions: Transaction[]
): Promise<ClassificationSuggestion | null> {
  const merchantNorm = normalizeMerchant(transaction.description);
  
  if (!merchantNorm) return null;

  const matches = historicalTransactions.filter(tx => {
    const txMerchantNorm = normalizeMerchant(tx.description);
    return txMerchantNorm === merchantNorm;
  });

  if (matches.length < 2) return null;

  const categoryCounts = new Map<string, number>();
  matches.forEach(m => {
    if (m.category) {
      categoryCounts.set(m.category, (categoryCounts.get(m.category) || 0) + 1);
    }
  });

  if (categoryCounts.size === 0) return null;

  let maxCategory = '';
  let maxCount = 0;
  for (const [cat, count] of categoryCounts) {
    if (count > maxCount) {
      maxCategory = cat;
      maxCount = count;
    }
  }

  if (!maxCategory) return null;

  const consensus = maxCount / matches.length;
  
  if (consensus > 0.5) {
    return {
      transactionId: transaction.id,
      suggestedCategoryId: maxCategory,
      source: 'historical_consensus',
      confidence: consensus,
      reason: `Comercio aparece en ${matches.length} transacción(es) anterior(es). ${maxCount} de ellas están categorizadas como "${maxCategory}" (${(consensus * 100).toFixed(0)}%).`,
      metadata: {
        merchantNormalized: merchantNorm,
        sampleSize: matches.length,
        consensusPercentage: Math.round(consensus * 100),
      }
    };
  }

  return null;
}

async function generateSuggestion(
  transactionId: string,
  transaction: Transaction,
  allTransactions: Transaction[]
): Promise<ClassificationSuggestion> {
  const categorized = allTransactions.filter(
    t => t.category && t.status !== 'pending' && t.id !== transactionId
  );

  if (categorized.length === 0) {
    return {
      transactionId,
      suggestedCategoryId: null,
      source: 'none',
      confidence: 0,
      reason: 'Sin historial de transacciones categorizadas para comparar.'
    };
  }

  // 1. EXACT
  const exactSuggestion = await suggestFromHistoricalExact(transaction, categorized);
  if (exactSuggestion) return exactSuggestion;

  // 2. CONSENSUS
  const consensusSuggestion = await suggestFromHistoricalConsensus(transaction, categorized);
  if (consensusSuggestion) return consensusSuggestion;

  // 3. NONE
  return {
    transactionId,
    suggestedCategoryId: null,
    source: 'none',
    confidence: 0,
    reason: 'No se encontró patrón histórico consistente para esta transacción. Requiere revisión manual o clasificación con reglas.'
  };
}

async function runPipeline() {
  console.log('═'.repeat(80));
  console.log('FASE 07C2 - PIPELINE REAL');
  console.log('═'.repeat(80));
  console.log('');

  const dataPath = path.join(process.cwd(), 'transactions-real.json');
  
  if (!fs.existsSync(dataPath)) {
    console.error(`ERROR: ${dataPath} not found`);
    console.error('');
    console.error('Please run first:');
    console.error('  export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"');
    console.error('  node scripts/export-transactions-real.js');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const allTransactions: Transaction[] = data.transactions;

  const pending = allTransactions.filter(t => t.status === 'pending');
  const classified = allTransactions.filter(t => t.status === 'classified');

  console.log('📊 DATASET');
  console.log('─'.repeat(80));
  console.log(`  Total: ${allTransactions.length}`);
  console.log(`  Classified: ${classified.length}`);
  console.log(`  Pending: ${pending.length}`);
  console.log(`  Categories: ${data.dataset.categories}`);
  console.log('');

  const funnel: FunnelStats = {
    total: pending.length,
    historical_exact: 0,
    historical_consensus: 0,
    none: 0,
  };

  const results: ClassificationSuggestion[] = [];

  console.log(`🔄 Processing ${pending.length} pending transactions...`);
  console.log('');

  for (const tx of pending) {
    const suggestion = await generateSuggestion(tx.id, tx, allTransactions);
    results.push(suggestion);
    funnel[suggestion.source as keyof typeof funnel]++;
  }

  // Funnel report
  console.log('📈 FUNNEL REAL');
  console.log('─'.repeat(80));
  console.log(`  ${funnel.total} pendientes`);
  console.log(`  ├─ ${funnel.historical_exact} HISTORICAL_EXACT`);
  console.log(`  ├─ ${funnel.historical_consensus} HISTORICAL_CONSENSUS`);
  console.log(`  └─ ${funnel.none} NONE (sin sugerencia)`);
  console.log('');

  const resolved = funnel.historical_exact + funnel.historical_consensus;
  const percentResolved = ((resolved / funnel.total) * 100).toFixed(1);
  
  console.log('📊 MÉTRICAS');
  console.log('─'.repeat(80));
  console.log(`  Resueltas: ${resolved}/${funnel.total} (${percentResolved}%)`);
  console.log(`  Sin sugerencia: ${funnel.none}/${funnel.total} (${((funnel.none / funnel.total) * 100).toFixed(1)}%)`);
  console.log('');

  // Analysis of NONE
  const noneResults = results.filter(r => r.source === 'none');
  if (noneResults.length > 0) {
    console.log('📋 RESTANTES SIN SUGERENCIA');
    console.log('─'.repeat(80));
    const restantes = pending.filter(p => noneResults.some(n => n.transactionId === p.id));
    
    console.log(`  Total: ${restantes.length}`);
    console.log('  Ejemplos:');
    restantes.slice(0, 5).forEach((tx, idx) => {
      console.log(`    ${idx + 1}. "${tx.description}" (${tx.amount} ${tx.currency})`);
    });
    if (restantes.length > 5) {
      console.log(`    ... y ${restantes.length - 5} más`);
    }
    console.log('');
  }

  // Save detailed results
  const outputPath = path.join(process.cwd(), 'FASE_07C2_RESULTS.json');
  const reportData = {
    timestamp: new Date().toISOString(),
    dataset: data.dataset,
    funnel,
    results,
    analysis: {
      historicalExactExamples: results
        .filter(r => r.source === 'historical_exact')
        .slice(0, 3),
      historicalConsensusExamples: results
        .filter(r => r.source === 'historical_consensus')
        .slice(0, 3),
      noneExamples: results
        .filter(r => r.source === 'none')
        .slice(0, 5)
    }
  };

  fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2));

  console.log('✅ RESULTS');
  console.log('─'.repeat(80));
  console.log(`  Saved to: ${outputPath}`);
  console.log('');

  console.log('═'.repeat(80));
  console.log('FASE 07C2 PIPELINE COMPLETE');
  console.log('═'.repeat(80));
}

runPipeline().catch(e => {
  console.error('ERROR:', e);
  process.exit(1);
});
