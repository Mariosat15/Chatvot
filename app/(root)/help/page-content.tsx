'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Trophy, 
  TrendingUp, 
  Shield, 
  Award,
  Target,
  HelpCircle,
  ChevronRight,
  Book,
  Coins,
  Info,
  Menu,
  X,
  LayoutDashboard,
  Swords,
  ShoppingBag,
  Medal,
  User,
  Wallet,
  Bell,
  FileText,
  Briefcase,
  Settings,
  BarChart3,
  Clock,
  LineChart,
  Zap,
  Eye,
  Sparkles
} from 'lucide-react';

interface HelpPageContentProps {
  isLoggedIn: boolean;
}

const menuSections = [
  {
    id: 'getting-started',
    title: '🚀 Getting Started',
    icon: Book,
  },
  {
    id: 'dashboard',
    title: '📊 Dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'competitions',
    title: '🏆 Competitions',
    icon: Trophy,
  },
  {
    id: 'challenges',
    title: '⚔️ 1v1 Challenges',
    icon: Swords,
  },
  {
    id: 'trading',
    title: '📈 Trading Guide',
    icon: TrendingUp,
  },
  {
    id: 'marketplace',
    title: '🛒 Marketplace',
    icon: ShoppingBag,
  },
  {
    id: 'leaderboard',
    title: '🥇 Leaderboard',
    icon: Medal,
  },
  {
    id: 'credits',
    title: '💰 Credits & Wallet',
    icon: Coins,
  },
  {
    id: 'profile',
    title: '👤 Profile & Stats',
    icon: User,
  },
  {
    id: 'arsenal',
    title: '🎯 Trading Arsenal',
    icon: Briefcase,
  },
  {
    id: 'notifications',
    title: '🔔 Notifications',
    icon: Bell,
  },
  {
    id: 'trader-levels',
    title: '👑 Trader Levels',
    icon: Award,
  },
  {
    id: 'badge-system',
    title: '🏅 Badge System',
    icon: Award,
  },
  {
    id: 'risk-management',
    title: '🛡️ Risk Management',
    icon: Shield,
  },
  {
    id: 'invoices',
    title: '📄 Invoices & Billing',
    icon: FileText,
  },
  {
    id: 'faq',
    title: '❓ FAQ',
    icon: HelpCircle,
  },
];

export default function HelpPageContent({ isLoggedIn }: HelpPageContentProps) {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    setMobileMenuOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-2xl p-6 sm:p-8 mb-6 shadow-2xl border border-yellow-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Book className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold text-white">Help Center</h1>
              <p className="text-gray-400 text-sm sm:text-base mt-1">Complete guide to mastering the platform</p>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 bg-yellow-500/20 rounded-lg text-white"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Menu - Desktop */}
        <nav className="hidden lg:block w-72 flex-shrink-0">
          <div className="sticky top-6 bg-gray-800/50 rounded-xl p-4 border border-gray-700 max-h-[calc(100vh-6rem)] overflow-y-auto">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Topics</h2>
            <ul className="space-y-1">
              {menuSections.map((section) => {
                const Icon = section.icon;
                return (
                  <li key={section.id}>
                    <button
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                        activeSection === section.id
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{section.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setMobileMenuOpen(false)}>
            <div className="bg-gray-900 w-72 h-full p-4 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Topics</h2>
              <ul className="space-y-1">
                {menuSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <li key={section.id}>
                      <button
                        onClick={() => scrollToSection(section.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                          activeSection === section.id
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                        }`}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm font-medium">{section.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 space-y-6">
          {/* Getting Started */}
          <section id="getting-started" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Book className="h-6 w-6 text-yellow-500" />
              <h2 className="text-2xl font-bold text-white">🚀 Getting Started</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Welcome to ChartVolt!</h3>
                <p className="leading-relaxed">
                  ChartVolt is a simulated trading competition platform where you can test your trading skills, compete with others, and win real prizes. Here&apos;s your quick-start guide:
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold">
                      1
                    </div>
                    <h4 className="font-semibold text-white">Create Account</h4>
                  </div>
                  <p className="text-sm text-gray-400">Sign up with your email and verify your account to get started.</p>
                </div>

                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold">
                      2
                    </div>
                    <h4 className="font-semibold text-white">Add Credits</h4>
                  </div>
                  <p className="text-sm text-gray-400">Go to Wallet and purchase credits with EUR to enter competitions.</p>
                </div>

                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold">
                      3
                    </div>
                    <h4 className="font-semibold text-white">Join Competition</h4>
                  </div>
                  <p className="text-sm text-gray-400">Browse competitions or challenges and join one that matches your style.</p>
                </div>

                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold">
                      4
                    </div>
                    <h4 className="font-semibold text-white">Start Trading</h4>
                  </div>
                  <p className="text-sm text-gray-400">Trade forex pairs, climb the leaderboard, and win credits!</p>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">💡 Quick Navigation:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <Link href="/" className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1">
                    <LayoutDashboard className="h-3 w-3" /> Dashboard
                  </Link>
                  <Link href="/competitions" className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1">
                    <Trophy className="h-3 w-3" /> Competitions
                  </Link>
                  <Link href="/challenges" className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1">
                    <Swords className="h-3 w-3" /> Challenges
                  </Link>
                  <Link href="/marketplace" className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1">
                    <ShoppingBag className="h-3 w-3" /> Marketplace
                  </Link>
                  <Link href="/leaderboard" className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1">
                    <Medal className="h-3 w-3" /> Leaderboard
                  </Link>
                  <Link href="/wallet" className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1">
                    <Wallet className="h-3 w-3" /> Wallet
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Dashboard */}
          <section id="dashboard" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <LayoutDashboard className="h-6 w-6 text-blue-500" />
              <h2 className="text-2xl font-bold text-white">📊 Dashboard</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Your Dashboard is the command center where you can see all your trading activity at a glance.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-400" /> Portfolio Overview
                  </h5>
                  <p className="text-sm text-gray-400">
                    See your total balance, today&apos;s P&L, win rate, and total trades across all competitions.
                  </p>
                </div>

                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-400" /> Active Competitions
                  </h5>
                  <p className="text-sm text-gray-400">
                    Quick access to competitions you&apos;re currently participating in with live rankings.
                  </p>
                </div>

                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <LineChart className="h-4 w-4 text-green-400" /> Performance Charts
                  </h5>
                  <p className="text-sm text-gray-400">
                    Visual charts showing your daily P&L, trading statistics, and performance over time.
                  </p>
                </div>

                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-purple-400" /> Recent Activity
                  </h5>
                  <p className="text-sm text-gray-400">
                    Your latest trades, competition entries, and badge achievements.
                  </p>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">📈 Dashboard Metrics Explained:</h4>
                <ul className="space-y-2 text-sm">
                  <li><span className="text-blue-400 font-medium">Total Balance:</span> Sum of your capital across all active competitions</li>
                  <li><span className="text-green-400 font-medium">Today&apos;s P&L:</span> Profit/Loss for today (realized + unrealized)</li>
                  <li><span className="text-yellow-400 font-medium">Win Rate:</span> Percentage of profitable trades</li>
                  <li><span className="text-purple-400 font-medium">Total Trades:</span> Number of closed trades across all competitions</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Competitions */}
          <section id="competitions" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="h-6 w-6 text-yellow-500" />
              <h2 className="text-2xl font-bold text-white">🏆 Competitions</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Competitions are time-limited trading events where multiple traders compete for prizes. Each competition has its own rules, prize pool, and ranking criteria.
              </p>

              <div>
                <h4 className="font-semibold text-white mb-3">Competition Types:</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <h5 className="font-semibold text-yellow-400 mb-2">🎯 P&L Competitions</h5>
                    <p className="text-sm text-gray-400">Ranked by total profit/loss. The trader with highest P&L wins.</p>
                  </div>

                  <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                    <h5 className="font-semibold text-green-400 mb-2">📊 ROI Competitions</h5>
                    <p className="text-sm text-gray-400">Ranked by return on investment percentage. Best for consistent traders.</p>
                  </div>

                  <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <h5 className="font-semibold text-blue-400 mb-2">🎯 Win Rate Competitions</h5>
                    <p className="text-sm text-gray-400">Ranked by percentage of winning trades. Accuracy matters most.</p>
                  </div>

                  <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                    <h5 className="font-semibold text-purple-400 mb-2">⚡ Volume Competitions</h5>
                    <p className="text-sm text-gray-400">Ranked by number of trades. Great for active day traders.</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">How to Join:</h4>
                <ol className="space-y-2 text-sm">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold flex-shrink-0">1</span>
                    <span>Browse competitions and check the rules, entry fee, and prize pool</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold flex-shrink-0">2</span>
                    <span>Click &quot;Enter Competition&quot; and pay the entry fee in credits</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold flex-shrink-0">3</span>
                    <span>Wait for the competition to start (or start immediately if already live)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold flex-shrink-0">4</span>
                    <span>Click &quot;Trade Now&quot; to open the trading interface</span>
                  </li>
                </ol>
              </div>

              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">⚠️ Competition Rules:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Minimum Trades:</strong> Some competitions require a minimum number of trades to qualify for prizes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Liquidation:</strong> Getting liquidated usually disqualifies you from winning prizes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Tie-breakers:</strong> If tied on the main metric, secondary metrics determine final rank</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span><strong>No Refunds:</strong> Entry fees are non-refundable once paid</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* 1v1 Challenges */}
          <section id="challenges" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Swords className="h-6 w-6 text-red-500" />
              <h2 className="text-2xl font-bold text-white">⚔️ 1v1 Challenges</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                1v1 Challenges are head-to-head trading battles between two traders. You can create a challenge and wait for an opponent, or join an existing challenge.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                  <h5 className="font-semibold text-red-400 mb-2">🎮 Create a Challenge</h5>
                  <p className="text-sm text-gray-400">
                    Set the entry fee, duration, and rules. Wait for an opponent to accept your challenge.
                  </p>
                </div>

                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <h5 className="font-semibold text-blue-400 mb-2">🎯 Join a Challenge</h5>
                  <p className="text-sm text-gray-400">
                    Browse open challenges and accept one that matches your budget and style.
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">Challenge Flow:</h4>
                <div className="space-y-3">
                  <div className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-400">1</div>
                    <div>
                      <p className="font-medium text-white">Matching</p>
                      <p className="text-sm text-gray-400">Creator sets the stakes. Opponent joins and matches the entry fee.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-400">2</div>
                    <div>
                      <p className="font-medium text-white">Trading Period</p>
                      <p className="text-sm text-gray-400">Both traders compete during the set duration (e.g., 1 hour, 24 hours).</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-400">3</div>
                    <div>
                      <p className="font-medium text-white">Winner Determination</p>
                      <p className="text-sm text-gray-400">The trader with the better performance based on the rules wins the prize pool.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">💰 Prize Distribution:</h4>
                <p className="text-sm text-gray-400">
                  Winner takes the combined entry fees (minus platform fee). For example, if both players bet 100 credits, the winner receives ~190 credits (after 5% platform fee).
                </p>
              </div>
            </div>
          </section>

          {/* Trading Guide */}
          <section id="trading" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="h-6 w-6 text-green-500" />
              <h2 className="text-2xl font-bold text-white">📈 Trading Guide</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="font-semibold text-white mb-3">Trading Modes:</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
                      <Settings className="h-4 w-4 text-blue-400" /> Professional Mode
                    </h5>
                    <p className="text-sm text-gray-400 mb-2">
                      Full-featured trading interface with advanced TradingView charts, technical indicators, drawing tools, and detailed order management.
                    </p>
                    <ul className="text-xs text-gray-500 space-y-1">
                      <li>• Interactive candlestick charts</li>
                      <li>• 50+ technical indicators</li>
                      <li>• Drawing tools (trend lines, Fibonacci, etc.)</li>
                      <li>• Multiple chart types (candle, line, Renko, Heikin-Ashi)</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-purple-400" /> Game Mode
                    </h5>
                    <p className="text-sm text-gray-400 mb-2">
                      Simplified gamified interface with quick bet sizes, risk levels, and streamlined chart. Great for beginners.
                    </p>
                    <ul className="text-xs text-gray-500 space-y-1">
                      <li>• Simple UP/DOWN predictions</li>
                      <li>• Quick bet size selection</li>
                      <li>• Visual risk indicators</li>
                      <li>• Simplified order execution</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">Order Types:</h4>
                <div className="space-y-3">
                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-white mb-2">⚡ Market Order</h5>
                    <p className="text-sm text-gray-400">Execute immediately at current market price. Best for quick entries/exits.</p>
                  </div>

                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-white mb-2">📊 Limit Order</h5>
                    <p className="text-sm text-gray-400">
                      Set a specific price to enter. Order executes only when price reaches your level.
                      <span className="block mt-1 text-yellow-400 text-xs">Note: Must be at least 10 pips away from current price.</span>
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">Risk Management Tools:</h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                    <h5 className="font-semibold text-green-400 mb-2">🎯 Take Profit (TP)</h5>
                    <p className="text-sm text-gray-400">Auto-close at profit target</p>
                  </div>

                  <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                    <h5 className="font-semibold text-red-400 mb-2">🛡️ Stop Loss (SL)</h5>
                    <p className="text-sm text-gray-400">Auto-close to limit losses</p>
                  </div>

                  <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <h5 className="font-semibold text-blue-400 mb-2">⚖️ Position Size</h5>
                    <p className="text-sm text-gray-400">Control risk per trade</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">💡 Trading Tips:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>Always use Stop Loss to protect your capital</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>Risk only 1-2% of your capital per trade</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>Markets are closed on weekends - plan accordingly</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>Check the spread cost before trading volatile pairs</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Marketplace */}
          <section id="marketplace" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <ShoppingBag className="h-6 w-6 text-purple-500" />
              <h2 className="text-2xl font-bold text-white">🛒 Marketplace</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                The Marketplace is where you can purchase trading tools, indicators, and strategies created by professional traders to enhance your trading performance.
              </p>

              <div>
                <h4 className="font-semibold text-white mb-3">Available Products:</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                    <h5 className="font-semibold text-purple-400 mb-2 flex items-center gap-2">
                      <LineChart className="h-4 w-4" /> Technical Indicators
                    </h5>
                    <p className="text-sm text-gray-400">
                      Custom indicators that add visual signals to your charts (moving averages, oscillators, trend indicators, etc.)
                    </p>
                  </div>

                  <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <h5 className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
                      <Target className="h-4 w-4" /> Trading Strategies
                    </h5>
                    <p className="text-sm text-gray-400">
                      Complete trading systems with entry/exit rules, buy/sell signals, and risk management guidelines.
                    </p>
                  </div>

                  <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                    <h5 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
                      <Eye className="h-4 w-4" /> Signal Providers
                    </h5>
                    <p className="text-sm text-gray-400">
                      Real-time trade signals and alerts from experienced traders that appear on your charts.
                    </p>
                  </div>

                  <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <h5 className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> Tool Bundles
                    </h5>
                    <p className="text-sm text-gray-400">
                      Discounted packages combining multiple indicators and strategies for better value.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">🛍️ How to Purchase:</h4>
                <ol className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <span className="text-purple-400 font-bold">1.</span>
                    <span>Browse products by category or use the search function</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-purple-400 font-bold">2.</span>
                    <span>Click on a product to see details, reviews, and screenshots</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-purple-400 font-bold">3.</span>
                    <span>Click &quot;Purchase&quot; and pay with your credit balance</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-purple-400 font-bold">4.</span>
                    <span>Access your purchase in the Trading Arsenal section</span>
                  </li>
                </ol>
              </div>
            </div>
          </section>

          {/* Leaderboard */}
          <section id="leaderboard" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Medal className="h-6 w-6 text-amber-500" />
              <h2 className="text-2xl font-bold text-white">🥇 Leaderboard</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                The Global Leaderboard ranks all traders based on their overall performance across all competitions. It&apos;s updated in real-time as traders compete.
              </p>

              <div>
                <h4 className="font-semibold text-white mb-3">Leaderboard Metrics:</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-yellow-400 mb-2">🏆 XP & Level</h5>
                    <p className="text-sm text-gray-400">Total experience points earned from badges. Higher XP = Higher rank.</p>
                  </div>

                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-green-400 mb-2">💰 Total Winnings</h5>
                    <p className="text-sm text-gray-400">Total credits won from all competitions.</p>
                  </div>

                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-blue-400 mb-2">🎯 Win Rate</h5>
                    <p className="text-sm text-gray-400">Percentage of competitions where you finished in prize positions.</p>
                  </div>

                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-purple-400 mb-2">📊 Competitions Won</h5>
                    <p className="text-sm text-gray-400">Number of first-place finishes across all competitions.</p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">🌟 Leaderboard Rewards:</h4>
                <p className="text-sm text-gray-400">
                  Top traders on the leaderboard may receive special badges, exclusive competition access, and recognition on the platform.
                  Climb the ranks by earning badges and winning competitions!
                </p>
              </div>
            </div>
          </section>

          {/* Credits & Wallet */}
          <section id="credits" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Coins className="h-6 w-6 text-yellow-500" />
              <h2 className="text-2xl font-bold text-white">💰 Credits & Wallet</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Credits are the platform currency used for all transactions. You can buy credits with EUR and withdraw your winnings back to EUR.
              </p>

              <div>
                <h4 className="font-semibold text-white mb-3">Wallet Operations:</h4>
                <div className="space-y-3">
                  <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                    <h5 className="font-semibold text-green-400 mb-2">💳 Deposit (Buy Credits)</h5>
                    <p className="text-sm text-gray-400">
                      Use Stripe to purchase credits with EUR. Conversion rate is set by admin (e.g., €1 = 100 credits).
                      Payments are instant and secure.
                    </p>
                  </div>

                  <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <h5 className="font-semibold text-blue-400 mb-2">💸 Withdraw (Credits → EUR)</h5>
                    <p className="text-sm text-gray-400">
                      Request to convert your credits back to EUR. Admin reviews and approves withdrawals within 24-48 hours.
                      A small withdrawal fee may apply.
                    </p>
                  </div>

                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-white mb-2">📜 Transaction History</h5>
                    <p className="text-sm text-gray-400">
                      View all your deposits, withdrawals, competition entries, prizes, and marketplace purchases in one place.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">💡 Wallet Stats:</h4>
                <ul className="space-y-2 text-sm">
                  <li><span className="text-yellow-400 font-medium">Available Balance:</span> Credits you can use for entries or withdraw</li>
                  <li><span className="text-blue-400 font-medium">In Competitions:</span> Credits locked in active competitions</li>
                  <li><span className="text-green-400 font-medium">Total Deposited:</span> Total EUR you&apos;ve deposited</li>
                  <li><span className="text-purple-400 font-medium">Total Withdrawn:</span> Total EUR you&apos;ve withdrawn</li>
                  <li><span className="text-red-400 font-medium">Net Profit:</span> Winnings minus entry fees</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Profile & Stats */}
          <section id="profile" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <User className="h-6 w-6 text-cyan-500" />
              <h2 className="text-2xl font-bold text-white">👤 Profile & Stats</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Your Profile page shows your complete trading history, statistics, badges, and account settings.
              </p>

              <div>
                <h4 className="font-semibold text-white mb-3">Profile Sections:</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-cyan-400 mb-2">📊 Competition Stats</h5>
                    <p className="text-sm text-gray-400">
                      Total competitions entered, wins, podium finishes, best P&L, best ROI, and overall win rate.
                    </p>
                  </div>

                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-purple-400 mb-2">⚔️ Challenge Stats</h5>
                    <p className="text-sm text-gray-400">
                      1v1 challenge history, wins, losses, and head-to-head win rate.
                    </p>
                  </div>

                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-yellow-400 mb-2">🏅 Badge Collection</h5>
                    <p className="text-sm text-gray-400">
                      All badges you&apos;ve earned, organized by category with unlock dates.
                    </p>
                  </div>

                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-green-400 mb-2">👑 Level & XP</h5>
                    <p className="text-sm text-gray-400">
                      Your current trader level, title, XP progress, and next level requirements.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">⚙️ Account Settings:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Profile Picture:</strong> Upload a custom avatar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Display Name:</strong> Change your public trading name</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Password:</strong> Update your account password</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Notification Preferences:</strong> Control what alerts you receive</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Trading Arsenal */}
          <section id="arsenal" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Briefcase className="h-6 w-6 text-orange-500" />
              <h2 className="text-2xl font-bold text-white">🎯 Trading Arsenal</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Your Trading Arsenal contains all the indicators, strategies, and tools you&apos;ve purchased from the Marketplace. Activate them on your charts to gain trading advantages.
              </p>

              <div>
                <h4 className="font-semibold text-white mb-3">How to Use:</h4>
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold flex-shrink-0">1</span>
                    <span>Go to any competition trading view</span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold flex-shrink-0">2</span>
                    <span>Click on &quot;Trading Arsenal&quot; in the toolbar</span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold flex-shrink-0">3</span>
                    <span>Toggle ON the indicators/strategies you want to activate</span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold flex-shrink-0">4</span>
                    <span>Configure settings for each tool (if available)</span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold flex-shrink-0">5</span>
                    <span>See signals and overlays directly on your chart</span>
                  </li>
                </ol>
              </div>

              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">💡 Arsenal Tips:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span>Don&apos;t overload your chart - 2-3 indicators is usually enough</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span>Test new tools in smaller competitions first</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span>Combine indicators from different categories for better signals</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section id="notifications" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="h-6 w-6 text-pink-500" />
              <h2 className="text-2xl font-bold text-white">🔔 Notifications</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Stay informed with real-time notifications about your trading activity, competitions, and important platform updates.
              </p>

              <div>
                <h4 className="font-semibold text-white mb-3">Notification Types:</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                    <h5 className="font-semibold text-green-400 mb-2">📈 Trade Executed</h5>
                    <p className="text-sm text-gray-400">When your market or limit order is filled</p>
                  </div>

                  <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                    <h5 className="font-semibold text-red-400 mb-2">🛑 Trade Closed</h5>
                    <p className="text-sm text-gray-400">When TP, SL, or manual close triggers</p>
                  </div>

                  <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <h5 className="font-semibold text-yellow-400 mb-2">🏆 Competition Started</h5>
                    <p className="text-sm text-gray-400">When a competition you joined goes live</p>
                  </div>

                  <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                    <h5 className="font-semibold text-purple-400 mb-2">🎖️ Competition Ended</h5>
                    <p className="text-sm text-gray-400">Final results and prize distribution</p>
                  </div>

                  <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <h5 className="font-semibold text-blue-400 mb-2">🏅 Badge Earned</h5>
                    <p className="text-sm text-gray-400">When you unlock a new achievement</p>
                  </div>

                  <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
                    <h5 className="font-semibold text-cyan-400 mb-2">💰 Payment Update</h5>
                    <p className="text-sm text-gray-400">Deposit confirmations and withdrawal status</p>
                  </div>
                </div>
              </div>

              <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">⚙️ Notification Settings:</h4>
                <p className="text-sm text-gray-400">
                  Customize which notifications you receive from your Profile settings. You can enable/disable
                  each notification type and choose between in-app and email notifications.
                </p>
              </div>
            </div>
          </section>

          {/* Trader Levels */}
          <section id="trader-levels" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Award className="h-6 w-6 text-yellow-500" />
              <h2 className="text-2xl font-bold text-white">👑 Trader Levels & Titles</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed mb-4">
                As you earn badges, you gain Experience Points (XP) and progress through 10 prestigious trader levels. Each level grants a unique title displayed next to your name!
              </p>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">How to Earn XP:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center p-3 rounded-lg bg-gray-700/50">
                    <p className="text-gray-400 text-xs mb-1">⭐ Common Badge</p>
                    <p className="text-green-400 font-bold text-lg">+10 XP</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gray-700/50">
                    <p className="text-gray-400 text-xs mb-1">💎 Rare Badge</p>
                    <p className="text-blue-400 font-bold text-lg">+25 XP</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gray-700/50">
                    <p className="text-gray-400 text-xs mb-1">👑 Epic Badge</p>
                    <p className="text-purple-400 font-bold text-lg">+50 XP</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gray-700/50">
                    <p className="text-gray-400 text-xs mb-1">🌟 Legendary Badge</p>
                    <p className="text-yellow-400 font-bold text-lg">+100 XP</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">All Trader Levels:</h4>
                <div className="space-y-2">
                  {[
                    { level: 1, title: 'Novice Trader', xp: '0-99 XP', icon: '🌱', color: 'text-gray-400' },
                    { level: 2, title: 'Apprentice Trader', xp: '100-299 XP', icon: '📚', color: 'text-green-400' },
                    { level: 3, title: 'Skilled Trader', xp: '300-599 XP', icon: '⚔️', color: 'text-blue-400' },
                    { level: 4, title: 'Expert Trader', xp: '600-999 XP', icon: '🎯', color: 'text-cyan-400' },
                    { level: 5, title: 'Elite Trader', xp: '1000-1599 XP', icon: '💎', color: 'text-purple-400' },
                    { level: 6, title: 'Master Trader', xp: '1600-2399 XP', icon: '👑', color: 'text-pink-400' },
                    { level: 7, title: 'Grand Master', xp: '2400-3399 XP', icon: '🔥', color: 'text-orange-400' },
                    { level: 8, title: 'Trading Champion', xp: '3400-4599 XP', icon: '⚡', color: 'text-red-400' },
                    { level: 9, title: 'Market Legend', xp: '4600-5999 XP', icon: '🌟', color: 'text-yellow-400' },
                    { level: 10, title: 'Trading God', xp: '6000+ XP', icon: '👑', color: 'text-yellow-300' },
                  ].map((level) => (
                    <div key={level.level} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{level.icon}</span>
                        <div>
                          <p className={`font-semibold ${level.color}`}>{level.title}</p>
                          <p className="text-xs text-gray-500">Level {level.level}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400">{level.xp}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Badge System */}
          <section id="badge-system" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Award className="h-6 w-6 text-purple-500" />
              <h2 className="text-2xl font-bold text-white">🏅 Badge System</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed mb-4">
                Earn badges by achieving specific milestones. Badges are automatically awarded when you meet their criteria, and each badge grants XP towards your trader level!
              </p>

              <div>
                <h4 className="font-semibold text-white mb-3">Badge Categories:</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-white mb-2">🏆 Competition Badges</h5>
                    <p className="text-sm text-gray-400">First place, podium finishes, participation streaks</p>
                  </div>

                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-white mb-2">📈 Trading Badges</h5>
                    <p className="text-sm text-gray-400">Trade milestones, pair diversity, volume achievements</p>
                  </div>

                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-white mb-2">💰 Profit Badges</h5>
                    <p className="text-sm text-gray-400">ROI achievements, win streaks, profit factor</p>
                  </div>

                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-white mb-2">🛡️ Risk Management</h5>
                    <p className="text-sm text-gray-400">Stop loss usage, avoiding liquidation, risk/reward ratio</p>
                  </div>

                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-white mb-2">⚡ Speed & Timing</h5>
                    <p className="text-sm text-gray-400">Quick profits, scalping, timing achievements</p>
                  </div>

                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-white mb-2">🎯 Consistency</h5>
                    <p className="text-sm text-gray-400">Daily trading streaks, sustained performance</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">Badge Rarities:</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">⭐</span>
                      <div>
                        <p className="font-semibold text-gray-400">Common</p>
                        <p className="text-xs text-gray-500">Basic achievements</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">+10 XP</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">💎</span>
                      <div>
                        <p className="font-semibold text-blue-400">Rare</p>
                        <p className="text-xs text-gray-500">Significant accomplishments</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">+25 XP</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">👑</span>
                      <div>
                        <p className="font-semibold text-purple-400">Epic</p>
                        <p className="text-xs text-gray-500">Exceptional achievements</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">+50 XP</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🌟</span>
                      <div>
                        <p className="font-semibold text-yellow-400">Legendary</p>
                        <p className="text-xs text-gray-500">Ultimate mastery</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">+100 XP</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Risk Management */}
          <section id="risk-management" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="h-6 w-6 text-blue-500" />
              <h2 className="text-2xl font-bold text-white">🛡️ Risk Management</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Understanding margin and risk levels is crucial to avoid liquidation and succeed in competitions.
              </p>

              <div>
                <h4 className="font-semibold text-white mb-3">Margin Levels:</h4>
                <div className="space-y-3">
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-green-400">✅ Safe Zone</h5>
                      <span className="text-sm text-green-400">Above 200%</span>
                    </div>
                    <p className="text-sm text-gray-400">Account is healthy with plenty of margin.</p>
                  </div>

                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-yellow-400">⚠️ Warning Zone</h5>
                      <span className="text-sm text-yellow-400">150-200%</span>
                    </div>
                    <p className="text-sm text-gray-400">Caution! Consider reducing position sizes.</p>
                  </div>

                  <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-orange-400">🚨 Margin Call</h5>
                      <span className="text-sm text-orange-400">120-150%</span>
                    </div>
                    <p className="text-sm text-gray-400">Danger! Close positions or risk liquidation.</p>
                  </div>

                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-red-400">❌ Liquidation</h5>
                      <span className="text-sm text-red-400">Below 120%</span>
                    </div>
                    <p className="text-sm text-gray-400">All positions automatically closed by system.</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">🎓 Best Practices:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>Never risk more than 1-2% of capital per trade</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>Always use Stop Loss orders</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>Monitor margin level with multiple open positions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>Liquidation often means disqualification from prizes</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Invoices & Billing */}
          <section id="invoices" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <FileText className="h-6 w-6 text-teal-500" />
              <h2 className="text-2xl font-bold text-white">📄 Invoices & Billing</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                All your financial transactions generate invoices that you can view, download, and use for accounting purposes.
              </p>

              <div>
                <h4 className="font-semibold text-white mb-3">Invoice Types:</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                    <h5 className="font-semibold text-green-400 mb-2">💳 Deposit Invoices</h5>
                    <p className="text-sm text-gray-400">Generated when you purchase credits via Stripe</p>
                  </div>

                  <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <h5 className="font-semibold text-blue-400 mb-2">💸 Withdrawal Receipts</h5>
                    <p className="text-sm text-gray-400">Generated when withdrawals are processed</p>
                  </div>

                  <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                    <h5 className="font-semibold text-purple-400 mb-2">🛒 Purchase Receipts</h5>
                    <p className="text-sm text-gray-400">For marketplace purchases</p>
                  </div>

                  <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <h5 className="font-semibold text-yellow-400 mb-2">🏆 Prize Receipts</h5>
                    <p className="text-sm text-gray-400">Documentation of competition winnings</p>
                  </div>
                </div>
              </div>

              <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">📥 Accessing Invoices:</h4>
                <ol className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <span className="text-teal-400 font-bold">1.</span>
                    <span>Go to your Wallet page</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-teal-400 font-bold">2.</span>
                    <span>Find the transaction in your history</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-teal-400 font-bold">3.</span>
                    <span>Click the invoice icon to view or download PDF</span>
                  </li>
                </ol>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <HelpCircle className="h-6 w-6 text-purple-500" />
              <h2 className="text-2xl font-bold text-white">❓ Frequently Asked Questions</h2>
            </div>
            
            <div className="space-y-4">
              {[
                {
                  q: 'Is this real money trading?',
                  a: 'No, all trading is simulated with virtual capital. However, entry fees and prizes are in real credits that can be converted to EUR.',
                },
                {
                  q: 'How do I buy credits?',
                  a: 'Go to your Wallet, click "Buy Credits", and pay with EUR via Stripe. Credits are added instantly.',
                },
                {
                  q: 'Can I withdraw my winnings?',
                  a: 'Yes! Go to Wallet, request a withdrawal, and admin will process it within 24-48 hours to your bank account.',
                },
                {
                  q: 'What happens if I get liquidated?',
                  a: 'All positions are closed automatically. In most competitions, liquidation disqualifies you from prizes.',
                },
                {
                  q: 'Can I cancel a competition entry?',
                  a: 'No, entry fees are non-refundable once paid. Review competition details carefully before entering.',
                },
                {
                  q: 'When can I trade?',
                  a: 'The forex market is open 24/5 (Monday-Friday). Markets are closed on weekends and major holidays.',
                },
                {
                  q: 'How are ties handled?',
                  a: 'Each competition has specific tie-breaker rules (e.g., fewer trades, higher win rate, earlier entry time).',
                },
                {
                  q: 'Do badges ever expire?',
                  a: 'No, once earned, badges are permanent. Your XP and trader level can only go up, never down.',
                },
                {
                  q: 'Can I see my trade history?',
                  a: 'Yes, go to any active competition and check the "Trade History" tab for all closed trades.',
                },
                {
                  q: 'What\'s the spread cost?',
                  a: 'The spread is the difference between Bid and Ask prices. Every trade pays this cost, reflected in your P&L.',
                },
                {
                  q: 'How do marketplace tools work?',
                  a: 'Purchase indicators/strategies from the Marketplace, then activate them in Trading Arsenal when trading.',
                },
                {
                  q: 'Can I change my leverage?',
                  a: 'No, leverage is set by admin and applies equally to all traders for fair competition.',
                },
              ].map((faq, index) => (
                <div key={index} className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h4 className="font-semibold text-white mb-2">{faq.q}</h4>
                  <p className="text-sm text-gray-400">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Support Section */}
          <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-xl p-6 border border-yellow-500/30 text-center">
            <Info className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Need More Help?</h3>
            <p className="text-gray-300 mb-4">
              If you have questions that aren&apos;t covered here, our support team is ready to assist you.
            </p>
            {isLoggedIn && (
              <div className="flex flex-wrap gap-3 justify-center">
                <Link
                  href="/profile"
                  className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 rounded-lg transition-colors font-medium"
                >
                  View Profile
                </Link>
                <Link
                  href="/competitions"
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium border border-gray-600"
                >
                  Browse Competitions
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
