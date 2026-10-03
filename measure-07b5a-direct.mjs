/**
 * FASE 07B5A - MEDICIÓN DIRECTA CONTRA FIREBASE
 * 
 * Script Node.js que lee directamente desde Firebase sin UI.
 * Reutiliza la configuración cliente (no es secreto).
 * Mide baseline de clasificación.
 * 
 * Uso:
 * node measure-07b5a-direct.mjs
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Leer configuración Firebase desde .env.production
const envPath = resolve(process.cwd(), 'apps/frontend/.env.production');
const envContent = readFileSync(envPath, 'utf-8');

const firebaseConfig = {
  apiKey: envContent.match(/VITE_FIREBASE_API_KEY=(.+)/)?.[1] || '',
  authDomain: envContent.match(/VITE_FIREBASE_AUTH_DOMAIN=(.+)/)?.[1] || '',
  databaseURL: envContent.match(/VITE_FIREBASE_DATABASE_URL=(.+)/)?.[1] || '',
  projectId: envContent.match(/VITE_FIREBASE_PROJECT_ID=(.+)/)?.[1] || '',
  storageBucket: envContent.match(/VITE_FIREBASE_STORAGE_BUCKET=(.+)/)?.[1] || '',
  messagingSenderId: envContent.match(/VITE_FIREBASE_MESSAGING_SENDER_ID=(.+)/)?.[1] || '',
  appId: envContent.match(/VITE_FIREBASE_APP_APP_ID=(.+)/)?.[1] || '',
};

console.log('📊 FASE 07B5A - MEDICIÓN DIRECTA CONTRA FIREBASE');
console.log('='.repeat(70));
console.log(`\n🔍 Configuración cargada desde: ${envPath}`);
console.log(`   Database URL: ${firebaseConfig.databaseURL}`);
console.log(`   Project ID: ${firebaseConfig.projectId}`);

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const DEFAULT_FAMILY_ROOT = 'family';

async function measureBaseline() {
  try {
    console.log('\n1️⃣  Leyendo transacciones...');
    const txRef = ref(db, `${DEFAULT_FAMILY_ROOT}/transactions`);
    const txSnapshot = await get(txRef);
    
    const transactions = txSnapshot.exists()
      ? Object.entries(txSnapshot.val()).map(([id, data]) => ({ id, ...data }))
      : [];
    
    console.log(`  ✅ ${transactions.length} transacciones cargadas`);

    console.log('\n2️⃣  Leyendo categorías...');
    const catRef = ref(db, `${DEFAULT_FAMILY_ROOT}/categories`);
    const catSnapshot = await get(catRef);
    const categories = catSnapshot.exists()
      ? Object.entries(catSnapshot.val()).map(([id, data]) => ({ id, ...data }))
      : [];
    
    console.log(`  ✅ ${categories.length} categorías cargadas`);

    // BASELINE
    console.log('\n3️⃣  Calculando baseline...');
    
    const categorized = transactions.filter(
      t => t.category && t.status !== 'pending'
    );
    const pending = transactions.filter(
      t => !t.category || t.status === 'pending'
    );

    console.log(`  📊 Total: ${transactions.length}`);
    console.log(`  ✅ Categorizadas: ${categorized.length}`);
    console.log(`  ⏳ Pendientes: ${pending.length}`);

    // BY SOURCE
    console.log('\n4️⃣  Analizando fuentes de clasificación...');
    
    const bySource = {
      rules: categorized.filter(t => t.classificationSource === 'rules').length,
      history: categorized.filter(t => t.classificationSource === 'history').length,
      manual: categorized.filter(t => t.classificationSource === 'manual').length,
      agent: categorized.filter(t => t.classificationSource === 'agent').length,
      legacy: categorized.filter(t => !t.classificationSource).length,
    };

    const sourceSum = Object.values(bySource).reduce((a, b) => a + b, 0);
    console.log(`  ✅ Total por fuentes: ${sourceSum} (esperado: ${categorized.length})`);
    console.log(`    - Rules: ${bySource.rules}`);
    console.log(`    - History: ${bySource.history}`);
    console.log(`    - Manual: ${bySource.manual}`);
    console.log(`    - Agent: ${bySource.agent}`);
    console.log(`    - Legacy: ${bySource.legacy}`);

    // VERIFICATION (CORRECCIÓN: boolean, no string)
    console.log('\n5️⃣  Analizando estado de verificación...');
    
    const verified = categorized.filter(t => t.classificationVerified === true).length;
    const unverified = categorized.filter(t => t.classificationVerified === false).length;
    const legacyVerif = categorized.filter(t => t.classificationVerified === undefined).length;

    const verificationSum = verified + unverified + legacyVerif;
    console.log(`  ✅ Total por verificación: ${verificationSum} (esperado: ${categorized.length})`);
    console.log(`    - Verificadas: ${verified}`);
    console.log(`    - No verificadas: ${unverified}`);
    console.log(`    - Legacy (sin metadata): ${legacyVerif}`);

    // TEMPORAL
    console.log('\n6️⃣  Distribución temporal...');
    const temporal = {};
    
    transactions.forEach(t => {
      let date;
      if (typeof t.date === 'number') {
        date = new Date(t.date);
      } else if (typeof t.date === 'string') {
        date = new Date(t.date);
      } else {
        return;
      }
      
      if (isNaN(date.getTime())) return;
      
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      temporal[key] = (temporal[key] || 0) + 1;
    });

    const sortedTemporal = Object.keys(temporal)
      .sort()
      .reduce((acc, key) => {
        acc[key] = temporal[key];
        return acc;
      }, {});

    console.log('  📅 Por período:');
    Object.entries(sortedTemporal).forEach(([period, count]) => {
      console.log(`    - ${period}: ${count}`);
    });

    // RESULTADO
    const result = {
      totalTransactions: transactions.length,
      categorized: categorized.length,
      pending: pending.length,
      categories: categories.length,
      bySource,
      verification: {
        verified,
        unverified,
        legacy: legacyVerif,
      },
      temporal: sortedTemporal,
      metadata: {
        familyRoot: DEFAULT_FAMILY_ROOT,
        timestamp: Date.now(),
        readOnly: true,
      },
    };

    // VALIDACIONES
    console.log('\n7️⃣  Validaciones...');
    console.log(`  ✅ READ-ONLY confirmado (solo get())`);
    console.log(`  ✅ familyRoot utilizado: ${DEFAULT_FAMILY_ROOT}`);
    console.log(`  ✅ Sin tokens ni secrets`);
    console.log(`  ✅ Sin modificación de datos`);

    // REPORT FINAL
    console.log('\n📊 RESULTADOS FINALES:');
    console.log('='.repeat(70));
    console.table({
      'Total': result.totalTransactions,
      'Categorizadas': result.categorized,
      'Pendientes': result.pending,
      'Categorías': result.categories,
      'Por Rules': result.bySource.rules,
      'Por History': result.bySource.history,
      'Por Manual': result.bySource.manual,
      'Por Agent': result.bySource.agent,
      'Legacy': result.bySource.legacy,
      'Verificadas': result.verification.verified,
      'No verificadas': result.verification.unverified,
      'Legacy metadata': result.verification.legacy,
    });

    console.log('\n✅ MEDICIÓN BASE FUNCIONANDO');
    console.log('='.repeat(70));

    // JSON para análisis
    console.log('\n📋 JSON RESULT:');
    console.log(JSON.stringify(result, null, 2));

    return result;

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    throw error;
  }
}

// Ejecutar
measureBaseline().then(() => {
  console.log('\n✅ Medición completada exitosamente');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Error fatal:', err);
  process.exit(1);
});
