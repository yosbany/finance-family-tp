/**
 * Script de Validación FASE 02 — Detección de Contexto
 * 
 * Prueba la detección de banco, período, moneda y cuenta contra los
 * archivos reales disponibles en /extraxtos
 * 
 * Ejecutar: npx ts-node validate-fase02.ts
 */

import fs from 'fs';
import path from 'path';
import { detectBank } from './src/parsers/banks/index';

// Tipos simulados para evitar dependencias complejas
interface Account {
  id: string;
  name: string;
  bank: string;
  type: 'debit' | 'credit' | 'investment';
  currency: string;
  owner: string;
}

interface DetectedStatementContext {
  bank: string | null;
  accountNumber: string | null;
  accountType: 'debit' | 'credit' | 'investment' | null;
  currency: string | null;
  period: {
    month: number | null;
    year: number | null;
  };
  resolution: {
    bank: 'RESOLVED' | 'NEEDS_CONFIRMATION' | 'UNRESOLVED';
    account: 'RESOLVED' | 'NEEDS_CONFIRMATION' | 'UNRESOLVED';
    currency: 'RESOLVED' | 'NEEDS_CONFIRMATION' | 'UNRESOLVED';
    period: 'RESOLVED' | 'NEEDS_CONFIRMATION' | 'UNRESOLVED';
  };
  confidence: number;
  unresolvedFields: string[];
  warnings: string[];
  evidence: {
    bank?: string;
    period?: string;
    account?: string;
    currency?: string;
  };
}

/**
 * Detecta período desde el nombre del archivo
 */
const detectPeriodFromFileName = (
  fileName: string
): { month: number | null; year: number | null; evidence: string } => {
  const lowerName = fileName.toLowerCase();

  // Buscar mes explícito en el nombre (ej: "julio", "julio", "junio")
  const monthNames: Record<string, number> = {
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
      // Si encontramos el mes, asumir el año actual o año disponible en el nombre
      const yearMatch = fileName.match(/202\d/);
      const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
      return {
        month: monthNum,
        year,
        evidence: `filename_month_name: "${monthName}" + año ${year}`,
      };
    }
  }

  // PRIORIDAD 2: Patrón YYYY-MM o MM-YYYY
  const patterns = [
    {
      regex: /(\d{4})[-_](\d{1,2})(?:[^0-9]|$)/,
      parser: (m: RegExpMatchArray) => ({
        month: parseInt(m[2]),
        year: parseInt(m[1]),
      }),
      desc: 'YYYY-MM format',
    },
    {
      regex: /(\d{1,2})[-_](\d{4})(?:[^0-9]|$)/,
      parser: (m: RegExpMatchArray) => ({
        month: parseInt(m[1]),
        year: parseInt(m[2]),
      }),
      desc: 'MM-YYYY format',
    },
  ];

  for (const { regex, parser, desc } of patterns) {
    const match = lowerName.match(regex);
    if (match) {
      const result = parser(match);
      if (result.month >= 1 && result.month <= 12) {
        return { ...result, evidence: desc };
      }
    }
  }

  // PRIORIDAD 3: Patrón YYYYMMDD (pero marcar como NEEDS_CONFIRMATION)
  const dateMatch = lowerName.match(/\b(\d{8})\b/);
  if (dateMatch) {
    const d = dateMatch[1];
    const month = parseInt(d.substring(4, 6));
    const year = parseInt(d.substring(0, 4));
    if (month >= 1 && month <= 12) {
      return {
        month,
        year,
        evidence: `YYYYMMDD_pattern: ${d} (puede ser fecha de descarga, no período)`,
      };
    }
  }

  return { month: null, year: null, evidence: '' };
};

/**
 * Detecta número de cuenta desde el contenido del archivo
 */
const detectAccountNumber = (content: string): { number: string | null; evidence: string } => {
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
};

/**
 * Detecta banco desde contenido
 */
const detectBankFromContent = (content: string): { bank: string | null; evidence: string } => {
  const detected = detectBank(content);
  if (detected) {
    return { bank: detected, evidence: 'Content analysis' };
  }
  return { bank: null, evidence: '' };
};

/**
 * Función principal: Detectar contexto del extracto
 */
const detectStatementContext = (fileName: string, fileContent: string): DetectedStatementContext => {
  const context: DetectedStatementContext = {
    bank: null,
    accountNumber: null,
    accountType: null,
    currency: null,
    period: { month: null, year: null },
    resolution: {
      bank: 'UNRESOLVED',
      account: 'UNRESOLVED',
      currency: 'UNRESOLVED',
      period: 'UNRESOLVED',
    },
    confidence: 0,
    unresolvedFields: [],
    warnings: [],
    evidence: {},
  };

  // 1. Detectar período desde nombre
  const periodFromName = detectPeriodFromFileName(fileName);
  if (periodFromName.month && periodFromName.year) {
    context.period = { month: periodFromName.month, year: periodFromName.year };
    // Si contiene mes explícito, RESOLVED; si es YYYYMMDD, NEEDS_CONFIRMATION
    context.resolution.period = periodFromName.evidence.includes('filename_month_name')
      ? 'RESOLVED'
      : 'NEEDS_CONFIRMATION';
    context.evidence.period = periodFromName.evidence;
  }

  // 2. Detectar banco desde contenido
  if (fileContent) {
    const bankDetection = detectBankFromContent(fileContent);
    if (bankDetection.bank) {
      context.bank = bankDetection.bank;
      context.resolution.bank = 'RESOLVED';
      context.evidence.bank = bankDetection.evidence;
    }

    // 3. Detectar número de cuenta
    const accountNum = detectAccountNumber(fileContent);
    if (accountNum.number) {
      context.accountNumber = accountNum.number;
      context.evidence.account = accountNum.evidence;
    }
  }

  // 4. Calcular confianza
  const resolvedCount = Object.values(context.resolution).filter((s) => s === 'RESOLVED').length;
  const totalFields = Object.keys(context.resolution).length;
  context.confidence = resolvedCount / totalFields;

  // 5. Identificar campos no resueltos
  context.unresolvedFields = Object.entries(context.resolution)
    .filter(([_, status]) => status !== 'RESOLVED')
    .map(([field, status]) => `${field}: ${status}`);

  return context;
};

/**
 * Leer archivos del directorio de extractos
 */
async function main() {
  const extractsDir = './extraxtos';

  console.log('='.repeat(100));
  console.log('VALIDACIÓN FASE 02 — DETECCIÓN DE CONTEXTO');
  console.log('='.repeat(100));
  console.log('');

  if (!fs.existsSync(extractsDir)) {
    console.error(`❌ Directorio no encontrado: ${extractsDir}`);
    return;
  }

  const files = fs.readdirSync(extractsDir).filter((f) => {
    return !fs.statSync(path.join(extractsDir, f)).isDirectory();
  });

  console.log(`📂 Encontrados ${files.length} archivos en ${extractsDir}\n`);

  const results: any[] = [];

  for (const fileName of files) {
    const filePath = path.join(extractsDir, fileName);
    let fileContent = '';

    try {
      // Intentar leer el contenido (solo para archivos de texto)
      if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
        fileContent = fs.readFileSync(filePath, 'utf-8');
      } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
        // Para Excel, intentamos un fallback
        fileContent = `[EXCEL FILE: ${fileName}] - Contenido no extraído en script (requiere librería XLSX)`;
      } else if (fileName.endsWith('.pdf')) {
        fileContent = `[PDF FILE: ${fileName}] - Contenido no extraído en script (requiere librería pdfjs)`;
      }
    } catch (error: any) {
      console.warn(`⚠️  No se pudo leer ${fileName}: ${error.message}`);
      fileContent = '';
    }

    const context = detectStatementContext(fileName, fileContent);

    results.push({
      archivo: fileName,
      banco: context.bank || '?',
      bancoResolution: context.resolution.bank,
      periodo: context.period.month && context.period.year ? `${context.period.month}/${context.period.year}` : '?',
      periodoResolution: context.resolution.period,
      numCuenta: context.accountNumber || '?',
      moneda: context.currency || '?',
      confidence: (context.confidence * 100).toFixed(0) + '%',
      estado: context.unresolvedFields.length === 0 ? 'READY' : 'NEEDS_CONFIRMATION',
      evidencia: JSON.stringify(context.evidence),
      warnings: context.warnings.length > 0 ? context.warnings.join('; ') : '-',
    });

    console.log(`\n📄 ${fileName}`);
    console.log(`   Banco:        ${context.bank || '?'} (${context.resolution.bank})`);
    console.log(`   Período:      ${context.period.month || '?'}/${context.period.year || '?'} (${context.resolution.period})`);
    console.log(`   Cuenta:       ${context.accountNumber || '?'}`);
    console.log(`   Moneda:       ${context.currency || '?'}`);
    console.log(`   Confianza:    ${(context.confidence * 100).toFixed(0)}%`);
    console.log(`   Estado:       ${context.unresolvedFields.length === 0 ? 'READY' : 'NEEDS_CONFIRMATION'}`);
    if (context.unresolvedFields.length > 0) {
      console.log(`   Pendientes:   ${context.unresolvedFields.join(', ')}`);
    }
    if (context.warnings.length > 0) {
      console.log(`   ⚠️  Advertencias:`);
      context.warnings.forEach((w) => console.log(`       - ${w}`));
    }
    console.log(`   Evidencia:    ${JSON.stringify(context.evidence, null, 2)}`);
  }

  // Generar tabla de resultados
  console.log('\n' + '='.repeat(100));
  console.log('TABLA RESUMEN — Resultados de Detección');
  console.log('='.repeat(100));
  console.table(results);

  // Estadísticas
  const ready = results.filter((r) => r.estado === 'READY').length;
  const needsConfirm = results.filter((r) => r.estado === 'NEEDS_CONFIRMATION').length;

  console.log('\n' + '='.repeat(100));
  console.log('ESTADÍSTICAS');
  console.log('='.repeat(100));
  console.log(`✓ READY (no requieren intervención):      ${ready}/${results.length}`);
  console.log(`⚠ NEEDS_CONFIRMATION (requieren revisión): ${needsConfirm}/${results.length}`);
  console.log('');
}

main().catch(console.error);
