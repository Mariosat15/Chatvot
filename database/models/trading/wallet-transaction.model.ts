import { Schema, model, models, Document } from 'mongoose';

// Track all credit wallet transactions
export interface IWalletTransaction extends Document {
  userId: string; // Reference to Better Auth user ID
  transactionType:
    | 'deposit' // User deposits EUR → gets credits
    | 'withdrawal' // User withdraws credits → gets EUR
    | 'withdrawal_fee' // Fee charged on withdrawal
    | 'competition_entry' // User enters competition (deduct credits)
    | 'competition_win' // User wins competition (add credits)
    | 'competition_refund' // Competition cancelled (refund entry fee)
    | 'challenge_entry' // User enters 1v1 challenge (deduct credits)
    | 'challenge_win' // User wins 1v1 challenge (add credits)
    | 'challenge_refund' // Challenge cancelled/declined (refund entry fee)
    | 'platform_fee' // Platform fee deducted from winnings
    | 'admin_adjustment' // Manual adjustment by admin
    | 'marketplace_purchase'; // User purchases item from marketplace
  amount: number; // Amount of credits (+/-)
  balanceBefore: number; // Balance before transaction
  balanceAfter: number; // Balance after transaction
  currency: string; // EUR, USD, etc.
  exchangeRate: number; // Exchange rate (1 credit = X EUR)
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  provider?: string; // Payment provider: stripe, nuvei, paddle, etc.
  providerTransactionId?: string; // Provider's own transaction/payment ID
  paymentMethod?: string; // card, bank_transfer, paypal, etc.
  paymentId?: string; // Stripe payment ID, etc. (deprecated - use providerTransactionId)
  paymentIntentId?: string; // Stripe Payment Intent ID (for fraud detection)
  competitionId?: string; // If related to competition
  description: string; // Transaction description
  metadata?: Record<string, any>; // Additional data
  failureReason?: string; // If failed
  processedAt?: Date; // When transaction was processed
  createdAt: Date;
  updatedAt: Date;
}

const WalletTransactionSchema = new Schema<IWalletTransaction>(
  {
    userId: {
      type: String,
      required: true,
    },
    transactionType: {
      type: String,
      required: true,
      enum: [
        'deposit',
        'withdrawal',
        'withdrawal_fee',
        'competition_entry',
        'competition_win',
        'competition_refund',
        'challenge_entry',
        'challenge_win',
        'challenge_refund',
        'platform_fee',
        'admin_adjustment',
        'marketplace_purchase',
      ],
    },
    amount: {
      type: Number,
      required: true,
    },
    balanceBefore: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'EUR',
    },
    exchangeRate: {
      type: Number,
      required: true,
      default: 1,
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    provider: {
      type: String, // stripe, nuvei, paddle, etc.
    },
    providerTransactionId: {
      type: String, // Provider's own transaction ID
    },
    paymentMethod: {
      type: String,
    },
    paymentId: {
      type: String,
    },
    paymentIntentId: {
      type: String,
    },
    competitionId: {
      type: String,
    },
    description: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    failureReason: {
      type: String,
    },
    processedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast queries
WalletTransactionSchema.index({ userId: 1, createdAt: -1 });
WalletTransactionSchema.index({ competitionId: 1 });
WalletTransactionSchema.index({ status: 1, createdAt: -1 });
WalletTransactionSchema.index({ transactionType: 1, createdAt: -1 });
WalletTransactionSchema.index({ provider: 1, createdAt: -1 });
WalletTransactionSchema.index({ providerTransactionId: 1 }); // For webhook lookups
WalletTransactionSchema.index({ paymentIntentId: 1 }); // For Stripe lookups

const WalletTransaction =
  models?.WalletTransaction ||
  model<IWalletTransaction>('WalletTransaction', WalletTransactionSchema);

export default WalletTransaction;

