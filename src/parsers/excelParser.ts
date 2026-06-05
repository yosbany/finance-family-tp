import * as XLSX from 'xlsx';
import { ParsedTransaction, Currency } from '../types';

/**
 * Parser para archivos Excel (.xlsx, .xls)
 */
export const parseExcel = async (file: File): Promise<ParsedTransaction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error('No se pudo leer el archivo');
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Usar la primera hoja
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convertir a JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        const transactions = processExcelData(jsonData as any[][]);
        resolve(transactions);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo Excel'));
    };

    reader.readAsBinaryString(file);
  });
};

/**
 * Procesa los datos del Excel y los convierte a transacciones
 */
const processExcelData = (data: any[][]): ParsedTransaction[] => {
  if (data.length === 0) {
    throw new Error('El archivo Excel está vacío');
  }

  const transactions: ParsedTransaction[] = [];
  
  // Asumir que la primera fila son los encabezados
  const headers = data[0].map((h: any) => String(h).toLowerCase());
  
  // Detectar columnas relevantes
  const dateColumn = detectColumn(headers, ['fecha', 'date', 'dia']);
  const descColumn = detectColumn(headers, ['descripcion', 'description', 'concepto', 'detalle', 'desc']);
  const amountColumn = detectColumn(headers, ['monto', 'amount', 'importe', 'valor']);
  const currencyColumn = detectColumn(headers, ['moneda', 'currency', 'divisa']);

  if (dateColumn === -1 || descColumn === -1 || amountColumn === -1) {
    throw new Error('No se pudieron detectar las columnas necesarias (fecha, descripción, monto)');
  }

  // Procesar filas (saltando el encabezado)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    try {
      const dateValue = row[dateColumn];
      const description = row[descColumn];
      const amountValue = row[amountColumn];
      const currencyValue = currencyColumn !== -1 ? row[currencyColumn] : 'UYU';

      if (!dateValue || !description || amountValue === undefined) {
        continue; // Saltar filas incompletas
      }

      const date = parseExcelDate(dateValue);
      const amount = parseAmount(amountValue);
      const currency = parseCurrency(String(currencyValue));
      const type = amount >= 0 ? 'income' : 'expense';

      transactions.push({
        date,
        description: String(description).trim(),
        amount: Math.abs(amount),
        currency,
        type
      });
    } catch (error) {
      console.warn('Error al procesar fila Excel:', error);
      // Continuar con la siguiente fila
    }
  }

  return transactions;
};

/**
 * Detecta el índice de la columna que coincide con alguna de las palabras clave
 */
const detectColumn = (headers: string[], keywords: string[]): number => {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    for (const keyword of keywords) {
      if (header.includes(keyword)) {
        return i;
      }
    }
  }
  return -1;
};

/**
 * Parsea una fecha de Excel (puede ser número serial o string)
 */
const parseExcelDate = (dateValue: any): Date => {
  // Si es un número, es un serial de fecha de Excel
  if (typeof dateValue === 'number') {
    // Excel fecha serial: días desde 1900-01-01
    const excelEpoch = new Date(1900, 0, 1);
    const days = dateValue - 2; // Ajuste por bug de Excel con 1900
    return new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
  }

  // Si es string, intentar parsear
  const dateStr = String(dateValue);
  
  // Intentar diferentes formatos
  const formats = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY
    /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
    /(\d{1,2})-(\d{1,2})-(\d{4})/, // DD-MM-YYYY
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[1]) {
        // YYYY-MM-DD
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      } else {
        // DD/MM/YYYY o DD-MM-YYYY
        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
      }
    }
  }

  // Intentar parseo directo
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Formato de fecha no reconocido: ${dateStr}`);
  }
  return date;
};

/**
 * Parsea un monto
 */
const parseAmount = (amountValue: any): number => {
  if (typeof amountValue === 'number') {
    return amountValue;
  }

  // Si es string, limpiar y parsear
  const amountStr = String(amountValue);
  let cleaned = amountStr.replace(/[^\d.,-]/g, '');
  cleaned = cleaned.replace(',', '.');
  
  const amount = parseFloat(cleaned);
  if (isNaN(amount)) {
    throw new Error(`Formato de monto no reconocido: ${amountStr}`);
  }
  
  return amount;
};

/**
 * Parsea la moneda
 */
const parseCurrency = (currencyStr: string): Currency => {
  const upper = currencyStr.toUpperCase().trim();
  if (upper.includes('USD') || upper.includes('DOLAR') || upper.includes('DOLLAR')) {
    return 'USD';
  }
  return 'UYU';
};

// Made with Bob
