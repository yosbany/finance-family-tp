import { Category, TransactionType } from '../types';

/** Categorías de sistema: siempre existen y no se pueden eliminar. */
export const TRANSFER_CATEGORY_NAME = 'Transferencias Internas';
export const OTHER_INCOME_CATEGORY_NAME = 'Otros Ingresos';
export const OTHER_EXPENSE_CATEGORY_NAME = 'Otros Gastos';

const FIXED_CATEGORY_NAMES = new Set([
  TRANSFER_CATEGORY_NAME,
  OTHER_INCOME_CATEGORY_NAME,
  OTHER_EXPENSE_CATEGORY_NAME,
]);

export const isFixedCategory = (category: Pick<Category, 'name' | 'type'>): boolean =>
  FIXED_CATEGORY_NAMES.has(category.name) || category.type === 'transfer';

/**
 * Categoría por defecto al categorizar:
 * positivo / ingreso → Otros Ingresos
 * negativo / gasto → Otros Gastos
 */
export const getDefaultCategoryForMovement = (
  movement: { type: TransactionType; amount: number },
  categories: Category[]
): Category | undefined => {
  if (movement.type === 'transfer') {
    return categories.find(c => c.name === TRANSFER_CATEGORY_NAME || c.type === 'transfer');
  }

  const isExpense = movement.amount < 0 || movement.type === 'expense';
  const name = isExpense ? OTHER_EXPENSE_CATEGORY_NAME : OTHER_INCOME_CATEGORY_NAME;
  return categories.find(c => c.name === name);
};
