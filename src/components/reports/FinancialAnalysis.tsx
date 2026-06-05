import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { getTransactions } from '../../services/transactions.service';
import { getCategories } from '../../services/categories.service';
import { Transaction, Category } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface MonthlyData {
  month: string;
  ingresos: number;
  gastos: number;
  ahorro: number;
}

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

export const FinancialAnalysis = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'3m' | '6m' | '12m' | 'all'>('6m');
  const [selectedCurrency, setSelectedCurrency] = useState<'UYU' | 'USD' | 'all'>('all');

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
      const [txs, cats] = await Promise.all([
        getTransactions(user.uid),
        getCategories(user.uid)
      ]);
      
      // Filtrar solo transacciones categorizadas
      const categorizedTransactions = txs.filter(tx => tx.category && tx.category !== '');
      setTransactions(categorizedTransactions);
      setCategories(cats);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      setTransactions([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar transacciones por período
  const getFilteredTransactions = () => {
    const now = Date.now();
    const periods = {
      '3m': 90 * 24 * 60 * 60 * 1000,
      '6m': 180 * 24 * 60 * 60 * 1000,
      '12m': 365 * 24 * 60 * 60 * 1000,
      'all': Infinity
    };

    return transactions.filter(tx => {
      const periodMatch = now - tx.date <= periods[selectedPeriod];
      const currencyMatch = selectedCurrency === 'all' || tx.currency === selectedCurrency;
      return periodMatch && currencyMatch;
    });
  };

  // Calcular datos mensuales
  const getMonthlyData = (): MonthlyData[] => {
    const filtered = getFilteredTransactions();
    const monthlyMap = new Map<string, { ingresos: number; gastos: number }>();

    filtered.forEach(tx => {
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { ingresos: 0, gastos: 0 });
      }

      const data = monthlyMap.get(monthKey)!;
      if (tx.type === 'income') {
        data.ingresos += Math.abs(tx.amount);
      } else {
        data.gastos += Math.abs(tx.amount);
      }
    });

    // Convertir a array y ordenar
    const result = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month: formatMonth(month),
        ingresos: Math.round(data.ingresos),
        gastos: Math.round(data.gastos),
        ahorro: Math.round(data.ingresos - data.gastos)
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return result;
  };

  // Calcular gastos por categoría
  const getCategoryData = (): CategoryData[] => {
    const filtered = getFilteredTransactions().filter(tx => tx.type === 'expense');
    const categoryMap = new Map<string, number>();

    filtered.forEach(tx => {
      const categoryId = tx.category || 'uncategorized';
      categoryMap.set(categoryId, (categoryMap.get(categoryId) || 0) + Math.abs(tx.amount));
    });

    return Array.from(categoryMap.entries())
      .map(([categoryId, value]) => {
        const category = categories.find(c => c.id === categoryId);
        return {
          name: category?.name || 'Sin categoría',
          value: Math.round(value),
          color: category?.color || '#6B7280'
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 categorías
  };

  // Calcular ingresos por categoría
  const getIncomeData = (): CategoryData[] => {
    const filtered = getFilteredTransactions().filter(tx => tx.type === 'income');
    const categoryMap = new Map<string, number>();

    filtered.forEach(tx => {
      const categoryId = tx.category || 'uncategorized';
      categoryMap.set(categoryId, (categoryMap.get(categoryId) || 0) + Math.abs(tx.amount));
    });

    return Array.from(categoryMap.entries())
      .map(([categoryId, value]) => {
        const category = categories.find(c => c.id === categoryId);
        return {
          name: category?.name || 'Sin categoría',
          value: Math.round(value),
          color: category?.color || '#10B981'
        };
      })
      .sort((a, b) => b.value - a.value);
  };

  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('es-UY', { month: 'short', year: '2-digit' });
  };

  const formatCurrency = (value: number) => {
    const currency = selectedCurrency === 'all' ? 'UYU' : selectedCurrency;
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Calcular totales
  const calculateTotals = () => {
    const filtered = getFilteredTransactions();
    const income = filtered
      .filter(tx => tx.type === 'income')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const expenses = filtered
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    
    return {
      income: Math.round(income),
      expenses: Math.round(expenses),
      savings: Math.round(income - expenses),
      savingsRate: income > 0 ? Math.round((income - expenses) / income * 100) : 0
    };
  };

  if (loading) return <LoadingSpinner />;

  const monthlyData = getMonthlyData();
  const categoryData = getCategoryData();
  const incomeData = getIncomeData();
  const totals = calculateTotals();
  const hasTransactions = transactions.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Análisis Financiero
        </h1>
      </div>

      {/* Estado vacío */}
      {!hasTransactions && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📈</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No hay datos para analizar
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Carga tus extractos bancarios para ver análisis detallados de tus finanzas
          </p>
          <a
            href="/upload"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            📤 Cargar Extracto
          </a>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Período
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="3m">Últimos 3 meses</option>
              <option value="6m">Últimos 6 meses</option>
              <option value="12m">Último año</option>
              <option value="all">Todo el período</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Moneda
            </label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Todas las monedas</option>
              <option value="UYU">Pesos (UYU)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Resumen de totales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Ingresos Totales</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(totals.income)}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Gastos Totales</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(totals.expenses)}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Ahorro</div>
          <div className={`text-2xl font-bold ${totals.savings >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(totals.savings)}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Tasa de Ahorro</div>
          <div className={`text-2xl font-bold ${totals.savingsRate >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {totals.savingsRate}%
          </div>
        </div>
      </div>

      {/* Gráfico de tendencia mensual */}
      {hasTransactions && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Tendencia Mensual
          </h2>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#F3F4F6' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
                <Line type="monotone" dataKey="ingresos" stroke="#10B981" strokeWidth={2} name="Ingresos" />
                <Line type="monotone" dataKey="gastos" stroke="#EF4444" strokeWidth={2} name="Gastos" />
                <Line type="monotone" dataKey="ahorro" stroke="#3B82F6" strokeWidth={2} name="Ahorro" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-12">
              No hay datos suficientes para mostrar la tendencia
            </div>
          )}
        </div>
      )}

      {/* Gráficos de categorías */}
      {hasTransactions && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gastos por categoría */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Gastos por Categoría
          </h2>
          {categoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {categoryData.map((cat, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                      <span className="text-gray-700 dark:text-gray-300">{cat.name}</span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(cat.value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No hay datos de gastos para mostrar
            </p>
          )}
        </div>

        {/* Ingresos por categoría */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Ingresos por Categoría
          </h2>
          {incomeData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={incomeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="value" name="Ingresos">
                    {incomeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {incomeData.map((cat, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                      <span className="text-gray-700 dark:text-gray-300">{cat.name}</span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(cat.value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No hay datos de ingresos para mostrar
            </p>
          )}
        </div>
      </div>
      )}
    </div>
  );
};

// Made with Bob
