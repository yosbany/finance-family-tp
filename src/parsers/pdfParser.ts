import * as pdfjsLib from 'pdfjs-dist';
import { ParsedTransaction } from '../types';

// Configurar el worker de PDF.js - usar worker local de node_modules
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Parser básico para archivos PDF
 * Extrae el texto del PDF y busca patrones de transacciones
 * NOTA: Este es un parser genérico. Para mejores resultados, se deben crear
 * parsers específicos para cada banco basados en sus formatos de extracto.
 */
export const parsePDF = async (file: File): Promise<ParsedTransaction[]> => {
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
    
    // Procesar el texto extraído
    const transactions = extractTransactionsFromText(fullText);
    
    return transactions;
  } catch (error) {
    console.error('Error al parsear PDF:', error);
    throw new Error('No se pudo procesar el archivo PDF. Intenta con CSV o Excel.');
  }
};

/**
 * Extrae transacciones del texto del PDF usando patrones comunes
 * NOTA: Este es un enfoque genérico. Para mejores resultados, implementar
 * parsers específicos por banco en src/parsers/bankParsers/
 */
const extractTransactionsFromText = (text: string): ParsedTransaction[] => {
  const transactions: ParsedTransaction[] = [];
  const lines = text.split('\n');
  
  // Patrón genérico para detectar transacciones
  // Formato esperado: DD/MM/YYYY Descripción Monto
  const transactionPattern = /(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+([-]?\d+[.,]\d{2})/g;
  
  for (const line of lines) {
    const matches = line.matchAll(transactionPattern);
    
    for (const match of matches) {
      try {
        const dateStr = match[1];
        const description = match[2].trim();
        const amountStr = match[3];
        
        const date = parseDate(dateStr);
        const amount = parseAmount(amountStr);
        const type = amount >= 0 ? 'income' : 'expense';
        
        transactions.push({
          date,
          description,
          amount: Math.abs(amount),
          currency: 'UYU', // Por defecto UYU, se puede mejorar con detección
          type
        });
      } catch (error) {
        console.warn('Error al procesar línea PDF:', error);
      }
    }
  }
  
  if (transactions.length === 0) {
    throw new Error(
      'No se pudieron extraer transacciones del PDF. ' +
      'Este archivo puede requerir un parser específico del banco. ' +
      'Intenta exportar el extracto en formato CSV o Excel.'
    );
  }
  
  return transactions;
};

/**
 * Parsea una fecha en formato DD/MM/YYYY
 */
const parseDate = (dateStr: string): Date => {
  const parts = dateStr.split('/');
  if (parts.length !== 3) {
    throw new Error(`Formato de fecha inválido: ${dateStr}`);
  }
  
  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1; // Los meses en JS son 0-indexed
  const year = parseInt(parts[2]);
  
  return new Date(year, month, day);
};

/**
 * Parsea un monto
 */
const parseAmount = (amountStr: string): number => {
  // Remover espacios y reemplazar coma por punto
  let cleaned = amountStr.replace(/\s/g, '').replace(',', '.');
  
  const amount = parseFloat(cleaned);
  if (isNaN(amount)) {
    throw new Error(`Formato de monto inválido: ${amountStr}`);
  }
  
  return amount;
};

/**
 * Detecta el banco basado en el contenido del PDF
 * Esto permite usar parsers específicos en el futuro
 */
export const detectBank = (text: string): string | null => {
  const textLower = text.toLowerCase();
  
  if (textLower.includes('brou') || textLower.includes('banco república')) {
    return 'BROU';
  }
  if (textLower.includes('itaú') || textLower.includes('itau')) {
    return 'Itaú';
  }
  if (textLower.includes('santander')) {
    return 'Santander';
  }
  if (textLower.includes('oca')) {
    return 'OCA';
  }
  if (textLower.includes('prex')) {
    return 'Prex';
  }
  if (textLower.includes('bhu')) {
    return 'BHU';
  }
  
  return null;
};

// Made with Bob
