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
export declare function verifyIdToken(token: string): Promise<AuthenticatedContext>;
