import { ParsedTransaction, Currency } from '../../types';
import { parseStatementAmount } from '../../utils/parseAmount';

/**
 * Parser para extractos de OCA (Organización de Crédito Automático)
 * Soporta tarjetas Visa y Mastercard
 */

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const HEADER_NOISE = [
  'próximo vencimiento',
  'proximo vencimiento',
  'próximo cierre',
  'proximo cierre',
  'total compras',
  'seguro de vida',
  'ajuste por redondeo',
  'interés bonificable',
  'interes bonificable',
  'iva interés',
  'iva interes',
  'pago total',
  't.e.a',
  'reducción de iva',
  '(copia)',
];

const isNoiseDescription = (description: string): boolean => {
  const lower = description.toLowerCase();
  return HEADER_NOISE.some(noise => lower.includes(noise));
};

export const parseOCAMasterCSV = (content: string): ParsedTransaction[] => {
  const lines = content.split('\n').filter(line => line.trim());
  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(';');

    if (parts.length < 3) continue;

    const fecha = parts[0].trim();
    const comercio = parts[1].trim();
    const importe = parts[2].trim();

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

/**
 * Quita encabezados de página y el pie del resumen OCA (vencimientos, totales, etc.).
 */
const cleanOCAPDFText = (text: string): string => {
  let cleaned = text.replace(/\s+/g, ' ');

  // Encabezado repetido en cada página del resumen
  cleaned = cleaned.replace(
    /OCA\s+\d+\s+\d+\s*\/\s*\d+\s+[A-ZÁÉÍÓÚÑÜ][\s\S]*?(?:U\$S\s+[\d.,]+\s+)?\$\s*[\d.]+,?\d*/gi,
    ' '
  );

  // Cortar desde totales / pie (no son movimientos)
  const footerMatch = cleaned.search(
    /Total compras tarjeta|TOTAL COMPRAS DEL MES|Próximo cierre|Próximo vencimiento|Proximo cierre|Proximo vencimiento/i
  );
  if (footerMatch >= 0) {
    cleaned = cleaned.slice(0, footerMatch);
  }

  return cleaned.replace(/\s+/g, ' ').trim();
};

const resolveStatementPeriod = (text: string): { month: number; year: number } => {
  const monthYearMatch = text.match(
    /(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\/(\d{4})/i
  );
  if (monthYearMatch) {
    const monthIndex = MONTH_NAMES.findIndex(
      m => m.toLowerCase() === monthYearMatch[1].toLowerCase()
    );
    if (monthIndex >= 0) {
      return { month: monthIndex + 1, year: parseInt(monthYearMatch[2], 10) };
    }
  }
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
};

/**
 * Parser para texto extraído de PDF de OCA.
 * Formato típico: `26/ 3  09  APPLE.COM/BILL  3/ 3  26,67 US Dollar  79,99`
 */
export const parseOCAPDFText = (text: string): ParsedTransaction[] => {
  const period = resolveStatementPeriod(text);
  const body = cleanOCAPDFText(text);
  const transactions: ParsedTransaction[] = [];

  const startRe = /(\d{1,2})\/\s*(\d{1,2})\s+(\d{2})\s+/g;
  const starts: Array<{ index: number; day: number; month: number; end: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = startRe.exec(body)) !== null) {
    starts.push({
      index: match.index,
      day: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
      end: match.index + match[0].length,
    });
  }

  for (let i = 0; i < starts.length; i++) {
    const current = starts[i];
    const next = starts[i + 1];
    const chunk = body.slice(current.end, next ? next.index : body.length).trim();
    if (!chunk) continue;

    const usdMatch = chunk.match(
      /(-?[\d.]+,\d{2})\s+US\s+Dollar\s+(-?[\d.]+,\d{2})\s*\*?$/i
    );
    const amountMatch = chunk.match(/\*?\s*(-?[\d.]+,\d{2})\s*\*?\s*$/);

    let currency: Currency = 'UYU';
    let amountRaw: string | null = null;
    let descEnd = -1;

    if (usdMatch && usdMatch.index !== undefined) {
      currency = 'USD';
      amountRaw = usdMatch[1];
      descEnd = usdMatch.index;
    } else if (amountMatch && amountMatch.index !== undefined) {
      amountRaw = amountMatch[1];
      descEnd = amountMatch.index;
    } else {
      continue;
    }

    let description = chunk
      .slice(0, descEnd)
      .replace(/\s+\d+\s*\/\s*\d+\s*$/, '')
      .replace(/\*+/g, ' ')
      .replace(/\.+/g, '.')
      .replace(/\s+/g, ' ')
      .trim();

    if (!description || isNoiseDescription(description)) continue;

    const amountValue = parseStatementAmount(amountRaw);
    if (amountValue === null || !Number.isFinite(amountValue)) continue;

    let year = period.year;
    if (current.month > period.month) {
      year = period.year - 1;
    }

    const date = new Date(year, current.month - 1, current.day);
    if (isNaN(date.getTime())) continue;

    const isPago =
      /\bsu\s+pago\b/i.test(description) ||
      /\*\s*-?[\d.]+,\d{2}\s*$|-?[\d.]+,\d{2}\s*\*\s*$/.test(chunk);

    const amount = isPago ? Math.abs(amountValue) : -Math.abs(amountValue);

    transactions.push({
      date,
      description,
      amount,
      currency,
      type: isPago ? 'income' : 'expense',
    });
  }

  console.log(`✅ OCA: ${transactions.length} transacciones parseadas`);
  return transactions;
};

export const parseOCAPDF = async (file: File): Promise<ParsedTransaction[]> => {
  const pdfjsLib = await import('pdfjs-dist');

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => ('str' in item ? item.str : '') || '')
      .join(' ');
    fullText += pageText + '\n';
  }

  return parseOCAPDFText(fullText);
};

export const parseOCAExcel = (data: unknown[]): ParsedTransaction[] => {
  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[];

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
