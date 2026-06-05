import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { ParsedTransaction, Currency } from '../../types';
import { parseBROUDebitCSV, parseBROUCreditCSV, parseBROUExcel } from './brouParser';
import { parseItauDebitCSV, parseItauCreditCSV, parseItauCreditPDF, parseItauExcel } from './itauParser';
import { parseSantanderDebitCSV, parseSantanderCreditCSV, parseSantanderExcel } from './santanderParser';
import { parseOCAMasterCSV, parseOCAVisaCSV, parseOCAExcel } from './ocaParser';
import { parsePrexCSV, parsePrexExcel } from './prexParser';
import { parseBHUCSV, parseBHUExcel, parseBHUPDF } from './bhuParser';
import { parseIBMExcel } from './ibmParser';

// Configurar el worker de PDF.js - usar worker local de node_modules
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Selector de parser según banco y tipo de cuenta
 * Permite usar parsers específicos para cada banco uruguayo
 */

export interface BankParserConfig {
  bank: string;
  accountType: 'debit' | 'credit' | 'investment';
  fileType: 'csv' | 'excel' | 'pdf';
  currency?: Currency;
}

export const getBankParser = (config: BankParserConfig) => {
  const { bank, accountType, fileType, currency } = config;

  // BROU
  if (bank === 'BROU') {
    if (fileType === 'csv') {
      return accountType === 'credit' ? parseBROUCreditCSV : parseBROUDebitCSV;
    }
    if (fileType === 'excel') {
      return parseBROUExcel;
    }
  }

  // Itaú
  if (bank === 'Itaú') {
    if (fileType === 'csv') {
      return accountType === 'credit' ? parseItauCreditCSV : parseItauDebitCSV;
    }
    if (fileType === 'excel') {
      return parseItauExcel;
    }
    if (fileType === 'pdf' && accountType === 'credit') {
      return parseItauCreditPDF;
    }
  }

  // Santander
  if (bank === 'Santander') {
    if (fileType === 'csv') {
      return accountType === 'credit' ? parseSantanderCreditCSV : parseSantanderDebitCSV;
    }
    if (fileType === 'excel') {
      return parseSantanderExcel;
    }
  }

  // OCA
  if (bank === 'OCA') {
    if (fileType === 'csv') {
      // Detectar si es Visa o Master por el nombre de la cuenta
      return parseOCAMasterCSV; // Por defecto Master, se puede mejorar con detección
    }
    if (fileType === 'excel') {
      return parseOCAExcel;
    }
  }

  // Prex
  if (bank === 'Prex') {
    if (fileType === 'csv') {
      return (content: string) => parsePrexCSV(content, currency || 'UYU');
    }
    if (fileType === 'excel') {
      return (data: any[]) => parsePrexExcel(data, currency || 'UYU');
    }
  }

  // BHU
  if (bank === 'BHU') {
    if (fileType === 'csv') {
      return parseBHUCSV;
    }
    if (fileType === 'excel') {
      return parseBHUExcel;
    }
    if (fileType === 'pdf') {
      return parseBHUPDF;
    }
  }

  // IBM
  if (bank === 'IBM') {
    if (fileType === 'excel' && accountType === 'investment') {
      return parseIBMExcel;
    }
  }

  // Parser genérico como fallback
  return null;
};

/**
 * Función principal para parsear archivos según el banco
 */
export const parseByBank = async (
  file: File,
  bank: string,
  accountType: 'debit' | 'credit' | 'investment',
  currency?: Currency
): Promise<ParsedTransaction[]> => {
  const fileName = file.name.toLowerCase();
  let fileType: 'csv' | 'excel' | 'pdf';

  if (fileName.endsWith('.csv')) {
    fileType = 'csv';
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    fileType = 'excel';
  } else if (fileName.endsWith('.pdf')) {
    fileType = 'pdf';
  } else {
    throw new Error('Formato de archivo no soportado');
  }

  const parser = getBankParser({ bank, accountType, fileType, currency });

  if (!parser) {
    throw new Error(`No hay parser disponible para ${bank} - ${fileType}`);
  }

  // Para CSV
  if (fileType === 'csv') {
    const content = await file.text();
    return (parser as (content: string) => ParsedTransaction[])(content);
  }

  // Para Excel
  if (fileType === 'excel') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            throw new Error('No se pudo leer el archivo Excel');
          }

          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
            blankrows: true
          });
          
          console.log('📊 Excel parseado - Banco:', bank, 'Tipo:', accountType);
          console.log('📊 Total de filas:', jsonData.length);
          console.log('📊 Primeras 10 filas completas:', jsonData.slice(0, 10));
          
          // Llamar al parser específico con los datos
          const transactions = (parser as (data: any[]) => ParsedTransaction[])(jsonData as any[]);
          console.log('📊 Transacciones retornadas:', transactions.length);
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
  }

  // Para PDF - Extraer texto usando pdfjs-dist
  if (fileType === 'pdf') {
    try {
      // Leer el archivo como ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Cargar el documento PDF
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      // Extraer texto de todas las páginas
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      
      console.log('📄 Texto extraído del PDF (primeras 500 chars):', fullText.substring(0, 500));
      
      // Llamar al parser específico con el texto extraído
      return (parser as (content: string) => ParsedTransaction[])(fullText);
    } catch (error) {
      console.error('Error al extraer texto del PDF:', error);
      throw new Error('No se pudo extraer el texto del PDF');
    }
  }

  return [];
};

/**
 * Detectar banco automáticamente desde el contenido del archivo
 */
export const detectBank = (content: string): string | null => {
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
  if (contentLower.includes('ibm') || contentLower.includes('employees stock purchase plan') || contentLower.includes('portfolio details')) {
    return 'IBM';
  }

  return null;
};

/**
 * Obtener información del parser
 */
export const getParserInfo = (bank: string) => {
  const parsers = {
    'BROU': {
      name: 'Banco República',
      formats: ['CSV', 'PDF'],
      types: ['Débito', 'Crédito'],
      notes: 'Soporta formato estándar de BROU con columnas: Fecha, Descripción, Débito, Crédito, Saldo'
    },
    'Itaú': {
      name: 'Itaú Uruguay',
      formats: ['CSV', 'Excel'],
      types: ['Débito', 'Crédito Visa'],
      notes: 'Soporta formato con separador punto y coma (;)'
    },
    'Santander': {
      name: 'Santander Uruguay',
      formats: ['CSV', 'Excel'],
      types: ['Débito', 'Crédito Visa'],
      notes: 'Formato con fecha DD-MM-YYYY'
    },
    'OCA': {
      name: 'OCA',
      formats: ['CSV', 'Excel', 'PDF'],
      types: ['Visa', 'Mastercard'],
      notes: 'Soporta extractos de tarjetas Visa y Mastercard'
    },
    'Prex': {
      name: 'Prex',
      formats: ['CSV', 'Excel'],
      types: ['Pesos', 'Dólares'],
      notes: 'Especificar moneda al cargar'
    },
    'BHU': {
      name: 'Banco Hipotecario del Uruguay',
      formats: ['PDF', 'CSV', 'Excel'],
      types: ['Ahorro (YO AHORRO)', 'Préstamo'],
      notes: 'Soporta PDF con transacciones en UI (Unidades Indexadas)'
    },
    'IBM': {
      name: 'IBM Employee Stock Purchase Plan',
      formats: ['Excel'],
      types: ['Inversiones (Portfolio Details)'],
      notes: 'Soporta archivos de detalles de cartera con compras de acciones y dividendos en USD'
    }
  };

  return parsers[bank as keyof typeof parsers] || null;
};

export * from './brouParser';
export * from './itauParser';
export * from './santanderParser';
export * from './ocaParser';
export * from './prexParser';
export * from './bhuParser';
export * from './ibmParser';

// Made with Bob
