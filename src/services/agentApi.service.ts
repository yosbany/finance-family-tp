/**
 * Agent API Service
 * 
 * Cliente para comunicarse con el servicio backend REST.
 * 
 * ARQUITECTURA:
 * - React obtiene ID Token del usuario autenticado
 * - Envía ID Token en Authorization header (Bearer token)
 * - Server verifica token y extrae uid desde Firebase Admin
 * - Server ejecuta herramientas con uid del contexto verificado
 * - Retorna resultado sanitizado (sin identidades, paths, credenciales)
 * 
 * SEGURIDAD:
 * - El token se obtiene de Firebase Auth (verificado en cliente)
 * - El servidor lo verifica nuevamente con Firebase Admin SDK
 * - Nunca se envía uid desde el cliente (extraído del token en servidor)
 * - El servidor es la única fuente de verdad para identidad
 * - Todos los parámetros validados en servidor
 */

import { auth } from './firebase';

// URL del backend REST
// En desarrollo: http://localhost:3001
// En producción: https://service.nrdonline.site
const AGENT_API_BASE_URL = process.env.VITE_FINANCE_API_URL || 'http://127.0.0.1:3001';

export interface SearchTransactionsParams {
  from?: number;
  to?: number;
  accountId?: string;
  categoryId?: string;
  type?: 'income' | 'expense' | 'transfer';
  currency?: 'UYU' | 'USD';
  description?: string;
  minAmount?: number;
  maxAmount?: number;
  status?: 'pending' | 'classified' | 'verified';
  limit?: number;
  offset?: number;
}

export interface SearchTransactionsResult {
  transactions: Array<{
    id: string;
    accountId: string;
    date: number;
    description: string;
    amount: number;
    currency: string;
    type: string;
    category?: string;
    status: string;
  }>;
  pagination: {
    total: number;
    matched: number;
    offset: number;
    limit: number;
    truncated: boolean;
  };
}

/**
 * Obtiene el ID Token del usuario autenticado.
 */
async function getIdToken(): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User not authenticated');
  }
  
  const token = await currentUser.getIdToken(true);
  return token;
}

/**
 * Llama al endpoint POST /api/tools/search-transactions del servidor.
 * 
 * Flujo:
 * 1. Obtiene ID Token del usuario autenticado en Firebase
 * 2. Envía parámetros de búsqueda (sin UID)
 * 3. Servidor verifica token y extrae UID
 * 4. Servidor valida parámetros (rechaza injection attempts)
 * 5. Servidor ejecuta búsqueda con UID del contexto verificado
 * 6. Retorna resultado sanitizado
 */
export async function callSearchTransactions(
  params: SearchTransactionsParams
): Promise<SearchTransactionsResult> {
  try {
    const idToken = await getIdToken();
    
    // HTTP POST /api/tools/search-transactions
    // Content: JSON con parámetros de búsqueda (SIN uid/familyId/firebasePath)
    // Auth: Bearer token in Authorization header
    const response = await fetch(
      `${AGENT_API_BASE_URL}/api/tools/search-transactions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(params)
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.message || 
                          errorData.error || 
                          `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }
    
    // Respuesta: {transactions: [...], pagination: {...}}
    const result = await response.json();
    return result as SearchTransactionsResult;
  } catch (error) {
    console.error('Error calling searchTransactions:', error);
    throw error;
  }
}

/**
 * Health check del servidor.
 */
export async function checkAgentApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${AGENT_API_BASE_URL}/health`, {
      method: 'GET'
    });
    
    return response.ok;
  } catch (error) {
    console.error('Agent API health check failed:', error);
    return false;
  }
}

// Made with Bob
