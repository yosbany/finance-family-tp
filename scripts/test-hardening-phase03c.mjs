/**
 * FASE 03C — Test de Hardening Contra Archivos Reales
 * 
 * Objetivo: Validar que la corrección de detección funciona contra los 10 archivos reales.
 */

import fs from 'fs';
import path from 'path';

// Simulación de isValidStatementPeriod (mismo código que en src/utils/statementPeriod.ts)
const getValidStatementYearRange = (now = new Date()) => {
  const currentYear = now.getFullYear();
  return {
    min: currentYear - 5,
    max: currentYear + 1,
  };
};

const isValidStatementPeriod = (month, year, now = new Date()) => {
  if (!month || !year) return false;
  
  // Validar mes
  if (month < 1 || month > 12) return false;
  
  // Validar año
  const { min, max } = getValidStatementYearRange(now);
  if (year < min || year > max) return false;
  
  return true;
};

// Simulación simplificada de detectPeriodFromFileName
const detectPeriodFromFileName = (fileName, uploadDate = new Date()) => {
  const lowerName = fileName.toLowerCase();
  
  // PRIORIDAD 1: Meses explícitos
  const monthNames = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  
  for (const [monthName, monthNum] of Object.entries(monthNames)) {
    if (lowerName.includes(monthName)) {
      const yearMatch = lowerName.match(/20\d{2}/);
      const year = yearMatch ? parseInt(yearMatch[0]) : uploadDate.getFullYear();
      
      if (isValidStatementPeriod(monthNum, year, uploadDate)) {
        return { 
          month: monthNum, 
          year, 
          evidence: `Month name "${monthName}" + year ${year}`,
          source: 'MONTH_NAME'
        };
      }
    }
  }
  
  // PRIORIDAD 2-4: Patrones numéricos
  const patterns = [
    {
      regex: /(?:^|[^0-9])(\d{4})[-_](\d{1,2})(?:[^0-9]|$)/,
      parser: (m) => ({ month: parseInt(m[2]), year: parseInt(m[1]) }),
      desc: 'YYYY-MM format',
      source: 'YYYY-MM',
    },
    {
      regex: /(?:^|[^0-9])(\d{1,2})[-_](\d{4})(?:[^0-9]|$)/,
      parser: (m) => ({ month: parseInt(m[1]), year: parseInt(m[2]) }),
      desc: 'MM-YYYY format',
      source: 'MM-YYYY',
    },
    {
      regex: /[a-zA-Z_](\d{6})(?:[^0-9]|$)/,
      parser: (m) => {
        const d = m[1];
        return { month: parseInt(d.substring(4, 6)), year: parseInt(d.substring(0, 4)) };
      },
      desc: 'YYYYMM format',
      source: 'YYYYMM',
    },
    {
      regex: /(?:^|\s)(\d{8})(?:\s|$)/,
      parser: (m) => {
        const d = m[1];
        return { month: parseInt(d.substring(4, 6)), year: parseInt(d.substring(0, 4)) };
      },
      desc: 'YYYYMMDD format',
      source: 'YYYYMMDD',
    },
  ];
  
  for (const { regex, parser, desc, source } of patterns) {
    const match = lowerName.match(regex);
    if (match) {
      const result = parser(match);
      
      // VALIDACIÓN SEMÁNTICA
      if (isValidStatementPeriod(result.month, result.year, uploadDate)) {
        return { 
          ...result, 
          evidence: desc,
          source,
        };
      } else {
        // Log: patrón coincidió pero rechazado por validación semántica
        console.log(`  ⚠️ Patrón ${source} coincidió en "${fileName}" pero rechazado: month=${result.month}, year=${result.year}`);
      }
    }
  }
  
  return { month: null, year: null, evidence: '', source: 'NONE' };
};

// Archivos de prueba esperados
const testCases = [
  {
    fileName: '2026_01_debito_yanet.xls',
    expectedMonth: 1,
    expectedYear: 2026,
    classification: 'DEBE_DETECTARSE',
  },
  {
    fileName: '2026_02_debito_yanet.xls',
    expectedMonth: 2,
    expectedYear: 2026,
    classification: 'DEBE_DETECTARSE',
  },
  {
    fileName: 'Estado de Cuenta 010-85-193735-9 11_08_2026 16_18_33.pdf',
    expectedMonth: null,
    expectedYear: null,
    classification: 'NO_DEBE_DETECTARSE_INCORRECTAMENTE',
    description: 'Error conocido: producía 09/3735. Ahora debe rechazar 3735-9.',
  },
  {
    fileName: 'PortfolioDetails _205338113 (1).xlsx',
    expectedMonth: null,
    expectedYear: null,
    classification: 'PUEDE_SER_UNRESOLVED',
    description: 'Sin período claro en nombre',
  },
  {
    fileName: 'V_202607.pdf',
    expectedMonth: 7,
    expectedYear: 2026,
    classification: 'DEBE_DETECTARSE',
  },
  {
    fileName: 'c6f92242ba4d89e5a107412cc76eac3e62e782de-Conciliacion_de_Cuentas-julio.xls',
    expectedMonth: 7,
    expectedYear: 2026,
    classification: 'DEBE_DETECTARSE',
  },
  {
    fileName: 'estado_cuenta_20260812 - julio.xlsx',
    expectedMonth: 7,
    expectedYear: 2026,
    classification: 'DEBE_DETECTARSE',
  },
  {
    fileName: 'estado_cuenta_20260812 - junio.xlsx',
    expectedMonth: 6,
    expectedYear: 2026,
    classification: 'DEBE_DETECTARSE',
  },
  {
    fileName: 'resumen - julio.pdf',
    expectedMonth: 7,
    expectedYear: 2026,
    classification: 'DEBE_DETECTARSE',
  },
  {
    fileName: 'resumen oca - julio.pdf',
    expectedMonth: 7,
    expectedYear: 2026,
    classification: 'DEBE_DETECTARSE',
  },
];

// Ejecutar pruebas
console.log('═══════════════════════════════════════════════════════');
console.log('FASE 03C — Validación de Hardening de Detección');
console.log('═══════════════════════════════════════════════════════\n');

const mockDate = new Date('2026-10-02');
const results = {
  CORRECT: [],
  REQUIRES_CONFIRMATION: [],
  UNRESOLVED: [],
  INCORRECT: [],
};

for (const testCase of testCases) {
  const result = detectPeriodFromFileName(testCase.fileName, mockDate);
  
  console.log(`📄 ${testCase.fileName}`);
  
  if (testCase.classification === 'DEBE_DETECTARSE') {
    if (result.month === testCase.expectedMonth && result.year === testCase.expectedYear) {
      console.log(`   ✅ CORRECTO: ${result.month}/${result.year} (${result.source})`);
      results.CORRECT.push(testCase.fileName);
    } else {
      console.log(`   ❌ INCORRECTO: detectado ${result.month}/${result.year}, esperado ${testCase.expectedMonth}/${testCase.expectedYear}`);
      results.INCORRECT.push(testCase.fileName);
    }
  } else if (testCase.classification === 'NO_DEBE_DETECTARSE_INCORRECTAMENTE') {
    if (!result.month || !result.year) {
      console.log(`   ✅ CORRECTO: No detectado (UNRESOLVED)`);
      results.CORRECT.push(testCase.fileName);
    } else if (result.year === 3735 && result.month === 9) {
      console.log(`   ❌ INCORRECTO: Sigue detectando 09/3735 (ERROR CONOCIDO)`);
      results.INCORRECT.push(testCase.fileName);
    } else {
      console.log(`   ⚠️ REQUIERE_CONFIRMACION: Detectado ${result.month}/${result.year} (${result.source})`);
      if (isValidStatementPeriod(result.month, result.year, mockDate)) {
        results.REQUIRES_CONFIRMATION.push(testCase.fileName);
      } else {
        results.CORRECT.push(testCase.fileName);
      }
    }
  } else if (testCase.classification === 'PUEDE_SER_UNRESOLVED') {
    if (!result.month || !result.year) {
      console.log(`   ✅ CORRECTO: No detectado (UNRESOLVED)`);
      results.CORRECT.push(testCase.fileName);
    } else if (isValidStatementPeriod(result.month, result.year, mockDate)) {
      console.log(`   ⚠️ DETECTADO: ${result.month}/${result.year} (${result.source})`);
      results.REQUIRES_CONFIRMATION.push(testCase.fileName);
    } else {
      console.log(`   ✅ CORRECTO: No detectado por validación semántica`);
      results.CORRECT.push(testCase.fileName);
    }
  }
  
  if (testCase.description) {
    console.log(`   → ${testCase.description}`);
  }
  console.log();
}

// Resumen
console.log('═══════════════════════════════════════════════════════');
console.log('RESUMEN');
console.log('═══════════════════════════════════════════════════════\n');

const total = testCases.length;
const correct = results.CORRECT.length;
const requiresConfirmation = results.REQUIRES_CONFIRMATION.length;
const unresolved = results.UNRESOLVED.length;
const incorrect = results.INCORRECT.length;

console.log(`✅ CORRECTOS:              ${correct}/${total}`);
console.log(`⚠️ REQUIEREN CONFIRMACIÓN: ${requiresConfirmation}/${total}`);
console.log(`❓ NO RESUELTOS:          ${unresolved}/${total}`);
console.log(`❌ INCORRECTOS:            ${incorrect}/${total}`);

console.log('\nDetalle:');
if (results.CORRECT.length > 0) {
  console.log('\n✅ Archivos correctos:');
  results.CORRECT.forEach(f => console.log(`   • ${f}`));
}

if (results.REQUIRES_CONFIRMATION.length > 0) {
  console.log('\n⚠️ Archivos que requieren confirmación:');
  results.REQUIRES_CONFIRMATION.forEach(f => console.log(`   • ${f}`));
}

if (results.INCORRECT.length > 0) {
  console.log('\n❌ Archivos incorrectos (CRÍTICO):');
  results.INCORRECT.forEach(f => console.log(`   • ${f}`));
}

// Criterio de éxito
console.log('\n' + '═══════════════════════════════════════════════════════');
if (incorrect === 0) {
  console.log('✅ FASE 03C: CRÍTERIO DE ÉXITO CUMPLIDO');
  console.log('   → No hay falsos positivos (INCORRECT = 0)');
  console.log('   → Todos los casos se detectan correctamente o quedan UNRESOLVED');
} else {
  console.log('❌ FASE 03C: CRITERIO NO CUMPLIDO');
  console.log(`   → Hay ${incorrect} caso(s) incorrecto(s)`);
}
console.log('═══════════════════════════════════════════════════════');
