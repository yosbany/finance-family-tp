import { ref, push, set, get, query, orderByChild, equalTo, update } from 'firebase/database';
import { database } from './firebase';
import { UploadHistory } from '../types';

export const createUploadHistory = async (
  userId: string,
  uploadData: Omit<UploadHistory, 'id'>
): Promise<string> => {
  try {
    const uploadsRef = ref(database, `uploadHistory/${userId}`);
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

export const getUploadHistory = async (userId: string): Promise<UploadHistory[]> => {
  try {
    const uploadsRef = ref(database, `uploadHistory/${userId}`);
    const snapshot = await get(uploadsRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    const uploadsData = snapshot.val();
    const uploads = Object.values(uploadsData) as UploadHistory[];
    
    // Ordenar por fecha de carga (más reciente primero)
    return uploads.sort((a, b) => b.uploadDate - a.uploadDate);
  } catch (error) {
    console.error('Error al obtener historial de cargas:', error);
    throw error;
  }
};

export const checkDuplicateUpload = async (
  userId: string,
  fileHash: string
): Promise<boolean> => {
  try {
    const uploadsRef = ref(database, `uploadHistory/${userId}`);
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

export const getUploadsByAccount = async (
  userId: string,
  accountId: string
): Promise<UploadHistory[]> => {
  try {
    const uploadsRef = ref(database, `uploadHistory/${userId}`);
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

export const getUploadById = async (
  userId: string,
  uploadId: string
): Promise<UploadHistory | null> => {
  try {
    const uploadRef = ref(database, `uploadHistory/${userId}/${uploadId}`);
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

/**
 * Migra registros antiguos sin statementMonth/statementYear
 * Asigna Junio 2026 (6/2026) a todos los registros sin fecha
 */
export const migrateOldUploads = async (userId: string): Promise<number> => {
  try {
    const uploadsRef = ref(database, `uploadHistory/${userId}`);
    const snapshot = await get(uploadsRef);
    
    if (!snapshot.exists()) {
      return 0;
    }
    
    const uploadsData = snapshot.val();
    let migratedCount = 0;
    
    for (const [uploadId, upload] of Object.entries(uploadsData)) {
      const uploadRecord = upload as any;
      
      // Si no tiene statementMonth o statementYear, actualizar
      if (!uploadRecord.statementMonth || !uploadRecord.statementYear) {
        const uploadRef = ref(database, `uploadHistory/${userId}/${uploadId}`);
        await update(uploadRef, {
          statementMonth: 6,  // Junio
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

// Made with Bob
