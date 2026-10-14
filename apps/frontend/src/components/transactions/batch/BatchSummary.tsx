/**
 * Resumen de carga masiva
 * 
 * Responsabilidad:
 * - Mostrar resultado final
 * - Estadísticas de importación
 * - Detalle por archivo
 */

import { BatchImportResult } from '../../../types/batchImport';

interface BatchSummaryProps {
  result: BatchImportResult;
}

export const BatchSummary = ({ result }: BatchSummaryProps) => {
  return (
    <div className="space-y-6">
      {/* Main message */}
      <div className={`p-6 rounded-lg border-2 ${
        result.success
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      }`}>
        <p className={`text-lg font-semibold ${
          result.success
            ? 'text-green-800 dark:text-green-200'
            : 'text-yellow-800 dark:text-yellow-200'
        }`}>
          {result.success ? '✅ ' : '⚠️ '}
          {result.message}
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Enviados"
          value={result.stats.submitted}
          color="blue"
        />
        <StatCard
          label="Importados"
          value={result.stats.imported}
          color="green"
        />
        <StatCard
          label="Duplicados"
          value={result.stats.duplicates}
          color="cyan"
        />
        <StatCard
          label="Errores"
          value={result.stats.failed}
          color="red"
        />
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <p className="font-medium text-orange-900 dark:text-orange-200 mb-3">
            Advertencias
          </p>
          <ul className="space-y-2 text-sm text-orange-800 dark:text-orange-300">
            {result.warnings.map((warning, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="flex-shrink-0">⚠️</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* File details */}
      <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Detalle por archivo
        </h3>
        <div className="space-y-2">
          {result.files.map((file, idx) => (
            <div
              key={idx}
              className="flex items-start justify-between p-3 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {file.fileName}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {getFileStatusLabel(file.state)}
                </p>
                {file.transactionsImported && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    {file.transactionsImported} transacciones
                  </p>
                )}
                {file.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {file.error}
                  </p>
                )}
              </div>
              <span className="flex-shrink-0 text-xl ml-2">
                {getFileStatusIcon(file.state)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'red' | 'cyan' | 'yellow';
}

const StatCard = ({ label, value, color }: StatCardProps) => {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    green:
      'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    cyan: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
    yellow:
      'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  };

  return (
    <div className={`border rounded-lg p-4 text-center ${colorClasses[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-1">{label}</p>
    </div>
  );
};

const getFileStatusIcon = (state: string) => {
  const icons: Record<string, string> = {
    IMPORTED: '✅',
    FAILED: '❌',
    DUPLICATE: '🔄',
    UNSUPPORTED: '❌',
    OTHER: '⏹️',
  };
  return icons[state] || '⏹️';
};

const getFileStatusLabel = (state: string) => {
  const labels: Record<string, string> = {
    IMPORTED: 'Importado exitosamente',
    FAILED: 'Error en la importación',
    DUPLICATE: 'Archivo duplicado',
    UNSUPPORTED: 'Formato no soportado',
    OTHER: 'Estado desconocido',
  };
  return labels[state] || state;
};
