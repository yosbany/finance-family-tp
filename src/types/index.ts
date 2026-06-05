export type AccountType = 'debit' | 'credit' | 'investment';
export type Currency = 'UYU' | 'USD';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'pending' | 'classified' | 'verified';
export type AssetType = 'property' | 'vehicle' | 'investment' | 'other';
export type GoalStatus = 'active' | 'completed' | 'cancelled';
export type UploadStatus = 'processed' | 'error';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: number;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  bank: string;
  owner: string; // Ahora es string dinámico en lugar de tipo fijo
  balance: number;
  initialBalance: number; // Balance inicial de la cuenta
  creditLimit?: number;
  lastSync: number;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: number;
  description: string;
  amount: number;
  currency: Currency;
  type: TransactionType;
  category?: string;
  subcategory?: string;
  isRecurring: boolean;
  notes: string;
  status: TransactionStatus;
  uploadId?: string;
  createdAt: number;
  // Para transferencias internas
  isInternalTransfer?: boolean;
  linkedTransactionId?: string; // ID de la transacción relacionada en la otra cuenta
  transferToAccountId?: string; // Cuenta destino (si es salida) o origen (si es entrada)
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
  keywords: string[];
  subcategories: Subcategory[];
}

export interface Subcategory {
  id: string;
  name: string;
  keywords: string[];
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  value: number;
  currency: Currency;
  purchaseDate: number;
  description: string;
  location: string;
  images: string[];
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: Currency;
  deadline: number;
  status: GoalStatus;
  createdAt: number;
}

export interface Rule {
  id: string;
  keyword: string;
  categoryId: string;
  subcategoryId?: string;
  priority: number;
}

export interface UploadHistory {
  id: string;
  fileName: string;
  fileHash: string;
  uploadedBy: string;
  uploadDate: number;
  accountId: string;
  transactionsCount: number;
  status: UploadStatus;
  errorMessage?: string;
  statementMonth: number; // 1-12
  statementYear: number; // e.g., 2024
}

export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number;
  currency: Currency;
  type: TransactionType;
}

export interface KPIData {
  totalBalanceUYU: number;
  totalBalanceUSD: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  totalDebt: number;
  netWorth: number;
}

// Made with Bob
