import { ParsedTransaction, Currency, TransactionType } from '../../types';

/**
 * Parser para extractos de Prex Uruguay
 * Soporta cuentas en pesos y dólares
 */

export const parsePrexCSV = (content: string, currency: Currency = 'UYU'): ParsedTransaction[] => {
  const lines = content.split('\n').filter(line => line.trim());
  const transactions: ParsedTransaction[] = [];

  // Prex formato: Fecha,Descripción,Monto,Tipo,Saldo
  // Ejemplo: "15/01/2024","COMPRA DISCO","-5000.00","COMPRA","45000.00"
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const matches = line.match(/"([^"]+)"|([^,]+)/g);
    
    if (!matches || matches.length < 3) continue;
    
    const fecha = matches[0].replace(/"/g, '').trim();
    const descripcion = matches[1].replace(/"/g, '').trim();
    const monto = matches[2].replace(/"/g, '').trim();
    
    // Parsear fecha (formato DD/MM/YYYY)
    const [day, month, year] = fecha.split('/');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    if (isNaN(date.getTime())) continue;
    
    const amount = parseFloat(monto.replace(/\./g, '').replace(',', '.'));
    
    if (amount === 0) continue;
    
    const type: TransactionType = amount > 0 ? 'income' : 'expense';
    
    transactions.push({
      date,
      description: descripcion,
      amount,
      currency,
      type
    });
  }
  
  return transactions;
};

export const parsePrexExcel = (data: any[], currency: Currency = 'UYU'): ParsedTransaction[] => {
  const transactions: ParsedTransaction[] = [];

  // Prex Excel: Fecha | Descripción | Monto | Tipo | Saldo
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    if (!row || row.length < 3) continue;
    
    const fechaValue = row[0];
    const descripcion = String(row[1] || '').trim();
    const monto = row[2];
    
    let date: Date;
    if (typeof fechaValue === 'number') {
      date = new Date((fechaValue - 25569) * 86400 * 1000);
    } else {
      const [day, month, year] = String(fechaValue).split('/');
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    if (isNaN(date.getTime())) continue;
    
    const amount = Number(monto);
    
    if (amount === 0) continue;
    
    const type: TransactionType = amount > 0 ? 'income' : 'expense';
    
    transactions.push({
      date,
      description: descripcion,
      amount,
      currency,
      type
    });
  }
  
  return transactions;
};

// Made with Bob
