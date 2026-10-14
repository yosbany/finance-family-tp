#!/usr/bin/env node

/**
 * FASE 07C3D - Re-categorización con LLM Agent
 *
 * Ejecuta el agente LLM sobre transacciones pending para categorizarlas.
 *
 * Uso:
 *   node fase-07c3d-recategorize.mjs
 *
 * Variables de entorno requeridas:
 *   - FIREBASE_PROJECT_ID
 *   - FIREBASE_DATABASE_URL
 *   - NRD_LLM_BASE_URL (opcional)
 *   - NRD_LLM_API_KEY (opcional)
 *   - NRD_LLM_MODEL (opcional)
 */

import admin from 'firebase-admin';
import { config } from './src/config/env.js';

console.log('🔄 FASE 07C3D — RE-CATEGORIZACIÓN CON LLM');
console.log('═'.repeat(60));

// Inicializar Firebase
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  './config/serviceAccountKey.json';

try {
  const serviceAccount = (await import(`file://${process.cwd()}/${serviceAccountPath}`)).default;
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: config.firebaseDatabaseUrl,
  });
} catch (error) {
  console.error('❌ No se pudo inicializar Firebase:', error.message);
  console.log('\nOpciones:');
  console.log('1. Configurar GOOGLE_APPLICATION_CREDENTIALS');
  console.log('2. Crear config/serviceAccountKey.json');
  console.log('3. Usar Firebase Auth tokens');
  process.exit(1);
}

const db = admin.firestore();

async function getPendingTransactions() {
  console.log('\n📊 Buscando transacciones pending...');

  const snapshot = await db
    .collectionGroup('transactions')
    .where('status', '==', 'pending')
    .limit(100)
    .get();

  const transactions = [];
  snapshot.forEach(doc => {
    transactions.push({
      id: doc.id,
      path: doc.ref.path,
      ...doc.data(),
    });
  });

  console.log(`✅ Encontradas ${transactions.length} transacciones pending`);
  return transactions;
}

async function suggestCategoryForTransaction(transaction) {
  /**
   * NOTA: Aquí va la llamada al LLM Agent
   * En una implementación real, se llamaría a:
   * - suggestTransactionCategory tool del agent
   * - O directamente una API que use el agent
   *
   * Por ahora, retornamos un placeholder
   */

  // Extraer palabras clave
  const description = transaction.description || '';
  const keywords = description.toLowerCase().split(/[\s\-_.,;:()]+/).filter(w => w.length > 2);

  // Lógica simple para demo
  const categoryMap = {
    // Alimentación
    'mercado': 'food', 'supermercado': 'food', 'almacen': 'food', 'verduleria': 'food',
    'restaurante': 'food', 'cafe': 'food', 'cantina': 'food',
    // Transporte
    'uber': 'transport', 'taxi': 'transport', 'combustible': 'transport', 'bencina': 'transport',
    'nafta': 'transport', 'estacionamiento': 'transport', 'peaje': 'transport',
    // Servicios
    'luz': 'utilities', 'agua': 'utilities', 'telefono': 'utilities', 'internet': 'utilities',
    'cable': 'utilities', 'gas': 'utilities',
    // Entretenimiento
    'cine': 'entertainment', 'teatro': 'entertainment', 'musica': 'entertainment',
    'spotify': 'entertainment', 'netflix': 'entertainment', 'game': 'entertainment',
  };

  for (const keyword of keywords) {
    if (categoryMap[keyword]) {
      return {
        categoryId: categoryMap[keyword],
        confidence: 0.6,
        source: 'simple-rule',
        reason: `Matched keyword: ${keyword}`,
      };
    }
  }

  return null;
}

async function updateTransaction(docPath, suggestion) {
  if (!suggestion) return false;

  const [, collectionPath] = docPath.split('/').slice(-3, -1);
  const docId = docPath.split('/').pop();

  try {
    await db.doc(docPath).update({
      category: suggestion.categoryId,
      status: suggestion.confidence >= 0.75 ? 'classified' : 'pending',
      suggestedCategory: {
        categoryId: suggestion.categoryId,
        confidence: suggestion.confidence,
        source: suggestion.source,
        timestamp: Date.now(),
      },
    });

    return true;
  } catch (error) {
    console.error(`❌ Error actualizando ${docPath}:`, error.message);
    return false;
  }
}

async function main() {
  try {
    const transactions = await getPendingTransactions();

    if (transactions.length === 0) {
      console.log('\n✅ No hay transacciones pending');
      process.exit(0);
    }

    console.log('\n🤖 Procesando transacciones con Agent...');

    let processed = 0;
    let categorized = 0;

    for (const tx of transactions) {
      try {
        const suggestion = await suggestCategoryForTransaction(tx);

        if (suggestion) {
          const updated = await updateTransaction(tx.path, suggestion);
          if (updated) {
            categorized++;
            console.log(`  ✅ ${tx.id}: ${suggestion.categoryId} (${(suggestion.confidence * 100).toFixed(0)}%)`);
          }
        } else {
          console.log(`  ⏭️  ${tx.id}: sin categoría sugerida`);
        }

        processed++;
      } catch (error) {
        console.error(`  ❌ Error procesando ${tx.id}:`, error.message);
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 RESULTADOS');
    console.log('═'.repeat(60));
    console.log(`Procesadas: ${processed}/${transactions.length}`);
    console.log(`Categorizadas: ${categorized}`);
    console.log(`Mejora: +${categorized} transacciones`);

    if (categorized > 0) {
      console.log('\n✅ Re-categorización completada');
    } else {
      console.log('\n⚠️  No se pudo categorizar ninguna transacción');
    }

  } catch (error) {
    console.error('❌ Error en re-categorización:', error.message);
    process.exit(1);
  } finally {
    await admin.app().delete();
  }
}

await main();
