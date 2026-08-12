import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  getTransactions,
  updateTransaction,
  deleteTransactionsByFilter,
  deleteTransactionsByIds,
  deleteAllTransactions,
} from '../../services/transactions.service';
import { getAccounts, recalculateAccountBalance, recalculateAllAccountBalances } from '../../services/accounts.service';
import {
  getCategories,
  addKeywordsToCategory,
  ensureTransferCategory,
  ensureReingresoIvaCategory
} from '../../services/categories.service';
import {
  getUploadHistory,
  deleteUploadHistoryByFilter,
  deleteAllUploadHistory,
} from '../../services/uploadHistory.service';
import { Transaction, Account, Category, UploadHistory } from '../../types';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { useModal } from '../../hooks/useModal';
import { TransactionCategorizeModal } from './TransactionCategorizeModal';
import { categorizeTransaction } from '../../utils/categorization';
import { getOwnerBadgeClasses } from '../../utils/ownerColors';

export const TransactionList = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const uploadIdFilter = searchParams.get('uploadId');
  const { showSuccess, showError, showInfo, showConfirm, ModalComponent } = useModal();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [uploadInfo, setUploadInfo] = useState<UploadHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recategorizing, setRecategorizing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Limpieza por cuenta / período
  const [deleteAccountId, setDeleteAccountId] = useState('');
  const now = new Date();
  const [deleteMonth, setDeleteMonth] = useState(now.getMonth() + 1);
  const [deleteYear, setDeleteYear] = useState(now.getFullYear());
  const [showCleanupPanel, setShowCleanupPanel] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  // Modal de categorización
  const [showCategorizeModal, setShowCategorizeModal] = useState(false);
  const [modalTransaction, setModalTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    if (!user || !uploadIdFilter) {
      setUploadInfo(null);
      return;
    }

    getUploadHistory().then(history => {
      setUploadInfo(history.find(u => u.id === uploadIdFilter) ?? null);
    });
  }, [user, uploadIdFilter]);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Asegurar que existe la categoría de Transferencias Internas
      await ensureTransferCategory();
      await ensureReingresoIvaCategory();
      
      const [txs, accs, cats] = await Promise.all([
        getTransactions(),
        getAccounts(),
        getCategories()
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

  const countMatchingForCleanup = () => {
    return transactions.filter(tx => {
      if (deleteAccountId && tx.accountId !== deleteAccountId) return false;
      const date = new Date(tx.date);
      if (date.getMonth() + 1 !== deleteMonth) return false;
      if (date.getFullYear() !== deleteYear) return false;
      return true;
    }).length;
  };

  const countMatchingForAccount = () => {
    if (!deleteAccountId) return 0;
    return transactions.filter(tx => tx.accountId === deleteAccountId).length;
  };

  const handleDeleteByAccountPeriod = () => {
    if (!deleteAccountId) {
      showError('Selecciona una cuenta');
      return;
    }

    const account = accounts.find(a => a.id === deleteAccountId);
    const count = countMatchingForCleanup();
    const periodLabel = `${monthNames[deleteMonth - 1]} ${deleteYear}`;

    if (count === 0) {
      showInfo(`No hay transacciones de ${account?.name || 'esa cuenta'} en ${periodLabel}`);
      return;
    }

    showConfirm({
      title: 'Eliminar por cuenta y período',
      message: `Se eliminarán ${count} transacción(es) de "${account?.name}" en ${periodLabel}, y el extracto de ese mes quedará como pendiente. ¿Continuar?`,
      confirmText: 'Eliminar',
      onConfirm: async () => {
        try {
          setDeleting(true);
          const deletedTx = await deleteTransactionsByFilter({
            accountId: deleteAccountId,
            month: deleteMonth,
            year: deleteYear,
          });
          await deleteUploadHistoryByFilter({
            accountId: deleteAccountId,
            month: deleteMonth,
            year: deleteYear,
          });
          await recalculateAccountBalance(deleteAccountId);
          setSelectedIds(new Set());
          await loadData();
          showSuccess(`Eliminadas ${deletedTx} transacciones de ${periodLabel}`);
        } catch (err) {
          console.error(err);
          showError('No se pudieron eliminar las transacciones');
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  const handleDeleteAllForAccount = () => {
    if (!deleteAccountId) {
      showError('Selecciona una cuenta');
      return;
    }

    const account = accounts.find(a => a.id === deleteAccountId);
    const count = countMatchingForAccount();

    if (count === 0) {
      showInfo(`No hay transacciones en "${account?.name || 'esa cuenta'}"`);
      return;
    }

    showConfirm({
      title: 'Eliminar todas las de la cuenta',
      message: `Se eliminarán las ${count} transacción(es) de "${account?.name}" y su historial de extractos. El saldo volverá al balance inicial. ¿Continuar?`,
      confirmText: 'Eliminar transacciones',
      onConfirm: async () => {
        try {
          setDeleting(true);
          const deletedTx = await deleteTransactionsByFilter({
            accountId: deleteAccountId,
          });
          await deleteUploadHistoryByFilter({
            accountId: deleteAccountId,
          });
          await recalculateAccountBalance(deleteAccountId);
          setSelectedIds(new Set());
          await loadData();
          showSuccess(`Eliminadas ${deletedTx} transacciones de ${account?.name}`);
        } catch (err) {
          console.error(err);
          showError('No se pudieron eliminar las transacciones de la cuenta');
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  const handleDeleteAllTransactions = () => {
    showConfirm({
      title: 'Limpiar todas las transacciones',
      message: `Se eliminarán TODAS las transacciones (${transactions.length}) y el historial de extractos. Los saldos volverán al balance inicial. ¿Continuar?`,
      confirmText: 'Limpiar todo',
      onConfirm: async () => {
        try {
          setDeleting(true);
          const deletedTx = await deleteAllTransactions();
          await deleteAllUploadHistory();
          await recalculateAllAccountBalances();
          setSearchParams({});
          setSelectedIds(new Set());
          await loadData();
          showSuccess(`Limpieza completa: ${deletedTx} transacciones eliminadas`);
        } catch (err) {
          console.error(err);
          showError('No se pudo limpiar las transacciones');
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  const toggleSelectTransaction = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectVisible = (visible: Transaction[]) => {
    const visibleIds = visible.map(tx => tx.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleDeleteSelected = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      showInfo('Seleccioná al menos una transacción');
      return;
    }

    const affectedAccountIds = [
      ...new Set(
        transactions
          .filter(tx => selectedIds.has(tx.id))
          .map(tx => tx.accountId)
      ),
    ];

    showConfirm({
      title: 'Eliminar seleccionadas',
      message: `Se eliminarán ${ids.length} transacción(es) seleccionada(s). ¿Continuar?`,
      confirmText: 'Eliminar',
      onConfirm: async () => {
        try {
          setDeleting(true);
          const deleted = await deleteTransactionsByIds(ids);
          for (const accountId of affectedAccountIds) {
            await recalculateAccountBalance(accountId);
          }
          setSelectedIds(new Set());
          await loadData();
          showSuccess(`Eliminadas ${deleted} transacciones`);
        } catch (err) {
          console.error(err);
          showError('No se pudieron eliminar las transacciones seleccionadas');
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  const openCategorizeModal = (transaction: Transaction) => {
    setModalTransaction(transaction);
    setShowCategorizeModal(true);
  };

  const closeCategorizeModal = () => {
    setShowCategorizeModal(false);
    setModalTransaction(null);
  };

  const handleModalSave = async (categoryId: string, keywords: string[]) => {
    if (!user || !modalTransaction) return;

    try {
      await updateTransaction(modalTransaction.id, {
        category: categoryId,
        status: 'classified',
      });

      if (keywords.length > 0) {
        await addKeywordsToCategory(categoryId, keywords);
        const updatedCategories = await getCategories();
        setCategories(updatedCategories);
      }

      setTransactions(prev =>
        prev.map(tx =>
          tx.id === modalTransaction.id
            ? { ...tx, category: categoryId, status: 'classified' as const }
            : tx
        )
      );

      showSuccess(
        keywords.length > 0
          ? 'Transacción categorizada y regla de autoclasificación creada'
          : 'Transacción categorizada correctamente'
      );
    } catch (err) {
      console.error('Error al categorizar transacción:', err);
      showError('Error al guardar los cambios');
      throw err;
    }
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
          await updateTransaction(transaction.id, updates);
          categorizedCount++;
        }
      }

      // Recargar transacciones
      const updatedTransactions = await getTransactions();
      setTransactions(updatedTransactions);
      
      if (categorizedCount > 0) {
        showSuccess(`Se categorizaron automáticamente ${categorizedCount} de ${sortedPending.length} transacciones`);
      } else {
        showInfo('No se encontraron coincidencias con las reglas actuales. Considera agregar más palabras clave a las categorías.');
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
    if (uploadIdFilter && tx.uploadId !== uploadIdFilter) return false;

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

  const getOwnerBadgeColor = (owner: string) => getOwnerBadgeClasses(owner);

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

  const renderTransactionRow = (transaction: Transaction) => {
    const selected = selectedIds.has(transaction.id);
    return (
      <tr
        key={transaction.id}
        onDoubleClick={() => openCategorizeModal(transaction)}
        className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
          selected ? 'bg-blue-50/70 dark:bg-blue-900/20' : ''
        }`}
        title="Doble clic para categorizar"
      >
        <td
          className="px-4 py-4 whitespace-nowrap"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => toggleSelectTransaction(transaction.id)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            aria-label={`Seleccionar ${transaction.description}`}
          />
        </td>
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
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${getCategoryColor(transaction.category || '')}20`,
              color: getCategoryColor(transaction.category || '')
            }}
          >
            {getCategoryName(transaction.category || '')}
          </span>
        </td>
        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
          transaction.type === 'income'
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-600 dark:text-red-400'
        }`}>
          {transaction.type === 'income' ? '+' : '-'}
          {formatAmount(Math.abs(transaction.amount), transaction.currency)}
        </td>
      </tr>
    );
  };

  const renderSelectAllHeader = (visible: Transaction[]) => {
    const visibleIds = visible.map(tx => tx.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
    const someSelected = visibleIds.some(id => selectedIds.has(id));
    return (
      <th className="px-4 py-3 w-10">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected && !allSelected;
          }}
          onChange={() => toggleSelectVisible(visible)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          aria-label="Seleccionar todas las visibles"
        />
      </th>
    );
  };

  const uploadAccount = uploadInfo
    ? accounts.find(a => a.id === uploadInfo.accountId)
    : null;

  const clearUploadFilter = () => setSearchParams({});

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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="page-title">
          Transacciones
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {filteredTransactions.length} de {transactions.length} transacciones
            {sortedPending.length > 0 && (
              <span className="ml-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full text-xs font-medium">
                {sortedPending.length} pendiente{sortedPending.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowCleanupPanel(prev => !prev)}
            className="px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            {showCleanupPanel ? 'Ocultar limpieza' : 'Limpiar / eliminar'}
          </button>
        </div>
      </div>

      {showCleanupPanel && (
        <div className="card border border-gray-200 dark:border-gray-700 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Eliminar por cuenta o período
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              También podés marcar filas abajo y borrar solo las seleccionadas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="label">Cuenta</label>
              <select
                value={deleteAccountId}
                onChange={(e) => setDeleteAccountId(e.target.value)}
                className="input-field"
              >
                <option value="">Seleccionar cuenta</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.bank} · {account.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Mes</label>
              <select
                value={deleteMonth}
                onChange={(e) => setDeleteMonth(parseInt(e.target.value, 10))}
                className="input-field"
              >
                {monthNames.map((name, index) => (
                  <option key={name} value={index + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Año</label>
              <select
                value={deleteYear}
                onChange={(e) => setDeleteYear(parseInt(e.target.value, 10))}
                className="input-field"
              >
                {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleDeleteByAccountPeriod}
              disabled={deleting || !deleteAccountId}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              {deleting ? 'Eliminando...' : `Eliminar período (${countMatchingForCleanup()})`}
            </button>
          </div>

          <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Borrar todas las transacciones de la cuenta seleccionada (todos los meses) y sus extractos.
            </p>
            <button
              type="button"
              onClick={handleDeleteAllForAccount}
              disabled={deleting || !deleteAccountId || countMatchingForAccount() === 0}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap"
            >
              {deleting
                ? 'Eliminando...'
                : `Eliminar todas de la cuenta (${countMatchingForAccount()})`}
            </button>
          </div>

          <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Limpieza total: borra todas las transacciones y el historial de extractos.
            </p>
            <button
              type="button"
              onClick={handleDeleteAllTransactions}
              disabled={deleting || transactions.length === 0}
              className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 whitespace-nowrap"
            >
              {deleting ? 'Limpiando...' : `Limpiar todas (${transactions.length})`}
            </button>
          </div>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="sticky top-2 z-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <p className="text-sm text-gray-700 dark:text-gray-200">
            {selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-sm rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Quitar selección
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="px-3 py-1.5 text-sm rounded-md border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              {deleting ? 'Eliminando...' : `Eliminar seleccionadas (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}

      {uploadIdFilter && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              📄 Extracto: {uploadAccount ? `${uploadAccount.bank} · ${uploadAccount.name}` : 'Cargando...'}
              {uploadInfo && (
                <span className="font-normal text-blue-700 dark:text-blue-300">
                  {' '}— {monthNames[uploadInfo.statementMonth - 1]} {uploadInfo.statementYear}
                  {uploadInfo.fileName && ` · ${uploadInfo.fileName}`}
                </span>
              )}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
              Mostrando {filteredTransactions.length} transacción{filteredTransactions.length !== 1 ? 'es' : ''} de este extracto
            </p>
          </div>
          <button
            onClick={clearUploadFilter}
            className="px-4 py-2 text-sm bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors whitespace-nowrap"
          >
            Ver todas las transacciones
          </button>
        </div>
      )}

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
                  placeholder="Buscar en todas las columnas (descripción, cuenta, categoría, monto, fecha)..."
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
                  Doble clic en una fila para categorizar y crear reglas de autoclasificación
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
                  {renderSelectAllHeader(sortedPending)}
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedPending.map(renderTransactionRow)}
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
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              Doble clic en una fila para editar la categoría o reglas
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {renderSelectAllHeader(sortedCategorized)}
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedCategorized.map(renderTransactionRow)}
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
            <Link
              to="/transactions/upload"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              📤 Cargar Extracto
            </Link>
          )}
        </div>
      )}

      <TransactionCategorizeModal
        transaction={modalTransaction}
        accounts={accounts}
        categories={categories}
        isOpen={showCategorizeModal}
        onClose={closeCategorizeModal}
        onSave={handleModalSave}
        getCategoryName={getCategoryName}
        getCategoryColor={getCategoryColor}
      />
      <ModalComponent />
    </div>
  );
};

// Made with Bob
