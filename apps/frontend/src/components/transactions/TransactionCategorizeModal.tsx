import { useEffect, useMemo, useState } from 'react';
import { Transaction, Account, Category } from '../../types';
import {
  explainDescriptionMatch,
  learnFromManualClassification,
  KeywordMatchInfo,
} from '../../utils/categorization';
import { getDefaultCategoryForMovement } from '../../utils/fixedCategories';
import { getOwnerBadgeClasses } from '../../utils/ownerColors';

interface TransactionCategorizeModalProps {
  transaction: Transaction | null;
  accounts: Account[];
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (categoryId: string, keywords: string[]) => Promise<void>;
  onRemoveKeyword?: (match: KeywordMatchInfo) => Promise<void>;
  getCategoryName: (categoryId: string) => string;
  getCategoryColor: (categoryId: string) => string;
}

const matchTypeLabel: Record<string, string> = {
  exact: 'exacto',
  partial: 'parcial',
  regex: 'regex',
  fuzzy: 'aproximado',
};

export const TransactionCategorizeModal = ({
  transaction,
  accounts,
  categories,
  isOpen,
  onClose,
  onSave,
  onRemoveKeyword,
  getCategoryName,
  getCategoryColor,
}: TransactionCategorizeModalProps) => {
  const [categoryId, setCategoryId] = useState('');
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [customKeyword, setCustomKeyword] = useState('');
  const [saving, setSaving] = useState(false);
  const [removingKeyword, setRemovingKeyword] = useState<string | null>(null);
  const [addRules, setAddRules] = useState(true);

  useEffect(() => {
    if (!transaction || !isOpen) return;

    const defaultCategory = getDefaultCategoryForMovement(transaction, categories);
    const initialCategory =
      transaction.category ||
      defaultCategory?.id ||
      categories[0]?.id ||
      '';
    setCategoryId(initialCategory);
    setCustomKeyword('');
    setAddRules(true);
  }, [transaction, isOpen, categories]);

  useEffect(() => {
    if (!transaction || !categoryId) {
      setSuggestedKeywords([]);
      setSelectedKeywords([]);
      return;
    }

    const category = categories.find(c => c.id === categoryId);
    if (!category) {
      setSuggestedKeywords([]);
      setSelectedKeywords([]);
      return;
    }

    const keywords = learnFromManualClassification(
      { ...transaction, category: categoryId },
      category
    );
    setSuggestedKeywords(keywords);
    setSelectedKeywords([]);
  }, [transaction, categoryId, categories]);

  const matchedPattern = useMemo(() => {
    if (!transaction || !isOpen) return null;
    return explainDescriptionMatch(
      transaction.description,
      categories,
      transaction.category || categoryId || undefined
    );
  }, [transaction, isOpen, categories, categoryId]);

  if (!isOpen || !transaction) return null;

  const account = accounts.find(a => a.id === transaction.accountId);

  const formatAmount = (amount: number, currency: string) =>
    new Intl.NumberFormat('es-UY', { style: 'currency', currency }).format(amount);

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords(prev =>
      prev.includes(keyword) ? prev.filter(k => k !== keyword) : [...prev, keyword]
    );
  };

  const handleAddCustomKeyword = () => {
    const keyword = customKeyword.trim().toLowerCase();
    if (!keyword || selectedKeywords.includes(keyword)) return;
    setSelectedKeywords(prev => [...prev, keyword]);
    if (!suggestedKeywords.includes(keyword)) {
      setSuggestedKeywords(prev => [...prev, keyword]);
    }
    setCustomKeyword('');
  };

  const handleSave = async () => {
    if (!categoryId) return;
    setSaving(true);
    try {
      await onSave(categoryId, addRules ? selectedKeywords : []);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMatchedKeyword = async (match: KeywordMatchInfo) => {
    if (!onRemoveKeyword) return;
    const key = `${match.categoryId}:${match.keyword}`;
    setRemovingKeyword(key);
    try {
      await onRemoveKeyword(match);
    } finally {
      setRemovingKeyword(null);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Categorizar Transacción
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Revisa los detalles y asigna una categoría
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fecha</span>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {new Date(transaction.date).toLocaleDateString('es-UY', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipo</span>
                <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                  {transaction.type === 'income' ? 'Ingreso' : transaction.type === 'expense' ? 'Gasto' : 'Transferencia'}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cuenta</span>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {account ? (
                    <>
                      {account.name} ·{' '}
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getOwnerBadgeClasses(account.owner)}`}>
                        {account.owner}
                      </span>
                    </>
                  ) : 'Desconocida'}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Monto</span>
                <p className={`text-sm font-bold ${
                  transaction.type === 'income'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatAmount(Math.abs(transaction.amount), transaction.currency)}
                </p>
              </div>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Descripción</span>
              <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                {transaction.description}
              </p>
            </div>
            {transaction.category && (
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Categoría actual</span>
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ml-2"
                  style={{
                    backgroundColor: `${getCategoryColor(transaction.category)}20`,
                    color: getCategoryColor(transaction.category),
                  }}
                >
                  {getCategoryName(transaction.category)}
                </span>
              </div>
            )}

            {matchedPattern && matchedPattern.matchedKeywords.length > 0 && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Patrón que coincidió
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">
                  Regla(s) de la categoría que matchean esta descripción. Podés eliminarlas acá.
                  {matchedPattern.confidence > 0
                    ? ` · confianza ${(matchedPattern.confidence * 100).toFixed(0)}%`
                    : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  {matchedPattern.matchedKeywords.map(match => {
                    const key = `${match.categoryId}:${match.keyword}`;
                    const removing = removingKeyword === key;
                    return (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                        title={`En ${match.sourceName} (${matchTypeLabel[match.matchType] || match.matchType})`}
                      >
                        <span className="font-semibold">“{match.keyword}”</span>
                        <span className="opacity-70">
                          → {match.sourceName}
                          {match.matchType !== 'exact' ? ` · ${matchTypeLabel[match.matchType]}` : ''}
                        </span>
                        {onRemoveKeyword && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMatchedKeyword(match)}
                            disabled={removing || !!removingKeyword}
                            className="ml-0.5 rounded px-1 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200/80 dark:hover:bg-emerald-800/60 disabled:opacity-50"
                            aria-label={`Eliminar patrón ${match.keyword} de ${match.sourceName}`}
                            title="Eliminar esta regla de la categoría"
                          >
                            {removing ? '…' : '×'}
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {transaction.category &&
              matchedPattern &&
              matchedPattern.matchedKeywords.length === 0 && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  No se encontró una regla activa que explique esta categoría con la descripción actual
                  (pudo haberse asignado a mano o con una regla que después se cambió).
                </p>
              </div>
            )}
          </div>

          <div className="mb-6">
            <label className="label">Categoría</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input-field"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="addRules"
                checked={addRules}
                onChange={(e) => setAddRules(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="addRules" className="text-sm font-medium text-gray-900 dark:text-white">
                Agregar a reglas de autoclasificación
              </label>
            </div>

            {addRules && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Palabras clave sugeridas para guardar como reglas nuevas (no son el patrón que ya coincidió):
                </p>
                {suggestedKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {suggestedKeywords.map(keyword => (
                      <button
                        key={keyword}
                        type="button"
                        onClick={() => toggleKeyword(keyword)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          selectedKeywords.includes(keyword)
                            ? 'bg-primary text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        {selectedKeywords.includes(keyword) ? '✓ ' : ''}{keyword}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    No se encontraron palabras clave sugeridas. Puedes agregar una manualmente.
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customKeyword}
                    onChange={(e) => setCustomKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomKeyword())}
                    placeholder="Agregar palabra clave..."
                    className="input-field flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomKeyword}
                    disabled={!customKeyword.trim()}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    Agregar
                  </button>
                </div>
                {selectedKeywords.length > 0 && categoryId && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Las transacciones futuras con estas palabras se categorizarán como "{getCategoryName(categoryId)}".
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={!categoryId || saving}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : 'Guardar categoría'}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
