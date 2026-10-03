/**
 * Fila de archivo en la lista de carga masiva
 * 
 * Responsabilidad:
 * - Mostrar estado de un archivo (PENDING, ANALYZING, READY, NEEDS_CONFIRMATION, etc.)
 * - Mostrar evidencia de detección
 * - Permitir confirmar campos si es necesario
 * - Mostrar errores
 */

import { BatchFileInfo, FileConfirmation } from '../../../types/batchImport';
import { Account } from '../../../types';

interface BatchFileRowProps {
  fileInfo: BatchFileInfo;
  allAccounts: Account[];
  onConfirm?: (confirmation: FileConfirmation) => void;
}

const getStateIcon = (state: string) => {
  switch (state) {
    case 'ANALYZING':
      return '⏳';
    case 'READY':
      return '✅';
    case 'NEEDS_CONFIRMATION':
      return '⚠️';
    case 'CONFIRMED':
      return '✓';
    case 'DUPLICATE':
      return '🔄';
    case 'UNSUPPORTED':
      return '❌';
    case 'IMPORTING':
      return '⬆️';
    case 'IMPORTED':
      return '✔️';
    case 'FAILED':
      return '❌';
    case 'PENDING':
    default:
      return '⏹️';
  }
};

const getStateLabel = (state: string) => {
  const labels: Record<string, string> = {
    PENDING: 'Pendiente',
    ANALYZING: 'Analizando...',
    READY: 'Listo',
    NEEDS_CONFIRMATION: 'Confirmar campos',
    CONFIRMED: 'Confirmado',
    DUPLICATE: 'Duplicado',
    UNSUPPORTED: 'No soportado',
    IMPORTING: 'Importando...',
    IMPORTED: 'Importado',
    FAILED: 'Error',
  };
  return labels[state] || state;
};

const getStateColor = (state: string) => {
  switch (state) {
    case 'READY':
    case 'CONFIRMED':
    case 'IMPORTED':
      return 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
    case 'NEEDS_CONFIRMATION':
      return 'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
    case 'DUPLICATE':
    case 'UNSUPPORTED':
      return 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
    case 'FAILED':
      return 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
    case 'ANALYZING':
    case 'IMPORTING':
      return 'text-gray-700 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
    default:
      return 'text-gray-700 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
  }
};

export const BatchFileRow = ({
  fileInfo,
  allAccounts,
  onConfirm,
}: BatchFileRowProps) => {
  const context = fileInfo.detectedContext;
  const showConfirmation = fileInfo.state === 'NEEDS_CONFIRMATION' && onConfirm;

  const getRelevantFields = () => {
    if (!context) return [];

    const fields = [];
    if (context.resolution.account === 'NEEDS_CONFIRMATION') {
      fields.push('account');
    }
    if (context.resolution.period === 'NEEDS_CONFIRMATION') {
      fields.push('period');
    }
    if (context.resolution.currency === 'NEEDS_CONFIRMATION') {
      fields.push('currency');
    }
    if (context.resolution.bank === 'NEEDS_CONFIRMATION') {
      fields.push('bank');
    }
    return fields;
  };

  const relevantFields = getRelevantFields();

  return (
    <div className={`border rounded-lg p-4 ${getStateColor(fileInfo.state)}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-2xl flex-shrink-0">{getStateIcon(fileInfo.state)}</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {fileInfo.fileName}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {(fileInfo.fileSize / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="font-medium text-sm">{getStateLabel(fileInfo.state)}</p>
        </div>
      </div>

      {/* Error message */}
      {fileInfo.error && (
        <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
          {fileInfo.error}
        </div>
      )}

      {/* Detected context (when analyzed) */}
      {context && fileInfo.state !== 'PENDING' && (
        <div className="mb-3 space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700 dark:text-gray-300 min-w-fit">
              Banco:
            </span>
            <span className="text-gray-900 dark:text-white">
              {context.bank || '?'}
            </span>
            {context.evidence.bank && (
              <span className="text-gray-500 dark:text-gray-500">
                ({context.evidence.bank})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700 dark:text-gray-300 min-w-fit">
              Período:
            </span>
            <span className="text-gray-900 dark:text-white">
              {context.period.month && context.period.year
                ? `${String(context.period.month).padStart(2, '0')}/${context.period.year}`
                : '?'}
            </span>
            {context.evidence.period && (
              <span className="text-gray-500 dark:text-gray-500">
                ({context.evidence.period})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700 dark:text-gray-300 min-w-fit">
              Moneda:
            </span>
            <span className="text-gray-900 dark:text-white">
              {context.currency || '?'}
            </span>
          </div>

          {context.accountNumber && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-700 dark:text-gray-300 min-w-fit">
                Cuenta:
              </span>
              <span className="text-gray-900 dark:text-white">
                {context.accountNumber}
              </span>
            </div>
          )}

          {context.confidence < 1 && (
            <div className="text-gray-600 dark:text-gray-400">
              Confianza: {(context.confidence * 100).toFixed(0)}%
            </div>
          )}
        </div>
      )}

      {/* Confirmation form (if needed) */}
      {showConfirmation && relevantFields.length > 0 && (
        <ConfirmationForm
          fileInfo={fileInfo}
          relevantFields={relevantFields}
          allAccounts={allAccounts}
          onConfirm={onConfirm}
        />
      )}
    </div>
  );
};

interface ConfirmationFormProps {
  fileInfo: BatchFileInfo;
  relevantFields: string[];
  allAccounts: Account[];
  onConfirm: (confirmation: FileConfirmation) => void;
}

const ConfirmationForm = ({
  fileInfo,
  relevantFields,
  allAccounts,
  onConfirm,
}: ConfirmationFormProps) => {
  const context = fileInfo.detectedContext;
  const confirmation = fileInfo.userConfirmation || {};

  const handleAccountChange = (accountId: string) => {
    const account = allAccounts.find((a) => a.id === accountId);
    if (account) {
      onConfirm({
        ...confirmation,
        accountId,
        bank: account.bank,
        currency: account.currency,
      });
    }
  };

  const handleMonthChange = (month: number) => {
    onConfirm({
      ...confirmation,
      statementMonth: month,
    });
  };

  const handleYearChange = (year: number) => {
    onConfirm({
      ...confirmation,
      statementYear: year,
    });
  };

  // Filter accounts by detected bank
  const relevantAccounts = context?.bank
    ? allAccounts.filter((a) => a.bank === context.bank)
    : allAccounts;

  return (
    <div className="mt-3 p-3 bg-white/50 dark:bg-gray-900/30 rounded border border-gray-200 dark:border-gray-700 space-y-3">
      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
        Confirmar campos ambiguos:
      </p>

      {relevantFields.includes('account') && (
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Cuenta
          </label>
          <select
            value={confirmation.accountId || ''}
            onChange={(e) => handleAccountChange(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">-- Seleccionar --</option>
            {relevantAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {relevantFields.includes('period') && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mes
            </label>
            <select
              value={confirmation.statementMonth || ''}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">--</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Año
            </label>
            <select
              value={confirmation.statementYear || ''}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">--</option>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
