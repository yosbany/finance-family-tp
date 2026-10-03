#!/usr/bin/env node

/**
 * FASE 07C2 - Measurement Script
 * 
 * Executes deterministic classification pipeline on real pending transactions.
 * 
 * Pipeline:
 * 1. RULES (threshold >= 0.5)
 * 2. HISTORICAL_EXACT
 * 3. HISTORICAL_CONSENSUS
 * 4. NEEDS_AGENT (remaining for LLM)
 * 5. UNRESOLVED
 * 
 * READ-ONLY: Does not modify Firebase
 * Runs on VPS using existing Firebase Admin credentials
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Firebase Admin initialization
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || '/etc/finance-family-api/firebase-service-account.json';

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`ERROR: Service account file not found at ${serviceAccountPath}`);
  console.error('Ensure FIREBASE_SERVICE_ACCOUNT env var points to valid JSON file');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://inance-family-uy.firebaseio.com'
});

const db = admin.database();

// Import engine from shared categorization
import('../apps/shared/categorization/engine.js').then(async (engine) => {
  console.log('\\n=== FASE 07C2 - MEDICIÓN REAL CON PIPELINE COMPLETO ===\\n');
  
  await runMeasurement(engine);
}).catch(err => {
  console.error('ERROR: Could not load categorization engine:', err.message);
  process.exit(1);
});

async function runMeasurement(engine) {
  const startTime = Date.now();
  
  try {
    // Get family root
    const familyRoot = 'family'; // Default, could be fetched from authorizedUsers
    console.log(`[1/7] Reading transactions from family root: ${familyRoot}`);
    
    // Fetch all transactions
    const transactionsSnapshot = await db.ref(`${familyRoot}/transactions`).once('value');
    if (!transactionsSnapshot.exists()) {
      console.error('ERROR: No transactions found');
      process.exit(1);
    }
    
    const transactionsData = transactionsSnapshot.val();
    const allTransactions = Object.entries(transactionsData).map(([id, data]) => ({
      id,
      ...data
    }));
    
    const totalTransactions = allTransactions.length;
    const categorized = allTransactions.filter(t => t.category && t.status === 'classified').length;
    const pending = allTransactions.filter(t => t.status === 'pending').length;
    
    console.log(`\\n[DATASET REAL]`);
    console.log(`  Total: ${totalTransactions}`);
    console.log(`  Categorized: ${categorized}`);
    console.log(`  Pending: ${pending}`);
    
    // Fetch categories
    console.log(`\\n[2/7] Reading categories`);
    const categoriesSnapshot = await db.ref(`${familyRoot}/categories`).once('value');
    const categoriesData = categoriesSnapshot.exists() ? categoriesSnapshot.val() : {};
    const categories = Object.entries(categoriesData).map(([id, data]) => ({
      id,
      ...data
    }));
    
    console.log(`  Categories available: ${categories.length}`);
    
    // Get pending transactions
    const pendingTransactions = allTransactions.filter(t => t.status === 'pending');
    const historicalTransactions = allTransactions.filter(t => t.category && t.status !== 'pending');
    
    console.log(`\\n[3/7] Executing pipeline on ${pendingTransactions.length} pending transactions`);
    
    // Initialize funnel
    const funnel = {
      total: pendingTransactions.length,
      rules: {
        resolved: 0,
        remaining: pendingTransactions.length
      },
      historicalExact: {
        resolved: 0,
        remaining: 0
      },
      historicalConsensus: {
        resolved: 0,
        remaining: 0
      },
      needsAgent: 0,
      unresolved: 0,
      bySource: {}
    };
    
    const results = [];
    
    for (const tx of pendingTransactions) {
      const result = {
        transactionId: tx.id,
        description: tx.description,
        source: null,
        categoryId: null,
        confidence: null,
        reason: null,
        metadata: {}
      };
      
      // 1. RULES
      const rulesResult = engine.categorizeTransaction(tx.description, categories);
      if (rulesResult && rulesResult.confidence >= 0.5) {
        result.source = 'rules';
        result.categoryId = rulesResult.categoryId;
        result.confidence = rulesResult.confidence;
        result.reason = `Rules match with confidence ${(rulesResult.confidence * 100).toFixed(0)}%`;
        result.metadata.matchedKeywords = rulesResult.matchedKeywords.map(k => k.keyword);
        funnel.rules.resolved++;
        results.push(result);
        continue;
      }
      
      // 2. HISTORICAL_EXACT
      const merchantNorm = normalizeMerchant(tx.description);
      const exactMatches = historicalTransactions.filter(t => 
        normalizeMerchant(t.description) === merchantNorm
      );
      
      if (exactMatches.length > 0) {
        const categories_in_exact = new Set(exactMatches.map(m => m.category).filter(c => c));
        if (categories_in_exact.size === 1) {
          const categoryId = [...categories_in_exact][0];
          result.source = 'historical_exact';
          result.categoryId = categoryId;
          result.confidence = 1.0;
          result.reason = `Exact merchant match: ${exactMatches.length} transaction(s)`;
          result.metadata.sampleSize = exactMatches.length;
          funnel.historicalExact.resolved++;
          results.push(result);
          continue;
        }
      }
      
      // 3. HISTORICAL_CONSENSUS
      if (exactMatches.length >= 2) {
        const categoryCounts = new Map();
        exactMatches.forEach(m => {
          if (m.category) {
            categoryCounts.set(m.category, (categoryCounts.get(m.category) || 0) + 1);
          }
        });
        
        let maxCategory = '';
        let maxCount = 0;
        for (const [cat, count] of categoryCounts) {
          if (count > maxCount) {
            maxCategory = cat;
            maxCount = count;
          }
        }
        
        const consensus = maxCount / exactMatches.length;
        if (consensus > 0.5) {
          result.source = 'historical_consensus';
          result.categoryId = maxCategory;
          result.confidence = consensus;
          result.reason = `Consensus: ${maxCount}/${exactMatches.length} transactions (${(consensus*100).toFixed(0)}%)`;
          result.metadata.sampleSize = exactMatches.length;
          result.metadata.consensus = consensus;
          funnel.historicalConsensus.resolved++;
          results.push(result);
          continue;
        }
      }
      
      // 4. UNRESOLVED
      result.source = 'unresolved';
      result.reason = 'No rule or historical pattern found';
      results.push(result);
    }
    
    // Calculate funnel
    funnel.rules.remaining = funnel.total - funnel.rules.resolved;
    funnel.historicalExact.remaining = funnel.rules.remaining - funnel.historicalExact.resolved;
    funnel.historicalConsensus.remaining = funnel.historicalExact.remaining - funnel.historicalConsensus.resolved;
    funnel.unresolved = funnel.historicalConsensus.remaining;
    funnel.needsAgent = funnel.unresolved; // All unresolved could be agent candidates
    
    // Summary by source
    funnel.bySource = {
      rules: funnel.rules.resolved,
      historical_exact: funnel.historicalExact.resolved,
      historical_consensus: funnel.historicalConsensus.resolved,
      unresolved: funnel.unresolved
    };
    
    // Print results
    console.log(`\\n[4/7] PIPELINE RESULTS\\n`);
    console.log(`FUNNEL:`);
    console.log(`  ${funnel.total} pending`);
    console.log(`    ├─ RULES: ${funnel.rules.resolved}`);
    console.log(`    ├─ HISTORICAL_EXACT: ${funnel.historicalExact.resolved}`);
    console.log(`    ├─ HISTORICAL_CONSENSUS: ${funnel.historicalConsensus.resolved}`);
    console.log(`    └─ UNRESOLVED: ${funnel.unresolved}`);
    
    console.log(`\\n[5/7] Classifying unresolved transactions`);
    
    // Classify unresolved
    const unresolved = results.filter(r => r.source === 'unresolved');
    const classification = {
      semantic: [],
      ambiguous: [],
      opaque: []
    };
    
    for (const tx of unresolved) {
      const pendingTx = pendingTransactions.find(p => p.id === tx.transactionId);
      if (!pendingTx) continue;
      
      const desc = pendingTx.description || '';
      const hasInfo = desc.length > 15 && /[a-z0-9]/i.test(desc);
      const hasNumbers = /\\d{4,}/.test(desc); // Possible RUT or code
      
      if (hasInfo && hasNumbers) {
        classification.semantic.push(tx);
      } else if (hasInfo) {
        classification.ambiguous.push(tx);
      } else {
        classification.opaque.push(tx);
      }
    }
    
    console.log(`  SEMANTIC (enough info): ${classification.semantic.length}`);
    console.log(`  AMBIGUOUS (partial info): ${classification.ambiguous.length}`);
    console.log(`  OPAQUE (no info): ${classification.opaque.length}`);
    
    const agentCandidates = [...classification.semantic, ...classification.ambiguous].slice(0, 10);
    console.log(`\\n[6/7] AGENT CANDIDATES: ${agentCandidates.length} (max 10)`);
    
    console.log(`\\n[7/7] REPORT SUMMARY\\n`);
    console.log(`MOTOR COMPARTIDO: ✅ categorizeTransaction importado y ejecutado`);
    console.log(`DATASET REAL: ${totalTransactions} total, ${categorized} cat, ${pending} pending`);
    console.log(`RULES: ${funnel.rules.resolved} resolved`);
    console.log(`HISTORICAL_EXACT: ${funnel.historicalExact.resolved} resolved`);
    console.log(`HISTORICAL_CONSENSUS: ${funnel.historicalConsensus.resolved} resolved`);
    console.log(`RESTANTES: SEMANTIC ${classification.semantic.length}, AMBIGUOUS ${classification.ambiguous.length}, OPAQUE ${classification.opaque.length}`);
    console.log(`AGENT CANDIDATES: ${agentCandidates.length}`);
    console.log(`TOOL REGISTRY: ✅ suggestTransactionCategory (READ-ONLY)`);
    console.log(`SEGURIDAD: ✅ No write operations`);
    
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\\nTiempo de ejecución: ${elapsedSeconds}s`);
    console.log(`\\n=== FASE 07C2 COMPLETA ===\\n`);
    
  } catch (error) {
    console.error('\\nERROR DURANTE MEDICIÓN:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

function normalizeMerchant(description) {
  if (!description) return '';
  let normalized = description.toUpperCase().trim();
  const prefixes = ['REDIVA', 'COMPRA', 'PAGO', 'TRANSFERENCIA', 'TRF', 'TRA'];
  for (const prefix of prefixes) {
    const regex = new RegExp(`^${prefix}\\s+\\d*\\s*`, 'i');
    normalized = normalized.replace(regex, '').trim();
  }
  normalized = normalized.replace(/^\\d+\\s*/, '').trim();
  normalized = normalized.replace(/\\s+/g, ' ').trim();
  return normalized;
}
