/**
 * Prueba simple de detección de período usando regex
 * (Simula la lógica de detectPeriodFromFileName)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function detectPeriodFromFileName(fileName) {
  const lowerName = fileName.toLowerCase();
  
  // First: Check for explicit month names (PRIORITY)
  const monthNames = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  
  for (const [monthName, monthNum] of Object.entries(monthNames)) {
    if (lowerName.includes(monthName)) {
      // Find year nearby
      const yearMatch = lowerName.match(/20\d{2}/);
      const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
      return { month: monthNum, year, evidence: `Month name "${monthName}" + year ${year}` };
    }
  }
  
  // Second: Numeric patterns
  const patterns = [
    { 
      regex: /(\d{4})[-_](\d{1,2})(?:[^0-9]|$)/, 
      parser: (m) => ({ month: parseInt(m[2]), year: parseInt(m[1]) }), 
      desc: 'YYYY-MM format' 
    },
    { 
      regex: /(\d{1,2})[-_](\d{4})(?:[^0-9]|$)/, 
      parser: (m) => ({ month: parseInt(m[1]), year: parseInt(m[2]) }), 
      desc: 'MM-YYYY format' 
    },
    { 
      regex: /(?:^|[a-zA-Z_])(\d{6})(?:[^0-9]|$)/, 
      parser: (m) => {
        // Pattern like V_202607 or just 202607 (YYYYMM without separator)
        const d = m[1];
        return { month: parseInt(d.substring(4, 6)), year: parseInt(d.substring(0, 4)) };
      }, 
      desc: 'YYYYMM format (e.g., V_202607)' 
    },
    { 
      regex: /\b(\d{8})\b/, 
      parser: (m) => {
        const d = m[1];
        return { month: parseInt(d.substring(4, 6)), year: parseInt(d.substring(0, 4)) };
      }, 
      desc: 'YYYYMMDD format' 
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
  
  return { month: null, year: null, evidence: '' };
}

const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

console.log('='.repeat(80));
console.log('PRUEBA DE DETECCIÓN DE PERÍODO');
console.log('='.repeat(80));
console.log('');

const extractosDir = path.join(__dirname, 'extraxtos');

if (!fs.existsSync(extractosDir)) {
  console.error(`❌ Directorio ${extractosDir} no encontrado`);
  process.exit(1);
}

const files = fs.readdirSync(extractosDir)
  .filter(f => /\.(pdf|csv|xlsx?|xls)$/i.test(f));

console.log(`📁 Encontrados ${files.length} archivos en /extraxtos`);
console.log('');

// Test detection on each file
const results = [];
for (const fileName of files) {
  const detected = detectPeriodFromFileName(fileName);
  results.push({ fileName, ...detected });
  
  const periodStr = detected.month && detected.year
    ? `${String(detected.month).padStart(2, '0')}/${detected.year}`
    : 'NO DETECTADO';
  
  console.log(`📄 ${fileName}`);
  console.log(`   → Período: ${periodStr}`);
  if (detected.evidence) {
    console.log(`   → Evidencia: ${detected.evidence}`);
  }
  console.log('');
}

// Focus on specific test cases
console.log('='.repeat(80));
console.log('CASOS ESPECIALES');
console.log('='.repeat(80));
console.log('');

const testCases = [
  { name: 'estado_cuenta_20260812 - julio.xlsx', expectedMonth: 7, expectedYear: 2026, reason: 'Mes explícito debe tener prioridad sobre fecha numérica' },
  { name: 'estado_cuenta_20260812 - junio.xlsx', expectedMonth: 6, expectedYear: 2026, reason: 'Mes explícito debe tener prioridad' },
  { name: 'V_202607.pdf', expectedMonth: 7, expectedYear: 2026, reason: 'Formato YYYYMM debe detectar julio' },
  { name: 'resumen - julio.pdf', expectedMonth: 7, expectedYear: 2026, reason: 'Mes explícito' },
  { name: 'resumen oca - julio.pdf', expectedMonth: 7, expectedYear: 2026, reason: 'Mes explícito' },
];

for (const test of testCases) {
  const result = results.find(r => r.fileName === test.name);
  
  console.log(`🧪 ${test.name}`);
  console.log(`   Razón: ${test.reason}`);
  
  if (result) {
    const detected = result.month && result.year
      ? `${String(result.month).padStart(2, '0')}/${result.year}`
      : 'NO DETECTADO';
    const expected = `${String(test.expectedMonth).padStart(2, '0')}/${test.expectedYear}`;
    
    const isCorrect = result.month === test.expectedMonth && result.year === test.expectedYear;
    const icon = isCorrect ? '✅' : '❌';
    
    console.log(`   ${icon} Detectado: ${detected}`);
    console.log(`   📌 Esperado: ${expected}`);
    console.log(`   📋 Evidencia: ${result.evidence || 'NINGUNA'}`);
  } else {
    console.log(`   ⚠️  Archivo no encontrado en /extraxtos`);
  }
  console.log('');
}

// Summary
console.log('='.repeat(80));
console.log('RESUMEN');
console.log('='.repeat(80));
console.log('');

const detected = results.filter(r => r.month && r.year);
const notDetected = results.filter(r => !r.month || !r.year);

console.log(`Archivos con período detectado: ${detected.length}/${results.length}`);
if (detected.length > 0) {
  console.log('');
  detected.forEach(r => {
    const monthName = monthNames[r.month - 1] || '?';
    console.log(`  ✓ ${r.fileName}`);
    console.log(`    → ${monthName} ${r.year}`);
  });
}

if (notDetected.length > 0) {
  console.log('');
  console.log(`⚠️  Sin período detectado: ${notDetected.length} archivo(s)`);
  notDetected.forEach(r => {
    console.log(`  ✗ ${r.fileName}`);
  });
}

console.log('');
console.log('✅ Prueba completada');
