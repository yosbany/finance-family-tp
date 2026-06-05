import { useState, useEffect } from 'react';
import {
  getTransactions,
  updateTransaction
} from '../../services/transactions.service';
import { getAccounts } from '../../services/accounts.service';
import {
  getCategories,
  addKeywordsToCategory,
  ensureTransferCategory
} from '../../services/categories.service';
import { Transaction, Account, Category } from '../../types';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { learnFromManualClassification, categorizeTransaction } from '../../utils/categorization';

export const TransactionList = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recategorizing, setRecategorizing] = useState(false);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Edición
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('');
  
  // Crear regla automática
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [currentTransaction, setCurrentTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Asegurar que existe la categoría de Transferencias Internas
      await ensureTransferCategory(user.uid);
      
      const [txs, accs, cats] = await Promise.all([
        getTransactions(user.uid),
        getAccounts(user.uid),
        getCategories(user.uid)
      ]);
      setTransactions(txs);
      setAccounts(accs);
      setCategories(cats);
    } catch (err) {
      setError('Error al cargar los datos');
      console.error(err);
      setTransactions([]);
      setAccounts([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setEditCategory(transaction.category || '');
  };

  const handleSave = async (transactionId: string) => {
    if (!user) return;
    
    try {
      const transaction = transactions.find(tx => tx.id === transactionId);
      if (!transaction) return;

      await updateTransaction(user.uid, transactionId, {
        category: editCategory,
        status: 'classified'
      });
      
      // Actualizar localmente
      const updatedTransaction = {
        ...transaction,
        category: editCategory,
        status: 'classified' as const
      };
      
      setTransactions(prev => prev.map(tx =>
        tx.id === transactionId ? updatedTransaction : tx
      ));
      
      setEditingId(null);

      // Si la transacción estaba pendiente, ofrecer crear regla automática
      if (transaction.status === 'pending') {
        const category = categories.find(c => c.id === editCategory);
        if (category) {
          const keywords = learnFromManualClassification(updatedTransaction, category);
          if (keywords.length > 0) {
            setCurrentTransaction(updatedTransaction);
            setSuggestedKeywords(keywords);
            setSelectedKeywords(keywords);
            setShowRuleDialog(true);
          }
        }
      }
    } catch (err) {
      console.error('Error al actualizar transacción:', err);
      alert('Error al guardar los cambios');
    }
  };

  const handleCreateRule = async () => {
    if (!user || !currentTransaction || selectedKeywords.length === 0) return;

    try {
      await addKeywordsToCategory(user.uid, currentTransaction.category!, selectedKeywords);
      
      // Recargar categorías
      const updatedCategories = await getCategories(user.uid);
      setCategories(updatedCategories);
      
      setShowRuleDialog(false);
      setCurrentTransaction(null);
      setSuggestedKeywords([]);
      setSelectedKeywords([]);
      
      alert('✅ Regla de categorización creada exitosamente');
    } catch (err) {
      console.error('Error al crear regla:', err);
      alert('Error al crear la regla de categorización');
    }
  };

  const handleSkipRule = () => {
    setShowRuleDialog(false);
    setCurrentTransaction(null);
    setSuggestedKeywords([]);
    setSelectedKeywords([]);
  };

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords(prev =>
      prev.includes(keyword)
        ? prev.filter(k => k !== keyword)
        : [...prev, keyword]
    );
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditCategory('');
  };

  const handleRecategorizeAll = async () => {
    if (sortedPending.length === 0 || !user) return;
    
    setRecategorizing(true);
    let categorizedCount = 0;

    try {
      // Re-categorizar cada transacción pendiente
      for (const transaction of sortedPending) {
        const result = categorizeTransaction(transaction.description, categories);
        
        if (result && result.categoryId) {
          // Preparar actualización sin valores undefined
          const updates: Partial<Transaction> = {
            category: result.categoryId,
            status: 'classified'
          };
          
          // Solo agregar subcategory si existe
          if (result.subcategoryId) {
            updates.subcategory = result.subcategoryId;
          }
          
          // Actualizar la transacción en Firebase
          await updateTransaction(user.uid, transaction.id, updates);
          categorizedCount++;
        }
      }

      // Recargar transacciones
      const updatedTransactions = await getTransactions(user.uid);
      setTransactions(updatedTransactions);
      
      if (categorizedCount > 0) {
        alert(`✅ Se categorizaron automáticamente ${categorizedCount} de ${sortedPending.length} transacciones`);
      } else {
        alert('ℹ️ No se encontraron coincidencias con las reglas actuales. Considera agregar más palabras clave a las categorías.');
      }
    } catch (err) {
      console.error('Error al re-categorizar:', err);
      setError('Error al re-categorizar las transacciones');
    } finally {
      setRecategorizing(false);
    }
  };

  // Filtrar transacciones
  const filteredTransactions = transactions.filter(tx => {
    // Búsqueda general en todas las columnas
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const accountName = getAccountName(tx.accountId).toLowerCase();
      const categoryName = getCategoryName(tx.category || '').toLowerCase();
      const description = tx.description.toLowerCase();
      const amount = tx.amount.toString();
      const date = new Date(tx.date).toLocaleDateString('es-UY');
      
      const matchesSearch =
        description.includes(term) ||
        accountName.includes(term) ||
        categoryName.includes(term) ||
        amount.includes(term) ||
        date.includes(term);
      
      if (!matchesSearch) return false;
    }
    
    // Filtros avanzados (solo si están activos)
    if (filterAccount !== 'all' && tx.accountId !== filterAccount) return false;
    if (filterCategory !== 'all' && tx.category !== filterCategory) return false;
    if (filterType !== 'all' && tx.type !== filterType) return false;
    if (filterStatus !== 'all' && tx.status !== filterStatus) return false;
    if (dateFrom && new Date(tx.date) < new Date(dateFrom)) return false;
    if (dateTo && new Date(tx.date) > new Date(dateTo)) return false;
    
    return true;
  });

  // Separar transacciones pendientes y categorizadas
  const pendingTransactions = filteredTransactions.filter(tx => tx.status === 'pending');
  const categorizedTransactions = filteredTransactions.filter(tx => tx.status !== 'pending');
  
  // Ordenar cada grupo por fecha (más reciente primero)
  const sortedPending = [...pendingTransactions].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const sortedCategorized = [...categorizedTransactions].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const getAccount = (accountId: string) => {
    return accounts.find(a => a.id === accountId);
  };

  const getAccountName = (accountId: string) => {
    const account = getAccount(accountId);
    return account ? `${account.name} ${account.owner}` : 'Desconocida';
  };

  const getOwnerBadgeColor = (owner: string) => {
    const ownerLower = owner.toLowerCase();
    if (ownerLower.includes('yosba') || ownerLower.includes('yosb')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    } else if (ownerLower.includes('yane')) {
      return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300';
    } else if (ownerLower.includes('ambos') || ownerLower.includes('familia')) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || 'Sin categoría';
  };

  const getCategoryColor = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.color || '#6B7280';
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Transacciones
        </h1>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {filteredTransactions.length} de {transactions.length} transacciones
          {sortedPending.length > 0 && (
            <span className="ml-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full text-xs font-medium">
              {sortedPending.length} pendiente{sortedPending.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="space-y-4">
          {/* Búsqueda general */}
          <div className="flex gap-3">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="🔍 Buscar en todas las columnas (descripción, cuenta, categoría, monto, fecha)..."
                  className="w-full px-4 py-3 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                <span className="absolute left-3 top-3.5 text-gray-400">🔍</span>
              </div>
            </div>
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap ${
                showAdvancedFilters
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {showAdvancedFilters ? '📋 Ocultar Filtros' : '🔧 Filtros Avanzados'}
            </button>
          </div>

          {/* Filtros avanzados (colapsables) */}
          {showAdvancedFilters && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                Filtros Avanzados
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cuenta
                  </label>
                  <select
                    value={filterAccount}
                    onChange={(e) => setFilterAccount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">Todas las cuentas</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Categoría
                  </label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">Todas las categorías</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tipo
                  </label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">Todos</option>
                    <option value="income">Ingresos</option>
                    <option value="expense">Gastos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Estado
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">Todos</option>
                    <option value="pending">Pendientes</option>
                    <option value="classified">Clasificadas</option>
                    <option value="verified">Verificadas</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Desde
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    setFilterAccount('all');
                    setFilterCategory('all');
                    setFilterType('all');
                    setFilterStatus('all');
                    setSearchTerm('');
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  🗑️ Limpiar todos los filtros
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transacciones pendientes */}
      {sortedPending.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 px-6 py-3 border-b border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-400 flex items-center gap-2">
                  ⚠️ Transacciones Sin Categorizar
                  <span className="px-2 py-0.5 bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-200 rounded-full text-sm">
                    {sortedPending.length}
                  </span>
                </h2>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Estas transacciones necesitan ser categorizadas manualmente
                </p>
              </div>
              <button
                onClick={handleRecategorizeAll}
                disabled={recategorizing}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white rounded-lg transition-colors flex items-center gap-2 disabled:cursor-not-allowed"
              >
                {recategorizing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Categorizando...
                  </>
                ) : (
                  <>
                    🔄 Re-categorizar con Reglas Actuales
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Cuenta
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Categoría
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedPending.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {new Date(transaction.date).toLocaleDateString('es-UY')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {transaction.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {(() => {
                        const account = getAccount(transaction.accountId);
                        if (!account) return <span className="text-gray-600 dark:text-gray-400">Desconocida</span>;
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900 dark:text-white">{account.name}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getOwnerBadgeColor(account.owner)}`}>
                              {account.owner}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {editingId === transaction.id ? (
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${getCategoryColor(transaction.category || '')}20`,
                            color: getCategoryColor(transaction.category || '')
                          }}
                        >
                          {getCategoryName(transaction.category || '')}
                        </span>
                      )}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      transaction.type === 'income' 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatAmount(Math.abs(transaction.amount), transaction.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {editingId === transaction.id ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleSave(transaction.id)}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={handleCancel}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEdit(transaction)}
                          className="text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary font-medium"
                        >
                          ✏️ Categorizar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transacciones categorizadas */}
      {sortedCategorized.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="bg-green-50 dark:bg-green-900/20 px-6 py-3 border-b border-green-200 dark:border-green-800">
            <h2 className="text-lg font-semibold text-green-900 dark:text-green-400 flex items-center gap-2">
              ✅ Transacciones Categorizadas
              <span className="px-2 py-0.5 bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-200 rounded-full text-sm">
                {sortedCategorized.length}
              </span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Cuenta
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Categoría
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedCategorized.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {new Date(transaction.date).toLocaleDateString('es-UY')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {transaction.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {(() => {
                        const account = getAccount(transaction.accountId);
                        if (!account) return <span className="text-gray-600 dark:text-gray-400">Desconocida</span>;
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900 dark:text-white">{account.name}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getOwnerBadgeColor(account.owner)}`}>
                              {account.owner}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {editingId === transaction.id ? (
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${getCategoryColor(transaction.category || '')}20`,
                            color: getCategoryColor(transaction.category || '')
                          }}
                        >
                          {getCategoryName(transaction.category || '')}
                        </span>
                      )}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      transaction.type === 'income'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatAmount(Math.abs(transaction.amount), transaction.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {editingId === transaction.id ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleSave(transaction.id)}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={handleCancel}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEdit(transaction)}
                          className="text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary font-medium"
                        >
                          ✏️ Categorizar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {filteredTransactions.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No hay transacciones
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {transactions.length === 0
              ? 'Comienza cargando tus extractos bancarios para ver tus transacciones aquí'
              : 'No se encontraron transacciones con los filtros aplicados'}
          </p>
          {transactions.length === 0 && (
            <a
              href="/upload"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              📤 Cargar Extracto
            </a>
          )}
        </div>
      )}

      {/* Modal para crear regla de categorización */}
      {showRuleDialog && currentTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                🤖 Crear Regla de Categorización Automática
              </h3>
              
              <div className="mb-6">
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  Has clasificado manualmente esta transacción:
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {currentTransaction.description}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Categoría: {getCategoryName(currentTransaction.category || '')}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-900 dark:text-white font-medium mb-3">
                  💡 Palabras clave sugeridas para categorización automática:
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Selecciona las palabras que quieres usar para identificar automáticamente transacciones similares en el futuro:
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedKeywords.map(keyword => (
                    <button
                      key={keyword}
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
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>ℹ️ Nota:</strong> Las palabras seleccionadas se agregarán a las reglas de categorización.
                  Las futuras transacciones que contengan estas palabras se categorizarán automáticamente como "{getCategoryName(currentTransaction.category || '')}".
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCreateRule}
                  disabled={selectedKeywords.length === 0}
                  className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✅ Crear Regla ({selectedKeywords.length} palabra{selectedKeywords.length !== 1 ? 's' : ''})
                </button>
                <button
                  onClick={handleSkipRule}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  ⏭️ Omitir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Made with Bob
