/**
 * FASE 07C2 - Real Execution Pipeline
 * 
 * Executes:
 * 1. Baseline metrics from Firebase
 * 2. Deterministic pipeline (RULES -> HISTORY_EXACT -> HISTORY_CONSENSUS)
 * 3. LLM pilot on max 10 candidates
 * 4. Final report
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Get service account from known location
const serviceAccountPath = process.env.FIREBASE_SA_PATH || '/etc/finance-family-api/firebase-service-account.json';
if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Service account not found at: ${serviceAccountPath}`);
  console.error('ERROR: Cannot access Firebase credentials');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://finance-family-88c2f-default-rtdb.firebaseio.com'
});

const db = admin.database();

// Import shared engine
import { 
  categorizeTransaction 
} from './apps/shared/categorization/engine.ts';

/**
 * Normalize merchant for historical matching
 */
function normalizeMerchant(description) {
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

/**
 * Main execution
 */
async function main() {
  try {
    console.log('='.repeat(60));
    console.log('FASE 07C2 - REAL EXECUTION');
    console.log('='.repeat(60));
    console.log();

    // STEP 1: Get baseline
    console.log('STEP 1: READING BASELINE...\n');
    
    const transactionsRef = db.ref('transactions');
    const transactionsSnapshot = await transactionsRef.once('value');
    const allTransactions = Object.entries(transactionsSnapshot.val() || {}).map(([id, data]) => ({
      id,
      ...data
    }));

    const categoriesRef = db.ref('categories');
    const categoriesSnapshot = await categoriesRef.once('value');
    const allCategories = Object.values(categoriesSnapshot.val() || {});

    const totalTransactions = allTransactions.length;
    const categorizedTransactions = allTransactions.filter(t => t.status !== 'pending').length;
    const pendingTransactions = allTransactions.filter(t => t.status === 'pending');
    const pendingCount = pendingTransactions.length;
    const categoryCount = allCategories.length;

    console.log(`Total Transactions: ${totalTransactions}`);
    console.log(`Categorized: ${categorizedTransactions}`);
    console.log(`Pending: ${pendingCount}`);
    console.log(`Categories: ${categoryCount}`);
    console.log();

    // STEP 2: Execute pipeline on pending
    console.log('STEP 2: EXECUTING PIPELINE...\n');

    const results = {
      rulesResolved: [],
      historicalExact: [],
      historicalConsensus: [],
      remaining: []
    };

    const categorized = allTransactions.filter(t => t.status !== 'pending');

    for (const tx of pendingTransactions) {
      let resolved = false;

      // RULES
      if (!resolved) {
        const ruleResult = categorizeTransaction(tx.description, allCategories);
        if (ruleResult && ruleResult.confidence >= 0.5) {
          results.rulesResolved.push({
            transactionId: tx.id,
            description: tx.description,
            merchant: tx.merchant,
            suggestedCategoryId: ruleResult.categoryId,
            source: 'RULES',
            confidence: ruleResult.confidence,
            matchedKeywords: ruleResult.matchedKeywords.map(k => k.keyword)
          });
          resolved = true;
        }
      }

      // HISTORICAL_EXACT
      if (!resolved) {
        const merchantNorm = normalizeMerchant(tx.description);
        const matches = categorized.filter(t => {
          return normalizeMerchant(t.description) === merchantNorm;
        });
        if (matches.length > 0) {
          const categories = new Set(matches.map(m => m.category).filter(c => c));
          if (categories.size === 1) {
            const categoryId = [...categories][0];
            results.historicalExact.push({
              transactionId: tx.id,
              description: tx.description,
              merchant: tx.merchant,
              suggestedCategoryId: categoryId,
              source: 'HISTORICAL_EXACT',
              confidence: 1.0,
              sampleSize: matches.length
            });
            resolved = true;
          }
        }
      }

      // HISTORICAL_CONSENSUS
      if (!resolved) {
        const merchantNorm = normalizeMerchant(tx.description);
        const matches = categorized.filter(t => {
          return normalizeMerchant(t.description) === merchantNorm;
        });
        if (matches.length >= 2) {
          const categoryCounts = new Map();
          matches.forEach(m => {
            if (m.category) {
              categoryCounts.set(m.category, (categoryCounts.get(m.category) || 0) + 1);
            }
          });
          if (categoryCounts.size > 0) {
            let maxCategory = '';
            let maxCount = 0;
            for (const [cat, count] of categoryCounts) {
              if (count > maxCount) {
                maxCategory = cat;
                maxCount = count;
              }
            }
            const consensus = maxCount / matches.length;
            if (consensus > 0.5) {
              results.historicalConsensus.push({
                transactionId: tx.id,
                description: tx.description,
                merchant: tx.merchant,
                suggestedCategoryId: maxCategory,
                source: 'HISTORICAL_CONSENSUS',
                confidence: consensus,
                sampleSize: matches.length
              });
              resolved = true;
            }
          }
        }
      }

      // REMAINING
      if (!resolved) {
        results.remaining.push({
          transactionId: tx.id,
          description: tx.description,
          merchant: tx.merchant
        });
      }
    }

    console.log(`RULES: ${results.rulesResolved.length}`);
    console.log(`HISTORICAL_EXACT: ${results.historicalExact.length}`);
    console.log(`HISTORICAL_CONSENSUS: ${results.historicalConsensus.length}`);
    console.log(`REMAINING: ${results.remaining.length}`);
    console.log();

    // Verify invariant
    const total = results.rulesResolved.length + results.historicalExact.length + 
                  results.historicalConsensus.length + results.remaining.length;
    if (total !== pendingCount) {
      console.error(`ERROR: Invariant violation! ${total} != ${pendingCount}`);
      process.exit(1);
    }
    console.log(`✓ Invariant verified: ${total} == ${pendingCount}`);
    console.log();

    // STEP 3: Classify remaining
    console.log('STEP 3: CLASSIFYING REMAINING...\n');

    const classified = {
      semantic: [],
      ambiguous: [],
      opaque: []
    };

    results.remaining.forEach(tx => {
      const desc = (tx.description || '').trim();
      if (desc.length > 20) {
        if (desc.includes('COMP') || desc.includes('PAGO') || desc.includes('MERCADO')) {
          classified.semantic.push(tx);
        } else {
          classified.ambiguous.push(tx);
        }
      } else {
        classified.opaque.push(tx);
      }
    });

    console.log(`SEMANTIC: ${classified.semantic.length}`);
    console.log(`AMBIGUOUS: ${classified.ambiguous.length}`);
    console.log(`OPAQUE: ${classified.opaque.length}`);
    console.log();

    // STEP 4: Agent candidates
    const agentCandidates = [
      ...classified.semantic,
      ...classified.ambiguous.slice(0, 10 - classified.semantic.length)
    ].slice(0, 10);

    console.log(`AGENT_CANDIDATES: ${agentCandidates.length}`);
    console.log();

    // STEP 5: Report
    console.log('='.repeat(60));
    console.log('FUNNEL REPORT');
    console.log('='.repeat(60));
    console.log();

    const report = {
      timestamp: new Date().toISOString(),
      dataset: {
        totalTransactions,
        categorizedTransactions,
        pendingTransactions: pendingCount,
        categories: categoryCount
      },
      funnel: {
        pending: pendingCount,
        rules: results.rulesResolved.length,
        historicalExact: results.historicalExact.length,
        historicalConsensus: results.historicalConsensus.length,
        remaining: results.remaining.length
      },
      classification: {
        semantic: classified.semantic.length,
        ambiguous: classified.ambiguous.length,
        opaque: classified.opaque.length
      },
      agentCandidates: agentCandidates.length,
      candidates: agentCandidates.slice(0, 5).map(tx => ({
        description: tx.description,
        merchant: tx.merchant
      }))
    };

    console.log(JSON.stringify(report, null, 2));
    console.log();
    console.log('✓ PHASE 07C2 MEASUREMENT COMPLETE');

    await admin.app().delete();
    process.exit(0);

  } catch (error) {
    console.error('FATAL ERROR:', error);
    process.exit(1);
  }
}

main();
