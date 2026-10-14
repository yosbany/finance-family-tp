/**
 * Componente de Drag & Drop para Carga Masiva
 * 
 * Responsabilidad:
 * - Aceptar múltiples archivos (PDF, CSV, XLS, XLSX)
 * - Notificar al padre cuando hay archivos
 * - Mostrar estado de drag & drop
 */

import { useCallback } from 'react';

interface BatchDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export const BatchDropzone = ({ onFilesSelected, disabled }: BatchDropzoneProps) => {
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;

      const files = Array.from(e.dataTransfer.files).filter((file) => {
        const name = file.name.toLowerCase();
        return (
          name.endsWith('.pdf') ||
          name.endsWith('.csv') ||
          name.endsWith('.xlsx') ||
          name.endsWith('.xls')
        );
      });

      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [disabled, onFilesSelected]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
    // Reset input for next selection
    e.target.value = '';
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
        disabled
          ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700'
          : 'border-primary/40 bg-primary/5 hover:border-primary/60 hover:bg-primary/10 dark:border-primary/30 dark:bg-primary/10 dark:hover:border-primary/50'
      }`}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="text-4xl">📁</div>
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">
            Arrastra archivos aquí o selecciona
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Soporta múltiples PDF, CSV, XLS, XLSX
          </p>
        </div>

        <input
          type="file"
          multiple
          accept=".pdf,.csv,.xlsx,.xls"
          onChange={handleFileInputChange}
          disabled={disabled}
          className="hidden"
          id="batch-file-input"
        />

        <label
          htmlFor="batch-file-input"
          className={`mt-4 px-4 py-2 rounded-lg font-medium transition-all ${
            disabled
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-primary text-white hover:bg-primary/90 cursor-pointer'
          }`}
        >
          Seleccionar Archivos
        </label>
      </div>
    </div>
  );
};
