/**
 * Tipos para Carga Masiva de Extractos (FASE 03)
 * 
 * Define estados y flujo de análisis/importación de múltiples archivos
 */

import { Currency } from './index';

/**
 * Estados posibles de un archivo en el flujo de carga
 */
export type FileProcessingState = 
  | 'PENDING'              // Agregado pero no procesado aún
  | 'ANALYZING'            // En proceso de análisis/detección
  | 'READY'                // Análisis completo, datos suficientes para importar
  | 'NEEDS_CONFIRMATION'   // Análisis completo pero requiere confirmación de campos
  | 'CONFIRMING'           // Usuario está confirmando campos
  | 'CONFIRMED'            // Usuario confirmó los campos necesarios
  | 'DUPLICATE'            // Duplicado detectado
  | 'UNSUPPORTED'          // Formato no soportado
  | 'IMPORTING'            // Importación en proceso
  | 'IMPORTED'             // Importación exitosa
  | 'FAILED';              // Importación falló

/**
 * Campos que pueden ser confirmados manualmente por el usuario
 */
export type ConfirmableField = 'bank' | 'period' | 'account' | 'currency';

/**
 * Información confirmada por el usuario para un archivo
 */
export interface FileConfirmation {
  bank?: string;
  accountId?: string;  // ID de la cuenta seleccionada
  statementMonth?: number;
  statementYear?: number;
  currency?: Currency;
}

/**
 * Contexto detectado de un archivo (similar a DetectedStatementContext)
 */
export interface DetectedFileContext {
  bank: string | null;
  accountNumber: string | null;
  accountType: 'debit' | 'credit' | 'investment' | null;
  currency: Currency | null;
  period: {
    month: number | null;
    year: number | null;
  };
  resolution: {
    bank: 'RESOLVED' | 'NEEDS_CONFIRMATION' | 'UNRESOLVED';
    account: 'RESOLVED' | 'NEEDS_CONFIRMATION' | 'UNRESOLVED';
    currency: 'RESOLVED' | 'NEEDS_CONFIRMATION' | 'UNRESOLVED';
    period: 'RESOLVED' | 'NEEDS_CONFIRMATION' | 'UNRESOLVED';
  };
  confidence: number;
  unresolvedFields: string[];
  warnings: string[];
  evidence: {
    bank?: string;
    period?: string;
    account?: string;
    currency?: string;
  };
}

/**
 * Información de un archivo en el proceso de carga masiva
 */
export interface BatchFileInfo {
  // Identificación
  id: string;                    // UUID único por sesión
  file: File;                    // El archivo en sí
  fileName: string;
  fileSize: number;              // en bytes
  
  // Estado del procesamiento
  state: FileProcessingState;
  
  // Detección
  detectedContext?: DetectedFileContext;
  
  // Confirmación del usuario (si fue necesaria)
  userConfirmation?: FileConfirmation;
  
  // Resultado
  error?: string;                // Si falló
  result?: {
    importId?: string;           // ID del uploadHistory después de importar
    transactionsCount?: number;
    duplicateOf?: string;        // Si fue duplicate, referencia al archivo duplicado
  };
  
  // Metadata
  createdAt: number;             // timestamp
  analyzedAt?: number;           // timestamp cuando se completó análisis
  confirmedAt?: number;          // timestamp cuando se confirmó
  importedAt?: number;           // timestamp cuando se importó
}

/**
 * Estado global de la carga masiva
 */
export interface BatchImportState {
  // Sesión
  isActive: boolean;
  startedAt?: number;
  
  // Archivos en procesamiento
  files: BatchFileInfo[];
  
  // Estadísticas
  stats: {
    total: number;
    analyzed: number;
    ready: number;
    needsConfirmation: number;
    duplicates: number;
    unsupported: number;
    importing: number;
    imported: number;
    failed: number;
  };
  
  // Errores globales
  globalErrors: string[];
}

/**
 * Resultado final del proceso de carga masiva
 */
export interface BatchImportResult {
  // Resumen
  success: boolean;
  startedAt: number;
  completedAt: number;
  
  // Estadísticas finales
  stats: {
    submitted: number;
    analyzed: number;
    ready: number;
    needsConfirmation: number;
    duplicates: number;
    unsupported: number;
    imported: number;
    failed: number;
  };
  
  // Detalles por archivo
  files: Array<{
    fileName: string;
    state: FileProcessingState;
    error?: string;
    transactionsImported?: number;
    importId?: string;
  }>;
  
  // Mensaje para el usuario
  message: string;
  warnings: string[];
}
