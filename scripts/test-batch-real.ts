/**
 * Prueba REAL de detección de batch
 * Ejecutar: npx ts-node test-batch-real.ts
 */

import fs from 'fs';
import path from 'path';
import { detectStatementContext } from './src/services/contextDetection.service';

// Mock data
const mockAccounts = [
  { id: 'acc1', name: 'BROU Débito', bank: 'BROU', type: 'debit' as const, currency: 'UYU' as const, owner: 'Test', initialBalance: 0 },
  { id: 'acc2', name: 'Santander Débito', bank: 'Santander', type: 'debit' as const, currency: 'UYU' as const, owner: 'Test', initialBalance: 0 },
  { id: 'acc3', name: 'Itaú Débito', bank: 'Itaú', type: 'debit' as const, currency: 'UYU' as const, owner: 'Test', initialBalance: 0 },
  { id: 'acc4', name: 'OCA Crédito', bank: 'OCA', type: 'credit' as const, currency: 'UYU' as const, owner: 'Test', initialBalance: 0 },
];

async function analyzeFile(filePath: string) {
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;

  try {
    // Create a File object from the buffer
    const buffer = fs.readFileSync(filePath);
    const file = new File([buffer], fileName, { type: 'application/octet-stream' });

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
  } catch (error: any) {
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

  const extractosDir = path.join(__dirname, 'extraxtos');

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
  console.log('RESULTADOS DETALLADOS');
  console.log('='.repeat(80));
  console.log('');

  const successResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);

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
      result.warnings.forEach((w: string) => console.log(`       - ${w}`));
    }
    if (result.unresolvedFields.length > 0) {
      console.log(`   ⚠️  Campos sin resolver:`);
      result.unresolvedFields.forEach((f: string) => console.log(`       - ${f}`));
    }
    console.log('');
  }

  // Print failed analyses
  if (failedResults.length > 0) {
    console.log(`❌ ERRORES: ${failedResults.length} archivo(s)`);
    console.log('');
    for (const result of failedResults) {
      console.log(`   ${result.fileName}: ${result.error}`);
    }
    console.log('');
  }

  // Special focus on período detection
  console.log('='.repeat(80));
  console.log('ANÁLISIS ESPECIAL: DETECCIÓN DE PERÍODO');
  console.log('='.repeat(80));
  console.log('');

  const periodPatterns = [
    { pattern: '20260812', desc: 'Fecha numérica (20260812)' },
    { pattern: 'julio', desc: 'Mes explícito "julio"' },
    { pattern: 'junio', desc: 'Mes explícito "junio"' },
    { pattern: 'V_202607', desc: 'Formato V_YYYYMM' },
  ];

  for (const test of periodPatterns) {
    const matching = successResults.filter(r => 
      r.fileName && r.fileName.toLowerCase().includes(test.pattern.toLowerCase())
    );

    if (matching.length > 0) {
      console.log(`${test.desc}:`);
      matching.forEach(r => {
        console.log(`  ✓ ${r.fileName}`);
        console.log(`    → Detectado: ${r.period}`);
        console.log(`    → Evidencia: ${r.periodEvidence}`);
        console.log(`    → Resolución: ${r.periodResolution}`);
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
  const avgConfidence = successResults.length > 0
    ? successResults.reduce((sum, r: any) => sum + parseInt(r.confidence), 0) / successResults.length
    : 0;
  console.log(`Confianza promedio: ${avgConfidence.toFixed(0)}%`);
  console.log('');
  console.log('✅ Prueba completada');
}

runTests().catch(console.error);
