/**
 * Servicio de Importación de Extractos Bancarios
 * 
 * Orquesta TODO el flujo de carga de extractos de forma independiente a React.
 * Responsabilidades:
 * - Hash del archivo
 * - Detección de duplicado
 * - Detección de banco
 * - Selección y ejecución de parser
 * - Normalización de transacciones
 * - Categorización automática
 * - Persistencia en Firebase
 * - Recálculo de balances
 * 
 * Este servicio NO depende de React. Puede ser reutilizado por:
 * - Componentes React (actual)
 * - APIs backend
 * - Agentes financieros (futuro)
 */

import { calculateFileHash } from '../parsers/fileHasher';
import { parseByBank, detectBank } from '../parsers/banks';
import { parseCSV } from '../parsers/csvParser';
import { parseExcel } from '../parsers/excelParser';
import { parsePDF } from '../parsers/pdfParser';
import { categorizeTransactions } from '../utils/categorization';
import { isSnapshotBank, SNAPSHOT_STATEMENT_MONTH } from '../utils/snapshotBanks';
import {
  createUploadHistory,
  checkDuplicateUpload,
  getUploadHistory,
  deleteUploadHistoryByFilter,
} from './uploadHistory.service';
import {
  createTransactions,
  parsedToTransaction,
  deleteTransactionsByFilter,
} from './transactions.service';
import { getCategories } from './categories.service';
import { recalculateAccountBalance } from './accounts.service';
import { detectStatementContext } from './contextDetection.service';
import { Account, Category, Currency, ExchangeRates } from '../types';

/**
 * Resultado de la importación de extracto
 * Representa TODO lo que sucedió durante el flujo
 */
export interface StatementImportResult {
  // Estado general
  success: boolean;
  error?: string;

  // Identificación
  fileName: string;
  fileHash: string;
  detectedBank: string | null;
  selectedBank: string; // Bank de la account seleccionada

  // Información de cuenta
  accountId: string;
  accountName: string;
  currency: Currency;

  // Período del extracto
  statementMonth: number;
  statementYear: number;
  snapshotMode: boolean;

  // Procesamiento
  totalParsedTransactions: number;
  transactionsImported: number;
  transactionsCategorized: number;
  transactionsPending: number;

  // Detección
  isDuplicate: boolean;
  uploadId?: string;

  // Advertencias y mensajes
  warnings: string[];

  // Requiere intervención manual
  requiresManualIntervention: boolean;

  // Detalles técnicos (para debugging)
  parserUsed?: string;
  uploadDate?: number;
  
  // NUEVO: Contexto detectado (FASE 02)
  detectedContext?: {
    bank: string | null;
    accountNumber: string | null;
    currency: Currency | null;
    period: { month: number | null; year: number | null };
    confidence: number;
    resolutionStatus: {
      bank: 'RESOLVED' | 'NEEDS_CONFIRMATION' | 'UNRESOLVED';
      account: 'RESOLVED' | 'NEEDS_CONFIRMATION' | 'UNRESOLVED';
      currency: 'RESOLVED' | 'NEEDS_CONFIRMATION' | 'UNRESOLVED';
      period: 'RESOLVED' | 'NEEDS_CONFIRMATION' | 'UNRESOLVED';
    };
    unresolvedFields: string[];
  };
}

/**
 * Entrada de configuración para importar un extracto
 */
export interface StatementImportInput {
  file: File;
  accountId: string;
  account: Account;
  statementMonth: number;
  statementYear: number;
  forceUpload?: boolean;
  exchangeRates?: ExchangeRates;
  overrideDetectedBank?: string;
  userId?: string; // UID del usuario autenticado (para auditoría)
  allAccounts?: Account[]; // NUEVO (FASE 02): Todas las cuentas disponibles para detección
}

/**
 * Orquesta el flujo completo de importación de extractos
 * 
 * Flujo:
 * 1. ✓ Hash del archivo
 * 2. ✓ Detección de duplicado
 * 3. ✓ Detección de banco (si está habilitado)
 * 4. ✓ Selección del parser específico del banco
 * 5. ✓ Parsing del archivo
 * 6. ✓ Normalización de transacciones
 * 7. ✓ Validación de período (si no es snapshot)
 * 8. ✓ Manejo de snapshots (reemplazo de estado)
 * 9. ✓ Creación de registro de historial
 * 10. ✓ Categorización automática
 * 11. ✓ Persistencia en Firebase
 * 12. ✓ Recálculo de balance
 */
export const importStatement = async (
  input: StatementImportInput
): Promise<StatementImportResult> => {
  const result: StatementImportResult = {
    success: false,
    fileName: input.file.name,
    fileHash: '',
    detectedBank: null,
    selectedBank: input.account.bank,
    accountId: input.accountId,
    accountName: input.account.name,
    currency: input.account.currency,
    statementMonth: input.statementMonth,
    statementYear: input.statementYear,
    snapshotMode: false,
    totalParsedTransactions: 0,
    transactionsImported: 0,
    transactionsCategorized: 0,
    transactionsPending: 0,
    isDuplicate: false,
    warnings: [],
    requiresManualIntervention: false,
  };

  try {
    // PASO 0: Detectar contexto automáticamente (NUEVO en FASE 02)
    const detectedContext = await detectStatementContext({
      file: input.file,
      fileName: input.file.name,
      availableAccounts: input.allAccounts || [input.account], // Pasar todas las cuentas o solo la actual
      uploadDate: new Date(),
      currentAccountId: input.accountId, // Indicar la cuenta seleccionada actualmente
    });
    result.detectedContext = {
      bank: detectedContext.bank,
      accountNumber: detectedContext.accountNumber,
      currency: detectedContext.currency,
      period: detectedContext.period,
      confidence: detectedContext.confidence,
      resolutionStatus: detectedContext.resolution,
      unresolvedFields: detectedContext.unresolvedFields,
    };
    
    // Agregar advertencias detectadas
    if (detectedContext.warnings.length > 0) {
      result.warnings.push(...detectedContext.warnings);
    }
    
    console.log('🔍 FASE 02 - Context Detection:', {
      bank: detectedContext.bank,
      period: `${detectedContext.period.month}/${detectedContext.period.year}`,
      confidence: `${(detectedContext.confidence * 100).toFixed(0)}%`,
      resolution: detectedContext.resolution,
    });

    // PASO 1: Calcular hash del archivo
    result.fileHash = await calculateFileHash(input.file);

    // PASO 2: Verificar duplicado (a menos que esté forzado o sea snapshot)
    const snapshotMode = isSnapshotBank(input.account.bank);
    result.snapshotMode = snapshotMode;

    if (!input.forceUpload && !snapshotMode) {
      const isDuplicate = await checkDuplicateUpload(result.fileHash);
      if (isDuplicate) {
        result.isDuplicate = true;
        result.error =
          '⚠️ Este archivo ya fue cargado anteriormente. Si quieres volver a cargarlo, activa la opción "Forzar recarga".';
        result.success = false;
        result.requiresManualIntervention = true;
        return result;
      }
    }

    // PASO 3: Detectar banco automáticamente (si es CSV y no está sobrescrito)
    let bankToUse = input.account.bank;
    if (input.file.name.toLowerCase().endsWith('.csv') && !input.overrideDetectedBank) {
      try {
        const content = await input.file.text();
        const detected = detectBank(content);
        if (detected) {
          result.detectedBank = detected;
          bankToUse = detected;
        }
      } catch (error) {
        console.warn('No se pudo detectar banco automáticamente:', error);
      }
    } else if (input.overrideDetectedBank) {
      bankToUse = input.overrideDetectedBank;
      result.detectedBank = input.overrideDetectedBank;
    }

    // PASO 4-5: Seleccionar parser y parsear el archivo
    let parsedTransactions: any[] = [];
    const fileName = input.file.name.toLowerCase();

    try {
      // Intentar usar parser específico del banco
      parsedTransactions = await parseByBank(
        input.file,
        bankToUse,
        input.account.type,
        input.account.currency,
        input.exchangeRates
      );
      result.parserUsed = `banco-${bankToUse}`;
      console.log(`✅ Parser específico para ${bankToUse} usado con éxito`);
    } catch (error) {
      console.warn(`Parser de ${bankToUse} falló, intentando parser genérico:`, error);

      // Fallback a parsers genéricos (NO RECOMENDADO: suelen leer Saldo como importe)
      if (fileName.endsWith('.csv')) {
        parsedTransactions = await parseCSV(input.file);
        result.parserUsed = 'generico-csv';
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        parsedTransactions = await parseExcel(input.file);
        result.parserUsed = 'generico-excel';
      } else if (fileName.endsWith('.pdf')) {
        parsedTransactions = await parsePDF(input.file);
        result.parserUsed = 'generico-pdf';
      } else {
        throw new Error('Formato de archivo no soportado');
      }

      if (parsedTransactions.length === 0) {
        result.warnings.push(
          '⚠️ El parser específico del banco falló. Se intentó con parsers genéricos pero no se encontraron transacciones.'
        );
        result.requiresManualIntervention = true;
      }
    }

    result.totalParsedTransactions = parsedTransactions.length;

    if (parsedTransactions.length === 0) {
      result.error = 'No se encontraron transacciones en el archivo.';
      return result;
    }

    // PASO 6-7: Validar fechas y preparar snapshot
    if (!snapshotMode) {
      let transactionsOutOfRange = 0;

      parsedTransactions.forEach((pt) => {
        const txDate = new Date(pt.date);
        const txMonth = txDate.getMonth() + 1;
        const txYear = txDate.getFullYear();

        if (txMonth !== input.statementMonth || txYear !== input.statementYear) {
          transactionsOutOfRange++;
        }
      });

      if (transactionsOutOfRange > 0) {
        result.warnings.push(
          `⚠️ ${transactionsOutOfRange} transacción(es) tienen fechas fuera del período seleccionado (${input.statementMonth}/${input.statementYear}). Verifica que sea el extracto correcto.`
        );
      }
    } else {
      // PASO 8: Snapshot mode — reemplazar estado anterior
      await deleteTransactionsByFilter({ accountId: input.accountId });
      await deleteUploadHistoryByFilter({ accountId: input.accountId });
      result.warnings.push(
        'Esta cuenta usa snapshot: se reemplazó el estado anterior con este extracto completo.'
      );
    }

    // PASO 9: Crear registro de historial
    const uploadNow = new Date();
    const uploadId = await createUploadHistory({
      fileName: input.file.name,
      fileHash: result.fileHash,
      uploadedBy: input.userId || 'unknown', // ID del usuario o 'unknown' si no se proporciona
      uploadDate: Date.now(),
      accountId: input.accountId,
      transactionsCount: parsedTransactions.length,
      status: 'processed',
      statementMonth: snapshotMode ? SNAPSHOT_STATEMENT_MONTH : input.statementMonth,
      statementYear: snapshotMode ? uploadNow.getFullYear() : input.statementYear,
      mode: snapshotMode ? 'snapshot' : 'monthly',
    });

    result.uploadId = uploadId;
    result.uploadDate = Date.now();

    // PASO 10: Normalizar transacciones
    const transactions = parsedTransactions.map((pt) =>
      parsedToTransaction(pt, input.accountId, uploadId)
    );

    // PASO 11: Categorizar automáticamente
    const categories = await getCategories();
    const categorizedTransactions = categorizeTransactions(
      transactions,
      categories
    );

    result.transactionsCategorized = categorizedTransactions.filter(
      (t) => t.status === 'classified'
    ).length;
    result.transactionsPending = categorizedTransactions.filter(
      (t) => t.status === 'pending'
    ).length;
    result.transactionsImported = categorizedTransactions.length;

    // PASO 12: Guardar en Firebase
    await createTransactions(
      categorizedTransactions as Parameters<typeof createTransactions>[0]
    );

    // PASO 13: Recalcular balance
    await recalculateAccountBalance(input.accountId);

    result.success = true;
    return result;
  } catch (error: any) {
    result.success = false;
    result.error = error?.message || 'Error desconocido durante la importación';
    result.requiresManualIntervention = true;
    console.error('Error en importación de extracto:', error);
    return result;
  }
};

/**
 * Exporta el historial de importaciones (para auditoría y debugging)
 */
export const getImportHistory = async (): Promise<any[]> => {
  return getUploadHistory();
};
