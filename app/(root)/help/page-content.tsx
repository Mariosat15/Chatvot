'use client';

import { useState, useEffect } from 'react';
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
  Sparkles,
  Loader2,
  Heart,
  Users
} from 'lucide-react';

interface HelpPageContentProps {
  isLoggedIn: boolean;
}

interface HelpSettings {
  badgeXP: {
    common: number;
    rare: number;
    epic: number;
    legendary: number;
  };
  levels: Array<{
    level: number;
    title: string;
    minXP: number;
    icon: string;
    color: string;
  }>;
  margin: {
    safe: number;
    warning: number;
    marginCall: number;
    liquidation: number;
  };
  leverage: {
    min: number;
    max: number;
    default: number;
  };
  positions: {
    maxOpen: number;
    maxSize: number;
  };
  risk: {
    maxDrawdown: number;
    dailyLossLimit: number;
  };
  credits: {
    name: string;
    symbol: string;
    valueInEUR: number;
    eurToCreditsRate: number;
    minimumDeposit: number;
    minimumWithdrawal: number;
    withdrawalFee: number;
  };
  currency: {
    code: string;
    symbol: string;
    name: string;
  };
}

const menuSections = [
  { id: 'getting-started', title: '🚀 Getting Started', icon: Book },
  { id: 'dashboard', title: '📊 Dashboard', icon: LayoutDashboard },
  { id: 'competitions', title: '🏆 Competitions', icon: Trophy },
  { id: 'challenges', title: '⚔️ 1v1 Challenges', icon: Swords },
  { id: 'matchmaking', title: '💖 Match Cards', icon: Heart },
  { id: 'score-system', title: '⚡ Score System', icon: Zap },
  { id: 'trading', title: '📈 Trading Guide', icon: TrendingUp },
  { id: 'marketplace', title: '🛒 Marketplace', icon: ShoppingBag },
  { id: 'leaderboard', title: '🥇 Leaderboard', icon: Medal },
  { id: 'credits', title: '💰 Credits & Wallet', icon: Coins },
  { id: 'profile', title: '👤 Profile & Stats', icon: User },
  { id: 'arsenal', title: '🎯 Trading Arsenal', icon: Briefcase },
  { id: 'notifications', title: '🔔 Notifications', icon: Bell },
  { id: 'trader-levels', title: '👑 Trader Levels', icon: Award },
  { id: 'badge-system', title: '🏅 Badge System', icon: Award },
  { id: 'risk-management', title: '🛡️ Risk Management', icon: Shield },
  { id: 'invoices', title: '📄 Invoices & Billing', icon: FileText },
  { id: 'faq', title: '❓ FAQ', icon: HelpCircle },
];

// Default settings as fallback
const defaultSettings: HelpSettings = {
  badgeXP: { common: 10, rare: 25, epic: 50, legendary: 100 },
  levels: [
    { level: 1, title: 'Novice Trader', minXP: 0, icon: '🌱', color: 'text-gray-400' },
    { level: 2, title: 'Apprentice Trader', minXP: 100, icon: '📚', color: 'text-green-400' },
    { level: 3, title: 'Skilled Trader', minXP: 300, icon: '⚔️', color: 'text-blue-400' },
    { level: 4, title: 'Expert Trader', minXP: 600, icon: '🎯', color: 'text-cyan-400' },
    { level: 5, title: 'Elite Trader', minXP: 1000, icon: '💎', color: 'text-purple-400' },
    { level: 6, title: 'Master Trader', minXP: 1600, icon: '👑', color: 'text-pink-400' },
    { level: 7, title: 'Grand Master', minXP: 2400, icon: '🔥', color: 'text-orange-400' },
    { level: 8, title: 'Trading Champion', minXP: 3400, icon: '⚡', color: 'text-red-400' },
    { level: 9, title: 'Market Legend', minXP: 4600, icon: '🌟', color: 'text-yellow-400' },
    { level: 10, title: 'Trading God', minXP: 6000, icon: '👑', color: 'text-yellow-300' },
  ],
  margin: { safe: 200, warning: 150, marginCall: 100, liquidation: 50 },
  leverage: { min: 1, max: 500, default: 10 },
  positions: { maxOpen: 10, maxSize: 100 },
  risk: { maxDrawdown: 50, dailyLossLimit: 20 },
  credits: { name: 'Credits', symbol: '⚡', valueInEUR: 1, eurToCreditsRate: 100, minimumDeposit: 10, minimumWithdrawal: 20, withdrawalFee: 2 },
  currency: { code: 'EUR', symbol: '€', name: 'Euro' },
};

export default function HelpPageContent({ isLoggedIn }: HelpPageContentProps) {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState<HelpSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  // Fetch dynamic settings from API
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/help-settings');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.settings) {
            setSettings(data.settings);
          }
        }
      } catch (error) {
        console.error('Error fetching help settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    setMobileMenuOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Helper to format XP range
  const formatXPRange = (index: number) => {
    const current = settings.levels[index];
    const next = settings.levels[index + 1];
    if (!next) return `${current.minXP}+ XP`;
    return `${current.minXP}-${next.minXP - 1} XP`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
          <p className="text-gray-400">Loading Help Center...</p>
        </div>
      </div>
    );
  }

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
              <p className="leading-relaxed">
                Welcome to the trading competition platform! Test your trading skills, compete with others, and win real prizes.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold">1</div>
                    <h4 className="font-semibold text-white">Create Account</h4>
                  </div>
                  <p className="text-sm text-gray-400">Sign up and verify your email to get started.</p>
                </div>

                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold">2</div>
                    <h4 className="font-semibold text-white">Add {settings.credits.name}</h4>
                  </div>
                  <p className="text-sm text-gray-400">Deposit min. {settings.currency.symbol}{settings.credits.minimumDeposit} to get {settings.credits.name.toLowerCase()}.</p>
                </div>

                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold">3</div>
                    <h4 className="font-semibold text-white">Join Competition</h4>
                  </div>
                  <p className="text-sm text-gray-400">Browse and join competitions that match your style.</p>
                </div>

                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold">4</div>
                    <h4 className="font-semibold text-white">Start Trading</h4>
                  </div>
                  <p className="text-sm text-gray-400">Trade forex pairs and compete for the top spot!</p>
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
                Your Dashboard is the command center where you see all trading activity at a glance.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-400" /> Portfolio Overview
                  </h5>
                  <p className="text-sm text-gray-400">Total balance, today&apos;s P&L, win rate, and total trades.</p>
                </div>

                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-400" /> Active Competitions
                  </h5>
                  <p className="text-sm text-gray-400">Quick access to your current competitions with live rankings.</p>
                </div>

                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <LineChart className="h-4 w-4 text-green-400" /> Performance Charts
                  </h5>
                  <p className="text-sm text-gray-400">Daily P&L, statistics, and performance over time.</p>
                </div>

                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-purple-400" /> Recent Activity
                  </h5>
                  <p className="text-sm text-gray-400">Latest trades, entries, and badge achievements.</p>
                </div>
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
                Competitions are time-limited trading events where multiple traders compete for prizes.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                  <h5 className="font-semibold text-yellow-400 mb-2">🎯 P&L Competitions</h5>
                  <p className="text-sm text-gray-400">Ranked by total profit/loss.</p>
                </div>
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                  <h5 className="font-semibold text-green-400 mb-2">📊 ROI Competitions</h5>
                  <p className="text-sm text-gray-400">Ranked by return on investment %.</p>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <h5 className="font-semibold text-blue-400 mb-2">🎯 Win Rate Competitions</h5>
                  <p className="text-sm text-gray-400">Ranked by % of winning trades.</p>
                </div>
                <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                  <h5 className="font-semibold text-purple-400 mb-2">⚡ Volume Competitions</h5>
                  <p className="text-sm text-gray-400">Ranked by number of trades.</p>
                </div>
              </div>

              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">⚠️ Important Rules:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span>Getting liquidated (below {settings.margin.liquidation}% margin) disqualifies you from prizes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span>Entry fees are non-refundable once paid</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span>Max {settings.positions.maxOpen} open positions at a time</span>
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
                Head-to-head trading battles between two traders. Create or join a challenge!
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                  <h5 className="font-semibold text-red-400 mb-2">🎮 Create a Challenge</h5>
                  <p className="text-sm text-gray-400">Set the entry fee, duration, and wait for an opponent.</p>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <h5 className="font-semibold text-blue-400 mb-2">🎯 Join a Challenge</h5>
                  <p className="text-sm text-gray-400">Browse open challenges and accept one.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Match Cards (Matchmaking) */}
          <section id="matchmaking" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Heart className="h-6 w-6 text-pink-500" />
              <h2 className="text-2xl font-bold text-white">💖 Match Cards</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Find the perfect trading opponent using our smart matchmaking system! Swipe through traders and challenge those with similar skill levels.
              </p>

              <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">🎴 How Match Cards Work:</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-3 bg-gray-700/50 rounded-lg">
                    <p className="text-sm"><span className="text-pink-400 font-bold">👈 Swipe Left</span> = Skip this trader</p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg">
                    <p className="text-sm"><span className="text-green-400 font-bold">👉 Swipe Right</span> = Challenge this trader</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                  <h5 className="font-semibold text-purple-400 mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Find Best Match
                  </h5>
                  <p className="text-sm text-gray-400">Our algorithm finds traders with similar stats, experience, and skill level for a fair competition.</p>
                </div>
                <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
                  <h5 className="font-semibold text-cyan-400 mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" /> VS Screen
                  </h5>
                  <p className="text-sm text-gray-400">Before challenging, see a head-to-head comparison of you vs your opponent with stats and profile images.</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">📊 What the Card Shows:</h4>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <p className="text-sm text-gray-400">💖 <span className="text-white">Match %</span> - How well you match</p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <p className="text-sm text-gray-400">🟢 <span className="text-white">Online Status</span> - Is trader online</p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <p className="text-sm text-gray-400">🎯 <span className="text-white">Win Rate</span> - % of winning trades</p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <p className="text-sm text-gray-400">💰 <span className="text-white">P&L</span> - Total profit/loss</p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <p className="text-sm text-gray-400">🏆 <span className="text-white">Competitions</span> - Entries count</p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <p className="text-sm text-gray-400">⚔️ <span className="text-white">1v1 Challenges</span> - Entries count</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">✨ Why You Match Section:</h4>
                <p className="text-sm text-gray-400 mb-3">Each card shows reasons why you&apos;re a good match:</p>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Similar experience level (beginner, intermediate, expert)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Similar profit factor
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Online &amp; ready to compete
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Similar competition experience
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Score System */}
          <section id="score-system" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="h-6 w-6 text-yellow-500" />
              <h2 className="text-2xl font-bold text-white">⚡ Score System</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Your <strong className="text-yellow-400">Score</strong> is a composite rating that represents your overall trading performance. It&apos;s used in the Leaderboard and Match Cards.
              </p>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">📊 How Score is Calculated:</h4>
                <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <p className="text-gray-400 mb-2">// Score Formula</p>
                  <p className="text-white">Score = </p>
                  <p className="text-green-400 ml-4">totalPnl × 0.3 +</p>
                  <p className="text-blue-400 ml-4">totalPnlPercentage × 5 +</p>
                  <p className="text-cyan-400 ml-4">winRate × 2 +</p>
                  <p className="text-purple-400 ml-4">profitFactor × 10 +</p>
                  <p className="text-yellow-400 ml-4">competitionsWon × 50 +</p>
                  <p className="text-orange-400 ml-4">podiumFinishes × 20 +</p>
                  <p className="text-red-400 ml-4">challengesWon × 25 +</p>
                  <p className="text-pink-400 ml-4">totalBadges × 2 +</p>
                  <p className="text-indigo-400 ml-4">legendaryBadges × 10</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">📈 Score Breakdown:</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">💰</span>
                      <div>
                        <p className="font-semibold text-green-400">Total P&L</p>
                        <p className="text-xs text-gray-500">Your cumulative profit/loss</p>
                      </div>
                    </div>
                    <p className="text-sm text-green-400 font-mono">× 0.3 pts</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📈</span>
                      <div>
                        <p className="font-semibold text-blue-400">ROI Percentage</p>
                        <p className="text-xs text-gray-500">Return on investment %</p>
                      </div>
                    </div>
                    <p className="text-sm text-blue-400 font-mono">× 5 pts</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🎯</span>
                      <div>
                        <p className="font-semibold text-cyan-400">Win Rate</p>
                        <p className="text-xs text-gray-500">% of winning trades</p>
                      </div>
                    </div>
                    <p className="text-sm text-cyan-400 font-mono">× 2 pts</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">⚖️</span>
                      <div>
                        <p className="font-semibold text-purple-400">Profit Factor</p>
                        <p className="text-xs text-gray-500">Gross profit ÷ gross loss</p>
                      </div>
                    </div>
                    <p className="text-sm text-purple-400 font-mono">× 10 pts</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🥇</span>
                      <div>
                        <p className="font-semibold text-yellow-400">Competition Wins</p>
                        <p className="text-xs text-gray-500">1st place finishes</p>
                      </div>
                    </div>
                    <p className="text-sm text-yellow-400 font-mono">× 50 pts each</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🏅</span>
                      <div>
                        <p className="font-semibold text-orange-400">Podium Finishes</p>
                        <p className="text-xs text-gray-500">Top 3 finishes</p>
                      </div>
                    </div>
                    <p className="text-sm text-orange-400 font-mono">× 20 pts each</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">⚔️</span>
                      <div>
                        <p className="font-semibold text-red-400">Challenge Wins</p>
                        <p className="text-xs text-gray-500">1v1 challenge victories</p>
                      </div>
                    </div>
                    <p className="text-sm text-red-400 font-mono">× 25 pts each</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-pink-500/10 rounded-lg border border-pink-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🏅</span>
                      <div>
                        <p className="font-semibold text-pink-400">Total Badges</p>
                        <p className="text-xs text-gray-500">All badges earned</p>
                      </div>
                    </div>
                    <p className="text-sm text-pink-400 font-mono">× 2 pts each</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🌟</span>
                      <div>
                        <p className="font-semibold text-indigo-400">Legendary Badges</p>
                        <p className="text-xs text-gray-500">Legendary rarity badges</p>
                      </div>
                    </div>
                    <p className="text-sm text-indigo-400 font-mono">× 10 pts each</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">💡 Example Calculation:</h4>
                <div className="bg-gray-900/50 rounded-lg p-3 text-sm">
                  <p className="text-gray-400 mb-2">A trader with:</p>
                  <ul className="space-y-1 text-gray-300 mb-3">
                    <li>• P&L: $500 → 500 × 0.3 = <span className="text-green-400">150 pts</span></li>
                    <li>• ROI: 8% → 8 × 5 = <span className="text-blue-400">40 pts</span></li>
                    <li>• Win Rate: 60% → 60 × 2 = <span className="text-cyan-400">120 pts</span></li>
                    <li>• Profit Factor: 1.5 → 1.5 × 10 = <span className="text-purple-400">15 pts</span></li>
                    <li>• 2 Competition Wins → 2 × 50 = <span className="text-yellow-400">100 pts</span></li>
                    <li>• 3 Podiums → 3 × 20 = <span className="text-orange-400">60 pts</span></li>
                    <li>• 1 Challenge Win → 1 × 25 = <span className="text-red-400">25 pts</span></li>
                    <li>• 10 Badges → 10 × 2 = <span className="text-pink-400">20 pts</span></li>
                    <li>• 1 Legendary → 1 × 10 = <span className="text-indigo-400">10 pts</span></li>
                  </ul>
                  <p className="text-white font-bold">Total Score: <span className="text-yellow-400">540 pts</span> ⚡</p>
                </div>
              </div>

              <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">📍 Where Score is Shown:</h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="p-3 bg-gray-800/50 rounded-lg flex items-center gap-2">
                    <Medal className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm">Leaderboard rankings</span>
                  </div>
                  <div className="p-3 bg-gray-800/50 rounded-lg flex items-center gap-2">
                    <Heart className="h-4 w-4 text-pink-400" />
                    <span className="text-sm">Match Cards</span>
                  </div>
                  <div className="p-3 bg-gray-800/50 rounded-lg flex items-center gap-2">
                    <User className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm">Profile page</span>
                  </div>
                  <div className="p-3 bg-gray-800/50 rounded-lg flex items-center gap-2">
                    <Swords className="h-4 w-4 text-red-400" />
                    <span className="text-sm">VS Screen comparisons</span>
                  </div>
                </div>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Settings className="h-4 w-4 text-blue-400" /> Professional Mode
                  </h5>
                  <p className="text-sm text-gray-400">Advanced charts, 50+ indicators, drawing tools.</p>
                </div>
                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-purple-400" /> Game Mode
                  </h5>
                  <p className="text-sm text-gray-400">Simplified interface, quick bets, great for beginners.</p>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">⚙️ Trading Parameters:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400">Leverage:</span>
                    <span className="text-white ml-2">{settings.leverage.min}x - {settings.leverage.max}x</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Default Leverage:</span>
                    <span className="text-white ml-2">{settings.leverage.default}x</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Max Positions:</span>
                    <span className="text-white ml-2">{settings.positions.maxOpen}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Max Lot Size:</span>
                    <span className="text-white ml-2">{settings.positions.maxSize}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Daily Loss Limit:</span>
                    <span className="text-white ml-2">{settings.risk.dailyLossLimit}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Max Drawdown:</span>
                    <span className="text-white ml-2">{settings.risk.maxDrawdown}%</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                  <h5 className="font-semibold text-green-400 mb-2">🎯 Take Profit</h5>
                  <p className="text-sm text-gray-400">Auto-close at profit target</p>
                </div>
                <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                  <h5 className="font-semibold text-red-400 mb-2">🛡️ Stop Loss</h5>
                  <p className="text-sm text-gray-400">Auto-close to limit losses</p>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <h5 className="font-semibold text-blue-400 mb-2">⚖️ Position Size</h5>
                  <p className="text-sm text-gray-400">Control risk per trade</p>
                </div>
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
                Purchase trading tools, indicators, and strategies to enhance your trading.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                  <h5 className="font-semibold text-purple-400 mb-2 flex items-center gap-2">
                    <LineChart className="h-4 w-4" /> Technical Indicators
                  </h5>
                  <p className="text-sm text-gray-400">Custom indicators for your charts.</p>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <h5 className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" /> Trading Strategies
                  </h5>
                  <p className="text-sm text-gray-400">Complete systems with entry/exit rules.</p>
                </div>
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                  <h5 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
                    <Eye className="h-4 w-4" /> Signal Providers
                  </h5>
                  <p className="text-sm text-gray-400">Real-time trade signals and alerts.</p>
                </div>
                <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                  <h5 className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Tool Bundles
                  </h5>
                  <p className="text-sm text-gray-400">Discounted indicator packages.</p>
                </div>
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
                The Global Leaderboard ranks all traders based on XP, badges, and overall performance.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-yellow-400 mb-2">🏆 XP & Level</h5>
                  <p className="text-sm text-gray-400">Total experience points from badges.</p>
                </div>
                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-green-400 mb-2">💰 Total Winnings</h5>
                  <p className="text-sm text-gray-400">Total {settings.credits.name.toLowerCase()} won.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Credits & Wallet */}
          <section id="credits" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Coins className="h-6 w-6 text-yellow-500" />
              <h2 className="text-2xl font-bold text-white">💰 {settings.credits.name} & Wallet</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                {settings.credits.name} ({settings.credits.symbol}) are the platform currency. Buy with {settings.currency.code} and withdraw your winnings.
              </p>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">💱 Conversion Rate:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Rate:</p>
                    <p className="text-white font-bold">{settings.currency.symbol}1 = {settings.credits.eurToCreditsRate} {settings.credits.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Min. Deposit:</p>
                    <p className="text-white font-bold">{settings.currency.symbol}{settings.credits.minimumDeposit}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Min. Withdrawal:</p>
                    <p className="text-white font-bold">{settings.currency.symbol}{settings.credits.minimumWithdrawal}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Withdrawal Fee:</p>
                    <p className="text-white font-bold">{settings.credits.withdrawalFee}%</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                  <h5 className="font-semibold text-green-400 mb-2">💳 Buy {settings.credits.name}</h5>
                  <p className="text-sm text-gray-400">
                    Pay {settings.currency.symbol}{settings.credits.minimumDeposit} → Get {settings.credits.minimumDeposit * settings.credits.eurToCreditsRate} {settings.credits.name}
                  </p>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <h5 className="font-semibold text-blue-400 mb-2">💸 Withdraw</h5>
                  <p className="text-sm text-gray-400">
                    Convert {settings.credits.name} back to {settings.currency.code} (minus {settings.credits.withdrawalFee}% fee)
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Profile */}
          <section id="profile" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <User className="h-6 w-6 text-cyan-500" />
              <h2 className="text-2xl font-bold text-white">👤 Profile & Stats</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Your Profile shows trading history, statistics, badges, and account settings.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-cyan-400 mb-2">📊 Competition Stats</h5>
                  <p className="text-sm text-gray-400">Entries, wins, podiums, best P&L.</p>
                </div>
                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-yellow-400 mb-2">🏅 Badge Collection</h5>
                  <p className="text-sm text-gray-400">All earned badges organized by category.</p>
                </div>
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
                Your purchased indicators, strategies, and tools. Activate them on your charts.
              </p>

              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">💡 How to Use:</h4>
                <ol className="space-y-2 text-sm">
                  <li>1. Go to any competition trading view</li>
                  <li>2. Click &quot;Trading Arsenal&quot; in the toolbar</li>
                  <li>3. Toggle ON the tools you want to activate</li>
                  <li>4. See signals directly on your chart</li>
                </ol>
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
                Stay informed with real-time notifications about trading activity and competitions.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                  <h5 className="font-semibold text-green-400">📈 Trade Executed</h5>
                </div>
                <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                  <h5 className="font-semibold text-red-400">🛑 Trade Closed</h5>
                </div>
                <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                  <h5 className="font-semibold text-yellow-400">🏆 Competition Started</h5>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <h5 className="font-semibold text-blue-400">🏅 Badge Earned</h5>
                </div>
              </div>
            </div>
          </section>

          {/* Trader Levels - DYNAMIC */}
          <section id="trader-levels" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Award className="h-6 w-6 text-yellow-500" />
              <h2 className="text-2xl font-bold text-white">👑 Trader Levels & Titles</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed mb-4">
                Earn badges to gain Experience Points (XP) and progress through {settings.levels.length} prestigious trader levels!
              </p>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">How to Earn XP:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center p-3 rounded-lg bg-gray-700/50">
                    <p className="text-gray-400 text-xs mb-1">⭐ Common Badge</p>
                    <p className="text-green-400 font-bold text-lg">+{settings.badgeXP.common} XP</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gray-700/50">
                    <p className="text-gray-400 text-xs mb-1">💎 Rare Badge</p>
                    <p className="text-blue-400 font-bold text-lg">+{settings.badgeXP.rare} XP</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gray-700/50">
                    <p className="text-gray-400 text-xs mb-1">👑 Epic Badge</p>
                    <p className="text-purple-400 font-bold text-lg">+{settings.badgeXP.epic} XP</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gray-700/50">
                    <p className="text-gray-400 text-xs mb-1">🌟 Legendary Badge</p>
                    <p className="text-yellow-400 font-bold text-lg">+{settings.badgeXP.legendary} XP</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">All Trader Levels:</h4>
                <div className="space-y-2">
                  {settings.levels.map((level, index) => (
                    <div key={level.level} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{level.icon}</span>
                        <div>
                          <p className={`font-semibold ${level.color}`}>{level.title}</p>
                          <p className="text-xs text-gray-500">Level {level.level}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400">{formatXPRange(index)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Badge System - DYNAMIC */}
          <section id="badge-system" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Award className="h-6 w-6 text-purple-500" />
              <h2 className="text-2xl font-bold text-white">🏅 Badge System</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed mb-4">
                Earn badges by achieving milestones. Each badge grants XP towards your trader level!
              </p>

              <div>
                <h4 className="font-semibold text-white mb-3">Badge Categories:</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-white mb-2">🏆 Competition</h5>
                    <p className="text-sm text-gray-400">First place, podiums, streaks</p>
                  </div>
                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-white mb-2">📈 Trading</h5>
                    <p className="text-sm text-gray-400">Milestones, diversity, volume</p>
                  </div>
                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-white mb-2">💰 Profit</h5>
                    <p className="text-sm text-gray-400">ROI, win streaks, profit factor</p>
                  </div>
                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-white mb-2">🛡️ Risk Management</h5>
                    <p className="text-sm text-gray-400">Stop loss usage, avoiding liquidation</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">Badge Rarities & XP:</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">⭐</span>
                      <p className="font-semibold text-gray-400">Common</p>
                    </div>
                    <p className="text-sm text-green-400 font-bold">+{settings.badgeXP.common} XP</p>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">💎</span>
                      <p className="font-semibold text-blue-400">Rare</p>
                    </div>
                    <p className="text-sm text-blue-400 font-bold">+{settings.badgeXP.rare} XP</p>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">👑</span>
                      <p className="font-semibold text-purple-400">Epic</p>
                    </div>
                    <p className="text-sm text-purple-400 font-bold">+{settings.badgeXP.epic} XP</p>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🌟</span>
                      <p className="font-semibold text-yellow-400">Legendary</p>
                    </div>
                    <p className="text-sm text-yellow-400 font-bold">+{settings.badgeXP.legendary} XP</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Risk Management - DYNAMIC */}
          <section id="risk-management" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="h-6 w-6 text-blue-500" />
              <h2 className="text-2xl font-bold text-white">🛡️ Risk Management</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Understanding margin levels is crucial to avoid liquidation and succeed in competitions.
              </p>

              <div>
                <h4 className="font-semibold text-white mb-3">Margin Levels:</h4>
                <div className="space-y-3">
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-green-400">✅ Safe Zone</h5>
                      <span className="text-sm text-green-400">Above {settings.margin.safe}%</span>
                    </div>
                    <p className="text-sm text-gray-400">Account is healthy with plenty of margin.</p>
                  </div>

                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-yellow-400">⚠️ Warning Zone</h5>
                      <span className="text-sm text-yellow-400">{settings.margin.warning + 1}% - {settings.margin.safe}%</span>
                    </div>
                    <p className="text-sm text-gray-400">Caution! Consider reducing position sizes.</p>
                  </div>

                  <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-orange-400">🚨 Margin Call</h5>
                      <span className="text-sm text-orange-400">{settings.margin.marginCall + 1}% - {settings.margin.warning}%</span>
                    </div>
                    <p className="text-sm text-gray-400">Danger! Close positions or risk liquidation.</p>
                  </div>

                  <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-red-500">⚠️ Danger Zone</h5>
                      <span className="text-sm text-red-500">{settings.margin.liquidation + 1}% - {settings.margin.marginCall}%</span>
                    </div>
                    <p className="text-sm text-gray-400">Danger! You&apos;re approaching liquidation. Close some trades or risk automatic liquidation.</p>
                  </div>

                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-red-400">❌ Liquidation</h5>
                      <span className="text-sm text-red-400">Below {settings.margin.liquidation}%</span>
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
                    <span>Never risk more than {settings.risk.dailyLossLimit}% of capital daily</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>Always use Stop Loss orders</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>Keep max {settings.positions.maxOpen} positions open</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>Stay above {settings.margin.safe}% margin level</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Invoices */}
          <section id="invoices" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <FileText className="h-6 w-6 text-teal-500" />
              <h2 className="text-2xl font-bold text-white">📄 Invoices & Billing</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                All transactions generate invoices for your records.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                  <h5 className="font-semibold text-green-400">💳 Deposit Invoices</h5>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <h5 className="font-semibold text-blue-400">💸 Withdrawal Receipts</h5>
                </div>
                <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                  <h5 className="font-semibold text-purple-400">🛒 Purchase Receipts</h5>
                </div>
                <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                  <h5 className="font-semibold text-yellow-400">🏆 Prize Receipts</h5>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <HelpCircle className="h-6 w-6 text-purple-500" />
              <h2 className="text-2xl font-bold text-white">❓ FAQ</h2>
            </div>
            
            <div className="space-y-4">
              {[
                { q: 'Is this real money trading?', a: `No, trading is simulated. Entry fees and prizes are in ${settings.credits.name} (${settings.currency.code}).` },
                { q: `How do I buy ${settings.credits.name}?`, a: `Go to Wallet, click "Buy ${settings.credits.name}", minimum ${settings.currency.symbol}${settings.credits.minimumDeposit}.` },
                { q: 'Can I withdraw my winnings?', a: `Yes! Minimum withdrawal is ${settings.currency.symbol}${settings.credits.minimumWithdrawal} with ${settings.credits.withdrawalFee}% fee.` },
                { q: 'What happens if I get liquidated?', a: `All positions close at ${settings.margin.liquidation}% margin. You may be disqualified from prizes.` },
                { q: 'Can I change my leverage?', a: `Leverage is set between ${settings.leverage.min}x - ${settings.leverage.max}x (default ${settings.leverage.default}x).` },
                { q: 'How many positions can I open?', a: `Maximum ${settings.positions.maxOpen} open positions at a time.` },
                { q: 'Do badges expire?', a: `No, badges are permanent. XP can only go up!` },
                { q: 'When is the market open?', a: 'Forex markets are open 24/5 (Monday-Friday), closed weekends.' },
              ].map((faq, index) => (
                <div key={index} className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h4 className="font-semibold text-white mb-2">{faq.q}</h4>
                  <p className="text-sm text-gray-400">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Support */}
          <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-xl p-6 border border-yellow-500/30 text-center">
            <Info className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Need More Help?</h3>
            <p className="text-gray-300 mb-4">
              Our support team is ready to assist you.
            </p>
            {isLoggedIn && (
              <div className="flex flex-wrap gap-3 justify-center">
                <Link href="/profile" className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 rounded-lg transition-colors font-medium">
                  View Profile
                </Link>
                <Link href="/competitions" className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium border border-gray-600">
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
