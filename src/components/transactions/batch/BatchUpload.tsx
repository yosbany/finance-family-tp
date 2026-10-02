/**
 * Componente Principal de Carga Masiva (FASE 03B)
 * 
 * Flujo:
 * EMPTY → ANALYZING → REVIEW → IMPORTING → COMPLETE
 * 
 * Responsabilidad:
 * - Mantener estado de UI
 * - Orquestar acciones (analyzeFileForBatch, updateFileConfirmation, importBatchFile)
 * - Delegar rendering a componentes especializados
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useModal } from '../../../hooks/useModal';
import { BatchDropzone } from './BatchDropzone';
import { BatchFileList } from './BatchFileList';
import { BatchSummary } from './BatchSummary';
import { LoadingSpinner } from '../../common/LoadingSpinner';
import {
  createBatchFileInfo,
  createInitialBatchState,
  analyzeFileForBatch,
  updateFileConfirmation,
  importBatchFile,
  getReadyFilesForImport,
  getFilesNeedingConfirmation,
  calculateBatchStats,
  generateBatchResult,
} from '../../../services/batchImport.service';
import { BatchFileInfo, BatchImportState, BatchImportResult } from '../../../types/batchImport';
import { FileConfirmation } from '../../../types/batchImport';
import { Account } from '../../../types';

type BatchState = 'EMPTY' | 'ANALYZING' | 'REVIEW' | 'IMPORTING' | 'COMPLETE';

interface BatchUploadProps {
  allAccounts: Account[];
  onComplete?: (result: BatchImportResult) => void;
  onCancel?: () => void;
}

export const BatchUpload = ({
  allAccounts,
  onComplete,
  onCancel,
}: BatchUploadProps) => {
  const { user } = useAuth();
  const { showError, showSuccess } = useModal();

  // UI State
  const [uiState, setUiState] = useState<BatchState>('EMPTY');

  // Batch data
  const [batchState, setBatchState] = useState<BatchImportState>(
    createInitialBatchState()
  );
  const [batchResult, setBatchResult] = useState<BatchImportResult | null>(
    null
  );

  // Helper to update file in batch
  const updateFile = (id: string, updates: Partial<BatchFileInfo>) => {
    setBatchState((prev) => ({
      ...prev,
      files: prev.files.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    }));
  };

  // STEP 1: Handle file selection
  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;

    // Create file infos
    const newFiles = files.map((file) => createBatchFileInfo(file));

    setBatchState((prev) => ({
      ...prev,
      files: [...prev.files, ...newFiles],
    }));

    setUiState('ANALYZING');

    // Analyze each file
    for (const fileInfo of newFiles) {
      try {
        const analyzed = await analyzeFileForBatch(
          fileInfo,
          allAccounts,
          user?.uid
        );
        updateFile(fileInfo.id, analyzed);
      } catch (error: any) {
        console.error(`Error analyzing file ${fileInfo.fileName}:`, error);
        updateFile(fileInfo.id, {
          state: 'FAILED',
          error: error?.message || 'Error al analizar',
        });
      }
    }

    // Move to REVIEW after all analyses
    setUiState('REVIEW');
  };

  // STEP 2: Handle confirmation
  const handleFileConfirm = (fileId: string, confirmation: FileConfirmation) => {
    const file = batchState.files.find((f) => f.id === fileId);
    if (!file) return;

    const updated = updateFileConfirmation(file, confirmation);
    updateFile(fileId, updated);
  };

  // STEP 3: Import ready files
  const handleImportReady = async () => {
    const readyFiles = getReadyFilesForImport(batchState.files);
    const needsConfirmation = getFilesNeedingConfirmation(batchState.files);

    if (readyFiles.length === 0 && needsConfirmation.length > 0) {
      showError('Por favor confirma los campos ambiguos antes de importar');
      return;
    }

    if (readyFiles.length === 0) {
      showError('No hay archivos listos para importar');
      return;
    }

    setUiState('IMPORTING');

    let importedCount = 0;
    let failedCount = 0;

    for (const file of readyFiles) {
      try {
        updateFile(file.id, { state: 'IMPORTING' });

        // Determine account from confirmation or detection
        const accountId =
          file.userConfirmation?.accountId ||
          allAccounts.find((a) => a.bank === file.detectedContext?.bank)?.id;

        if (!accountId) {
          throw new Error('No se pudo determinar la cuenta');
        }

        const account = allAccounts.find((a) => a.id === accountId);
        if (!account) {
          throw new Error('Cuenta no encontrada');
        }

        // Import using the service (no persistence during analysis, only now)
        const imported = await importBatchFile(
          file,
          accountId,
          account,
          allAccounts,
          user?.uid
        );

        updateFile(file.id, imported);

        if (imported.state === 'IMPORTED') {
          importedCount++;
        } else {
          failedCount++;
        }
      } catch (error: any) {
        console.error(`Error importing file ${file.fileName}:`, error);
        updateFile(file.id, {
          state: 'FAILED',
          error: error?.message || 'Error al importar',
        });
        failedCount++;
      }
    }

    // Generate result
    const finalResult = generateBatchResult(batchState, batchState.files);
    setBatchResult(finalResult);
    setUiState('COMPLETE');

    if (importedCount > 0) {
      showSuccess(`${importedCount} archivo(s) importado(s) exitosamente`);
    }

    if (onComplete) {
      onComplete(finalResult);
    }
  };

  // Reset batch
  const handleReset = () => {
    setBatchState(createInitialBatchState());
    setBatchResult(null);
    setUiState('EMPTY');
  };

  const canConfirmAll = () => {
    const needsConfirmation = getFilesNeedingConfirmation(batchState.files);
    return (
      needsConfirmation.length === 0 ||
      needsConfirmation.every((f) => f.state === 'CONFIRMED')
    );
  };

  return (
    <div className="space-y-6">
      {/* State indicator */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 flex-1">
          {uiState === 'EMPTY' && <span className="text-xl">📁</span>}
          {uiState === 'ANALYZING' && (
            <>
              <LoadingSpinner size="sm" />
              <span className="text-sm font-medium">Analizando...</span>
            </>
          )}
          {uiState === 'REVIEW' && <span className="text-xl">👀</span>}
          {uiState === 'IMPORTING' && (
            <>
              <LoadingSpinner size="sm" />
              <span className="text-sm font-medium">Importando...</span>
            </>
          )}
          {uiState === 'COMPLETE' && <span className="text-xl">✅</span>}
        </div>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {batchState.files.length} archivo(s)
        </span>
      </div>

      {/* EMPTY state */}
      {uiState === 'EMPTY' && (
        <div className="space-y-4">
          <BatchDropzone
            onFilesSelected={handleFilesSelected}
            disabled={false}
          />
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            >
              ← Volver
            </button>
          )}
        </div>
      )}

      {/* ANALYZING / REVIEW state */}
      {(uiState === 'ANALYZING' || uiState === 'REVIEW') && (
        <div className="space-y-4">
          <BatchFileList
            files={batchState.files}
            allAccounts={allAccounts}
            onFileConfirm={handleFileConfirm}
          />

          {uiState === 'REVIEW' && (
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleImportReady}
                disabled={!canConfirmAll()}
                className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⬆️ Importar archivos listos
              </button>
              <button
                onClick={handleReset}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {/* IMPORTING state */}
      {uiState === 'IMPORTING' && (
        <div className="flex items-center justify-center p-12">
          <div className="text-center space-y-3">
            <LoadingSpinner size="lg" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Importando archivos...
            </p>
          </div>
        </div>
      )}

      {/* COMPLETE state */}
      {uiState === 'COMPLETE' && batchResult && (
        <div className="space-y-4">
          <BatchSummary result={batchResult} />
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleReset}
              className="flex-1 btn-primary"
            >
              Cargar más archivos
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="btn-secondary"
              >
                Cerrar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
