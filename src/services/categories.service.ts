import { ref, push, set, get, update, remove } from 'firebase/database';
import { database } from './firebase';
import { familyPath } from './familyPaths';
import { Category } from '../types';

export const createCategory = async (category: Omit<Category, 'id'>): Promise<string> => {
  try {
    const categoriesRef = ref(database, familyPath("categories"));
    const newCategoryRef = push(categoriesRef);
    const categoryId = newCategoryRef.key!;
    
    const categoryData: Category = {
      ...category,
      id: categoryId
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
    const categoriesRef = ref(database, familyPath("categories"));
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
    const categoryRef = ref(database, familyPath("categories", categoryId));
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
    const categoryRef = ref(database, familyPath("categories", categoryId));
    await update(categoryRef, updates);
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    throw error;
  }
};

export const deleteCategory = async (categoryId: string): Promise<void> => {
  try {
    const categoryRef = ref(database, familyPath("categories", categoryId));
    await remove(categoryRef);
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    throw error;
  }
};

// Inicializar categorías predeterminadas (sin keywords: las reglas las agrega el usuario)
export const initializeDefaultCategories = async (): Promise<void> => {
  try {
    const defaultCategories = [
      {
        name: "Ingresos",
        type: "income" as const,
        icon: "💰",
        color: "#10B981",
        keywords: [] as string[],
        subcategories: [
          { id: "sub-1", name: "Salario", keywords: [] as string[] },
          { id: "sub-2", name: "Freelance", keywords: [] as string[] },
          { id: "sub-3", name: "Inversiones", keywords: [] as string[] },
          { id: "sub-4", name: "Otros", keywords: [] as string[] }
        ]
      },
      {
        name: "Reingreso IVA",
        type: "income" as const,
        icon: "🧾",
        color: "#059669",
        keywords: ["reingreso iva"] as string[],
        subcategories: [] as { id: string; name: string; keywords: string[] }[]
      },
      {
        name: "Alimentación",
        type: "expense" as const,
        icon: "🍔",
        color: "#EF4444",
        keywords: [] as string[],
        subcategories: [
          { id: "sub-5", name: "Supermercado", keywords: [] as string[] },
          { id: "sub-6", name: "Restaurantes", keywords: [] as string[] },
          { id: "sub-7", name: "Delivery", keywords: [] as string[] }
        ]
      },
      {
        name: "Transporte",
        type: "expense" as const,
        icon: "🚗",
        color: "#3B82F6",
        keywords: [] as string[],
        subcategories: [
          { id: "sub-8", name: "Combustible", keywords: [] as string[] },
          { id: "sub-9", name: "Uber/Taxi", keywords: [] as string[] },
          { id: "sub-10", name: "Mantenimiento", keywords: [] as string[] },
          { id: "sub-11", name: "Estacionamiento", keywords: [] as string[] }
        ]
      },
      {
        name: "Servicios",
        type: "expense" as const,
        icon: "💡",
        color: "#F59E0B",
        keywords: [] as string[],
        subcategories: [
          { id: "sub-12", name: "Electricidad", keywords: [] as string[] },
          { id: "sub-13", name: "Agua", keywords: [] as string[] },
          { id: "sub-14", name: "Internet", keywords: [] as string[] },
          { id: "sub-15", name: "Teléfono", keywords: [] as string[] },
          { id: "sub-16", name: "Cable", keywords: [] as string[] }
        ]
      },
      {
        name: "Vivienda",
        type: "expense" as const,
        icon: "🏠",
        color: "#8B5CF6",
        keywords: [] as string[],
        subcategories: [
          { id: "sub-17", name: "Alquiler/Hipoteca", keywords: [] as string[] },
          { id: "sub-18", name: "Mantenimiento", keywords: [] as string[] },
          { id: "sub-19", name: "Contribución", keywords: [] as string[] },
          { id: "sub-20", name: "Seguros", keywords: [] as string[] }
        ]
      },
      {
        name: "Salud",
        type: "expense" as const,
        icon: "⚕️",
        color: "#EC4899",
        keywords: [] as string[],
        subcategories: [
          { id: "sub-21", name: "Mutualista", keywords: [] as string[] },
          { id: "sub-22", name: "Farmacia", keywords: [] as string[] },
          { id: "sub-23", name: "Médicos", keywords: [] as string[] },
          { id: "sub-24", name: "Seguros", keywords: [] as string[] }
        ]
      },
      {
        name: "Entretenimiento",
        type: "expense" as const,
        icon: "🎬",
        color: "#14B8A6",
        keywords: [] as string[],
        subcategories: [
          { id: "sub-25", name: "Streaming", keywords: [] as string[] },
          { id: "sub-26", name: "Cine", keywords: [] as string[] },
          { id: "sub-27", name: "Eventos", keywords: [] as string[] },
          { id: "sub-28", name: "Hobbies", keywords: [] as string[] }
        ]
      },
      {
        name: "Educación",
        type: "expense" as const,
        icon: "📚",
        color: "#6366F1",
        keywords: [] as string[],
        subcategories: [
          { id: "sub-29", name: "Cursos", keywords: [] as string[] },
          { id: "sub-30", name: "Libros", keywords: [] as string[] },
          { id: "sub-31", name: "Matrícula", keywords: [] as string[] }
        ]
      },
      {
        name: "Compras",
        type: "expense" as const,
        icon: "🛍️",
        color: "#F97316",
        keywords: [] as string[],
        subcategories: [
          { id: "sub-32", name: "Ropa", keywords: [] as string[] },
          { id: "sub-33", name: "Electrónica", keywords: [] as string[] },
          { id: "sub-34", name: "Hogar", keywords: [] as string[] },
          { id: "sub-35", name: "Otros", keywords: [] as string[] }
        ]
      },
      {
        name: "Otros Gastos",
        type: "expense" as const,
        icon: "📦",
        color: "#64748B",
        keywords: [] as string[],
        subcategories: [
          { id: "sub-36", name: "Varios", keywords: [] as string[] }
        ]
      },
      {
        name: "Transferencias Internas",
        type: "transfer" as const,
        icon: "🔄",
        color: "#9CA3AF",
        keywords: [] as string[],
        subcategories: [
          { id: "sub-37", name: "Entre cuentas propias", keywords: [] as string[] },
          { id: "sub-38", name: "Entre cuentas familiares", keywords: [] as string[] }
        ]
      }
    ];
    
    for (const category of defaultCategories) {
      await createCategory(category);
    }
  } catch (error) {
    console.error('Error al inicializar categorías predeterminadas:', error);
    throw error;
  }
};

/**
 * Agrega la categoría de Transferencias Internas si no existe
 */
export const ensureTransferCategory = async (): Promise<void> => {
  try {
    const categories = await getCategories();
    const hasTransferCategory = categories.some(c => c.name === "Transferencias Internas");
    
    if (!hasTransferCategory) {
      await createCategory({
        name: "Transferencias Internas",
        type: "transfer",
        icon: "🔄",
        color: "#9CA3AF",
        keywords: [],
        subcategories: [
          { id: "sub-37", name: "Entre cuentas propias", keywords: [] },
          { id: "sub-38", name: "Entre cuentas familiares", keywords: [] }
        ]
      });
      console.log('✅ Categoría "Transferencias Internas" agregada');
    }
  } catch (error) {
    console.error('Error al asegurar categoría de transferencias:', error);
    throw error;
  }
};

/**
 * Crea la categoría de ingreso Reingreso IVA si no existe
 */
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

    const ingresos = categories.find(c => c.name === 'Ingresos' && c.type === 'income');
    if (ingresos?.subcategories?.some(sub => sub.name === 'Reingreso IVA')) {
      const subcategories = ingresos.subcategories.filter(sub => sub.name !== 'Reingreso IVA');
      await updateCategory(ingresos.id, { subcategories });
      console.log('✅ "Reingreso IVA" movida de subcategoría a categoría propia');
    }
  } catch (error) {
    console.error('Error al asegurar categoría Reingreso IVA:', error);
    throw error;
  }
};

/**
 * Agrega keywords a una categoría existente
 */
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
      keywords: uniqueKeywords
    });
  } catch (error) {
    console.error('Error al agregar keywords:', error);
    throw error;
  }
};

/**
 * Agrega keywords a una subcategoría existente
 */
export const addKeywordsToSubcategory = async (
  categoryId: string,
  subcategoryId: string,
  newKeywords: string[]
): Promise<void> => {
  try {
    const category = await getCategoryById(categoryId);
    if (!category) {
      throw new Error('Categoría no encontrada');
    }

    const updatedSubcategories = category.subcategories.map(sub => {
      if (sub.id === subcategoryId) {
        const existingKeywords = sub.keywords || [];
        return {
          ...sub,
          keywords: [...new Set([...existingKeywords, ...newKeywords])]
        };
      }
      return sub;
    });

    await updateCategory(categoryId, {
      subcategories: updatedSubcategories
    });
  } catch (error) {
    console.error('Error al agregar keywords a subcategoría:', error);
    throw error;
  }
};

/**
 * Elimina keywords de una categoría
 */
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
      keywords: updatedKeywords
    });
  } catch (error) {
    console.error('Error al eliminar keywords:', error);
    throw error;
  }
};

/**
 * Elimina keywords de una subcategoría
 */
export const removeKeywordsFromSubcategory = async (
  categoryId: string,
  subcategoryId: string,
  keywordsToRemove: string[]
): Promise<void> => {
  try {
    const category = await getCategoryById(categoryId);
    if (!category) {
      throw new Error('Categoría no encontrada');
    }

    const toRemove = new Set(keywordsToRemove.map(k => k.toLowerCase()));
    const updatedSubcategories = category.subcategories.map(sub => {
      if (sub.id === subcategoryId) {
        return {
          ...sub,
          keywords: sub.keywords.filter(keyword => !toRemove.has(keyword.toLowerCase()))
        };
      }
      return sub;
    });

    await updateCategory(categoryId, {
      subcategories: updatedSubcategories
    });
  } catch (error) {
    console.error('Error al eliminar keywords de subcategoría:', error);
    throw error;
  }
};

// Made with Bob
