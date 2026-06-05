import * as pdfjsLib from 'pdfjs-dist';
import { Transaction } from '../../types';

// Configurar el worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

/**
 * Parser para estados de cuenta del BHU (Banco Hipotecario del Uruguay)
 * Formato: PDF con transacciones en UI (Unidades Indexadas)
 */
export const parseBHUPDF = async (file: File, accountId: string): Promise<Transaction[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    // Extraer texto de todas las páginas
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return parseBHUPDFText(fullText, accountId);
  } catch (error) {
    console.error('Error al parsear PDF del BHU:', error);
    throw new Error('No se pudo leer el archivo PDF del BHU');
  }
};

const parseBHUPDFText = (text: string, accountId: string): Transaction[] => {
  const transactions: Transaction[] = [];
  
  // Buscar la sección de movimientos
  const movimientosMatch = text.match(/Movimientos[\s\S]*?(?=info@bhu\.net|$)/);
  if (!movimientosMatch) {
    console.warn('No se encontró la sección de movimientos en el PDF del BHU');
    return transactions;
  }
  
  const movimientosText = movimientosMatch[0];
  
  // Patrón para las transacciones del BHU
  // Formato: DD/MM/YYYY Tipo Concepto Monto(UI) Cotización Monto($) Antigüedad Comprobante
  // Ejemplo: 26/06/2024DepósitoTranf-Banc6.606,986,05$ 40.000,00709 días12012050
  const transactionPattern = /(\d{2}\/\d{2}\/\d{4})(Depósito|Extracción|Débito|Crédito)([A-Za-z\-]+)([\d.,]+)([\d,]+)\$\s*([\d.,]+)(\d+)\s*días(\d+)/g;
  
  let match;
  while ((match = transactionPattern.exec(movimientosText)) !== null) {
    const [
      ,
      dateStr,
      tipo,
      concepto,
      montoUI,
      cotizacion,
      montoPesos,
      antiguedad,
      comprobante
    ] = match;
    
    // Parsear fecha (DD/MM/YYYY)
    const [day, month, year] = dateStr.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    
    // Limpiar y parsear monto en pesos
    const amount = parseFloat(montoPesos.replace(/\./g, '').replace(',', '.'));
    
    // Determinar tipo de transacción
    const transactionType = tipo.toLowerCase().includes('depósito') || tipo.toLowerCase().includes('crédito')
      ? 'income'
      : 'expense';
    
    // Crear descripción
    const description = `${tipo} - ${concepto} (${montoUI} UI)`;
    
    transactions.push({
      id: '', // Se asignará en el servicio
      accountId,
      date: date.getTime(),
      description,
      amount: transactionType === 'income' ? amount : -amount,
      type: transactionType,
      currency: 'UYU',
      status: 'pending',
      category: undefined,
      subcategory: undefined,
      isRecurring: false,
      notes: `Comprobante: ${comprobante}`,
      createdAt: Date.now()
    });
  }
  
  console.log(`✅ BHU: ${transactions.length} transacciones parseadas`);
  return transactions;
};

/**
 * Parser dummy para CSV del BHU (no implementado aún)
 */
export const parseBHUCSV = (content: string): Transaction[] => {
  console.warn('Parser CSV del BHU no implementado. Use PDF.');
  return [];
};

/**
 * Parser dummy para Excel del BHU (no implementado aún)
 */
export const parseBHUExcel = (data: any[]): Transaction[] => {
  console.warn('Parser Excel del BHU no implementado. Use PDF.');
  return [];
};

// Made with Bob
