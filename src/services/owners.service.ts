import { ref, set, get, push, remove } from 'firebase/database';
import { database } from './firebase';

export interface Owner {
  id: string;
  name: string;
  isCore: boolean; // true para "Núcleo", no se puede eliminar
  color: string; // Color para badges
  createdAt: number;
}

export const getOwners = async (userId: string): Promise<Owner[]> => {
  try {
    const ownersRef = ref(database, `owners/${userId}`);
    const snapshot = await get(ownersRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    const ownersData = snapshot.val();
    return Object.values(ownersData) as Owner[];
  } catch (error) {
    console.error('Error al obtener propietarios:', error);
    throw error;
  }
};

export const createOwner = async (userId: string, owner: Omit<Owner, 'id'>): Promise<string> => {
  try {
    const ownersRef = ref(database, `owners/${userId}`);
    const newOwnerRef = push(ownersRef);
    const ownerId = newOwnerRef.key!;
    
    const ownerData: Owner = {
      ...owner,
      id: ownerId
    };
    
    await set(newOwnerRef, ownerData);
    return ownerId;
  } catch (error) {
    console.error('Error al crear propietario:', error);
    throw error;
  }
};

export const deleteOwner = async (userId: string, ownerId: string): Promise<void> => {
  try {
    // Verificar que no sea el propietario "Núcleo"
    const owners = await getOwners(userId);
    const owner = owners.find(o => o.id === ownerId);
    
    if (owner?.isCore) {
      throw new Error('No se puede eliminar el propietario Núcleo');
    }
    
    const ownerRef = ref(database, `owners/${userId}/${ownerId}`);
    await remove(ownerRef);
  } catch (error) {
    console.error('Error al eliminar propietario:', error);
    throw error;
  }
};

export const initializeDefaultOwners = async (userId: string): Promise<void> => {
  try {
    const defaultOwners: Omit<Owner, 'id'>[] = [
      { 
        name: 'Núcleo', 
        isCore: true, 
        color: 'purple',
        createdAt: Date.now() 
      },
      { 
        name: 'Yosba', 
        isCore: false, 
        color: 'blue',
        createdAt: Date.now() 
      },
      { 
        name: 'Yane', 
        isCore: false, 
        color: 'pink',
        createdAt: Date.now() 
      }
    ];
    
    for (const owner of defaultOwners) {
      await createOwner(userId, owner);
    }
  } catch (error) {
    console.error('Error al inicializar propietarios predeterminados:', error);
    throw error;
  }
};

// Migrar cuentas existentes de "Ambos" a "Núcleo"
export const migrateAmbosToNucleo = async (userId: string): Promise<number> => {
  try {
    const accountsRef = ref(database, `accounts/${userId}`);
    const snapshot = await get(accountsRef);
    
    if (!snapshot.exists()) {
      return 0;
    }
    
    const accounts = snapshot.val();
    let migratedCount = 0;
    
    for (const [accountId, account] of Object.entries(accounts)) {
      const acc = account as any;
      if (acc.owner === 'Ambos') {
        const accountRef = ref(database, `accounts/${userId}/${accountId}`);
        await set(accountRef, { ...acc, owner: 'Núcleo' });
        migratedCount++;
      }
    }
    
    return migratedCount;
  } catch (error) {
    console.error('Error al migrar cuentas de Ambos a Núcleo:', error);
    throw error;
  }
};

// Made with Bob