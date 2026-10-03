/**
 * FASE 07C - Test Simulado del Pipeline de Sugerencias
 * 
 * Simula el pipeline sin necesidad de Firebase.
 * Genera datos de prueba realistas.
 * 
 * Ejecutar con: node scripts/test-fase07c-simulation.mjs
 */

// Normalización de merchant (igual a backend)
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

// Pipeline de sugerencias
function suggestFromHistoricalExact(transaction, categorized) {
  const merchantNorm = normalizeMerchant(transaction.description);
  if (!merchantNorm) return null;

  const matches = categorized.filter(tx => {
    const txMerchantNorm = normalizeMerchant(tx.description);
    return txMerchantNorm === merchantNorm;
  });

  if (matches.length === 0) return null;

  const categories = new Set(matches.map(m => m.category).filter(c => c));

  if (categories.size === 1) {
    const categoryId = Array.from(categories)[0];
    return {
      categoryId,
      confidence: 1.0,
      reason: `Exact match: ${matches.length} historical transaction(s), all categorized as "${categoryId}"`
    };
  }

  return null;
}

function suggestFromHistoricalConsensus(transaction, categorized) {
  const merchantNorm = normalizeMerchant(transaction.description);
  if (!merchantNorm) return null;

  const matches = categorized.filter(tx => {
    const txMerchantNorm = normalizeMerchant(tx.description);
    return txMerchantNorm === merchantNorm;
  });

  if (matches.length < 2) return null;

  const categoryCounts = new Map();
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

// Generar datos de simulación
function generateTestData() {
  const categories = ['Alimentación', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud', 'Compras'];

  // Merchants categorizados (histórico)
  const categorized = [
    // Alimentación
    { id: 'tx1', description: 'COMPRA DISCO', category: 'Alimentación' },
    { id: 'tx2', description: 'REDIVA 12345DISCO', category: 'Alimentación' },
    { id: 'tx3', description: 'DISCO', category: 'Alimentación' },
    
    // Transporte
    { id: 'tx4', description: 'UBER UY', category: 'Transporte' },
    { id: 'tx5', description: 'COMPRA UBER', category: 'Transporte' },
    
    // Entretenimiento (con cierta variación)
    { id: 'tx6', description: 'NETFLIX', category: 'Entretenimiento' },
    { id: 'tx7', description: 'NETFLIX', category: 'Entretenimiento' },
    { id: 'tx8', description: 'SPOTIFY', category: 'Entretenimiento' },
    
    // Más alimentación
    { id: 'tx9', description: 'COMPRA MCDONALDS', category: 'Alimentación' },
    { id: 'tx10', description: 'MCDONALDS', category: 'Alimentación' },
    { id: 'tx11', description: 'COMPRA STARBUCKS', category: 'Alimentación' },
    
    // Más transporte
    { id: 'tx12', description: 'COMPRA UBER', category: 'Transporte' },
    { id: 'tx13', description: 'UBER', category: 'Transporte' },
  ];

  // Pendientes a sugerir
  const pending = [
    // Exact matches
    { id: 'p1', description: 'DISCO' },
    { id: 'p2', description: 'REDIVA 98765DISCO' },
    { id: 'p3', description: 'UBER UY' },
    
    // Consensus
    { id: 'p4', description: 'NETFLIX' },
    { id: 'p5', description: 'MCDONALDS' },
    
    // Sin coincidencias (nuevos)
    { id: 'p6', description: 'COMPRA FARMACIA XYZ' },
    { id: 'p7', description: 'PAGO SERVICIOS ABC' },
    { id: 'p8', description: 'TRANSFERENCIA AMIC' },
  ];

  return { categorized, pending };
}

async function runSimulation() {
  console.log('\n' + '='.repeat(80));
  console.log('FASE 07C - TEST SIMULADO DEL PIPELINE DE SUGERENCIAS');
  console.log('='.repeat(80) + '\n');

  const { categorized, pending } = generateTestData();

  console.log('📊 DATASET SIMULADO:');
  console.log(`  Total: ${categorized.length + pending.length}`);
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

  const suggestions = [];
  const details = [];

  for (const tx of pending) {
    // Intentar exact
    const exactSuggestion = suggestFromHistoricalExact(tx, categorized);
    if (exactSuggestion) {
      results.historical_exact++;
      const sugg = {
        txId: tx.id,
        description: tx.description,
        source: 'historical_exact',
        ...exactSuggestion
      };
      suggestions.push(sugg);
      details.push(sugg);
      continue;
    }

    // Intentar consensus
    const consensusSuggestion = suggestFromHistoricalConsensus(tx, categorized);
    if (consensusSuggestion) {
      results.historical_consensus++;
      const sugg = {
        txId: tx.id,
        description: tx.description,
        source: 'historical_consensus',
        ...consensusSuggestion
      };
      suggestions.push(sugg);
      details.push(sugg);
      continue;
    }

    // Sin sugerencia
    results.unresolved++;
    details.push({
      txId: tx.id,
      description: tx.description,
      source: 'none',
      categoryId: null,
      confidence: 0,
      reason: 'No pattern found'
    });
  }

  // Reporte
  console.log('📊 FUNNEL DE SUGERENCIAS:');
  console.log(`  Rules: ${results.rules}`);
  console.log(`  Historical Exact: ${results.historical_exact}`);
  console.log(`  Historical Consensus: ${results.historical_consensus}`);
  console.log(`  Agent (no implementado aún): ${results.agent}`);
  console.log(`  Unresolved: ${results.unresolved}`);
  const total = results.historical_exact + results.historical_consensus + results.unresolved;
  console.log(`  TOTAL: ${total}\n`);

  const totalResolved = results.historical_exact + results.historical_consensus;
  const resolutionRate = pending.length > 0 ? (totalResolved / pending.length * 100).toFixed(1) : 0;
  console.log(`📈 TASA DE RESOLUCIÓN: ${resolutionRate}% (${totalResolved}/${pending.length})\n`);

  // Detalles
  console.log('📋 DETALLES DE SUGERENCIAS:');
  details.forEach((d, idx) => {
    console.log(`\n  ${idx + 1}. "${d.description}"`);
    console.log(`     Fuente: ${d.source}`);
    if (d.source !== 'none') {
      console.log(`     Sugerencia: ${d.categoryId} (${(d.confidence * 100).toFixed(0)}%)`);
      console.log(`     Razón: ${d.reason}`);
    } else {
      console.log(`     Sin sugerencia`);
    }
  });

  console.log('\n✅ TEST COMPLETADO');
  console.log('='.repeat(80) + '\n');

  // Análisis de normalización
  console.log('🔍 ANÁLISIS DE NORMALIZACIÓN DE MERCHANT:');
  const uniqueNormalized = new Set(categorized.map(tx => normalizeMerchant(tx.description)));
  console.log(`  Merchants únicos encontrados: ${uniqueNormalized.size}`);
  uniqueNormalized.forEach(m => {
    console.log(`    - "${m}"`);
  });

  console.log('\n✅ TEST SIMULADO EXITOSO\n');
}

runSimulation().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
