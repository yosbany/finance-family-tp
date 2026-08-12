import { ref, push, set, get, update, remove } from 'firebase/database';
import { database } from './firebase';
import { familyPath } from './familyPaths';
import { Category } from '../types';
import { isFixedCategory, TRANSFER_CATEGORY_NAME } from '../utils/fixedCategories';

export const createCategory = async (category: Omit<Category, 'id'>): Promise<string> => {
  try {
    const categoriesRef = ref(database, familyPath('categories'));
    const newCategoryRef = push(categoriesRef);
    const categoryId = newCategoryRef.key!;

    const categoryData: Category = {
      ...category,
      subcategories: category.subcategories ?? [],
      id: categoryId,
    };

    await set(newCategoryRef, categoryData);
    return categoryId;
  } catch (error) {
    console.error('Error al crear categoría:', error);
    throw error;
  }
};

export const getCategories = async (): Promise<Category[]> => {
  try {
    const categoriesRef = ref(database, familyPath('categories'));
    const snapshot = await get(categoriesRef);

    if (!snapshot.exists()) {
      return [];
    }

    const categoriesData = snapshot.val();
    return Object.values(categoriesData) as Category[];
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    throw error;
  }
};

export const getCategoryById = async (categoryId: string): Promise<Category | null> => {
  try {
    const categoryRef = ref(database, familyPath('categories', categoryId));
    const snapshot = await get(categoryRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.val() as Category;
  } catch (error) {
    console.error('Error al obtener categoría:', error);
    throw error;
  }
};

export const updateCategory = async (categoryId: string, updates: Partial<Category>): Promise<void> => {
  try {
    const categoryRef = ref(database, familyPath('categories', categoryId));
    await update(categoryRef, updates);
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    throw error;
  }
};

export const deleteCategory = async (categoryId: string): Promise<void> => {
  try {
    const category = await getCategoryById(categoryId);
    if (category && isFixedCategory(category)) {
      throw new Error(`La categoría "${TRANSFER_CATEGORY_NAME}" es del sistema y no se puede eliminar`);
    }

    const categoryRef = ref(database, familyPath('categories', categoryId));
    await remove(categoryRef);
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    throw error;
  }
};

/** Limpia subcategorías existentes (ya no se usan en la app). */
export const clearAllSubcategories = async (): Promise<void> => {
  const categories = await getCategories();
  for (const category of categories) {
    if (category.subcategories && category.subcategories.length > 0) {
      await updateCategory(category.id, { subcategories: [] });
    }
  }
};

// Inicializar categorías predeterminadas (sin keywords ni subcategorías)
export const initializeDefaultCategories = async (): Promise<void> => {
  try {
    const defaultCategories: Omit<Category, 'id'>[] = [
      { name: 'Ingresos', type: 'income', icon: '💰', color: '#10B981', keywords: [], subcategories: [] },
      { name: 'Reingreso IVA', type: 'income', icon: '🧾', color: '#059669', keywords: ['reingreso iva'], subcategories: [] },
      { name: 'Alimentación', type: 'expense', icon: '🍔', color: '#EF4444', keywords: [], subcategories: [] },
      { name: 'Transporte', type: 'expense', icon: '🚗', color: '#3B82F6', keywords: [], subcategories: [] },
      { name: 'Servicios', type: 'expense', icon: '💡', color: '#F59E0B', keywords: [], subcategories: [] },
      { name: 'Vivienda', type: 'expense', icon: '🏠', color: '#8B5CF6', keywords: [], subcategories: [] },
      { name: 'Salud', type: 'expense', icon: '⚕️', color: '#EC4899', keywords: [], subcategories: [] },
      { name: 'Entretenimiento', type: 'expense', icon: '🎬', color: '#14B8A6', keywords: [], subcategories: [] },
      { name: 'Educación', type: 'expense', icon: '📚', color: '#6366F1', keywords: [], subcategories: [] },
      { name: 'Compras', type: 'expense', icon: '🛍️', color: '#F97316', keywords: [], subcategories: [] },
      { name: 'Otros Gastos', type: 'expense', icon: '📦', color: '#64748B', keywords: [], subcategories: [] },
      {
        name: TRANSFER_CATEGORY_NAME,
        type: 'transfer',
        icon: '🔄',
        color: '#9CA3AF',
        keywords: [],
        subcategories: [],
      },
    ];

    for (const category of defaultCategories) {
      await createCategory(category);
    }
  } catch (error) {
    console.error('Error al inicializar categorías predeterminadas:', error);
    throw error;
  }
};

export const ensureTransferCategory = async (): Promise<void> => {
  try {
    const categories = await getCategories();
    const hasTransferCategory = categories.some(c => c.name === TRANSFER_CATEGORY_NAME);

    if (!hasTransferCategory) {
      await createCategory({
        name: TRANSFER_CATEGORY_NAME,
        type: 'transfer',
        icon: '🔄',
        color: '#9CA3AF',
        keywords: [],
        subcategories: [],
      });
      console.log(`✅ Categoría "${TRANSFER_CATEGORY_NAME}" agregada`);
    }
  } catch (error) {
    console.error('Error al asegurar categoría de transferencias:', error);
    throw error;
  }
};

export const ensureReingresoIvaCategory = async (): Promise<void> => {
  try {
    const categories = await getCategories();
    const hasCategory = categories.some(c => c.name === 'Reingreso IVA' && c.type === 'income');

    if (!hasCategory) {
      await createCategory({
        name: 'Reingreso IVA',
        type: 'income',
        icon: '🧾',
        color: '#059669',
        keywords: ['reingreso iva'],
        subcategories: [],
      });
      console.log('✅ Categoría "Reingreso IVA" agregada');
    }
  } catch (error) {
    console.error('Error al asegurar categoría Reingreso IVA:', error);
    throw error;
  }
};

export const addKeywordsToCategory = async (
  categoryId: string,
  newKeywords: string[]
): Promise<void> => {
  try {
    const category = await getCategoryById(categoryId);
    if (!category) {
      throw new Error('Categoría no encontrada');
    }

    const existingKeywords = category.keywords || [];
    const uniqueKeywords = [...new Set([...existingKeywords, ...newKeywords])];

    await updateCategory(categoryId, {
      keywords: uniqueKeywords,
    });
  } catch (error) {
    console.error('Error al agregar keywords:', error);
    throw error;
  }
};

export const removeKeywordsFromCategory = async (
  categoryId: string,
  keywordsToRemove: string[]
): Promise<void> => {
  try {
    const category = await getCategoryById(categoryId);
    if (!category) {
      throw new Error('Categoría no encontrada');
    }

    const toRemove = new Set(keywordsToRemove.map(k => k.toLowerCase()));
    const updatedKeywords = category.keywords.filter(
      keyword => !toRemove.has(keyword.toLowerCase())
    );

    await updateCategory(categoryId, {
      keywords: updatedKeywords,
    });
  } catch (error) {
    console.error('Error al eliminar keywords:', error);
    throw error;
  }
};
