#!/usr/bin/env node

/**
 * Validación FASE 02 — Detección de Contexto
 * Script simple de Node.js para probar detección contra archivos reales
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Detecta banco desde el contenido del archivo
 */
function detectBank(content) {
  const contentLower = content.toLowerCase();

  if (contentLower.includes('brou') || contentLower.includes('banco republica')) {
    return 'BROU';
  }
  if (contentLower.includes('itau') || contentLower.includes('itaú')) {
    return 'Itaú';
  }
  if (contentLower.includes('santander')) {
    return 'Santander';
  }
  if (contentLower.includes('oca')) {
    return 'OCA';
  }
  if (contentLower.includes('prex')) {
    return 'Prex';
  }
  if (contentLower.includes('bhu') || contentLower.includes('banco hipotecario')) {
    return 'BHU';
  }
  if (
    contentLower.includes('ibm') ||
    contentLower.includes('employees stock purchase plan') ||
    contentLower.includes('portfolio details')
  ) {
    return 'IBM';
  }

  return null;
}

/**
 * Detecta período desde el nombre del archivo
 */
function detectPeriodFromFileName(fileName) {
  const lowerName = fileName.toLowerCase();

  const monthNames = {
    enero: 1,
    febrero: 2,
    marzo: 3,
    abril: 4,
    mayo: 5,
    junio: 6,
    julio: 7,
    agosto: 8,
    septiembre: 9,
    setiembre: 9,
    octubre: 10,
    noviembre: 11,
    diciembre: 12,
  };

  // PRIORIDAD 1: Mes explícito en el nombre
  for (const [monthName, monthNum] of Object.entries(monthNames)) {
    if (lowerName.includes(monthName)) {
      const yearMatch = fileName.match(/202\d/);
      const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
      return {
        month: monthNum,
        year,
        evidence: `filename_month_name: "${monthName}" + año ${year}`,
        confidence: 'HIGH',
      };
    }
  }

  // PRIORIDAD 2: Patrón YYYY-MM o MM-YYYY
  const patterns = [
    {
      regex: /(\d{4})[-_](\d{1,2})(?:[^0-9]|$)/,
      parser: (m) => ({
        month: parseInt(m[1]),
        year: parseInt(m[2]),
      }),
      desc: 'YYYY-MM format',
    },
    {
      regex: /(\d{1,2})[-_](\d{4})(?:[^0-9]|$)/,
      parser: (m) => ({
        month: parseInt(m[0]),
        year: parseInt(m[1]),
      }),
      desc: 'MM-YYYY format',
    },
  ];

  for (const { regex, parser, desc } of patterns) {
    const match = lowerName.match(regex);
    if (match) {
      const result = parser(match);
      if (result.month >= 1 && result.month <= 12) {
        return { ...result, evidence: desc, confidence: 'MEDIUM' };
      }
    }
  }

  // PRIORIDAD 3: Patrón YYYYMMDD (marcar como sospechoso)
  const dateMatch = lowerName.match(/\b(\d{8})\b/);
  if (dateMatch) {
    const d = dateMatch[1];
    const month = parseInt(d.substring(4, 6));
    const year = parseInt(d.substring(0, 4));
    if (month >= 1 && month <= 12) {
      return {
        month,
        year,
        evidence: `YYYYMMDD_pattern: ${d} (puede ser fecha de descarga)`,
        confidence: 'LOW',
      };
    }
  }

  return { month: null, year: null, evidence: '', confidence: 'NONE' };
}

/**
 * Detecta número de cuenta
 */
function detectAccountNumber(content) {
  const patterns = [
    /Cuenta[:\s]+(\d{3}-\d{2}-\d{6}-\d)/i,
    /Número de cuenta[:\s]+([0-9-]+)/i,
    /Account[:\s]+([0-9-]+)/i,
    /\b(\d{3}-\d{2}-\d{6}-\d)\b/,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return { number: match[1].trim(), evidence: 'Account number pattern match' };
    }
  }

  return { number: null, evidence: '' };
}

/**
 * Lee contenido de un archivo (para archivos pequeños)
 */
function readFileContent(filePath, fileName) {
  const size = fs.statSync(filePath).size;

  // Solo leer archivos pequeños de texto (primeros 50KB)
  if (fileName.endsWith('.csv')) {
    try {
      return fs.readFileSync(filePath, 'utf-8').substring(0, 50000);
    } catch (e) {
      return '';
    }
  }

  if (fileName.endsWith('.pdf') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    // Para estos, extraemos información del nombre primero
    return '';
  }

  return '';
}

/**
 * Valida un archivo
 */
function validateFile(fileName, filePath) {
  const content = readFileContent(filePath, fileName);

  // Detectar banco
  const bankDetection = detectBank(content);

  // Detectar período
  const periodDetection = detectPeriodFromFileName(fileName);

  // Detectar cuenta
  const accountDetection = detectAccountNumber(content);

  // Resolver estado
  const resolved = {
    banco: bankDetection ? 'RESOLVED' : 'UNRESOLVED',
    periodo: periodDetection.month ? (periodDetection.confidence === 'HIGH' ? 'RESOLVED' : 'NEEDS_CONFIRMATION') : 'UNRESOLVED',
    cuenta: accountDetection.number ? 'RESOLVED' : 'UNRESOLVED',
    moneda: 'UNRESOLVED', // No se detecta automáticamente de nombre
  };

  const unresolvedCount = Object.values(resolved).filter((s) => s === 'UNRESOLVED').length;
  const confidence = (1 - unresolvedCount / Object.keys(resolved).length) * 100;

  return {
    archivo: fileName,
    banco: bankDetection || '?',
    bancoStatus: resolved.banco,
    periodo: periodDetection.month ? `${periodDetection.month}/${periodDetection.year}` : '?',
    periodoStatus: resolved.periodo,
    periodoConfidence: periodDetection.confidence,
    cuenta: accountDetection.number || '?',
    cuentaStatus: resolved.cuenta,
    moneda: '?',
    monedaStatus: resolved.moneda,
    confidence: confidence.toFixed(0) + '%',
    estado: unresolvedCount === 0 ? '✓ READY' : '⚠ NEEDS_CONFIRMATION',
    evidencia: {
      banco: bankDetection ? 'Detectado en contenido' : 'No encontrado',
      periodo: periodDetection.evidence || 'No encontrado',
      cuenta: accountDetection.evidence || 'No encontrado',
    },
  };
}

/**
 * Main
 */
function main() {
  const extractsDir = path.join(__dirname, 'extraxtos');

  console.log('═'.repeat(120));
  console.log('VALIDACIÓN FASE 02 — DETECCIÓN DE CONTEXTO');
  console.log('═'.repeat(120));
  console.log('');

  if (!fs.existsSync(extractsDir)) {
    console.error(`❌ Directorio no encontrado: ${extractsDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(extractsDir)
    .filter((f) => !fs.statSync(path.join(extractsDir, f)).isDirectory())
    .sort();

  console.log(`📂 Encontrados ${files.length} archivos\n`);

  const results = [];

  for (const fileName of files) {
    const filePath = path.join(extractsDir, fileName);
    const result = validateFile(fileName, filePath);
    results.push(result);

    console.log(`📄 ${fileName}`);
    console.log(`   Banco:        ${result.banco} [${result.bancoStatus}]`);
    console.log(`   Período:      ${result.periodo} [${result.periodoStatus}] (confianza: ${result.periodoConfidence})`);
    console.log(`   Cuenta:       ${result.cuenta} [${result.cuentaStatus}]`);
    console.log(`   Moneda:       ${result.moneda} [${result.monedaStatus}]`);
    console.log(`   Confianza:    ${result.confidence}`);
    console.log(`   Estado:       ${result.estado}`);
    console.log(`   Evidencia:`);
    console.log(`     - Banco: ${result.evidencia.banco}`);
    console.log(`     - Período: ${result.evidencia.periodo}`);
    console.log(`     - Cuenta: ${result.evidencia.cuenta}`);
    console.log('');
  }

  // Tabla resumen
  console.log('═'.repeat(120));
  console.log('TABLA RESUMEN');
  console.log('═'.repeat(120));
  console.table(results);

  // Estadísticas
  const ready = results.filter((r) => r.estado.includes('READY')).length;
  const needsConfirm = results.filter((r) => r.estado.includes('NEEDS_CONFIRMATION')).length;

  console.log('');
  console.log('═'.repeat(120));
  console.log('ESTADÍSTICAS');
  console.log('═'.repeat(120));
  console.log(`✓ READY (importar directamente):          ${ready}/${results.length}`);
  console.log(`⚠ NEEDS_CONFIRMATION (requieren revisión): ${needsConfirm}/${results.length}`);
  console.log('');

  // Problemas identificados
  console.log('═'.repeat(120));
  console.log('PROBLEMAS IDENTIFICADOS');
  console.log('═'.repeat(120));

  const unresolvedBanks = results.filter((r) => r.bancoStatus === 'UNRESOLVED');
  const unresolvedPeriods = results.filter((r) => r.periodoStatus === 'UNRESOLVED');
  const suspiciousPeriods = results.filter((r) => r.periodoConfidence === 'LOW');

  if (unresolvedBanks.length > 0) {
    console.log(`\n❌ BANCO NO DETECTADO (${unresolvedBanks.length}):`);
    unresolvedBanks.forEach((r) => console.log(`   - ${r.archivo}`));
  }

  if (unresolvedPeriods.length > 0) {
    console.log(`\n❌ PERÍODO NO DETECTADO (${unresolvedPeriods.length}):`);
    unresolvedPeriods.forEach((r) => console.log(`   - ${r.archivo}`));
  }

  if (suspiciousPeriods.length > 0) {
    console.log(`\n⚠️  PERÍODO SOSPECHOSO (baja confianza, ${suspiciousPeriods.length}):`);
    suspiciousPeriods.forEach((r) => console.log(`   - ${r.archivo} (detectado como ${r.periodo})`));
  }

  console.log('\n');
}

main();
