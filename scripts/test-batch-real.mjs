/**
 * Prueba REAL de detección y análisis de batch
 * 
 * Objetivo:
 * - Analizar archivos reales en /extraxtos
 * - Verificar detección de período (especialmente con 20260812)
 * - Generar reporte de resultados
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import compiled services
const { detectStatementContext } = await import('./dist/services/contextDetection.service.js').catch(() => {
  console.error('❌ Could not import compiled services. Run: npm run build');
  process.exit(1);
});

// Mock data for testing
const mockAccounts = [
  {
    id: 'acc1',
    name: 'BROU Débito',
    bank: 'BROU',
    type: 'debit',
    currency: 'UYU',
    owner: 'Test',
  },
  {
    id: 'acc2',
    name: 'Santander Débito',
    bank: 'Santander',
    type: 'debit',
    currency: 'UYU',
    owner: 'Test',
  },
  {
    id: 'acc3',
    name: 'Itaú Débito',
    bank: 'Itaú',
    type: 'debit',
    currency: 'UYU',
    owner: 'Test',
  },
  {
    id: 'acc4',
    name: 'OCA Crédito',
    bank: 'OCA',
    type: 'credit',
    currency: 'UYU',
    owner: 'Test',
  },
];

const extractosDir = path.join(__dirname, 'extraxtos');

async function analyzeFile(filePath) {
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;

  try {
    const file = new File([fs.readFileSync(filePath)], fileName, {
      type: 'application/octet-stream',
    });

    const context = await detectStatementContext({
      file,
      fileName,
      availableAccounts: mockAccounts,
      uploadDate: new Date(),
    });

    return {
      fileName,
      fileSize,
      bank: context.bank,
      bankResolution: context.resolution.bank,
      period: context.period.month && context.period.year 
        ? `${String(context.period.month).padStart(2, '0')}/${context.period.year}`
        : 'UNRESOLVED',
      periodResolution: context.resolution.period,
      periodEvidence: context.evidence.period || 'NO EVIDENCE',
      currency: context.currency,
      currencyResolution: context.resolution.currency,
      accountNumber: context.accountNumber,
      accountResolution: context.resolution.account,
      confidence: (context.confidence * 100).toFixed(0) + '%',
      warnings: context.warnings,
      unresolvedFields: context.unresolvedFields,
      success: true,
      error: null,
    };
  } catch (error) {
    return {
      fileName,
      fileSize,
      success: false,
      error: error.message,
    };
  }
}

async function runTests() {
  console.log('='.repeat(80));
  console.log('PRUEBA REAL DE DETECCIÓN DE ARCHIVOS - FASE 03B');
  console.log('='.repeat(80));
  console.log('');

  if (!fs.existsSync(extractosDir)) {
    console.error(`❌ Directorio ${extractosDir} no encontrado`);
    process.exit(1);
  }

  const files = fs.readdirSync(extractosDir)
    .filter(f => /\.(pdf|csv|xlsx?|xls)$/i.test(f))
    .map(f => path.join(extractosDir, f));

  console.log(`📁 Encontrados ${files.length} archivos`);
  console.log('');

  if (files.length === 0) {
    console.log('⚠️  No hay archivos para analizar');
    process.exit(0);
  }

  const results = [];

  for (const filePath of files) {
    const fileName = path.basename(filePath);
    process.stdout.write(`📄 Analizando ${fileName}... `);

    const result = await analyzeFile(filePath);
    results.push(result);

    if (result.success) {
      console.log('✅');
    } else {
      console.log(`❌ ${result.error}`);
    }
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('RESULTADOS');
  console.log('='.repeat(80));
  console.log('');

  // Print table
  const successResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);

  console.log(`EXITOSOS: ${successResults.length}/${results.length}`);
  console.log('');

  // Print successful analyses
  for (const result of successResults) {
    console.log(`📄 ${result.fileName}`);
    console.log(`   Tamaño:     ${(result.fileSize / 1024).toFixed(1)} KB`);
    console.log(`   Banco:      ${result.bank || '?'} (${result.bankResolution})`);
    console.log(`   Período:    ${result.period} (${result.periodResolution})`);
    console.log(`             Evidencia: ${result.periodEvidence}`);
    console.log(`   Moneda:     ${result.currency || '?'} (${result.currencyResolution})`);
    if (result.accountNumber) {
      console.log(`   Cuenta:     ${result.accountNumber} (${result.accountResolution})`);
    }
    console.log(`   Confianza:  ${result.confidence}`);
    
    if (result.warnings.length > 0) {
      console.log(`   ⚠️  Advertencias:`);
      result.warnings.forEach(w => console.log(`       - ${w}`));
    }
    if (result.unresolvedFields.length > 0) {
      console.log(`   ⚠️  Campos sin resolver:`);
      result.unresolvedFields.forEach(f => console.log(`       - ${f}`));
    }
    console.log('');
  }

  // Print failed analyses
  if (failedResults.length > 0) {
    console.log(`ERRORES: ${failedResults.length}/${results.length}`);
    console.log('');
    for (const result of failedResults) {
      console.log(`❌ ${result.fileName}`);
      console.log(`   Error: ${result.error}`);
      console.log('');
    }
  }

  // Special focus on período detection
  console.log('='.repeat(80));
  console.log('ANÁLISIS ESPECIAL: DETECCIÓN DE PERÍODO');
  console.log('='.repeat(80));
  console.log('');

  const periodTests = [
    { pattern: '20260812', expected: 'agosto 2026 o julio 2026' },
    { pattern: 'julio', expected: 'julio' },
    { pattern: 'junio', expected: 'junio' },
    { pattern: 'V_202607', expected: 'julio 2026' },
  ];

  for (const test of periodTests) {
    const matching = results.filter(r => 
      r.fileName && r.fileName.toLowerCase().includes(test.pattern.toLowerCase())
    );

    if (matching.length > 0) {
      console.log(`Archivos con "${test.pattern}" (esperado: ${test.expected}):`);
      matching.forEach(r => {
        if (r.success) {
          console.log(`  ✓ ${r.fileName}`);
          console.log(`    → Detectado: ${r.period}`);
          console.log(`    → Evidencia: ${r.periodEvidence}`);
        } else {
          console.log(`  ✗ ${r.fileName} - Error: ${r.error}`);
        }
      });
      console.log('');
    }
  }

  // Summary
  console.log('='.repeat(80));
  console.log('RESUMEN');
  console.log('='.repeat(80));
  console.log(`Total archivos:     ${results.length}`);
  console.log(`Analizados:         ${successResults.length}`);
  console.log(`Errores:            ${failedResults.length}`);
  console.log(`Confianza promedio: ${(
    successResults.reduce((sum, r) => sum + parseInt(r.confidence), 0) / successResults.length || 0
  ).toFixed(0)}%`);
  console.log('');
  console.log('✅ Prueba completada');
}

// Mock File class for Node.js
if (typeof File === 'undefined') {
  globalThis.File = class File extends Blob {
    constructor(parts, filename, options) {
      super(parts, options);
      this.name = filename;
      this.lastModified = options?.lastModified || Date.now();
    }
  };
}

// Mock Blob if needed
if (typeof Blob === 'undefined') {
  globalThis.Blob = Buffer;
}

runTests().catch(console.error);
