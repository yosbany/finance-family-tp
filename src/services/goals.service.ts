import { ref, push, set, get, update, remove } from 'firebase/database';
import { database } from './firebase';
import { familyPath } from './familyPaths';
import { Goal, GoalStatus, Account, ExchangeRates } from '../types';
import { calculateGoalCurrentAmount } from '../utils/calculations';
import { DEFAULT_EXCHANGE_RATES } from './settings.service';

export const createGoal = async (goal: Omit<Goal, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const goalsRef = ref(database, familyPath('goals'));
    const newGoalRef = push(goalsRef);
    const goalId = newGoalRef.key!;

    const goalData: Goal = {
      ...goal,
      id: goalId,
      createdAt: Date.now()
    };

    await set(newGoalRef, goalData);
    return goalId;
  } catch (error) {
    console.error('Error al crear objetivo:', error);
    throw error;
  }
};

export const getGoals = async (): Promise<Goal[]> => {
  try {
    const goalsRef = ref(database, familyPath('goals'));
    const snapshot = await get(goalsRef);

    if (!snapshot.exists()) {
      return [];
    }

    const goalsData = snapshot.val();
    return Object.values(goalsData) as Goal[];
  } catch (error) {
    console.error('Error al obtener objetivos:', error);
    throw error;
  }
};

export const getGoalById = async (goalId: string): Promise<Goal | null> => {
  try {
    const goalRef = ref(database, familyPath('goals', goalId));
    const snapshot = await get(goalRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.val() as Goal;
  } catch (error) {
    console.error('Error al obtener objetivo:', error);
    throw error;
  }
};

export const updateGoal = async (goalId: string, updates: Partial<Goal>): Promise<void> => {
  try {
    const goalRef = ref(database, familyPath('goals', goalId));
    await update(goalRef, updates);
  } catch (error) {
    console.error('Error al actualizar objetivo:', error);
    throw error;
  }
};

export const deleteGoal = async (goalId: string): Promise<void> => {
  try {
    const goalRef = ref(database, familyPath('goals', goalId));
    await remove(goalRef);
  } catch (error) {
    console.error('Error al eliminar objetivo:', error);
    throw error;
  }
};

export const updateGoalProgress = async (goalId: string, currentAmount: number): Promise<void> => {
  try {
    const goal = await getGoalById(goalId);
    if (!goal) throw new Error('Objetivo no encontrado');

    const updates: Partial<Goal> = {
      currentAmount,
      status: currentAmount >= goal.targetAmount ? 'completed' : 'active'
    };

    await updateGoal(goalId, updates);
  } catch (error) {
    console.error('Error al actualizar progreso:', error);
    throw error;
  }
};

export const syncGoalsProgressFromAccounts = async (
  goals: Goal[],
  accounts: Account[],
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES
): Promise<Goal[]> => {
  const synced: Goal[] = [];

  for (const goal of goals) {
    if (!goal.linkedAccountIds?.length) {
      synced.push(goal);
      continue;
    }

    const currentAmount = calculateGoalCurrentAmount(goal, accounts, rates);
    const status: GoalStatus =
      goal.status === 'cancelled'
        ? 'cancelled'
        : currentAmount >= goal.targetAmount
          ? 'completed'
          : 'active';

    if (currentAmount !== goal.currentAmount || status !== goal.status) {
      await updateGoal(goal.id, { currentAmount, status });
    }

    synced.push({ ...goal, currentAmount, status });
  }

  return synced;
};

export const getActiveGoals = async (): Promise<Goal[]> => {
  try {
    const goals = await getGoals();
    return goals.filter(g => g.status === 'active');
  } catch (error) {
    console.error('Error al obtener objetivos activos:', error);
    throw error;
  }
};

export const getCompletedGoals = async (): Promise<Goal[]> => {
  try {
    const goals = await getGoals();
    return goals.filter(g => g.status === 'completed');
  } catch (error) {
    console.error('Error al obtener objetivos completados:', error);
    throw error;
  }
};

export const initializeDefaultGoal = async (): Promise<void> => {
  try {
    await createGoal({
      name: "Comprar Casa Nueva",
      targetAmount: 100000,
      currentAmount: 0,
      currency: 'USD',
      deadline: Date.now() + (365 * 24 * 60 * 60 * 1000),
      status: 'active',
      linkedAccountIds: []
    });
  } catch (error) {
    console.error('Error al inicializar objetivo predeterminado:', error);
    throw error;
  }
};
