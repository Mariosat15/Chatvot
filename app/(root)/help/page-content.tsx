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
  X
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
    id: 'trader-levels',
    title: '👑 Trader Levels & Titles',
    icon: Trophy,
  },
  {
    id: 'badge-system',
    title: '🏆 Badge System',
    icon: Award,
  },
  {
    id: 'competitions',
    title: '🎯 Competitions',
    icon: Target,
  },
  {
    id: 'trading',
    title: '📈 Trading Guide',
    icon: TrendingUp,
  },
  {
    id: 'credits',
    title: '💰 Credits & Wallet',
    icon: Coins,
  },
  {
    id: 'risk-management',
    title: '🛡️ Risk Management',
    icon: Shield,
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
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 sm:p-8 mb-6 shadow-2xl border border-primary-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-primary-500/20 flex items-center justify-center">
              <Book className="h-6 w-6 sm:h-8 sm:w-8 text-primary-300" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold text-white">Help Center</h1>
              <p className="text-primary-200 text-sm sm:text-base mt-1">Everything you need to know about trading competitions</p>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 bg-primary-500/20 rounded-lg text-white"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Menu - Desktop */}
        <nav className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-6 bg-dark-800/50 rounded-xl p-4 border border-dark-600">
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
                          ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                          : 'text-gray-400 hover:bg-dark-700 hover:text-white'
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
            <div className="bg-dark-800 w-64 h-full p-4" onClick={(e) => e.stopPropagation()}>
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
                            ? 'bg-primary-600 text-white'
                            : 'text-gray-400 hover:bg-dark-700 hover:text-white'
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
          <section id="getting-started" className="bg-dark-800/50 rounded-xl p-6 border border-dark-600 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Book className="h-6 w-6 text-primary-500" />
              <h2 className="text-2xl font-bold text-white">🚀 Getting Started</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Welcome to the Trading Platform!</h3>
                <p className="leading-relaxed">
                  This platform offers simulated trading competitions where you can test your trading skills, compete with others, and win real prizes. Here&apos;s how to get started:
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold">
                      1
                    </div>
                    <h4 className="font-semibold text-white">Create Account</h4>
                  </div>
                  <p className="text-sm text-gray-400">Sign up and verify your email to get started.</p>
                </div>

                <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold">
                      2
                    </div>
                    <h4 className="font-semibold text-white">Add Credits</h4>
                  </div>
                  <p className="text-sm text-gray-400">Purchase credits to enter competitions.</p>
                </div>

                <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold">
                      3
                    </div>
                    <h4 className="font-semibold text-white">Join Competition</h4>
                  </div>
                  <p className="text-sm text-gray-400">Browse and join competitions that match your skill level.</p>
                </div>

                <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold">
                      4
                    </div>
                    <h4 className="font-semibold text-white">Start Trading</h4>
                  </div>
                  <p className="text-sm text-gray-400">Trade forex pairs and compete for the top spot!</p>
                </div>
              </div>
            </div>
          </section>

          {/* Trader Levels & Titles */}
          <section id="trader-levels" className="bg-dark-800/50 rounded-xl p-6 border border-dark-600 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="h-6 w-6 text-yellow-500" />
              <h2 className="text-2xl font-bold text-white">👑 Trader Levels & Titles</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <div>
                <p className="leading-relaxed mb-4">
                  As you earn badges, you gain Experience Points (XP) and progress through 10 prestigious trader levels. Each level grants you a unique title that is displayed next to your name in leaderboards!
                </p>
              </div>

              <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">How to Earn XP:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center p-3 rounded-lg bg-dark-700/50">
                    <p className="text-gray-400 text-xs mb-1">⭐ Common Badge</p>
                    <p className="text-green-400 font-bold text-lg">+10 XP</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-dark-700/50">
                    <p className="text-gray-400 text-xs mb-1">💎 Rare Badge</p>
                    <p className="text-blue-400 font-bold text-lg">+25 XP</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-dark-700/50">
                    <p className="text-gray-400 text-xs mb-1">👑 Epic Badge</p>
                    <p className="text-purple-400 font-bold text-lg">+50 XP</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-dark-700/50">
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
                    <div key={level.level} className="flex items-center justify-between p-3 bg-dark-700/50 rounded-lg border border-dark-600">
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
          <section id="badge-system" className="bg-dark-800/50 rounded-xl p-6 border border-dark-600 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Award className="h-6 w-6 text-purple-500" />
              <h2 className="text-2xl font-bold text-white">🏆 Badge System</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <div>
                <p className="leading-relaxed mb-4">
                  Earn badges by achieving specific milestones and accomplishments. Badges are automatically awarded when you meet their criteria, and each badge grants you XP towards your trader level!
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">Badge Categories:</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                    <h5 className="font-semibold text-white mb-2">🏆 Competition Badges</h5>
                    <p className="text-sm text-gray-400">Awarded for competition participation and achievements like first place, podium finishes, and consistency.</p>
                  </div>

                  <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                    <h5 className="font-semibold text-white mb-2">📈 Trading Badges</h5>
                    <p className="text-sm text-gray-400">Earned through trading activity, including trade milestones, diverse pair trading, and trade frequency.</p>
                  </div>

                  <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                    <h5 className="font-semibold text-white mb-2">💰 Profit Badges</h5>
                    <p className="text-sm text-gray-400">Awarded for profit achievements, high ROI, win streaks, and profit factor milestones.</p>
                  </div>

                  <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                    <h5 className="font-semibold text-white mb-2">🛡️ Risk Management Badges</h5>
                    <p className="text-sm text-gray-400">Recognition for responsible trading, using stop losses, avoiding liquidation, and maintaining good risk/reward ratios.</p>
                  </div>

                  <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                    <h5 className="font-semibold text-white mb-2">⚡ Speed & Timing Badges</h5>
                    <p className="text-sm text-gray-400">Earned for quick profits, day trading, and taking advantage of market opportunities.</p>
                  </div>

                  <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                    <h5 className="font-semibold text-white mb-2">🎯 Consistency Badges</h5>
                    <p className="text-sm text-gray-400">Awarded for sustained performance, daily trading streaks, and maintaining positive results.</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">Badge Rarities:</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-dark-700/50 rounded-lg border border-dark-600">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-600/30 flex items-center justify-center text-xl">
                        ⭐
                      </div>
                      <div>
                        <p className="font-semibold text-gray-400">Common</p>
                        <p className="text-xs text-gray-500">Basic achievements</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">+10 XP</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-dark-700/50 rounded-lg border border-blue-600/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600/30 flex items-center justify-center text-xl">
                        💎
                      </div>
                      <div>
                        <p className="font-semibold text-blue-400">Rare</p>
                        <p className="text-xs text-gray-500">Significant accomplishments</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">+25 XP</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-dark-700/50 rounded-lg border border-purple-600/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-600/30 flex items-center justify-center text-xl">
                        👑
                      </div>
                      <div>
                        <p className="font-semibold text-purple-400">Epic</p>
                        <p className="text-xs text-gray-500">Exceptional achievements</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">+50 XP</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-dark-700/50 rounded-lg border border-yellow-600/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-600/30 flex items-center justify-center text-xl">
                        🌟
                      </div>
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

          {/* Competitions */}
          <section id="competitions" className="bg-dark-800/50 rounded-xl p-6 border border-dark-600 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Target className="h-6 w-6 text-orange-500" />
              <h2 className="text-2xl font-bold text-white">🎯 Competitions</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <div>
                <p className="leading-relaxed mb-4">
                  Competitions are time-limited trading events where you compete against other traders. Each competition has specific rules, prize pools, and ranking methods.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">How Competitions Work:</h4>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold flex-shrink-0">
                      1
                    </div>
                    <div>
                      <h5 className="font-semibold text-white">Entry Fee</h5>
                      <p className="text-sm text-gray-400">Pay the entry fee in credits to join the competition.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold flex-shrink-0">
                      2
                    </div>
                    <div>
                      <h5 className="font-semibold text-white">Starting Capital</h5>
                      <p className="text-sm text-gray-400">Everyone starts with the same virtual trading capital (e.g., 10,000 points).</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold flex-shrink-0">
                      3
                    </div>
                    <div>
                      <h5 className="font-semibold text-white">Trading Period</h5>
                      <p className="text-sm text-gray-400">Trade forex pairs during the competition timeframe (e.g., 24 hours, 3 days, 1 week).</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold flex-shrink-0">
                      4
                    </div>
                    <div>
                      <h5 className="font-semibold text-white">Ranking</h5>
                      <p className="text-sm text-gray-400">Competitors are ranked based on the competition rules (e.g., P&L, ROI, Win Rate).</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold flex-shrink-0">
                      5
                    </div>
                    <div>
                      <h5 className="font-semibold text-white">Prize Distribution</h5>
                      <p className="text-sm text-gray-400">Winners receive credits based on the prize pool distribution (e.g., 50% for 1st, 30% for 2nd, 20% for 3rd).</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">💡 Competition Tips:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>Review the competition rules before entering - some rank by ROI, others by total P&L.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>Check minimum trade requirements - you may need a certain number of trades to qualify for prizes.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>Understand tie-breaker rules - if tied on the main metric, the tiebreaker determines your final rank.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>Avoid liquidation - many competitions disqualify traders who get liquidated.</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Trading Guide */}
          <section id="trading" className="bg-dark-800/50 rounded-xl p-6 border border-dark-600 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="h-6 w-6 text-green-500" />
              <h2 className="text-2xl font-bold text-white">📈 Trading Guide</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="font-semibold text-white mb-3">Trading Modes:</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                    <h5 className="font-semibold text-white mb-2">⚙️ Professional Mode</h5>
                    <p className="text-sm text-gray-400">
                      Full-featured trading interface with advanced charts, technical indicators, drawing tools, and detailed order management. Perfect for experienced traders.
                    </p>
                  </div>

                  <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                    <h5 className="font-semibold text-white mb-2">🎮 Game Mode</h5>
                    <p className="text-sm text-gray-400">
                      Simplified trading interface with gaming elements, quick bet sizes, risk levels, and a gamified chart. Great for beginners and casual traders.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">Order Types:</h4>
                <div className="space-y-3">
                  <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                    <h5 className="font-semibold text-white mb-2">⚡ Market Orders</h5>
                    <p className="text-sm text-gray-400">
                      Execute immediately at current market price. Best for entering/exiting positions quickly.
                    </p>
                  </div>

                  <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                    <h5 className="font-semibold text-white mb-2">📊 Limit Orders</h5>
                    <p className="text-sm text-gray-400">
                      Set a specific price at which you want to enter the market. Order executes only when price reaches your limit price. Must be at least 10 pips away from current market price.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">Risk Management Tools:</h4>
                <div className="space-y-3">
                  <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                    <h5 className="font-semibold text-white mb-2">🎯 Take Profit (TP)</h5>
                    <p className="text-sm text-gray-400">
                      Automatically close your position when it reaches a profit target. Set in pips or actual price.
                    </p>
                  </div>

                  <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                    <h5 className="font-semibold text-white mb-2">🛡️ Stop Loss (SL)</h5>
                    <p className="text-sm text-gray-400">
                      Automatically close your position to limit losses if the price moves against you. Set in pips or actual price.
                    </p>
                  </div>

                  <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                    <h5 className="font-semibold text-white mb-2">⚖️ Position Sizing</h5>
                    <p className="text-sm text-gray-400">
                      Control your trade size (lots). Be mindful of your margin and leverage to avoid margin calls.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">⚠️ Important Notes:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>Leverage is controlled by the admin. You cannot change it, but it amplifies both gains and losses.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>Market is closed on weekends and holidays. Limit orders will not trigger during these times.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>Always use Stop Loss to protect your capital and avoid liquidation.</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Credits & Wallet */}
          <section id="credits" className="bg-dark-800/50 rounded-xl p-6 border border-dark-600 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Coins className="h-6 w-6 text-yellow-500" />
              <h2 className="text-2xl font-bold text-white">💰 Credits & Wallet</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <div>
                <p className="leading-relaxed mb-4">
                  Credits are the platform currency used to enter competitions and receive prizes. You can deposit EUR to buy credits and withdraw credits back to EUR.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">Credit Operations:</h4>
                <div className="space-y-3">
                  <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                    <h5 className="font-semibold text-white mb-2">💳 Buy Credits (EUR → Credits)</h5>
                    <p className="text-sm text-gray-400 mb-2">
                      Use Stripe to purchase credits with EUR. Conversion rate is set by admin (e.g., €1 = 100 credits).
                    </p>
                    <p className="text-xs text-gray-500">Example: Pay €10 → Receive 1,000 credits</p>
                  </div>

                  <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                    <h5 className="font-semibold text-white mb-2">💸 Withdrawal (Credits → EUR)</h5>
                    <p className="text-sm text-gray-400 mb-2">
                      Request to withdraw your available credits back to EUR. Admin reviews and approves withdrawals. A withdrawal fee may apply.
                    </p>
                    <p className="text-xs text-gray-500">Example: Withdraw 1,000 credits (minus 2% fee) → Receive €9.80</p>
                  </div>

                  <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                    <h5 className="font-semibold text-white mb-2">🎯 Competition Entry</h5>
                    <p className="text-sm text-gray-400">
                      Credits are deducted from your balance when you enter a competition. Entry fees go to the prize pool.
                    </p>
                  </div>

                  <div className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                    <h5 className="font-semibold text-white mb-2">🏆 Prize Winnings</h5>
                    <p className="text-sm text-gray-400">
                      Credits are added to your balance when you win prizes. Use them to enter more competitions or withdraw to EUR.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">💡 Wallet Tips:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>Check your wallet balance before entering competitions.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>Track your net profit to see how much you&apos;ve won vs. spent.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>Withdrawal requests are processed by admin, typically within 24-48 hours.</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Risk Management */}
          <section id="risk-management" className="bg-dark-800/50 rounded-xl p-6 border border-dark-600 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="h-6 w-6 text-blue-500" />
              <h2 className="text-2xl font-bold text-white">🛡️ Risk Management</h2>
            </div>
            
            <div className="space-y-4 text-gray-300">
              <div>
                <p className="leading-relaxed mb-4">
                  Understanding margin and risk levels is crucial to avoid liquidation and succeed in competitions.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">Margin Levels:</h4>
                <div className="space-y-3">
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-green-400">✅ Safe Zone</h5>
                      <span className="text-sm text-green-400">Above 200%</span>
                    </div>
                    <p className="text-sm text-gray-400">Your account is healthy. You have plenty of margin available.</p>
                  </div>

                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-yellow-400">⚠️ Warning Zone</h5>
                      <span className="text-sm text-yellow-400">150-200%</span>
                    </div>
                    <p className="text-sm text-gray-400">Caution! Your margin is getting low. Consider closing some positions.</p>
                  </div>

                  <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-orange-400">🚨 Margin Call</h5>
                      <span className="text-sm text-orange-400">120-150%</span>
                    </div>
                    <p className="text-sm text-gray-400">Danger! You&apos;re approaching liquidation. Close some trades or risk automatic liquidation.</p>
                  </div>

                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-red-400">❌ Liquidation</h5>
                      <span className="text-sm text-red-400">Below 120%</span>
                    </div>
                    <p className="text-sm text-gray-400">All positions are automatically closed by the system to protect your capital.</p>
                  </div>
                </div>
              </div>

              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">🎓 Risk Management Best Practices:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span>Never risk more than 1-2% of your capital on a single trade.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span>Always use Stop Loss orders to limit your downside.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span>Monitor your margin level regularly, especially with multiple open positions.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span>Use appropriate position sizing - the system will warn you if a trade would push your margin too low.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span>Liquidation often results in disqualification from competitions.</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="bg-dark-800/50 rounded-xl p-6 border border-dark-600 scroll-mt-6">
            <div className="flex items-center gap-3 mb-6">
              <HelpCircle className="h-6 w-6 text-purple-500" />
              <h2 className="text-2xl font-bold text-white">❓ FAQ</h2>
            </div>
            
            <div className="space-y-4">
              {[
                {
                  q: 'Is this real money trading?',
                  a: 'No, all trading in competitions is simulated with virtual capital. However, the entry fees and prizes are in real credits that can be converted to EUR.',
                },
                {
                  q: 'Can I change my leverage?',
                  a: 'No, leverage is set by the admin and applies to all traders equally. This ensures fair competition.',
                },
                {
                  q: 'What happens if I get liquidated?',
                  a: 'All your positions are closed automatically. In most competitions, liquidation results in disqualification from prizes.',
                },
                {
                  q: 'Can I cancel a competition entry?',
                  a: 'No, once you enter a competition and pay the entry fee, it is non-refundable. Make sure to review the competition details before entering.',
                },
                {
                  q: 'How long do withdrawals take?',
                  a: 'Withdrawal requests are reviewed by admin, typically processed within 24-48 hours. You\'ll receive a notification when approved.',
                },
                {
                  q: 'Can I trade during weekends?',
                  a: 'The forex market is closed on weekends and holidays. You cannot place orders or have pending limit orders executed during these times.',
                },
                {
                  q: 'How are ties handled in competitions?',
                  a: 'Each competition has specific tie-breaker rules (e.g., fewer trades, higher win rate, who joined first). Check the competition rules for details.',
                },
                {
                  q: 'Do badges disappear if I lose?',
                  a: 'No, once earned, badges are permanent. Your XP and trader level can only go up, never down.',
                },
                {
                  q: 'Can I see my trade history?',
                  a: 'Yes, go to any active competition and check the "Trade History" tab to see all your closed trades with detailed information.',
                },
                {
                  q: 'What\'s the spread cost?',
                  a: 'The spread is the difference between Bid and Ask prices. Every trade pays this spread cost, which is reflected in your P&L.',
                },
              ].map((faq, index) => (
                <div key={index} className="p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                  <h4 className="font-semibold text-white mb-2">{faq.q}</h4>
                  <p className="text-sm text-gray-400">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Support Section */}
          <div className="bg-gradient-to-r from-primary-600/20 to-primary-700/20 rounded-xl p-6 border border-primary-500/30 text-center">
            <Info className="h-12 w-12 text-primary-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Need More Help?</h3>
            <p className="text-gray-300 mb-4">
              If you have questions that aren&apos;t covered here, feel free to reach out to our support team.
            </p>
            {isLoggedIn && (
              <div className="flex flex-wrap gap-3 justify-center">
                <Link
                  href="/profile"
                  className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
                >
                  View Your Profile
                </Link>
                <Link
                  href="/competitions"
                  className="px-6 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors font-medium border border-dark-600"
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

