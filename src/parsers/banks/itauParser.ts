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

  console.log('📄 Contenido PDF (primeros 1000 chars):', content.substring(0, 1000));

  // El PDF viene todo en una línea, necesitamos dividirlo por patrones de fecha
  // Patrón: DD MM AA seguido de código o palabra clave
  // Dividir el contenido usando el patrón de fecha como delimitador
  const datePattern = /(\d{2}\s+\d{2}\s+\d{2}\s+(?:PAGOS|\d{4}))/g;
  
  // Encontrar todas las coincidencias con sus posiciones
  const matches: Array<{index: number, text: string}> = [];
  let match;
  while ((match = datePattern.exec(content)) !== null) {
    matches.push({
      index: match.index,
      text: match[0]
    });
  }
  
  console.log('📄 Transacciones encontradas:', matches.length);
  
  // Crear líneas individuales para cada transacción
  const lines: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i < matches.length - 1 ? matches[i + 1].index : content.length;
    const line = content.substring(start, end).trim();
    if (line) {
      lines.push(line);
    }
  }
  
  console.log('📄 Líneas procesadas:', lines.length);
  console.log('📄 Primeras 3 líneas:', lines.slice(0, 3));
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Patrón 1: Transacciones con código de 4 dígitos
    // Ejemplo: "           18 04 26  5029    OPENAI                                                       5,02                        5,02"
    // Ejemplo: "           14 02 26  5029    JOYERIA REVELLO                     3/ 6                                3001,65"
    const match1 = line.match(/(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{4})\s+(.+?)\s+([\d,\.]+)\s*$/);
    
    if (i < 30 && line.includes('26') && line.includes('5029')) {
      console.log(`🔍 Línea ${i}:`, line);
      console.log('   Match1:', match1 ? 'SÍ' : 'NO');
    }
    
    if (match1) {
      console.log('✅ Match1 encontrado:', match1[0]);
      const [, day, month, year, code, rest, lastAmount] = match1;
      
      // Construir fecha
      const fullYear = 2000 + parseInt(year);
      const date = new Date(fullYear, parseInt(month) - 1, parseInt(day));
      if (isNaN(date.getTime())) continue;
      
      // Extraer descripción y cuotas
      const restParts = rest.trim().split(/\s{2,}/); // Dividir por 2 o más espacios
      let description = restParts[0] || '';
      let cuotas = '';
      
      // Buscar patrón de cuotas (N/M)
      for (const part of restParts) {
        if (/^\d+\/\s*\d+$/.test(part.trim())) {
          cuotas = part.trim();
          break;
        }
      }
      
      if (cuotas) {
        description += ` (${cuotas})`;
      }
      
      // Parsear monto
      const cleanAmount = lastAmount.replace(/\./g, '').replace(',', '.');
      const amountValue = parseFloat(cleanAmount);
      
      if (isNaN(amountValue) || amountValue === 0) continue;
      
      transactions.push({
        date,
        description: description.trim(),
        amount: -Math.abs(amountValue),
        currency: 'UYU',
        type: 'expense'
      });
      continue;
    }
    
    // Patrón 2: PAGOS
    // Ejemplo: "           14 04 26   PAGOS                                                                                        -172,36"
    const match2 = line.match(/(\d{2})\s+(\d{2})\s+(\d{2})\s+PAGOS\s+(-?[\d,\.]+)/);
    
    if (line.includes('PAGOS')) {
      console.log('💰 Línea con PAGOS:', line);
      console.log('   Match2:', match2 ? 'SÍ' : 'NO');
    }
    
    if (match2) {
      console.log('✅ Match2 (PAGO) encontrado:', match2[0]);
      const [, day, month, year, amount] = match2;
      
      const fullYear = 2000 + parseInt(year);
      const date = new Date(fullYear, parseInt(month) - 1, parseInt(day));
      if (isNaN(date.getTime())) continue;
      
      const cleanAmount = amount.replace(/\./g, '').replace(',', '.').replace('-', '');
      const amountValue = parseFloat(cleanAmount);
      
      if (isNaN(amountValue) || amountValue === 0) continue;
      
      transactions.push({
        date,
        description: 'PAGO TARJETA DE CRÉDITO',
        amount: Math.abs(amountValue),
        currency: 'UYU',
        type: 'income'
      });
      continue;
    }
    
    // Patrón 3: AJUSTES y otros cargos especiales
    // Ejemplo: "           25 04 26  5003    AJUSTE SEGURO SOBRE SDO                                                  -24,40"
    const match3 = line.match(/(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{4})\s+(.+?)\s+(-?[\d,\.]+)\s*$/);
    if (match3) {
      const [, day, month, year, code, description, amount] = match3;
      
      const fullYear = 2000 + parseInt(year);
      const date = new Date(fullYear, parseInt(month) - 1, parseInt(day));
      if (isNaN(date.getTime())) continue;
      
      const cleanDesc = description.trim().replace(/\s+/g, ' ');
      const isNegative = amount.startsWith('-');
      const cleanAmount = amount.replace(/\./g, '').replace(',', '.').replace('-', '');
      const amountValue = parseFloat(cleanAmount);
      
      if (isNaN(amountValue) || amountValue === 0) continue;
      
      // Ajustes negativos son créditos a favor
      let type: TransactionType = 'expense';
      let finalAmount = -Math.abs(amountValue);
      
      if (isNegative && cleanDesc.toUpperCase().includes('AJUSTE')) {
        type = 'income';
        finalAmount = Math.abs(amountValue);
      }
      
      transactions.push({
        date,
        description: cleanDesc,
        amount: finalAmount,
        currency: 'UYU',
        type
      });
    }
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
