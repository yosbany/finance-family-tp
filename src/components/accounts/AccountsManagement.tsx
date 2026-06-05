import { useState, useEffect } from 'react';
import { getAccounts, createAccount, updateAccount, initializeDefaultAccounts, recalculateAllAccountBalances } from '../../services/accounts.service';
import { initializeDefaultCategories } from '../../services/categories.service';
import { getTransactionsByAccount } from '../../services/transactions.service';
import { getOwners, createOwner, deleteOwner, initializeDefaultOwners, migrateAmbosToNucleo, Owner } from '../../services/owners.service';
import { Account, Currency } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Modal } from '../common/Modal';
import BankLogo from '../common/BankLogo';

export const AccountsManagement = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editBank, setEditBank] = useState<string>('');
  const [editType, setEditType] = useState<'debit' | 'credit' | 'investment'>('debit');
  const [editCurrency, setEditCurrency] = useState<Currency>('UYU');
  const [editOwner, setEditOwner] = useState<string>('');
  const [editBalance, setEditBalance] = useState<number>(0);
  const [editInitialBalance, setEditInitialBalance] = useState<number>(0);
  const [editCreditLimit, setEditCreditLimit] = useState<number>(0);
  const [transactionCounts, setTransactionCounts] = useState<Record<string, number>>({});
  
  // Gestión de propietarios
  const [owners, setOwners] = useState<Owner[]>([]);
  const [showOwnersModal, setShowOwnersModal] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerColor, setNewOwnerColor] = useState('blue');
  
  // Nueva cuenta
  const [showNewAccountModal, setShowNewAccountModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountBank, setNewAccountBank] = useState('BROU');
  const [newAccountType, setNewAccountType] = useState<'debit' | 'credit' | 'investment'>('debit');
  const [newAccountCurrency, setNewAccountCurrency] = useState<Currency>('UYU');
  const [newAccountOwner, setNewAccountOwner] = useState('');
  const [newAccountInitialBalance, setNewAccountInitialBalance] = useState<number>(0);
  const [newAccountCreditLimit, setNewAccountCreditLimit] = useState<number>(0);
  
  // Opciones fijas para los selectores
  const banks = ['BROU', 'Itaú', 'Santander', 'OCA', 'Prex', 'BHU', 'IBM'];
  const accountTypes: Array<{value: 'debit' | 'credit' | 'investment', label: string}> = [
    { value: 'debit', label: 'Débito' },
    { value: 'credit', label: 'Crédito' },
    { value: 'investment', label: 'Inversión' }
  ];
  const currencies: Array<{value: Currency, label: string}> = [
    { value: 'UYU', label: 'Pesos (UYU)' },
    { value: 'USD', label: 'Dólares (USD)' }
  ];
  const colorOptions = [
    { value: 'blue', label: 'Azul', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' },
    { value: 'pink', label: 'Rosa', class: 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400' },
    { value: 'purple', label: 'Morado', class: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400' },
    { value: 'green', label: 'Verde', class: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' },
    { value: 'yellow', label: 'Amarillo', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' },
    { value: 'red', label: 'Rojo', class: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' },
    { value: 'gray', label: 'Gris', class: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400' }
  ];
  
  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  useEffect(() => {
    loadAccounts();
  }, [user]);

  const loadAccounts = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [accountsData, ownersData] = await Promise.all([
        getAccounts(user.uid),
        getOwners(user.uid)
      ]);
      
      // Si no hay propietarios, inicializar
      if (ownersData.length === 0) {
        setInitializing(true);
        await initializeDefaultOwners(user.uid);
        const newOwners = await getOwners(user.uid);
        setOwners(newOwners);
        
        // Migrar cuentas de "Ambos" a "Núcleo"
        const migratedCount = await migrateAmbosToNucleo(user.uid);
        if (migratedCount > 0) {
          console.log(`✅ Migradas ${migratedCount} cuentas de "Ambos" a "Núcleo"`);
        }
      } else {
        setOwners(ownersData);
      }
      
      // Si no hay cuentas, inicializar datos predeterminados
      if (accountsData.length === 0) {
        await initializeDefaultAccounts(user.uid);
        await initializeDefaultCategories(user.uid);
        const newAccounts = await getAccounts(user.uid);
        setAccounts(newAccounts);
        setInitializing(false);
        
        // Cargar conteo de transacciones categorizadas
        const counts: Record<string, number> = {};
        for (const account of newAccounts) {
          const txs = await getTransactionsByAccount(user.uid, account.id);
          const categorizedTxs = txs.filter(tx => tx.category && tx.category !== '');
          counts[account.id] = categorizedTxs.length;
        }
        setTransactionCounts(counts);
      } else {
        setAccounts(accountsData);
        
        // Cargar conteo de transacciones categorizadas por cuenta
        const counts: Record<string, number> = {};
        for (const account of accountsData) {
          const txs = await getTransactionsByAccount(user.uid, account.id);
          const categorizedTxs = txs.filter(tx => tx.category && tx.category !== '');
          counts[account.id] = categorizedTxs.length;
        }
        setTransactionCounts(counts);
      }
    } catch (err) {
      console.error('Error al cargar cuentas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (account: Account) => {
    setEditingId(account.id);
    setEditName(account.name);
    setEditBank(account.bank);
    setEditType(account.type);
    setEditCurrency(account.currency);
    setEditOwner(account.owner);
    setEditBalance(account.balance);
    setEditInitialBalance(account.initialBalance || 0);
    setEditCreditLimit(account.creditLimit || 0);
  };

  const handleSave = async (accountId: string) => {
    if (!user) return;

    try {
      const updates: Partial<Account> = {
        name: editName,
        bank: editBank,
        type: editType,
        currency: editCurrency,
        owner: editOwner,
        initialBalance: editInitialBalance
        // Balance no se actualiza manualmente, se recalcula automáticamente
      };

      if (editType === 'credit') {
        updates.creditLimit = editCreditLimit;
      }

      await updateAccount(user.uid, accountId, updates);
      
      // Recalcular balance después de actualizar el balance inicial
      await recalculateAllAccountBalances(user.uid);
      
      await loadAccounts();
      setEditingId(null);
    } catch (err) {
      console.error('Error al actualizar cuenta:', err);
      setModalMessage('Error al guardar los cambios');
      setShowErrorModal(true);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditName('');
    setEditBank('');
    setEditType('debit');
    setEditCurrency('UYU');
    setEditOwner('');
    setEditBalance(0);
    setEditInitialBalance(0);
    setEditCreditLimit(0);
  };

  const handleAddOwner = async () => {
    if (!user || !newOwnerName.trim()) return;

    try {
      await createOwner(user.uid, {
        name: newOwnerName.trim(),
        isCore: false,
        color: newOwnerColor,
        createdAt: Date.now()
      });
      
      const updatedOwners = await getOwners(user.uid);
      setOwners(updatedOwners);
      setNewOwnerName('');
      setNewOwnerColor('blue');
      setModalMessage(`Propietario "${newOwnerName}" agregado exitosamente`);
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Error al agregar propietario:', err);
      setModalMessage('Error al agregar el propietario');
      setShowErrorModal(true);
    }
  };

  const handleDeleteOwner = async (ownerId: string, ownerName: string) => {
    if (!user) return;

    try {
      await deleteOwner(user.uid, ownerId);
      const updatedOwners = await getOwners(user.uid);
      setOwners(updatedOwners);
      setModalMessage(`Propietario "${ownerName}" eliminado exitosamente`);
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error('Error al eliminar propietario:', err);
      setModalMessage(err.message || 'Error al eliminar el propietario');
      setShowErrorModal(true);
    }
  };

  const handleCreateAccount = async () => {
    if (!user || !newAccountName.trim()) {
      setModalMessage('El nombre de la cuenta es requerido');
      setShowErrorModal(true);
      return;
    }

    // Validar que haya al menos un propietario seleccionado
    if (!newAccountOwner) {
      setModalMessage('Debes seleccionar un propietario');
      setShowErrorModal(true);
      return;
    }

    try {
      const newAccount = {
        name: newAccountName.trim(),
        bank: newAccountBank,
        type: newAccountType,
        currency: newAccountCurrency,
        owner: newAccountOwner,
        balance: newAccountInitialBalance, // Balance inicial
        initialBalance: newAccountInitialBalance, // Balance inicial
        lastSync: Date.now()
      };

      if (newAccountType === 'credit') {
        Object.assign(newAccount, { creditLimit: newAccountCreditLimit });
      }

      await createAccount(user.uid, newAccount);
      await loadAccounts();
      
      // Resetear formulario
      setNewAccountName('');
      setNewAccountBank('BROU');
      setNewAccountType('debit');
      setNewAccountCurrency('UYU');
      setNewAccountOwner('');
      setNewAccountInitialBalance(0);
      setNewAccountCreditLimit(0);
      setShowNewAccountModal(false);
      
      setModalMessage(`Cuenta "${newAccountName}" creada exitosamente`);
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Error al crear cuenta:', err);
      setModalMessage('Error al crear la cuenta');
      setShowErrorModal(true);
    }
  };

  const handleRecalculateBalances = () => {
    setShowConfirmModal(true);
  };

  const confirmRecalculate = async () => {
    if (!user) return;

    try {
      setRecalculating(true);
      await recalculateAllAccountBalances(user.uid);
      await loadAccounts();
      setModalMessage('Balances recalculados exitosamente');
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Error al recalcular balances:', err);
      setModalMessage('Error al recalcular los balances');
      setShowErrorModal(true);
    } finally {
      setRecalculating(false);
    }
  };

  const formatCurrency = (value: number, currency: Currency) => {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const getAccountTypeLabel = (type: string) => {
    const labels = {
      debit: 'Débito',
      credit: 'Crédito',
      investment: 'Inversión'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getAccountTypeIcon = (type: string) => {
    const icons = {
      debit: '💳',
      credit: '💰',
      investment: '📈'
    };
    return icons[type as keyof typeof icons] || '💳';
  };

  const getOwnerColor = (ownerName: string) => {
    const owner = owners.find(o => o.name === ownerName);
    if (!owner) return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    
    const colorClasses: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      pink: 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400',
      purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      green: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      red: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    };
    
    return colorClasses[owner.color] || colorClasses.gray;
  };

  // Calcular totales por propietario
  const totalsByOwner = accounts.reduce((acc, account) => {
    if (!acc[account.owner]) {
      acc[account.owner] = { UYU: 0, USD: 0 };
    }
    
    // Para tarjetas de crédito, el balance negativo representa deuda
    // Para cuentas de débito/inversión, sumamos el balance directamente
    if (account.type === 'credit') {
      // Si el balance es negativo (deuda), lo restamos del total
      // Si es positivo (saldo a favor), lo sumamos
      acc[account.owner][account.currency] += account.balance;
    } else {
      // Cuentas de débito e inversión: sumar balance directamente
      acc[account.owner][account.currency] += account.balance;
    }
    
    return acc;
  }, {} as Record<string, Record<Currency, number>>);


  const totalDebt = accounts
    .filter(a => a.type === 'credit' && a.balance < 0)
    .reduce((sum, a) => sum + Math.abs(a.balance), 0);

  if (loading || initializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <LoadingSpinner />
        {initializing && (
          <p className="text-gray-600 dark:text-gray-400">
            Inicializando tus cuentas y categorías...
          </p>
        )}
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Cuentas Bancarias
        </h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowOwnersModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            👥 Propietarios
          </button>
          <button
            onClick={() => setShowNewAccountModal(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            ➕ Nueva Cuenta
          </button>
          <button
            onClick={handleRecalculateBalances}
            disabled={recalculating || accounts.length === 0}
            className="px-4 py-2 bg-primary hover:bg-primary-dark disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2 disabled:cursor-not-allowed"
          >
            {recalculating ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Recalculando...
              </>
            ) : (
              <>
                🔄 Recalcular Balances
              </>
            )}
          </button>
        </div>
      </div>

      {/* Resumen por propietario */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(totalsByOwner).map(([owner, totals]) => (
          <div key={owner} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getOwnerColor(owner)}`}>
                {owner}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Pesos:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(totals.UYU, 'UYU')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Dólares:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(totals.USD, 'USD')}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Deuda total en tarjetas de crédito */}
      {totalDebt > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-red-600 dark:text-red-400 font-semibold">
              ⚠️ Deuda Total en Tarjetas de Crédito:
            </span>
            <span className="text-red-700 dark:text-red-300 font-bold">
              {formatCurrency(totalDebt, 'UYU')}
            </span>
          </div>
        </div>
      )}

      {/* Lista de cuentas agrupadas por banco */}
      <div className="space-y-6">
        {['BROU', 'Itaú', 'Santander', 'OCA', 'Prex', 'BHU', 'IBM'].map(bank => {
          const bankAccounts = accounts.filter(a => a.bank === bank);
          if (bankAccounts.length === 0) return null;

          return (
            <div key={bank} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3 border-b border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-3">
                  <BankLogo bank={bank} size="md" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {bank}
                  </h2>
                </div>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {bankAccounts.map((account) => (
                  <div key={account.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {account.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                {getAccountTypeLabel(account.type)}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getOwnerColor(account.owner)}`}>
                                {account.owner}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {transactionCounts[account.id] || 0} transacciones
                              </span>
                            </div>
                          </div>
                        </div>

                        {editingId === account.id ? (
                          <div className="mt-4 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Nombre de la Cuenta
                                </label>
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  placeholder="Ej: BROU Pesos"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Banco
                                </label>
                                <select
                                  value={editBank}
                                  onChange={(e) => setEditBank(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                  {banks.map(bank => (
                                    <option key={bank} value={bank}>{bank}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Tipo de Cuenta
                                </label>
                                <select
                                  value={editType}
                                  onChange={(e) => setEditType(e.target.value as 'debit' | 'credit' | 'investment')}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                  {accountTypes.map(type => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Moneda
                                </label>
                                <select
                                  value={editCurrency}
                                  onChange={(e) => setEditCurrency(e.target.value as Currency)}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                  {currencies.map(curr => (
                                    <option key={curr.value} value={curr.value}>{curr.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                                  <span>Propietario</span>
                                  <button
                                    type="button"
                                    onClick={() => setShowOwnersModal(true)}
                                    className="text-xs text-primary hover:underline"
                                  >
                                    ⚙️ Gestionar
                                  </button>
                                </label>
                                <select
                                  value={editOwner}
                                  onChange={(e) => setEditOwner(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                  {owners.map(owner => (
                                    <option key={owner.id} value={owner.name}>{owner.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Balance Inicial
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editInitialBalance}
                                  onChange={(e) => setEditInitialBalance(parseFloat(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  placeholder="0.00"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  💡 Balance de la cuenta antes de cargar transacciones
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Balance Actual (Calculado)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editBalance.toFixed(2)}
                                  disabled
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  💡 Balance Inicial + Transacciones
                                </p>
                              </div>
                            </div>
                            {editType === 'credit' && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Límite de Crédito
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editCreditLimit}
                                  onChange={(e) => setEditCreditLimit(parseFloat(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                              </div>
                            )}
                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={() => handleSave(account.id)}
                                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                              >
                                💾 Guardar
                              </button>
                              <button
                                onClick={handleCancel}
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                              >
                                ❌ Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Balance:</span>
                              <span className={`text-lg font-bold ${
                                account.balance >= 0 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {formatCurrency(account.balance, account.currency)}
                              </span>
                            </div>
                            {account.type === 'credit' && account.creditLimit && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Límite:</span>
                                <span className="text-sm text-gray-900 dark:text-white">
                                  {formatCurrency(account.creditLimit, account.currency)}
                                </span>
                              </div>
                            )}
                            {account.type === 'credit' && account.creditLimit && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Disponible:</span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {formatCurrency(account.creditLimit + account.balance, account.currency)}
                                </span>
                              </div>
                            )}
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Última sincronización: {new Date(account.lastSync).toLocaleString('es-UY')}
                            </div>
                          </div>
                        )}
                      </div>

                      {editingId !== account.id && (
                        <button
                          onClick={() => handleEdit(account)}
                          className="ml-4 px-3 py-1 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                        >
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* Modal de Gestión de Propietarios */}
    {showOwnersModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                👥 Gestión de Propietarios
              </h2>
              <button
                onClick={() => setShowOwnersModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Formulario para agregar propietario */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Agregar Nuevo Propietario
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                    placeholder="Ej: Juan"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Color
                  </label>
                  <select
                    value={newOwnerColor}
                    onChange={(e) => setNewOwnerColor(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    {colorOptions.map(color => (
                      <option key={color.value} value={color.value}>{color.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={handleAddOwner}
                disabled={!newOwnerName.trim()}
                className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                ➕ Agregar Propietario
              </button>
            </div>

            {/* Lista de propietarios */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Propietarios Actuales
              </h3>
              {owners.map(owner => (
                <div
                  key={owner.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getOwnerColor(owner.name)}`}>
                      {owner.name}
                    </span>
                    {owner.isCore && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 px-2 py-1 rounded">
                        🔒 Núcleo (No eliminable)
                      </span>
                    )}
                  </div>
                  {!owner.isCore && (
                    <button
                      onClick={() => handleDeleteOwner(owner.id, owner.name)}
                      className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      🗑️ Eliminar
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowOwnersModal(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    {/* Modal de Nueva Cuenta */}
    {showNewAccountModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                ➕ Nueva Cuenta
              </h2>
              <button
                onClick={() => setShowNewAccountModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre de la Cuenta *
                  </label>
                  <input
                    type="text"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder="Ej: BROU Pesos"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Banco *
                  </label>
                  <select
                    value={newAccountBank}
                    onChange={(e) => setNewAccountBank(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    {banks.map(bank => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tipo de Cuenta *
                  </label>
                  <select
                    value={newAccountType}
                    onChange={(e) => setNewAccountType(e.target.value as 'debit' | 'credit' | 'investment')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    {accountTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Moneda *
                  </label>
                  <select
                    value={newAccountCurrency}
                    onChange={(e) => setNewAccountCurrency(e.target.value as Currency)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    {currencies.map(curr => (
                      <option key={curr.value} value={curr.value}>{curr.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Propietario *
                  </label>
                  <select
                    value={newAccountOwner}
                    onChange={(e) => setNewAccountOwner(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="">Seleccionar...</option>
                    {owners.map(owner => (
                      <option key={owner.id} value={owner.name}>{owner.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Balance Inicial
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newAccountInitialBalance}
                    onChange={(e) => setNewAccountInitialBalance(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Balance de la cuenta antes de cargar transacciones
                  </p>
                </div>
              </div>

              {newAccountType === 'credit' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Límite de Crédito
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newAccountCreditLimit}
                    onChange={(e) => setNewAccountCreditLimit(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  💡 <strong>Nota:</strong> El balance actual se calculará como: Balance Inicial + Transacciones cargadas.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateAccount}
                  disabled={!newAccountName.trim() || !newAccountOwner}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  ✅ Crear Cuenta
                </button>
                <button
                  onClick={() => setShowNewAccountModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}


    {/* Modals */}
    <Modal
      isOpen={showConfirmModal}
      onClose={() => setShowConfirmModal(false)}
      onConfirm={confirmRecalculate}
      title="Confirmar Recálculo"
      message="¿Recalcular los balances de todas las cuentas basándose en las transacciones cargadas? Esto sobrescribirá los balances actuales."
      type="confirm"
      confirmText="Recalcular"
      cancelText="Cancelar"
    />

    <Modal
      isOpen={showSuccessModal}
      onClose={() => setShowSuccessModal(false)}
      title="Éxito"
      message={modalMessage}
      type="success"
    />

    <Modal
      isOpen={showErrorModal}
      onClose={() => setShowErrorModal(false)}
      title="Error"
      message={modalMessage}
      type="error"
    />
    </>
  );
};

// Made with Bob
