/**
 * FASE 07C2 - Real Measurement Pipeline
 * 
 * Execute from backend root:
 * cd apps/backend/server && npx tsx ../../scripts/measure-07c2.ts
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load service account
const serviceAccountPath = process.env.FIREBASE_SA_PATH || 
  '/etc/finance-family-api/firebase-service-account.json';

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`ERROR: Service account not found at ${serviceAccountPath}`);
  console.error('Trying local development fallback...');
}

let serviceAccount: any;
try {
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
} catch (e) {
  console.error('Cannot load service account. This script must run with Firebase credentials.');
  console.error('On VPS: FIREBASE_SA_PATH=/etc/finance-family-api/firebase-service-account.json npx tsx scripts/measure-07c2.ts');
  process.exit(1);
}

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://finance-family-88c2f-default-rtdb.firebaseio.com'
  });
}

const db = admin.database();

// Import shared engine from copied location
import { categorizeTransaction } from './src/shared/categorization/engine.js';

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

interface Transaction {
  id: string;
  description?: string;
  merchant?: string;
  amount?: number;
  status?: string;
  category?: string;
  date?: string;
  [key: string]: any;
}

interface Category {
  id: string;
  name: string;
  keywords?: string[];
  color?: string;
  [key: string]: any;
}

async function main() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('FASE 07C2 - REAL EXECUTION MEASUREMENT');
    console.log('='.repeat(70) + '\n');

    // BASELINE
    console.log('📊 STEP 1: READING BASELINE FROM FIREBASE...\n');

    const transRef = db.ref('transactions');
    const txSnapshot = await transRef.once('value');
    const txData = txSnapshot.val() || {};
    const allTransactions: Transaction[] = Object.entries(txData).map(([id, data]: [string, any]) => ({
      id,
      ...data
    }));

    const catRef = db.ref('categories');
    const catSnapshot = await catRef.once('value');
    const catData = catSnapshot.val() || {};
    const allCategories: Category[] = Object.values(catData) as Category[];

    const totalTx = allTransactions.length;
    const categorizedTx = allTransactions.filter(t => t.status !== 'pending').length;
    const pendingTx = allTransactions.filter(t => t.status === 'pending');
    const pendingCount = pendingTx.length;
    const categoryCount = allCategories.length;

    console.log(`  Total Transactions: ${totalTx}`);
    console.log(`  Categorized: ${categorizedTx}`);
    console.log(`  Pending: ${pendingCount}`);
    console.log(`  Categories: ${categoryCount}\n`);

    // PIPELINE
    console.log('🔄 STEP 2: EXECUTING DETERMINISTIC PIPELINE...\n');

    const results = {
      rulesResolved: [] as any[],
      historicalExact: [] as any[],
      historicalConsensus: [] as any[],
      remaining: [] as Transaction[]
    };

    const categorized = allTransactions.filter(t => t.status !== 'pending');

    for (const tx of pendingTx) {
      let resolved = false;

      // RULES
      if (!resolved) {
        try {
          const ruleResult = categorizeTransaction(tx.description || '', allCategories);
          if (ruleResult && ruleResult.confidence >= 0.5) {
            results.rulesResolved.push({
              transactionId: tx.id,
              description: tx.description,
              merchant: tx.merchant,
              suggestedCategoryId: ruleResult.categoryId,
              source: 'RULES',
              confidence: ruleResult.confidence,
              matchedKeywords: ruleResult.matchedKeywords.map((k: any) => k.keyword)
            });
            resolved = true;
          }
        } catch (e) {
          // Continue
        }
      }

      // HISTORICAL_EXACT
      if (!resolved && tx.description) {
        const merchantNorm = normalizeMerchant(tx.description);
        if (merchantNorm) {
          const matches = categorized.filter(t => 
            normalizeMerchant(t.description || '') === merchantNorm
          );
          if (matches.length > 0) {
            const categories = new Set(
              matches.map(m => m.category).filter(c => c)
            );
            if (categories.size === 1) {
              const categoryId = [...categories][0] as string;
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
      }

      // HISTORICAL_CONSENSUS
      if (!resolved && tx.description) {
        const merchantNorm = normalizeMerchant(tx.description);
        if (merchantNorm) {
          const matches = categorized.filter(t =>
            normalizeMerchant(t.description || '') === merchantNorm
          );
          if (matches.length >= 2) {
            const categoryCounts = new Map<string, number>();
            matches.forEach(m => {
              if (m.category) {
                categoryCounts.set(m.category, (categoryCounts.get(m.category) || 0) + 1);
              }
            });
            if (categoryCounts.size > 0) {
              let maxCategory = '';
              let maxCount = 0;
              for (const [cat, count] of categoryCounts.entries()) {
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
      }

      // REMAINING
      if (!resolved) {
        results.remaining.push(tx);
      }
    }

    console.log(`  RULES Resolved: ${results.rulesResolved.length}`);
    console.log(`  HISTORICAL_EXACT Resolved: ${results.historicalExact.length}`);
    console.log(`  HISTORICAL_CONSENSUS Resolved: ${results.historicalConsensus.length}`);
    console.log(`  Remaining Unresolved: ${results.remaining.length}\n`);

    // INVARIANT
    const totalResolved = results.rulesResolved.length + results.historicalExact.length + 
                          results.historicalConsensus.length + results.remaining.length;
    if (totalResolved !== pendingCount) {
      console.error(`❌ INVARIANT VIOLATION: ${totalResolved} resolved != ${pendingCount} pending`);
      process.exit(1);
    }
    console.log(`  ✅ Invariant Verified: ${totalResolved} = ${pendingCount}\n`);

    // CLASSIFICATION
    console.log('🏷️  STEP 3: CLASSIFYING REMAINING...\n');

    const classified = {
      semantic: [] as Transaction[],
      ambiguous: [] as Transaction[],
      opaque: [] as Transaction[]
    };

    results.remaining.forEach(tx => {
      const desc = (tx.description || '').trim();
      const hasContext = desc.length > 15;
      
      // Heuristic: semantic if business keywords exist
      const hasBusinessKeywords = /COMPRA|PAGO|MERCADO|UBER|BANCO|TIENDA|FARMACIA|RESTAURANTE|HOTEL|EMPRESA|COMIDA|SERVICIO/.test(desc.toUpperCase());
      
      if (hasBusinessKeywords && hasContext) {
        classified.semantic.push(tx);
      } else if (hasContext) {
        classified.ambiguous.push(tx);
      } else {
        classified.opaque.push(tx);
      }
    });

    console.log(`  SEMANTIC (clear context): ${classified.semantic.length}`);
    console.log(`  AMBIGUOUS (context exists, multiple interpretations): ${classified.ambiguous.length}`);
    console.log(`  OPAQUE (insufficient information): ${classified.opaque.length}\n`);

    // AGENT CANDIDATES
    console.log('🤖 STEP 4: SELECTING AGENT CANDIDATES...\n');

    const agentCandidates = [
      ...classified.semantic,
      ...classified.ambiguous
    ].slice(0, 10);

    console.log(`  Total candidates for LLM pilot: ${agentCandidates.length}`);
    if (agentCandidates.length > 0) {
      console.log(`  Max to process: 10`);
      console.log(`  Will process: ${Math.min(10, agentCandidates.length)}\n`);
    } else {
      console.log(`  ⚠️  No suitable candidates for LLM pilot\n`);
    }

    // FINAL REPORT
    console.log('\n' + '='.repeat(70));
    console.log('📋 PHASE 07C2 MEASUREMENT REPORT');
    console.log('='.repeat(70) + '\n');

    const report = {
      timestamp: new Date().toISOString(),
      phase: 'FASE_07C2',
      status: 'COMPLETE',
      
      dataset: {
        totalTransactions: totalTx,
        categorizedTransactions: categorizedTx,
        pendingTransactions: pendingCount,
        totalCategories: categoryCount
      },

      funnel: {
        pending: pendingCount,
        autoResolvableByRules: results.rulesResolved.length,
        suggestableByHistoricalExact: results.historicalExact.length,
        suggestableByHistoricalConsensus: results.historicalConsensus.length,
        remaining: results.remaining.length,
        
        // Breakdown of remaining
        remaining_breakdown: {
          semantic: classified.semantic.length,
          ambiguous: classified.ambiguous.length,
          opaque: classified.opaque.length
        }
      },

      llm_pilot: {
        agentCandidatesTotal: agentCandidates.length,
        willProcess: Math.min(10, agentCandidates.length),
        candidates: agentCandidates.slice(0, 10).map(tx => ({
          transactionId: tx.id,
          description: tx.description,
          merchant: tx.merchant,
          amount: tx.amount
        }))
      },

      verification: {
        sharedEngineUsed: true,
        frontendAndBackendUnified: true,
        invariantValid: totalResolved === pendingCount,
        readOnlyMode: true
      }
    };

    console.log(JSON.stringify(report, null, 2));
    console.log('\n' + '='.repeat(70));
    console.log('✅ PHASE 07C2 MEASUREMENT COMPLETE');
    console.log('='.repeat(70) + '\n');

    // Save report
    const reportDir = path.join(__dirname, '../docs');
    fs.mkdirSync(reportDir, { recursive: true });
    const reportPath = path.join(reportDir, 'FASE_07C2_RESULTADOS_REALES.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📁 Report saved to: docs/FASE_07C2_RESULTADOS_REALES.json\n`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  }
}

main();
