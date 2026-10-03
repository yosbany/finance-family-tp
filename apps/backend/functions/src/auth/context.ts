/**
 * AuthenticatedContext
 * 
 * Representa el contexto de seguridad de una solicitud autenticada.
 * El uid se OBTIENE EXCLUSIVAMENTE del token Firebase verificado.
 * 
 * Nunca debe ser construido desde argumentos de cliente.
 */
export interface AuthenticatedContext {
  uid: string;
}

/**
 * Verifica un Firebase ID Token y construye el contexto autenticado.
 * 
 * CRÍTICO: Este es el punto de control de seguridad único.
 * El uid se obtiene del token verificado, nunca de argumentos.
 */
export async function verifyIdToken(token: string): Promise<AuthenticatedContext> {
  const admin = await import('firebase-admin');
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return {
      uid: decodedToken.uid
    };
  } catch (error) {
    console.error('Error verifying ID token:', error);
    throw new Error('UNAUTHENTICATED: Invalid or expired token');
  }
}
