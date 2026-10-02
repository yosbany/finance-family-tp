/**
 * Lista de archivos en carga masiva
 * 
 * Responsabilidad:
 * - Mostrar todos los archivos con su estado
 * - Agrupar por estado para mejor visualización
 * - Priorizar excepciones
 */

import { BatchFileInfo } from '../../../types/batchImport';
import { Account } from '../../../types';
import { BatchFileRow } from './BatchFileRow';

interface BatchFileListProps {
  files: BatchFileInfo[];
  allAccounts: Account[];
  onFileConfirm: (fileId: string, confirmation: any) => void;
}

const groupFilesByStatus = (files: BatchFileInfo[]) => {
  const groups: Record<string, BatchFileInfo[]> = {
    'READY': [],
    'NEEDS_CONFIRMATION': [],
    'FAILED': [],
    'DUPLICATE': [],
    'UNSUPPORTED': [],
    'ANALYZING': [],
    'IMPORTING': [],
    'IMPORTED': [],
    'OTHER': [],
  };

  files.forEach((file) => {
    if (file.state in groups) {
      groups[file.state].push(file);
    } else {
      groups['OTHER'].push(file);
    }
  });

  return groups;
};

export const BatchFileList = ({
  files,
  allAccounts,
  onFileConfirm,
}: BatchFileListProps) => {
  const groups = groupFilesByStatus(files);

  // Priority order for display
  const priorityOrder = [
    'NEEDS_CONFIRMATION',
    'FAILED',
    'DUPLICATE',
    'UNSUPPORTED',
    'IMPORTING',
    'ANALYZING',
    'READY',
    'IMPORTED',
    'OTHER',
  ];

  const groupsToShow = priorityOrder
    .filter((key) => groups[key].length > 0)
    .map((key) => ({ key, files: groups[key] }));

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No hay archivos en la carga
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupsToShow.map(({ key, files: groupFiles }) => (
        <div key={key}>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">
            {getGroupLabel(key)} ({groupFiles.length})
          </h3>
          <div className="space-y-2">
            {groupFiles.map((file) => (
              <BatchFileRow
                key={file.id}
                fileInfo={file}
                allAccounts={allAccounts}
                onConfirm={(confirmation) =>
                  onFileConfirm(file.id, confirmation)
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const getGroupLabel = (key: string) => {
  const labels: Record<string, string> = {
    NEEDS_CONFIRMATION: '⚠️ Requieren confirmación',
    FAILED: '❌ Errores',
    DUPLICATE: '🔄 Duplicados',
    UNSUPPORTED: '❌ No soportados',
    IMPORTING: '⬆️ Importando',
    ANALYZING: '⏳ Analizando',
    READY: '✅ Listos para importar',
    IMPORTED: '✔️ Importados',
    OTHER: '⏹️ Otros',
  };
  return labels[key] || key;
};
