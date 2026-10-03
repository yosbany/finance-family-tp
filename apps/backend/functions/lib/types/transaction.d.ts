/**
 * Transaction Type (Backend)
 *
 * Réplica del tipo Transaction del frontend.
 * Se mantiene separada para independencia del bundle del navegador.
 */
export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'pending' | 'classified' | 'verified';
export type Currency = 'UYU' | 'USD';
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
    isInternalTransfer?: boolean;
    linkedTransactionId?: string;
    transferToAccountId?: string;
}
