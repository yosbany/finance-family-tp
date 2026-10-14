import { ParsedTransaction, TransactionType } from '../../types';
import { parseStatementAmount } from '../../utils/parseAmount';

/**
 * Parser para estados de cuenta BHU (YO AHORRO) en PDF.
 * Formato típico por movimiento:
 * DD/MM/YYYY Depósito Tranf-Banc 3.279,39 6,10 $ 20.000,00 690 días 12191068
 */

const MOVIMIENTO_REGEX =
  /(\d{2}\/\d{2}\/\d{4})\s+(Depósito|Extracción|Débito|Crédito|Debito|Credito)\s+([A-Za-zÁÉÍÓÚáéíóúñÑ0-9\-\s/.]+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d+,\d{2})\s+\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d+)\s*días\s+(\d+)/gi;

const HEADER_NOISE = [
  'nombre completo',
  'documento de identidad',
  'datos del cliente',
  'datos de la cuenta',
  'origen de los datos',
  'estado de cuenta',
  'saldo total',
  'número de cuenta',
  'numero de cuenta',
  'info@bhu',
  'monto (ui)',
  'antigüedad',
  'comprobante',
];

const isNoiseDescription = (description: string): boolean => {
  const lower = description.toLowerCase();
  return HEADER_NOISE.some(token => lower.includes(token));
};

const parseBHUDate = (dateStr: string): Date | null => {
  const [day, month, year] = dateStr.split('/').map(Number);
  if (!day || !month || !year) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeTipo = (tipo: string): TransactionType => {
  const value = tipo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (value.includes('deposito') || value.includes('credito')) {
    return 'income';
  }
  return 'expense';
};

/**
 * Parsea el texto plano extraído del PDF del BHU.
 * Usado por parseByBank (que ya extrae el texto del PDF).
 */
export const parseBHUPDFText = (text: string): ParsedTransaction[] => {
  const transactions: ParsedTransaction[] = [];

  // Preferir la sección de movimientos si existe
  const movimientosMatch = text.match(/Movimientos[\s\S]*?(?=info@bhu\.net|$)/i);
  const sourceText = movimientosMatch?.[0] || text;

  let match: RegExpExecArray | null;
  MOVIMIENTO_REGEX.lastIndex = 0;

  while ((match = MOVIMIENTO_REGEX.exec(sourceText)) !== null) {
    const [, dateStr, tipo, conceptoRaw, montoUI, , montoPesos] = match;
    const descriptionBase = `${tipo} ${conceptoRaw}`.replace(/\s+/g, ' ').trim();

    if (isNoiseDescription(descriptionBase)) continue;

    const date = parseBHUDate(dateStr);
    if (!date) continue;

    const amount = parseStatementAmount(montoPesos);
    if (amount === null || amount === 0) continue;

    const type = normalizeTipo(tipo);
    const description = `${descriptionBase} (${montoUI} UI)`.trim();

    transactions.push({
      date,
      description,
      amount: Math.abs(amount),
      currency: 'UYU',
      type,
    });
  }

  // Fallback más tolerante si el PDF viene sin espacios regulares
  if (transactions.length === 0) {
    const compactPattern =
      /(\d{2}\/\d{2}\/\d{4})\s*(Depósito|Extracción|Débito|Crédito|Debito|Credito)\s*([A-Za-zÁÉÍÓÚáéíóúñÑ\-]+)\s*([\d.,]+)\s*([\d,]+)\s*\$\s*([\d.,]+)\s*(\d+)\s*días\s*(\d+)/gi;

    while ((match = compactPattern.exec(sourceText)) !== null) {
      const [, dateStr, tipo, concepto, montoUI, , montoPesos] = match;
      const date = parseBHUDate(dateStr);
      if (!date) continue;

      const amount = parseStatementAmount(montoPesos);
      if (amount === null || amount === 0) continue;

      transactions.push({
        date,
        description: `${tipo} ${concepto} (${montoUI} UI)`,
        amount: Math.abs(amount),
        currency: 'UYU',
        type: normalizeTipo(tipo),
      });
    }
  }

  console.log(`✅ BHU: ${transactions.length} transacciones parseadas`);
  return transactions;
};

/**
 * Compatibilidad: si se llama con File, extrae texto y parsea.
 * En el flujo normal de la app se usa parseBHUPDFText vía parseByBank.
 */
export const parseBHUPDF = async (input: File | string): Promise<ParsedTransaction[]> => {
  if (typeof input === 'string') {
    return parseBHUPDFText(input);
  }

  throw new Error(
    'El parser BHU espera texto del PDF. Usá el flujo de carga de extractos de la app.'
  );
};

export const parseBHUCSV = (_content: string): ParsedTransaction[] => {
  console.warn('Parser CSV del BHU no implementado. Usá PDF.');
  return [];
};

export const parseBHUExcel = (_data: unknown[]): ParsedTransaction[] => {
  console.warn('Parser Excel del BHU no implementado. Usá PDF.');
  return [];
};
