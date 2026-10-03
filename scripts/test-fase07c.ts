/**
 * FASE 07C - Test Piloto del Pipeline de Sugerencias
 * 
 * Script para probar el pipeline de sugerencias sobre las 76 transacciones pendientes reales.
 * 
 * Ejecutar con: npx tsx scripts/test-fase07c.ts
 */

import { ref, get } from 'firebase/database';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Inicializar Firebase
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
  path.join(process.cwd(), 'apps/backend/server/.firebase-service-account.json');

let db: any;

async function initializeFirebase() {
  try {
    if (!fs.existsSync(serviceAccountPath)) {
      console.error('❌ Service account file not found at:', serviceAccountPath);
      process.exit(1);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });

    db = admin.database();
    console.log('✅ Firebase initialized');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    process.exit(1);
  }
}

// Normalización de merchant (igual a backend)
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

// Pipeline de sugerencias
function suggestFromHistoricalExact(
  transaction: any,
  categorized: any[]
): { categoryId: string; confidence: number; reason: string } | null {
  const merchantNorm = normalizeMerchant(transaction.description);
  if (!merchantNorm) return null;

  const matches = categorized.filter(tx => {
    const txMerchantNorm = normalizeMerchant(tx.description);
    return txMerchantNorm === merchantNorm;
  });

  if (matches.length === 0) return null;

  const categories = new Set(matches.map(m => m.category).filter(c => c));

  if (categories.size === 1) {
    const categoryId = [...categories][0] as string;
    return {
      categoryId,
      confidence: 1.0,
      reason: `Exact match: ${matches.length} transaction(s) all categorized as "${categoryId}"`
    };
  }

  return null;
}

function suggestFromHistoricalConsensus(
  transaction: any,
  categorized: any[]
): { categoryId: string; confidence: number; reason: string } | null {
  const merchantNorm = normalizeMerchant(transaction.description);
  if (!merchantNorm) return null;

  const matches = categorized.filter(tx => {
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
      categoryId: maxCategory,
      confidence: consensus,
      reason: `Consensus: ${maxCount}/${matches.length} historical transactions (${(consensus * 100).toFixed(0)}%)`
    };
  }

  return null;
}

async function runTests() {
  await initializeFirebase();

  console.log('\n' + '='.repeat(80));
  console.log('FASE 07C - TEST PILOTO DEL PIPELINE DE SUGERENCIAS');
  console.log('='.repeat(80) + '\n');

  // Cargar datos
  console.log('📂 Cargando transacciones...');
  const txSnapshot = await db.ref('yosbany-tejas/transactions').get();
  const allTransactions = txSnapshot.exists()
    ? Object.entries(txSnapshot.val()).map(([id, data]: [string, any]) => ({ id, ...data }))
    : [];

  console.log(`✅ ${allTransactions.length} transacciones cargadas\n`);

  // Separar pendientes y categorizadas
  const pending = allTransactions.filter(t => !t.category || t.status === 'pending');
  const categorized = allTransactions.filter(t => t.category && t.status !== 'pending');

  console.log(`📊 DATASET REAL:`);
  console.log(`  Total: ${allTransactions.length}`);
  console.log(`  Categorizadas: ${categorized.length}`);
  console.log(`  Pendientes: ${pending.length}\n`);

  // Procesar sugerencias
  console.log('🔄 Procesando pipeline de sugerencias...\n');

  const results = {
    rules: 0,
    historical_exact: 0,
    historical_consensus: 0,
    agent: 0,
    unresolved: 0,
  };

  const suggestions: any[] = [];

  for (const tx of pending.slice(0, 76)) { // Máximo 76
    // Intentar exact
    const exactSuggestion = suggestFromHistoricalExact(tx, categorized);
    if (exactSuggestion) {
      results.historical_exact++;
      suggestions.push({
        txId: tx.id,
        description: tx.description,
        source: 'historical_exact',
        ...exactSuggestion
      });
      continue;
    }

    // Intentar consensus
    const consensusSuggestion = suggestFromHistoricalConsensus(tx, categorized);
    if (consensusSuggestion) {
      results.historical_consensus++;
      suggestions.push({
        txId: tx.id,
        description: tx.description,
        source: 'historical_consensus',
        ...consensusSuggestion
      });
      continue;
    }

    // Sin sugerencia
    results.unresolved++;
  }

  // Reporte
  console.log('📊 FUNNEL DE SUGERENCIAS:');
  console.log(`  Rules: ${results.rules}`);
  console.log(`  Historical Exact: ${results.historical_exact}`);
  console.log(`  Historical Consensus: ${results.historical_consensus}`);
  console.log(`  Agent (no implementado aún): ${results.agent}`);
  console.log(`  Unresolved: ${results.unresolved}`);
  console.log(`  TOTAL: ${results.historical_exact + results.historical_consensus + results.unresolved}\n`);

  const totalResolved = results.historical_exact + results.historical_consensus;
  const resolutionRate = pending.length > 0 ? (totalResolved / pending.length * 100).toFixed(1) : 0;
  console.log(`📈 TASA DE RESOLUCIÓN: ${resolutionRate}% (${totalResolved}/${pending.length})\n`);

  // Ejemplos
  if (suggestions.length > 0) {
    console.log('📋 EJEMPLOS DE SUGERENCIAS:');
    suggestions.slice(0, 5).forEach((s, idx) => {
      console.log(`  ${idx + 1}. "${s.description.substring(0, 50)}..."`);
      console.log(`     → ${s.categoryId} (${s.source}, ${(s.confidence * 100).toFixed(0)}%)`);
      console.log(`     Razón: ${s.reason}`);
    });
  }

  console.log('\n✅ TEST COMPLETADO');
  console.log('='.repeat(80) + '\n');

  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
