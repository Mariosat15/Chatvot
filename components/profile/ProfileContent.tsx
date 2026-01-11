'use client';

import { Trophy, TrendingUp, TrendingDown, Target, Award, Activity, BarChart3, Zap, Swords, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import Link from 'next/link';
import { useAppSettings } from '@/contexts/AppSettingsContext';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface ProfileContentProps {
  session: any;
  competitionStats: any;
  challengeStats?: any;
  walletData: any;
  combinedStats?: any;
}

export default function ProfileContent({ session, competitionStats, challengeStats, walletData, combinedStats }: ProfileContentProps) {
  const { settings, creditsToEUR } = useAppSettings();

  if (!settings) return null;

  return (
    <>
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 shadow-2xl border border-primary-500/20">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary-500/20 flex items-center justify-center">
            <Activity className="h-8 w-8 text-primary-300" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">{session.user.name || 'Trader'}</h1>
            <p className="text-primary-200">{session.user.email}</p>
          </div>
        </div>
      </div>

      {/* Combined Trading Stats - Same as Dashboard */}
      {combinedStats && (
        <div className="bg-gradient-to-br from-dark-700/80 to-dark-800/80 rounded-2xl p-6 shadow-xl border border-dark-600">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-bold text-white">Trading Overview</h2>
            <span className="text-xs text-dark-400 bg-dark-600 px-2 py-1 rounded">All Competitions + Challenges</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            {/* Total Trades */}
            <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600">
              <p className="text-xs text-dark-400 mb-1">Total Trades</p>
              <p className="text-2xl font-bold text-white tabular-nums">
                {combinedStats.totalTrades || 0}
              </p>
            </div>

            {/* Win Rate */}
            <div className="bg-dark-800/50 rounded-xl p-4 border border-blue-500/30">
              <p className="text-xs text-blue-400 mb-1">Win Rate</p>
              <p className="text-2xl font-bold text-white tabular-nums">
                {(combinedStats.winRate || 0).toFixed(1)}%
              </p>
            </div>

            {/* Winning Trades */}
            <div className="bg-dark-800/50 rounded-xl p-4 border border-green-500/30">
              <p className="text-xs text-green-400 mb-1">Winning</p>
              <p className="text-2xl font-bold text-green-400 tabular-nums">
                {combinedStats.winningTrades || 0}
              </p>
            </div>

            {/* Losing Trades */}
            <div className="bg-dark-800/50 rounded-xl p-4 border border-red-500/30">
              <p className="text-xs text-red-400 mb-1">Losing</p>
              <p className="text-2xl font-bold text-red-400 tabular-nums">
                {combinedStats.losingTrades || 0}
              </p>
            </div>

            {/* Total P&L */}
            <div className={`bg-dark-800/50 rounded-xl p-4 border ${
              (combinedStats.totalPnL || 0) >= 0 ? 'border-green-500/30' : 'border-red-500/30'
            }`}>
              <p className="text-xs text-dark-400 mb-1">Total P&L</p>
              <p className={`text-2xl font-bold tabular-nums ${
                (combinedStats.totalPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {(combinedStats.totalPnL || 0) >= 0 ? '+' : ''}
                {(combinedStats.totalPnL || 0).toFixed(2)}
              </p>
            </div>

            {/* Profit Factor */}
            <div className="bg-dark-800/50 rounded-xl p-4 border border-purple-500/30">
              <p className="text-xs text-purple-400 mb-1">Profit Factor</p>
              <p className={`text-2xl font-bold tabular-nums ${
                (combinedStats.profitFactor || 0) >= 2 ? 'text-green-400' :
                (combinedStats.profitFactor || 0) >= 1 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {combinedStats.profitFactor === 999 ? '∞' : (combinedStats.profitFactor || 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Additional combined stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-dark-900/50 rounded-lg p-3">
              <p className="text-xs text-dark-400">Avg Win</p>
              <p className="text-lg font-semibold text-green-400">
                +${(combinedStats.averageWin || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-dark-900/50 rounded-lg p-3">
              <p className="text-xs text-dark-400">Avg Loss</p>
              <p className="text-lg font-semibold text-red-400">
                -${(combinedStats.averageLoss || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-dark-900/50 rounded-lg p-3">
              <p className="text-xs text-dark-400">Largest Win</p>
              <p className="text-lg font-semibold text-green-400">
                +${(combinedStats.largestWin || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-dark-900/50 rounded-lg p-3">
              <p className="text-xs text-dark-400">Total Prizes Won</p>
              <div className="flex items-baseline gap-1">
                <p className="text-lg font-semibold text-yellow-400">
                  {(combinedStats.totalPrizesWon || 0).toFixed(settings?.credits.decimals || 0)}
                </p>
                <span className="text-sm text-yellow-500">{settings?.credits.symbol || '⚡'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Summary */}
      <div className="bg-dark-700/50 rounded-2xl p-6 shadow-xl border border-dark-600">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Zap className="h-6 w-6 text-yellow-500 animate-pulse" />
            <h2 className="text-2xl font-bold text-white">Wallet</h2>
          </div>
          <Link
            href="/wallet"
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm font-medium hover:scale-105 transform"
          >
            View Details
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600 hover:border-yellow-500/50 transition-all hover:scale-105">
            <p className="text-sm text-dark-300 mb-2 flex items-center gap-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              Total Balance
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-white tabular-nums">
                {(walletData?.currentBalance || 0).toFixed(settings.credits.decimals)}
              </p>
              <span className="text-lg text-yellow-500">{settings.credits.symbol}</span>
            </div>
            {settings.credits.showEUREquivalent && (
              <p className="text-xs text-dark-400 mt-1">
                ≈ {settings.currency.symbol}{creditsToEUR(walletData?.currentBalance || 0).toFixed(2)}
              </p>
            )}
          </div>

          <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600 hover:border-green-500/50 transition-all hover:scale-105">
            <p className="text-sm text-dark-300 mb-2">Bought</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-semibold text-blue-400 tabular-nums">
                {(walletData?.totalDeposited || 0).toFixed(settings.credits.decimals)}
              </p>
              <span className="text-sm text-yellow-500">{settings.credits.symbol}</span>
            </div>
          </div>

          <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600 hover:border-green-500/50 transition-all hover:scale-105">
            <p className="text-sm text-dark-300 mb-2">Competition Winnings</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-semibold text-green-400 tabular-nums">
                +{(walletData?.totalWonFromCompetitions || 0).toFixed(settings.credits.decimals)}
              </p>
              <span className="text-sm text-yellow-500">{settings.credits.symbol}</span>
            </div>
          </div>

          <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600 hover:border-orange-500/50 transition-all hover:scale-105">
            <p className="text-sm text-dark-300 mb-2 flex items-center gap-1">
              <Swords className="h-4 w-4 text-orange-500" />
              Challenge Winnings
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-semibold text-orange-400 tabular-nums">
                +{(walletData?.totalWonFromChallenges || 0).toFixed(settings.credits.decimals)}
              </p>
              <span className="text-sm text-yellow-500">{settings.credits.symbol}</span>
            </div>
          </div>

          <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600 hover:border-red-500/50 transition-all hover:scale-105">
            <p className="text-sm text-dark-300 mb-2">Withdrawn</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-semibold text-dark-400 tabular-nums">
                {(walletData?.totalWithdrawn || 0).toFixed(settings.credits.decimals)}
              </p>
              <span className="text-sm text-yellow-500">{settings.credits.symbol}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Competition Overview */}
      <div className="bg-dark-700/50 rounded-2xl p-6 shadow-xl border border-dark-600">
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="h-6 w-6 text-yellow-500" />
          <h2 className="text-2xl font-bold text-white">Competition Stats</h2>
          <span className="text-xs text-dark-400 bg-dark-600 px-2 py-1 rounded">Competitions Only</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 rounded-xl p-4 border border-yellow-500/20 hover:scale-105 transition-transform">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-5 w-5 text-yellow-500" />
              <p className="text-sm text-yellow-200">Competitions Won</p>
            </div>
            <p className="text-3xl font-bold text-yellow-400 tabular-nums">
              {competitionStats?.competitionsWon || 0}
            </p>
            <p className="text-xs text-yellow-300/60 mt-1">
              🥇 {competitionStats?.podiumFinishes || 0} podium finishes
            </p>
          </div>

          <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600 hover:scale-105 transition-transform">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-5 w-5 text-blue-500" />
              <p className="text-sm text-dark-300">Competitions Entered</p>
            </div>
            <p className="text-3xl font-bold text-white tabular-nums">
              {competitionStats?.totalCompetitionsEntered || 0}
            </p>
            <p className="text-xs text-dark-400 mt-1">
              {competitionStats?.totalCompetitionsActive || 0} active
            </p>
          </div>

          <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600 hover:scale-105 transition-transform">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              <p className="text-sm text-dark-300">Best Rank</p>
            </div>
            <p className="text-3xl font-bold text-purple-400 tabular-nums">
              {competitionStats?.bestRank && competitionStats.bestRank > 0 ? `#${competitionStats.bestRank}` : 'N/A'}
            </p>
          </div>

          <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600 hover:scale-105 transition-transform">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-5 w-5 text-green-500" />
              <p className="text-sm text-dark-300">{settings.credits.name} Won</p>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-green-400 tabular-nums">
                {(competitionStats?.totalCreditsWon || 0).toFixed(settings.credits.decimals)}
              </p>
              <span className="text-xl text-yellow-500">{settings.credits.symbol}</span>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-dark-800/30 rounded-xl p-4 border border-dark-600">
          <h3 className="text-lg font-semibold text-white mb-4">📊 Performance Metrics</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <p className="text-xs text-dark-400 mb-1">Total P&L</p>
              <p className={`text-lg font-bold tabular-nums ${
                (competitionStats?.totalPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {(competitionStats?.totalPnl || 0) >= 0 ? '+' : ''}
                {(competitionStats?.totalPnl || 0).toFixed(2)}
              </p>
            </div>

            <div>
              <p className="text-xs text-dark-400 mb-1">Average ROI</p>
              <p className={`text-lg font-bold tabular-nums ${
                (competitionStats?.averageRoi || 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {(competitionStats?.averageRoi || 0) >= 0 ? '+' : ''}
                {(competitionStats?.averageRoi || 0).toFixed(2)}%
              </p>
            </div>

            <div>
              <p className="text-xs text-dark-400 mb-1">Win Rate</p>
              <p className="text-lg font-bold text-white tabular-nums">
                {(competitionStats?.overallWinRate || 0).toFixed(1)}%
              </p>
            </div>

            <div>
              <p className="text-xs text-dark-400 mb-1">Total Trades</p>
              <p className="text-lg font-bold text-white tabular-nums">
                {competitionStats?.totalTrades || 0}
              </p>
            </div>

            <div>
              <p className="text-xs text-dark-400 mb-1">Profit Factor</p>
              <p className={`text-lg font-bold tabular-nums ${
                (competitionStats?.profitFactor || 0) >= 2 ? 'text-green-400' :
                (competitionStats?.profitFactor || 0) >= 1 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {competitionStats?.profitFactor === 9999 ? '∞' : (competitionStats?.profitFactor || 0).toFixed(2)}
              </p>
            </div>

            <div>
              <p className="text-xs text-dark-400 mb-1">W/L Ratio</p>
              <p className="text-lg font-bold text-white tabular-nums">
                {competitionStats?.totalWinningTrades || 0}/{competitionStats?.totalLosingTrades || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Best Performances */}
        <div className="bg-dark-800/30 rounded-xl p-4 border border-dark-600 mt-4">
          <h3 className="text-lg font-semibold text-white mb-4">🌟 Best Performances</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-dark-400 mb-1">Best P&L</p>
              <p className="text-lg font-bold text-green-400 tabular-nums">
                +{(competitionStats?.bestPnl || 0).toFixed(2)}
              </p>
            </div>

            <div>
              <p className="text-xs text-dark-400 mb-1">Best ROI</p>
              <p className="text-lg font-bold text-green-400 tabular-nums">
                +{(competitionStats?.bestRoi || 0).toFixed(2)}%
              </p>
            </div>

            <div>
              <p className="text-xs text-dark-400 mb-1">Best Win Rate</p>
              <p className="text-lg font-bold text-green-400 tabular-nums">
                {(competitionStats?.bestWinRate || 0).toFixed(1)}%
              </p>
            </div>

            <div>
              <p className="text-xs text-dark-400 mb-1">Most Trades</p>
              <p className="text-lg font-bold text-blue-400 tabular-nums">
                {competitionStats?.mostTrades || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Competitions */}
      <div className="bg-dark-700/50 rounded-2xl p-6 shadow-xl border border-dark-600">
        <h2 className="text-2xl font-bold text-white mb-6">📅 Recent Competitions</h2>
        
        {!competitionStats?.recentCompetitions || competitionStats.recentCompetitions.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="h-12 w-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">No competitions yet. Join one to start trading!</p>
            <Link
              href="/competitions"
              className="inline-block mt-4 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium hover:scale-105 transform"
            >
              Browse Competitions
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {competitionStats.recentCompetitions.map((comp: any) => (
              <Link
                key={comp.competitionId}
                href={`/competitions/${comp.competitionId}`}
                className="block bg-dark-800/50 hover:bg-dark-800/70 rounded-xl p-4 border border-dark-600 hover:border-primary-500/50 transition-all hover:scale-105 transform"
              >
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-white truncate">
                        {comp.competitionName}
                      </h3>
                      {comp.status === 'active' && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30 font-semibold animate-pulse">
                          LIVE
                        </span>
                      )}
                      {comp.status === 'completed' && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold">
                          COMPLETED
                        </span>
                      )}
                      {comp.status === 'cancelled' && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400 border border-red-500/30 font-semibold">
                          CANCELLED
                        </span>
                      )}
                      {comp.status === 'upcoming' && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-semibold">
                          UPCOMING
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-dark-400">
                      {comp.status === 'active' ? 'Ends' : comp.status === 'upcoming' ? 'Starts' : 'Ended'}: {new Date(comp.status === 'upcoming' ? comp.startedAt : comp.endedAt).toLocaleDateString()} • {comp.totalTrades} trades • {comp.winRate.toFixed(1)}% win rate
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-dark-400">{comp.status === 'active' ? 'Current Rank' : 'Final Rank'}</p>
                      <p className="text-xl font-bold text-yellow-400">
                        {comp.rank > 0 ? `#${comp.rank}` : '-'}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-dark-400">P&L</p>
                      <p className={`text-xl font-bold tabular-nums ${
                        comp.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {comp.pnl >= 0 ? '+' : ''}{comp.pnl.toFixed(2)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-dark-400">ROI</p>
                      <p className={`text-xl font-bold tabular-nums ${
                        comp.pnlPercentage >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {comp.pnlPercentage >= 0 ? '+' : ''}{comp.pnlPercentage.toFixed(2)}%
                      </p>
                    </div>

                    {comp.prizeAmount > 0 && (
                      <div className="text-right">
                        <p className="text-sm text-dark-400">Prize</p>
                        <div className="flex items-baseline gap-1">
                          <p className="text-xl font-bold text-yellow-400 tabular-nums">
                            {comp.prizeAmount.toFixed(settings.credits.decimals)}
                          </p>
                          <span className="text-sm text-yellow-500">{settings.credits.symbol}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 1v1 Challenge Stats */}
      {challengeStats && (
        <div className="bg-dark-700/50 rounded-2xl p-6 shadow-xl border border-dark-600">
          <div className="flex items-center gap-3 mb-6">
            <Swords className="h-6 w-6 text-orange-500" />
            <h2 className="text-2xl font-bold text-white">1v1 Challenge Stats</h2>
            <span className="text-xs text-dark-400 bg-dark-600 px-2 py-1 rounded">Challenges Only</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-orange-500/10 to-red-600/5 rounded-xl p-4 border border-orange-500/20 hover:scale-105 transition-transform">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-5 w-5 text-orange-500" />
                <p className="text-sm text-orange-200">Challenges Won</p>
              </div>
              <p className="text-3xl font-bold text-orange-400 tabular-nums">
                {challengeStats?.totalChallengesWon || 0}
              </p>
              <p className="text-xs text-orange-300/60 mt-1">
                {challengeStats?.totalChallengesLost || 0} lost • {challengeStats?.totalChallengesTied || 0} tied
              </p>
            </div>

            <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600 hover:scale-105 transition-transform">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-blue-500" />
                <p className="text-sm text-dark-300">Challenges Entered</p>
              </div>
              <p className="text-3xl font-bold text-white tabular-nums">
                {challengeStats?.totalChallengesEntered || 0}
              </p>
              <p className="text-xs text-dark-400 mt-1">
                {challengeStats?.totalChallengesActive || 0} active
              </p>
            </div>

            <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600 hover:scale-105 transition-transform">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <p className="text-sm text-dark-300">Total P&L</p>
              </div>
              <p className={`text-3xl font-bold tabular-nums ${
                (challengeStats?.totalPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {(challengeStats?.totalPnl || 0) >= 0 ? '+' : ''}
                {(challengeStats?.totalPnl || 0).toFixed(2)}
              </p>
            </div>

            <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600 hover:scale-105 transition-transform">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <p className="text-sm text-dark-300">{settings.credits.name} Won</p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-yellow-400 tabular-nums">
                  {(challengeStats?.totalCreditsWon || 0).toFixed(settings.credits.decimals)}
                </p>
                <span className="text-xl text-yellow-500">{settings.credits.symbol}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Challenges */}
      {challengeStats && challengeStats.recentChallenges && challengeStats.recentChallenges.length > 0 && (
        <div className="bg-dark-700/50 rounded-2xl p-6 shadow-xl border border-dark-600">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Swords className="h-6 w-6 text-orange-500" />
            Recent Challenges
          </h2>
          
          <div className="space-y-3">
            {challengeStats.recentChallenges.map((challenge: any) => (
              <Link
                key={challenge.challengeId}
                href={`/challenges/${challenge.challengeId}`}
                className="block bg-dark-800/50 hover:bg-dark-800/70 rounded-xl p-4 border border-dark-600 hover:border-orange-500/50 transition-all hover:scale-105 transform"
              >
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-white truncate">
                        vs {challenge.opponentName}
                      </h3>
                      {challenge.status === 'active' && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30 font-semibold animate-pulse">
                          LIVE
                        </span>
                      )}
                      {challenge.status === 'completed' && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          challenge.isWinner 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {challenge.isWinner ? 'WON' : 'LOST'}
                        </span>
                      )}
                      {challenge.status === 'pending' && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-semibold">
                          PENDING
                        </span>
                      )}
                      {challenge.status === 'declined' && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-gray-500/20 text-gray-400 border border-gray-500/30 font-semibold">
                          DECLINED
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-dark-400">
                      {challenge.status === 'active' ? 'Ends' : 'Ended'}: {new Date(challenge.endTime).toLocaleDateString()} • {challenge.totalTrades} trades
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-dark-400">Entry Fee</p>
                      <p className="text-lg font-bold text-blue-400">
                        {challenge.entryFee}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-dark-400">P&L</p>
                      <p className={`text-xl font-bold tabular-nums ${
                        challenge.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {challenge.pnl >= 0 ? '+' : ''}{challenge.pnl.toFixed(2)}
                      </p>
                    </div>

                    {challenge.prizeAmount > 0 && (
                      <div className="text-right">
                        <p className="text-sm text-dark-400">Prize</p>
                        <div className="flex items-baseline gap-1">
                          <p className="text-xl font-bold text-yellow-400 tabular-nums">
                            {challenge.prizeAmount.toFixed(settings.credits.decimals)}
                          </p>
                          <span className="text-sm text-yellow-500">{settings.credits.symbol}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

