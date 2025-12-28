'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, 
  TrendingDown, 
  Trophy, 
  Target, 
  Award, 
  BarChart3, 
  Zap, 
  Swords, 
  Wallet,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Flame,
  Clock,
  Users
} from 'lucide-react';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { motion, AnimatePresence } from 'framer-motion';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface ProfileOverviewProps {
  combinedStats: any;
  competitionStats: any;
  challengeStats?: any;
  walletData: any;
}

export default function ProfileOverview({ 
  combinedStats, 
  competitionStats, 
  challengeStats, 
  walletData 
}: ProfileOverviewProps) {
  const { settings, creditsToEUR } = useAppSettings();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    trading: true,
    wallet: true,
    competitions: false,
    challenges: false,
    recentComps: false,
    recentChallenges: false,
  });

  if (!settings) return null;

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="space-y-4">
      {/* Key Stats Row - Always Visible */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<BarChart3 className="w-5 h-5" />}
          label="Total Trades"
          value={combinedStats?.totalTrades || 0}
          color="blue"
        />
        <StatCard
          icon={<Target className="w-5 h-5" />}
          label="Win Rate"
          value={`${(combinedStats?.winRate || 0).toFixed(1)}%`}
          color="green"
          trend={combinedStats?.winRate >= 50 ? 'up' : 'down'}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Total P&L"
          value={`${(combinedStats?.totalPnL || 0) >= 0 ? '+' : ''}${(combinedStats?.totalPnL || 0).toFixed(2)}`}
          color={(combinedStats?.totalPnL || 0) >= 0 ? 'green' : 'red'}
        />
        <StatCard
          icon={<Trophy className="w-5 h-5" />}
          label="Prizes Won"
          value={`${(combinedStats?.totalPrizesWon || 0).toFixed(settings.credits.decimals)} ${settings.credits.symbol}`}
          color="yellow"
        />
      </div>

      {/* Wallet Section */}
      <CollapsibleSection
        title="💰 Wallet"
        icon={<Wallet className="w-5 h-5 text-yellow-500" />}
        isOpen={expandedSections.wallet}
        onToggle={() => toggleSection('wallet')}
        action={
          <Link href="/wallet" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
            View Details <ArrowRight className="w-4 h-4" />
          </Link>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <WalletStatCard
            label="Balance"
            value={walletData?.currentBalance || 0}
            symbol={settings.credits.symbol}
            decimals={settings.credits.decimals}
            variant="primary"
            euroEquivalent={settings.credits.showEUREquivalent ? creditsToEUR(walletData?.currentBalance || 0) : undefined}
            currencySymbol={settings.currency.symbol}
          />
          <WalletStatCard
            label="Bought"
            value={walletData?.totalDeposited || 0}
            symbol={settings.credits.symbol}
            decimals={settings.credits.decimals}
            variant="blue"
          />
          <WalletStatCard
            label="Competition Wins"
            value={walletData?.totalWonFromCompetitions || 0}
            symbol={settings.credits.symbol}
            decimals={settings.credits.decimals}
            variant="green"
            prefix="+"
          />
          <WalletStatCard
            label="Challenge Wins"
            value={walletData?.totalWonFromChallenges || 0}
            symbol={settings.credits.symbol}
            decimals={settings.credits.decimals}
            variant="orange"
            prefix="+"
          />
          <WalletStatCard
            label="Withdrawn"
            value={walletData?.totalWithdrawn || 0}
            symbol={settings.credits.symbol}
            decimals={settings.credits.decimals}
            variant="gray"
          />
        </div>
      </CollapsibleSection>

      {/* Trading Performance Section */}
      <CollapsibleSection
        title="📊 Trading Performance"
        icon={<BarChart3 className="w-5 h-5 text-blue-500" />}
        isOpen={expandedSections.trading}
        onToggle={() => toggleSection('trading')}
        badge="All Activity"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <MiniStat label="Winning" value={combinedStats?.winningTrades || 0} color="text-green-400" />
          <MiniStat label="Losing" value={combinedStats?.losingTrades || 0} color="text-red-400" />
          <MiniStat label="Profit Factor" value={(combinedStats?.profitFactor === 999 ? '∞' : (combinedStats?.profitFactor || 0).toFixed(2))} color="text-purple-400" />
          <MiniStat label="Avg Win" value={`+$${(combinedStats?.averageWin || 0).toFixed(2)}`} color="text-green-400" />
          <MiniStat label="Avg Loss" value={`-$${(combinedStats?.averageLoss || 0).toFixed(2)}`} color="text-red-400" />
          <MiniStat label="Largest Win" value={`+$${(combinedStats?.largestWin || 0).toFixed(2)}`} color="text-green-400" />
          <MiniStat label="Largest Loss" value={`-$${Math.abs(combinedStats?.largestLoss || 0).toFixed(2)}`} color="text-red-400" />
          <MiniStat label="ROI" value={`${(combinedStats?.totalPnLPercentage || 0) >= 0 ? '+' : ''}${(combinedStats?.totalPnLPercentage || 0).toFixed(2)}%`} color={(combinedStats?.totalPnLPercentage || 0) >= 0 ? 'text-green-400' : 'text-red-400'} />
        </div>
      </CollapsibleSection>

      {/* Competition Stats */}
      <CollapsibleSection
        title="🏆 Competition Stats"
        icon={<Trophy className="w-5 h-5 text-yellow-500" />}
        isOpen={expandedSections.competitions}
        onToggle={() => toggleSection('competitions')}
        badge="Competitions Only"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <HighlightCard
            icon={<Award className="w-5 h-5 text-yellow-500" />}
            label="Won"
            value={competitionStats?.competitionsWon || 0}
            subtext={`${competitionStats?.podiumFinishes || 0} podium finishes`}
            gradient="from-yellow-500/20 to-amber-500/10"
            border="border-yellow-500/30"
          />
          <HighlightCard
            icon={<Target className="w-5 h-5 text-blue-500" />}
            label="Entered"
            value={competitionStats?.totalCompetitionsEntered || 0}
            subtext={`${competitionStats?.totalCompetitionsActive || 0} active`}
            gradient="from-blue-500/20 to-blue-600/10"
            border="border-blue-500/30"
          />
          <HighlightCard
            icon={<BarChart3 className="w-5 h-5 text-purple-500" />}
            label="Best Rank"
            value={competitionStats?.bestRank && competitionStats.bestRank > 0 ? `#${competitionStats.bestRank}` : 'N/A'}
            gradient="from-purple-500/20 to-purple-600/10"
            border="border-purple-500/30"
          />
          <HighlightCard
            icon={<Zap className="w-5 h-5 text-green-500" />}
            label="Credits Won"
            value={`${(competitionStats?.totalCreditsWon || 0).toFixed(settings.credits.decimals)}`}
            symbol={settings.credits.symbol}
            gradient="from-green-500/20 to-green-600/10"
            border="border-green-500/30"
          />
        </div>

        {/* Performance Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-slate-800/30 rounded-xl p-3">
          <MiniStat label="P&L" value={`${(competitionStats?.totalPnl || 0) >= 0 ? '+' : ''}${(competitionStats?.totalPnl || 0).toFixed(2)}`} color={(competitionStats?.totalPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'} />
          <MiniStat label="Avg ROI" value={`${(competitionStats?.averageRoi || 0) >= 0 ? '+' : ''}${(competitionStats?.averageRoi || 0).toFixed(2)}%`} color={(competitionStats?.averageRoi || 0) >= 0 ? 'text-green-400' : 'text-red-400'} />
          <MiniStat label="Win Rate" value={`${(competitionStats?.overallWinRate || 0).toFixed(1)}%`} color="text-white" />
          <MiniStat label="Trades" value={competitionStats?.totalTrades || 0} color="text-white" />
          <MiniStat label="Best P&L" value={`+${(competitionStats?.bestPnl || 0).toFixed(2)}`} color="text-green-400" />
          <MiniStat label="Best ROI" value={`+${(competitionStats?.bestRoi || 0).toFixed(2)}%`} color="text-green-400" />
        </div>
      </CollapsibleSection>

      {/* Recent Competitions */}
      {competitionStats?.recentCompetitions?.length > 0 && (
        <CollapsibleSection
          title="📅 Recent Competitions"
          icon={<Clock className="w-5 h-5 text-slate-400" />}
          isOpen={expandedSections.recentComps}
          onToggle={() => toggleSection('recentComps')}
          count={competitionStats.recentCompetitions.length}
        >
          <div className="space-y-2">
            {competitionStats.recentCompetitions.slice(0, 5).map((comp: any) => (
              <CompetitionRow key={comp.competitionId} comp={comp} settings={settings} />
            ))}
            {competitionStats.recentCompetitions.length > 5 && (
              <Link 
                href="/competitions?filter=participated" 
                className="block text-center py-2 text-sm text-blue-400 hover:text-blue-300"
              >
                View all {competitionStats.recentCompetitions.length} competitions
              </Link>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Challenge Stats */}
      {challengeStats && (
        <CollapsibleSection
          title="⚔️ 1v1 Challenge Stats"
          icon={<Swords className="w-5 h-5 text-orange-500" />}
          isOpen={expandedSections.challenges}
          onToggle={() => toggleSection('challenges')}
          badge="Challenges Only"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <HighlightCard
              icon={<Award className="w-5 h-5 text-orange-500" />}
              label="Won"
              value={challengeStats?.totalChallengesWon || 0}
              subtext={`${challengeStats?.totalChallengesLost || 0} lost · ${challengeStats?.totalChallengesTied || 0} tied`}
              gradient="from-orange-500/20 to-red-500/10"
              border="border-orange-500/30"
            />
            <HighlightCard
              icon={<Users className="w-5 h-5 text-blue-500" />}
              label="Entered"
              value={challengeStats?.totalChallengesEntered || 0}
              subtext={`${challengeStats?.totalChallengesActive || 0} active`}
              gradient="from-blue-500/20 to-blue-600/10"
              border="border-blue-500/30"
            />
            <HighlightCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Total P&L"
              value={`${(challengeStats?.totalPnl || 0) >= 0 ? '+' : ''}${(challengeStats?.totalPnl || 0).toFixed(2)}`}
              gradient={(challengeStats?.totalPnl || 0) >= 0 ? 'from-green-500/20 to-green-600/10' : 'from-red-500/20 to-red-600/10'}
              border={(challengeStats?.totalPnl || 0) >= 0 ? 'border-green-500/30' : 'border-red-500/30'}
            />
            <HighlightCard
              icon={<Zap className="w-5 h-5 text-yellow-500" />}
              label="Credits Won"
              value={`${(challengeStats?.totalCreditsWon || 0).toFixed(settings.credits.decimals)}`}
              symbol={settings.credits.symbol}
              gradient="from-yellow-500/20 to-amber-500/10"
              border="border-yellow-500/30"
            />
          </div>
        </CollapsibleSection>
      )}

      {/* Recent Challenges */}
      {challengeStats?.recentChallenges?.length > 0 && (
        <CollapsibleSection
          title="⚔️ Recent Challenges"
          icon={<Clock className="w-5 h-5 text-slate-400" />}
          isOpen={expandedSections.recentChallenges}
          onToggle={() => toggleSection('recentChallenges')}
          count={challengeStats.recentChallenges.length}
        >
          <div className="space-y-2">
            {challengeStats.recentChallenges.slice(0, 5).map((challenge: any) => (
              <ChallengeRow key={challenge.challengeId} challenge={challenge} settings={settings} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Empty State */}
      {!competitionStats?.recentCompetitions?.length && !challengeStats?.recentChallenges?.length && (
        <div className="bg-slate-800/30 rounded-2xl p-8 text-center border border-slate-700/50">
          <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">No Activity Yet</h3>
          <p className="text-slate-400 mb-4">Join competitions or challenge other traders to start building your record!</p>
          <div className="flex justify-center gap-3">
            <Link
              href="/competitions"
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded-lg font-medium transition-colors"
            >
              Browse Competitions
            </Link>
            <Link
              href="/challenges"
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              Find Challengers
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// Component: Stat Card
function StatCard({ 
  icon, 
  label, 
  value, 
  color,
  trend
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number; 
  color: string;
  trend?: 'up' | 'down';
}) {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
    yellow: 'from-yellow-500/20 to-amber-500/10 border-yellow-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  };

  const iconColorClasses: Record<string, string> = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    purple: 'text-purple-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-4 border ${colorClasses[color].split(' ')[2]} hover:scale-[1.02] transition-transform`}>
      <div className={`flex items-center gap-2 ${iconColorClasses[color]} mb-2`}>
        {icon}
        <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
        {trend && (
          trend === 'up' ? 
            <TrendingUp className="w-3 h-3 text-green-400 ml-auto" /> : 
            <TrendingDown className="w-3 h-3 text-red-400 ml-auto" />
        )}
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

// Component: Wallet Stat Card
function WalletStatCard({ 
  label, 
  value, 
  symbol, 
  decimals, 
  variant,
  prefix = '',
  euroEquivalent,
  currencySymbol
}: { 
  label: string; 
  value: number; 
  symbol: string; 
  decimals: number; 
  variant: 'primary' | 'blue' | 'green' | 'orange' | 'gray';
  prefix?: string;
  euroEquivalent?: number;
  currencySymbol?: string;
}) {
  const variants: Record<string, string> = {
    primary: 'bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border-yellow-500/30',
    blue: 'bg-slate-800/50 border-blue-500/20 hover:border-blue-500/40',
    green: 'bg-slate-800/50 border-green-500/20 hover:border-green-500/40',
    orange: 'bg-slate-800/50 border-orange-500/20 hover:border-orange-500/40',
    gray: 'bg-slate-800/50 border-slate-600/20 hover:border-slate-500/40',
  };

  const textColors: Record<string, string> = {
    primary: 'text-white',
    blue: 'text-blue-400',
    green: 'text-green-400',
    orange: 'text-orange-400',
    gray: 'text-slate-400',
  };

  return (
    <div className={`rounded-xl p-3 border ${variants[variant]} transition-all`}>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <p className={`text-lg font-bold tabular-nums ${textColors[variant]}`}>
          {prefix}{value.toFixed(decimals)}
        </p>
        <span className="text-sm text-yellow-500">{symbol}</span>
      </div>
      {euroEquivalent !== undefined && currencySymbol && (
        <p className="text-xs text-slate-500 mt-0.5">≈ {currencySymbol}{euroEquivalent.toFixed(2)}</p>
      )}
    </div>
  );
}

// Component: Mini Stat
function MiniStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="text-center">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

// Component: Highlight Card
function HighlightCard({ 
  icon, 
  label, 
  value, 
  subtext,
  symbol,
  gradient,
  border
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number;
  subtext?: string;
  symbol?: string;
  gradient: string;
  border: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-xl p-4 border ${border}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-slate-300">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        {symbol && <span className="text-lg text-yellow-500">{symbol}</span>}
      </div>
      {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
    </div>
  );
}

// Component: Collapsible Section
function CollapsibleSection({ 
  title, 
  icon, 
  isOpen, 
  onToggle, 
  children,
  badge,
  action,
  count
}: { 
  title: string; 
  icon: React.ReactNode; 
  isOpen: boolean; 
  onToggle: () => void; 
  children: React.ReactNode;
  badge?: string;
  action?: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {badge && (
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
          {count !== undefined && (
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {action && <div onClick={e => e.stopPropagation()}>{action}</div>}
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 pt-0">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Component: Competition Row
function CompetitionRow({ comp, settings }: { comp: any; settings: any }) {
  const statusColors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    upcoming: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };

  return (
    <Link
      href={`/competitions/${comp.competitionId}`}
      className="flex items-center gap-4 p-3 bg-slate-800/50 hover:bg-slate-800/70 rounded-xl border border-slate-700/50 hover:border-slate-600/50 transition-all group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium text-white truncate group-hover:text-blue-400 transition-colors">
            {comp.competitionName}
          </h3>
          <span className={`px-2 py-0.5 text-xs rounded-full border ${statusColors[comp.status] || statusColors.upcoming}`}>
            {comp.status === 'active' && '🔴 LIVE'}
            {comp.status === 'completed' && '✓ DONE'}
            {comp.status === 'upcoming' && '⏳ SOON'}
            {comp.status === 'cancelled' && '✕ CANCELLED'}
          </span>
        </div>
        <p className="text-xs text-slate-400">
          {comp.totalTrades} trades · {comp.winRate.toFixed(1)}% win rate
        </p>
      </div>
      <div className="flex items-center gap-4 text-right text-sm">
        <div>
          <p className="text-xs text-slate-500">Rank</p>
          <p className="font-semibold text-yellow-400">{comp.rank > 0 ? `#${comp.rank}` : '-'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">P&L</p>
          <p className={`font-semibold tabular-nums ${comp.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {comp.pnl >= 0 ? '+' : ''}{comp.pnl.toFixed(2)}
          </p>
        </div>
        {comp.prizeAmount > 0 && (
          <div>
            <p className="text-xs text-slate-500">Prize</p>
            <p className="font-semibold text-yellow-400 tabular-nums">
              {comp.prizeAmount.toFixed(settings.credits.decimals)} {settings.credits.symbol}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}

// Component: Challenge Row
function ChallengeRow({ challenge, settings }: { challenge: any; settings: any }) {
  return (
    <Link
      href={`/challenges/${challenge.challengeId}`}
      className="flex items-center gap-4 p-3 bg-slate-800/50 hover:bg-slate-800/70 rounded-xl border border-slate-700/50 hover:border-orange-500/30 transition-all group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium text-white truncate group-hover:text-orange-400 transition-colors">
            vs {challenge.opponentName}
          </h3>
          {challenge.status === 'active' && (
            <span className="px-2 py-0.5 text-xs rounded-full border bg-green-500/20 text-green-400 border-green-500/30">
              🔴 LIVE
            </span>
          )}
          {challenge.status === 'completed' && (
            <span className={`px-2 py-0.5 text-xs rounded-full border ${
              challenge.isWinner 
                ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}>
              {challenge.isWinner ? '🏆 WON' : '✕ LOST'}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400">{challenge.totalTrades} trades</p>
      </div>
      <div className="flex items-center gap-4 text-right text-sm">
        <div>
          <p className="text-xs text-slate-500">Entry</p>
          <p className="font-semibold text-blue-400">{challenge.entryFee}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">P&L</p>
          <p className={`font-semibold tabular-nums ${challenge.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {challenge.pnl >= 0 ? '+' : ''}{challenge.pnl.toFixed(2)}
          </p>
        </div>
      </div>
    </Link>
  );
}

