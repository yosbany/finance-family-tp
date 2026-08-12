import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useAuth } from '../../hooks/useAuth';
import { getAccounts, initializeDefaultAccounts } from '../../services/accounts.service';
import { getCategories, initializeDefaultCategories } from '../../services/categories.service';
import { getTransactions } from '../../services/transactions.service';
import { getExchangeRates } from '../../services/settings.service';
import { getGoals } from '../../services/goals.service';
import { getAssets } from '../../services/assets.service';
import { getUploadHistory } from '../../services/uploadHistory.service';
import {
  Account,
  Category,
  ExchangeRates,
  Goal,
  Asset,
  Transaction,
  UploadHistory,
} from '../../types';
import {
  formatCurrency,
  toUyu,
  calculateNetWorth,
  calculateTotalDebt,
  calculateCreditUtilization,
  calculateGoalCurrentAmount,
} from '../../utils/calculations';
import { getClosedStatementPeriod } from '../../utils/statementPeriod';
import { isSnapshotBank } from '../../utils/snapshotBanks';
import { getOwnerBadgeClasses, getOwnerCardClasses } from '../../utils/ownerColors';
import { KPICard } from './KPICard';
import { LoadingSpinner } from '../common/LoadingSpinner';
import BankLogo from '../common/BankLogo';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const txInUyu = (tx: Transaction, rates: ExchangeRates) =>
  toUyu(Math.abs(tx.amount), tx.currency, rates);

export const Dashboard = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploadHistory, setUploadHistory] = useState<UploadHistory[]>([]);
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
      const [accountsData, transactionsData, rates, cats, goalsData, assetsData, uploads] =
        await Promise.all([
          getAccounts(),
          getTransactions(),
          getExchangeRates(),
          getCategories(),
          getGoals(),
          getAssets(),
          getUploadHistory(),
        ]);
      setExchangeRates(rates);

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

      setTransactions(transactionsData);
      setCategories(cats);
      setGoals(goalsData);
      setAssets(assetsData);
      setUploadHistory(uploads);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setAccounts([]);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const closed = useMemo(() => getClosedStatementPeriod(), []);
  const closedLabel = `${MONTH_NAMES[closed.month - 1]} ${closed.year}`;

  const dashboard = useMemo(() => {
    if (!exchangeRates) return null;
    const rates = exchangeRates;

    const monthStart = new Date(closed.year, closed.month - 1, 1).getTime();
    const monthEnd = new Date(closed.year, closed.month, 0, 23, 59, 59, 999).getTime();

    const inClosedMonth = transactions.filter(
      tx => tx.date >= monthStart && tx.date <= monthEnd && !tx.isInternalTransfer
    );

    const monthIncome = inClosedMonth
      .filter(tx => tx.type === 'income')
      .reduce((sum, tx) => sum + txInUyu(tx, rates), 0);

    const monthExpenses = inClosedMonth
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + txInUyu(tx, rates), 0);

    const monthSavings = monthIncome - monthExpenses;
    const savingsRate = monthIncome > 0 ? (monthSavings / monthIncome) * 100 : 0;

    const balanceUYU = accounts.reduce((sum, a) => {
      const bal = a.type === 'credit' ? -Math.abs(a.balance) : a.balance;
      return a.currency === 'UYU' ? sum + bal : sum;
    }, 0);
    const balanceUSD = accounts.reduce((sum, a) => {
      const bal = a.type === 'credit' ? -Math.abs(a.balance) : a.balance;
      return a.currency === 'USD' ? sum + bal : sum;
    }, 0);

    const netWorth = calculateNetWorth(accounts, assets, rates);
    const debt = calculateTotalDebt(accounts);
    const debtUyu = toUyu(debt.UYU, 'UYU', rates) + toUyu(debt.USD, 'USD', rates);
    const creditUtil = calculateCreditUtilization(accounts);

    const pendingCount = transactions.filter(tx => tx.status === 'pending').length;

    const expenseByCategory = new Map<string, number>();
    inClosedMonth
      .filter(tx => tx.type === 'expense' && tx.category)
      .forEach(tx => {
        const current = expenseByCategory.get(tx.category!) || 0;
        expenseByCategory.set(tx.category!, current + txInUyu(tx, rates));
      });

    const topCategories = Array.from(expenseByCategory.entries())
      .map(([id, value]) => {
        const cat = categories.find(c => c.id === id);
        return {
          id,
          name: cat?.name || 'Sin categoría',
          color: cat?.color || '#64748B',
          icon: cat?.icon || '📦',
          value,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const topCategoriesTotal = topCategories.reduce((s, c) => s + c.value, 0);

    const activeGoals = goals
      .filter(g => g.status === 'active')
      .map(g => {
        const current = calculateGoalCurrentAmount(g, accounts, rates);
        const progress = g.targetAmount > 0
          ? Math.min(100, Math.round((current / g.targetAmount) * 100))
          : 0;
        return { ...g, current, progress };
      })
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 4);

    const monthlyAccounts = accounts.filter(a => !isSnapshotBank(a.bank));
    const coveredUploads = new Set(
      uploadHistory
        .filter(
          u =>
            u.mode !== 'snapshot' &&
            u.statementMonth === closed.month &&
            u.statementYear === closed.year
        )
        .map(u => u.accountId)
    );
    const missingExtracts = monthlyAccounts.filter(a => !coveredUploads.has(a.id)).length;
    const extractsDone = monthlyAccounts.length - missingExtracts;

    const trendSource = transactions.filter(tx => !tx.isInternalTransfer);
    const trendUyu = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      const slice = trendSource.filter(tx => tx.date >= start && tx.date <= end);
      trendUyu.push({
        month: d.toLocaleDateString('es-UY', { month: 'short' }),
        Ingresos: Math.round(
          slice.filter(t => t.type === 'income').reduce((s, t) => s + txInUyu(t, rates), 0)
        ),
        Gastos: Math.round(
          slice.filter(t => t.type === 'expense').reduce((s, t) => s + txInUyu(t, rates), 0)
        ),
      });
    }

    return {
      rates,
      monthIncome,
      monthExpenses,
      monthSavings,
      savingsRate,
      balanceUYU,
      balanceUSD,
      netWorth,
      debtUyu,
      creditUtil,
      pendingCount,
      topCategories,
      topCategoriesTotal,
      activeGoals,
      missingExtracts,
      extractsDone,
      extractsTotal: monthlyAccounts.length,
      trendUyu,
    };
  }, [
    exchangeRates,
    closed,
    transactions,
    accounts,
    assets,
    categories,
    goals,
    uploadHistory,
  ]);

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

  if (!dashboard) return null;

  const {
    rates,
    monthIncome,
    monthExpenses,
    monthSavings,
    savingsRate,
    balanceUYU,
    balanceUSD,
    netWorth,
    debtUyu,
    creditUtil,
    pendingCount,
    topCategories,
    topCategoriesTotal,
    activeGoals,
    missingExtracts,
    extractsDone,
    extractsTotal,
    trendUyu,
  } = dashboard;

  const alerts: Array<{ to: string; title: string; detail: string; tone: string }> = [];
  if (pendingCount > 0) {
    alerts.push({
      to: '/transactions',
      title: `${pendingCount} movimiento${pendingCount === 1 ? '' : 's'} sin categorizar`,
      detail: 'Revisalos para que el resumen del mes sea más preciso',
      tone: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20',
    });
  }
  if (missingExtracts > 0) {
    alerts.push({
      to: '/transactions/upload',
      title: `Faltan ${missingExtracts} extractos de ${closedLabel}`,
      detail: `${extractsDone}/${extractsTotal} cuentas del mes cerrado`,
      tone: 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20',
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title-lg">Dashboard</h1>
        <p className="page-subtitle">
          Panorama familiar · mes cerrado {closedLabel}
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
            (USD→$U {rates.usdToUyu} · UI→$U {rates.uiToUyu} ·{' '}
            <Link to="/settings" className="underline hover:text-primary">Configurar</Link>)
          </span>
        </p>
      </div>

      {alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {alerts.map(alert => (
            <Link
              key={alert.title}
              to={alert.to}
              className={`rounded-lg border p-4 hover:shadow-sm transition-shadow ${alert.tone}`}
            >
              <p className="font-semibold text-gray-900 dark:text-white">{alert.title}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{alert.detail}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Patrimonio neto"
          value={formatCurrency(netWorth, 'UYU')}
          icon="💎"
          color="purple"
        />
        <KPICard
          title={`Ingresos · ${MONTH_NAMES[closed.month - 1]}`}
          value={formatCurrency(monthIncome, 'UYU')}
          icon="📈"
          color="success"
        />
        <KPICard
          title={`Gastos · ${MONTH_NAMES[closed.month - 1]}`}
          value={formatCurrency(monthExpenses, 'UYU')}
          icon="📉"
          color="danger"
        />
        <KPICard
          title="Ahorro del mes"
          value={formatCurrency(monthSavings, 'UYU')}
          icon="🏦"
          color={monthSavings >= 0 ? 'success' : 'danger'}
        />
      </div>
      <p className="-mt-2 text-sm text-gray-500 dark:text-gray-400">
        Tasa de ahorro en {closedLabel}:{' '}
        <span className={savingsRate >= 0 ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
          {savingsRate.toFixed(0)}%
        </span>
        {monthIncome <= 0 ? ' (sin ingresos registrados)' : ' de los ingresos'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Disponible en pesos</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(balanceUYU, 'UYU')}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Disponible en dólares</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(balanceUSD, 'USD')}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Deuda en tarjetas</p>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(debtUyu, 'UYU')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Uso de límite: {creditUtil.toFixed(0)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Ingresos vs gastos
            </h2>
            <span className="text-xs text-gray-500">últimos 6 meses · $U</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendUyu}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} width={56} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value, 'UYU')}
                  contentStyle={{ borderRadius: 8 }}
                />
                <Legend />
                <Bar dataKey="Ingresos" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gastos" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              En qué se gastó · {MONTH_NAMES[closed.month - 1]}
            </h2>
            <Link to="/reports" className="text-sm text-primary hover:underline">
              Ver reportes
            </Link>
          </div>
          {topCategories.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
              Todavía no hay gastos categorizados en el mes cerrado.
            </p>
          ) : (
            <div className="space-y-3">
              {topCategories.map(cat => {
                const pct = topCategoriesTotal > 0 ? (cat.value / topCategoriesTotal) * 100 : 0;
                return (
                  <div key={cat.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {cat.icon} {cat.name}
                      </span>
                      <span className="text-gray-600 dark:text-gray-300">
                        {formatCurrency(cat.value, 'UYU')} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: cat.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Objetivos activos
            </h2>
            <Link to="/goals" className="text-sm text-primary hover:underline">
              Ver todos
            </Link>
          </div>
          {activeGoals.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
              No hay objetivos activos.{' '}
              <Link to="/goals" className="text-primary hover:underline">Crear uno</Link>
            </p>
          ) : (
            <div className="space-y-4">
              {activeGoals.map(goal => (
                <div key={goal.id}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900 dark:text-white">{goal.name}</p>
                    <span className="text-sm text-gray-600 dark:text-gray-300">{goal.progress}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden mb-1">
                    <div
                      className={`h-full rounded-full ${
                        goal.progress >= 75 ? 'bg-green-500' : goal.progress >= 40 ? 'bg-blue-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatCurrency(goal.current, goal.currency)} de{' '}
                    {formatCurrency(goal.targetAmount, goal.currency)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Cuentas principales
            </h2>
            <Link to="/accounts" className="text-sm text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="space-y-3">
            {accounts.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 text-center py-6">
                No hay cuentas registradas.
              </p>
            ) : (
              [...accounts]
                .sort((a, b) => {
                  const av = toUyu(Math.abs(a.balance), a.currency, rates);
                  const bv = toUyu(Math.abs(b.balance), b.currency, rates);
                  return bv - av;
                })
                .slice(0, 5)
                .map(account => (
                  <div
                    key={account.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${getOwnerCardClasses(account.owner)}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <BankLogo bank={account.bank} size="sm" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {account.name}
                        </p>
                        <span className={`inline-flex mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${getOwnerBadgeClasses(account.owner)}`}>
                          {account.owner}
                        </span>
                      </div>
                    </div>
                    <p className={`font-bold shrink-0 ${
                      account.type === 'credit' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                    }`}>
                      {formatCurrency(account.balance, account.currency)}
                    </p>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/transactions/upload"
          className="card hover:shadow-lg transition-shadow text-center"
        >
          <span className="text-3xl mb-2 block">📤</span>
          <h3 className="font-bold text-gray-900 dark:text-white">Cargar extracto</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Completar {closedLabel}
          </p>
        </Link>
        <Link
          to="/transactions"
          className="card hover:shadow-lg transition-shadow text-center"
        >
          <span className="text-3xl mb-2 block">💸</span>
          <h3 className="font-bold text-gray-900 dark:text-white">Movimientos</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {pendingCount > 0 ? `${pendingCount} pendientes` : 'Ver y categorizar'}
          </p>
        </Link>
        <Link
          to="/reports"
          className="card hover:shadow-lg transition-shadow text-center"
        >
          <span className="text-3xl mb-2 block">📈</span>
          <h3 className="font-bold text-gray-900 dark:text-white">Reportes</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Análisis más detallado
          </p>
        </Link>
      </div>
    </div>
  );
};
