import { ParsedTransaction, Currency } from '../../types';

/**
 * Parser para archivos de IBM Employee Stock Purchase Plan
 * Formato: Excel (.xlsx) con detalles de cartera
 *
 * Cada fila es una asignación de acciones a la cartera IBM.
 * En la cuenta de inversión eso es un ingreso (entra valor), no un egreso.
 */

const findHeaderIndex = (
  headers: string[],
  predicates: Array<(h: string) => boolean>
): number => {
  for (const predicate of predicates) {
    const index = headers.findIndex(predicate);
    if (index >= 0) return index;
  }
  return -1;
};

/**
 * Parser para Excel de IBM - Portfolio Details
 */
export const parseIBMExcel = (data: unknown[]): ParsedTransaction[] => {
  console.log('🔵 Iniciando parser de IBM Portfolio');
  console.log('🔵 Total de filas recibidas:', data.length);

  const transactions: ParsedTransaction[] = [];

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const row = data[i];
    if (
      Array.isArray(row) &&
      row.some(cell => {
        const value = String(cell).toLowerCase();
        return (
          value.includes('fecha de asignación') ||
          value.includes('fecha de asignacion')
        );
      })
    ) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('No se encontró la fila de encabezados en el archivo de IBM');
  }

  const headerRow = data[headerRowIndex];
  if (!Array.isArray(headerRow)) {
    throw new Error('Encabezados inválidos en el archivo de IBM');
  }

  const headers = headerRow.map(h => String(h).toLowerCase().trim());

  const dateIndex = findHeaderIndex(headers, [
    h => h.includes('fecha de asignación') || h.includes('fecha de asignacion'),
  ]);
  // "Instrumento" (Purchase/Dividend Shares), no "Tipo de instrumento" (acciones)
  const instrumentIndex = findHeaderIndex(headers, [
    h => h === 'instrumento',
    h => h.includes('instrumento') && !h.includes('tipo'),
  ]);
  const quantityIndex = findHeaderIndex(headers, [
    h => h.includes('cantidad asignada'),
  ]);
  const availableIndex = findHeaderIndex(headers, [
    h => h.includes('cantidad disponible'),
  ]);
  const costBasisIndex = findHeaderIndex(headers, [
    h => h.includes('precio de ejercicio') || h.includes('base de costes'),
  ]);
  const currentValueIndex = findHeaderIndex(headers, [
    h => h.includes('valor actual disponible estimado'),
    h => h.includes('valor pendiente actual'),
  ]);

  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row) || row.length === 0) continue;

    try {
      const dateValue = row[dateIndex];
      const instrument = String(row[instrumentIndex] || '').trim();
      const quantity = parseFloat(String(row[quantityIndex] || 0).replace(',', '.'));
      const available = parseFloat(String(row[availableIndex] || 0).replace(',', '.'));
      const costBasis = parseFloat(String(row[costBasisIndex] || 0).replace(',', '.'));
      const currentValue = parseFloat(String(row[currentValueIndex] || 0).replace(',', '.'));

      if (!dateValue || !instrument || !Number.isFinite(quantity) || quantity === 0) {
        continue;
      }

      const date = parseIBMDate(dateValue);
      const instrumentLower = instrument.toLowerCase();
      const isDividend =
        instrumentLower.includes('dividend') || instrumentLower.includes('dividendo');

      // En la cuenta IBM Inversiones, las acciones que entran son ingreso.
      const costAmount = quantity * costBasis;
      const amount = isDividend
        ? (Number.isFinite(currentValue) && currentValue > 0 ? currentValue : costAmount)
        : costAmount;

      if (!Number.isFinite(amount) || amount === 0) continue;

      let description = isDividend
        ? `IBM ESPP - Dividendo: ${quantity.toFixed(3)} acciones (valor: $${amount.toFixed(2)})`
        : `IBM ESPP - Compra de ${quantity.toFixed(3)} acciones a $${costBasis.toFixed(2)}`;

      if (available > 0) {
        description += ` | Disponibles: ${available.toFixed(3)} acciones`;
      }

      transactions.push({
        date,
        description,
        amount: Math.abs(amount),
        currency: 'USD' as Currency,
        type: 'income',
      });
    } catch (error) {
      console.warn('⚠️ Error al procesar fila IBM:', i, error);
    }
  }

  console.log('🔵 Total de transacciones parseadas:', transactions.length);
  return transactions;
};

/**
 * Parsea fechas de IBM (formato: YYYY-MM-DD o serial de Excel)
 */
const parseIBMDate = (dateValue: unknown): Date => {
  if (typeof dateValue === 'number') {
    const excelEpoch = new Date(1900, 0, 1);
    const days = dateValue - 2;
    return new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
  }

  const dateStr = String(dateValue).trim();
  const match = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Formato de fecha no reconocido: ${dateStr}`);
  }
  return date;
};
