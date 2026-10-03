import { useState, useEffect, useMemo } from 'react';
import {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  syncGoalsProgressFromAccounts
} from '../../services/goals.service';
import { getAccounts } from '../../services/accounts.service';
import { getExchangeRates } from '../../services/settings.service';
import { Goal, Account, Currency, GoalStatus, ExchangeRates } from '../../types';
import { calculateGoalCurrentAmount } from '../../utils/calculations';
import { getOwners, Owner } from '../../services/owners.service';
import { getOwnerBadgeClasses, getOwnerCardClasses } from '../../utils/ownerColors';
import { useAuth } from '../../hooks/useAuth';
import { useModal } from '../../hooks/useModal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { IconActionButton } from '../common/IconActionButton';
import {
  RichTextEditor,
  sanitizeRichText,
  isRichTextEmpty,
} from '../common/RichTextEditor';
import { DEFAULT_EXCHANGE_RATES } from '../../services/settings.service';

const emptyForm = () => ({
  name: '',
  description: '',
  targetAmount: 0,
  currency: 'USD' as Currency,
  deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  status: 'active' as GoalStatus,
  linkedAccountIds: [] as string[],
});

export const GoalsManagement = () => {
  const { user } = useAuth();
  const { showError, showConfirm, ModalComponent } = useModal();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(DEFAULT_EXCHANGE_RATES);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

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
      const [goalsData, accountsData, ownersData, rates] = await Promise.all([
        getGoals(),
        getAccounts(),
        getOwners(),
        getExchangeRates(),
      ]);

      const normalizedGoals = goalsData.map(g => ({
        ...g,
        description: g.description ?? '',
        linkedAccountIds: g.linkedAccountIds ?? [],
      }));

      const syncedGoals = await syncGoalsProgressFromAccounts(
        normalizedGoals,
        accountsData,
        rates
      );

      setAccounts(accountsData);
      setOwners(ownersData);
      setExchangeRates(rates);
      setGoals(syncedGoals.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return b.createdAt - a.createdAt;
      }));
    } catch (err) {
      console.error('Error al cargar objetivos:', err);
      setGoals([]);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const previewCurrentAmount = useMemo(() => {
    if (!formData.linkedAccountIds.length) return 0;
    return calculateGoalCurrentAmount(
      { currency: formData.currency, linkedAccountIds: formData.linkedAccountIds, currentAmount: 0 },
      accounts,
      exchangeRates
    );
  }, [formData.currency, formData.linkedAccountIds, accounts, exchangeRates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (formData.linkedAccountIds.length === 0) {
      showError('Selecciona al menos una cuenta para calcular el avance automáticamente');
      return;
    }

    try {
      const currentAmount = calculateGoalCurrentAmount(
        { currency: formData.currency, linkedAccountIds: formData.linkedAccountIds, currentAmount: 0 },
        accounts,
        exchangeRates
      );

      const goalData = {
        name: formData.name,
        description: sanitizeRichText(formData.description),
        targetAmount: formData.targetAmount,
        currentAmount,
        currency: formData.currency,
        deadline: new Date(formData.deadline).getTime(),
        status: (currentAmount >= formData.targetAmount ? 'completed' : formData.status) as GoalStatus,
        linkedAccountIds: formData.linkedAccountIds,
      };

      if (editingId) {
        await updateGoal(editingId, goalData);
      } else {
        await createGoal(goalData);
      }

      await loadData();
      resetForm();
    } catch (err) {
      console.error('Error al guardar objetivo:', err);
      showError('Error al guardar el objetivo');
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm());
    setShowForm(true);
  };

  const handleEdit = (goal: Goal) => {
    setEditingId(goal.id);
    setFormData({
      name: goal.name,
      description: goal.description ?? '',
      targetAmount: goal.targetAmount,
      currency: goal.currency,
      deadline: new Date(goal.deadline).toISOString().split('T')[0],
      status: goal.status,
      linkedAccountIds: goal.linkedAccountIds ?? [],
    });
    setShowForm(true);
  };

  const handleDelete = (goalId: string) => {
    if (!user) return;

    showConfirm({
      title: 'Confirmar eliminación',
      message: '¿Estás seguro de eliminar este objetivo?',
      confirmText: 'Eliminar',
      onConfirm: async () => {
        try {
          await deleteGoal(goalId);
          await loadData();
        } catch (err) {
          console.error('Error al eliminar objetivo:', err);
          showError('Error al eliminar el objetivo');
        }
      },
    });
  };

  const toggleAccount = (accountId: string) => {
    setFormData(prev => ({
      ...prev,
      linkedAccountIds: prev.linkedAccountIds.includes(accountId)
        ? prev.linkedAccountIds.filter(id => id !== accountId)
        : [...prev.linkedAccountIds, accountId],
    }));
  };

  const resetForm = () => {
    setFormData(emptyForm());
    setEditingId(null);
    setShowForm(false);
  };

  const formatCurrency = (value: number, currency: Currency) =>
    new Intl.NumberFormat('es-UY', { style: 'currency', currency }).format(value);

  const calculateProgress = (current: number, target: number) =>
    target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;

  const getDaysRemaining = (deadline: number) =>
    Math.ceil((deadline - Date.now()) / (1000 * 60 * 60 * 24));

  const getStatusColor = (status: GoalStatus) => ({
    active: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
  }[status]);

  const getStatusLabel = (status: GoalStatus) => ({
    active: 'Activo',
    completed: 'Completado',
    cancelled: 'Cancelado',
  }[status]);

  const getLinkedAccounts = (goal: Goal) =>
    (goal.linkedAccountIds ?? [])
      .map(id => accounts.find(a => a.id === id))
      .filter((a): a is Account => !!a);

  if (loading) return <LoadingSpinner />;

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="page-title">Objetivos Financieros</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          + Nuevo Objetivo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Objetivos Activos</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{activeGoals.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Objetivos Completados</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{completedGoals.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total de Objetivos</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{goals.length}</div>
        </div>
      </div>

      <div className="space-y-4">
        {goals.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No hay objetivos financieros
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Vincula cuentas bancarias y el progreso se calculará automáticamente
            </p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              + Crear Primer Objetivo
            </button>
          </div>
        ) : (
          goals.map((goal) => {
            const linkedAccounts = getLinkedAccounts(goal);
            const hasLinkedAccounts = linkedAccounts.length > 0;
            const currentAmount = hasLinkedAccounts
              ? calculateGoalCurrentAmount(goal, accounts, exchangeRates)
              : goal.currentAmount;
            const progress = calculateProgress(currentAmount, goal.targetAmount);
            const daysRemaining = getDaysRemaining(goal.deadline);
            const isOverdue = daysRemaining < 0 && goal.status === 'active';
            const hasDescription = !isRichTextEmpty(goal.description);

            return (
              <div key={goal.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{goal.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(goal.status)}`}>
                        {getStatusLabel(goal.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <span>Meta: {formatCurrency(goal.targetAmount, goal.currency)}</span>
                      <span>•</span>
                      <span>Actual: {formatCurrency(currentAmount, goal.currency)}</span>
                      <span>•</span>
                      <span className={isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                        {isOverdue
                          ? `Vencido hace ${Math.abs(daysRemaining)} días`
                          : `${daysRemaining} días restantes`}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <IconActionButton
                      variant="edit"
                      label="Editar"
                      onClick={() => handleEdit(goal)}
                    />
                    <IconActionButton
                      variant="delete"
                      label="Eliminar"
                      onClick={() => handleDelete(goal.id)}
                    />
                  </div>
                </div>

                {hasDescription && (
                  <div
                    className="mb-4 text-sm text-gray-600 dark:text-gray-300 max-w-none line-clamp-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichText(goal.description || '') }}
                  />
                )}

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-400">
                      Progreso {hasLinkedAccounts && '(auto)'}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        goal.status === 'completed' ? 'bg-green-600'
                          : progress >= 75 ? 'bg-blue-600'
                          : progress >= 50 ? 'bg-yellow-600'
                          : 'bg-red-600'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {hasLinkedAccounts ? (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                      Cuentas vinculadas
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {linkedAccounts.map(account => (
                        <span
                          key={account.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${getOwnerCardClasses(account.owner, owners)}`}
                        >
                          {account.type === 'debit' ? '💳' : account.type === 'credit' ? '💰' : '📈'}
                          {account.name}
                          <span className="text-gray-500">
                            ({formatCurrency(
                              calculateGoalCurrentAmount(
                                { currency: goal.currency, linkedAccountIds: [account.id], currentAmount: 0 },
                                [account],
                                exchangeRates
                              ),
                              goal.currency
                            )})
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-orange-600 dark:text-orange-400 mb-3">
                    ⚠️ Sin cuentas vinculadas — edita el objetivo para calcular el avance automáticamente
                  </p>
                )}

                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Fecha límite: {new Date(goal.deadline).toLocaleDateString('es-UY', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) resetForm();
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {editingId ? 'Editar Objetivo' : 'Nuevo Objetivo'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Detalles, descripción y cuentas para el avance automático
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="label">Nombre del Objetivo *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input-field"
                      placeholder="Ej: Vivienda Propia"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="label">Descripción</label>
                    <RichTextEditor
                      value={formData.description}
                      onChange={(description) => setFormData({ ...formData, description })}
                      placeholder="Notas, plan, requisitos… (negrita, listas, enlaces)"
                      minHeightClass="min-h-[180px]"
                    />
                  </div>

                  <div>
                    <label className="label">Monto Objetivo *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.targetAmount}
                      onChange={(e) => setFormData({ ...formData, targetAmount: parseFloat(e.target.value) || 0 })}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="label">Moneda *</label>
                    <select
                      required
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value as Currency })}
                      className="input-field"
                    >
                      <option value="UYU">Pesos (UYU)</option>
                      <option value="USD">Dólares (USD)</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Fecha Límite *</label>
                    <input
                      type="date"
                      required
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="label">Avance actual (automático)</label>
                    <div className="input-field bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white">
                      {formatCurrency(previewCurrentAmount, formData.currency)}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Calculado desde las cuentas seleccionadas
                    </p>
                  </div>
                </div>

                <div>
                  <label className="label">Cuentas vinculadas *</label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    El avance se calcula automáticamente sumando los saldos de estas cuentas
                  </p>
                  {accounts.length === 0 ? (
                    <p className="text-sm text-orange-600 dark:text-orange-400">
                      No hay cuentas disponibles. Crea cuentas primero en la sección Cuentas.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      {accounts.map(account => {
                        const selected = formData.linkedAccountIds.includes(account.id);
                        const balanceInGoalCurrency = calculateGoalCurrentAmount(
                          { currency: formData.currency, linkedAccountIds: [account.id], currentAmount: 0 },
                          [account],
                          exchangeRates
                        );
                        return (
                          <label
                            key={account.id}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border-2 transition-colors ${
                              selected
                                ? 'border-primary ring-2 ring-primary/30 ' + getOwnerCardClasses(account.owner, owners)
                                : getOwnerCardClasses(account.owner, owners)
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleAccount(account.id)}
                              className="rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {account.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {account.bank} ·{' '}
                                <span className={`inline-flex px-1.5 py-0.5 rounded-full font-medium ${getOwnerBadgeClasses(account.owner, owners)}`}>
                                  {account.owner}
                                </span>
                              </p>
                            </div>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {formatCurrency(balanceInGoalCurrency, formData.currency)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 rounded-b-xl">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingId ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ModalComponent />
    </div>
  );
};
