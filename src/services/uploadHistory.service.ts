import { ref, push, set, get, update, remove } from 'firebase/database';
import { database } from './firebase';
import { familyPath } from './familyPaths';
import { UploadHistory } from '../types';

export const createUploadHistory = async (
  uploadData: Omit<UploadHistory, 'id'>
): Promise<string> => {
  try {
    const uploadsRef = ref(database, familyPath('uploadHistory'));
    const newUploadRef = push(uploadsRef);
    const uploadId = newUploadRef.key!;

    const historyData: UploadHistory = {
      ...uploadData,
      id: uploadId
    };

    await set(newUploadRef, historyData);
    return uploadId;
  } catch (error) {
    console.error('Error al crear historial de carga:', error);
    throw error;
  }
};

export const getUploadHistory = async (): Promise<UploadHistory[]> => {
  try {
    const uploadsRef = ref(database, familyPath('uploadHistory'));
    const snapshot = await get(uploadsRef);

    if (!snapshot.exists()) {
      return [];
    }

    const uploadsData = snapshot.val();
    const uploads = Object.values(uploadsData) as UploadHistory[];

    return uploads.sort((a, b) => b.uploadDate - a.uploadDate);
  } catch (error) {
    console.error('Error al obtener historial de cargas:', error);
    throw error;
  }
};

export const checkDuplicateUpload = async (fileHash: string): Promise<boolean> => {
  try {
    const uploadsRef = ref(database, familyPath('uploadHistory'));
    const snapshot = await get(uploadsRef);

    if (!snapshot.exists()) {
      return false;
    }

    const uploadsData = snapshot.val();
    const uploads = Object.values(uploadsData) as UploadHistory[];

    return uploads.some(upload => upload.fileHash === fileHash);
  } catch (error) {
    console.error('Error al verificar duplicado:', error);
    throw error;
  }
};

export const getUploadsByAccount = async (accountId: string): Promise<UploadHistory[]> => {
  try {
    const uploadsRef = ref(database, familyPath('uploadHistory'));
    const snapshot = await get(uploadsRef);

    if (!snapshot.exists()) {
      return [];
    }

    const uploadsData = snapshot.val();
    const uploads = Object.values(uploadsData) as UploadHistory[];

    return uploads
      .filter(upload => upload.accountId === accountId)
      .sort((a, b) => b.uploadDate - a.uploadDate);
  } catch (error) {
    console.error('Error al obtener cargas por cuenta:', error);
    throw error;
  }
};

export const getUploadById = async (uploadId: string): Promise<UploadHistory | null> => {
  try {
    const uploadRef = ref(database, familyPath('uploadHistory', uploadId));
    const snapshot = await get(uploadRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.val() as UploadHistory;
  } catch (error) {
    console.error('Error al obtener carga:', error);
    throw error;
  }
};

export const migrateOldUploads = async (): Promise<number> => {
  try {
    const uploadsRef = ref(database, familyPath('uploadHistory'));
    const snapshot = await get(uploadsRef);

    if (!snapshot.exists()) {
      return 0;
    }

    const uploadsData = snapshot.val();
    let migratedCount = 0;

    for (const [uploadId, upload] of Object.entries(uploadsData)) {
      const uploadRecord = upload as UploadHistory;

      if (!uploadRecord.statementMonth || !uploadRecord.statementYear) {
        const uploadRef = ref(database, familyPath('uploadHistory', uploadId));
        await update(uploadRef, {
          statementMonth: 6,
          statementYear: 2026
        });
        migratedCount++;
      }
    }

    return migratedCount;
  } catch (error) {
    console.error('Error al migrar cargas antiguas:', error);
    throw error;
  }
};

export const getUploadForAccountPeriod = async (
  accountId: string,
  month: number,
  year: number
): Promise<UploadHistory | null> => {
  const history = await getUploadHistory();
  return history.find(
    u => u.accountId === accountId && u.statementMonth === month && u.statementYear === year
  ) ?? null;
};

export const markAccountNoMovements = async (
  accountId: string,
  month: number,
  year: number,
  uploadedBy: string
): Promise<string> => {
  const existing = await getUploadForAccountPeriod(accountId, month, year);
  if (existing) {
    throw new Error('Este período ya está registrado para esta cuenta');
  }

  return createUploadHistory({
    fileName: 'Sin movimientos',
    fileHash: `no-movements:${accountId}:${year}-${String(month).padStart(2, '0')}`,
    uploadedBy,
    uploadDate: Date.now(),
    accountId,
    transactionsCount: 0,
    status: 'no_movements',
    statementMonth: month,
    statementYear: year
  });
};

export const deleteUploadHistory = async (uploadId: string): Promise<void> => {
  try {
    const uploadRef = ref(database, familyPath('uploadHistory', uploadId));
    await remove(uploadRef);
  } catch (error) {
    console.error('Error al eliminar registro de carga:', error);
    throw error;
  }
};

export const deleteUploadHistoryByFilter = async (filter: {
  accountId?: string;
  month?: number;
  year?: number;
}): Promise<number> => {
  const history = await getUploadHistory();
  const toDelete = history.filter(upload => {
    if (filter.accountId && upload.accountId !== filter.accountId) return false;
    if (filter.month !== undefined && upload.statementMonth !== filter.month) return false;
    if (filter.year !== undefined && upload.statementYear !== filter.year) return false;
    return true;
  });

  for (const upload of toDelete) {
    await deleteUploadHistory(upload.id);
  }

  return toDelete.length;
};

export const deleteAllUploadHistory = async (): Promise<number> => {
  const uploadsRef = ref(database, familyPath('uploadHistory'));
  const snapshot = await get(uploadsRef);
  if (!snapshot.exists()) return 0;

  const count = Object.keys(snapshot.val()).length;
  await remove(uploadsRef);
  return count;
};
