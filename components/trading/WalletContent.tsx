'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Wallet, TrendingUp, TrendingDown, DollarSign, History, ArrowDownCircle, ArrowUpCircle, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DepositModal from '@/components/trading/DepositModal';
import WithdrawalModal from '@/components/trading/WithdrawalModal';
import TransactionHistory from '@/components/trading/TransactionHistory';
import BankAccountsSection from '@/components/wallet/BankAccountsSection';
import { useAppSettings } from '@/contexts/AppSettingsContext';

interface WalletContentProps {
  stats: {
    currentBalance: number;
    totalDeposited: number;
    totalWithdrawn: number;
    totalSpentOnCompetitions: number;
    totalWonFromCompetitions: number;
    netProfitFromCompetitions: number;
    roi: number;
    kycVerified: boolean;
    withdrawalEnabled: boolean;
  };
  transactions: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export default function WalletContent({ stats, transactions }: WalletContentProps) {
  const { settings, creditsToEUR } = useAppSettings();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'error' | null>(null);

  // Handle payment return from Stripe/Paddle
  useEffect(() => {
    const payment = searchParams.get('payment');
    const paddleSuccess = searchParams.get('paddle_status');
    const error = searchParams.get('error');

    if (payment === 'success' || paddleSuccess === 'completed') {
      setPaymentStatus('success');
      // Clear URL params after showing message
      setTimeout(() => {
        router.replace('/wallet', { scroll: false });
      }, 5000);
    } else if (error || payment === 'failed' || paddleSuccess === 'failed') {
      setPaymentStatus('error');
      setTimeout(() => {
        router.replace('/wallet', { scroll: false });
      }, 5000);
    }
  }, [searchParams, router]);

  if (!settings) return null;

  return (
    <div className="flex min-h-screen flex-col gap-4 sm:gap-6 md:gap-8">
      {/* Payment Status Banner */}
      {paymentStatus === 'success' && (
        <div className="animate-in fade-in slide-in-from-top-4 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
          <div className="rounded-full bg-green-500/20 p-2 sm:p-3 flex-shrink-0">
            <CheckCircle2 className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-bold text-green-400">Payment Successful!</h3>
            <p className="text-xs sm:text-sm text-gray-300 mt-0.5 sm:mt-1 truncate sm:whitespace-normal">
              Your {settings.credits.name} have been added to your wallet.
            </p>
          </div>
        </div>
      )}

      {paymentStatus === 'error' && (
        <div className="animate-in fade-in slide-in-from-top-4 rounded-xl bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-500/30 p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
          <div className="rounded-full bg-red-500/20 p-2 sm:p-3 flex-shrink-0">
            <XCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-500" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-bold text-red-400">Payment Failed</h3>
            <p className="text-xs sm:text-sm text-gray-300 mt-0.5 sm:mt-1">
              There was an issue. Please try again.
            </p>
          </div>
        </div>
      )}

      {/* Header - Mobile Optimized */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="rounded-full bg-yellow-500/10 p-2 sm:p-3 flex-shrink-0">
          <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-100 flex items-center gap-2 truncate">
            <Zap className="h-5 w-5 sm:h-8 sm:w-8 text-yellow-500 flex-shrink-0" />
            <span className="truncate">{settings.credits.name} Wallet</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 truncate">Manage your {settings.credits.name.toLowerCase()}</p>
        </div>
      </div>

      {/* Main Balance Card - Mobile Optimized */}
      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-yellow-500/20 via-gray-800 to-gray-900 p-4 sm:p-6 md:p-8 shadow-xl border-2 border-yellow-500/30">
        <div className="absolute top-0 right-0 opacity-10">
          <Zap className="h-24 sm:h-32 md:h-48 w-24 sm:w-32 md:w-48 text-yellow-500" />
        </div>

        <div className="relative z-10">
          <p className="text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5 sm:gap-2">
            <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 animate-pulse" />
            Available Balance
          </p>
          <div className="mt-2 sm:mt-4 flex items-baseline gap-1.5 sm:gap-3 flex-wrap">
            <Zap className="h-8 w-8 sm:h-10 md:h-12 sm:w-10 md:w-12 text-yellow-500 flex-shrink-0" />
            <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-yellow-400 tabular-nums">
              {stats.currentBalance.toFixed(settings.credits.decimals)}
            </span>
            <span className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-500">{settings.credits.symbol}</span>
          </div>
          <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-2">
            <p className="text-sm sm:text-lg font-semibold text-yellow-500/80">
              {settings.credits.name}
            </p>
            {settings.credits.showEUREquivalent && (
              <p className="text-xs sm:text-sm text-gray-400">
                ≈ {settings.currency.symbol}{creditsToEUR(stats.currentBalance).toFixed(2)} {settings.currency.code}
              </p>
            )}
          </div>

          {/* Quick Actions - Stack on mobile */}
          <div className="mt-4 sm:mt-6 md:mt-8 flex flex-col sm:flex-row gap-2 sm:gap-4">
            <DepositModal>
              <Button className="w-full sm:flex-1 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold h-12 sm:h-14 text-base sm:text-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-yellow-500/50">
                <ArrowDownCircle className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                Buy {settings.credits.name}
              </Button>
            </DepositModal>

            <WithdrawalModal>
              <Button
                variant="outline"
                className="w-full sm:flex-1 border-gray-600 bg-gray-800/50 hover:bg-gray-800 text-gray-100 h-12 sm:h-14 text-base sm:text-lg hover:scale-105 transition-all"
                disabled={stats.currentBalance < 1}
              >
                <ArrowUpCircle className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                Withdraw
              </Button>
            </WithdrawalModal>
          </div>
        </div>
      </div>

      {/* Stats Grid - Mobile: 2 cols, Desktop: 4 cols */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        {/* Total Bought */}
        <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-3 sm:p-4 md:p-6 hover:bg-gray-800/70 transition-all">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider truncate">Total Bought</p>
              <div className="mt-1 sm:mt-2 flex items-baseline gap-1 sm:gap-2 flex-wrap">
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-100 tabular-nums">
                  {stats.totalDeposited.toFixed(settings.credits.decimals)}
                </p>
                <span className="text-sm sm:text-lg text-yellow-500">{settings.credits.symbol}</span>
              </div>
              {settings.credits.showEUREquivalent && (
                <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500 truncate">
                  ≈ {settings.currency.symbol}{creditsToEUR(stats.totalDeposited).toFixed(2)}
                </p>
              )}
            </div>
            <div className="rounded-full bg-green-500/10 p-2 sm:p-3 flex-shrink-0">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
            </div>
          </div>
        </div>

        {/* Total Withdrawn */}
        <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-3 sm:p-4 md:p-6 hover:bg-gray-800/70 transition-all">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider truncate">Withdrawn</p>
              <div className="mt-1 sm:mt-2 flex items-baseline gap-1 sm:gap-2 flex-wrap">
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-100 tabular-nums">
                  {stats.totalWithdrawn.toFixed(settings.credits.decimals)}
                </p>
                <span className="text-sm sm:text-lg text-yellow-500">{settings.credits.symbol}</span>
              </div>
              {settings.credits.showEUREquivalent && (
                <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500 truncate">
                  ≈ {settings.currency.symbol}{creditsToEUR(stats.totalWithdrawn).toFixed(2)}
                </p>
              )}
            </div>
            <div className="rounded-full bg-red-500/10 p-2 sm:p-3 flex-shrink-0">
              <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
            </div>
          </div>
        </div>

        {/* Competition Spending */}
        <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-3 sm:p-4 md:p-6 hover:bg-gray-800/70 transition-all">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider truncate">Spent</p>
              <div className="mt-1 sm:mt-2 flex items-baseline gap-1 sm:gap-2 flex-wrap">
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-100 tabular-nums">
                  {stats.totalSpentOnCompetitions.toFixed(settings.credits.decimals)}
                </p>
                <span className="text-sm sm:text-lg text-yellow-500">{settings.credits.symbol}</span>
              </div>
              {settings.credits.showEUREquivalent && (
                <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500 truncate">
                  ≈ {settings.currency.symbol}{creditsToEUR(stats.totalSpentOnCompetitions).toFixed(2)}
                </p>
              )}
            </div>
            <div className="rounded-full bg-blue-500/10 p-2 sm:p-3 flex-shrink-0">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Competition Winnings */}
        <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-3 sm:p-4 md:p-6 hover:bg-gray-800/70 transition-all">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider truncate">Winnings</p>
              <div className="mt-1 sm:mt-2 flex items-baseline gap-1 sm:gap-2 flex-wrap">
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-100 tabular-nums">
                  {stats.totalWonFromCompetitions.toFixed(settings.credits.decimals)}
                </p>
                <span className="text-sm sm:text-lg text-yellow-500">{settings.credits.symbol}</span>
              </div>
              {stats.roi !== 0 && (
                <p className={`mt-0.5 sm:mt-1 text-[10px] sm:text-xs font-medium ${stats.roi > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  ROI: {stats.roi > 0 ? '+' : ''}{stats.roi.toFixed(1)}%
                </p>
              )}
            </div>
            <div className={`rounded-full ${stats.netProfitFromCompetitions >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'} p-2 sm:p-3 flex-shrink-0`}>
              {stats.netProfitFromCompetitions >= 0 ? (
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bank Accounts for Withdrawals */}
      <BankAccountsSection />

      {/* Transaction History */}
      <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-3 sm:p-4 md:p-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <History className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          <h2 className="text-lg sm:text-xl font-semibold text-gray-100">Transaction History</h2>
        </div>

        <TransactionHistory transactions={transactions} />
      </div>
    </div>
  );
}
