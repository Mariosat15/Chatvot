'use client';

import { ArrowDownCircle, ArrowUpCircle, Trophy, RefreshCw, ShieldAlert, UserCog, Zap, FileText, Swords } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { Button } from '@/components/ui/button';

interface Transaction {
  _id: string;
  transactionType: 'deposit' | 'withdrawal' | 'withdrawal_fee' | 'competition_entry' | 'competition_win' | 'competition_refund' | 'platform_fee' | 'admin_adjustment' | 'challenge_entry' | 'challenge_win' | 'challenge_refund' | 'marketplace_purchase';
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

export default function TransactionHistory({ transactions }: TransactionHistoryProps) {
  const { settings } = useAppSettings();

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
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <TransactionItem key={transaction._id} transaction={transaction} />
      ))}
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
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-600">
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
            <p className={`text-lg font-bold tabular-nums ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? '+' : '-'}{creditsAmount.toFixed(settings.credits.decimals)}
            </p>
            <span className={`text-sm font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {settings.credits.symbol}
            </span>
          </div>
          {settings.credits.showEUREquivalent && (
            <p className="text-xs text-gray-500 tabular-nums">
              ≈ {isPositive ? '+' : '-'}{settings.currency.symbol}{eurAmount.toFixed(2)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

