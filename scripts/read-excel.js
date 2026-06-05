import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Leer el archivo Excel
const filePath = path.join(__dirname, '../estado-cuenta/Estado_De_Cuenta_1178920.xls');
const workbook = XLSX.readFile(filePath);

// Obtener la primera hoja
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convertir a JSON
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

console.log('=== ESTRUCTURA DEL ARCHIVO ITAÚ ===\n');
console.log('Nombre de la hoja:', sheetName);
console.log('\nPrimeras 20 filas:\n');

// Mostrar las primeras 20 filas
data.slice(0, 20).forEach((row, index) => {
  console.log(`Fila ${index}:`, row);
});

console.log('\n=== ANÁLISIS ===');
console.log('Total de filas:', data.length);
console.log('Columnas en la primera fila:', data[0]);

// Made with Bob
