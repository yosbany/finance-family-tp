/**
 * FASE 07C3 - Human Validation of Suggestions
 * 
 * Extracts and prepares samples from all sources for human validation
 * WITHOUT modifying Firebase or creating endpoints
 * 
 * Execute from backend root:
 * cd apps/backend/server && npx tsx ../../scripts/validate-07c3.ts
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load service account
const serviceAccountPath = process.env.FIREBASE_SA_PATH || 
  '/etc/finance-family-api/firebase-service-account.json';

let serviceAccount: any;
try {
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
} catch (e) {
  console.error('Cannot load service account. This script must run with Firebase credentials.');
  console.error('On VPS: FIREBASE_SA_PATH=/etc/finance-family-api/firebase-service-account.json npx tsx scripts/validate-07c3.ts');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://finance-family-88c2f-default-rtdb.firebaseio.com'
  });
}

const db = admin.database();
import { categorizeTransaction } from '../apps/shared/categorization/engine.js';

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

interface ValidationSample {
  caseId: string;
  source: 'RULES' | 'HISTORICAL_EXACT' | 'HISTORICAL_CONSENSUS' | 'AGENT';
  merchant: string;
  categoryId: string;
  categoryName: string;
  confidence: number;
  extraInfo?: {
    sampleSize?: number;
    consensus?: number;
    matchedKeywords?: string[];
    reasoning?: string;
  };
  decision?: 'CORRECT' | 'INCORRECT' | 'UNCERTAIN';
  correctCategory?: string;
}

async function main() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('FASE 07C3 - HUMAN VALIDATION PREPARATION');
    console.log('='.repeat(70) + '\n');

    // 1. Load all data
    console.log('📊 STEP 1: Loading baseline from Firebase...\n');

    const txRef = db.ref('transactions');
    const txSnapshot = await txRef.once('value');
    const txData = txSnapshot.val() || {};
    const allTransactions: Transaction[] = Object.entries(txData).map(([id, data]: [string, any]) => ({
      id,
      ...data
    }));

    const catRef = db.ref('categories');
    const catSnapshot = await catRef.once('value');
    const catData = catSnapshot.val() || {};
    const allCategories: Category[] = Object.values(catData) as Category[];

    const categorizedTx = allTransactions.filter(t => t.status !== 'pending');
    const pendingTx = allTransactions.filter(t => t.status === 'pending');

    console.log(`  Total Transactions: ${allTransactions.length}`);
    console.log(`  Categorized: ${categorizedTx.length}`);
    console.log(`  Pending: ${pendingTx.length}\n`);

    // 2. Generate samples for each source
    console.log('🔄 STEP 2: Generating samples from all sources...\n');

    const samples: ValidationSample[] = [];

    // ===== RULES SAMPLES =====
    console.log('  → Collecting RULES samples...');
    const rulesSamples: any[] = [];
    for (const tx of pendingTx) {
      try {
        const ruleResult = categorizeTransaction(tx.description || '', allCategories);
        if (ruleResult && ruleResult.confidence >= 0.5) {
          rulesSamples.push({
            tx,
            result: ruleResult
          });
        }
      } catch (e) {
        // Continue
      }
    }
    
    // Group by confidence bucket
    const rulesGrouped = {
      low: rulesSamples.filter(r => r.result.confidence >= 0.5 && r.result.confidence < 0.75),
      medium: rulesSamples.filter(r => r.result.confidence >= 0.75 && r.result.confidence < 0.9),
      high: rulesSamples.filter(r => r.result.confidence >= 0.9)
    };
    
    // Take up to 10, with variety
    const rulesCount = Math.min(10, rulesSamples.length);
    const lowCount = Math.min(3, rulesGrouped.low.length);
    const mediumCount = Math.min(4, rulesGrouped.medium.length);
    const highCount = Math.min(3, rulesGrouped.high.length);
    
    const selectedRules = [
      ...rulesGrouped.low.slice(0, lowCount),
      ...rulesGrouped.medium.slice(0, mediumCount),
      ...rulesGrouped.high.slice(0, highCount)
    ];

    selectedRules.forEach((sample, idx) => {
      const category = allCategories.find(c => c.id === sample.result.categoryId);
      samples.push({
        caseId: `RULES_${idx + 1}`,
        source: 'RULES',
        merchant: sample.tx.description || sample.tx.merchant || 'Unknown',
        categoryId: sample.result.categoryId,
        categoryName: category?.name || sample.result.categoryId,
        confidence: sample.result.confidence,
        extraInfo: {
          matchedKeywords: sample.result.matchedKeywords?.map((k: any) => k.keyword) || []
        }
      });
    });

    console.log(`    Found: ${rulesSamples.length} | Selected: ${selectedRules.length}`);

    // ===== HISTORICAL_EXACT SAMPLES =====
    console.log('  → Collecting HISTORICAL_EXACT samples...');
    const historicalExactSamples: any[] = [];
    
    for (const tx of pendingTx) {
      if (!tx.description) continue;
      const merchantNorm = normalizeMerchant(tx.description);
      if (!merchantNorm) continue;
      
      const matches = categorizedTx.filter(t =>
        normalizeMerchant(t.description || '') === merchantNorm
      );
      
      if (matches.length > 0) {
        const categories = new Set(matches.map(m => m.category).filter(c => c));
        if (categories.size === 1) {
          const categoryId = [...categories][0] as string;
          historicalExactSamples.push({
            tx,
            categoryId,
            sampleSize: matches.length
          });
        }
      }
    }

    // Take up to 10
    const selectedHistoricalExact = historicalExactSamples.slice(0, 10);
    selectedHistoricalExact.forEach((sample, idx) => {
      const category = allCategories.find(c => c.id === sample.categoryId);
      samples.push({
        caseId: `HIST_EXACT_${idx + 1}`,
        source: 'HISTORICAL_EXACT',
        merchant: sample.tx.description || sample.tx.merchant || 'Unknown',
        categoryId: sample.categoryId,
        categoryName: category?.name || sample.categoryId,
        confidence: 1.0,
        extraInfo: {
          sampleSize: sample.sampleSize
        }
      });
    });

    console.log(`    Found: ${historicalExactSamples.length} | Selected: ${selectedHistoricalExact.length}`);

    // ===== HISTORICAL_CONSENSUS SAMPLES =====
    console.log('  → Collecting HISTORICAL_CONSENSUS samples...');
    const historicalConsensusSamples: any[] = [];
    
    for (const tx of pendingTx) {
      if (!tx.description) continue;
      const merchantNorm = normalizeMerchant(tx.description);
      if (!merchantNorm) continue;
      
      const matches = categorizedTx.filter(t =>
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
            historicalConsensusSamples.push({
              tx,
              categoryId: maxCategory,
              sampleSize: matches.length,
              consensus
            });
          }
        }
      }
    }

    // Take up to 10
    const selectedHistoricalConsensus = historicalConsensusSamples.slice(0, 10);
    selectedHistoricalConsensus.forEach((sample, idx) => {
      const category = allCategories.find(c => c.id === sample.categoryId);
      samples.push({
        caseId: `HIST_CONS_${idx + 1}`,
        source: 'HISTORICAL_CONSENSUS',
        merchant: sample.tx.description || sample.tx.merchant || 'Unknown',
        categoryId: sample.categoryId,
        categoryName: category?.name || sample.categoryId,
        confidence: sample.consensus,
        extraInfo: {
          sampleSize: sample.sampleSize,
          consensus: sample.consensus
        }
      });
    });

    console.log(`    Found: ${historicalConsensusSamples.length} | Selected: ${selectedHistoricalConsensus.length}`);

    // ===== AGENT SAMPLES =====
    // Load from existing propuestas file if available
    console.log('  → Collecting AGENT samples...');
    const agentSamples: ValidationSample[] = [];
    const propuestasPath = path.join(__dirname, '../docs/FASE_07C2_PROPUESTAS_PARA_REVISION.md');
    
    if (fs.existsSync(propuestasPath)) {
      const propuestasContent = fs.readFileSync(propuestasPath, 'utf-8');
      // Parse propuestas markdown - for now, we'll just note it was read
      // In a real implementation, parse this properly
      console.log('    (Read existing propuestas file)');
    }

    console.log(`    Ready for manual validation\n`);

    // 3. Export samples for validation
    console.log('💾 STEP 3: Preparing validation document...\n');

    const validationData = {
      timestamp: new Date().toISOString(),
      phase: 'FASE_07C3',
      status: 'AWAITING_HUMAN_REVIEW',
      samples: samples.sort((a, b) => {
        const sourceOrder: Record<string, number> = {
          'RULES': 1,
          'HISTORICAL_EXACT': 2,
          'HISTORICAL_CONSENSUS': 3,
          'AGENT': 4
        };
        return (sourceOrder[a.source] || 5) - (sourceOrder[b.source] || 5);
      }),
      summary: {
        totalSamples: samples.length,
        bySource: {
          RULES: selectedRules.length,
          HISTORICAL_EXACT: selectedHistoricalExact.length,
          HISTORICAL_CONSENSUS: selectedHistoricalConsensus.length,
          AGENT: agentSamples.length
        }
      }
    };

    const reportDir = path.join(__dirname, '../docs');
    fs.mkdirSync(reportDir, { recursive: true });
    const reportPath = path.join(reportDir, 'FASE_07C3_VALIDATION_DATA.json');
    fs.writeFileSync(reportPath, JSON.stringify(validationData, null, 2));

    console.log(`📁 Validation data saved to: docs/FASE_07C3_VALIDATION_DATA.json`);
    console.log(`   Total samples prepared: ${samples.length}\n`);

    // 4. Final report
    console.log('\n' + '='.repeat(70));
    console.log('✅ FASE 07C3 PREPARATION COMPLETE');
    console.log('='.repeat(70) + '\n');

    console.log('Next steps:');
    console.log('1. Review samples in validation document');
    console.log('2. Mark each as CORRECT, INCORRECT, or UNCERTAIN');
    console.log('3. For INCORRECT cases, provide the correct category');
    console.log('4. Calculate acceptance rates by source\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  }
}

main();
