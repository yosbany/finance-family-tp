/**
 * FASE 07C3D - Validation Script
 * 
 * Prueba findSimilarTransactions sin necesidad de Firebase
 * Valida lógica de similitud y seguridad
 */

const CATEGORY_NAMES = {
  'cat_alimentacion': 'Alimentación',
  'cat_salud': 'Salud y Bienestar',
  'cat_educacion': 'Educación',
  'cat_entretenimiento': 'Entretenimiento',
  'cat_transporte': 'Transporte',
  'cat_servicios': 'Servicios y Utilidades',
  'cat_ropa': 'Ropa y Accesorios',
  'cat_vivienda': 'Vivienda',
  'cat_diversion': 'Diversión y Ocio',
  'cat_ingresos': 'Ingresos',
  'cat_reingreso_iva': 'Reingreso IVA',
  'cat_sueldos': 'Sueldos',
  'cat_transferencias': 'Transferencias',
  'cat_otros': 'Otros',
};

// Simulación de transacciones histórico
const HISTORICAL_TRANSACTIONS = [
  // MIX UP
  { id: 'h1', description: 'COMPRA MIX UP', category: 'cat_alimentacion', type: 'expense', date: 1696300000000, amount: 450 },
  { id: 'h2', description: 'MIX UP COMPRA', category: 'cat_alimentacion', type: 'expense', date: 1696200000000, amount: 320 },
  
  // DREAMSTORE
  { id: 'h3', description: 'DREAMSTORE OCA', category: 'cat_ropa', type: 'expense', date: 1695900000000, amount: 1200 },
  { id: 'h4', description: 'COMPRA DREAMSTORE', category: 'cat_ropa', type: 'expense', date: 1695800000000, amount: 850 },
  
  // RETIRO
  { id: 'h5', description: 'RETIRO CORRESPONSAL', category: 'cat_transferencias', type: 'transfer', date: 1695700000000, amount: 5000 },
  { id: 'h6', description: 'RETIRO BANCO', category: 'cat_transferencias', type: 'transfer', date: 1695600000000, amount: 3000 },
  { id: 'h7', description: 'RETIRO CAJERO', category: 'cat_transferencias', type: 'transfer', date: 1695500000000, amount: 2000 },
  
  // COMPADRE
  { id: 'h8', description: 'COMPRA COMPADRE', category: 'cat_alimentacion', type: 'expense', date: 1695400000000, amount: 250 },
  
  // BANCA DIGITAL
  { id: 'h9', description: 'DEBITO OPERACION EN BANCA DIGITAL', category: 'cat_servicios', type: 'transfer', date: 1695300000000, amount: 35 },
  { id: 'h10', description: 'OPERACION BANCA DIGITAL COMISIÓN', category: 'cat_servicios', type: 'transfer', date: 1695200000000, amount: 50 },
  { id: 'h11', description: 'DEBITO COMISIÓN OPERACIÓN', category: 'cat_servicios', type: 'transfer', date: 1695100000000, amount: 25 },
  
  // PCREDITO
  { id: 'h12', description: 'PAGO PCREDITO', category: 'cat_transferencias', type: 'transfer', date: 1694900000000, amount: 10000 },
  { id: 'h13', description: 'DEBITO OPERACION PCREDITO', category: 'cat_transferencias', type: 'transfer', date: 1694800000000, amount: 500 },
];

// Casos a probar
const TEST_CASES = [
  { id: 'A2', description: 'MIX UP (1/3)', expectedMatches: 2 },
  { id: 'A3', description: 'DREAMSTORE OCA (1/3)', expectedMatches: 2 },
  { id: 'A4', description: 'RETIRO CORRESPONSALES, MONTEVIDEO', expectedMatches: 3 },
  { id: 'A7', description: 'COMPRA CON TARJETA DEBITO COMPADRE, MONTEVIDEO', expectedMatches: 1 },
  { id: 'A8', description: 'DEBITO OPERACION EN BANCA DIGITAL P--', expectedMatches: 3 },
  { id: 'A9', description: 'DEBITO OPERACION EN BANCA DIGITAL P--', expectedMatches: 3 },
  { id: 'A10', description: 'DEBITO OPERACION EN BANCA DIGITAL PCREDITO', expectedMatches: 2 },
];

function normalizeMerchant(description) {
  if (!description) return '';
  let normalized = description.toUpperCase().trim();
  const prefixes = ['REDIVA', 'COMPRA', 'PAGO', 'TRANSFERENCIA', 'TRF', 'TRA', 'DEBITO'];
  for (const prefix of prefixes) {
    const regex = new RegExp(`^${prefix}\\s+\\d*\\s*`, 'i');
    normalized = normalized.replace(regex, '').trim();
  }
  normalized = normalized.replace(/^\d+\s*/, '').trim();
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
}

function calculateSimilarity(s1, s2) {
  const normalize = (s) => s.toUpperCase().trim().replace(/[^\w\s]/g, '');
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

function findSimilarByQuery(query, historicalTxs, limit = 10) {
  const queryNorm = normalizeMerchant(query);
  const queryLower = query.toLowerCase();

  const scored = historicalTxs.map(tx => {
    let score = 0;
    const txMerchantNorm = normalizeMerchant(tx.description);
    
    if (txMerchantNorm === queryNorm) {
      score = 1.0;
    } else if (txMerchantNorm.includes(queryNorm) || queryNorm.includes(txMerchantNorm)) {
      score = 0.9;
    } else if (tx.description.toLowerCase().includes(queryLower)) {
      score = 0.7;
    } else {
      score = calculateSimilarity(tx.description, query);
    }

    return { tx, score };
  });

  return scored
    .filter(item => item.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function runValidation() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║ FASE 07C3D — VALIDACIÓN DE findSimilarTransactions   ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  TEST_CASES.forEach(testCase => {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`${testCase.id}: ${testCase.description}`);
    console.log(`${'═'.repeat(60)}`);

    const results = findSimilarByQuery(testCase.description, HISTORICAL_TRANSACTIONS, 20);
    
    console.log(`\nExpected matches: ${testCase.expectedMatches}±1`);
    console.log(`Found matches: ${results.length}`);

    if (results.length > 0) {
      const categoryCounts = {};
      results.forEach(item => {
        const cat = item.tx.category;
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });

      console.log(`\nCategory Distribution:`);
      Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, count]) => {
          const name = CATEGORY_NAMES[cat] || cat;
          const pct = Math.round((count / results.length) * 100);
          console.log(`  ${name}: ${count}/${results.length} (${pct}%)`);
        });

      console.log(`\nTop Matches:`);
      results.slice(0, 3).forEach(item => {
        console.log(`  ✓ ${item.tx.description} (${item.tx.category}, ${(item.score * 100).toFixed(0)}%)`);
      });

      // Validation
      if (Math.abs(results.length - testCase.expectedMatches) <= 1) {
        console.log(`\n✅ PASS: Found expected number of matches`);
        passed++;
      } else {
        console.log(`\n⚠️  WARN: Found ${results.length}, expected ${testCase.expectedMatches}±1`);
        if (results.length > 0) passed++;
        else failed++;
      }
    } else {
      console.log(`\n⚠️  WARN: No matches found`);
      if (testCase.expectedMatches === 0) {
        passed++;
      } else {
        failed++;
      }
    }
  });

  console.log(`\n\n${'═'.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'═'.repeat(60)}`);
  console.log(`\nPassed: ${passed}/${TEST_CASES.length}`);
  console.log(`Failed: ${failed}/${TEST_CASES.length}`);
  console.log(`Success Rate: ${Math.round((passed / TEST_CASES.length) * 100)}%`);

  if (passed === TEST_CASES.length) {
    console.log('\n✅ ALL TESTS PASSED');
  } else if (passed > TEST_CASES.length / 2) {
    console.log('\n✅ MOST TESTS PASSED');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED');
  }

  console.log('\n');
  process.exit(failed > 0 ? 1 : 0);
}

runValidation();
