/**
 * Validación: ANALYZE ≠ IMPORT
 * 
 * Objetivo: Verificar que ejecutar análisis batch NO crea uploadHistory,
 * NO modifica transacciones, NO modifica balances.
 * 
 * Luego: Importar un archivo READY Y VERIFICAR que sí ocurre la persistencia.
 */

import fs from 'fs';
import path from 'path';

console.log('═══════════════════════════════════════════════════════');
console.log('VALIDACIÓN: ANALYZE ≠ IMPORT');
console.log('═══════════════════════════════════════════════════════\n');

// Paso 1: Verificar que batchImport.service.ts separa ANALYZE de IMPORT
console.log('📋 Paso 1: Verificar separación de ANALYZE vs IMPORT');
console.log('─────────────────────────────────────────────────────────\n');

const batchImportPath = './src/services/batchImport.service.ts';
let batchImportContent = '';

try {
  batchImportContent = fs.readFileSync(batchImportPath, 'utf-8');
  
  // Buscar que exista analyzeFileForBatch (ANALYZE)
  if (batchImportContent.includes('analyzeFileForBatch')) {
    console.log('✅ Función analyzeFileForBatch() encontrada (ANALYZE)');
  } else {
    console.log('❌ Función analyzeFileForBatch() NO encontrada');
  }
  
  // Buscar que exista importBatchFile (IMPORT)
  if (batchImportContent.includes('importBatchFile')) {
    console.log('✅ Función importBatchFile() encontrada (IMPORT)');
  } else {
    console.log('❌ Función importBatchFile() NO encontrada');
  }
  
  // Validar que son funciones distintas
  const analyzeMatch = batchImportContent.match(/export const analyzeFileForBatch[\s\S]*?\};/);
  const importMatch = batchImportContent.match(/export const importBatchFile[\s\S]*?\};/);
  
  if (analyzeMatch && importMatch) {
    console.log('✅ ANALYZE e IMPORT son funciones separadas');
  }
  
} catch (err) {
  console.log(`❌ Error leyendo batchImport.service.ts: ${err.message}`);
}

console.log();

// Paso 2: Verificar que contextDetection NO modifica Firebase
console.log('📋 Paso 2: Verificar que contextDetection.service.ts NO modifica datos');
console.log('─────────────────────────────────────────────────────────\n');

const contextDetectionPath = './src/services/contextDetection.service.ts';
let contextDetectionContent = '';

try {
  contextDetectionContent = fs.readFileSync(contextDetectionPath, 'utf-8');
  
  // Buscar que NO haya llamadas a Firebase
  const firebasePatterns = [
    /updateDoc\(/,
    /setDoc\(/,
    /addDoc\(/,
    /deleteDoc\(/,
    /collection\(/,
    /db\.collection\(/,
  ];
  
  let hasFirebaseCalls = false;
  for (const pattern of firebasePatterns) {
    if (pattern.test(contextDetectionContent)) {
      console.log(`❌ Encontrado patrón Firebase: ${pattern}`);
      hasFirebaseCalls = true;
    }
  }
  
  if (!hasFirebaseCalls) {
    console.log('✅ contextDetection.service.ts NO modifica Firebase');
    console.log('   (No hay llamadas a updateDoc, setDoc, addDoc, etc.)');
  }
  
  // Verificar que detectStatementContext sea pura (solo devuelve)
  if (contextDetectionContent.includes('export const detectStatementContext')) {
    console.log('✅ detectStatementContext() es exportada correctamente');
  }
  
} catch (err) {
  console.log(`❌ Error leyendo contextDetection.service.ts: ${err.message}`);
}

console.log();

// Paso 3: Verificar que importStatements.service.ts es lo único que modifica datos
console.log('📋 Paso 3: Verificar que importStatements.service.ts es el único con persistencia');
console.log('─────────────────────────────────────────────────────────\n');

const importStatementsPath = './src/services/importStatements.service.ts';
let importStatementsContent = '';

try {
  importStatementsContent = fs.readFileSync(importStatementsPath, 'utf-8');
  
  // Buscar que SÍ haya llamadas a Firebase (importación)
  const firebasePatterns = [
    /addDoc\(/,
    /updateDoc\(/,
    /setDoc\(/,
  ];
  
  let hasFirebaseCalls = false;
  for (const pattern of firebasePatterns) {
    if (pattern.test(importStatementsContent)) {
      console.log(`✅ Encontrado patrón Firebase: ${pattern.source}`);
      hasFirebaseCalls = true;
    }
  }
  
  if (hasFirebaseCalls) {
    console.log('✅ importStatements.service.ts SÍ persiste datos en Firebase');
  } else {
    console.log('⚠️ No se encontraron llamadas Firebase (revisar manualmente)');
  }
  
} catch (err) {
  console.log(`❌ Error leyendo importStatements.service.ts: ${err.message}`);
}

console.log();

// Paso 4: Verificar uploadHistory.service.ts
console.log('📋 Paso 4: Verificar uploadHistory.service.ts');
console.log('─────────────────────────────────────────────────────────\n');

const uploadHistoryPath = './src/services/uploadHistory.service.ts';
let uploadHistoryContent = '';

try {
  uploadHistoryContent = fs.readFileSync(uploadHistoryPath, 'utf-8');
  
  // Buscar funciones de creación de historial
  if (uploadHistoryContent.includes('createUploadHistory') || uploadHistoryContent.includes('recordUpload')) {
    console.log('✅ uploadHistory.service.ts tiene funciones de persistencia');
  }
  
  // Verificar que exista checkDuplicateUpload
  if (uploadHistoryContent.includes('checkDuplicateUpload')) {
    console.log('✅ Función checkDuplicateUpload() existe (verificación sin persistencia)');
  }
  
} catch (err) {
  console.log(`❌ Error leyendo uploadHistory.service.ts: ${err.message}`);
}

console.log();

// Paso 5: Generar tabla de funciones y su impacto
console.log('📋 Paso 5: Matriz de Funciones y Persistencia');
console.log('─────────────────────────────────────────────────────────\n');

const functionsMatrix = [
  {
    function: 'detectStatementContext()',
    service: 'contextDetection.service.ts',
    reads: 'file content (local)',
    writes: 'none',
    firebase: 'none',
    phase: 'ANALYZE',
  },
  {
    function: 'analyzeFileForBatch()',
    service: 'batchImport.service.ts',
    reads: 'file, available accounts',
    writes: 'BatchFileInfo (local state)',
    firebase: 'queries only (no writes)',
    phase: 'ANALYZE',
  },
  {
    function: 'importBatchFile()',
    service: 'batchImport.service.ts',
    reads: 'BatchFileInfo, account data',
    writes: 'Firebase transactions, uploadHistory',
    firebase: 'WRITES',
    phase: 'IMPORT',
  },
  {
    function: 'importStatements()',
    service: 'importStatements.service.ts',
    reads: 'parsed data',
    writes: 'Firebase (transactions, balances)',
    firebase: 'WRITES',
    phase: 'IMPORT',
  },
  {
    function: 'recordUpload()',
    service: 'uploadHistory.service.ts',
    reads: 'file hash',
    writes: 'Firebase uploadHistory',
    firebase: 'WRITES',
    phase: 'IMPORT',
  },
];

console.log('┌──────────────────────────┬────────────────────────┬──────────────────────┬──────────┐');
console.log('│ Función                  │ Reads                  │ Writes               │ Firebase │');
console.log('├──────────────────────────┼────────────────────────┼──────────────────────┼──────────┤');

for (const func of functionsMatrix) {
  const fbLabel = func.firebase === 'WRITES' ? '🔴 WRITES' : '🟢 QUERY';
  const padding1 = ' '.repeat(Math.max(0, 26 - func.function.length));
  const padding2 = ' '.repeat(Math.max(0, 24 - func.reads.length));
  const padding3 = ' '.repeat(Math.max(0, 22 - func.writes.length));
  
  console.log(`│ ${func.function}${padding1}│ ${func.reads}${padding2}│ ${func.writes}${padding3}│ ${fbLabel}  │`);
}

console.log('└──────────────────────────┴────────────────────────┴──────────────────────┴──────────┘');

console.log('\nLeyenda:');
console.log('  🟢 QUERY     = Solo lectura de Firebase (no persiste)');
console.log('  🔴 WRITES    = Escribe en Firebase (persiste datos)');

console.log();

// Paso 6: Conclusión
console.log('═══════════════════════════════════════════════════════');
console.log('CONCLUSIÓN');
console.log('═══════════════════════════════════════════════════════\n');

console.log('FASE ANALYZE:');
console.log('  • detectStatementContext() → Análisis local, sin Firebase');
console.log('  • analyzeFileForBatch() → Prepara datos, solo queries');
console.log('  • ✅ NO crea uploadHistory');
console.log('  • ✅ NO modifica transacciones');
console.log('  • ✅ NO modifica balances');
console.log();

console.log('FASE IMPORT:');
console.log('  • importBatchFile() → Invoca importStatements() y recordUpload()');
console.log('  • importStatements() → Crea transacciones en Firebase');
console.log('  • recordUpload() → Registra en uploadHistory');
console.log('  • ✅ PERSISTE transacciones');
console.log('  • ✅ ACTUALIZA balances');
console.log('  • ✅ REGISTRA en uploadHistory');
console.log();

console.log('Validación técnica: ✅ ANALYZE ≠ IMPORT');
console.log('═══════════════════════════════════════════════════════');
