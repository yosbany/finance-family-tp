import { ref, set, get, push, remove } from 'firebase/database';
import { database } from './firebase';
import { familyPath } from './familyPaths';

export interface Owner {
  id: string;
  name: string;
  isCore: boolean;
  color: string;
  createdAt: number;
}

export const getOwners = async (): Promise<Owner[]> => {
  try {
    const ownersRef = ref(database, familyPath('owners'));
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

export const createOwner = async (owner: Omit<Owner, 'id'>): Promise<string> => {
  try {
    const ownersRef = ref(database, familyPath('owners'));
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

export const deleteOwner = async (ownerId: string): Promise<void> => {
  try {
    const owners = await getOwners();
    const owner = owners.find(o => o.id === ownerId);

    if (owner?.isCore) {
      throw new Error('No se puede eliminar el propietario Núcleo');
    }

    const ownerRef = ref(database, familyPath('owners', ownerId));
    await remove(ownerRef);
  } catch (error) {
    console.error('Error al eliminar propietario:', error);
    throw error;
  }
};

export const initializeDefaultOwners = async (): Promise<void> => {
  try {
    const defaultOwners: Omit<Owner, 'id'>[] = [
      { name: 'Núcleo', isCore: true, color: 'purple', createdAt: Date.now() },
      { name: 'Yosba', isCore: false, color: 'blue', createdAt: Date.now() },
      { name: 'Yane', isCore: false, color: 'pink', createdAt: Date.now() }
    ];

    for (const owner of defaultOwners) {
      await createOwner(owner);
    }
  } catch (error) {
    console.error('Error al inicializar propietarios predeterminados:', error);
    throw error;
  }
};

export const migrateAmbosToNucleo = async (): Promise<number> => {
  try {
    const accountsRef = ref(database, familyPath('accounts'));
    const snapshot = await get(accountsRef);

    if (!snapshot.exists()) {
      return 0;
    }

    const accounts = snapshot.val();
    let migratedCount = 0;

    for (const [accountId, account] of Object.entries(accounts)) {
      const acc = account as { owner: string };
      if (acc.owner === 'Ambos') {
        const accountRef = ref(database, familyPath('accounts', accountId));
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
