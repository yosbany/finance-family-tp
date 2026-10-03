/**
 * Calcula el hash SHA-256 de un archivo usando Web Crypto API
 * Este hash se usa para detectar archivos duplicados
 */
export const calculateFileHash = async (file: File): Promise<string> => {
  try {
    // Leer el archivo como ArrayBuffer
    const buffer = await file.arrayBuffer();
    
    // Calcular hash SHA-256
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    
    // Convertir el hash a string hexadecimal
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  } catch (error) {
    console.error('Error al calcular hash del archivo:', error);
    throw new Error('No se pudo calcular el hash del archivo');
  }
};

/**
 * Verifica si un archivo ya fue cargado anteriormente comparando su hash
 */
export const isDuplicateFile = async (
  fileHash: string,
  uploadHistory: any[]
): Promise<boolean> => {
  return uploadHistory.some(upload => upload.fileHash === fileHash);
};

// Made with Bob
