import { ParsedTransaction, Currency, TransactionType } from '../../types';
import { parseStatementAmount } from '../../utils/parseAmount';

/**
 * Parser para extractos de Santander Uruguay
 * Soporta cuentas de débito y tarjetas Visa
 */

export const parseSantanderDebitCSV = (content: string): ParsedTransaction[] => {
  const lines = content.split('\n').filter(line => line.trim());
  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const matches = line.match(/"([^"]+)"|([^,]+)/g);

    if (!matches || matches.length < 3) continue;

    const fecha = matches[0].replace(/"/g, '').trim();
    const descripcion = matches[1].replace(/"/g, '').trim();
    const importe = matches[2].replace(/"/g, '').trim();

    const [day, month, year] = fecha.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

    if (isNaN(date.getTime())) continue;

    const amount = parseStatementAmount(importe);
    if (amount === null || amount === 0) continue;

    const type: TransactionType = amount > 0 ? 'income' : 'expense';

    transactions.push({
      date,
      description: descripcion,
      amount: Math.abs(amount),
      currency: 'UYU',
      type
    });
  }

  return transactions;
};

export const parseSantanderCreditCSV = (content: string): ParsedTransaction[] => {
  const lines = content.split('\n').filter(line => line.trim());
  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const matches = line.match(/"([^"]+)"|([^,]+)/g);

    if (!matches || matches.length < 4) continue;

    const fecha = matches[0].replace(/"/g, '').trim();
    const comercio = matches[1].replace(/"/g, '').trim();
    const importe = matches[2].replace(/"/g, '').trim();
    const moneda = matches[3].replace(/"/g, '').trim();

    const [day, month, year] = fecha.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

    if (isNaN(date.getTime())) continue;

    const amount = parseStatementAmount(importe);
    if (amount === null || amount === 0) continue;

    const currency: Currency = moneda === 'USD' ? 'USD' : 'UYU';

    transactions.push({
      date,
      description: comercio,
      amount: Math.abs(amount),
      currency,
      type: 'expense'
    });
  }

  return transactions;
};

const parseSantanderCreditCardExcel = (data: any[]): ParsedTransaction[] => {
  const transactions: ParsedTransaction[] = [];

  console.log('💳 Parseando Tarjeta de Crédito Santander');

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(data.length, 25); i++) {
    const row = data[i];
    if (Array.isArray(row)) {
      const rowStr = row.join('|').toLowerCase();
      if (rowStr.includes('fecha') && rowStr.includes('detalle') &&
          (rowStr.includes('importe $') || rowStr.includes('importe u$s'))) {
        headerRowIndex = i;
        console.log('💳 Fila de encabezados encontrada en índice:', i);
        break;
      }
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('No se encontró la fila de encabezados en el archivo de tarjeta de crédito');
  }

  const headers = data[headerRowIndex];

  const dateIndex = headers.findIndex((h: any) =>
    String(h).toLowerCase().includes('fecha')
  );
  const detailIndex = headers.findIndex((h: any) =>
    String(h).toLowerCase().includes('detalle')
  );
  const amountPesosIndex = headers.findIndex((h: any) =>
    String(h).toLowerCase().includes('importe $')
  );
  const amountUSDIndex = headers.findIndex((h: any) =>
    String(h).toLowerCase().includes('importe u$s') ||
    String(h).toLowerCase().includes('importe us$')
  );

  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];

    if (!Array.isArray(row) || row.length === 0) continue;

    try {
      const fechaValue = row[dateIndex];
      const detalle = String(row[detailIndex] || '').trim();
      const importePesos = row[amountPesosIndex];
      const importeUSD = row[amountUSDIndex];

      if (!fechaValue || !detalle ||
          detalle.toLowerCase().includes('saldo anterior') ||
          detalle.toLowerCase().includes('saldo final')) {
        continue;
      }

      let date: Date;
      if (typeof fechaValue === 'number') {
        date = new Date((fechaValue - 25569) * 86400 * 1000);
      } else {
        const dateStr = String(fechaValue).trim();
        const [day, month, year] = dateStr.split('/');
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      if (isNaN(date.getTime())) continue;

      const pesosAmount = parseStatementAmount(importePesos);
      if (pesosAmount !== null && pesosAmount !== 0) {
        transactions.push({
          date,
          description: detalle,
          amount: Math.abs(pesosAmount),
          currency: 'UYU',
          type: pesosAmount < 0 ? 'income' : 'expense'
        });
      }

      const usdAmount = parseStatementAmount(importeUSD);
      if (usdAmount !== null && usdAmount !== 0) {
        transactions.push({
          date,
          description: detalle,
          amount: Math.abs(usdAmount),
          currency: 'USD',
          type: usdAmount < 0 ? 'income' : 'expense'
        });
      }
    } catch (error) {
      console.warn('⚠️ Error al procesar fila', i, ':', error);
      continue;
    }
  }

  console.log('💳 Total de transacciones parseadas:', transactions.length);
  return transactions;
};

export const parseSantanderExcel = (data: any[]): ParsedTransaction[] => {
  const transactions: ParsedTransaction[] = [];

  console.log('🏦 Iniciando parser de Santander Excel');
  console.log('🏦 Total de filas:', data.length);

  // No usar la palabra "tarjeta": en débito aparece en "COMPRA CON TARJETA DEBITO".
  let isCreditCard = false;
  for (let i = 0; i < Math.min(data.length, 25); i++) {
    const row = data[i];
    if (Array.isArray(row)) {
      const rowStr = row.join('|').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const looksLikeCreditHeader =
        rowStr.includes('limite de credito') ||
        (rowStr.includes('detalle') &&
          (rowStr.includes('importe $') || rowStr.includes('importe u$s') || rowStr.includes('importe us$')));
      if (looksLikeCreditHeader) {
        isCreditCard = true;
        console.log('💳 Detectado: Archivo de Tarjeta de Crédito');
        break;
      }
    }
  }

  if (isCreditCard) {
    return parseSantanderCreditCardExcel(data);
  }

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const row = data[i];
    if (Array.isArray(row)) {
      const rowStr = row.join('|').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (rowStr.includes('fecha') && rowStr.includes('debito') && rowStr.includes('credito')) {
        headerRowIndex = i;
        console.log('🏦 Fila de encabezados encontrada en índice:', i);
        break;
      }
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('No se encontró la fila de encabezados en el archivo de Santander');
  }

  const headers = data[headerRowIndex];
  const normalizeHeader = (h: unknown) =>
    String(h).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const dateIndex = headers.findIndex((h: any) => normalizeHeader(h).includes('fecha'));
  const descIndex = headers.findIndex((h: any) => {
    const value = normalizeHeader(h);
    return value.includes('descripcion') || value.includes('tipo movimiento') || value.includes('concepto');
  });
  const debitIndex = headers.findIndex((h: any) => normalizeHeader(h).includes('debito'));
  const creditIndex = headers.findIndex((h: any) => normalizeHeader(h).includes('credito'));

  console.log('🏦 Índices de columnas:', { dateIndex, descIndex, debitIndex, creditIndex });

  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];

    if (!Array.isArray(row) || row.length === 0) continue;

    try {
      const fechaValue = row[dateIndex];
      const descripcion = String(row[descIndex] || '').trim();
      const debito = row[debitIndex];
      const credito = row[creditIndex];

      if (!fechaValue || !descripcion || descripcion === 'Saldo inicial') continue;

      let date: Date;
      if (typeof fechaValue === 'number') {
        date = new Date((fechaValue - 25569) * 86400 * 1000);
      } else {
        const dateStr = String(fechaValue).trim();
        const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
        if (parts.length < 3) continue;
        const [day, month, year] = parts;
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      if (isNaN(date.getTime())) continue;

      const debitAmount = parseStatementAmount(debito);
      const creditAmount = parseStatementAmount(credito);

      let amount = 0;
      let type: TransactionType = 'expense';

      if (debitAmount !== null && debitAmount !== 0) {
        amount = Math.abs(debitAmount);
        type = 'expense';
      } else if (creditAmount !== null && creditAmount !== 0) {
        amount = Math.abs(creditAmount);
        type = 'income';
      } else {
        continue;
      }

      if (!Number.isFinite(amount) || amount === 0) continue;

      transactions.push({
        date,
        description: descripcion,
        amount,
        currency: 'UYU',
        type
      });
    } catch (error) {
      console.warn('⚠️ Error al procesar fila', i, ':', error);
      continue;
    }
  }

  console.log('🏦 Total de transacciones parseadas:', transactions.length);
  return transactions;
};
