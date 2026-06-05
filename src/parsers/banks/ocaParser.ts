import { ParsedTransaction, Currency, TransactionType } from '../../types';

/**
 * Parser para extractos de OCA (Organización de Crédito Automático)
 * Soporta tarjetas Visa y Mastercard
 */

export const parseOCAMasterCSV = (content: string): ParsedTransaction[] => {
  const lines = content.split('\n').filter(line => line.trim());
  const transactions: ParsedTransaction[] = [];

  // OCA Master formato: Fecha;Comercio;Importe;Cuotas
  // Ejemplo: "15/01/2024;DISCO MONTEVIDEO;5000,00;1/1"
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(';');
    
    if (parts.length < 3) continue;
    
    const fecha = parts[0].trim();
    const comercio = parts[1].trim();
    const importe = parts[2].trim();
    
    // Parsear fecha (formato DD/MM/YYYY)
    const [day, month, year] = fecha.split('/');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    if (isNaN(date.getTime())) continue;
    
    const amount = -Math.abs(parseFloat(importe.replace(/\./g, '').replace(',', '.')));
    
    transactions.push({
      date,
      description: comercio,
      amount,
      currency: 'UYU',
      type: 'expense'
    });
  }
  
  return transactions;
};

export const parseOCAVisaCSV = (content: string): ParsedTransaction[] => {
  const lines = content.split('\n').filter(line => line.trim());
  const transactions: ParsedTransaction[] = [];

  // OCA Visa formato similar a Master
  // Fecha;Comercio;Importe;Cuotas;Moneda
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(';');
    
    if (parts.length < 3) continue;
    
    const fecha = parts[0].trim();
    const comercio = parts[1].trim();
    const importe = parts[2].trim();
    const moneda = parts.length > 4 ? parts[4].trim() : 'UYU';
    
    const [day, month, year] = fecha.split('/');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    if (isNaN(date.getTime())) continue;
    
    const amount = -Math.abs(parseFloat(importe.replace(/\./g, '').replace(',', '.')));
    const currency: Currency = moneda === 'USD' ? 'USD' : 'UYU';
    
    transactions.push({
      date,
      description: comercio,
      amount,
      currency,
      type: 'expense'
    });
  }
  
  return transactions;
};

export const parseOCAPDF = async (file: File): Promise<ParsedTransaction[]> => {
  const pdfjsLib = await import('pdfjs-dist');
  
  // Configurar worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

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

  return parseOCAPDFText(fullText);
};

/**
 * Parser para texto extraído de PDF de OCA
 * Formato: DIA/MES TARJETA DESCRIPCION CUOTA MONTO_USD MONTO_UYU
 * Ejemplo: "26/ 3  09  APPLE.COM/BILL  2/ 3  26,66"
 */
const parseOCAPDFText = (text: string): ParsedTransaction[] => {
  const transactions: ParsedTransaction[] = [];
  const lines = text.split('\n');
  
  // Buscar el mes/año del extracto (formato: Mayo/2026)
  let extractMonth = new Date().getMonth() + 1;
  let extractYear = new Date().getFullYear();
  
  for (const line of lines) {
    const monthYearMatch = line.match(/(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\/(\d{4})/);
    if (monthYearMatch) {
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                         'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      extractMonth = monthNames.indexOf(monthYearMatch[1]) + 1;
      extractYear = parseInt(monthYearMatch[2]);
      break;
    }
  }
  
  for (const line of lines) {
    // Patrón para transacciones: DIA/MES TARJETA DESCRIPCION [CUOTA] MONTO
    // Ejemplos:
    // "26/ 3  09  APPLE.COM/BILL  2/ 3  26,66"
    // "7/ 5  09  DISCO N  27  3.360,97"
    // "3/ 5  09  Su Pago ..........  -216,25 *"
    
    const transactionPattern = /^\s*(\d{1,2})\/\s*(\d{1,2})\s+\d{2}\s+(.+?)\s+(?:(\d+)\/\s*(\d+)\s+)?([\d.,]+)\s*(\*)?$/;
    const match = line.match(transactionPattern);
    
    if (match) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]);
      const description = match[3].trim();
      const amountStr = match[6].replace(/\./g, '').replace(',', '.');
      const isPago = match[7] === '*' || description.includes('Su Pago');
      
      let amount = parseFloat(amountStr);
      
      // Determinar el año correcto
      let year = extractYear;
      if (month > extractMonth) {
        year = extractYear - 1;
      }
      
      const date = new Date(year, month - 1, day);
      
      if (isNaN(date.getTime()) || isNaN(amount)) continue;
      
      // Los pagos son positivos (ingresos), las compras son negativas (gastos)
      if (isPago) {
        amount = Math.abs(amount);
      } else {
        amount = -Math.abs(amount);
      }
      
      // Detectar moneda (por defecto UYU, a menos que la línea anterior diga "US Dollar")
      let currency: Currency = 'UYU';
      const lineIndex = lines.indexOf(line);
      if (lineIndex > 0) {
        const prevLine = lines[lineIndex - 1];
        if (prevLine.includes('US Dollar') || prevLine.includes('U$S')) {
          currency = 'USD';
        }
      }
      
      // Filtrar líneas que no son transacciones reales
      if (description.includes('Total compras') ||
          description.includes('TOTAL COMPRAS') ||
          description.includes('Ajuste por redondeo') ||
          description.includes('Reducción de IVA') ||
          description.includes('Seguro de vida')) {
        continue;
      }
      
      transactions.push({
        date,
        description: description.replace(/\s+/g, ' ').trim(),
        amount,
        currency,
        type: isPago ? 'income' : 'expense'
      });
    }
  }
  
  return transactions;
};

export const parseOCAExcel = (data: any[]): ParsedTransaction[] => {
  const transactions: ParsedTransaction[] = [];

  // OCA Excel: Fecha | Comercio | Importe | Cuotas
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    if (!row || row.length < 3) continue;
    
    const fechaValue = row[0];
    const comercio = String(row[1] || '').trim();
    const importe = row[2];
    
    let date: Date;
    if (typeof fechaValue === 'number') {
      date = new Date((fechaValue - 25569) * 86400 * 1000);
    } else {
      const [day, month, year] = String(fechaValue).split('/');
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    if (isNaN(date.getTime())) continue;
    
    const amount = -Math.abs(Number(importe));
    
    transactions.push({
      date,
      description: comercio,
      amount,
      currency: 'UYU',
      type: 'expense'
    });
  }
  
  return transactions;
};

// Made with Bob
