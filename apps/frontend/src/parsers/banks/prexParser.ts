import { ParsedTransaction, Currency, TransactionType, ExchangeRates } from '../../types';
import { DEFAULT_EXCHANGE_RATES } from '../../services/settings.service';
import { toUyu } from '../../utils/calculations';

type SourceCurrency = 'UYU' | 'USD' | 'BRL';

const parsePrexDate = (fechaValue: unknown): Date | null => {
  if (typeof fechaValue === 'number') {
    const date = new Date((fechaValue - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }

  const raw = String(fechaValue || '').trim();
  if (!raw) return null;

  const [day, month, year] = raw.split(/[/-]/);
  if (!day || !month || !year) return null;

  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  return isNaN(date.getTime()) ? null : date;
};

const normalizeCurrency = (value: unknown): SourceCurrency | null => {
  const code = String(value || '').trim().toUpperCase();
  if (code === 'UYU' || code === 'USD' || code === 'BRL') return code;
  return null;
};

const parseAmount = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value || '').trim();
  if (!raw) return null;
  // Prex usa punto decimal: -245.38 / 1850.75
  const n = Number(raw.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const findHeaderIndex = (rows: any[]): number => {
  const max = Math.min(rows.length, 15);
  for (let i = 0; i < max; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const joined = row.map(c => String(c || '').toLowerCase()).join('|');
    if (joined.includes('fecha') && joined.includes('descrip') && joined.includes('importe')) {
      return i;
    }
  }
  return 0;
};

const columnMap = (header: any[]) => {
  const norm = (v: unknown) =>
    String(v || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const idx = {
    date: -1,
    description: -1,
    currency: -1,
    amount: -1,
    status: -1,
  };

  header.forEach((cell, i) => {
    const h = norm(cell);
    if (h === 'fecha') idx.date = i;
    else if (h.startsWith('descrip')) idx.description = i;
    else if (h === 'moneda') idx.currency = i;
    else if (h === 'importe') idx.amount = i;
    else if (h === 'estado') idx.status = i;
  });

  return idx;
};

/**
 * Convierte el movimiento a UYU (cuenta Prex única) y deja nota del monto original.
 */
const toPrexTransaction = (
  date: Date,
  description: string,
  signedAmount: number,
  sourceCurrency: SourceCurrency,
  rates: ExchangeRates
): ParsedTransaction => {
  const type: TransactionType = signedAmount >= 0 ? 'income' : 'expense';
  const absOriginal = Math.abs(signedAmount);

  let amountUyu = absOriginal;
  let finalDescription = description;

  if (sourceCurrency === 'BRL') {
    amountUyu = Math.round(toUyu(absOriginal, 'BRL', rates) * 100) / 100;
    finalDescription = `${description} · orig. R$ ${absOriginal.toLocaleString('es-UY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  } else if (sourceCurrency === 'USD') {
    amountUyu = Math.round(toUyu(absOriginal, 'USD', rates) * 100) / 100;
    finalDescription = `${description} · orig. US$ ${absOriginal.toLocaleString('es-UY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return {
    date,
    description: finalDescription,
    amount: amountUyu,
    currency: 'UYU' as Currency,
    type,
  };
};

/**
 * Parser Prex — formato real de "Estado de cuenta":
 * Fecha | Descripción | Moneda Origen | Importe Origen | Moneda | Importe | Estado
 * Una sola cuenta en UYU; BRL/USD se convierten con las tasas configuradas.
 */
export const parsePrexExcel = (
  data: any[],
  _currency: Currency = 'UYU',
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES
): ParsedTransaction[] => {
  if (!data?.length) return [];

  const headerRowIndex = findHeaderIndex(data);
  const header = data[headerRowIndex] || [];
  const cols = columnMap(header);

  if (cols.date < 0 || cols.description < 0 || cols.amount < 0) {
    // Fallback columnas fijas del extracto actual
    cols.date = 0;
    cols.description = 1;
    cols.currency = 4;
    cols.amount = 5;
    cols.status = 6;
  }

  const transactions: ParsedTransaction[] = [];

  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !Array.isArray(row)) continue;

    if (cols.status >= 0) {
      const status = String(row[cols.status] || '').trim().toLowerCase();
      if (status && status !== 'confirmado') continue;
    }

    const date = parsePrexDate(row[cols.date]);
    if (!date) continue;

    const description = String(row[cols.description] || '').trim();
    if (!description) continue;

    const signedAmount = parseAmount(row[cols.amount]);
    if (signedAmount === null || signedAmount === 0) continue;

    const sourceCurrency =
      (cols.currency >= 0 ? normalizeCurrency(row[cols.currency]) : null) || 'UYU';

    transactions.push(
      toPrexTransaction(date, description, signedAmount, sourceCurrency, rates)
    );
  }

  return transactions;
};

export const parsePrexCSV = (
  content: string,
  currency: Currency = 'UYU',
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES
): ParsedTransaction[] => {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  // Reusar parser Excel a partir de CSV simple
  const rows = lines.map(line => {
    const matches = line.match(/"([^"]*)"|([^,;]+)/g);
    if (!matches) return [];
    return matches.map(m => m.replace(/^"|"$/g, '').trim());
  });

  return parsePrexExcel(rows, currency, rates);
};
