'use client';

import { ArrowDownCircle, ArrowUpCircle, Trophy, RefreshCw, ShieldAlert, UserCog, Zap, FileText, Swords, Gift, Filter, Crown } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { Button } from '@/components/ui/button';

interface Transaction {
  _id: string;
  transactionType: 'deposit' | 'withdrawal' | 'withdrawal_fee' | 'competition_entry' | 'competition_win' | 'competition_refund' | 'platform_fee' | 'admin_adjustment' | 'challenge_entry' | 'challenge_win' | 'challenge_refund' | 'marketplace_purchase' | 'incident_compensation' | 'gamemaster_earning' | 'gamemaster_challenge_referral';
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  description: string;
  createdAt: string;
  paymentMethod?: string;
  exchangeRate?: number;
  paymentId?: string;
  failureReason?: string;
  metadata?: Record<string, any>;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
}

type FilterType = 'all' | 'deposits' | 'withdrawals' | 'competitions' | 'challenges' | 'referrals';

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'deposits', label: 'Deposits' },
  { value: 'withdrawals', label: 'Withdrawals' },
  { value: 'competitions', label: 'Competitions' },
  { value: 'challenges', label: 'Challenges' },
  { value: 'referrals', label: 'Referrals' },
];

export default function TransactionHistory({ transactions }: TransactionHistoryProps) {
  const { settings } = useAppSettings();
  const [filter, setFilter] = useState<FilterType>('all');

  // Filter transactions based on selected type
  const filteredTransactions = useMemo(() => {
    if (filter === 'all') return transactions;
    
    return transactions.filter(tx => {
      switch (filter) {
        case 'deposits':
          return tx.transactionType === 'deposit';
        case 'withdrawals':
          return tx.transactionType === 'withdrawal' || tx.transactionType === 'withdrawal_fee';
        case 'competitions':
          return ['competition_entry', 'competition_win', 'competition_refund'].includes(tx.transactionType);
        case 'challenges':
          return ['challenge_entry', 'challenge_win', 'challenge_refund'].includes(tx.transactionType);
        case 'referrals':
          return ['gamemaster_earning', 'gamemaster_challenge_referral'].includes(tx.transactionType);
        default:
          return true;
      }
    });
  }, [transactions, filter]);

  // Check if there are any referral transactions
  const hasReferralTransactions = useMemo(() => 
    transactions.some(tx => ['gamemaster_earning', 'gamemaster_challenge_referral'].includes(tx.transactionType)),
    [transactions]
  );

  // Filter out referrals option if no referral transactions
  const availableFilters = useMemo(() => 
    hasReferralTransactions ? FILTER_OPTIONS : FILTER_OPTIONS.filter(f => f.value !== 'referrals'),
    [hasReferralTransactions]
  );

  if (transactions.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <Zap className="h-8 w-8 text-yellow-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-300 mb-2">No transactions yet</h3>
        <p className="text-sm text-gray-500">
          Buy your first {settings?.credits.name || 'credits'} to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Filter className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <div className="flex gap-1.5">
          {availableFilters.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                filter === option.value
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border border-transparent'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      {filteredTransactions.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-500">No {filter} transactions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransactions.map((transaction) => (
            <TransactionItem key={transaction._id} transaction={transaction} />
          ))}
        </div>
      )}
    </div>
  );
}

function TransactionItem({ transaction }: { transaction: Transaction }) {
  const { settings, creditsToEUR } = useAppSettings();
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [checkedInvoice, setCheckedInvoice] = useState(false);

  // Check if invoice exists for this transaction (only for deposits)
  useEffect(() => {
    if (transaction.transactionType === 'deposit' && transaction.status === 'completed' && !checkedInvoice) {
      setCheckedInvoice(true);
      setLoadingInvoice(true);
      fetch(`/api/user/invoices/by-transaction/${transaction._id}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.invoice?._id) {
            setInvoiceId(data.invoice._id);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingInvoice(false));
    }
  }, [transaction._id, transaction.transactionType, transaction.status, checkedInvoice]);

  const handleViewInvoice = () => {
    if (invoiceId) {
      window.open(`/api/user/invoices/${invoiceId}/html`, '_blank');
    }
  };

  const getTransactionIcon = () => {
    switch (transaction.transactionType) {
      case 'deposit':
        return <ArrowDownCircle className="h-5 w-5 text-green-500" />;
      case 'withdrawal':
        return <ArrowUpCircle className="h-5 w-5 text-red-500" />;
      case 'withdrawal_fee':
        return <ShieldAlert className="h-5 w-5 text-orange-500" />;
      case 'competition_entry':
        return <ShieldAlert className="h-5 w-5 text-blue-500" />;
      case 'competition_win':
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 'competition_refund':
        return <RefreshCw className="h-5 w-5 text-purple-500" />;
      case 'platform_fee':
        return <ShieldAlert className="h-5 w-5 text-orange-500" />;
      case 'admin_adjustment':
        return <UserCog className="h-5 w-5 text-gray-500" />;
      // Challenge transactions
      case 'challenge_entry':
        return <Swords className="h-5 w-5 text-orange-500" />;
      case 'challenge_win':
        return <Swords className="h-5 w-5 text-yellow-500" />;
      case 'challenge_refund':
        return <Swords className="h-5 w-5 text-purple-500" />;
      case 'incident_compensation':
        return <Gift className="h-5 w-5 text-green-500" />;
      // GM Referral earnings
      case 'gamemaster_earning':
      case 'gamemaster_challenge_referral':
        return <Crown className="h-5 w-5 text-amber-400" />;
      default:
        return <ArrowDownCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getTransactionLabel = () => {
    const creditName = settings?.credits.name || 'Credits';
    switch (transaction.transactionType) {
      case 'deposit':
        return `Buy ${creditName}`;
      case 'withdrawal':
        return 'Withdrawal';
      case 'withdrawal_fee':
        return 'Withdrawal Fee';
      case 'competition_entry':
        return 'Competition Entry';
      case 'competition_win':
        return 'Competition Prize';
      case 'competition_refund':
        return 'Competition Refund';
      case 'platform_fee':
        return 'Platform Fee';
      case 'admin_adjustment':
        return 'Admin Adjustment';
      // Challenge transactions
      case 'challenge_entry':
        return '⚔️ Challenge Entry';
      case 'challenge_win':
        return '⚔️ Challenge Win';
      case 'challenge_refund':
        return '⚔️ Challenge Refund';
      case 'incident_compensation':
        return '💰 Compensation';
      // GM Referral earnings
      case 'gamemaster_earning':
        return '👑 Referral Earnings';
      case 'gamemaster_challenge_referral':
        return '👑 Challenge Referral';
      default:
        return 'Transaction';
    }
  };

  const getStatusBadge = () => {
    // For withdrawals, show more detailed status
    if (transaction.transactionType === 'withdrawal') {
      switch (transaction.status) {
        case 'completed':
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
              ✓ Sent to Bank
            </span>
          );
        case 'pending':
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
              Processing
            </span>
          );
        case 'failed':
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20" title={transaction.failureReason}>
              Rejected
            </span>
          );
        case 'cancelled':
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
              Cancelled
            </span>
          );
      }
    }

    // Default status badges for other transaction types
    switch (transaction.status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            Completed
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            Pending
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const isPositive = transaction.amount > 0;
  const creditsAmount = Math.abs(transaction.amount);
  const eurAmount = creditsToEUR(creditsAmount);

  if (!settings) return null;

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-gray-800/30 border border-gray-700/50 hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Icon */}
        <div className="shrink-0 w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
          {getTransactionIcon()}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium text-gray-100 truncate">
              {getTransactionLabel()}
            </p>
            {getStatusBadge()}
          </div>
          {/* Enhanced description for withdrawals showing fees */}
          {transaction.transactionType === 'withdrawal' && transaction.metadata ? (
            <p className="text-xs text-gray-500 truncate">
              {creditsAmount.toFixed(settings?.credits.decimals || 0)} {settings?.credits.name || 'credits'} 
              {transaction.metadata.netAmountEUR && transaction.metadata.platformFee ? (
                <span className="text-gray-400">
                  {' '}(You receive: €{transaction.metadata.netAmountEUR.toFixed(2)}, Fee: €{transaction.metadata.platformFee.toFixed(2)})
                </span>
              ) : null}
            </p>
          ) : (
            <p className="text-xs text-gray-500 truncate">{transaction.description}</p>
          )}
          
          {/* Show failure/cancel reason for failed transactions */}
          {(transaction.status === 'failed' || transaction.status === 'cancelled') && (
            <p 
              className="text-xs text-red-400 mt-1 truncate max-w-md" 
              title={transaction.failureReason || transaction.metadata?.cancelReason || transaction.metadata?.clientErrorDescription || transaction.metadata?.errorReason || 'No details available'}
            >
              ❌ {transaction.failureReason || transaction.metadata?.cancelReason || transaction.metadata?.clientErrorDescription || transaction.metadata?.errorReason || (transaction.status === 'cancelled' ? 'Payment was cancelled by user' : 'Payment was declined by card issuer')}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-600" suppressHydrationWarning>
              {new Date(transaction.createdAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </p>
            {transaction.paymentMethod && (
              <>
                <span className="text-gray-700">•</span>
                <p className="text-xs text-gray-600 capitalize">{transaction.paymentMethod}</p>
              </>
            )}
            {/* Show bank transfer for withdrawals */}
            {transaction.transactionType === 'withdrawal' && (
              <>
                <span className="text-gray-700">•</span>
                <p className="text-xs text-gray-600">Bank Transfer</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Amount & Invoice */}
      <div className="flex items-center gap-3 shrink-0 ml-4">
        {/* Invoice Button (only for completed deposits with invoice) */}
        {transaction.transactionType === 'deposit' && transaction.status === 'completed' && (
          <div className="shrink-0">
            {loadingInvoice ? (
              <div className="w-9 h-9 rounded-lg bg-gray-800/50 flex items-center justify-center">
                <RefreshCw className="h-4 w-4 text-gray-500 animate-spin" />
              </div>
            ) : invoiceId ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleViewInvoice}
                className="h-9 w-9 p-0 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:border-amber-500/50 rounded-lg"
                title="View Invoice"
              >
                <FileText className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        )}

        {/* Amount */}
        <div className="text-right">
          <div className="flex items-baseline gap-1.5 justify-end">
            {/* Show amount differently for failed/cancelled transactions */}
            {(transaction.status === 'failed' || transaction.status === 'cancelled') ? (
              <>
                <p className="text-lg font-bold tabular-nums text-gray-500 line-through">
                  {isPositive ? '+' : '-'}{creditsAmount.toFixed(settings.credits.decimals)}
                </p>
                <span className="text-sm font-semibold text-gray-500 line-through">
                  {settings.credits.symbol}
                </span>
              </>
            ) : (
              <>
                <p className={`text-lg font-bold tabular-nums ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                  {isPositive ? '+' : '-'}{creditsAmount.toFixed(settings.credits.decimals)}
                </p>
                <span className={`text-sm font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                  {settings.credits.symbol}
                </span>
              </>
            )}
          </div>
          {settings.credits.showEUREquivalent && (
            <p className={`text-xs tabular-nums ${(transaction.status === 'failed' || transaction.status === 'cancelled') ? 'text-gray-600 line-through' : 'text-gray-500'}`}>
              ≈ {isPositive ? '+' : '-'}{settings.currency.symbol}{eurAmount.toFixed(2)}
            </p>
          )}
          {/* Show "Not charged" for failed/cancelled */}
          {(transaction.status === 'failed' || transaction.status === 'cancelled') && (
            <p className="text-[10px] text-gray-500 mt-0.5">
              {transaction.status === 'cancelled' ? 'Cancelled' : 'Not processed'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

