import { ref, push, set, get, update, remove } from 'firebase/database';
import { database } from './firebase';
import { Category, Subcategory } from '../types';

export const createCategory = async (userId: string, category: Omit<Category, 'id'>): Promise<string> => {
  try {
    const categoriesRef = ref(database, `categories/${userId}`);
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

export const getCategories = async (userId: string): Promise<Category[]> => {
  try {
    const categoriesRef = ref(database, `categories/${userId}`);
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

export const getCategoryById = async (userId: string, categoryId: string): Promise<Category | null> => {
  try {
    const categoryRef = ref(database, `categories/${userId}/${categoryId}`);
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

export const updateCategory = async (userId: string, categoryId: string, updates: Partial<Category>): Promise<void> => {
  try {
    const categoryRef = ref(database, `categories/${userId}/${categoryId}`);
    await update(categoryRef, updates);
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    throw error;
  }
};

export const deleteCategory = async (userId: string, categoryId: string): Promise<void> => {
  try {
    const categoryRef = ref(database, `categories/${userId}/${categoryId}`);
    await remove(categoryRef);
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    throw error;
  }
};

// Inicializar categorías predeterminadas
export const initializeDefaultCategories = async (userId: string): Promise<void> => {
  try {
    const defaultCategories = [
      {
        name: "Ingresos",
        type: "income" as const,
        icon: "💰",
        color: "#10B981",
        keywords: ["salario", "sueldo", "pago", "ingreso", "cobro"],
        subcategories: [
          { id: "sub-1", name: "Salario", keywords: ["salario", "sueldo", "nómina"] },
          { id: "sub-2", name: "Freelance", keywords: ["freelance", "trabajo independiente", "proyecto"] },
          { id: "sub-3", name: "Inversiones", keywords: ["dividendo", "interés", "rendimiento"] },
          { id: "sub-4", name: "Otros", keywords: [] }
        ]
      },
      {
        name: "Alimentación",
        type: "expense" as const,
        icon: "🍔",
        color: "#EF4444",
        keywords: ["supermercado", "tienda", "almacén", "disco", "devoto", "tienda inglesa", "comida", "alimento"],
        subcategories: [
          { id: "sub-5", name: "Supermercado", keywords: ["disco", "devoto", "tienda inglesa", "supermercado", "geant"] },
          { id: "sub-6", name: "Restaurantes", keywords: ["restaurante", "bar", "café", "parrilla"] },
          { id: "sub-7", name: "Delivery", keywords: ["pedidosya", "rappi", "uber eats", "delivery"] }
        ]
      },
      {
        name: "Transporte",
        type: "expense" as const,
        icon: "🚗",
        color: "#3B82F6",
        keywords: ["uber", "taxi", "combustible", "nafta", "gasoil", "estacionamiento", "peaje", "transporte"],
        subcategories: [
          { id: "sub-8", name: "Combustible", keywords: ["ancap", "esso", "shell", "petrobras", "nafta", "gasoil"] },
          { id: "sub-9", name: "Uber/Taxi", keywords: ["uber", "cabify", "taxi"] },
          { id: "sub-10", name: "Mantenimiento", keywords: ["taller", "mecánico", "service", "repuesto"] },
          { id: "sub-11", name: "Estacionamiento", keywords: ["estacionamiento", "parking", "peaje"] }
        ]
      },
      {
        name: "Servicios",
        type: "expense" as const,
        icon: "💡",
        color: "#F59E0B",
        keywords: ["ute", "ose", "antel", "internet", "cable", "servicio"],
        subcategories: [
          { id: "sub-12", name: "Electricidad", keywords: ["ute", "luz", "electricidad"] },
          { id: "sub-13", name: "Agua", keywords: ["ose", "agua"] },
          { id: "sub-14", name: "Internet", keywords: ["antel", "movistar", "claro", "internet", "fibra"] },
          { id: "sub-15", name: "Teléfono", keywords: ["antel", "movistar", "claro", "teléfono", "celular"] },
          { id: "sub-16", name: "Cable", keywords: ["directv", "cablevisión", "cable", "tv"] }
        ]
      },
      {
        name: "Vivienda",
        type: "expense" as const,
        icon: "🏠",
        color: "#8B5CF6",
        keywords: ["alquiler", "bhu", "hipoteca", "contribución", "casa", "vivienda"],
        subcategories: [
          { id: "sub-17", name: "Alquiler/Hipoteca", keywords: ["alquiler", "bhu", "hipoteca", "préstamo"] },
          { id: "sub-18", name: "Mantenimiento", keywords: ["pintura", "plomero", "electricista", "reparación"] },
          { id: "sub-19", name: "Contribución", keywords: ["contribución", "impuesto", "primaria"] },
          { id: "sub-20", name: "Seguros", keywords: ["seguro", "sura", "mapfre"] }
        ]
      },
      {
        name: "Salud",
        type: "expense" as const,
        icon: "⚕️",
        color: "#EC4899",
        keywords: ["farmacia", "médico", "mutualista", "seguro", "salud"],
        subcategories: [
          { id: "sub-21", name: "Mutualista", keywords: ["mutualista", "médica uruguaya", "casmu", "mp"] },
          { id: "sub-22", name: "Farmacia", keywords: ["farmacia", "medicamento", "farmashop"] },
          { id: "sub-23", name: "Médicos", keywords: ["médico", "doctor", "consulta", "especialista"] },
          { id: "sub-24", name: "Seguros", keywords: ["seguro médico", "seguro salud"] }
        ]
      },
      {
        name: "Entretenimiento",
        type: "expense" as const,
        icon: "🎬",
        color: "#14B8A6",
        keywords: ["netflix", "spotify", "cine", "teatro", "entretenimiento", "ocio"],
        subcategories: [
          { id: "sub-25", name: "Streaming", keywords: ["netflix", "spotify", "disney", "hbo", "amazon prime"] },
          { id: "sub-26", name: "Cine", keywords: ["cine", "movie", "película"] },
          { id: "sub-27", name: "Eventos", keywords: ["teatro", "concierto", "show", "evento"] },
          { id: "sub-28", name: "Hobbies", keywords: ["hobby", "deporte", "gimnasio"] }
        ]
      },
      {
        name: "Educación",
        type: "expense" as const,
        icon: "📚",
        color: "#6366F1",
        keywords: ["curso", "libro", "universidad", "colegio", "educación", "estudio"],
        subcategories: [
          { id: "sub-29", name: "Cursos", keywords: ["curso", "capacitación", "udemy", "coursera"] },
          { id: "sub-30", name: "Libros", keywords: ["libro", "librería", "amazon"] },
          { id: "sub-31", name: "Matrícula", keywords: ["matrícula", "colegio", "universidad", "inscripción"] }
        ]
      },
      {
        name: "Compras",
        type: "expense" as const,
        icon: "🛍️",
        color: "#F97316",
        keywords: ["ropa", "zapatos", "mercadolibre", "compra", "shopping"],
        subcategories: [
          { id: "sub-32", name: "Ropa", keywords: ["ropa", "vestimenta", "zara", "h&m"] },
          { id: "sub-33", name: "Electrónica", keywords: ["electrónica", "celular", "computadora", "tecnología"] },
          { id: "sub-34", name: "Hogar", keywords: ["mueble", "decoración", "hogar", "casa"] },
          { id: "sub-35", name: "Otros", keywords: ["mercadolibre", "amazon", "compra"] }
        ]
      },
      {
        name: "Otros Gastos",
        type: "expense" as const,
        icon: "📦",
        color: "#64748B",
        keywords: ["otro", "varios", "misceláneo"],
        subcategories: [
          { id: "sub-36", name: "Varios", keywords: [] }
        ]
      },
      {
        name: "Transferencias Internas",
        type: "transfer" as const,
        icon: "🔄",
        color: "#9CA3AF",
        keywords: ["transferencia", "traspaso", "movimiento interno", "entre cuentas"],
        subcategories: [
          { id: "sub-37", name: "Entre cuentas propias", keywords: ["transferencia", "traspaso"] },
          { id: "sub-38", name: "Entre cuentas familiares", keywords: ["yosba", "yane", "familia"] }
        ]
      }
    ];
    
    for (const category of defaultCategories) {
      await createCategory(userId, category);
    }
  } catch (error) {
    console.error('Error al inicializar categorías predeterminadas:', error);
    throw error;
  }
};

/**
 * Agrega la categoría de Transferencias Internas si no existe
 */
export const ensureTransferCategory = async (userId: string): Promise<void> => {
  try {
    const categories = await getCategories(userId);
    const hasTransferCategory = categories.some(c => c.name === "Transferencias Internas");
    
    if (!hasTransferCategory) {
      await createCategory(userId, {
        name: "Transferencias Internas",
        type: "transfer",
        icon: "🔄",
        color: "#9CA3AF",
        keywords: ["transferencia", "traspaso", "movimiento interno", "entre cuentas"],
        subcategories: [
          { id: "sub-37", name: "Entre cuentas propias", keywords: ["transferencia", "traspaso"] },
          { id: "sub-38", name: "Entre cuentas familiares", keywords: ["yosba", "yane", "familia"] }
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
 * Agrega keywords a una categoría existente
 */
export const addKeywordsToCategory = async (
  userId: string,
  categoryId: string,
  newKeywords: string[]
): Promise<void> => {
  try {
    const category = await getCategoryById(userId, categoryId);
    if (!category) {
      throw new Error('Categoría no encontrada');
    }

    const existingKeywords = category.keywords || [];
    const uniqueKeywords = [...new Set([...existingKeywords, ...newKeywords])];

    await updateCategory(userId, categoryId, {
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
  userId: string,
  categoryId: string,
  subcategoryId: string,
  newKeywords: string[]
): Promise<void> => {
  try {
    const category = await getCategoryById(userId, categoryId);
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

    await updateCategory(userId, categoryId, {
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
  userId: string,
  categoryId: string,
  keywordsToRemove: string[]
): Promise<void> => {
  try {
    const category = await getCategoryById(userId, categoryId);
    if (!category) {
      throw new Error('Categoría no encontrada');
    }

    const updatedKeywords = category.keywords.filter(
      keyword => !keywordsToRemove.includes(keyword)
    );

    await updateCategory(userId, categoryId, {
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
  userId: string,
  categoryId: string,
  subcategoryId: string,
  keywordsToRemove: string[]
): Promise<void> => {
  try {
    const category = await getCategoryById(userId, categoryId);
    if (!category) {
      throw new Error('Categoría no encontrada');
    }

    const updatedSubcategories = category.subcategories.map(sub => {
      if (sub.id === subcategoryId) {
        return {
          ...sub,
          keywords: sub.keywords.filter(keyword => !keywordsToRemove.includes(keyword))
        };
      }
      return sub;
    });

    await updateCategory(userId, categoryId, {
      subcategories: updatedSubcategories
    });
  } catch (error) {
    console.error('Error al eliminar keywords de subcategoría:', error);
    throw error;
  }
};

// Made with Bob
