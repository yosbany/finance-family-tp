import { Category } from '../types';

/** Categoría de sistema: siempre existe y no se puede eliminar. */
export const TRANSFER_CATEGORY_NAME = 'Transferencias Internas';

export const isFixedCategory = (category: Pick<Category, 'name' | 'type'>): boolean =>
  category.name === TRANSFER_CATEGORY_NAME || category.type === 'transfer';
