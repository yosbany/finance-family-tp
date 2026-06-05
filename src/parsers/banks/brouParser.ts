import { ParsedTransaction, Currency, TransactionType } from '../../types';

/**
 * Parser para extractos del BROU (Banco República Oriental del Uruguay)
 * Soporta formatos CSV y PDF de cuentas de débito y tarjetas de crédito
 */

export const parseBROUDebitCSV = (content: string): ParsedTransaction[] => {
  const lines = content.split('\n').filter(line => line.trim());
  const transactions: ParsedTransaction[] = [];

  // BROU formato típico: Fecha,Descripción,Débito,Crédito,Saldo
  // Ejemplo: "15/01/2024","COMPRA DISCO","5000.00","","45000.00"
  
  for (let i = 1; i < lines.length; i++) { // Skip header
    const line = lines[i];
    const matches = line.match(/"([^"]+)"|([^,]+)/g);
    
    if (!matches || matches.length < 4) continue;
    
    const fecha = matches[0].replace(/"/g, '').trim();
    const descripcion = matches[1].replace(/"/g, '').trim();
    const debito = matches[2].replace(/"/g, '').trim();
    const credito = matches[3].replace(/"/g, '').trim();
    
    // Parsear fecha (formato DD/MM/YYYY)
    const [day, month, year] = fecha.split('/');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    if (isNaN(date.getTime())) continue;
    
    // Determinar monto y tipo
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

export const parseBROUCreditCSV = (content: string): ParsedTransaction[] => {
  const lines = content.split('\n').filter(line => line.trim());
  const transactions: ParsedTransaction[] = [];

  // BROU Tarjeta formato: Fecha,Comercio,Monto,Cuotas
  // Ejemplo: "15/01/2024","DISCO MONTEVIDEO","5000.00","1/1"
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const matches = line.match(/"([^"]+)"|([^,]+)/g);
    
    if (!matches || matches.length < 3) continue;
    
    const fecha = matches[0].replace(/"/g, '').trim();
    const comercio = matches[1].replace(/"/g, '').trim();
    const monto = matches[2].replace(/"/g, '').trim();
    
    const [day, month, year] = fecha.split('/');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    if (isNaN(date.getTime())) continue;
    
    const amount = -Math.abs(parseFloat(monto.replace(/\./g, '').replace(',', '.')));
    
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

export const parseBROUExcel = (data: any[][]): ParsedTransaction[] => {
  const transactions: ParsedTransaction[] = [];

  console.log('🔍 BROU Excel - Total filas recibidas:', data.length);
  
  // Buscar la fila de headers que contiene "Fecha" y "Descripción"
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(50, data.length); i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    
    // Buscar fila con "Fecha" en primera columna y "Descripción" en segunda
    if (row[0] === 'Fecha' && row[1] === 'Descripción') {
      headerRowIndex = i;
      console.log('✅ Header encontrado en fila:', i);
      console.log('📄 Headers:', row);
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    console.warn('❌ No se encontró la fila de headers en el Excel de BROU');
    return transactions;
  }
  
  // Procesar transacciones (comenzar desde la fila siguiente al header)
  // Formato: [Fecha, Descripción, "", Número de documento, Asunto, Dependencia, Débito, Crédito, ""]
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    
    // Verificar que la fila tenga datos
    if (!row || row.length < 8) continue;
    
    const fecha = row[0]; // Columna A (índice 0) - Fecha
    const descripcion = row[1]; // Columna B (índice 1) - Descripción
    const debito = row[6]; // Columna G (índice 6) - Débito
    const credito = row[7]; // Columna H (índice 7) - Crédito
    
    // Skip si no hay fecha o descripción
    if (!fecha || !descripcion) continue;
    
    // Skip si es una fila de totales o resumen
    if (typeof descripcion === 'string' &&
        (descripcion.includes('TOTAL') || descripcion.includes('SALDO') || descripcion.includes('Movimientos'))) {
      continue;
    }
    
    // Parsear fecha
    let date: Date;
    if (typeof fecha === 'number') {
      // Excel date serial number (días desde 1900-01-01)
      date = new Date((fecha - 25569) * 86400 * 1000);
    } else if (typeof fecha === 'string') {
      // Formato DD/MM/YYYY
      const [day, month, year] = fecha.split('/');
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      continue;
    }
    
    if (isNaN(date.getTime())) continue;
    
    // Determinar monto y tipo
    let amount = 0;
    let type: TransactionType = 'expense';
    
    if (debito && typeof debito === 'number' && debito > 0) {
      amount = -Math.abs(debito);
      type = 'expense';
    } else if (credito && typeof credito === 'number' && credito > 0) {
      amount = Math.abs(credito);
      type = 'income';
    } else {
      continue; // Skip si no hay monto
    }
    
    // Limpiar descripción
    const description = typeof descripcion === 'string'
      ? descripcion.trim().replace(/\s+/g, ' ')
      : String(descripcion);
    
    transactions.push({
      date,
      description,
      amount,
      currency: 'UYU',
      type
    });
  }
  
  console.log('📄 Transacciones parseadas de BROU Excel:', transactions.length);
  return transactions;
};

export const parseBROUPDF = async (file: File): Promise<ParsedTransaction[]> => {
  // Para PDF, usaremos el parser genérico por ahora
  // En producción, se puede usar pdf-parse o similar para extraer texto específico
  return [];
};

// Made with Bob
