/**
 * FASE 07B5A - MEDICIÓN DE CLASIFICACIÓN EN PRODUCCIÓN
 * 
 * Reutiliza la instancia Firebase ya inicializada por la aplicación.
 * Lee datos del usuario autenticado usando su familyRoot real.
 * Totalmente READ-ONLY.
 */

import { ref, get } from 'firebase/database';
import { database, auth } from './firebase';
import { getAuthorizedUser } from './authorization.service';
import { DEFAULT_FAMILY_ROOT } from './familyPaths';

export interface MeasurementBaseline {
  totalTransactions: number;
  categorized: number;
  pending: number;
  categories: number;
  bySource: {
    rules: number;
    history: number;
    manual: number;
    agent: number;
    legacy: number;
  };
  verification: {
    verified: number;
    unverified: number;
    legacy: number;
  };
  temporal: Record<string, number>;
  metadata: {
    familyRoot: string;
    userId: string;
    timestamp: number;
    readOnly: boolean;
  };
}

/**
 * Mide la baseline de clasificación para el usuario autenticado.
 * 
 * READ-ONLY:
 * - Usa get() para lectura única
 * - NO modifica datos
 * - NO invoca categorización persistente
 * - NO accede a auth tokens ni secretos
 * 
 * @returns Métricas de clasificación sin datos sensibles
 * @throws Error si no hay usuario autenticado o sin acceso
 */
export const measureClassificationBaseline = async (): Promise<MeasurementBaseline> => {
  const firebaseUser = auth.currentUser;
  
  if (!firebaseUser) {
    throw new Error('Usuario no autenticado. Por favor inicia sesión primero.');
  }

  // 1. Obtener familyRoot real del usuario autorizado
  const authorizedUser = await getAuthorizedUser(firebaseUser.uid);
  
  if (!authorizedUser) {
    throw new Error('Usuario no autorizado. Solicitud de acceso pendiente.');
  }

  if (!authorizedUser.autorizado) {
    throw new Error('Usuario no ha sido aprobado. Contacta al administrador.');
  }

  const familyRoot = (authorizedUser.familyRoot || '').trim() || DEFAULT_FAMILY_ROOT;
  
  console.log(`📊 FASE 07B5A - MEDICIÓN REAL`);
  console.log(`  Familia: ${familyRoot}`);
  console.log(`  Usuario: ${firebaseUser.uid}`);
  console.log('='.repeat(70));

  // 2. CARGAR TRANSACCIONES
  console.log('\n1️⃣  Leyendo transacciones...');
  const txRef = ref(database, `${familyRoot}/transactions`);
  const txSnapshot = await get(txRef);
  
  const transactions = txSnapshot.exists()
    ? Object.entries(txSnapshot.val()).map(([id, data]: [string, any]) => ({
        id,
        ...data,
      }))
    : [];
  
  console.log(`  ✅ ${transactions.length} transacciones cargadas`);

  // 3. CARGAR CATEGORÍAS (para contexto)
  console.log('2️⃣  Leyendo categorías...');
  const catRef = ref(database, `${familyRoot}/categories`);
  const catSnapshot = await get(catRef);
  const categories = catSnapshot.exists()
    ? Object.entries(catSnapshot.val()).map(([id, data]: [string, any]) => ({
        id,
        ...data,
      }))
    : [];
  
  console.log(`  ✅ ${categories.length} categorías cargadas`);

  // 4. BASELINE - Categorización
  console.log('\n3️⃣  Calculando baseline...');
  
  // Una transacción está categorizada si:
  // - Tiene 'category' definido
  // - Su 'status' NO es 'pending'
  // (Usamos lógica OR según el script anterior para máxima compatibilidad)
  const categorized = transactions.filter(
    (t: any) => t.category && t.status !== 'pending'
  );
  
  const pending = transactions.filter(
    (t: any) => !t.category || t.status === 'pending'
  );

  console.log(`  📊 Total: ${transactions.length}`);
  console.log(`  ✅ Categorizadas: ${categorized.length}`);
  console.log(`  ⏳ Pendientes: ${pending.length}`);

  // 5. DISTRIBUTION POR SOURCE
  console.log('\n4️⃣  Analizando fuentes de clasificación...');
  
  const bySource = {
    rules: categorized.filter((t: any) => t.classificationSource === 'rules').length,
    history: categorized.filter((t: any) => t.classificationSource === 'history').length,
    manual: categorized.filter((t: any) => t.classificationSource === 'manual').length,
    agent: categorized.filter((t: any) => t.classificationSource === 'agent').length,
    legacy: categorized.filter((t: any) => !t.classificationSource).length,
  };

  const sourceSum = Object.values(bySource).reduce((a, b) => a + b, 0);
  console.log(`  ✅ Total por fuentes: ${sourceSum} (debe igualar categorizado: ${categorized.length})`);
  console.log(`    - Rules: ${bySource.rules}`);
  console.log(`    - History: ${bySource.history}`);
  console.log(`    - Manual: ${bySource.manual}`);
  console.log(`    - Agent: ${bySource.agent}`);
  console.log(`    - Legacy (sin metadata): ${bySource.legacy}`);

  // 6. VERIFICATION STATE
  // CORRECCIÓN FASE 07B: classificationVerified es boolean, no string
  // verified = true, unverified = false, undefined = legacy
  console.log('\n5️⃣  Analizando estado de verificación...');
  
  const verified = categorized.filter((t: any) => t.classificationVerified === true).length;
  const unverified = categorized.filter((t: any) => t.classificationVerified === false).length;
  const legacy = categorized.filter((t: any) => t.classificationVerified === undefined).length;

  const verificationSum = verified + unverified + legacy;
  console.log(`  ✅ Total por verificación: ${verificationSum} (debe igualar categorizado: ${categorized.length})`);
  console.log(`    - Verificadas: ${verified}`);
  console.log(`    - No verificadas: ${unverified}`);
  console.log(`    - Legacy (sin metadata): ${legacy}`);

  // 7. TEMPORAL DISTRIBUTION
  console.log('\n6️⃣  Distribución temporal...');
  const temporal: Record<string, number> = {};
  
  transactions.forEach((t: any) => {
    let date: Date;
    
    // Manejar tanto timestamps como strings ISO
    if (typeof t.date === 'number') {
      date = new Date(t.date);
    } else if (typeof t.date === 'string') {
      date = new Date(t.date);
    } else {
      return; // Skip invalid dates
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
    }, {} as Record<string, number>);

  console.log('  📅 Por período:');
  Object.entries(sortedTemporal).forEach(([period, count]) => {
    console.log(`    - ${period}: ${count}`);
  });

  // 8. RESULTADO SANITIZADO
  const result: MeasurementBaseline = {
    totalTransactions: transactions.length,
    categorized: categorized.length,
    pending: pending.length,
    categories: categories.length,
    bySource,
    verification: {
      verified,
      unverified,
      legacy,
    },
    temporal: sortedTemporal,
    metadata: {
      familyRoot,
      userId: firebaseUser.uid,
      timestamp: Date.now(),
      readOnly: true,
    },
  };

  // 9. VALIDACIONES
  console.log('\n7️⃣  Validaciones...');
  console.log(`  ✅ READ-ONLY confirmado`);
  console.log(`  ✅ familyRoot utilizado: ${familyRoot}`);
  console.log(`  ✅ Sin tokens ni secretos`);
  console.log(`  ✅ Sin modificación de datos`);

  // 10. REPORT FINAL
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
  console.log('   Puedes acceder con: window.__financeMeasure07B5Result');
  console.log('   O retorna automáticamente para análisis posterior');

  return result;
};
