import { ref, push, set, get, update, remove } from 'firebase/database';
import { database } from './firebase';
import { Goal, GoalStatus } from '../types';

export const createGoal = async (userId: string, goal: Omit<Goal, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const goalsRef = ref(database, `goals/${userId}`);
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

export const getGoals = async (userId: string): Promise<Goal[]> => {
  try {
    const goalsRef = ref(database, `goals/${userId}`);
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

export const getGoalById = async (userId: string, goalId: string): Promise<Goal | null> => {
  try {
    const goalRef = ref(database, `goals/${userId}/${goalId}`);
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

export const updateGoal = async (
  userId: string,
  goalId: string,
  updates: Partial<Goal>
): Promise<void> => {
  try {
    const goalRef = ref(database, `goals/${userId}/${goalId}`);
    await update(goalRef, updates);
  } catch (error) {
    console.error('Error al actualizar objetivo:', error);
    throw error;
  }
};

export const deleteGoal = async (userId: string, goalId: string): Promise<void> => {
  try {
    const goalRef = ref(database, `goals/${userId}/${goalId}`);
    await remove(goalRef);
  } catch (error) {
    console.error('Error al eliminar objetivo:', error);
    throw error;
  }
};

export const updateGoalProgress = async (
  userId: string,
  goalId: string,
  currentAmount: number
): Promise<void> => {
  try {
    const goal = await getGoalById(userId, goalId);
    if (!goal) throw new Error('Objetivo no encontrado');

    const updates: Partial<Goal> = {
      currentAmount,
      status: currentAmount >= goal.targetAmount ? 'completed' : 'active'
    };

    await updateGoal(userId, goalId, updates);
  } catch (error) {
    console.error('Error al actualizar progreso:', error);
    throw error;
  }
};

export const getActiveGoals = async (userId: string): Promise<Goal[]> => {
  try {
    const goals = await getGoals(userId);
    return goals.filter(g => g.status === 'active');
  } catch (error) {
    console.error('Error al obtener objetivos activos:', error);
    throw error;
  }
};

export const getCompletedGoals = async (userId: string): Promise<Goal[]> => {
  try {
    const goals = await getGoals(userId);
    return goals.filter(g => g.status === 'completed');
  } catch (error) {
    console.error('Error al obtener objetivos completados:', error);
    throw error;
  }
};

// Inicializar objetivo predeterminado
export const initializeDefaultGoal = async (userId: string): Promise<void> => {
  try {
    await createGoal(userId, {
      name: "Comprar Casa Nueva",
      targetAmount: 100000,
      currentAmount: 0,
      currency: 'USD',
      deadline: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 año desde ahora
      status: 'active'
    });
  } catch (error) {
    console.error('Error al inicializar objetivo predeterminado:', error);
    throw error;
  }
};

// Made with Bob