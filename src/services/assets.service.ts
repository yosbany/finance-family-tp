import { ref, push, set, get, update, remove } from 'firebase/database';
import { database } from './firebase';
import { Asset } from '../types';

export const createAsset = async (userId: string, asset: Omit<Asset, 'id'>): Promise<string> => {
  try {
    const assetsRef = ref(database, `assets/${userId}`);
    const newAssetRef = push(assetsRef);
    const assetId = newAssetRef.key!;
    
    const assetData: Asset = {
      ...asset,
      id: assetId
    };
    
    await set(newAssetRef, assetData);
    return assetId;
  } catch (error) {
    console.error('Error al crear activo:', error);
    throw error;
  }
};

export const getAssets = async (userId: string): Promise<Asset[]> => {
  try {
    const assetsRef = ref(database, `assets/${userId}`);
    const snapshot = await get(assetsRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    const assetsData = snapshot.val();
    return Object.values(assetsData) as Asset[];
  } catch (error) {
    console.error('Error al obtener activos:', error);
    throw error;
  }
};

export const getAssetById = async (userId: string, assetId: string): Promise<Asset | null> => {
  try {
    const assetRef = ref(database, `assets/${userId}/${assetId}`);
    const snapshot = await get(assetRef);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    return snapshot.val() as Asset;
  } catch (error) {
    console.error('Error al obtener activo:', error);
    throw error;
  }
};

export const updateAsset = async (
  userId: string,
  assetId: string,
  updates: Partial<Asset>
): Promise<void> => {
  try {
    const assetRef = ref(database, `assets/${userId}/${assetId}`);
    await update(assetRef, updates);
  } catch (error) {
    console.error('Error al actualizar activo:', error);
    throw error;
  }
};

export const deleteAsset = async (userId: string, assetId: string): Promise<void> => {
  try {
    const assetRef = ref(database, `assets/${userId}/${assetId}`);
    await remove(assetRef);
  } catch (error) {
    console.error('Error al eliminar activo:', error);
    throw error;
  }
};

export const getTotalAssetValue = async (userId: string, currency: 'UYU' | 'USD'): Promise<number> => {
  try {
    const assets = await getAssets(userId);
    return assets
      .filter(asset => asset.currency === currency)
      .reduce((total, asset) => total + asset.value, 0);
  } catch (error) {
    console.error('Error al calcular valor total de activos:', error);
    throw error;
  }
};

// Inicializar activos predeterminados
export const initializeDefaultAssets = async (userId: string): Promise<void> => {
  try {
    const defaultAssets = [
      {
        name: "Casa en La Habana",
        type: "property" as const,
        value: 0,
        currency: "USD" as const,
        purchaseDate: Date.now(),
        description: "Propiedad familiar en La Habana, Cuba",
        location: "La Habana, Cuba",
        images: []
      },
      {
        name: "Automóvil",
        type: "vehicle" as const,
        value: 0,
        currency: "USD" as const,
        purchaseDate: Date.now(),
        description: "Vehículo familiar",
        location: "Uruguay",
        images: []
      }
    ];
    
    for (const asset of defaultAssets) {
      await createAsset(userId, asset);
    }
  } catch (error) {
    console.error('Error al inicializar activos predeterminados:', error);
    throw error;
  }
};

// Made with Bob