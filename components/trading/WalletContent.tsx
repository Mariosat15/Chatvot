'use client';

import { Wallet, TrendingUp, TrendingDown, DollarSign, History, ArrowDownCircle, ArrowUpCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DepositModal from '@/components/trading/DepositModal';
import WithdrawalModal from '@/components/trading/WithdrawalModal';
import TransactionHistory from '@/components/trading/TransactionHistory';
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
  const { formatCredits, settings, creditsToEUR } = useAppSettings();

  if (!settings) return null;

  return (
    <div className="flex min-h-screen flex-col gap-8 p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-yellow-500/10 p-3">
            <Wallet className="h-6 w-6 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-100 flex items-center gap-2">
              <Zap className="h-8 w-8 text-yellow-500" />
              {settings.credits.name} Wallet
            </h1>
            <p className="text-sm text-gray-400">Manage your {settings.credits.name.toLowerCase()} and transactions</p>
          </div>
        </div>
      </div>

      {/* Main Balance Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-500/20 via-gray-800 to-gray-900 p-8 shadow-xl border-2 border-yellow-500/30">
        <div className="absolute top-0 right-0 opacity-10">
          <Zap className="h-48 w-48 text-yellow-500" />
        </div>

        <div className="relative z-10">
          <p className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500 animate-pulse" />
            Available Balance
          </p>
          <div className="mt-4 flex items-baseline gap-3">
            <Zap className="h-12 w-12 text-yellow-500" />
            <span className="text-6xl font-black text-yellow-400 tabular-nums">
              {stats.currentBalance.toFixed(settings.credits.decimals)}
            </span>
            <span className="text-3xl font-bold text-yellow-500">{settings.credits.symbol}</span>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <p className="text-lg font-semibold text-yellow-500/80">
              {settings.credits.name}
            </p>
            {settings.credits.showEUREquivalent && (
              <p className="text-sm text-gray-400">
                ≈ {settings.currency.symbol}{creditsToEUR(stats.currentBalance).toFixed(2)} {settings.currency.code}
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-8 flex gap-4">
            <DepositModal>
              <Button className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold h-14 text-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-yellow-500/50">
                <ArrowDownCircle className="mr-2 h-6 w-6" />
                Buy {settings.credits.name}
              </Button>
            </DepositModal>

            <WithdrawalModal>
              <Button
                variant="outline"
                className="flex-1 border-gray-600 bg-gray-800/50 hover:bg-gray-800 text-gray-100 h-14 text-lg hover:scale-105 transition-all"
                disabled={!stats.withdrawalEnabled || stats.currentBalance < 10}
              >
                <ArrowUpCircle className="mr-2 h-6 w-6" />
                Withdraw
              </Button>
            </WithdrawalModal>
          </div>

          {!stats.kycVerified && (
            <div className="mt-4 rounded-lg bg-orange-500/10 border border-orange-500/20 p-3">
              <p className="text-xs text-orange-400">
                ⚠️ KYC verification required for withdrawals. Contact support to verify your account.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Bought */}
        <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-6 hover:bg-gray-800/70 hover:scale-105 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Bought</p>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-2xl font-bold text-gray-100 tabular-nums">
                  {stats.totalDeposited.toFixed(settings.credits.decimals)}
                </p>
                <span className="text-lg text-yellow-500">{settings.credits.symbol}</span>
              </div>
              {settings.credits.showEUREquivalent && (
                <p className="mt-1 text-xs text-gray-500">
                  ≈ {settings.currency.symbol}{creditsToEUR(stats.totalDeposited).toFixed(2)}
                </p>
              )}
            </div>
            <div className="rounded-full bg-green-500/10 p-3">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </div>

        {/* Total Withdrawn */}
        <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-6 hover:bg-gray-800/70 hover:scale-105 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Withdrawn</p>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-2xl font-bold text-gray-100 tabular-nums">
                  {stats.totalWithdrawn.toFixed(settings.credits.decimals)}
                </p>
                <span className="text-lg text-yellow-500">{settings.credits.symbol}</span>
              </div>
              {settings.credits.showEUREquivalent && (
                <p className="mt-1 text-xs text-gray-500">
                  ≈ {settings.currency.symbol}{creditsToEUR(stats.totalWithdrawn).toFixed(2)}
                </p>
              )}
            </div>
            <div className="rounded-full bg-red-500/10 p-3">
              <TrendingDown className="h-5 w-5 text-red-500" />
            </div>
          </div>
        </div>

        {/* Competition Spending */}
        <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-6 hover:bg-gray-800/70 hover:scale-105 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Competition Spending</p>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-2xl font-bold text-gray-100 tabular-nums">
                  {stats.totalSpentOnCompetitions.toFixed(settings.credits.decimals)}
                </p>
                <span className="text-lg text-yellow-500">{settings.credits.symbol}</span>
              </div>
              {settings.credits.showEUREquivalent && (
                <p className="mt-1 text-xs text-gray-500">
                  ≈ {settings.currency.symbol}{creditsToEUR(stats.totalSpentOnCompetitions).toFixed(2)}
                </p>
              )}
            </div>
            <div className="rounded-full bg-blue-500/10 p-3">
              <DollarSign className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Competition Winnings */}
        <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-6 hover:bg-gray-800/70 hover:scale-105 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Competition Winnings</p>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-2xl font-bold text-gray-100 tabular-nums">
                  {stats.totalWonFromCompetitions.toFixed(settings.credits.decimals)}
                </p>
                <span className="text-lg text-yellow-500">{settings.credits.symbol}</span>
              </div>
              {settings.credits.showEUREquivalent && (
                <p className="mt-1 text-xs text-gray-500">
                  ≈ {settings.currency.symbol}{creditsToEUR(stats.totalWonFromCompetitions).toFixed(2)}
                </p>
              )}
              {stats.roi !== 0 && (
                <p className={`mt-1 text-xs font-medium ${stats.roi > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  ROI: {stats.roi > 0 ? '+' : ''}{stats.roi.toFixed(1)}%
                </p>
              )}
            </div>
            <div className={`rounded-full ${stats.netProfitFromCompetitions >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'} p-3`}>
              {stats.netProfitFromCompetitions >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <History className="h-5 w-5 text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-100">Transaction History</h2>
        </div>

        <TransactionHistory transactions={transactions} />
      </div>
    </div>
  );
}

