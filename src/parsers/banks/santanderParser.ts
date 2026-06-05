import { ParsedTransaction, Currency, TransactionType } from '../../types';

/**
 * Parser para extractos de Santander Uruguay
 * Soporta cuentas de débito y tarjetas Visa
 */

export const parseSantanderDebitCSV = (content: string): ParsedTransaction[] => {
  const lines = content.split('\n').filter(line => line.trim());
  const transactions: ParsedTransaction[] = [];

  // Santander formato: Fecha,Descripción,Importe,Saldo
  // Ejemplo: "15-01-2024","COMPRA DEVOTO","-5000.00","45000.00"
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const matches = line.match(/"([^"]+)"|([^,]+)/g);
    
    if (!matches || matches.length < 3) continue;
    
    const fecha = matches[0].replace(/"/g, '').trim();
    const descripcion = matches[1].replace(/"/g, '').trim();
    const importe = matches[2].replace(/"/g, '').trim();
    
    // Parsear fecha (formato DD-MM-YYYY)
    const [day, month, year] = fecha.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    if (isNaN(date.getTime())) continue;
    
    const amount = parseFloat(importe.replace(/\./g, '').replace(',', '.'));
    
    if (amount === 0) continue;
    
    const type: TransactionType = amount > 0 ? 'income' : 'expense';
    
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

export const parseSantanderCreditCSV = (content: string): ParsedTransaction[] => {
  const lines = content.split('\n').filter(line => line.trim());
  const transactions: ParsedTransaction[] = [];

  // Santander Visa formato: Fecha,Comercio,Importe,Moneda
  // Ejemplo: "15-01-2024","DISCO MONTEVIDEO","5000.00","UYU"
  
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
 * Parser específico para extractos de Tarjeta de Crédito Santander (Excel)
 */
const parseSantanderCreditCardExcel = (data: any[]): ParsedTransaction[] => {
  const transactions: ParsedTransaction[] = [];
  
  console.log('💳 Parseando Tarjeta de Crédito Santander');
  
  // Buscar la fila de encabezados (contiene "Fecha", "Tarjeta", "Detalle", "Importe $", "Importe U$S")
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
    console.error('❌ No se encontró la fila de encabezados');
    throw new Error('No se encontró la fila de encabezados en el archivo de tarjeta de crédito');
  }
  
  const headers = data[headerRowIndex];
  console.log('💳 Encabezados:', headers);
  
  // Detectar índices de columnas
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
  
  console.log('💳 Índices de columnas:', { dateIndex, detailIndex, amountPesosIndex, amountUSDIndex });
  
  // Procesar filas de datos
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    
    if (!Array.isArray(row) || row.length === 0) continue;
    
    try {
      const fechaValue = row[dateIndex];
      const detalle = String(row[detailIndex] || '').trim();
      const importePesos = row[amountPesosIndex];
      const importeUSD = row[amountUSDIndex];
      
      // Saltar filas sin fecha o con descripciones especiales
      if (!fechaValue || !detalle || 
          detalle.toLowerCase().includes('saldo anterior') ||
          detalle.toLowerCase().includes('saldo final')) {
        continue;
      }
      
      // Parsear fecha (formato DD/MM/YYYY)
      let date: Date;
      if (typeof fechaValue === 'number') {
        // Serial de fecha de Excel
        date = new Date((fechaValue - 25569) * 86400 * 1000);
      } else {
        const dateStr = String(fechaValue).trim();
        const [day, month, year] = dateStr.split('/');
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      
      if (isNaN(date.getTime())) {
        console.warn('⚠️ Fecha inválida en fila', i, ':', fechaValue);
        continue;
      }
      
      // Procesar monto en pesos
      if (importePesos && String(importePesos).trim() !== '' && String(importePesos).trim() !== '0,00') {
        const amountStr = String(importePesos).replace(/\$/g, '').replace(/\s/g, '').trim();
        const amount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
        
        if (!isNaN(amount) && amount !== 0) {
          // Los pagos son negativos (ingresos), las compras son positivas (gastos)
          const isPayment = amount < 0;
          
          transactions.push({
            date,
            description: detalle,
            amount: Math.abs(amount),
            currency: 'UYU',
            type: isPayment ? 'income' : 'expense'
          });
        }
      }
      
      // Procesar monto en dólares
      if (importeUSD && String(importeUSD).trim() !== '' && String(importeUSD).trim() !== '0,00') {
        const amountStr = String(importeUSD).replace(/\$/g, '').replace(/\s/g, '').trim();
        const amount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
        
        if (!isNaN(amount) && amount !== 0) {
          // Los pagos son negativos (ingresos), las compras son positivas (gastos)
          const isPayment = amount < 0;
          
          transactions.push({
            date,
            description: detalle,
            amount: Math.abs(amount),
            currency: 'USD',
            type: isPayment ? 'income' : 'expense'
          });
        }
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

  // Detectar tipo de archivo (débito o crédito)
  let isCreditCard = false;
  for (let i = 0; i < Math.min(data.length, 25); i++) {
    const row = data[i];
    if (Array.isArray(row)) {
      const rowStr = row.join('|').toLowerCase();
      if (rowStr.includes('tarjeta') || rowStr.includes('limite de credito') || rowStr.includes('detalle')) {
        isCreditCard = true;
        console.log('💳 Detectado: Archivo de Tarjeta de Crédito');
        break;
      }
    }
  }

  if (isCreditCard) {
    return parseSantanderCreditCardExcel(data);
  }

  // Buscar la fila de encabezados para cuenta débito (contiene "Fecha", "Débito", "Crédito", "Saldo")
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const row = data[i];
    if (Array.isArray(row)) {
      const rowStr = row.join('|').toLowerCase();
      if (rowStr.includes('fecha') && rowStr.includes('debito') && rowStr.includes('credito')) {
        headerRowIndex = i;
        console.log('🏦 Fila de encabezados encontrada en índice:', i);
        break;
      }
    }
  }
  
  if (headerRowIndex === -1) {
    console.error('❌ No se encontró la fila de encabezados');
    throw new Error('No se encontró la fila de encabezados en el archivo de Santander');
  }
  
  const headers = data[headerRowIndex];
  console.log('🏦 Encabezados:', headers);
  
  // Detectar índices de columnas
  const dateIndex = headers.findIndex((h: any) =>
    String(h).toLowerCase().includes('fecha')
  );
  const descIndex = headers.findIndex((h: any) =>
    String(h).toLowerCase().includes('descripcion') ||
    String(h).toLowerCase().includes('tipo movimiento')
  );
  const debitIndex = headers.findIndex((h: any) =>
    String(h).toLowerCase().includes('debito')
  );
  const creditIndex = headers.findIndex((h: any) =>
    String(h).toLowerCase().includes('credito')
  );
  
  console.log('🏦 Índices de columnas:', { dateIndex, descIndex, debitIndex, creditIndex });
  
  // Procesar filas de datos (después del encabezado)
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    
    if (!Array.isArray(row) || row.length === 0) continue;
    
    try {
      const fechaValue = row[dateIndex];
      const descripcion = String(row[descIndex] || '').trim();
      const debito = row[debitIndex];
      const credito = row[creditIndex];
      
      // Saltar filas sin fecha o con descripción vacía
      if (!fechaValue || !descripcion || descripcion === 'Saldo inicial') continue;
      
      // Parsear fecha (formato DD/MM/YYYY)
      let date: Date;
      if (typeof fechaValue === 'number') {
        // Serial de fecha de Excel
        date = new Date((fechaValue - 25569) * 86400 * 1000);
      } else {
        const dateStr = String(fechaValue).trim();
        const [day, month, year] = dateStr.split('/');
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      
      if (isNaN(date.getTime())) {
        console.warn('⚠️ Fecha inválida en fila', i, ':', fechaValue);
        continue;
      }
      
      // Determinar monto y tipo
      let amount = 0;
      let type: TransactionType = 'expense';
      
      if (debito && Number(debito) !== 0) {
        // Es un débito (gasto)
        amount = -Math.abs(Number(debito));
        type = 'expense';
      } else if (credito && Number(credito) !== 0) {
        // Es un crédito (ingreso)
        amount = Math.abs(Number(credito));
        type = 'income';
      } else {
        // Sin monto, saltar
        continue;
      }
      
      transactions.push({
        date,
        description: descripcion,
        amount: Math.abs(amount),
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

// Made with Bob
