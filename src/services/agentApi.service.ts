/**
 * Agent API Service
 * 
 * Cliente para comunicarse con el servidor agent API (Cloud Functions).
 * 
 * ARQUITECTURA:
 * - React obtiene ID Token del usuario autenticado
 * - Envía ID Token en Authorization header
 * - Server verifica token y extrae uid
 * - Server ejecuta herramientas con uid verificado
 * - Retorna resultado sanitizado
 * 
 * SEGURIDAD:
 * - El token se obtiene de Firebase Auth (verificado)
 * - Nunca se envía uid desde el cliente
 * - El servidor es la única fuente de verdad para identidad
 */

import { auth } from './firebase';

// IMPORTANTE: Cambiar a URL de functions reales en producción
const AGENT_API_BASE_URL = process.env.VITE_AGENT_API_URL || 'http://localhost:5001/finance-family-tp/us-east1';

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
 * Llama al endpoint searchTransactions del servidor.
 */
export async function callSearchTransactions(
  params: SearchTransactionsParams
): Promise<SearchTransactionsResult> {
  try {
    const idToken = await getIdToken();
    
    const response = await fetch(
      `${AGENT_API_BASE_URL}/searchTransactionsEndpoint`,
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
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to search transactions');
    }
    
    const result = await response.json();
    return result.result as SearchTransactionsResult;
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
