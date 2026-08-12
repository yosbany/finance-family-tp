import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAccounts } from '../../services/accounts.service';
import { initializeDefaultAccounts } from '../../services/accounts.service';
import { initializeDefaultCategories } from '../../services/categories.service';
import { getTransactions } from '../../services/transactions.service';
import { getExchangeRates } from '../../services/settings.service';
import { Account, ExchangeRates, Transaction } from '../../types';
import { formatCurrency, toUyu } from '../../utils/calculations';
import { getOwnerBadgeClasses, getOwnerCardClasses } from '../../utils/ownerColors';
import { KPICard } from './KPICard';
import { LoadingSpinner } from '../common/LoadingSpinner';
import BankLogo from '../common/BankLogo';

export const Dashboard = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);

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
      const [accountsData, transactionsData, rates] = await Promise.all([
        getAccounts(),
        getTransactions(),
        getExchangeRates(),
      ]);
      setExchangeRates(rates);
      
      // Si no hay cuentas, inicializar datos predeterminados
      if (accountsData.length === 0) {
        setInitializing(true);
        await initializeDefaultAccounts();
        await initializeDefaultCategories();
        const newAccounts = await getAccounts();
        setAccounts(newAccounts);
        setInitializing(false);
      } else {
        setAccounts(accountsData);
      }
      
      // Filtrar solo transacciones categorizadas
      const categorizedTransactions = transactionsData.filter(tx => tx.category && tx.category !== '');
      setTransactions(categorizedTransactions);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setAccounts([]);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (initializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-gray-600 dark:text-gray-400">
          Inicializando tus cuentas y categorías...
        </p>
      </div>
    );
  }

  if (!exchangeRates) {
    return null;
  }

  // Calcular totales de transacciones categorizadas (todos los períodos)
  const totalIncome = transactions
    .filter(tx => tx.type === 'income')
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  
  const totalExpenses = transactions
    .filter(tx => tx.type === 'expense')
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  
  const totalSavings = totalIncome - totalExpenses;
  
  // Calcular balances por moneda
  const totalBalance = accounts.reduce(
    (acc, account) => {
      if (account.type === 'credit') {
        acc[account.currency] -= Math.abs(account.balance);
      } else {
        acc[account.currency] += account.balance;
      }
      return acc;
    },
    { UYU: 0, USD: 0 } as { UYU: number; USD: number }
  );

  const rates = exchangeRates!;
  const totalInUyu =
    toUyu(totalBalance.UYU, 'UYU', rates) + toUyu(totalBalance.USD, 'USD', rates);
  const netWorth = totalInUyu;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title-lg">
          Dashboard
        </h1>
        <p className="page-subtitle">
          Resumen de tus finanzas familiares
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
            (USD→$U {rates.usdToUyu} · UI→$U {rates.uiToUyu} ·{' '}
            <Link to="/settings" className="underline hover:text-primary">Configurar</Link>)
          </span>
        </p>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <KPICard
          title="Balance Total (UYU)"
          value={formatCurrency(totalBalance.UYU, 'UYU')}
          icon="💰"
          color="primary"
        />
        <KPICard
          title="Balance Total (USD)"
          value={formatCurrency(totalBalance.USD, 'USD')}
          icon="💵"
          color="success"
        />
        <KPICard
          title="Todo en pesos"
          value={formatCurrency(totalInUyu, 'UYU')}
          icon="💱"
          color="primary"
        />
        <KPICard
          title="Ingresos Totales"
          value={formatCurrency(totalIncome, 'UYU')}
          icon="📈"
          color="success"
        />
        <KPICard
          title="Gastos Totales"
          value={formatCurrency(totalExpenses, 'UYU')}
          icon="📉"
          color="danger"
        />
        <KPICard
          title="Ahorro Total"
          value={formatCurrency(totalSavings, 'UYU')}
          icon="🏦"
          color={totalSavings >= 0 ? 'success' : 'danger'}
        />
        <KPICard
          title="Patrimonio Neto"
          value={formatCurrency(netWorth, 'UYU')}
          icon="💎"
          color="purple"
        />
      </div>

      {/* Resumen de Cuentas */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Tus Cuentas ({accounts.length})
        </h2>
        <div className="space-y-3">
          {accounts.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-8">
              No tienes cuentas registradas. Haz clic en "Cuentas" para agregar una.
            </p>
          ) : (
            accounts.slice(0, 5).map((account) => (
              <div
                key={account.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${getOwnerCardClasses(account.owner)}`}
              >
                <div className="flex items-center gap-3">
                  <BankLogo bank={account.bank} size="sm" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {account.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {account.bank}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getOwnerBadgeClasses(account.owner)}`}>
                        {account.owner}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${account.type === 'credit' && account.balance < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                    {formatCurrency(account.balance, account.currency)}
                  </p>
                  {account.type === 'credit' && account.creditLimit && (
                    <p className="text-xs text-gray-500">
                      Límite: {formatCurrency(account.creditLimit, account.currency)}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        {accounts.length > 5 && (
          <div className="mt-4 text-center">
            <Link to="/accounts" className="text-primary hover:underline">
              Ver todas las cuentas →
            </Link>
          </div>
        )}
      </div>

      {/* Acciones Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/transactions/upload"
          className="card hover:shadow-lg transition-shadow cursor-pointer text-center"
        >
          <span className="text-4xl mb-2 block">📤</span>
          <h3 className="font-bold text-gray-900 dark:text-white">Cargar Extracto</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Sube tus estados de cuenta
          </p>
        </Link>
        <Link
          to="/transactions"
          className="card hover:shadow-lg transition-shadow cursor-pointer text-center"
        >
          <span className="text-4xl mb-2 block">💸</span>
          <h3 className="font-bold text-gray-900 dark:text-white">Ver Transacciones</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Revisa tus movimientos
          </p>
        </Link>
        <Link
          to="/reports"
          className="card hover:shadow-lg transition-shadow cursor-pointer text-center"
        >
          <span className="text-4xl mb-2 block">📈</span>
          <h3 className="font-bold text-gray-900 dark:text-white">Ver Reportes</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Analiza tus finanzas
          </p>
        </Link>
      </div>
    </div>
  );
};

// Made with Bob
