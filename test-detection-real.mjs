#!/usr/bin/env node

/**
 * Test de detección REAL usando las funciones compiladas del proyecto
 * Esto ejecuta la detección contra archivos reales en /extraxtos
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Importar las funciones compiladas desde dist
let detectStatementContext, detectBank, Account;

async function loadDistModules() {
  try {
    // Intentar importar desde el dist compilado
    console.log('Loading compiled modules from dist/...');
    // Este es un placeholder - en realidad no podemos importar fácilmente desde dist compilado
    // Así que vamos a leer el archivo de configuración del proyecto y entender mejor qué se soporta
    return null;
  } catch (e) {
    console.warn('Could not load from dist:', e.message);
    return null;
  }
}

/**
 * Lee información disponible del archivo basado solo en el nombre
 */
function analyzeFileName(fileName) {
  const analysis = {
    fileName,
    extension: path.extname(fileName).toLowerCase(),
    nameWithoutExt: path.basename(fileName, path.extname(fileName)),
    size: fs.statSync(path.join(__dirname, 'extraxtos', fileName)).size,
  };

  // Buscar patrones en el nombre
  const patterns = {
    bank: /(BROU|Itau|Santander|OCA|Prex|BHU|IBM)/i,
    month: /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|01|02|03|04|05|06|07|08|09|10|11|12)/i,
    accountType: /(debito|credit|visa|mastercard|tarjeta)/i,
    year: /(202\d)/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileName.match(pattern);
    if (match) {
      analysis[key] = match[0];
    }
  }

  return analysis;
}

/**
 * Reporte de hallazgos
 */
function main() {
  const extractsDir = path.join(__dirname, 'extraxtos');

  console.log('═'.repeat(120));
  console.log('TEST DE DETECCIÓN — ANÁLISIS DE NOMBRES DE ARCHIVOS');
  console.log('═'.repeat(120));
  console.log('');

  const files = fs
    .readdirSync(extractsDir)
    .filter((f) => !fs.statSync(path.join(extractsDir, f)).isDirectory())
    .sort();

  console.log(`📂 Encontrados ${files.length} archivos\n`);

  const results = [];

  for (const fileName of files) {
    const analysis = analyzeFileName(fileName);
    results.push(analysis);

    console.log(`📄 ${fileName}`);
    console.log(`   Extensión:   ${analysis.extension}`);
    console.log(`   Tamaño:      ${(analysis.size / 1024).toFixed(2)} KB`);
    console.log(`   Banco:       ${analysis.bank || 'No detectado en nombre'}`);
    console.log(`   Mes:         ${analysis.month || 'No detectado en nombre'}`);
    console.log(`   Año:         ${analysis.year || 'No detectado en nombre'}`);
    console.log(`   Tipo:        ${analysis.accountType || 'No detectado en nombre'}`);
    console.log('');
  }

  // Análisis de tipos de archivo
  console.log('═'.repeat(120));
  console.log('DISTRIBUCIÓN DE TIPOS DE ARCHIVO');
  console.log('═'.repeat(120));

  const byExtension = {};
  results.forEach((r) => {
    byExtension[r.extension] = (byExtension[r.extension] || 0) + 1;
  });

  for (const [ext, count] of Object.entries(byExtension)) {
    console.log(`${ext}: ${count} archivo(s)`);
  }

  // Problemas
  console.log('');
  console.log('═'.repeat(120));
  console.log('PROBLEMAS CRÍTICOS PARA DETECCIÓN');
  console.log('═'.repeat(120));
  console.log('');
  console.log('1. ARCHIVOS BINARIOS SIN BANCO EN NOMBRE:');
  const binaryWithoutBank = results.filter(
    (r) => ['.xls', '.xlsx', '.pdf'].includes(r.extension) && !r.bank
  );
  binaryWithoutBank.forEach((r) => console.log(`   - ${r.fileName}`));
  console.log(`   Total: ${binaryWithoutBank.length}/10`);

  console.log('');
  console.log('2. SOLUCIONES NECESARIAS:');
  console.log('   a) Leer contenido de archivos Excel/PDF para detectar banco');
  console.log('   b) Parsers específicos ya existen: brouParser, itauParser, ocaParser, etc.');
  console.log('   c) contextDetection.service.ts debe leer archivos antes de detectar');
  console.log('   d) Para archivos .xls/.xlsx: usar librería XLSX');
  console.log('   e) Para archivos .pdf: usar librería pdfjs-dist (ya en dependencies)');
  console.log('');
  console.log('3. ESTADO ACTUAL DE CONTEXTDETECTION.SERVICE.TS:');
  console.log('   ✗ Solo intenta leer contenido para archivos .csv');
  console.log('   ✗ Para .xlsx/.xls/.pdf, el contenido está vacío → no detecta banco');
  console.log('   ✓ Detección de período desde nombre funciona (pero solo con mes explícito)');
  console.log('   ✓ Estructura de types y resolution está bien definida');
  console.log('');

  console.log('═'.repeat(120));
  console.log('CONCLUSIÓN');
  console.log('═'.repeat(120));
  console.log('FASE 02 NO ESTÁ COMPLETA. Antes de FASE 03:');
  console.log('');
  console.log('PASO 1: Extender contextDetection.service.ts para leer archivos binarios');
  console.log('        - Agregar lectura de contenido para .xlsx/.xls/.pdf');
  console.log('        - Usar parseByBank() para obtener sample de transacciones');
  console.log('        - Extraer texto del PDF si es necesario');
  console.log('');
  console.log('PASO 2: Probar detección contra archivos reales');
  console.log('        - Debe detectar banco para todos los 10 archivos');
  console.log('        - Debe detectar período para todos los 10 archivos');
  console.log('        - Mostrar tabla final con resultados');
  console.log('');
  console.log('PASO 3: Validar TypeScript, build, tsc --noEmit');
  console.log('');
}

main();
