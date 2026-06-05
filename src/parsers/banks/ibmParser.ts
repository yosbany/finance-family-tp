import { ParsedTransaction, Currency } from '../../types';

/**
 * Parser para archivos de IBM Employee Stock Purchase Plan
 * Formato: Excel (.xlsx) con detalles de cartera
 */

/**
 * Parser para Excel de IBM - Portfolio Details
 */
export const parseIBMExcel = (data: any[]): ParsedTransaction[] => {
  console.log('🔵 Iniciando parser de IBM Portfolio');
  console.log('🔵 Total de filas recibidas:', data.length);
  
  const transactions: ParsedTransaction[] = [];
  
  // Buscar la fila de encabezados (contiene "Fecha de asignación")
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const row = data[i];
    if (Array.isArray(row) && row.some(cell => 
      String(cell).toLowerCase().includes('fecha de asignación') ||
      String(cell).toLowerCase().includes('fecha de asignacion')
    )) {
      headerRowIndex = i;
      console.log('🔵 Fila de encabezados encontrada en índice:', i);
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    console.error('❌ No se encontró la fila de encabezados');
    throw new Error('No se encontró la fila de encabezados en el archivo de IBM');
  }
  
  const headers = data[headerRowIndex].map((h: any) => String(h).toLowerCase().trim());
  console.log('🔵 Encabezados detectados:', headers);
  
  // Detectar índices de columnas importantes
  const dateIndex = headers.findIndex((h: string) =>
    h.includes('fecha de asignación') || h.includes('fecha de asignacion')
  );
  const instrumentIndex = headers.findIndex((h: string) => h.includes('instrumento'));
  const typeIndex = headers.findIndex((h: string) => h.includes('tipo de contribución') || h.includes('tipo de contribucion'));
  const quantityIndex = headers.findIndex((h: string) => h.includes('cantidad asignada'));
  const remainingIndex = headers.findIndex((h: string) => h.includes('cantidad restante'));
  const availableIndex = headers.findIndex((h: string) => h.includes('cantidad disponible'));
  const costBasisIndex = headers.findIndex((h: string) =>
    h.includes('precio de ejercicio') || h.includes('base de costes')
  );
  const marketPriceIndex = headers.findIndex((h: string) => h.includes('precio de mercado'));
  const currentValueIndex = headers.findIndex((h: string) =>
    h.includes('valor pendiente actual') || h.includes('valor actual disponible')
  );
  
  console.log('🔵 Índices de columnas:', {
    dateIndex,
    instrumentIndex,
    typeIndex,
    quantityIndex,
    remainingIndex,
    availableIndex,
    costBasisIndex,
    marketPriceIndex,
    currentValueIndex
  });
  
  // Procesar filas de datos (después del encabezado)
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    
    if (!Array.isArray(row) || row.length === 0) {
      continue;
    }
    
    try {
      const dateValue = row[dateIndex];
      const instrument = row[instrumentIndex];
      const contributionType = row[typeIndex];
      const quantity = parseFloat(String(row[quantityIndex] || 0).replace(',', '.'));
      const remaining = parseFloat(String(row[remainingIndex] || 0).replace(',', '.'));
      const available = parseFloat(String(row[availableIndex] || 0).replace(',', '.'));
      const costBasis = parseFloat(String(row[costBasisIndex] || 0).replace(',', '.'));
      const marketPrice = parseFloat(String(row[marketPriceIndex] || 0).replace(',', '.'));
      const currentValue = parseFloat(String(row[currentValueIndex] || 0).replace(',', '.'));
      
      // Validar que tengamos datos mínimos
      if (!dateValue || !instrument || quantity === 0) {
        continue;
      }
      
      const date = parseIBMDate(dateValue);
      
      // Determinar el tipo de transacción
      let type: 'income' | 'expense' = 'income';
      let description = '';
      let amount = 0;
      
      const contributionTypeStr = String(contributionType).toLowerCase();
      
      if (contributionTypeStr.includes('compra') || contributionTypeStr.includes('purchase')) {
        // Es una compra de acciones
        type = 'expense';
        amount = quantity * costBasis;
        description = `IBM ESPP - Compra de ${quantity.toFixed(3)} acciones a $${costBasis.toFixed(2)}`;
      } else if (contributionTypeStr.includes('dividend')) {
        // Es un dividendo (acciones recibidas como dividendo)
        type = 'income';
        amount = currentValue;
        description = `IBM ESPP - Dividendo: ${quantity.toFixed(3)} acciones (valor: $${currentValue.toFixed(2)})`;
      }
      
      // Agregar información adicional si hay acciones disponibles
      if (available > 0) {
        description += ` | Disponibles: ${available.toFixed(3)} acciones`;
      }
      
      transactions.push({
        date,
        description,
        amount: Math.abs(amount),
        currency: 'USD' as Currency, // IBM cotiza en USD
        type
      });
      
    } catch (error) {
      console.warn('⚠️ Error al procesar fila IBM:', i, error);
      continue;
    }
  }
  
  console.log('🔵 Total de transacciones parseadas:', transactions.length);
  return transactions;
};

/**
 * Parsea fechas de IBM (formato: YYYY-MM-DD o serial de Excel)
 */
const parseIBMDate = (dateValue: any): Date => {
  // Si es un número, es un serial de fecha de Excel
  if (typeof dateValue === 'number') {
    const excelEpoch = new Date(1900, 0, 1);
    const days = dateValue - 2; // Ajuste por bug de Excel con 1900
    return new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
  }
  
  // Si es string, intentar parsear
  const dateStr = String(dateValue).trim();
  
  // Formato YYYY-MM-DD
  const match = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }
  
  // Intentar parseo directo
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Formato de fecha no reconocido: ${dateStr}`);
  }
  return date;
};

// Made with Bob