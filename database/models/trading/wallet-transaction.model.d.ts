import { Document } from 'mongoose';
export interface IWalletTransaction extends Document {
    userId: string;
    transactionType: 'deposit' | 'withdrawal' | 'withdrawal_fee' | 'competition_entry' | 'competition_win' | 'competition_refund' | 'challenge_entry' | 'challenge_win' | 'challenge_refund' | 'platform_fee' | 'admin_adjustment' | 'marketplace_purchase';
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    currency: string;
    exchangeRate: number;
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    paymentMethod?: string;
    paymentId?: string;
    paymentIntentId?: string;
    competitionId?: string;
    description: string;
    metadata?: Record<string, any>;
    failureReason?: string;
    processedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
declare const WalletTransaction: import("mongoose").Model<any, {}, {}, {}, any, any>;
export default WalletTransaction;
//# sourceMappingURL=wallet-transaction.model.d.ts.map