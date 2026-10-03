# 🏦 Parsers de Bancos Uruguayos

Este documento describe los parsers específicos implementados para cada banco uruguayo soportado por la aplicación.

## 📋 Tabla de Contenidos

- [Visión General](#visión-general)
- [Bancos Soportados](#bancos-soportados)
- [Formatos de Archivo](#formatos-de-archivo)
- [Uso](#uso)
- [Ejemplos de Formato](#ejemplos-de-formato)

## Visión General

La aplicación incluye parsers específicos para cada banco uruguayo, diseñados para extraer transacciones de los estados de cuenta en sus formatos nativos. Esto mejora significativamente la precisión del procesamiento comparado con parsers genéricos.

### Características

- ✅ **Detección automática** del banco basada en el contenido del archivo
- ✅ **Parsers específicos** para cada banco con sus formatos únicos
- ✅ **Fallback inteligente** a parsers genéricos si falla el específico
- ✅ **Soporte multi-moneda** (UYU y USD)
- ✅ **Manejo de débito y crédito** con lógica específica por banco

## Bancos Soportados

### 1. BROU (Banco República Oriental del Uruguay)

**Tipos de cuenta:** Débito, Crédito  
**Formatos:** CSV, Excel  
**Monedas:** UYU, USD

#### Formato CSV Débito
```csv
Fecha,Descripción,Débito,Crédito,Saldo
01/01/2024,Compra Supermercado,1500.00,,48500.00
02/01/2024,Depósito,,5000.00,53500.00
```

#### Formato CSV Crédito
```csv
Fecha,Descripción,Importe,Tipo
01/01/2024,Compra Online,2500.00,Compra
05/01/2024,Pago Tarjeta,10000.00,Pago
```

### 2. Itaú

**Tipos de cuenta:** Débito, Crédito  
**Formatos:** CSV (separador: punto y coma), Excel  
**Monedas:** UYU, USD

#### Formato CSV Débito
```csv
Fecha;Descripción;Débito;Crédito;Saldo
01-01-2024;Transferencia;2000,00;;45000,00
02-01-2024;Depósito;;3000,00;48000,00
```

#### Formato CSV Crédito
```csv
Fecha;Descripción;Importe;Tipo
01-01-2024;Compra Tienda;1500,00;Compra
10-01-2024;Pago;5000,00;Pago
```

### 3. Santander

**Tipos de cuenta:** Débito, Crédito  
**Formatos:** CSV, Excel  
**Monedas:** UYU, USD

#### Formato CSV Débito
```csv
Fecha,Descripción,Débito,Crédito,Saldo
01-01-2024,Extracción Cajero,1000.00,,35000.00
05-01-2024,Acreditación Sueldo,,50000.00,85000.00
```

#### Formato CSV Crédito
```csv
Fecha,Descripción,Monto,Tipo
01-01-2024,Compra Restaurant,3500.00,Compra
15-01-2024,Pago Mínimo,2000.00,Pago
```

### 4. OCA (Visa y MasterCard)

**Tipos de cuenta:** Crédito (Visa, Master)  
**Formatos:** CSV, Excel, PDF  
**Monedas:** UYU, USD

#### Formato CSV
```csv
Fecha,Comercio,Importe,Cuotas
01/01/2024,Tienda ABC,5000.00,1
05/01/2024,Supermercado XYZ,2500.00,3
```

#### Formato Excel
Similar al CSV pero con columnas adicionales:
- Fecha de Vencimiento
- Número de Tarjeta (últimos 4 dígitos)
- Categoría

### 5. Prex

**Tipos de cuenta:** Débito (Prepaga)  
**Formatos:** CSV, Excel  
**Monedas:** UYU, USD (requiere especificar)

#### Formato CSV
```csv
Fecha,Descripción,Monto,Tipo,Moneda
01/01/2024,Carga Prex,5000.00,Carga,UYU
02/01/2024,Compra Online,1500.00,Compra,UYU
```

**Nota:** Prex requiere especificar la moneda al cargar el archivo.

### 6. BHU (Banco Hipotecario del Uruguay)

**Tipos de cuenta:** Ahorro, Préstamos  
**Formatos:** CSV, Excel  
**Monedas:** UYU, USD

#### Formato CSV Ahorro
```csv
Fecha,Concepto,Débito,Crédito,Saldo
01/01/2024,Depósito,,10000.00,50000.00
15/01/2024,Extracción,5000.00,,45000.00
```

#### Formato CSV Préstamos
```csv
Fecha,Concepto,Cuota,Capital,Interés,Saldo
01/01/2024,Cuota Mensual,15000.00,12000.00,3000.00,500000.00
```

## Formatos de Archivo

### CSV (Comma-Separated Values)
- Separador: coma (`,`) o punto y coma (`;`) según el banco
- Codificación: UTF-8
- Primera línea: encabezados de columna

### Excel (.xlsx, .xls)
- Formato estándar de Microsoft Excel
- Primera fila: encabezados
- Datos a partir de la segunda fila

### PDF
- Solo para OCA (extracción de texto)
- Requiere formato estructurado
- Limitaciones en la precisión de extracción

## Uso

### Detección Automática

El sistema detecta automáticamente el banco basándose en:
1. Nombre del archivo
2. Estructura de columnas
3. Formato de fechas
4. Palabras clave en el contenido

```typescript
import { detectBank, parseByBank } from './parsers/banks';

// Detectar banco
const content = await file.text();
const bank = detectBank(content);
console.log(`Banco detectado: ${bank}`); // "brou", "itau", etc.

// Parsear con parser específico
const transactions = await parseByBank(file, bank, 'debit', 'UYU');
```

### Uso Manual

```typescript
import { getBankParser } from './parsers/banks';

// Obtener parser específico
const parser = getBankParser({
  bank: 'brou',
  accountType: 'debit',
  fileType: 'csv',
  currency: 'UYU'
});

// Usar el parser
const content = await file.text();
const transactions = parser(content);
```

### Información del Parser

```typescript
import { getParserInfo } from './parsers/banks';

const info = getParserInfo('brou', 'debit');
console.log(info);
// {
//   bank: 'BROU',
//   accountType: 'Débito',
//   supportedFormats: ['csv', 'excel'],
//   dateFormat: 'DD/MM/YYYY',
//   separator: ',',
//   encoding: 'UTF-8'
// }
```

## Ejemplos de Formato

### Estructura de Transacción Parseada

Todos los parsers devuelven transacciones en el siguiente formato:

```typescript
interface ParsedTransaction {
  date: string;           // Formato ISO: "2024-01-01"
  description: string;    // Descripción de la transacción
  amount: number;         // Monto (positivo para ingresos, negativo para gastos)
  type: 'income' | 'expense';
  balance?: number;       // Saldo después de la transacción (opcional)
  category?: string;      // Categoría sugerida (opcional)
  metadata?: {            // Información adicional
    originalDate?: string;
    merchant?: string;
    installments?: number;
    [key: string]: any;
  };
}
```

### Ejemplo Completo

```typescript
// Archivo: brou-extracto-enero-2024.csv
const file = new File([csvContent], 'brou-extracto-enero-2024.csv');

// Detección automática
const bank = detectBank(await file.text()); // "brou"

// Parseo
const transactions = await parseByBank(file, bank, 'debit', 'UYU');

// Resultado
console.log(transactions);
// [
//   {
//     date: "2024-01-01",
//     description: "Compra Supermercado",
//     amount: -1500.00,
//     type: "expense",
//     balance: 48500.00,
//     metadata: { originalDate: "01/01/2024" }
//   },
//   {
//     date: "2024-01-02",
//     description: "Depósito",
//     amount: 5000.00,
//     type: "income",
//     balance: 53500.00,
//     metadata: { originalDate: "02/01/2024" }
//   }
// ]
```

## Notas Importantes

1. **Privacidad**: Los archivos NO se almacenan en el servidor, solo se procesan en memoria
2. **Duplicados**: Se usa SHA-256 para detectar archivos ya cargados
3. **Fallback**: Si el parser específico falla, se usa el parser genérico automáticamente
4. **Monedas**: Prex requiere especificar la moneda manualmente
5. **Fechas**: Todos los parsers normalizan las fechas al formato ISO (YYYY-MM-DD)
6. **Montos**: Los montos se normalizan a números con 2 decimales

## Contribuir

Para agregar soporte para un nuevo banco:

1. Crear archivo en `src/parsers/banks/nombreBanco.ts`
2. Implementar funciones de parseo para cada tipo de cuenta
3. Agregar detección en `src/parsers/banks/index.ts`
4. Actualizar esta documentación
5. Agregar tests unitarios

---

**Última actualización:** Junio 2024  
**Versión:** 1.0.0