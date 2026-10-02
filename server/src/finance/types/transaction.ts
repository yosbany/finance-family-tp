/**
 * Transaction Type Definition
 * 
 * Shared between backend and frontend.
 * Represents a financial transaction in the Realtime Database.
 */

export interface Transaction {
  id: string;
  accountId: string;
  date: number; // Timestamp in milliseconds
  description: string;
  amount: number; // Can be positive or negative
  currency: 'UYU' | 'USD';
  type: 'income' | 'expense' | 'transfer';
  category?: string;
  status: 'pending' | 'classified' | 'verified';
  owner?: string; // Optional owner/member ID
  notes?: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionCurrency = 'UYU' | 'USD';
export type TransactionStatus = 'pending' | 'classified' | 'verified';
