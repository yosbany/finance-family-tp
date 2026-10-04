import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load Firebase credentials from root
const credPath = path.join(__dirname, '../../../finance-family-tp-firebase-adminsdk-fbsvc-99a701a97e.json');
console.log(`Loading credentials from: ${credPath}`);
console.log(`Exists: ${fs.existsSync(credPath)}`);

if (!fs.existsSync(credPath)) {
  console.error(`ERROR: Firebase credentials not found`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf-8'));

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: serviceAccount.database_url || 'https://finance-family-tp-default-rtdb.firebaseio.com'
  });
}

const db = admin.database();

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

async function main() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('FASE 07C3B — RECUPERAR Y VALIDAR LAS PROPUESTAS REALES POST-RECONCILIACIÓN');
    console.log('='.repeat(80) + '\n');

    console.log('📊 STEP 1: Reading REAL Firebase (finance-family-tp)...\n');

    const txRef = db.ref('transactions');
    const txSnapshot = await txRef.once('value');
    const txData = txSnapshot.val() || {};
    const allTransactions = Object.entries(txData).map(([id, data]) => ({
      id,
      ...data
    }));

    const catRef = db.ref('categories');
    const catSnapshot = await catRef.once('value');
    const catData = catSnapshot.val() || {};
    const allCategories = Object.values(catData) || [];

    const categorizedTx = allTransactions.filter(t => t.status !== 'pending');
    const pendingTx = allTransactions.filter(t => t.status === 'pending');

    console.log(`  Total Transactions: ${allTransactions.length}`);
    console.log(`  Categorized (legacy): ${categorizedTx.length}`);
    console.log(`  Pending: ${pendingTx.length}`);
    console.log(`  Categories: ${allCategories.length}\n`);

    console.log('🔄 STEP 2: Executing real pipeline...\n');

    const results = {
      rules: [],
      historicalExact: [],
      historicalConsensus: [],
      remaining: []
    };

    for (const tx of pendingTx) {
      let resolved = false;
      
      // HISTORICAL_EXACT
      if (!resolved && tx.description) {
        const merchantNorm = normalizeMerchant(tx.description);
        if (merchantNorm) {
          const matches = categorizedTx.filter(t =>
            normalizeMerchant(t.description || '') === merchantNorm
          );
          if (matches.length > 0) {
            const categories = new Set(matches.map(m => m.category).filter(c => c));
            if (categories.size === 1) {
              const categoryId = [...categories][0];
              results.historicalExact.push({
                transactionId: tx.id,
                description: tx.description,
                suggestedCategoryId: categoryId,
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
          const matches = categorizedTx.filter(t =>
            normalizeMerchant(t.description || '') === merchantNorm
          );
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
                  suggestedCategoryId: maxCategory,
                  consensus: consensus,
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

    const totalResolved = results.rules.length + results.historicalExact.length + 
                          results.historicalConsensus.length + results.remaining.length;

    console.log(`  RULES: ${results.rules.length}`);
    console.log(`  HISTORICAL_EXACT: ${results.historicalExact.length}`);
    console.log(`  HISTORICAL_CONSENSUS: ${results.historicalConsensus.length}`);
    console.log(`  REMAINING: ${results.remaining.length}`);
    console.log(`  ✅ Invariant: ${totalResolved} = ${pendingTx.length}\n`);

    console.log('📋 STEP 3: Extracting real HISTORICAL_EXACT cases...\n');

    const historicalExactCases = results.historicalExact.map((item, idx) => {
      const category = allCategories.find(c => c.id === item.suggestedCategoryId);
      const desc = (item.description || '').trim();
      
      let merchant = desc;
      const match = desc.match(/(?:REDIVA\s+)?\d*\s*(.+)/);
      if (match) {
        merchant = match[1].trim();
      }
      
      return {
        caseId: `H${idx + 1}`,
        movimiento: merchant,
        categoriaSugerida: category?.name || item.suggestedCategoryId,
        evidencia: `${item.sampleSize}/${item.sampleSize} antecedentes con misma categoría`,
        categoryId: item.suggestedCategoryId
      };
    });

    console.log(`  Extracted: ${historicalExactCases.length} real cases\n`);

    console.log('🤖 STEP 4: Selecting LLM candidates from REMAINING...\n');

    const llmCandidates = results.remaining.slice(0, 10);
    console.log(`  Selected: ${llmCandidates.length} candidates\n`);

    console.log('\n' + '='.repeat(80));
    console.log('📋 FASE 07C3B REPORT');
    console.log('='.repeat(80) + '\n');

    const report = {
      timestamp: new Date().toISOString(),
      phase: 'FASE_07C3B',
      firebase: 'finance-family-tp',
      
      dataset: {
        total: allTransactions.length,
        categorized: categorizedTx.length,
        pending: pendingTx.length,
        categories: allCategories.length
      },

      funnel: {
        RULES: results.rules.length,
        HISTORICAL_EXACT: results.historicalExact.length,
        HISTORICAL_CONSENSUS: results.historicalConsensus.length,
        REMAINING: results.remaining.length
      },

      historical_exact_cases: historicalExactCases,

      llm_pilot: {
        candidates_available: results.remaining.length,
        will_process: Math.min(10, results.remaining.length),
        candidates: llmCandidates.map((tx, idx) => ({
          caseId: `A${idx + 1}`,
          description: tx.description || '',
          transactionId: tx.id
        }))
      },

      status: 'READY_FOR_LLM_EXECUTION'
    };

    console.log(JSON.stringify(report, null, 2));

    const reportDir = path.join(__dirname, '../../docs');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    const reportPath = path.join(reportDir, 'FASE_07C3B_REAL_EXTRACTION.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📁 Report saved to: docs/FASE_07C3B_REAL_EXTRACTION.json\n`);
    console.log('✅ FASE 07C3B EXTRACTION COMPLETE\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  }
}

main();
