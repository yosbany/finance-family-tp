import { useState, useEffect } from 'react';
import {
  getAssets,
  createAsset,
  updateAsset,
  deleteAsset
} from '../../services/assets.service';
import { Asset, AssetType, Currency } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from '../common/LoadingSpinner';

export const AssetManagement = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'property' as AssetType,
    value: 0,
    currency: 'USD' as Currency,
    purchaseDate: new Date().toISOString().split('T')[0],
    description: '',
    location: ''
  });

  useEffect(() => {
    loadAssets();
  }, [user]);

  const loadAssets = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getAssets(user.uid);
      setAssets(data);
    } catch (err) {
      console.error('Error al cargar activos:', err);
      setAssets([]); // Asegurar que assets esté vacío en caso de error
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const assetData = {
        ...formData,
        purchaseDate: new Date(formData.purchaseDate).getTime(),
        images: []
      };

      if (editingId) {
        await updateAsset(user.uid, editingId, assetData);
      } else {
        await createAsset(user.uid, assetData);
      }

      await loadAssets();
      resetForm();
    } catch (err) {
      console.error('Error al guardar activo:', err);
      alert('Error al guardar el activo');
    }
  };

  const handleEdit = (asset: Asset) => {
    setEditingId(asset.id);
    setFormData({
      name: asset.name,
      type: asset.type,
      value: asset.value,
      currency: asset.currency,
      purchaseDate: new Date(asset.purchaseDate).toISOString().split('T')[0],
      description: asset.description,
      location: asset.location
    });
    setShowForm(true);
  };

  const handleDelete = async (assetId: string) => {
    if (!user) return;
    if (!confirm('¿Estás seguro de eliminar este activo?')) return;

    try {
      await deleteAsset(user.uid, assetId);
      await loadAssets();
    } catch (err) {
      console.error('Error al eliminar activo:', err);
      alert('Error al eliminar el activo');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'property',
      value: 0,
      currency: 'USD',
      purchaseDate: new Date().toISOString().split('T')[0],
      description: '',
      location: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const formatCurrency = (value: number, currency: Currency) => {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency
    }).format(value);
  };

  const getAssetTypeLabel = (type: AssetType) => {
    const labels = {
      property: 'Propiedad',
      vehicle: 'Vehículo',
      investment: 'Inversión',
      other: 'Otro'
    };
    return labels[type];
  };

  const getAssetTypeIcon = (type: AssetType) => {
    const icons = {
      property: '🏠',
      vehicle: '🚗',
      investment: '📈',
      other: '📦'
    };
    return icons[type];
  };

  // Calcular totales
  const totalUYU = assets
    .filter(a => a.currency === 'UYU')
    .reduce((sum, a) => sum + a.value, 0);
  
  const totalUSD = assets
    .filter(a => a.currency === 'USD')
    .reduce((sum, a) => sum + a.value, 0);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Gestión de Patrimonio
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          + Agregar Activo
        </button>
      </div>

      {/* Resumen de patrimonio */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total en Pesos</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(totalUYU, 'UYU')}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total en Dólares</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(totalUSD, 'USD')}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total de Activos</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {assets.length}
          </div>
        </div>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            {editingId ? 'Editar Activo' : 'Nuevo Activo'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Ej: Casa en Montevideo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo *
                </label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as AssetType })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="property">Propiedad</option>
                  <option value="vehicle">Vehículo</option>
                  <option value="investment">Inversión</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Valor *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Moneda *
                </label>
                <select
                  required
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value as Currency })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="UYU">Pesos (UYU)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fecha de Adquisición *
                </label>
                <input
                  type="date"
                  required
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ubicación
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Ej: Montevideo, Uruguay"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Descripción
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Detalles adicionales del activo..."
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                {editingId ? 'Actualizar' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de activos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assets.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">🏠</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No hay activos registrados
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Comienza a registrar tu patrimonio: propiedades, vehículos, inversiones y más
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              + Agregar Primer Activo
            </button>
          </div>
        ) : (
          assets.map((asset) => (
            <div
              key={asset.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getAssetTypeIcon(asset.type)}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {asset.name}
                    </h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {getAssetTypeLabel(asset.type)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Valor:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(asset.value, asset.currency)}
                  </span>
                </div>
                {asset.location && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Ubicación:</span>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {asset.location}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Adquisición:</span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {new Date(asset.purchaseDate).toLocaleDateString('es-UY')}
                  </span>
                </div>
              </div>

              {asset.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {asset.description}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(asset)}
                  className="flex-1 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(asset.id)}
                  className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Made with Bob
