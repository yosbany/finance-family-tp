/**
 * FASE 07C3D - Exploration Script
 * 
 * Objetivos:
 * 1. Listar los 7 casos UNCERTAIN
 * 2. Por cada caso, buscar transacciones similares en historial
 * 3. Registrar ANTES/DESPUÉS del contexto histórico
 * 4. Preparar para re-ejecución con LLM
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Firebase
const serviceAccountPath = path.join(
  __dirname,
  '../../../finance-family-tp-firebase-adminsdk-fbsvc-99a701a97e.json'
);

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Service account file not found:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://finance-family-tp.firebaseio.com',
});

const db = admin.database();

// 7 casos incertos
const UNCERTAIN_CASES = [
  {
    id: 'A2',
    description: 'MIX UP (1/3)',
    llmSuggestion: 'Entretenimiento',
    llmConfidence: 0.62,
  },
  {
    id: 'A3',
    description: 'DREAMSTORE OCA (1/3)',
    llmSuggestion: 'Entretenimiento',
    llmConfidence: 0.8,
    note: 'OCA es modalidad de pago, no rubro',
  },
  {
    id: 'A4',
    description: 'RETIRO CORRESPONSALES, MONTEVIDEO',
    llmSuggestion: 'Transferencias',
    llmConfidence: 0.88,
  },
  {
    id: 'A7',
    description: 'COMPRA CON TARJETA DEBITO COMPADRE, MONTEVIDEO',
    llmSuggestion: 'Otros',
    llmConfidence: 0.55,
  },
  {
    id: 'A8',
    description: 'DEBITO OPERACION EN BANCA DIGITAL P--',
    llmSuggestion: 'Servicios y Utilidades',
    llmConfidence: 0.6,
  },
  {
    id: 'A9',
    description: 'DEBITO OPERACION EN BANCA DIGITAL P--',
    llmSuggestion: 'Servicios y Utilidades',
    llmConfidence: 0.6,
  },
  {
    id: 'A10',
    description: 'DEBITO OPERACION EN BANCA DIGITAL PCREDITO',
    llmSuggestion: 'Transferencias',
    llmConfidence: 0.7,
  },
];

// Normalizador de merchant
function normalizeMerchant(description) {
  if (!description) return '';

  let normalized = description.toUpperCase().trim();

  // Remover prefijos frecuentes
  const prefixes = ['REDIVA', 'COMPRA', 'PAGO', 'TRANSFERENCIA', 'TRF', 'TRA', 'DEBITO'];
  for (const prefix of prefixes) {
    const regex = new RegExp(`^${prefix}\\s+\\d*\\s*`, 'i');
    normalized = normalized.replace(regex, '').trim();
  }

  // Remover números al inicio
  normalized = normalized.replace(/^\d+\s*/, '').trim();

  // Normalizar espacios
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

// Calcular similitud textual
function calculateSimilarity(s1, s2) {
  const normalize = (s) =>
    s.toUpperCase().trim().replace(/[^\w\s]/g, '');

  const s1norm = normalize(s1);
  const s2norm = normalize(s2);

  if (s1norm === s2norm) return 1.0;
  if (s1norm.includes(s2norm) || s2norm.includes(s1norm)) return 0.8;

  const tokens1 = new Set(s1norm.split(/\s+/).filter(t => t.length > 0));
  const tokens2 = new Set(s2norm.split(/\s+/).filter(t => t.length > 0));

  const intersection = [...tokens1].filter(t => tokens2.has(t));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.length / union.size;
}

async function exploreHistoricalContext() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║ FASE 07C3D — EXPLORACIÓN DE CONTEXTO HISTÓRICO        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    // Get all transactions
    const familyRef = db.ref('family/transactions');
    const snapshot = await familyRef.once('value');

    if (!snapshot.exists()) {
      console.log('❌ No transactions found');
      return;
    }

    const allTransactions = Object.entries(snapshot.val()).map(([txId, data]) => ({
      id: txId,
      ...data,
    }));

    // Filter categorized transactions
    const categorized = allTransactions.filter(
      tx => tx.status !== 'pending' && tx.category
    );

    console.log(`📊 DATASET:`);
    console.log(`   Total: ${allTransactions.length}`);
    console.log(`   Categorized: ${categorized.length}`);
    console.log(`   Pending: ${allTransactions.filter(tx => tx.status === 'pending').length}\n`);

    // Process each uncertain case
    const report = {
      generatedAt: new Date().toISOString(),
      cases: [],
      summary: {
        processed: 0,
        withHistoricalContext: 0,
        withoutHistoricalContext: 0,
      },
    };

    for (const caseData of UNCERTAIN_CASES) {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`${caseData.id}: ${caseData.description}`);
      console.log(`${'═'.repeat(60)}`);

      console.log(`\n  ANTES (LLM sin histórico):`);
      console.log(`    Status: UNCERTAIN`);
      console.log(`    Sugerencia: ${caseData.llmSuggestion}`);
      console.log(`    Confianza: ${(caseData.llmConfidence * 100).toFixed(0)}%`);
      if (caseData.note) {
        console.log(`    Nota: ${caseData.note}`);
      }

      // Find similar transactions
      const queryNorm = normalizeMerchant(caseData.description);
      const queryLower = caseData.description.toLowerCase();

      console.log(`\n  BÚSQUEDA:`);
      console.log(`    Query: "${caseData.description}"`);
      console.log(`    Normalized: "${queryNorm}"`);

      // Score and filter similar transactions
      const scored = categorized.map(tx => {
        let score = 0;
        const txMerchantNorm = normalizeMerchant(tx.description);

        if (txMerchantNorm === queryNorm) {
          score = 1.0;
        } else if (
          txMerchantNorm.includes(queryNorm) ||
          queryNorm.includes(txMerchantNorm)
        ) {
          score = 0.9;
        } else if (tx.description.toLowerCase().includes(queryLower)) {
          score = 0.7;
        } else {
          score = calculateSimilarity(tx.description, caseData.description);
        }

        return { tx, score };
      });

      const similar = scored
        .filter(item => item.score >= 0.6)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      console.log(`    Matches (≥0.6): ${similar.length}`);

      if (similar.length > 0) {
        // Category distribution
        const categoryCounts = {};
        similar.forEach(item => {
          const cat = item.tx.category;
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });

        console.log(`\n  HISTORIAL CATEGORÍAS:`);
        Object.entries(categoryCounts)
          .sort((a, b) => b[1] - a[1])
          .forEach(([cat, count]) => {
            const pct = Math.round((count / similar.length) * 100);
            console.log(`    ${cat}: ${count}/${similar.length} (${pct}%)`);
          });

        console.log(`\n  TRANSACCIONES SIMILARES (top 5):`);
        similar.slice(0, 5).forEach(item => {
          console.log(`    - ${item.tx.description}`);
          console.log(`      Category: ${item.tx.category} | Score: ${(item.score * 100).toFixed(0)}%`);
        });

        report.summary.withHistoricalContext++;
      } else {
        console.log(`\n  ⚠  SIN CONTEXTO HISTÓRICO`);
        report.summary.withoutHistoricalContext++;
      }

      report.cases.push({
        caseId: caseData.id,
        description: caseData.description,
        llmBefore: {
          status: 'UNCERTAIN',
          suggestedCategory: caseData.llmSuggestion,
          confidence: caseData.llmConfidence,
        },
        historicalSearch: {
          query: caseData.description,
          normalized: queryNorm,
          matchCount: similar.length,
          categoryDistribution: Object.entries(
            similar.reduce((acc, item) => {
              const cat = item.tx.category;
              acc[cat] = (acc[cat] || 0) + 1;
              return acc;
            }, {})
          )
            .map(([cat, count]) => ({
              category: cat,
              count,
              percentage: Math.round((count / similar.length) * 100),
            }))
            .sort((a, b) => b.count - a.count),
          sampleTransactions: similar.slice(0, 5).map(item => ({
            description: item.tx.description,
            category: item.tx.category,
            date: item.tx.date,
            similarity: item.score,
          })),
        },
      });

      report.summary.processed++;
    }

    console.log(`\n\n${'═'.repeat(60)}`);
    console.log('RESUMEN');
    console.log(`${'═'.repeat(60)}`);
    console.log(`\n  Casos procesados: ${report.summary.processed}`);
    console.log(`  Con contexto histórico: ${report.summary.withHistoricalContext}`);
    console.log(`  Sin contexto histórico: ${report.summary.withoutHistoricalContext}`);

    // Save report
    const reportPath = path.join(__dirname, '../../docs/FASE_07C3D_HISTORICAL_CONTEXT.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Reporte guardado: ${reportPath}`);

    console.log('\n');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

exploreHistoricalContext();
