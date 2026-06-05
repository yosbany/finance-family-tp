import { useState, useEffect } from 'react';
import { getCategories, updateCategory, createCategory, deleteCategory, ensureTransferCategory } from '../../services/categories.service';
import { getTransactions } from '../../services/transactions.service';
import { Category, Transaction } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from '../common/LoadingSpinner';

export const CategoriesManagement = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editKeywords, setEditKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense',
    icon: '📦',
    color: '#64748B',
    keywords: [] as string[],
    subcategories: []
  });
  const [transactionCounts, setTransactionCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadCategories();
  }, [user]);

  const loadCategories = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Asegurar que existe la categoría de Transferencias Internas
      await ensureTransferCategory(user.uid);
      
      const data = await getCategories(user.uid);
      setCategories(data);

      // Cargar conteo de transacciones por categoría
      const transactions = await getTransactions(user.uid);
      const counts: Record<string, number> = {};
      data.forEach(cat => {
        counts[cat.id] = transactions.filter(t => t.category === cat.id).length;
      });
      setTransactionCounts(counts);
    } catch (err) {
      console.error('Error al cargar categorías:', err);
      setCategories([]);
      setTransactionCounts({});
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditIcon(category.icon);
    setEditColor(category.color);
    setEditKeywords(category.keywords || []);
  };

  const handleSave = async (categoryId: string) => {
    if (!user) return;

    try {
      const updates: Partial<Category> = {
        name: editName,
        icon: editIcon,
        color: editColor,
        keywords: editKeywords
      };

      await updateCategory(user.uid, categoryId, updates);
      await loadCategories();
      setEditingId(null);
      setNewKeyword('');
    } catch (err) {
      console.error('Error al actualizar categoría:', err);
      alert('Error al guardar los cambios');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditName('');
    setEditIcon('');
    setEditColor('');
    setEditKeywords([]);
    setNewKeyword('');
  };

  const handleAddKeyword = () => {
    const keyword = newKeyword.trim().toLowerCase();
    if (keyword && !editKeywords.includes(keyword)) {
      setEditKeywords([...editKeywords, keyword]);
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setEditKeywords(editKeywords.filter(k => k !== keyword));
  };

  const handleAdd = async () => {
    if (!user || !newCategory.name.trim()) return;

    try {
      await createCategory(user.uid, newCategory);
      await loadCategories();
      setShowAddForm(false);
      setNewCategory({
        name: '',
        type: 'expense',
        icon: '📦',
        color: '#64748B',
        keywords: [],
        subcategories: []
      });
    } catch (err) {
      console.error('Error al crear categoría:', err);
      alert('Error al crear la categoría');
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (!user) return;

    const count = transactionCounts[categoryId] || 0;
    if (count > 0) {
      alert(`No se puede eliminar esta categoría porque tiene ${count} transacciones asociadas.`);
      return;
    }

    if (!confirm('¿Estás seguro de que deseas eliminar esta categoría?')) {
      return;
    }

    try {
      await deleteCategory(user.uid, categoryId);
      await loadCategories();
    } catch (err) {
      console.error('Error al eliminar categoría:', err);
      alert('Error al eliminar la categoría');
    }
  };

  const getCategoryTypeLabel = (type: string) => {
    return type === 'income' ? 'Ingreso' : 'Gasto';
  };

  const getCategoryTypeColor = (type: string) => {
    return type === 'income' 
      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
  };

  // Calcular totales
  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Categorías
        </h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          {showAddForm ? '✕ Cancelar' : '+ Nueva Categoría'}
        </button>
      </div>

      {/* Formulario para agregar nueva categoría */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Nueva Categoría
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nombre
              </label>
              <input
                type="text"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Ej: Transporte"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipo
              </label>
              <select
                value={newCategory.type}
                onChange={(e) => setNewCategory({ ...newCategory, type: e.target.value as 'income' | 'expense' })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="expense">Gasto</option>
                <option value="income">Ingreso</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Icono (emoji)
              </label>
              <input
                type="text"
                value={newCategory.icon}
                onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="📦"
                maxLength={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Color
              </label>
              <input
                type="color"
                value={newCategory.color}
                onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                className="w-full h-10 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              disabled={!newCategory.name.trim()}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Crear Categoría
            </button>
          </div>
        </div>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              Categorías de Ingresos
            </span>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
              {incomeCategories.length}
            </span>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              Categorías de Gastos
            </span>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
              {expenseCategories.length}
            </span>
          </div>
        </div>
      </div>

      {/* Lista de categorías agrupadas por tipo */}
      <div className="space-y-6">
        {/* Categorías de Ingresos */}
        {incomeCategories.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="bg-green-50 dark:bg-green-900/20 px-6 py-3 border-b border-green-200 dark:border-green-800">
              <h2 className="text-lg font-semibold text-green-900 dark:text-green-400">
                💰 Ingresos
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {incomeCategories.map((category) => (
                <div key={category.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  {editingId === category.id ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Nombre
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Icono
                          </label>
                          <input
                            type="text"
                            value={editIcon}
                            onChange={(e) => setEditIcon(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            maxLength={2}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Color
                          </label>
                          <input
                            type="color"
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            className="w-full h-10 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                          />
                        </div>
                      </div>
                      
                      {/* Editor de Keywords */}
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          🔍 Palabras clave para categorización automática
                        </label>
                        <div className="flex gap-2 mb-3">
                          <input
                            type="text"
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
                            placeholder="Agregar palabra clave..."
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                          <button
                            onClick={handleAddKeyword}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                          >
                            + Agregar
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {editKeywords.map((keyword, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                            >
                              {keyword}
                              <button
                                onClick={() => handleRemoveKeyword(keyword)}
                                className="ml-1 hover:text-purple-900 dark:hover:text-purple-100"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          {editKeywords.length === 0 && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                              No hay palabras clave. Agrega algunas para categorización automática.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 mt-4">
                        <button
                          onClick={handleCancel}
                          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleSave(category.id)}
                          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{category.icon}</span>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {category.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryTypeColor(category.type)}`}>
                                {getCategoryTypeLabel(category.type)}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {transactionCounts[category.id] || 0} transacciones
                              </span>
                              {category.subcategories && category.subcategories.length > 0 && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  • {category.subcategories.length} subcategorías
                                </span>
                              )}
                            </div>
                            <div
                              className="mt-2 w-16 h-1 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(category)}
                            className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => handleDelete(category.id)}
                            className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            disabled={transactionCounts[category.id] > 0}
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </div>
                      
                      {/* Keywords de categorización automática */}
                      {category.keywords && category.keywords.length > 0 && (
                        <div className="mt-4 pl-12">
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                            🔍 Palabras clave para categorización automática:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {category.keywords.map((keyword, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Categorías de Gastos */}
        {expenseCategories.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="bg-red-50 dark:bg-red-900/20 px-6 py-3 border-b border-red-200 dark:border-red-800">
              <h2 className="text-lg font-semibold text-red-900 dark:text-red-400">
                💸 Gastos
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {expenseCategories.map((category) => (
                <div key={category.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  {editingId === category.id ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Nombre
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Icono
                          </label>
                          <input
                            type="text"
                            value={editIcon}
                            onChange={(e) => setEditIcon(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            maxLength={2}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Color
                          </label>
                          <input
                            type="color"
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            className="w-full h-10 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                          />
                        </div>
                      </div>
                      
                      {/* Editor de Keywords */}
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          🔍 Palabras clave para categorización automática
                        </label>
                        <div className="flex gap-2 mb-3">
                          <input
                            type="text"
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
                            placeholder="Agregar palabra clave..."
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                          <button
                            onClick={handleAddKeyword}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                          >
                            + Agregar
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {editKeywords.map((keyword, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                            >
                              {keyword}
                              <button
                                onClick={() => handleRemoveKeyword(keyword)}
                                className="ml-1 hover:text-purple-900 dark:hover:text-purple-100"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          {editKeywords.length === 0 && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                              No hay palabras clave. Agrega algunas para categorización automática.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 mt-4">
                        <button
                          onClick={handleCancel}
                          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleSave(category.id)}
                          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{category.icon}</span>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {category.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryTypeColor(category.type)}`}>
                                {getCategoryTypeLabel(category.type)}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {transactionCounts[category.id] || 0} transacciones
                              </span>
                              {category.subcategories && category.subcategories.length > 0 && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  • {category.subcategories.length} subcategorías
                                </span>
                              )}
                            </div>
                            <div
                              className="mt-2 w-16 h-1 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(category)}
                            className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => handleDelete(category.id)}
                            className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            disabled={transactionCounts[category.id] > 0}
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </div>
                      
                      {/* Keywords de categorización automática */}
                      {category.keywords && category.keywords.length > 0 && (
                        <div className="mt-4 pl-12">
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                            🔍 Palabras clave para categorización automática:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {category.keywords.map((keyword, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Estado vacío */}
      {categories.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No hay categorías registradas
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Crear Primera Categoría
          </button>
        </div>
      )}
    </div>
  );
};

// Made with Bob