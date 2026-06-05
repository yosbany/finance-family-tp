import Papa from 'papaparse';
import { ParsedTransaction, Currency } from '../types';

interface CSVRow {
  [key: string]: string;
}

/**
 * Parser genérico para archivos CSV
 * Intenta detectar automáticamente las columnas de fecha, descripción y monto
 */
export const parseCSV = async (file: File): Promise<ParsedTransaction[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const transactions = processCSVData(results.data as CSVRow[]);
          resolve(transactions);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(new Error(`Error al parsear CSV: ${error.message}`));
      }
    });
  });
};

/**
 * Procesa los datos del CSV y los convierte a transacciones
 */
const processCSVData = (data: CSVRow[]): ParsedTransaction[] => {
  if (data.length === 0) {
    throw new Error('El archivo CSV está vacío');
  }

  const transactions: ParsedTransaction[] = [];
  const headers = Object.keys(data[0]).map(h => h.toLowerCase());

  // Detectar columnas relevantes
  const dateColumn = detectColumn(headers, ['fecha', 'date', 'dia']);
  const descColumn = detectColumn(headers, ['descripcion', 'description', 'concepto', 'detalle', 'desc']);
  const amountColumn = detectColumn(headers, ['monto', 'amount', 'importe', 'valor']);
  const currencyColumn = detectColumn(headers, ['moneda', 'currency', 'divisa']);

  if (!dateColumn || !descColumn || !amountColumn) {
    throw new Error('No se pudieron detectar las columnas necesarias (fecha, descripción, monto)');
  }

  for (const row of data) {
    try {
      const dateStr = row[dateColumn];
      const description = row[descColumn];
      const amountStr = row[amountColumn];
      const currencyStr = currencyColumn ? row[currencyColumn] : 'UYU';

      if (!dateStr || !description || !amountStr) {
        continue; // Saltar filas incompletas
      }

      const date = parseDate(dateStr);
      const amount = parseAmount(amountStr);
      const currency = parseCurrency(currencyStr);
      const type = amount >= 0 ? 'income' : 'expense';

      transactions.push({
        date,
        description: description.trim(),
        amount: Math.abs(amount),
        currency,
        type
      });
    } catch (error) {
      console.warn('Error al procesar fila CSV:', error);
      // Continuar con la siguiente fila
    }
  }

  return transactions;
};

/**
 * Detecta la columna que coincide con alguna de las palabras clave
 */
const detectColumn = (headers: string[], keywords: string[]): string | null => {
  for (const header of headers) {
    for (const keyword of keywords) {
      if (header.includes(keyword)) {
        return header;
      }
    }
  }
  return null;
};

/**
 * Parsea una fecha en diferentes formatos
 */
const parseDate = (dateStr: string): Date => {
  // Intentar diferentes formatos de fecha
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
 * Parsea un monto, manejando diferentes formatos
 */
const parseAmount = (amountStr: string): number => {
  // Remover símbolos de moneda y espacios
  let cleaned = amountStr.replace(/[^\d.,-]/g, '');
  
  // Manejar separadores decimales
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
