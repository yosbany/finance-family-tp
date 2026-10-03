import { ParsedTransaction, Currency, TransactionType } from '../../types';

/**
 * Parser para extractos de Itaú Uruguay
 * Soporta cuentas de débito, tarjetas de crédito Visa
 */

export const parseItauDebitCSV = (content: string): ParsedTransaction[] => {
  const lines = content.split('\n').filter(line => line.trim());
  const transactions: ParsedTransaction[] = [];

  // Itaú formato: Fecha;Descripción;Referencia;Débito;Crédito;Saldo
  // Ejemplo: "15/01/2024;COMPRA TIENDA INGLESA;REF123;5000,00;;45000,00"
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(';');
    
    if (parts.length < 5) continue;
    
    const fecha = parts[0].trim();
    const descripcion = parts[1].trim();
    const debito = parts[3].trim();
    const credito = parts[4].trim();
    
    // Parsear fecha (formato DD/MM/YYYY)
    const [day, month, year] = fecha.split('/');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    if (isNaN(date.getTime())) continue;
    
    let amount = 0;
    let type: TransactionType = 'expense';
    
    if (debito && debito !== '') {
      amount = -Math.abs(parseFloat(debito.replace(/\./g, '').replace(',', '.')));
      type = 'expense';
    } else if (credito && credito !== '') {
      amount = Math.abs(parseFloat(credito.replace(/\./g, '').replace(',', '.')));
      type = 'income';
    }
    
    if (amount === 0) continue;
    
    transactions.push({
      date,
      description: descripcion,
      amount,
      currency: 'UYU',
      type
    });
  }
  
  return transactions;
};

export const parseItauCreditCSV = (content: string): ParsedTransaction[] => {
  const lines = content.split('\n').filter(line => line.trim());
  const transactions: ParsedTransaction[] = [];

  // Itaú Visa formato: Fecha;Comercio;Monto;Moneda;Cuotas
  // Ejemplo: "15/01/2024;DISCO MONTEVIDEO;5000,00;UYU;1/1"
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(';');
    
    if (parts.length < 4) continue;
    
    const fecha = parts[0].trim();
    const comercio = parts[1].trim();
    const monto = parts[2].trim();
    const moneda = parts[3].trim();
    
    const [day, month, year] = fecha.split('/');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    if (isNaN(date.getTime())) continue;
    
    const amount = -Math.abs(parseFloat(monto.replace(/\./g, '').replace(',', '.')));
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

export const parseItauCreditPDF = (content: string): ParsedTransaction[] => {
  const transactions: ParsedTransaction[] = [];

  // Solo el cuerpo de movimientos (hasta SALDO CONTADO). Ignorar financiación / página 2.
  const startMarker = content.search(/SALDO DEL ESTADO DE CUENTA ANTERIOR/i);
  const endMarker = content.search(/SALDO CONTADO/i);
  const body =
    startMarker >= 0
      ? content.slice(
          startMarker,
          endMarker > startMarker ? endMarker : content.length
        )
      : content.split(/Financiá tus saldos|PESOS URUGUAYOS/i)[0];

  const statementDateMatch = content.match(/\b(\d{2})\/(\d{2})\/(\d{2})\b/);
  const fallbackDate = statementDateMatch
    ? new Date(
        2000 + parseInt(statementDateMatch[3], 10),
        parseInt(statementDateMatch[2], 10) - 1,
        parseInt(statementDateMatch[1], 10)
      )
    : new Date();

  const parseMoneyToken = (token: string): number | null => {
    const negative = token.trim().startsWith('-');
    const raw = token.trim().replace(/-/g, '');
    // miles con punto: 28.610,65 · o simple 1930,10 / 20,00
    const normalized = raw.includes('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(',', '.');
    const n = Number(normalized);
    if (!Number.isFinite(n) || n === 0) return null;
    return negative ? -n : n;
  };

  const moneyRe = /-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}/g;

  const pushTx = (
    date: Date,
    description: string,
    signedAmount: number,
    currency: Currency
  ) => {
    if (!signedAmount) return;
    const type: TransactionType = signedAmount < 0 ? 'income' : 'expense';
    transactions.push({
      date,
      description: description.replace(/\s+/g, ' ').trim(),
      amount: Math.abs(signedAmount),
      currency,
      type,
    });
  };

  // Dividir por fechas DD MM AA + (PAGOS|código tarjeta)
  const datePattern = /(\d{2}\s+\d{2}\s+\d{2}\s+(?:PAGOS|\d{4}))/g;
  const matches: Array<{ index: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = datePattern.exec(body)) !== null) {
    matches.push({ index: match.index });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i < matches.length - 1 ? matches[i + 1].index : body.length;
    let line = body.slice(start, end).trim();
    // Cortar si se coló un cargo sin fecha al final de la última línea
    const feeCut = line.search(/\sINTERESES\s|\sSEGURO DE VIDA\s/i);
    if (feeCut > 20) line = line.slice(0, feeCut);

    const header = line.match(/^(\d{2})\s+(\d{2})\s+(\d{2})\s+(PAGOS|\d{4})\s+(.*)$/i);
    if (!header) continue;

    const [, day, month, year, cardOrPago, rest] = header;
    const date = new Date(2000 + parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    if (isNaN(date.getTime())) continue;

    const amounts = [...rest.matchAll(moneyRe)].map(m => parseMoneyToken(m[0])).filter((n): n is number => n != null);
    if (amounts.length === 0) continue;

    let description = rest.replace(moneyRe, ' ').replace(/\s+/g, ' ').trim();
    const cuota = description.match(/\b(\d+)\s*\/\s*(\d+)\b/);
    if (cuota) {
      description = description.replace(cuota[0], '').replace(/\s+/g, ' ').trim();
      description = `${description} (${cuota[1]}/${cuota[2]})`;
    }

    if (cardOrPago.toUpperCase() === 'PAGOS') {
      description = 'PAGO TARJETA DE CRÉDITO';
      // Importe $ y/o Importe U$S
      if (amounts.length >= 2) {
        const [pesos, dollars] = amounts;
        if (pesos) pushTx(date, description, pesos, 'UYU');
        if (dollars) pushTx(date, `${description} (USD)`, dollars, 'USD');
      } else {
        pushTx(date, description, amounts[0], 'UYU');
      }
      continue;
    }

    // Una sola cifra → pesos. Dos cifras sin miles en la 1ª → origen + U$S → USD.
    // Dos cifras con miles en la 1ª (28.610,65) → $ + U$S.
    if (amounts.length === 1) {
      const currency: Currency =
        Math.abs(amounts[0]) < 1 && /AJUSTE/i.test(description) ? 'USD' : 'UYU';
      pushTx(date, description, amounts[0], currency);
    } else {
      const firstToken = rest.match(moneyRe)?.[0] || '';
      if (/^-?\d{1,3}(\.\d{3})+,\d{2}$/.test(firstToken.trim())) {
        pushTx(date, description, amounts[0], 'UYU');
        if (amounts[1]) pushTx(date, `${description} (USD)`, amounts[1], 'USD');
      } else {
        // Cobros en dólares (Importe U$S = última columna)
        pushTx(date, description, amounts[amounts.length - 1], 'USD');
      }
    }
  }

  // Cargos del pie (sin fecha): intereses / seguro — hasta SALDO CONTADO
  const feesChunk = body.slice(matches.length ? matches[matches.length - 1].index : 0);
  const feePatterns: Array<{ re: RegExp; name: string }> = [
    { re: /INTERESES COMPENSATORIOS\s*\(IVA INC\)\s+(-?[\d\.]+,\d{2})(?:\s+(-?[\d\.]+,\d{2}))?/i, name: 'INTERESES COMPENSATORIOS (IVA INC)' },
    { re: /INTERESES MORATORIOS\s*\(IVA INC\)\s+(-?[\d\.]+,\d{2})(?:\s+(-?[\d\.]+,\d{2}))?/i, name: 'INTERESES MORATORIOS (IVA INC)' },
    { re: /SEGURO DE VIDA SOBRE SALDO\s+(-?[\d\.]+,\d{2})(?:\s+(-?[\d\.]+,\d{2}))?/i, name: 'SEGURO DE VIDA SOBRE SALDO' },
  ];

  for (const fee of feePatterns) {
    const m = body.match(fee.re) || feesChunk.match(fee.re);
    if (!m) continue;
    const pesos = parseMoneyToken(m[1]);
    const dollars = m[2] ? parseMoneyToken(m[2]) : null;
    if (pesos) pushTx(fallbackDate, fee.name, pesos, 'UYU');
    if (dollars) pushTx(fallbackDate, `${fee.name} (USD)`, dollars, 'USD');
  }

  return transactions;
};

export const parseItauExcel = (data: any[]): ParsedTransaction[] => {
  const transactions: ParsedTransaction[] = [];

  // Formato real de Itaú Excel:
  // Fila 6: Headers (Fecha, Concepto, Débito, Crédito, Saldo, Referencia, Destino)
  // Fila 7+: Datos (puede incluir "SALDO ANTERIOR" que debe ignorarse)
  
  // Buscar la fila de encabezados
  let headerIndex = -1;
  for (let i = 0; i < Math.min(15, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    
    const rowStr = row.join('|').toLowerCase();
    if (rowStr.includes('fecha') && rowStr.includes('concepto') &&
        (rowStr.includes('débito') || rowStr.includes('debito'))) {
      headerIndex = i;
      break;
    }
  }
  
  if (headerIndex === -1) {
    // Fallback: asumir que los headers están en fila 0
    headerIndex = 0;
  }
  
  // Identificar índices de columnas
  const headers = data[headerIndex] || [];
  const fechaIdx = headers.findIndex((h: any) =>
    h && h.toString().toLowerCase().includes('fecha'));
  const conceptoIdx = headers.findIndex((h: any) =>
    h && h.toString().toLowerCase().includes('concepto'));
  const debitoIdx = headers.findIndex((h: any) =>
    h && (h.toString().toLowerCase().includes('débito') || h.toString().toLowerCase().includes('debito')));
  const creditoIdx = headers.findIndex((h: any) =>
    h && (h.toString().toLowerCase().includes('crédito') || h.toString().toLowerCase().includes('credito')));
  const saldoIdx = headers.findIndex((h: any) =>
    h && h.toString().toLowerCase().includes('saldo'));
  
  // Procesar transacciones
  for (let i = headerIndex + 1; i < data.length; i++) {
    const row = data[i];
    
    if (!row || row.length === 0) continue;
    
    // Obtener valores
    const fechaValue = fechaIdx >= 0 ? row[fechaIdx] : row[1];
    const conceptoValue = conceptoIdx >= 0 ? row[conceptoIdx] : row[2];
    const debitoValue = debitoIdx >= 0 ? row[debitoIdx] : row[4];
    const creditoValue = creditoIdx >= 0 ? row[creditoIdx] : row[5];
    const saldoValue = saldoIdx >= 0 ? row[saldoIdx] : row[6];
    
    // Saltar "SALDO ANTERIOR" y filas vacías
    const conceptoStr = String(conceptoValue || '').trim();
    if (!conceptoStr || conceptoStr.toUpperCase().includes('SALDO ANTERIOR')) continue;
    
    // Parsear fecha
    let date: Date;
    if (typeof fechaValue === 'number') {
      // Excel serial date
      date = new Date((fechaValue - 25569) * 86400 * 1000);
    } else if (fechaValue) {
      const fechaStr = String(fechaValue).trim();
      if (fechaStr.includes('/')) {
        const [day, month, year] = fechaStr.split('/').map(Number);
        date = new Date(year, month - 1, day);
      } else {
        continue;
      }
    } else {
      continue;
    }
    
    if (isNaN(date.getTime())) continue;
    
    // Determinar monto y tipo
    let amount = 0;
    let type: TransactionType = 'expense';
    
    if (debitoValue && debitoValue !== '' && debitoValue !== 0) {
      amount = -Math.abs(Number(debitoValue));
      type = 'expense';
    } else if (creditoValue && creditoValue !== '' && creditoValue !== 0) {
      amount = Math.abs(Number(creditoValue));
      type = 'income';
    } else {
      continue;
    }
    
    if (amount === 0) continue;
    
    transactions.push({
      date,
      description: conceptoStr,
      amount,
      currency: 'UYU',
      type
    });
  }
  
  return transactions;
};

// Made with Bob
