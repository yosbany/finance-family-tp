import { ParsedTransaction, TransactionType } from '../../types';

/**
 * Parser para extractos del BROU (Banco República Oriental del Uruguay)
 * Soporta formatos CSV y Excel de conciliación / movimientos
 */

const parseBROUDate = (fecha: unknown): Date | null => {
  if (typeof fecha === 'number') {
    const date = new Date((fecha - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  if (typeof fecha !== 'string') return null;
  const [day, month, year] = fecha.trim().split(/[/-]/);
  if (!day || !month || !year) return null;
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  return isNaN(date.getTime()) ? null : date;
};

const parseBROUAmount = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value !== 0) {
    return Math.abs(value);
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  // BROU suele usar punto decimal; a veces miles con punto y decimal con coma
  const raw = value.trim().replace(/\s/g, '');
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  const n = Number(normalized);
  return Number.isFinite(n) && n !== 0 ? Math.abs(n) : null;
};

const isBalanceOrNoiseRow = (description: string): boolean => {
  const d = description.toLowerCase();
  return (
    d.includes('saldo inicial') ||
    d.includes('saldo final') ||
    d.includes('total') ||
    d === 'movimientos' ||
    d.startsWith('esta información')
  );
};

export const parseBROUDebitCSV = (content: string): ParsedTransaction[] => {
  const lines = content.split('\n').filter(line => line.trim());
  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const matches = line.match(/"([^"]+)"|([^,]+)/g);

    if (!matches || matches.length < 4) continue;

    const fecha = matches[0].replace(/"/g, '').trim();
    const descripcion = matches[1].replace(/"/g, '').trim();
    const debito = matches[2].replace(/"/g, '').trim();
    const credito = matches[3].replace(/"/g, '').trim();

    if (isBalanceOrNoiseRow(descripcion)) continue;

    const date = parseBROUDate(fecha);
    if (!date) continue;

    let amount = 0;
    let type: TransactionType = 'expense';

    const debitoAmt = parseBROUAmount(debito);
    const creditoAmt = parseBROUAmount(credito);

    if (debitoAmt) {
      amount = debitoAmt;
      type = 'expense';
    } else if (creditoAmt) {
      amount = creditoAmt;
      type = 'income';
    } else {
      continue;
    }

    transactions.push({
      date,
      description: descripcion,
      amount,
      currency: 'UYU',
      type,
    });
  }

  return transactions;
};

export const parseBROUCreditCSV = (content: string): ParsedTransaction[] => {
  const lines = content.split('\n').filter(line => line.trim());
  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const matches = line.match(/"([^"]+)"|([^,]+)/g);

    if (!matches || matches.length < 3) continue;

    const fecha = matches[0].replace(/"/g, '').trim();
    const comercio = matches[1].replace(/"/g, '').trim();
    const monto = matches[2].replace(/"/g, '').trim();

    const date = parseBROUDate(fecha);
    if (!date) continue;

    const amount = parseBROUAmount(monto);
    if (!amount) continue;

    transactions.push({
      date,
      description: comercio,
      amount,
      currency: 'UYU',
      type: 'expense',
    });
  }

  return transactions;
};

/**
 * Excel "Conciliación de Cuentas" BROU:
 * Fecha | Descripción | … | Número documento | … | Asunto | Dependencia | Débito | Crédito
 */
export const parseBROUExcel = (data: any[][]): ParsedTransaction[] => {
  const transactions: ParsedTransaction[] = [];

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(50, data.length); i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    const cells = row.map(c => String(c || '').toLowerCase());
    if (cells[0] === 'fecha' && cells.some(c => c.startsWith('descrip'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.warn('❌ No se encontró la fila de headers en el Excel de BROU');
    return transactions;
  }

  const header = data[headerRowIndex].map((c: unknown) =>
    String(c || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  );

  const findCol = (...names: string[]) =>
    header.findIndex(h => names.some(n => h === n || h.startsWith(n)));

  const colDate = findCol('fecha');
  const colDesc = findCol('descrip');
  const colAsunto = findCol('asunto');
  let colDebito = findCol('debito');
  let colCredito = findCol('credito');

  // Fallback del layout actual de Conciliación de Cuentas
  if (colDebito < 0) colDebito = 7;
  if (colCredito < 0) colCredito = 8;

  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const fecha = row[colDate >= 0 ? colDate : 0];
    const descripcionRaw = row[colDesc >= 0 ? colDesc : 1];
    if (!fecha || descripcionRaw === undefined || descripcionRaw === '') continue;

    const descripcion = String(descripcionRaw).trim().replace(/\s+/g, ' ');
    if (isBalanceOrNoiseRow(descripcion)) continue;

    const date = parseBROUDate(fecha);
    if (!date) continue;

    const debitoAmt = parseBROUAmount(row[colDebito]);
    const creditoAmt = parseBROUAmount(row[colCredito]);

    let amount = 0;
    let type: TransactionType = 'expense';

    if (debitoAmt) {
      amount = debitoAmt;
      type = 'expense';
    } else if (creditoAmt) {
      amount = creditoAmt;
      type = 'income';
    } else {
      continue;
    }

    const asunto =
      colAsunto >= 0 && row[colAsunto] != null && String(row[colAsunto]).trim()
        ? String(row[colAsunto]).trim()
        : '';

    transactions.push({
      date,
      description: asunto ? `${descripcion} · ${asunto}` : descripcion,
      amount,
      currency: 'UYU',
      type,
    });
  }

  console.log('📄 Transacciones parseadas de BROU Excel:', transactions.length);
  return transactions;
};

export const parseBROUPDF = async (_file: File): Promise<ParsedTransaction[]> => {
  return [];
};
