/**
 * Servicio de Carga Masiva de Extractos (FASE 03)
 * 
 * Responsabilidades:
 * - Orquestar análisis de múltiples archivos sin persistir
 * - Detectar duplicados previo a importación
 * - Ejecutar importaciones solo cuando hay contexto suficiente
 * - Manejar excepciones y reintentosmanual
 */

import { calculateFileHash } from '../parsers/fileHasher';
import { checkDuplicateUpload } from './uploadHistory.service';
import { detectStatementContext } from './contextDetection.service';
import { importStatement, StatementImportResult } from './importStatements.service';
import { Account } from '../types';
import {
  BatchFileInfo,
  BatchImportState,
  BatchImportResult,
  FileProcessingState,
  FileConfirmation,
  ConfirmableField,
} from '../types/batchImport';

/**
 * Generar ID único simple
 */
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Crear un registro de archivo inicial
 */
export const createBatchFileInfo = (file: File): BatchFileInfo => {
  return {
    id: generateId(),
    file,
    fileName: file.name,
    fileSize: file.size,
    state: 'PENDING',
    createdAt: Date.now(),
  };
};

/**
 * Crear estado inicial de carga masiva
 */
export const createInitialBatchState = (): BatchImportState => {
  return {
    isActive: true,
    startedAt: Date.now(),
    files: [],
    stats: {
      total: 0,
      analyzed: 0,
      ready: 0,
      needsConfirmation: 0,
      duplicates: 0,
      unsupported: 0,
      importing: 0,
      imported: 0,
      failed: 0,
    },
    globalErrors: [],
  };
};

/**
 * ETAPA 1: ANALYZE
 * 
 * Analiza un archivo sin persistir datos
 * - Detecta banco, período, moneda, cuenta
 * - Detecta duplicados
 * - Valida parser
 * - Determina estado
 */
export const analyzeFileForBatch = async (
  fileInfo: BatchFileInfo,
  availableAccounts: Account[],
  userId?: string
): Promise<BatchFileInfo> => {
  const updated = { ...fileInfo };
  updated.state = 'ANALYZING';

  try {
    // 1. Detectar contexto
    const detectedContext = await detectStatementContext({
      file: fileInfo.file,
      fileName: fileInfo.fileName,
      availableAccounts,
      uploadDate: new Date(),
    });

    updated.detectedContext = detectedContext;
    updated.analyzedAt = Date.now();

    // 2. Verificar duplicados
    const fileHash = await calculateFileHash(fileInfo.file);
    const isDuplicate = await checkDuplicateUpload(fileHash);

    if (isDuplicate) {
      updated.state = 'DUPLICATE';
      updated.error = 'Este archivo ya fue cargado anteriormente.';
      return updated;
    }

    // 3. Determinar estado basado en resolución
    const unresolvedCriticalFields = detectedContext.unresolvedFields.filter(
      (f) => !f.includes('NEEDS_CONFIRMATION')
    );

    if (unresolvedCriticalFields.length === 0) {
      // Todos los campos están RESOLVED o NEEDS_CONFIRMATION
      const needsConfirmationFields = Object.entries(detectedContext.resolution)
        .filter(([_, status]) => status === 'NEEDS_CONFIRMATION')
        .map(([field]) => field);

      if (needsConfirmationFields.length === 0) {
        // Todo RESOLVED
        updated.state = 'READY';
      } else {
        // Algo necesita confirmación
        updated.state = 'NEEDS_CONFIRMATION';
      }
    } else {
      // Campos sin resolver
      updated.state = 'NEEDS_CONFIRMATION';
    }

    return updated;
  } catch (error: any) {
    updated.state = 'FAILED';
    updated.error = error?.message || 'Error al analizar el archivo';
    return updated;
  }
};

/**
 * ETAPA 2: IMPORT
 * 
 * Importa un archivo (solo si está READY o CONFIRMED)
 */
export const importBatchFile = async (
  fileInfo: BatchFileInfo,
  accountId: string,
  account: Account,
  allAccounts: Account[],
  userId?: string
): Promise<BatchFileInfo> => {
  const updated = { ...fileInfo };
  updated.state = 'IMPORTING';

  try {
    // Resolver período y confirmar campos
    let statementMonth = fileInfo.userConfirmation?.statementMonth;
    let statementYear = fileInfo.userConfirmation?.statementYear;

    // Si no hay confirmación, usar detección
    if (!statementMonth || !statementYear) {
      if (fileInfo.detectedContext?.period.month && fileInfo.detectedContext?.period.year) {
        statementMonth = fileInfo.detectedContext.period.month;
        statementYear = fileInfo.detectedContext.period.year;
      } else {
        throw new Error('Período no disponible para importación');
      }
    }

    // Importar usando el servicio existente
    const importResult: StatementImportResult = await importStatement({
      file: fileInfo.file,
      accountId,
      account,
      statementMonth,
      statementYear,
      forceUpload: false,
      userId,
      allAccounts,
    });

    updated.importedAt = Date.now();

    if (importResult.success) {
      updated.state = 'IMPORTED';
      updated.result = {
        importId: importResult.uploadId,
        transactionsCount: importResult.transactionsImported,
      };
    } else {
      updated.state = 'FAILED';
      updated.error = importResult.error || 'Error desconocido durante importación';
    }

    return updated;
  } catch (error: any) {
    updated.state = 'FAILED';
    updated.error = error?.message || 'Error al importar el archivo';
    return updated;
  }
};

/**
 * Actualizar confirmación del usuario para un archivo
 */
export const updateFileConfirmation = (
  fileInfo: BatchFileInfo,
  confirmation: Partial<FileConfirmation>
): BatchFileInfo => {
  const updated = { ...fileInfo };

  updated.userConfirmation = {
    ...updated.userConfirmation,
    ...confirmation,
  };

  // Transicionar a CONFIRMED si es necesario
  if (updated.state === 'NEEDS_CONFIRMATION') {
    updated.confirmedAt = Date.now();
    updated.state = 'CONFIRMED';
  }

  return updated;
};

/**
 * Calcular estadísticas del lote
 */
export const calculateBatchStats = (files: BatchFileInfo[]) => {
  const analyzed = files.filter((f) => f.analyzedAt !== undefined).length;
  const stats = {
    submitted: files.length,  // Total enviado al inicio
    analyzed,
    ready: files.filter((f) => f.state === 'READY').length,
    needsConfirmation: files.filter((f) => f.state === 'NEEDS_CONFIRMATION').length,
    duplicates: files.filter((f) => f.state === 'DUPLICATE').length,
    unsupported: files.filter((f) => f.state === 'UNSUPPORTED').length,
    imported: files.filter((f) => f.state === 'IMPORTED').length,
    failed: files.filter((f) => f.state === 'FAILED').length,
  };

  return stats;
};

/**
 * Obtener archivos listos para importar (READY o CONFIRMED)
 */
export const getReadyFilesForImport = (files: BatchFileInfo[]): BatchFileInfo[] => {
  return files.filter((f) => f.state === 'READY' || f.state === 'CONFIRMED');
};

/**
 * Obtener archivos que necesitan intervención manual
 */
export const getFilesNeedingConfirmation = (files: BatchFileInfo[]): BatchFileInfo[] => {
  return files.filter((f) => f.state === 'NEEDS_CONFIRMATION');
};

/**
 * Generar resumen visual para el usuario
 */
export const generateBatchSummary = (batchState: BatchImportState): string => {
  const { stats } = batchState;

  const lines: string[] = [];
  lines.push('╔══════════════════════════════════════╗');
  lines.push('║   RESUMEN DE CARGA MASIVA             ║');
  lines.push('╚══════════════════════════════════════╝');
  lines.push('');

  lines.push(`Total archivos:         ${stats.total}`);
  lines.push(`✓ Listos para importar: ${stats.ready}`);
  lines.push(`⚠ Necesitan revisión:   ${stats.needsConfirmation}`);
  lines.push(`⟳ Importando:            ${stats.importing}`);
  lines.push(`✓ Importados:            ${stats.imported}`);
  lines.push(`🔄 Duplicados:           ${stats.duplicates}`);
  lines.push(`✕ Fallos:                ${stats.failed}`);

  return lines.join('\n');
};

/**
 * Exportar resultado final
 */
export const generateBatchResult = (
  initialState: BatchImportState,
  finalFiles: BatchFileInfo[]
): BatchImportResult => {
  const stats = calculateBatchStats(finalFiles);

  const resultFiles = finalFiles.map((f) => ({
    fileName: f.fileName,
    state: f.state,
    error: f.error,
    transactionsImported: f.result?.transactionsCount,
    importId: f.result?.importId,
  }));

  const importedCount = finalFiles.filter((f) => f.state === 'IMPORTED').length;
  const failedCount = finalFiles.filter((f) => f.state === 'FAILED').length;

  let message = `Procesamiento completado: ${importedCount} importados`;
  if (failedCount > 0) {
    message += `, ${failedCount} fallos`;
  }
  if (stats.duplicates > 0) {
    message += `, ${stats.duplicates} duplicados`;
  }

  const warnings: string[] = [];
  if (stats.needsConfirmation > 0) {
    warnings.push(`${stats.needsConfirmation} archivo(s) requieren confirmación manual`);
  }
  if (stats.unsupported > 0) {
    warnings.push(`${stats.unsupported} archivo(s) no soportado`);
  }

  return {
    success: importedCount > 0 && failedCount === 0,
    startedAt: initialState.startedAt || Date.now(),
    completedAt: Date.now(),
    stats,
    files: resultFiles,
    message,
    warnings,
  };
};
