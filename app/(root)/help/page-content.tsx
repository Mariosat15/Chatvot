"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
  Users,
  Mail,
  LogIn,
  CreditCard,
  BadgeCheck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { GameIcon } from "@/components/ui/GameIcon";
import type { GameIconName } from "@/lib/constants/game-icons";

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
  // Optional — populated by /api/help-settings when the admin has configured
  // KYC / payment / VAT. Defaults are safe-empty so older API responses still
  // render correctly.
  kyc?: {
    enabled: boolean;
    requiredForDeposit: boolean;
    requiredForWithdrawal: boolean;
    requiredAmount: number;
  };
  payments?: {
    stripe: boolean;
    nuvei: boolean;
    paddle: boolean;
    anyEnabled: boolean;
    depositFeePercentage: number;
  };
  vat?: {
    enabled: boolean;
    percentage: number;
  };
}

const menuSections = [
  { id: "getting-started", title: "🚀 Getting Started", icon: Book },
  { id: "dashboard", title: "📊 Dashboard", icon: LayoutDashboard },
  { id: "competitions", title: "🏆 Competitions", icon: Trophy },
  { id: "challenges", title: "⚔️ 1v1 Challenges", icon: Swords },
  { id: "matchmaking", title: "💖 Match Cards", icon: Heart },
  { id: "score-system", title: "⚡ Score System", icon: Zap },
  { id: "trading", title: "📈 Trading Guide", icon: TrendingUp },
  { id: "marketplace", title: "🛒 Marketplace", icon: ShoppingBag },
  { id: "leaderboard", title: "🥇 Leaderboard", icon: Medal },
  { id: "credits", title: "💰 Credits & Wallet", icon: Coins },
  { id: "profile", title: "👤 Profile & Stats", icon: User },
  { id: "arsenal", title: "🎯 Trading Arsenal", icon: Briefcase },
  { id: "gamemaster", title: "👑 Game Master", icon: Award },
  { id: "notifications", title: "🔔 Notifications", icon: Bell },
  { id: "trader-levels", title: "👑 Trader Levels", icon: Award },
  { id: "badge-system", title: "🏅 Badge System", icon: Award },
  { id: "risk-management", title: "🛡️ Risk Management", icon: Shield },
  { id: "account-security", title: "🔒 Account Security", icon: Eye },
  { id: "invoices", title: "📄 Invoices & Billing", icon: FileText },
  { id: "faq", title: "❓ FAQ", icon: HelpCircle },
];

// Default settings as fallback
const defaultSettings: HelpSettings = {
  badgeXP: { common: 10, rare: 25, epic: 50, legendary: 100 },
  levels: [
    {
      level: 1,
      title: "Novice Trader",
      minXP: 0,
      icon: "🌱",
      color: "text-gray-400",
    },
    {
      level: 2,
      title: "Apprentice Trader",
      minXP: 100,
      icon: "📚",
      color: "text-green-400",
    },
    {
      level: 3,
      title: "Skilled Trader",
      minXP: 300,
      icon: "⚔️",
      color: "text-blue-400",
    },
    {
      level: 4,
      title: "Expert Trader",
      minXP: 600,
      icon: "🎯",
      color: "text-cyan-400",
    },
    {
      level: 5,
      title: "Elite Trader",
      minXP: 1000,
      icon: "💎",
      color: "text-purple-400",
    },
    {
      level: 6,
      title: "Master Trader",
      minXP: 1600,
      icon: "👑",
      color: "text-pink-400",
    },
    {
      level: 7,
      title: "Grand Master",
      minXP: 2400,
      icon: "🔥",
      color: "text-orange-400",
    },
    {
      level: 8,
      title: "Trading Champion",
      minXP: 3400,
      icon: "⚡",
      color: "text-red-400",
    },
    {
      level: 9,
      title: "Market Legend",
      minXP: 4600,
      icon: "🌟",
      color: "text-yellow-400",
    },
    {
      level: 10,
      title: "Trading God",
      minXP: 6000,
      icon: "👑",
      color: "text-yellow-300",
    },
  ],
  margin: { safe: 200, warning: 150, marginCall: 100, liquidation: 50 },
  leverage: { min: 1, max: 500, default: 10 },
  positions: { maxOpen: 10, maxSize: 100 },
  risk: { maxDrawdown: 50, dailyLossLimit: 20 },
  credits: {
    name: "Credits",
    symbol: "⚡",
    valueInEUR: 1,
    eurToCreditsRate: 100,
    minimumDeposit: 10,
    minimumWithdrawal: 20,
    withdrawalFee: 2,
  },
  currency: { code: "EUR", symbol: "€", name: "Euro" },
  kyc: {
    enabled: false,
    requiredForDeposit: false,
    requiredForWithdrawal: true,
    requiredAmount: 0,
  },
  payments: {
    stripe: false,
    nuvei: false,
    paddle: false,
    anyEnabled: false,
    depositFeePercentage: 0,
  },
  vat: { enabled: false, percentage: 0 },
};

export default function HelpPageContent({ isLoggedIn }: HelpPageContentProps) {
  const [activeSection, setActiveSection] = useState("getting-started");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState<HelpSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  // Fetch dynamic settings from API
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/help-settings");
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.settings) {
            setSettings(data.settings);
          }
        }
      } catch (error) {
        console.error("Error fetching help settings:", error);
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
      element.scrollIntoView({ behavior: "smooth", block: "start" });
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
    <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 overflow-x-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 shadow-2xl border border-yellow-500/20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="h-10 w-10 sm:h-12 sm:w-12 md:h-16 md:w-16 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <Book className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-yellow-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-4xl font-bold text-white truncate">
                Help Center
              </h1>
              <p className="text-gray-400 text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1 truncate">
                Complete guide to mastering the platform
              </p>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center bg-yellow-500/20 rounded-lg text-white flex-shrink-0"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        {/* Left Menu - Desktop */}
        <nav className="hidden lg:block w-72 flex-shrink-0">
          <div className="sticky top-20 bg-gray-800/50 rounded-xl p-4 border border-gray-700 max-h-[calc(100vh-6rem)] overflow-y-auto">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
              Topics
            </h2>
            <ul className="space-y-1">
              {menuSections.map((section) => {
                const Icon = section.icon;
                return (
                  <li key={section.id}>
                    <button
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                        activeSection === section.id
                          ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                          : "text-gray-400 hover:bg-gray-700/50 hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {section.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-50"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="bg-gray-900 w-[280px] max-w-[85vw] h-full p-4 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                Topics
              </h2>
              <ul className="space-y-1">
                {menuSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <li key={section.id}>
                      <button
                        onClick={() => scrollToSection(section.id)}
                        className={`w-full flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-lg transition-all text-left ${
                          activeSection === section.id
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "text-gray-400 hover:bg-gray-700/50 hover:text-white"
                        }`}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm font-medium">
                          {section.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 space-y-4 sm:space-y-6 min-w-0">
          {/* Getting Started */}
          <section
            id="getting-started"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Book className="h-6 w-6 text-yellow-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                🚀 Getting Started
              </h2>
            </div>

            <div className="space-y-6 text-gray-300">
              <p className="leading-relaxed">
                Welcome! This platform lets you trade real Forex pairs inside
                time-boxed{" "}
                <Link
                  href="/competitions"
                  className="text-yellow-400 hover:text-yellow-300 underline"
                >
                  Competitions
                </Link>{" "}
                and{" "}
                <Link
                  href="/challenges"
                  className="text-yellow-400 hover:text-yellow-300 underline"
                >
                  1v1 Challenges
                </Link>{" "}
                using {settings.credits.name.toLowerCase()} you fund yourself.
                Below is the exact step-by-step path from sign-up to your
                first trade.
              </p>

              {/* ── STEP 1 — Create your account ───────────────────────── */}
              <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold flex-shrink-0">
                    1
                  </div>
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <User className="h-4 w-4 text-yellow-400" /> Create your
                    account
                  </h4>
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  Go to{" "}
                  <Link
                    href="/sign-up"
                    className="text-yellow-400 hover:text-yellow-300 underline"
                  >
                    /sign-up
                  </Link>{" "}
                  and fill in your details. The form asks for:
                </p>
                <ul className="text-sm text-gray-400 space-y-1 ml-2 list-disc list-inside marker:text-yellow-500/60">
                  <li>Full name</li>
                  <li>Email address (must be reachable — see Step 2)</li>
                  <li>Password (minimum 8 characters)</li>
                  <li>
                    Country, address, city and postal code (used for invoicing
                    and VAT/tax compliance)
                  </li>
                </ul>
                <div className="mt-3 text-xs text-gray-500 bg-gray-800/60 rounded-md p-2 border border-gray-700/60">
                  <strong className="text-yellow-400">Tip:</strong> If a Game
                  Master invited you with a referral link (
                  <code className="text-yellow-300">/sign-up?ref=GM...</code>),
                  open that link to sign up — you&apos;ll be linked to them
                  and they earn a small referral fee on your competition entries.
                </div>
              </div>

              {/* ── STEP 2 — Verify your email ─────────────────────────── */}
              <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold flex-shrink-0">
                    2
                  </div>
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <Mail className="h-4 w-4 text-yellow-400" /> Verify your
                    email
                  </h4>
                </div>
                <p className="text-sm text-gray-400">
                  Right after sign-up we email you a verification link. Open
                  the email and click it — the link activates your account
                  instantly. Until your email is verified you can&apos;t sign
                  in or enter any competition.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  No email? Check your spam folder, then use the &quot;Resend
                  verification email&quot; option on the{" "}
                  <Link
                    href="/verify-email-required"
                    className="text-yellow-400 hover:text-yellow-300 underline"
                  >
                    verification page
                  </Link>
                  .
                </p>
              </div>

              {/* ── STEP 3 — Sign in & meet the dashboard ──────────────── */}
              <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold flex-shrink-0">
                    3
                  </div>
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <LogIn className="h-4 w-4 text-yellow-400" /> Sign in &amp;
                    meet your dashboard
                  </h4>
                </div>
                <p className="text-sm text-gray-400">
                  Sign in at{" "}
                  <Link
                    href="/sign-in"
                    className="text-yellow-400 hover:text-yellow-300 underline"
                  >
                    /sign-in
                  </Link>{" "}
                  and you land on{" "}
                  <Link
                    href="/dashboard"
                    className="text-yellow-400 hover:text-yellow-300 underline"
                  >
                    /dashboard
                  </Link>
                  . The dashboard shows your wallet balance, today&apos;s
                  P&amp;L, win rate, active competitions, performance charts,
                  recent activity, and an interactive checklist that guides
                  you through your first deposit, your first competition
                  entry, and your first trade.
                </p>
              </div>

              {/* ── STEP 4 — Fund your wallet ──────────────────────────── */}
              <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold flex-shrink-0">
                    4
                  </div>
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-yellow-400" /> Fund your
                    wallet
                  </h4>
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  Your wallet starts at{" "}
                  <span className="text-white font-semibold">
                    {settings.credits.symbol} 0
                  </span>{" "}
                  — there is no signup bonus. To compete you need to buy{" "}
                  {settings.credits.name.toLowerCase()}. Open{" "}
                  <Link
                    href="/wallet"
                    className="text-yellow-400 hover:text-yellow-300 underline"
                  >
                    /wallet
                  </Link>{" "}
                  and click{" "}
                  <strong className="text-white">
                    Buy {settings.credits.name}
                  </strong>
                  .
                </p>

                <div className="grid gap-2 sm:grid-cols-2 text-xs">
                  <div className="bg-gray-800/60 rounded-md p-2 border border-gray-700/60">
                    <div className="text-gray-500 mb-0.5">Minimum deposit</div>
                    <div className="text-white font-semibold">
                      {settings.currency.symbol}
                      {settings.credits.minimumDeposit}
                    </div>
                  </div>
                  <div className="bg-gray-800/60 rounded-md p-2 border border-gray-700/60">
                    <div className="text-gray-500 mb-0.5">Exchange rate</div>
                    <div className="text-white font-semibold">
                      {settings.currency.symbol}1 ={" "}
                      {settings.credits.eurToCreditsRate}{" "}
                      {settings.credits.name.toLowerCase()}
                    </div>
                  </div>
                  {settings.payments &&
                    settings.payments.depositFeePercentage > 0 && (
                      <div className="bg-gray-800/60 rounded-md p-2 border border-gray-700/60">
                        <div className="text-gray-500 mb-0.5">
                          Processing fee
                        </div>
                        <div className="text-white font-semibold">
                          {settings.payments.depositFeePercentage}%
                        </div>
                      </div>
                    )}
                  {settings.vat && settings.vat.enabled && (
                    <div className="bg-gray-800/60 rounded-md p-2 border border-gray-700/60">
                      <div className="text-gray-500 mb-0.5">
                        VAT (EU residents)
                      </div>
                      <div className="text-white font-semibold">
                        {settings.vat.percentage}%
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment methods (only show when the admin has at least one card processor enabled) */}
                {settings.payments?.anyEnabled ? (
                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-1.5">
                      Accepted payment methods:
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                        <CreditCard className="h-3 w-3" /> Debit &amp; credit
                        cards (Visa, Mastercard, Maestro, American Express)
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-orange-300 bg-orange-500/10 border border-orange-500/30 rounded-md p-2 flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>
                      Payment methods are being configured. Please contact
                      support if you need help depositing.
                    </span>
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-3">
                  You&apos;ll be asked to accept the credit-purchase terms
                  before checkout. Once payment clears your wallet is credited
                  immediately and you receive an invoice by email.
                </p>
              </div>

              {/* ── STEP 5 — Identity verification (conditional) ───────── */}
              {settings.kyc?.enabled && (
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold flex-shrink-0">
                      5
                    </div>
                    <h4 className="font-semibold text-white flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4 text-blue-400" /> Verify
                      your identity (KYC)
                    </h4>
                  </div>
                  <p className="text-sm text-gray-300 mb-2">
                    To keep the platform compliant we verify your identity
                    using a passport, ID card, driver&apos;s licence or
                    residence permit. Verification takes a few minutes and is
                    valid going forward.
                  </p>
                  <ul className="text-sm text-gray-300 space-y-1 ml-2 list-disc list-inside marker:text-blue-400/60">
                    {settings.kyc.requiredForDeposit && (
                      <li>
                        <strong className="text-white">Required to deposit</strong>{" "}
                        — you&apos;ll need to verify before buying{" "}
                        {settings.credits.name.toLowerCase()}.
                      </li>
                    )}
                    {settings.kyc.requiredForWithdrawal && (
                      <li>
                        <strong className="text-white">
                          Required to withdraw
                        </strong>
                        {settings.kyc.requiredAmount > 0
                          ? ` for amounts of ${settings.currency.symbol}${settings.kyc.requiredAmount} or more`
                          : " for all withdrawal amounts"}
                        .
                      </li>
                    )}
                  </ul>
                  <p className="text-xs text-gray-400 mt-2">
                    If verification is needed for an action you&apos;re trying
                    to perform, the app will prompt you with a link to start
                    the verification flow.
                  </p>
                </div>
              )}

              {/* ── STEP — Join your first competition ─────────────────── */}
              <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold flex-shrink-0">
                    {settings.kyc?.enabled ? "6" : "5"}
                  </div>
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-400" /> Join your
                    first competition
                  </h4>
                </div>
                <p className="text-sm text-gray-400 mb-2">
                  Browse{" "}
                  <Link
                    href="/competitions"
                    className="text-yellow-400 hover:text-yellow-300 underline"
                  >
                    /competitions
                  </Link>{" "}
                  to see what&apos;s running. Each competition has a
                  publicised <em>entry fee</em> (in{" "}
                  {settings.credits.name.toLowerCase()}), a{" "}
                  <em>ranking type</em> (P&amp;L, ROI %, win rate or volume),
                  a <em>prize pool</em> and a <em>start/end time</em>.
                </p>
                <p className="text-sm text-gray-400">
                  Click <strong className="text-white">Join</strong>, accept
                  the entry terms, and the entry fee is deducted from your
                  wallet. You also see your live ranking on the competition
                  page. Want a faster format? Try{" "}
                  <Link
                    href="/challenges"
                    className="text-yellow-400 hover:text-yellow-300 underline"
                  >
                    1v1 Challenges
                  </Link>{" "}
                  — head-to-head, shorter, instant payout.
                </p>
              </div>

              {/* ── STEP — Place your first trade ──────────────────────── */}
              <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold flex-shrink-0">
                    {settings.kyc?.enabled ? "7" : "6"}
                  </div>
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-yellow-400" /> Place
                    your first trade
                  </h4>
                </div>
                <p className="text-sm text-gray-400 mb-2">
                  Once you&apos;re a participant, open the competition&apos;s
                  trading view (<code className="text-gray-300">
                    /competitions/&lt;id&gt;/trade
                  </code>
                  ). Pick a Forex pair, choose Buy (long) or Sell (short), set
                  your lot size, and optionally add Stop Loss / Take Profit.
                </p>
                <div className="grid gap-2 sm:grid-cols-3 text-xs">
                  <div className="bg-gray-800/60 rounded-md p-2 border border-gray-700/60">
                    <div className="text-gray-500 mb-0.5">Leverage range</div>
                    <div className="text-white font-semibold">
                      {settings.leverage.min}× – {settings.leverage.max}×
                    </div>
                  </div>
                  <div className="bg-gray-800/60 rounded-md p-2 border border-gray-700/60">
                    <div className="text-gray-500 mb-0.5">
                      Default leverage
                    </div>
                    <div className="text-white font-semibold">
                      {settings.leverage.default}×
                    </div>
                  </div>
                  <div className="bg-gray-800/60 rounded-md p-2 border border-gray-700/60">
                    <div className="text-gray-500 mb-0.5">
                      Max open positions
                    </div>
                    <div className="text-white font-semibold">
                      {settings.positions.maxOpen}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  The order panel has two layouts —{" "}
                  <strong className="text-gray-300">Pro</strong> (full trader
                  view) and <strong className="text-gray-300">Easy</strong>{" "}
                  (simplified). Switch between them with the mode toggle in
                  the trading interface — your choice is remembered per
                  device.
                </p>
              </div>

              {/* ── Important to know ──────────────────────────────────── */}
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-400" /> Good to
                  know before you start
                </h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">
                        Trading happens inside competitions and challenges
                      </strong>{" "}
                      — there is no &quot;always-on&quot; free-trading mode.
                      To place an order you must first be an active
                      participant.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Forex only.</strong> The
                      currently tradable instruments are Forex pairs (majors,
                      crosses and selected exotics). Crypto, stocks and
                      commodities are not enabled.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">No signup bonus.</strong>{" "}
                      You start with{" "}
                      {settings.credits.symbol} 0. Everything you can do
                      (entry fees, marketplace, Game Master) is funded by
                      your own deposit.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Withdrawals.</strong>{" "}
                      Minimum withdrawal is {settings.currency.symbol}
                      {settings.credits.minimumWithdrawal}; a platform fee of{" "}
                      {settings.credits.withdrawalFee}% applies.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">
                        Trading involves risk.
                      </strong>{" "}
                      Leverage magnifies both wins and losses. Read the{" "}
                      <button
                        onClick={() => setActiveSection("risk-management")}
                        className="text-orange-300 hover:text-orange-200 underline"
                      >
                        Risk Management
                      </button>{" "}
                      section before sizing up.
                    </span>
                  </li>
                </ul>
              </div>

              {/* ── Quick navigation ───────────────────────────────────── */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">
                  💡 Quick Navigation:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <Link
                    href="/dashboard"
                    className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
                  >
                    <LayoutDashboard className="h-3 w-3" /> Dashboard
                  </Link>
                  <Link
                    href="/competitions"
                    className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
                  >
                    <Trophy className="h-3 w-3" /> Competitions
                  </Link>
                  <Link
                    href="/challenges"
                    className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
                  >
                    <Swords className="h-3 w-3" /> Challenges
                  </Link>
                  <Link
                    href="/marketplace"
                    className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
                  >
                    <ShoppingBag className="h-3 w-3" /> Marketplace
                  </Link>
                  <Link
                    href="/leaderboard"
                    className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
                  >
                    <Medal className="h-3 w-3" /> Leaderboard
                  </Link>
                  <Link
                    href="/wallet"
                    className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
                  >
                    <Wallet className="h-3 w-3" /> Wallet
                  </Link>
                  <Link
                    href="/profile"
                    className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
                  >
                    <User className="h-3 w-3" /> Profile
                  </Link>
                  <Link
                    href="/gamemaster"
                    className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
                  >
                    <Award className="h-3 w-3" /> Game Master
                  </Link>
                  <Link
                    href="/notifications"
                    className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
                  >
                    <Bell className="h-3 w-3" /> Notifications
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Dashboard */}
          <section
            id="dashboard"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <LayoutDashboard className="h-6 w-6 text-blue-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                📊 Dashboard
              </h2>
            </div>

            <div className="space-y-6 text-gray-300">
              <p className="leading-relaxed">
                Your{" "}
                <Link
                  href="/dashboard"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Dashboard
                </Link>{" "}
                is the home screen you land on after signing in. It&apos;s
                organised into <strong className="text-white">four tabs</strong>{" "}
                — Overview, Wallet, Performance and Contests — plus a
                first-time onboarding checklist that hides itself once
                you&apos;ve completed it. Your last-used tab is remembered
                per browser, so you return to where you were.
              </p>

              {/* ── Onboarding checklist (above the tabs) ─────────────── */}
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-400" /> Getting
                  Started checklist (above the tabs)
                </h5>
                <p className="text-sm text-gray-300 mb-2">
                  When you&apos;re new, a checklist appears at the top of the
                  dashboard tracking five milestones:
                </p>
                <ul className="text-sm text-gray-300 space-y-1 ml-2 list-disc list-inside marker:text-blue-400/60">
                  <li>Fund your wallet (first deposit)</li>
                  <li>Join your first competition</li>
                  <li>Place your first trade</li>
                  <li>Complete a journey milestone</li>
                  <li>Challenge another user to a 1v1</li>
                </ul>
                <p className="text-xs text-gray-400 mt-2">
                  The checklist disappears automatically once every step is
                  done, or you can dismiss it manually — that preference is
                  remembered per browser.
                </p>
              </div>

              {/* ── Tab 1: Overview ──────────────────────────────────── */}
              <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                <h5 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <LayoutDashboard className="h-5 w-5 text-blue-400" /> Tab 1
                  — Overview
                </h5>
                <p className="text-sm text-gray-400 mb-3">
                  Snapshot of your account at a glance. Stacked top-to-bottom:
                </p>
                <ul className="text-sm text-gray-300 space-y-2 ml-2">
                  <li className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Account Status</strong> —
                      surfaces any active restrictions on your account (e.g.
                      review, suspension, chargeback in progress). Only shown
                      when there&apos;s something to report.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <BarChart3 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Hero Stats</strong> (4
                      cards): Credit Balance ({settings.credits.symbol}), Win
                      Rate, ROI %, and Total Prizes Won.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <User className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Player Profile Card</strong>{" "}
                      — your current Trader Level &amp; title, XP progress bar
                      to the next level, global rank out of all users, your
                      most recent badges and a quick view of your active
                      journey milestone.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Recent Trades Feed</strong>{" "}
                      — your latest closed trades and currently open positions
                      with running P&amp;L.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Streaks Showcase</strong>{" "}
                      — current win/loss streaks, your longest-ever streaks,
                      trading days this month, and consecutive profitable
                      days.
                    </span>
                  </li>
                </ul>
              </div>

              {/* ── Tab 2: Wallet ────────────────────────────────────── */}
              <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                <h5 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-emerald-400" /> Tab 2 —
                  Wallet &amp; Credits
                </h5>
                <p className="text-sm text-gray-400 mb-3">
                  Everything money-related, in one place.
                </p>
                <ul className="text-sm text-gray-300 space-y-2 ml-2">
                  <li className="flex items-start gap-2">
                    <BarChart3 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Hero Stats</strong> (4
                      cards): Credit Balance, Total Spent (entry fees +
                      marketplace + GM), GM Earnings, Prizes Won.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <LineChart className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Equity Chart</strong> —
                      your wallet balance plotted over time.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <BarChart3 className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Daily Credit Flow</strong>{" "}
                      — day-by-day in/out movements (deposits, withdrawals,
                      entry fees, prizes, refunds).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Coins className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Credit Breakdown</strong>{" "}
                      — how your spending and earnings split by category
                      (entry fees, marketplace purchases, Game Master,
                      prizes, etc.), plus all-time totals.
                    </span>
                  </li>
                </ul>
                <p className="text-xs text-gray-500 mt-3">
                  To actually deposit, withdraw, or see individual
                  transactions, go to{" "}
                  <Link
                    href="/wallet"
                    className="text-emerald-400 hover:text-emerald-300 underline"
                  >
                    /wallet
                  </Link>{" "}
                  — the Wallet tab here is read-only analytics.
                </p>
              </div>

              {/* ── Tab 3: Performance ───────────────────────────────── */}
              <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                <h5 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-400" /> Tab 3 —
                  Trading Performance
                </h5>
                <p className="text-sm text-gray-400 mb-3">
                  Deep statistical view of how you trade.
                </p>
                <ul className="text-sm text-gray-300 space-y-2 ml-2">
                  <li className="flex items-start gap-2">
                    <Target className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Performance Rings</strong>{" "}
                      — Win Rate, ROI, Profit Factor, plus Average Win,
                      Average Loss, Largest Win and Largest Loss.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <LineChart className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Trading Analytics</strong>{" "}
                      — Win/Loss distribution, trades grouped by symbol
                      (which Forex pairs you trade most), and trades by hour
                      of day (when you&apos;re active).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Trophy className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Contest Stats Cards</strong>{" "}
                      — your aggregate stats from competitions and 1v1
                      challenges (entries, wins, podiums, etc.).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Market Holidays</strong>{" "}
                      — upcoming sessions where Forex trading will be closed
                      or restricted (so you can plan around them).
                    </span>
                  </li>
                </ul>
              </div>

              {/* ── Tab 4: Contests ──────────────────────────────────── */}
              <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                <h5 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-400" /> Tab 4 —
                  Contests
                </h5>
                <p className="text-sm text-gray-400 mb-3">
                  Your participation in competitions and 1v1 challenges, all
                  on one screen.
                </p>
                <ul className="text-sm text-gray-300 space-y-2 ml-2">
                  <li className="flex items-start gap-2">
                    <Trophy className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Competitions</strong> —
                      your <em>active</em> competitions (with live rank) and{" "}
                      <em>upcoming</em> competitions you&apos;ve joined.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Swords className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Challenges</strong> — your{" "}
                      <em>active</em> 1v1 challenges and any{" "}
                      <em>pending</em> challenges waiting for the opponent to
                      accept or for you to respond to.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Quick stats</strong> —
                      total contests entered, wins, and podium finishes.
                    </span>
                  </li>
                </ul>
                <p className="text-xs text-gray-500 mt-3">
                  Click any card to jump into that contest&apos;s page,
                  leaderboard or trading view.
                </p>
              </div>

              {/* ── Pro tips ──────────────────────────────────────────── */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-400" /> Tips
                </h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Live numbers.</strong>{" "}
                      Every stat is recomputed each time you load the
                      dashboard — there&apos;s no manual refresh button to
                      hunt for.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Currency.</strong> All
                      money values on the dashboard are shown in{" "}
                      {settings.credits.name.toLowerCase()} (
                      {settings.credits.symbol}). To convert to{" "}
                      {settings.currency.name}, divide by{" "}
                      {settings.credits.eurToCreditsRate} — i.e.{" "}
                      {settings.credits.symbol}
                      {settings.credits.eurToCreditsRate} ={" "}
                      {settings.currency.symbol}1.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">No data yet?</strong> If
                      you haven&apos;t traded yet, most cards will show
                      zeros and empty states. That&apos;s expected — the
                      cards fill up as you play.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Restrictions show first.</strong>{" "}
                      If your account is suspended, in review or in chargeback,
                      the <em>Account Status</em> banner explains the situation
                      and which actions are blocked.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Competitions */}
          <section
            id="competitions"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Trophy className="h-6 w-6 text-yellow-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">🏆 Competitions</h2>
            </div>

            <div className="space-y-6 text-gray-300">
              <p className="leading-relaxed">
                Competitions are time-limited trading tournaments. You pay a
                one-off <strong>entry fee in {settings.credits.name.toLowerCase()}</strong>{" "}
                (<span className="text-yellow-400">{settings.credits.symbol}</span>),
                receive a fresh <strong>virtual starting capital</strong>{" "}
                that&apos;s separate from your wallet, trade the markets for the
                duration of the contest, and the top finishers split the prize
                pool. Your real {settings.credits.name.toLowerCase()} wallet is
                only touched twice: when you pay the entry fee and when you
                receive a prize.
              </p>

              {/* What a competition is */}
              <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-400" />
                  How a competition works
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Sandbox capital.</strong>{" "}
                      Each contest defines its own <em>starting capital</em>{" "}
                      (e.g. $10,000 virtual). All trades inside the contest use
                      this sandbox balance — wins and losses do <strong>not</strong>{" "}
                      move your real {settings.credits.name.toLowerCase()}{" "}
                      balance during the contest.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Entry fee.</strong>{" "}
                      Deducted from your wallet the moment you confirm entry.
                      The fee is added to the contest&apos;s prize pool.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Prize pool.</strong>{" "}
                      Funded entirely from participants&apos; entry fees
                      (<code className="bg-gray-800 px-1 rounded text-xs">
                        prize pool = participants × entry fee
                      </code>). The platform takes a configurable cut from each
                      winner&apos;s share; the rest is paid out automatically.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Auto-settlement.</strong>{" "}
                      When the end time hits, the system closes any remaining
                      open positions, ranks all eligible participants, and
                      credits the prize {settings.credits.name.toLowerCase()}{" "}
                      directly to the winners&apos; wallets. You don&apos;t
                      need to claim them.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Status lifecycle */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-cyan-400" />
                  Competition statuses
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30 text-sm">
                    <span className="font-semibold text-yellow-300">
                      🟡 Upcoming
                    </span>
                    <p className="text-gray-400 mt-1">
                      Open for registration. You can join until the
                      registration deadline (or until it fills up).
                    </p>
                  </div>
                  <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30 text-sm">
                    <span className="font-semibold text-red-300">
                      🔴 Live
                    </span>
                    <p className="text-gray-400 mt-1">
                      Trading is open. Late entries are still possible if the
                      contest allows them and there are seats free.
                    </p>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/30 text-sm">
                    <span className="font-semibold text-purple-300">
                      🟣 Finalizing
                    </span>
                    <p className="text-gray-400 mt-1">
                      End time reached. The system is closing positions and
                      computing the final leaderboard.
                    </p>
                  </div>
                  <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30 text-sm">
                    <span className="font-semibold text-green-300">
                      🟢 Completed
                    </span>
                    <p className="text-gray-400 mt-1">
                      Prizes paid out. Visit the <em>Results</em> page to
                      review the final standings and your trade history.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600 text-sm sm:col-span-2">
                    <span className="font-semibold text-gray-300">
                      ⚪ Cancelled
                    </span>
                    <p className="text-gray-400 mt-1">
                      If the minimum number of participants isn&apos;t reached,
                      or the admin cancels the contest, every entry fee is{" "}
                      <strong className="text-white">fully refunded</strong> to
                      your wallet automatically.
                    </p>
                  </div>
                </div>
              </div>

              {/* Joining */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <LogIn className="h-4 w-4 text-green-400" />
                  Joining a competition
                </h3>
                <ol className="space-y-2 text-sm list-decimal list-inside marker:text-yellow-400">
                  <li>
                    Open{" "}
                    <Link
                      href="/competitions"
                      className="text-yellow-400 hover:text-yellow-300 underline underline-offset-2"
                    >
                      /competitions
                    </Link>{" "}
                    and browse the active and upcoming list. Filter by status
                    (Live / Soon / Completed), ranking method, asset class,
                    difficulty, your required level, or sort by prize pool,
                    start time or entry fee.
                  </li>
                  <li>
                    Open a competition&apos;s card to see its rules: entry fee,
                    starting capital, prize distribution, ranking method,
                    leverage limit, max open positions and any minimum-trades
                    requirement.
                  </li>
                  <li>
                    Click <strong className="text-white">Enter Competition</strong>,
                    confirm the entry terms, and the fee is debited from your
                    wallet. You become a participant immediately.
                  </li>
                  <li>
                    Once the contest goes Live, the{" "}
                    <strong className="text-white">Trade</strong> button takes
                    you into the contest&apos;s dedicated trading screen.
                  </li>
                </ol>

                <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm">
                  <p className="text-amber-200 font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Entry requirements
                  </p>
                  <ul className="space-y-1 text-gray-300">
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>
                        Your email must be{" "}
                        <strong className="text-white">verified</strong>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>
                        Your account must <strong className="text-white">not</strong>{" "}
                        be suspended, in chargeback, or otherwise restricted
                        from entering competitions.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>
                        Your wallet balance must cover the entry fee.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>
                        Some contests require a{" "}
                        <strong className="text-white">minimum player level</strong>{" "}
                        (XP rank). The card shows the gate; if you don&apos;t
                        meet it, the button is locked.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>
                        You can&apos;t enter the same contest twice.
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="mt-3 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-sm">
                  <p className="text-rose-200 font-semibold mb-1">
                    Refunds
                  </p>
                  <p className="text-gray-300">
                    Entry fees are <strong>non-refundable</strong> once paid.
                    The <em>only</em> automatic refund is when a competition is{" "}
                    <strong className="text-white">cancelled</strong> (e.g.
                    minimum participants not reached) — in that case every
                    entry fee is returned to your wallet in full and the
                    competition is marked Cancelled.
                  </p>
                </div>
              </div>

              {/* Ranking methods */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-yellow-400" />
                  Ranking methods
                </h3>
                <p className="text-sm mb-3">
                  Each competition picks one scoring method. Highest value
                  wins, with tie-breakers applied if two players are level.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30 text-sm">
                    <span className="font-semibold text-yellow-300">
                      💰 P&amp;L
                    </span>
                    <p className="text-gray-400 mt-1">
                      Absolute profit/loss in the sandbox currency. Bigger net
                      gain = higher rank.
                    </p>
                  </div>
                  <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30 text-sm">
                    <span className="font-semibold text-green-300">
                      📊 ROI
                    </span>
                    <p className="text-gray-400 mt-1">
                      Return on starting capital, in %. Levels the field for
                      contests with different starting balances.
                    </p>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30 text-sm">
                    <span className="font-semibold text-blue-300">
                      🏦 Total Capital
                    </span>
                    <p className="text-gray-400 mt-1">
                      Largest final equity wins. Behaves like P&amp;L but
                      compares ending balances directly.
                    </p>
                  </div>
                  <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/30 text-sm">
                    <span className="font-semibold text-cyan-300">
                      🎯 Win Rate
                    </span>
                    <p className="text-gray-400 mt-1">
                      % of winning closed trades. Rewards consistency rather
                      than swinging for the fences.
                    </p>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/30 text-sm">
                    <span className="font-semibold text-purple-300">
                      🥇 Total Wins
                    </span>
                    <p className="text-gray-400 mt-1">
                      Raw count of winning trades. Encourages high activity
                      with positive edge.
                    </p>
                  </div>
                  <div className="p-3 bg-pink-500/10 rounded-lg border border-pink-500/30 text-sm">
                    <span className="font-semibold text-pink-300">
                      ⚖️ Profit Factor
                    </span>
                    <p className="text-gray-400 mt-1">
                      Wins ÷ losses ratio. Pure quality metric — one big win
                      can dominate many small losses.
                    </p>
                  </div>
                </div>

                <div className="mt-3 p-3 bg-gray-900/40 border border-gray-700 rounded-lg text-sm">
                  <p className="text-gray-300">
                    <strong className="text-white">Tie-breakers.</strong> If
                    two players are exactly tied on the primary score, the
                    contest&apos;s configured tie-breaker decides (e.g.
                    fewer-trades, higher win rate, earlier join time, or split
                    the prize). If still tied, the player who joined the
                    contest first is ranked higher. Some contests use{" "}
                    <em>split equally</em> or <em>split weighted</em> rules so
                    tied winners actually share the prize for that rank.
                  </p>
                </div>
              </div>

              {/* Prize distribution */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Coins className="h-4 w-4 text-yellow-400" />
                  Prizes &amp; payout
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Each contest lists a{" "}
                      <strong className="text-white">prize distribution</strong>{" "}
                      table — e.g. <em>1st: 70%, 2nd: 20%, 3rd: 10%</em>. You
                      can see it on the competition card and detail page.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      A <strong className="text-white">platform fee</strong>{" "}
                      (also displayed on the contest page) is deducted from
                      each winner&apos;s share before payout.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      If a paying rank has no eligible player (e.g. only two
                      participants in a top-3 payout), the unfilled
                      percentage is redistributed across the winners who{" "}
                      <em>did</em> qualify.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Prizes are credited to your wallet{" "}
                      <strong className="text-white">automatically</strong> the
                      moment the contest settles. The transaction appears in
                      your wallet history as{" "}
                      <code className="bg-gray-800 px-1 rounded text-xs">
                        competition_win
                      </code>
                      .
                    </span>
                  </li>
                </ul>
              </div>

              {/* Trading rules inside a contest */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-orange-400" />
                  Trading rules inside a contest
                </h3>
                <p className="text-sm mb-3">
                  Every contest can override the platform-wide trading
                  defaults. Always check the contest&apos;s rules card before
                  you enter — these are the levers you&apos;ll encounter:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Leverage cap.</strong> The
                      contest defines a maximum leverage (1× to whatever the
                      admin allows). The default global cap is{" "}
                      {settings.leverage.max}×, but each contest can be lower.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Max open positions.</strong>{" "}
                      Most contests allow up to{" "}
                      {settings.positions.maxOpen} positions open at once.
                      Game-Master-created contests can be lower.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Asset class &amp; symbol scope.</strong>{" "}
                      A contest can restrict which markets you can trade (e.g.
                      Forex only, or a specific whitelist / blacklist of
                      symbols).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Short selling.</strong>{" "}
                      Some contests disable shorts. The order ticket will
                      surface this when you try to sell.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Risk caps.</strong> Some
                      contests enable additional guard rails — max drawdown,
                      daily loss limit, or equity-based checks — that block
                      new orders once you cross the threshold.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Live leaderboard.</strong>{" "}
                      The in-contest leaderboard refreshes roughly every 15
                      seconds and uses live unrealized P&amp;L, so your rank
                      moves as the market does.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Liquidation & disqualification */}
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                  Liquidation &amp; disqualification
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-rose-400 mt-0.5 flex-shrink-0" />
                    <span>
                      If your sandbox margin level falls to{" "}
                      <strong className="text-white">
                        {settings.margin.liquidation}%
                      </strong>{" "}
                      or below, all your open positions in that contest are
                      force-closed and your participant status flips to{" "}
                      <em>liquidated</em>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-rose-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Most contests have{" "}
                      <strong className="text-white">
                        disqualify-on-liquidation
                      </strong>{" "}
                      enabled — you keep your seat but you&apos;re removed
                      from the prize ranking and can no longer place trades
                      in this contest.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-rose-400 mt-0.5 flex-shrink-0" />
                    <span>
                      You can still open the contest&apos;s trade view in{" "}
                      <strong className="text-white">view-only mode</strong> to
                      review your history.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-rose-400 mt-0.5 flex-shrink-0" />
                    <span>
                      For contests with a{" "}
                      <em>minimum trades</em> or <em>minimum win rate</em>{" "}
                      qualifier, players who finish below that bar are also
                      ranked as disqualified at settlement.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Last man standing */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  Last-player-standing early end
                </h3>
                <p className="text-sm">
                  If every other participant gets liquidated or disqualified
                  before the end time, the single remaining active player
                  sees a <strong className="text-white">Claim Victory</strong>{" "}
                  button. Pressing it ends the competition early and triggers
                  the same automatic settlement path — prizes pay out
                  immediately to the survivor and any unclaimed shares
                  redistribute according to the contest&apos;s prize rules.
                </p>
              </div>

              {/* Pages */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4 text-purple-400" />
                  Where to find what
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <Link
                    href="/competitions"
                    className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg hover:bg-gray-800/40 transition-colors block"
                  >
                    <div className="font-semibold text-yellow-300">
                      /competitions
                    </div>
                    <p className="text-gray-400 mt-1">
                      Browse and filter every competition. Status badges,
                      countdowns and prize pools update live.
                    </p>
                  </Link>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <div className="font-semibold text-yellow-300">
                      /competitions/[id]
                    </div>
                    <p className="text-gray-400 mt-1">
                      Detail page — rules, prize distribution, participants
                      list and current leaderboard.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <div className="font-semibold text-yellow-300">
                      /competitions/[id]/trade
                    </div>
                    <p className="text-gray-400 mt-1">
                      The contest trading screen — chart, order ticket, open
                      positions, live ranking. Participants only.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <div className="font-semibold text-yellow-300">
                      /competitions/[id]/results
                    </div>
                    <p className="text-gray-400 mt-1">
                      Post-settlement summary — your final stats, your prize
                      and a link to view-only trade history.
                    </p>
                  </div>
                </div>
              </div>

              {/* Fair play */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-400" />
                  Fair play
                </h3>
                <p className="text-sm text-gray-300">
                  ChartVolt monitors coordinated entries, mirror-trading
                  patterns and equity-based anti-collusion signals across
                  related accounts. If we detect manipulation we can
                  disqualify involved entrants and reverse their prizes.
                  Trade your own book — competing fairly is the only way to
                  keep climbing the leaderboard and the Hall of Fame.
                </p>
              </div>
            </div>
          </section>

          {/* 1v1 Challenges */}
          <section
            id="challenges"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Swords className="h-6 w-6 text-red-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                ⚔️ 1v1 Challenges
              </h2>
            </div>

            <div className="space-y-6 text-gray-300">
              <p className="leading-relaxed">
                A 1v1 Challenge is a direct head-to-head trading duel between
                two players. You pick a specific opponent, both of you stake
                the same entry fee in{" "}
                <strong>{settings.credits.name.toLowerCase()}</strong>{" "}
                (<span className="text-yellow-400">{settings.credits.symbol}</span>),
                you each trade a fresh virtual starting capital for the
                challenge&apos;s duration, and the better performer takes the
                pot minus a small platform fee. Unlike Competitions there&apos;s
                no public lobby — every challenge is an invitation from one
                player to another.
              </p>

              {/* How it works */}
              <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-400" />
                  How a 1v1 Challenge works
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Direct invite.</strong>{" "}
                      You pick the opponent from a leaderboard, a Match Card
                      swipe or a profile page, then send a challenge. There is
                      no public &quot;open challenges&quot; list — your
                      opponent has to be chosen before you can create the
                      challenge.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">No money locked at create.</strong>{" "}
                      Entry fees are <em>only</em> debited when your opponent{" "}
                      <strong>accepts</strong>. Both stakes are deducted in the
                      same atomic step — if your opponent declines, lets the
                      invite expire, or you don&apos;t have enough{" "}
                      {settings.credits.name.toLowerCase()} on accept,{" "}
                      <strong>nothing</strong> is taken from either wallet.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Sandbox capital.</strong>{" "}
                      Each side starts the duel with the configured{" "}
                      <em>starting capital</em> (virtual). Your real{" "}
                      {settings.credits.name.toLowerCase()} balance only moves
                      twice: on accept (stake out) and at settlement (prize
                      in, if you win).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Auto-settlement.</strong>{" "}
                      When the duration ends (or whenever a participant opens
                      the challenge afterwards), the system closes any open
                      positions, ranks both players, applies the platform fee
                      and credits the winner&apos;s wallet automatically as a{" "}
                      <code className="bg-gray-800 px-1 rounded text-xs">
                        challenge_win
                      </code>{" "}
                      transaction.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Status lifecycle */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-cyan-400" />
                  Status lifecycle
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30 text-sm">
                    <span className="font-semibold text-yellow-300">
                      🟡 Pending
                    </span>
                    <p className="text-gray-400 mt-1">
                      Invite sent, waiting for the opponent to Accept or
                      Decline before the <em>accept deadline</em>. No credits
                      have moved yet.
                    </p>
                  </div>
                  <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30 text-sm">
                    <span className="font-semibold text-red-300">
                      🔴 Active
                    </span>
                    <p className="text-gray-400 mt-1">
                      Both stakes have been taken, both sandboxes are loaded,
                      trading is live. The detail page shows live P&amp;L and
                      countdown.
                    </p>
                  </div>
                  <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30 text-sm">
                    <span className="font-semibold text-green-300">
                      🟢 Completed
                    </span>
                    <p className="text-gray-400 mt-1">
                      End time hit and the winner was paid. Both players keep
                      access to the trade view in read-only mode.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600 text-sm">
                    <span className="font-semibold text-gray-300">
                      ⚪ Declined
                    </span>
                    <p className="text-gray-400 mt-1">
                      Opponent rejected the invite. No credits taken; you can
                      challenge someone else.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600 text-sm sm:col-span-2">
                    <span className="font-semibold text-gray-300">
                      ⌛ Expired / Cancelled
                    </span>
                    <p className="text-gray-400 mt-1">
                      <em>Expired</em> = the accept deadline passed without a
                      response (no credits taken).{" "}
                      <em>Cancelled</em> = an admin cancelled the challenge.
                      If the challenge was already Active or Accepted, both
                      stakes are <strong className="text-white">fully refunded</strong>{" "}
                      to the participants&apos; wallets.
                    </p>
                  </div>
                </div>
              </div>

              {/* Creating a challenge */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Swords className="h-4 w-4 text-red-400" />
                  Creating a challenge
                </h3>
                <ol className="space-y-2 text-sm list-decimal list-inside marker:text-red-400">
                  <li>
                    Find an opponent — from a{" "}
                    <Link
                      href="/leaderboard"
                      className="text-yellow-400 hover:text-yellow-300 underline underline-offset-2"
                    >
                      Match Card
                    </Link>{" "}
                    swipe (Leaderboard → Match Cards tab), a leaderboard row,
                    or their profile page.
                  </li>
                  <li>
                    Open the <strong className="text-white">Create Challenge</strong>{" "}
                    dialog. Pick the entry fee (within the admin-configured
                    min/max), the duration, the ranking method (P&amp;L, ROI,
                    Total Capital, Win Rate, Total Wins or Profit Factor) and
                    optionally a primary / secondary tie-breaker.
                  </li>
                  <li>
                    Accept the challenge terms when prompted. The invite is
                    posted to the opponent — <strong>no credits leave your
                    wallet at this point</strong>.
                  </li>
                  <li>
                    Your opponent has until the <em>accept deadline</em> to
                    Accept or Decline. They&apos;ll see your invite as a
                    notification, an in-app popup, and an entry in their{" "}
                    <Link
                      href="/challenges"
                      className="text-yellow-400 hover:text-yellow-300 underline underline-offset-2"
                    >
                      /challenges
                    </Link>{" "}
                    list.
                  </li>
                </ol>

                <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm">
                  <p className="text-amber-200 font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Create-time guards
                  </p>
                  <ul className="space-y-1 text-gray-300">
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>
                        Email must be <strong className="text-white">verified</strong>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>
                        Your account must not be suspended, in chargeback or
                        otherwise restricted from competition-style features.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>
                        Challenges must be{" "}
                        <strong className="text-white">enabled</strong>{" "}
                        platform-wide (admin toggle) and the relevant market
                        must currently be open.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>
                        You can&apos;t challenge yourself.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>
                        Wallet must hold at least the entry fee (so the stake
                        is collectable on accept).
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>
                        Per-user limits apply:{" "}
                        <em>max pending invites</em>,{" "}
                        <em>max active challenges</em>, and an admin-set{" "}
                        <em>cooldown</em> between repeat challenges against
                        the same opponent.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>
                        The opponent must have{" "}
                        <em>accepting challenges</em> enabled in their
                        preferences (and, depending on admin config, be
                        online).
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Accepting */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <LogIn className="h-4 w-4 text-green-400" />
                  Receiving &amp; accepting a challenge
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>
                      You&apos;ll see a popup{" "}
                      <em>Challenge Received!</em>, a notification, and a
                      pending entry in your{" "}
                      <Link
                        href="/challenges"
                        className="text-yellow-400 hover:text-yellow-300 underline underline-offset-2"
                      >
                        /challenges
                      </Link>{" "}
                      list with the full terms (stake, duration, scoring,
                      tie-breakers).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Click <strong className="text-white">Accept</strong>,
                      review and confirm the challenge terms. At that moment{" "}
                      <strong>both</strong> wallets are debited the entry fee
                      in one transaction. If either side is now short of
                      credits, the accept is rejected and the challenge stays
                      Pending or auto-expires.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>
                      You can <strong className="text-white">Decline</strong>{" "}
                      instead — that closes the invite cleanly and no credits
                      move. The challenger is notified.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>
                      If you ignore the invite past the accept deadline, the
                      system marks it <em>Expired</em> automatically.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Trading rules inside a challenge */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-orange-400" />
                  Trading rules inside a challenge
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Dedicated trade screen</strong>{" "}
                      at <code className="bg-gray-800 px-1 rounded text-xs">/challenges/[id]/trade</code>{" "}
                      — chart, order ticket, your live PnL, your opponent&apos;s
                      live PnL and the countdown to the end of the duel.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Leverage cap.</strong>{" "}
                      Each challenge inherits a max leverage from the platform
                      defaults (currently up to {settings.leverage.max}×) and
                      the admin can lower it for challenges.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Position limits.</strong>{" "}
                      Up to {settings.positions.maxOpen} open positions at a
                      time and a per-trade size cap inherited from the global
                      trading risk settings.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Asset class &amp; symbol scope.</strong>{" "}
                      A challenge can be restricted to specific markets or a
                      whitelist / blacklist of symbols. The order ticket
                      reflects what&apos;s tradable.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Live PnL refresh.</strong>{" "}
                      Your scoreboard, your dashboard sidebar widget and your
                      opponent&apos;s number update roughly every 10 seconds.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Ranking & tie rules */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-yellow-400" />
                  Ranking &amp; tie rules
                </h3>
                <p className="text-sm mb-3">
                  Challenges use the <strong>same six scoring methods</strong>{" "}
                  as Competitions (P&amp;L, ROI, Total Capital, Win Rate, Total
                  Wins, Profit Factor) — see the Competitions section for the
                  full breakdown of each formula.
                </p>
                <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg text-sm space-y-2">
                  <p>
                    <strong className="text-white">Tie-breakers.</strong> The
                    challenge optionally has a primary and secondary
                    tie-breaker (trades count, win rate, total capital, ROI,
                    join time, or split-prize). If both players are still
                    exactly tied after that, the admin&apos;s{" "}
                    <em>tie prize distribution</em> rule decides:
                  </p>
                  <ul className="space-y-1 pl-4">
                    <li>
                      • <strong className="text-white">Split equally</strong>{" "}
                      — the pot (after platform fee) is divided 50/50.
                    </li>
                    <li>
                      • <strong className="text-white">Challenger wins</strong>{" "}
                      — on a perfect tie, the player who sent the invite
                      takes the prize.
                    </li>
                    <li>
                      • <strong className="text-white">Both lose</strong>{" "}
                      — neither side is paid out and the stakes stay with the
                      platform&apos;s unclaimed pool.
                    </li>
                  </ul>
                  <p>
                    The active rule for your challenge is shown on the
                    detail page before you accept.
                  </p>
                </div>
              </div>

              {/* Prize math */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Coins className="h-4 w-4 text-yellow-400" />
                  Prize math
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Pot.</strong>{" "}
                      <code className="bg-gray-800 px-1 rounded text-xs">
                        pot = entry fee × 2
                      </code>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Platform fee.</strong> A
                      percentage of the pot (configurable by the admin, e.g.
                      10%) is taken from the prize before payout. The exact
                      amount is shown on every challenge card.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Winner&apos;s prize.</strong>{" "}
                      <code className="bg-gray-800 px-1 rounded text-xs">
                        winnerPrize = pot − platformFee
                      </code>{" "}
                      credited automatically on settlement.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">No winner (both disqualified).</strong>{" "}
                      The pot stays with the platform&apos;s unclaimed pool —
                      it is <em>not</em> refunded as both players actively
                      participated.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Game Master cut.</strong>{" "}
                      If you (or your opponent) joined ChartVolt through a
                      Game Master, that GM may earn a configurable percentage
                      of their referred player&apos;s entry fee. The GM cut is
                      taken <em>from</em> the platform fee, not from your
                      prize — your payout is unaffected.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Liquidation */}
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                  Liquidation &amp; disqualification
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-rose-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Liquidation works the same way as in Competitions: if
                      your sandbox margin hits{" "}
                      <strong className="text-white">
                        {settings.margin.liquidation}%
                      </strong>{" "}
                      or lower, all your open positions are force-closed and
                      you&apos;re flagged as liquidated.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-rose-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Every challenge has{" "}
                      <strong className="text-white">
                        disqualify-on-liquidation
                      </strong>{" "}
                      enabled by design — once you&apos;re liquidated, you
                      lose the duel for prize purposes and the other player
                      becomes the winner if they finish qualified.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-rose-400 mt-0.5 flex-shrink-0" />
                    <span>
                      If <strong>both</strong> sides get liquidated, the
                      challenge ends with <em>no winner</em>. Neither stake is
                      refunded (both players participated).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-rose-400 mt-0.5 flex-shrink-0" />
                    <span>
                      You can still revisit the challenge in{" "}
                      <strong className="text-white">view-only mode</strong>{" "}
                      to review your trade history.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Pages */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4 text-purple-400" />
                  Where to find what
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <Link
                    href="/challenges"
                    className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg hover:bg-gray-800/40 transition-colors block"
                  >
                    <div className="font-semibold text-red-300">
                      /challenges
                    </div>
                    <p className="text-gray-400 mt-1">
                      All your invites and duels in one place. Tabs for{" "}
                      <em>All</em>, <em>Pending</em>, <em>Active</em> and{" "}
                      <em>Completed</em> (which also covers declined / expired
                      / cancelled).
                    </p>
                  </Link>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <div className="font-semibold text-red-300">
                      /challenges/[id]
                    </div>
                    <p className="text-gray-400 mt-1">
                      Detail page — terms, opponent profile, live PnL of both
                      sides, status badge, accept/decline buttons or the Trade
                      Now CTA.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <div className="font-semibold text-red-300">
                      /challenges/[id]/trade
                    </div>
                    <p className="text-gray-400 mt-1">
                      The in-duel trading screen — chart, order ticket, open
                      positions, your sandbox balance and the opponent ticker.
                    </p>
                  </div>
                  <Link
                    href="/leaderboard"
                    className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg hover:bg-gray-800/40 transition-colors block"
                  >
                    <div className="font-semibold text-red-300">
                      /leaderboard → Match Cards
                    </div>
                    <p className="text-gray-400 mt-1">
                      Swipe-style matchmaking — find similar-skill opponents
                      and send them a challenge from a Tinder-like deck.
                    </p>
                  </Link>
                </div>
              </div>

              {/* Fair play */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-400" />
                  Fair play
                </h3>
                <p className="text-sm text-gray-300">
                  Both players trade independently — there is no shared book
                  or position copying. Coordinated entries, mirror-trading
                  with related accounts, and other manipulation patterns are
                  monitored at the platform level and can result in
                  disqualification and prize reversal. Per-opponent cooldowns
                  and per-user pending/active limits prevent grinding the
                  same matchup. Keep duels clean and your stats become a real
                  reputation builder.
                </p>
              </div>
            </div>
          </section>

          {/* Match Cards (Matchmaking) */}
          <section
            id="matchmaking"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Heart className="h-6 w-6 text-pink-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">💖 Match Cards</h2>
            </div>

            <div className="space-y-6 text-gray-300">
              <p className="leading-relaxed">
                Match Cards are a Tinder-style deck of fellow traders that
                helps you pick a 1v1 opponent of similar skill. Each card
                shows their stats, an at-a-glance{" "}
                <strong className="text-pink-300">Match %</strong> and the
                top reasons you&apos;re a good fit. Swipe right to open a
                head-to-head VS screen and send them a challenge — swipe
                left to skip and see the next trader.
              </p>

              {/* Where to find */}
              <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-400" />
                  Where to find Match Cards
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">
                        <Link
                          href="/leaderboard"
                          className="text-yellow-400 hover:text-yellow-300 underline underline-offset-2"
                        >
                          /leaderboard
                        </Link>{" "}
                        → Match Cards tab.
                      </strong>{" "}
                      Toggle between the classic <em>Table</em> view and the
                      <em> Match Cards</em> view at the top of the page.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Dashboard sidebar.</strong>{" "}
                      A compact Match Cards deck is also embedded in the
                      Contests sidebar on the dashboard so you can quickly
                      find a duel without leaving the home screen.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Works on desktop and mobile — drag the card with mouse
                      or finger, or use the buttons under the card.
                    </span>
                  </li>
                </ul>
              </div>

              {/* How swipes work */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-pink-400" />
                  How swiping works
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-4 bg-pink-500/10 rounded-lg border border-pink-500/30">
                    <p className="text-sm font-semibold text-pink-300 mb-2">
                      👈 Swipe Left — Skip
                    </p>
                    <p className="text-xs text-gray-400">
                      Hides the current trader from your local deck and
                      shows the next one. Skips are{" "}
                      <strong className="text-white">not persisted</strong> —
                      reloading the page brings everyone back into the
                      stack.
                    </p>
                  </div>
                  <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                    <p className="text-sm font-semibold text-green-300 mb-2">
                      👉 Swipe Right — Open VS Screen
                    </p>
                    <p className="text-xs text-gray-400">
                      Brings up a head-to-head <em>VS screen</em> with the
                      opponent&apos;s key stats. From there, hit{" "}
                      <strong className="text-white">Challenge Now!</strong>{" "}
                      to open the standard 1v1 create dialog with this
                      opponent pre-selected.
                    </p>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-gray-900/40 border border-gray-700 rounded-lg text-sm space-y-1">
                  <p>
                    <strong className="text-white">Undo:</strong> The Undo
                    button returns to the previous card (local only — it
                    doesn&apos;t change anything server-side).
                  </p>
                  <p>
                    <strong className="text-white">Offline opponents:</strong>{" "}
                    The challenge button is disabled if the trader is
                    offline. You&apos;ll get a toast like{" "}
                    <code className="bg-gray-800 px-1 rounded text-xs">
                      &quot;{"{username}"} is offline&quot;
                    </code>{" "}
                    instead of opening the VS screen.
                  </p>
                  <p>
                    <strong className="text-white">No mutual match needed.</strong>{" "}
                    Match Cards are <em>not</em> like Tinder&apos;s mutual
                    likes — there&apos;s no waiting for the other person
                    to swipe back. A right swipe goes straight to the
                    challenge flow.
                  </p>
                </div>
              </div>

              {/* Find Best Match */}
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  Find Best Match
                </h3>
                <p className="text-sm">
                  The <strong className="text-white">Find Best Match</strong>{" "}
                  button at the top of the deck (also &quot;Auto Match&quot;
                  on the empty-deck state) jumps straight to your{" "}
                  <strong>highest-scoring</strong> available opponent. It
                  prefers traders who are online and accepting challenges,
                  but will fall back to the overall best match if nobody is
                  currently available.
                </p>
              </div>

              {/* What the card shows */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-yellow-400" />
                  What every card shows
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <p>
                      💖 <strong className="text-white">Match %</strong> —
                      0–100 score of how compatible your stats look.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <p>
                      🟢 <strong className="text-white">Online status</strong>{" "}
                      — green dot when their last heartbeat was within the
                      last ~2 minutes.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <p>
                      🏷️ <strong className="text-white">Experience level</strong>{" "}
                      — Beginner, Intermediate, Advanced, Expert or Master,
                      derived from trades, contest history and badges.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <p>
                      🎯 <strong className="text-white">Win rate</strong> —
                      % of closed winning trades.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <p>
                      💰 <strong className="text-white">P&amp;L</strong> —
                      lifetime profit/loss in{" "}
                      {settings.credits.name.toLowerCase()}.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <p>
                      📈 <strong className="text-white">Trades</strong> —
                      total number of trades they&apos;ve closed.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <p>
                      ⚖️ <strong className="text-white">Profit factor</strong>{" "}
                      — quality metric (wins ÷ losses ratio).
                    </p>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <p>
                      🏆 <strong className="text-white">Competitions</strong>{" "}
                      — <em>won / entered</em> count.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <p>
                      ⚔️ <strong className="text-white">1v1 Challenges</strong>{" "}
                      — <em>won / entered</em> count.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <p>
                      🎖️ <strong className="text-white">Badges</strong> —
                      total badges they&apos;ve unlocked.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <p>
                      ⚡ <strong className="text-white">Score</strong> —
                      their overall ChartVolt score (see the Score System
                      section below).
                    </p>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <p>
                      ✨ <strong className="text-white">Why you match</strong>{" "}
                      — up to three short reasons (e.g. <em>Matching win
                      rates</em>, <em>Online &amp; ready</em>).
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  If the trader has switched off &quot;accepting
                  challenges&quot; you&apos;ll see a small warning on the
                  card and the challenge button is disabled.
                </p>
              </div>

              {/* How match % is calculated */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4 text-pink-400" />
                  How the Match % is calculated
                </h3>
                <p className="text-sm mb-3">
                  Each candidate starts at <strong>100</strong> and loses
                  points the more your profiles differ. The result is
                  clamped to 0–100 — so a perfect twin scores near 100 and
                  a complete mismatch scores near 0.
                </p>
                <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg text-sm">
                  <ul className="space-y-1">
                    <li>
                      −10 per <strong className="text-white">experience-level</strong>{" "}
                      gap (Beginner ↔ Master is a 4-level gap = −40)
                    </li>
                    <li>
                      up to −25 for a <strong className="text-white">win-rate</strong>{" "}
                      gap (½ point per % difference)
                    </li>
                    <li>
                      up to −15 if their <strong className="text-white">trade count</strong>{" "}
                      is much lower than yours (scaled by ratio)
                    </li>
                    <li>
                      up to −10 for a <strong className="text-white">profit-factor</strong>{" "}
                      gap
                    </li>
                    <li>
                      up to −5 each for <strong className="text-white">competition experience</strong>{" "}
                      and <strong className="text-white">badge count</strong>{" "}
                      gaps
                    </li>
                    <li>
                      <span className="text-green-300">+5</span> bonus when
                      the trader is online <em>and</em> accepting
                      challenges
                    </li>
                  </ul>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  The platform&apos;s overall &quot;ChartVolt Score&quot;
                  (the composite number used on the leaderboard) is{" "}
                  <strong>not</strong> an input to the Match %. Match % is
                  a fairness/compatibility metric, not a power ranking.
                </p>
              </div>

              {/* Why you match */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-green-400" />
                  &quot;Why you match&quot; chips
                </h3>
                <p className="text-sm text-gray-300 mb-2">
                  When the gap on a given dimension is small enough, the
                  algorithm tags it as a positive reason. Possible chips
                  include:
                </p>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Same level /
                    similar experience level
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Matching win
                    rates
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Similar trading
                    volume
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Similar profit
                    factor
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Online &amp;
                    ready
                  </li>
                </ul>
                <p className="text-xs text-gray-500 mt-2">
                  The card shows the top three matching reasons to keep the
                  UI tidy.
                </p>
              </div>

              {/* VS screen */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-cyan-400" />
                  The VS screen
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Shown right after a right-swipe. Displays{" "}
                      <strong className="text-white">your avatar</strong>{" "}
                      versus{" "}
                      <strong className="text-white">your opponent&apos;s avatar</strong>{" "}
                      in a dramatic head-to-head layout.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Below the hero you&apos;ll see the opponent&apos;s key
                      stats: <em>win rate</em>, <em>total trades</em>,{" "}
                      <em>competitions won / entered</em> and{" "}
                      <em>1v1 won / entered</em>. Use the leaderboard or
                      your own profile if you want to compare your numbers
                      side by side.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Challenge Now!</strong>{" "}
                      opens the standard 1v1 create dialog with this
                      opponent pre-selected. Close the dialog to back out
                      without sending anything.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Who appears + privacy */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-400" />
                  Who appears in the deck
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Anyone on the public leaderboard who isn&apos;t you
                      (you&apos;re always filtered out).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Users with <strong className="text-white">unverified
                      emails</strong> are excluded — only fully verified
                      accounts show up.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Accounts that admins have marked as{" "}
                      <em>hidden from public</em> (e.g. internal/support
                      accounts) don&apos;t appear.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Traders who&apos;ve toggled off{" "}
                      <em>accepting challenges</em> can still show up in
                      the deck, but the challenge button is disabled and a
                      warning replaces it.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      The deck pulls the top 50 best-matched traders by
                      default; the underlying leaderboard data is cached
                      for about 5 minutes so the order can stay stable
                      between refreshes.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Tips */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-400" />
                  Tips
                </h3>
                <ul className="space-y-1 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Hit <strong className="text-white">Find Best Match</strong>{" "}
                      first — it skips the manual swiping and picks the
                      most compatible opponent who&apos;s actually
                      available right now.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Match Cards are a finder — you can always close the
                      challenge dialog without committing if the duration
                      or stake doesn&apos;t look right after seeing the VS
                      screen.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Run out of cards? Refresh the page to rebuild the
                      deck. New traders join the leaderboard as they
                      complete activity, so the deck refills over time.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Score System */}
          <section
            id="score-system"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Zap className="h-6 w-6 text-yellow-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">⚡ Score System</h2>
            </div>

            <div className="space-y-6 text-gray-300">
              <p className="leading-relaxed">
                Your <strong className="text-yellow-400">Score</strong> (also
                called your <em>ChartVolt Score</em>) is a single composite
                number that sums up everything you&apos;ve done on the
                platform — trading PnL, win rate, profit factor, competition
                placements, 1v1 wins and badges. It&apos;s what the global
                leaderboard sorts by, what Match Cards display under each
                trader&apos;s avatar, and what shows up on profile cards.
                Higher Score = higher leaderboard rank.
              </p>

              {/* The exact formula */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-yellow-400" />
                  The exact formula
                </h3>
                <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <p className="text-gray-400 mb-2">// Score formula</p>
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
                <p className="text-xs text-gray-400 mt-3">
                  Weights are hard-coded for fairness — every player runs
                  through the same formula. Score is floored at <strong>0</strong>{" "}
                  (large losses cannot push you negative) and displayed as a
                  whole number on every surface.
                </p>
              </div>

              {/* Term breakdown */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Coins className="h-4 w-4 text-yellow-400" />
                  Each term in plain English
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">💰</span>
                      <div>
                        <p className="font-semibold text-green-400">
                          Total P&amp;L
                        </p>
                        <p className="text-xs text-gray-500">
                          Sum of your participant PnL across every competition
                          and 1v1 challenge.
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-green-400 font-mono">× 0.3 pts</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📈</span>
                      <div>
                        <p className="font-semibold text-blue-400">
                          ROI %
                        </p>
                        <p className="text-xs text-gray-500">
                          Total PnL ÷ total starting capital × 100, across all
                          contests/duels you&apos;ve entered.
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-blue-400 font-mono">× 5 pts</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🎯</span>
                      <div>
                        <p className="font-semibold text-cyan-400">Win Rate</p>
                        <p className="text-xs text-gray-500">
                          % of winning closed trades, sourced from your
                          unified trade history.
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-cyan-400 font-mono">× 2 pts</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">⚖️</span>
                      <div>
                        <p className="font-semibold text-purple-400">
                          Profit Factor
                        </p>
                        <p className="text-xs text-gray-500">
                          Gross profit ÷ gross loss (sums of realized PnL on
                          closed trades). If you have no losing trades, the
                          system treats this as 0 to avoid runaway scores.
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-purple-400 font-mono">× 10 pts</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🥇</span>
                      <div>
                        <p className="font-semibold text-yellow-400">
                          Competition Wins
                        </p>
                        <p className="text-xs text-gray-500">
                          1st place finishes — only counted from{" "}
                          <em>completed</em> competitions (not active or
                          cancelled).
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-yellow-400 font-mono">× 50 pts each</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🏅</span>
                      <div>
                        <p className="font-semibold text-orange-400">
                          Podium Finishes
                        </p>
                        <p className="text-xs text-gray-500">
                          Top-3 finishes in completed competitions (1st place
                          counts for both this and the Competition Wins
                          bucket).
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-orange-400 font-mono">× 20 pts each</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">⚔️</span>
                      <div>
                        <p className="font-semibold text-red-400">
                          Challenge Wins
                        </p>
                        <p className="text-xs text-gray-500">
                          1v1 challenges you&apos;ve been declared the winner
                          of after settlement.
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-red-400 font-mono">× 25 pts each</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-pink-500/10 rounded-lg border border-pink-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🎖️</span>
                      <div>
                        <p className="font-semibold text-pink-400">
                          Total Badges
                        </p>
                        <p className="text-xs text-gray-500">
                          Every badge you&apos;ve unlocked (Common, Rare,
                          Epic, Legendary) counts in this bucket.
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-pink-400 font-mono">× 2 pts each</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🌟</span>
                      <div>
                        <p className="font-semibold text-indigo-400">
                          Legendary Badges
                        </p>
                        <p className="text-xs text-gray-500">
                          Bonus on top of the per-badge points — Legendary
                          rarity unlocks an extra 10 pts each (so a Legendary
                          badge is worth 12 pts in total).
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-indigo-400 font-mono">× 10 pts each</p>
                  </div>
                </div>
              </div>

              {/* Example */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-400" />
                  Worked example
                </h3>
                <div className="bg-gray-900/50 rounded-lg p-3 text-sm">
                  <p className="text-gray-400 mb-2">
                    A trader with these stats would compute as follows:
                  </p>
                  <ul className="space-y-1 text-gray-300 mb-3">
                    <li>
                      • P&amp;L: {settings.credits.symbol}500 → 500 × 0.3 ={" "}
                      <span className="text-green-400">150 pts</span>
                    </li>
                    <li>
                      • ROI: 8% → 8 × 5 ={" "}
                      <span className="text-blue-400">40 pts</span>
                    </li>
                    <li>
                      • Win Rate: 60% → 60 × 2 ={" "}
                      <span className="text-cyan-400">120 pts</span>
                    </li>
                    <li>
                      • Profit Factor: 1.5 → 1.5 × 10 ={" "}
                      <span className="text-purple-400">15 pts</span>
                    </li>
                    <li>
                      • 2 Competition Wins → 2 × 50 ={" "}
                      <span className="text-yellow-400">100 pts</span>
                    </li>
                    <li>
                      • 3 Podiums → 3 × 20 ={" "}
                      <span className="text-orange-400">60 pts</span>
                    </li>
                    <li>
                      • 1 Challenge Win → 1 × 25 ={" "}
                      <span className="text-red-400">25 pts</span>
                    </li>
                    <li>
                      • 10 Badges → 10 × 2 ={" "}
                      <span className="text-pink-400">20 pts</span>
                    </li>
                    <li>
                      • 1 Legendary → 1 × 10 ={" "}
                      <span className="text-indigo-400">10 pts</span>
                    </li>
                  </ul>
                  <p className="text-white font-bold">
                    Total Score:{" "}
                    <span className="text-yellow-400">540 pts</span> ⚡
                  </p>
                </div>
              </div>

              {/* Where the numbers come from */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-400" />
                  Where each number comes from
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Total P&amp;L and ROI %</strong>{" "}
                      are aggregated from your{" "}
                      <strong>competition and challenge participation</strong>{" "}
                      — not your wallet balance. PnL outside of contests
                      (e.g. cash-flow movements) doesn&apos;t change your
                      Score.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Win Rate and Profit Factor</strong>{" "}
                      come from your unified <em>trade history</em> (every
                      closed trade across every contest/duel). They&apos;re
                      the same numbers shown on your dashboard and profile
                      analytics, so all surfaces stay consistent.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Competition wins and podiums</strong>{" "}
                      only count once a competition has been finalised — your
                      Score updates the next time the leaderboard rebuilds
                      after settlement.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Challenge wins</strong>{" "}
                      come from the &quot;winner&quot; flag set on the
                      challenge participant record at settlement.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Badges</strong> are
                      counted directly from your unlocked-badges collection.
                      Legendary badges are detected by their internal ID
                      prefix, so newly added Legendary badges flow through
                      automatically.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Refresh / caching */}
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-400" />
                  How fresh is my Score?
                </h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>
                      The full leaderboard (and therefore everyone&apos;s
                      Score) is rebuilt and cached for{" "}
                      <strong className="text-white">about 5 minutes</strong>.
                      Most page loads serve the cached snapshot for speed.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Major events <strong className="text-white">invalidate the cache immediately</strong>{" "}
                      — finishing a competition, winning a challenge or
                      unlocking a badge triggers a rebuild on the next
                      request.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Closing a trade <em>inside</em> a live competition
                      updates your live ranking on the contest&apos;s own
                      leaderboard right away (~15s), but the global Score
                      catches up on the next cache cycle.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Where score appears */}
              <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4 text-purple-400" />
                  Where you&apos;ll see your Score
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <Link
                    href="/leaderboard"
                    className="p-3 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 transition-colors flex items-center gap-2"
                  >
                    <Medal className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Leaderboard.</strong> The
                      sortable <em>Score</em> column drives ranking (default
                      sort).
                    </span>
                  </Link>
                  <div className="p-3 bg-gray-800/50 rounded-lg flex items-center gap-2">
                    <Heart className="h-4 w-4 text-pink-400 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Match Cards.</strong>{" "}
                      Each card shows the trader&apos;s Score in their stats
                      strip.
                    </span>
                  </div>
                  <div className="p-3 bg-gray-800/50 rounded-lg flex items-center gap-2">
                    <User className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Profile Card.</strong>{" "}
                      When you click on a trader&apos;s name, their profile
                      card surfaces their Score in the footer bar.
                    </span>
                  </div>
                  <div className="p-3 bg-gray-800/50 rounded-lg flex items-center gap-2">
                    <Swords className="h-4 w-4 text-red-400 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Profile Card stats.</strong>{" "}
                      The same Score number flows through the stats object
                      attached to any Profile Card you open.
                    </span>
                  </div>
                </div>
              </div>

              {/* Common questions */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-blue-400" />
                  Common questions
                </h3>
                <div className="space-y-3 text-sm text-gray-300">
                  <div>
                    <p className="font-semibold text-white">
                      Can my Score go down?
                    </p>
                    <p className="text-gray-400">
                      Yes — if a big losing competition pulls your total PnL
                      down, the PnL/ROI/profit-factor terms shrink and your
                      overall Score drops. But Score is floored at 0;
                      it will never display a negative number.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-white">
                      Is the leaderboard Score the same as the Match %?
                    </p>
                    <p className="text-gray-400">
                      No. Score is a power ranking (higher = stronger overall
                      record). Match % is a <em>compatibility</em> score
                      between you and a specific opponent — closer skills =
                      higher Match %. They&apos;re completely independent
                      formulas.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-white">
                      Are unverified or hidden accounts on the leaderboard?
                    </p>
                    <p className="text-gray-400">
                      No. Accounts that haven&apos;t verified their email
                      address, and accounts admins have flagged as hidden
                      from public (e.g. internal/support accounts), are
                      excluded from the leaderboard and Match Cards entirely.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-white">
                      Why didn&apos;t my Score change after a trade?
                    </p>
                    <p className="text-gray-400">
                      The global leaderboard cache is refreshed roughly every
                      5 minutes. Settling a competition or a 1v1 invalidates
                      the cache immediately, but a single mid-contest trade
                      waits for the next refresh cycle.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Trading Guide */}
          <section
            id="trading"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <TrendingUp className="h-6 w-6 text-green-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                📈 Trading Guide
              </h2>
            </div>

            <div className="space-y-6 text-gray-300">
              <p className="leading-relaxed">
                Every trade on ChartVolt is placed inside a{" "}
                <strong className="text-white">competition</strong> or{" "}
                <strong className="text-white">1v1 challenge</strong>. You
                don&apos;t trade your wallet — you trade a{" "}
                <em>virtual starting capital</em> assigned when you enter
                the contest. Your real{" "}
                {settings.credits.name.toLowerCase()} balance is only
                touched when you pay an entry fee or receive a prize.
              </p>

              {/* What you can trade */}
              <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-400" />
                  What you can trade
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Forex pairs.</strong> The
                      live trading engine supports the major Forex catalog
                      (USD, EUR, GBP, JPY, AUD, NZD, CAD, CHF — plus the
                      crosses and a handful of exotics).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Three categories:</strong>{" "}
                      <em>Majors</em> (EUR/USD, GBP/USD, USD/JPY…),{" "}
                      <em>Crosses</em> (EUR/GBP, AUD/JPY…) and{" "}
                      <em>Exotics</em> (USD/MXN, USD/ZAR, USD/TRY,
                      USD/SEK, USD/NOK). Spreads are tighter on Majors and
                      wider on Exotics.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Individual contests
                      can narrow the list.</strong> A competition or
                      challenge can restrict you to a subset of symbols —
                      the order ticket only shows what&apos;s tradable
                      inside that contest.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Two UI modes */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-cyan-400" />
                  Two ways to place orders
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <h5 className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
                      <Settings className="h-4 w-4" /> Pro mode
                    </h5>
                    <p className="text-sm text-gray-400 mb-2">
                      The classic broker-style ticket with full controls:
                    </p>
                    <ul className="space-y-1 text-xs text-gray-300">
                      <li>• Market <em>or</em> Limit orders</li>
                      <li>• Choose your lot size manually</li>
                      <li>• Optional Stop Loss and Take Profit (price or pips)</li>
                      <li>• Direction toggle: Buy (Long) / Sell (Short)</li>
                      <li>• Full price/pips switch on the limit input</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                    <h5 className="font-semibold text-purple-400 mb-2 flex items-center gap-2">
                      <Zap className="h-4 w-4" /> Easy mode
                    </h5>
                    <p className="text-sm text-gray-400 mb-2">
                      A streamlined ticket designed for fast decisions:
                    </p>
                    <ul className="space-y-1 text-xs text-gray-300">
                      <li>• Market orders only (executed at the live bid/ask)</li>
                      <li>• Preset lot sizes you can tap</li>
                      <li>• Preset Stop Loss / Take Profit pips</li>
                      <li>• Same Buy/Sell directions, same forex universe</li>
                      <li>• Leverage stays at the platform default</li>
                    </ul>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Switch between Pro and Easy from the toggle inside the
                  trading panel. Your choice is remembered for next time.
                </p>
              </div>

              {/* Order types */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4 text-yellow-400" />
                  Order types
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30 text-sm">
                    <p className="font-semibold text-green-300 mb-1">
                      ⚡ Market order
                    </p>
                    <p className="text-gray-400">
                      Executes immediately at the live bid (for sells) /
                      ask (for buys) at the moment you confirm. The
                      order ticket locks the displayed price right before
                      sending so you don&apos;t get an unexpected fill
                      from a tick during round-trip.
                    </p>
                  </div>
                  <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/30 text-sm">
                    <p className="font-semibold text-cyan-300 mb-1">
                      🎯 Limit order
                    </p>
                    <p className="text-gray-400">
                      Sits as <em>pending</em> until the market reaches
                      your chosen price, then fills automatically.
                      Useful for buying dips or selling rallies. Limit
                      orders can be cancelled while pending.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Pip-based entries: in Pro mode you can enter a limit
                  price as a price <em>or</em> as a pip offset from the
                  current price. Same toggle works for Stop Loss and
                  Take Profit.
                </p>
              </div>

              {/* Trade lifecycle */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-400" />
                  What happens when you place an order
                </h3>
                <ol className="space-y-2 text-sm list-decimal list-inside marker:text-green-400">
                  <li>
                    The platform checks that the{" "}
                    <strong className="text-white">forex market is open</strong>{" "}
                    and that you have no blocking account restriction
                    (suspended, KYC pending, etc.).
                  </li>
                  <li>
                    Your contest&apos;s rules are checked — leverage cap,
                    max open positions, allowed symbols, and (if
                    enabled) drawdown / daily-loss guards.
                  </li>
                  <li>
                    Required <strong className="text-white">margin</strong>{" "}
                    is computed from your quantity, price and leverage,
                    and locked from your contest&apos;s available
                    capital.
                  </li>
                  <li>
                    For market orders: a position is opened immediately
                    at the locked price. For limit orders: the order
                    sits pending until the price is hit.
                  </li>
                  <li>
                    The position then trades live until you close it
                    manually, your Stop Loss / Take Profit triggers, or
                    a margin/liquidation event closes it for you.
                  </li>
                </ol>
              </div>

              {/* Live pricing */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-cyan-400" />
                  Live pricing
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Real bid/ask quotes</strong>{" "}
                      come from a professional Forex data feed (currently
                      via Massive.com).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Quotes update on screen{" "}
                      <strong className="text-white">about once per second</strong>{" "}
                      and your open-position PnL recalculates on every
                      tick.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Spreads can be{" "}
                      <strong className="text-white">live</strong> (raw
                      market spread) or{" "}
                      <strong className="text-white">fixed</strong> (a
                      consistent spread per pair set by the admin) —
                      whichever the platform is currently configured for.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      The platform charges{" "}
                      <strong className="text-white">no commission</strong>{" "}
                      and{" "}
                      <strong className="text-white">no overnight swap</strong>{" "}
                      on individual trades — the only execution cost is
                      the spread, which is already baked into the
                      bid/ask you see.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Stop Loss / Take Profit */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-red-400" />
                  Stop Loss &amp; Take Profit
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30 text-sm">
                    <p className="font-semibold text-green-300 mb-1">
                      🎯 Take Profit
                    </p>
                    <p className="text-gray-400">
                      Auto-closes your position when the market reaches
                      your profit target.
                    </p>
                  </div>
                  <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30 text-sm">
                    <p className="font-semibold text-red-300 mb-1">
                      🛡️ Stop Loss
                    </p>
                    <p className="text-gray-400">
                      Auto-closes when the market moves against you,
                      limiting the damage from a single trade.
                    </p>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30 text-sm">
                    <p className="font-semibold text-blue-300 mb-1">
                      ✏️ Editable
                    </p>
                    <p className="text-gray-400">
                      You can change SL/TP on any open position at any
                      time from the Positions panel.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  SL/TP triggers are evaluated{" "}
                  <strong className="text-white">in real time</strong> as
                  every price tick arrives (typically within a fraction of
                  a second). A backup sweep also runs on the server every
                  minute to catch anything the realtime path missed during
                  a hiccup.
                </p>
              </div>

              {/* Leverage */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-400" />
                  Leverage &amp; lot sizes
                </h3>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="font-semibold text-white mb-2">
                    Current platform defaults
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-gray-400">Leverage range:</span>
                      <span className="text-white ml-2">
                        1× – {settings.leverage.max}×
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Default leverage:</span>
                      <span className="text-white ml-2">
                        {settings.leverage.default}×
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Max open positions:</span>
                      <span className="text-white ml-2">
                        {settings.positions.maxOpen}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Max lots per trade:</span>
                      <span className="text-white ml-2">
                        {settings.positions.maxSize}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Daily loss limit:</span>
                      <span className="text-white ml-2">
                        {settings.risk.dailyLossLimit}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Max drawdown:</span>
                      <span className="text-white ml-2">
                        {settings.risk.maxDrawdown}%
                      </span>
                    </div>
                  </div>
                </div>
                <ul className="space-y-2 text-sm mt-3">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Each <strong className="text-white">competition or
                      challenge</strong> can cap leverage <em>below</em>{" "}
                      the platform max. The effective leverage on your
                      order is the lower of the two — the contest cap
                      always wins.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Required margin ={" "}
                      <code className="bg-gray-800 px-1 rounded text-xs">
                        (lots × contract size × price) ÷ leverage
                      </code>
                      . Higher leverage = less margin locked per trade,
                      but bigger swings in your PnL %.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Lot sizes start at <strong>0.01</strong> and can be
                      fractional. The maximum lots per trade and per-symbol
                      limits are enforced server-side — invalid orders
                      come back with a clear error.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Margin & Liquidation */}
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                  Margin levels &amp; liquidation
                </h3>
                <p className="text-sm mb-3">
                  Margin level ={" "}
                  <code className="bg-gray-800 px-1 rounded text-xs">
                    (equity ÷ used margin) × 100
                  </code>
                  . The platform watches it continuously and reacts at
                  configurable thresholds:
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30 text-sm">
                    <p className="font-semibold text-green-300">
                      ✅ Safe ≥ {settings.margin.safe}%
                    </p>
                    <p className="text-gray-400">Healthy buffer.</p>
                  </div>
                  <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30 text-sm">
                    <p className="font-semibold text-yellow-300">
                      ⚠️ Warning &lt; {settings.margin.warning}%
                    </p>
                    <p className="text-gray-400">
                      Consider trimming positions or hedging.
                    </p>
                  </div>
                  <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/30 text-sm">
                    <p className="font-semibold text-orange-300">
                      🚨 Margin Call &lt; {settings.margin.marginCall}%
                    </p>
                    <p className="text-gray-400">
                      You can no longer open new positions — close
                      losing trades to recover.
                    </p>
                  </div>
                  <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30 text-sm">
                    <p className="font-semibold text-red-300">
                      ⛔ Liquidation ≤ {settings.margin.liquidation}%
                    </p>
                    <p className="text-gray-400">
                      <strong>All</strong> your positions in that contest
                      are force-closed by the platform, and your
                      participant status flips to <em>liquidated</em>.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  After liquidation in a competition with{" "}
                  <em>disqualify-on-liquidation</em> enabled (most of
                  them), you keep view-only access to your trade history
                  but cannot place new orders in that contest. The
                  margin check sweeps every minute as a backup; the
                  realtime engine usually fires first.
                </p>
              </div>

              {/* Contest risk caps */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-400" />
                  Optional contest-level risk caps
                </h3>
                <p className="text-sm mb-3">
                  When a competition turns on its risk limits, your
                  orders are also checked against the contest&apos;s
                  own drawdown rules:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Max drawdown.</strong>{" "}
                      Once your total losses since the start of the
                      contest exceed the configured % of starting
                      capital, new orders are blocked.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Daily loss limit.</strong>{" "}
                      Realised losses since 00:00 UTC are capped at a
                      configurable % — exceeding it pauses new orders
                      for the day.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Equity drawdown.</strong>{" "}
                      When enabled, the contest also blocks orders if
                      your live equity (including unrealised PnL) drops
                      too far below your starting capital.
                    </span>
                  </li>
                </ul>
                <p className="text-xs text-gray-500 mt-2">
                  The contest&apos;s detail page shows whether risk
                  limits are enabled and what the thresholds are before
                  you join.
                </p>
              </div>

              {/* Managing open positions */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-cyan-400" />
                  Managing open positions
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Close anytime.</strong>{" "}
                      Hit Close on the Positions panel to flatten a
                      trade at the current market price. Your PnL is
                      realised immediately and the locked margin is
                      released back into your contest capital.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Edit SL/TP.</strong>{" "}
                      Update the Stop Loss / Take Profit on any open
                      position from the same panel. Changes take effect
                      on the next price tick.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Partial closes
                      aren&apos;t supported.</strong> Closing always
                      flattens the full position. If you want to scale
                      out, open multiple smaller trades instead.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Leverage is fixed
                      at order time.</strong> You can&apos;t change a
                      position&apos;s leverage after it&apos;s opened —
                      close it and re-open if you need a different
                      ratio.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Trade history.</strong>{" "}
                      Closed trades appear in the contest&apos;s Trade
                      History tab with realised PnL, fees (0 by design
                      — spread-only cost), open/close prices and
                      duration.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Market hours */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-cyan-400" />
                  Market hours
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      The Forex market is open{" "}
                      <strong className="text-white">
                        from Sunday 22:00 UTC to Friday 22:00 UTC
                      </strong>{" "}
                      (give or take, depending on daylight-saving
                      shifts). Trading is paused over the weekend.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      The platform respects a{" "}
                      <strong className="text-white">global holiday calendar</strong>{" "}
                      maintained by the admin. On a configured holiday,
                      new orders are blocked and you&apos;ll see a
                      &quot;Market closed for {"{holiday}"}&quot; message
                      in the order ticket.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      The <em>Market Holidays</em> card on your
                      dashboard shows upcoming closures so you can plan
                      around them.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Fair play */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-400" />
                  Fair-play guard rails
                </h3>
                <p className="text-sm text-gray-300">
                  Trades are monitored by automated systems that detect
                  patterns like{" "}
                  <strong className="text-white">mirror trading</strong>{" "}
                  (synchronised trades across linked accounts) and other
                  collusion attempts. Manipulating contests by
                  coordinating with other accounts can result in
                  disqualification, prize reversal and account
                  restrictions. Trade your own book — your stats become
                  part of your public reputation on the leaderboard.
                </p>
              </div>
            </div>
          </section>

          {/* Marketplace */}
          <section
            id="marketplace"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <ShoppingBag className="h-6 w-6 text-purple-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">🛒 Marketplace</h2>
            </div>

            <div className="space-y-6 text-gray-300">
              <p className="leading-relaxed">
                The{" "}
                <Link
                  href="/marketplace"
                  className="text-yellow-400 hover:text-yellow-300 underline underline-offset-2"
                >
                  Marketplace
                </Link>{" "}
                is where you spend your{" "}
                {settings.credits.name.toLowerCase()} on platform unlocks —
                Game Master packages that let you host your own
                competitions, technical indicators that plug into your
                charts, complete trading strategies, and cosmetic items
                like avatars and profile frames. All prices are in{" "}
                <span className="text-yellow-400">{settings.credits.symbol}</span>{" "}
                {settings.credits.name.toLowerCase()} (paid from your
                wallet); items you own are stored in your{" "}
                <Link
                  href="/profile?tab=arsenal"
                  className="text-yellow-400 hover:text-yellow-300 underline underline-offset-2"
                >
                  Trading Arsenal
                </Link>{" "}
                on your profile.
              </p>

              {/* Categories */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-purple-400" />
                  What you&apos;ll find
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <h5 className="font-semibold text-yellow-300 mb-2 flex items-center gap-2">
                      <Trophy className="h-4 w-4" /> Game Master Packages
                    </h5>
                    <p className="text-sm text-gray-400">
                      Subscription packs that let you{" "}
                      <strong className="text-white">create and host your own competitions</strong>{" "}
                      for other players. Each pack defines how many
                      competitions you can run per day, how many players
                      can join, and how much referral commission you earn
                      from your players&apos; entry fees.
                    </p>
                  </div>
                  <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                    <h5 className="font-semibold text-purple-300 mb-2 flex items-center gap-2">
                      <LineChart className="h-4 w-4" /> Indicators
                    </h5>
                    <p className="text-sm text-gray-400">
                      Technical indicators that plug into your trading
                      charts — trend, momentum, volume, volatility and
                      oscillator types. Toggle them on or off from your
                      Trading Arsenal.
                    </p>
                  </div>
                  <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <h5 className="font-semibold text-blue-300 mb-2 flex items-center gap-2">
                      <Target className="h-4 w-4" /> Strategies
                    </h5>
                    <p className="text-sm text-gray-400">
                      Complete trading systems with their own entry/exit
                      rules, suggested risk caps and supported symbols.
                      Strategies come with a default configuration and
                      can be tuned from your Arsenal.
                    </p>
                  </div>
                  <div className="p-4 bg-pink-500/10 rounded-lg border border-pink-500/30">
                    <h5 className="font-semibold text-pink-300 mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> Cosmetics
                    </h5>
                    <p className="text-sm text-gray-400">
                      Avatar frames, profile decorations and other
                      visual unlocks. Apply them from your Arsenal — no
                      effect on trading, just bragging rights on the
                      leaderboard and Match Cards.
                    </p>
                  </div>
                </div>
              </div>

              {/* How to browse */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-cyan-400" />
                  Browsing the store
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Featured strip</strong>{" "}
                      at the top of the homepage (when no filter is
                      active) highlights the items the admin is
                      promoting.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Category chips</strong>{" "}
                      let you filter to <em>All</em>, <em>Game Master</em>,{" "}
                      <em>Indicators</em>, <em>Strategies</em> or{" "}
                      <em>Cosmetics</em>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Search</strong> by
                      item name, short description or tag. Matches are
                      case-insensitive.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Sort</strong> by
                      popularity, price (low→high or high→low), rating,
                      newest, or name. The store remembers your{" "}
                      <em>card vs list</em> layout preference.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Click any card to open a detail modal with the
                      full description, screenshots, supported assets,
                      risk warnings, and the purchase / renew button.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Buying flow */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Coins className="h-4 w-4 text-yellow-400" />
                  Buying an item
                </h3>
                <ol className="space-y-2 text-sm list-decimal list-inside marker:text-yellow-400">
                  <li>
                    Open the item&apos;s detail card and review the
                    description, price (in{" "}
                    {settings.credits.name.toLowerCase()}) and any risk
                    warning.
                  </li>
                  <li>
                    Click <strong className="text-white">Get</strong>{" "}
                    (or <em>Buy</em> on the list view). You&apos;ll
                    accept the Marketplace terms before the purchase is
                    submitted.
                  </li>
                  <li>
                    The price is debited from your wallet in a single
                    transaction. The transaction is logged in your
                    wallet history as{" "}
                    <code className="bg-gray-800 px-1 rounded text-xs">
                      marketplace_purchase
                    </code>
                    .
                  </li>
                  <li>
                    The item is added to your Trading Arsenal
                    instantly — the card flips to{" "}
                    <strong className="text-white">Owned</strong> in the
                    storefront.
                  </li>
                </ol>

                <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm">
                  <p className="text-amber-200 font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Purchase rules
                  </p>
                  <ul className="space-y-1 text-gray-300">
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>
                        Your email must be{" "}
                        <strong className="text-white">verified</strong>{" "}
                        — the marketplace is gated behind email
                        verification platform-wide.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>
                        Your wallet must have at least the item&apos;s
                        price in {settings.credits.name.toLowerCase()}.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>
                        Items can only be purchased{" "}
                        <strong className="text-white">once per account</strong>.
                        After that the button shows <em>Owned</em>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>
                        Items that are unpublished or deprecated are
                        hidden from the storefront and can&apos;t be
                        purchased.
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="mt-3 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-sm">
                  <p className="text-rose-200 font-semibold mb-1">
                    Refunds
                  </p>
                  <p className="text-gray-300">
                    Marketplace purchases are{" "}
                    <strong className="text-white">final and non-refundable</strong>.
                    Items are licensed to your account for personal use
                    only, and the platform doesn&apos;t guarantee
                    specific trading results from indicators or
                    strategies. Item availability and pricing can change
                    without notice.
                  </p>
                </div>
              </div>

              {/* Pricing & discounts */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-green-400" />
                  Pricing &amp; discounts
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Every item is priced in{" "}
                      <strong className="text-white">
                        {settings.credits.name.toLowerCase()}{" "}
                        ({settings.credits.symbol})
                      </strong>{" "}
                      and paid from your wallet balance. You don&apos;t
                      pay with a card directly here — buy credits first,
                      then shop.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Discounts</strong>{" "}
                      show as a struck-through original price next to
                      the current price (e.g.{" "}
                      <span className="line-through text-gray-500">
                        {settings.credits.symbol}500
                      </span>{" "}
                      <span className="text-green-400">{settings.credits.symbol}350</span>
                      ).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Some items can be marked{" "}
                      <strong className="text-white">Free</strong> by
                      the admin (e.g. introductory bonuses) — they show
                      a green badge and require no balance to claim.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Game Master packages — special case */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-400" />
                  Game Master packages — what&apos;s different
                </h3>
                <p className="text-sm mb-3">
                  Game Master (GM) packs aren&apos;t one-off purchases
                  like indicators or cosmetics — they&apos;re{" "}
                  <strong className="text-white">time-limited subscriptions</strong>{" "}
                  that unlock the ability to host competitions for other
                  players and earn referral commissions on their entry
                  fees. Each pack defines its own limits.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Subscription duration.</strong>{" "}
                      Each pack lasts a configurable number of days
                      (default 30). Your GM Dashboard link in the menu
                      appears the moment you own an active GM pack.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Per-pack limits.</strong>{" "}
                      Pack details show how many{" "}
                      <em>competitions per day</em> you can create, the
                      maximum <em>players per competition</em>, and the{" "}
                      <em>referral fee %</em> you earn on every entry
                      fee from your referred players.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Auto-renewal.</strong>{" "}
                      New GM purchases default to auto-renew —
                      we&apos;ll charge the renewal price from your
                      wallet on the expiry date and extend the
                      subscription seamlessly. Auto-renew can be turned
                      on or off from your GM Dashboard. If the wallet
                      doesn&apos;t have enough{" "}
                      {settings.credits.name.toLowerCase()} on renewal
                      day, the subscription expires instead of charging.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Manual renew.</strong>{" "}
                      Once a GM pack has expired, the storefront
                      replaces the <em>Owned</em> badge with a{" "}
                      <strong className="text-white">
                        Renew now ({settings.credits.symbol} price)
                      </strong>{" "}
                      button — clicking it restores the subscription
                      and the wallet transaction is logged as{" "}
                      <code className="bg-gray-800 px-1 rounded text-xs">
                        gamemaster_subscription
                      </code>
                      .
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Upgrading.</strong>{" "}
                      Switching to a more powerful GM pack is supported
                      — the new package becomes your active one and the
                      new limits kick in immediately.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Trading Arsenal connection */}
              <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-cyan-400" />
                  Your Trading Arsenal
                </h3>
                <p className="text-sm text-gray-300 mb-2">
                  Everything you buy lives in the{" "}
                  <Link
                    href="/profile?tab=arsenal"
                    className="text-yellow-400 hover:text-yellow-300 underline underline-offset-2"
                  >
                    Trading Arsenal
                  </Link>{" "}
                  on your profile. From there you can:
                </p>
                <ul className="space-y-1 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Enable / disable individual indicators and
                      strategies.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Tweak indicator-specific settings (where the item
                      exposes them).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Apply avatar frames and cosmetic unlocks.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Manage your Game Master subscription — see
                      renewal date, toggle auto-renew, or renew an
                      expired pack.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Hop straight back to the marketplace via the{" "}
                      <em>Browse Marketplace</em> button.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Leaderboard */}
          <section
            id="leaderboard"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Medal className="h-6 w-6 text-amber-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">🥇 Leaderboard</h2>
            </div>

            <div className="space-y-6 text-gray-300">
              <p className="leading-relaxed">
                The{" "}
                <Link
                  href="/leaderboard"
                  className="text-yellow-400 hover:text-yellow-300 underline underline-offset-2"
                >
                  Global Leaderboard
                </Link>{" "}
                ranks every active trader on ChartVolt by their{" "}
                <strong className="text-yellow-400">Score</strong> — the
                composite metric covered in detail in the{" "}
                <a
                  href="#score-system"
                  className="text-yellow-400 hover:text-yellow-300 underline underline-offset-2"
                >
                  ⚡ Score System
                </a>{" "}
                section. Higher Score = higher rank. The same data feeds
                the Match Cards deck and the Profile Card stats you see
                when you click a trader&apos;s name.
              </p>

              {/* Two views */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4 text-cyan-400" />
                  Two views: Table &amp; Match Cards
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <h5 className="font-semibold text-yellow-300 mb-2 flex items-center gap-2">
                      <Medal className="h-4 w-4" /> Table view
                    </h5>
                    <p className="text-sm text-gray-400">
                      Classic ranking grid with sortable columns and
                      filters. Best for finding a specific trader or
                      sorting by a stat that matters to you.
                    </p>
                  </div>
                  <div className="p-4 bg-pink-500/10 rounded-lg border border-pink-500/30">
                    <h5 className="font-semibold text-pink-300 mb-2 flex items-center gap-2">
                      <Heart className="h-4 w-4" /> Match Cards view
                    </h5>
                    <p className="text-sm text-gray-400">
                      Tinder-style swipe deck of fellow traders ranked
                      by compatibility with you. See the{" "}
                      <a
                        href="#matchmaking"
                        className="text-yellow-400 hover:text-yellow-300 underline underline-offset-2"
                      >
                        💖 Match Cards
                      </a>{" "}
                      section for details.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Toggle between the two from the buttons at the top of
                  the leaderboard page.
                </p>
              </div>

              {/* What the table shows */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-yellow-400" />
                  Columns in the table view
                </h3>
                <p className="text-sm mb-3">
                  Each row shows a trader and their key stats. From left
                  to right:
                </p>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <strong className="text-white">Rank</strong>{" "}
                    <span className="text-gray-400">
                      — current position based on Score.
                    </span>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <strong className="text-white">Trader</strong>{" "}
                    <span className="text-gray-400">
                      — avatar, username, level title pill and total
                      trades.
                    </span>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <strong className="text-white">P&amp;L</strong>{" "}
                    <span className="text-gray-400">
                      — total profit/loss across all competitions and
                      challenges.
                    </span>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <strong className="text-white">ROI</strong>{" "}
                    <span className="text-gray-400">
                      — return % on total starting capital.
                    </span>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <strong className="text-white">Win Rate</strong>{" "}
                    <span className="text-gray-400">
                      — % of winning closed trades.
                    </span>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <strong className="text-white">P. Factor</strong>{" "}
                    <span className="text-gray-400">
                      — profit factor (gross profit ÷ gross loss).
                    </span>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <strong className="text-white">Comps</strong>{" "}
                    <span className="text-gray-400">
                      — competition wins (count of finalised contests
                      finished at #1).
                    </span>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg">
                    <strong className="text-white">Badges</strong>{" "}
                    <span className="text-gray-400">
                      — total badges unlocked.
                    </span>
                  </div>
                  <div className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg sm:col-span-2">
                    <strong className="text-white">Score</strong>{" "}
                    <span className="text-gray-400">
                      — the composite ranking number. This is the
                      default sort column.
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Mobile devices show the same data in a vertically
                  stacked card format for readability.
                </p>
              </div>

              {/* Sorting & filtering */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-cyan-400" />
                  Sorting &amp; filtering
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Sort by any column.</strong>{" "}
                      Click a column header (Rank, P&amp;L, ROI, Win
                      Rate, P. Factor, Comps, Badges or Score) to sort
                      by that stat. Click again to flip ascending /
                      descending. Default: <em>Score, descending</em>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Search</strong> by
                      username or email substring (case-insensitive).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Rank range filter</strong>{" "}
                      — All / Top 10 / Top 25 / Top 50 / Top 100.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Win rate filter</strong>{" "}
                      and{" "}
                      <strong className="text-white">trade count filter</strong>{" "}
                      to focus on, say, &gt;60% win rate or experienced
                      traders only.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-white">Reset filters</strong>{" "}
                      button clears everything if the empty state shows{" "}
                      <em>&quot;No traders match your filters&quot;</em>.
                    </span>
                  </li>
                </ul>
                <p className="text-xs text-gray-500 mt-2">
                  Note: filters and sort apply to the{" "}
                  <strong>current page</strong> of 50 traders. If
                  you&apos;re looking for a specific person far down the
                  list, use the search box or navigate to the right
                  page with the pagination controls.
                </p>
              </div>

              {/* Your Rank */}
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <User className="h-4 w-4 text-purple-400" />
                  Your Rank card
                </h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Above the table, a personalised card shows your
                      current global rank (e.g. <em>#42 of 1,250 traders</em>)
                      so you don&apos;t have to scroll to find yourself.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Your row in the table is highlighted with a
                      coloured stripe and a small{" "}
                      <strong className="text-white">YOU</strong> badge
                      on the avatar so you can spot yourself instantly.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>
                      If you haven&apos;t finished a competition yet
                      you&apos;ll see <em>&quot;Unranked&quot;</em> with
                      a prompt to enter your first contest.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Profile click */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-400" />
                  Open a trader&apos;s profile
                </h3>
                <p className="text-sm">
                  Click any trader&apos;s username to open their{" "}
                  <strong className="text-white">Profile Card</strong>{" "}
                  in a modal — full stats, recent activity and a{" "}
                  <em>Challenge</em> button to send them a 1v1 invite if
                  they&apos;re online and accepting challenges. The
                  Challenge button respects the same restrictions as
                  the rest of the platform (verified email, cooldowns,
                  per-user limits).
                </p>
              </div>

              {/* Who appears */}
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-400" />
                  Who appears on the leaderboard
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Real <strong className="text-white">trader accounts</strong>{" "}
                      with a verified email address. Admin and support
                      accounts are excluded automatically.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Accounts that admins have flagged as{" "}
                      <em>hidden from public</em> (e.g. internal
                      testers, suspended accounts) don&apos;t show up.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>
                      The leaderboard processes up to{" "}
                      <strong className="text-white">5,000 traders</strong>{" "}
                      per refresh to stay fast — once you&apos;re in,
                      you&apos;re in.
                    </span>
                  </li>
                </ul>
              </div>

              {/* How fresh */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-400" />
                  How often does it update?
                </h3>
                <p className="text-sm text-gray-300">
                  The full leaderboard is rebuilt and cached for{" "}
                  <strong className="text-white">about 5 minutes</strong>{" "}
                  for performance. Major events — competition
                  settlement, challenge winners, badge awards — bust
                  the cache immediately so winners climb the board on
                  the next page load. There&apos;s no manual refresh
                  button; just navigate away and back or change page
                  to grab the latest snapshot.
                </p>
              </div>
            </div>
          </section>

          {/* Credits & Wallet */}
          <section
            id="credits"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Coins className="h-6 w-6 text-yellow-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                💰 {settings.credits.name} & Wallet
              </h2>
            </div>

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                <strong className="text-white">{settings.credits.name}</strong>{" "}
                ({settings.credits.symbol}) are the in-platform currency you
                use to enter competitions, accept 1v1 challenges, buy items
                in the Marketplace, and receive prizes. You buy them with
                real {settings.currency.code}, and you can withdraw your
                winnings back to {settings.currency.code} at any time
                (subject to fees and KYC rules below).
              </p>

              <p className="leading-relaxed text-sm text-gray-400">
                Your wallet lives on{" "}
                <Link
                  href="/wallet"
                  className="text-cyan-400 hover:underline"
                >
                  /wallet
                </Link>
                . You can also reach it from the sidebar (
                <strong className="text-white">Wallet</strong>) and from
                the user dropdown in the top-right.
              </p>

              {/* Conversion + key numbers */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Coins className="h-4 w-4 text-yellow-400" />
                  Conversion & limits
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Rate</p>
                    <p className="text-white font-bold">
                      {settings.currency.symbol}1 ={" "}
                      {settings.credits.eurToCreditsRate}{" "}
                      {settings.credits.symbol}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Min. deposit</p>
                    <p className="text-white font-bold">
                      {settings.currency.symbol}
                      {settings.credits.minimumDeposit}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Min. withdrawal</p>
                    <p className="text-white font-bold">
                      {settings.currency.symbol}
                      {settings.credits.minimumWithdrawal}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Withdrawal fee</p>
                    <p className="text-white font-bold">
                      {settings.credits.withdrawalFee}%
                    </p>
                  </div>
                  {settings.payments &&
                    settings.payments.depositFeePercentage > 0 && (
                      <div>
                        <p className="text-gray-400">Deposit fee</p>
                        <p className="text-white font-bold">
                          {settings.payments.depositFeePercentage}%
                        </p>
                      </div>
                    )}
                  {settings.vat?.enabled && (
                    <div>
                      <p className="text-gray-400">VAT (where applicable)</p>
                      <p className="text-white font-bold">
                        {settings.vat.percentage}%
                      </p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Example with the current rate:{" "}
                  {settings.currency.symbol}
                  {settings.credits.minimumDeposit} →{" "}
                  <span className="text-white font-semibold">
                    {(
                      settings.credits.minimumDeposit *
                      settings.credits.eurToCreditsRate
                    ).toLocaleString()}{" "}
                    {settings.credits.symbol} {settings.credits.name}
                  </span>
                  .
                </p>
              </div>

              {/* What lives in your wallet */}
              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-cyan-400" />
                  What you see on the Wallet page
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1">
                      Available Balance
                    </p>
                    <p className="text-xs text-gray-400">
                      Your spendable {settings.credits.name} balance. This
                      is what gets debited when you enter a competition,
                      accept a 1v1, or buy from the Marketplace, and it
                      drops the moment a withdrawal request is submitted.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1">
                      Lifetime totals
                    </p>
                    <p className="text-xs text-gray-400">
                      Total Deposited, Total Withdrawn, Total Spent
                      (Competitions / Challenges / Marketplace), Total Won
                      (Competitions / Challenges), Refunded, and Admin
                      adjustments.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1">
                      Referral / Game Master earnings
                    </p>
                    <p className="text-xs text-gray-400">
                      If you&apos;re a Game Master, your referral payouts
                      appear as a separate card and are credited to your
                      balance as wallet transactions (see{" "}
                      <button
                        type="button"
                        onClick={() => scrollToSection("gamemaster")}
                        className="text-purple-400 hover:underline"
                      >
                        👑 Game Master
                      </button>
                      ).
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1">
                      Transaction History
                    </p>
                    <p className="text-xs text-gray-400">
                      Full ledger of every movement on your wallet, with
                      filters by category, status and date range, and a
                      &quot;load more&quot; pager (25 per page). Excel
                      export and per-deposit invoice download are
                      available.
                    </p>
                  </div>
                </div>
              </div>

              {/* Buying credits */}
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                <h5 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Buying {settings.credits.name}
                </h5>
                <ol className="space-y-2 text-sm text-gray-300 list-decimal pl-5">
                  <li>
                    Open{" "}
                    <Link
                      href="/wallet"
                      className="text-cyan-400 hover:underline"
                    >
                      /wallet
                    </Link>{" "}
                    and click{" "}
                    <strong className="text-white">
                      &quot;Buy {settings.credits.name}&quot;
                    </strong>
                    .
                  </li>
                  <li>
                    Enter the amount in {settings.currency.code} (minimum{" "}
                    {settings.currency.symbol}
                    {settings.credits.minimumDeposit}). The dialog shows
                    you exactly how many {settings.credits.name} you&apos;ll
                    receive at the current rate.
                  </li>
                  {settings.payments?.anyEnabled && (
                    <li>
                      Pay with your{" "}
                      <strong className="text-white">
                        debit or credit card
                      </strong>{" "}
                      (Visa, Mastercard, Maestro, American Express).
                      Payments are processed by our secure payment
                      processor — ChartVolt never sees or stores your
                      full card number.
                    </li>
                  )}
                  <li>
                    Complete the secure payment.{" "}
                    <span className="text-gray-400">
                      Your bank may show a 3D Secure (3DS2) challenge to
                      confirm it&apos;s really you.
                    </span>
                  </li>
                  <li>
                    {settings.credits.name} land in your wallet
                    automatically once the provider confirms the payment.
                    A receipt is recorded as a{" "}
                    <code className="text-xs bg-gray-900 px-1.5 py-0.5 rounded">
                      deposit
                    </code>{" "}
                    transaction.
                  </li>
                </ol>
                {(settings.kyc?.requiredForDeposit ||
                  settings.payments?.depositFeePercentage ||
                  settings.vat?.enabled) && (
                  <div className="mt-3 pt-3 border-t border-green-500/20 space-y-1 text-xs text-gray-400">
                    {settings.payments &&
                      settings.payments.depositFeePercentage > 0 && (
                        <p>
                          • A platform processing fee of{" "}
                          <strong className="text-white">
                            {settings.payments.depositFeePercentage}%
                          </strong>{" "}
                          is added at checkout.
                        </p>
                      )}
                    {settings.vat?.enabled && (
                      <p>
                        • VAT ({settings.vat.percentage}%) applies for EU
                        consumers when the company is EU-registered. The
                        applicable amount is shown at checkout.
                      </p>
                    )}
                    {settings.kyc?.enabled &&
                      settings.kyc?.requiredForDeposit && (
                        <p>
                          • Identity verification (KYC) is required before
                          you can fund the wallet
                          {settings.kyc.requiredAmount > 0 && (
                            <>
                              {" "}
                              for deposits at or above{" "}
                              {settings.currency.symbol}
                              {settings.kyc.requiredAmount}
                            </>
                          )}
                          .
                        </p>
                      )}
                  </div>
                )}
              </div>

              {/* Withdrawing */}
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <h5 className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Withdrawing to {settings.currency.code}
                </h5>
                <ol className="space-y-2 text-sm text-gray-300 list-decimal pl-5">
                  <li>
                    Open{" "}
                    <Link
                      href="/wallet"
                      className="text-cyan-400 hover:underline"
                    >
                      /wallet
                    </Link>{" "}
                    and click{" "}
                    <strong className="text-white">
                      &quot;Withdraw&quot;
                    </strong>
                    .
                  </li>
                  <li>
                    Enter the amount (minimum{" "}
                    {settings.currency.symbol}
                    {settings.credits.minimumWithdrawal}). The dialog
                    shows the fee, the net payout, and the available
                    payout method — typically a{" "}
                    <strong className="text-white">refund to the card</strong>{" "}
                    you used to deposit, or a manual{" "}
                    <strong className="text-white">bank transfer</strong>{" "}
                    when that&apos;s not possible.
                  </li>
                  <li>
                    Submit. Your {settings.credits.name} are deducted{" "}
                    <strong className="text-white">immediately</strong>{" "}
                    and the request appears in your Transaction History
                    as{" "}
                    <code className="text-xs bg-gray-900 px-1.5 py-0.5 rounded">
                      withdrawal
                    </code>{" "}
                    with status{" "}
                    <strong className="text-yellow-400">
                      pending
                    </strong>
                    .
                  </li>
                  <li>
                    The request moves through{" "}
                    <strong className="text-cyan-400">approved</strong> →{" "}
                    <strong className="text-cyan-400">processing</strong>{" "}
                    →{" "}
                    <strong className="text-green-400">completed</strong>.
                    If anything fails (provider error, payout method
                    invalid, etc.) it becomes{" "}
                    <strong className="text-red-400">rejected</strong>,{" "}
                    <strong className="text-red-400">failed</strong>, or{" "}
                    <strong className="text-gray-400">cancelled</strong>{" "}
                    and the credits are refunded to your balance as a{" "}
                    <code className="text-xs bg-gray-900 px-1.5 py-0.5 rounded">
                      withdrawal_refund
                    </code>
                    .
                  </li>
                </ol>
                <div className="mt-3 pt-3 border-t border-blue-500/20 space-y-1 text-xs text-gray-400">
                  {settings.kyc?.enabled &&
                    settings.kyc?.requiredForWithdrawal && (
                      <p>
                        • Identity verification (KYC) is required before
                        your first withdrawal can be approved
                        {settings.kyc.requiredAmount > 0 && (
                          <>
                            {" "}
                            for amounts at or above{" "}
                            {settings.currency.symbol}
                            {settings.kyc.requiredAmount}
                          </>
                        )}
                        .
                      </p>
                    )}
                  <p>
                    • The fee shown in the dialog is the authoritative
                    one — it is computed from the current platform
                    settings (default{" "}
                    {settings.credits.withdrawalFee}%) and may include a
                    fixed component depending on payout method.
                  </p>
                  <p>
                    • Processing time, daily / monthly withdrawal limits,
                    a cooldown between requests, and a hold period after
                    new deposits may apply. The withdrawal dialog will
                    tell you exactly what blocks a request if any of
                    these rules are hit.
                  </p>
                  <p>
                    • Withdrawals are blocked while you are in an{" "}
                    <strong className="text-white">
                      active competition or 1v1 challenge
                    </strong>{" "}
                    that has locked stakes.
                  </p>
                </div>
              </div>

              {/* Transaction types */}
              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-400" />
                  Transaction types you may see in your history
                </h4>
                <div className="grid gap-2 sm:grid-cols-2 text-xs text-gray-300">
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <p className="font-semibold text-green-400 mb-1">
                      Money in
                    </p>
                    <p className="text-gray-400">
                      <code>deposit</code>,{" "}
                      <code>manual_deposit_credit</code>,{" "}
                      <code>competition_win</code>,{" "}
                      <code>challenge_win</code>,{" "}
                      <code>competition_refund</code>,{" "}
                      <code>challenge_refund</code>,{" "}
                      <code>challenge_declined</code>,{" "}
                      <code>challenge_expired</code>,{" "}
                      <code>withdrawal_refund</code>,{" "}
                      <code>incident_compensation</code>,{" "}
                      <code>admin_adjustment</code> (positive)
                    </p>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <p className="font-semibold text-red-400 mb-1">
                      Money out
                    </p>
                    <p className="text-gray-400">
                      <code>withdrawal</code>,{" "}
                      <code>withdrawal_fee</code>,{" "}
                      <code>competition_entry</code>,{" "}
                      <code>challenge_entry</code>,{" "}
                      <code>marketplace_purchase</code>,{" "}
                      <code>gamemaster_subscription</code>,{" "}
                      <code>platform_fee</code>,{" "}
                      <code>chargeback_clawback</code>,{" "}
                      <code>admin_adjustment</code> (negative)
                    </p>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600 sm:col-span-2">
                    <p className="font-semibold text-purple-400 mb-1">
                      Game Master payouts
                    </p>
                    <p className="text-gray-400">
                      <code>gamemaster_earning</code> (competition
                      referral commission),{" "}
                      <code>gamemaster_challenge_referral</code> (1v1
                      referral commission),{" "}
                      <code>gamemaster_subscription_refund</code> (if a
                      GM package purchase is reversed).
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Every row in your history shows the type, amount,{" "}
                  status (
                  <span className="text-yellow-400">pending</span> /{" "}
                  <span className="text-green-400">completed</span> /{" "}
                  <span className="text-red-400">failed</span> /{" "}
                  <span className="text-gray-400">cancelled</span> /{" "}
                  <span className="text-orange-400">disputed</span>),
                  balance before/after, and a description. Click any row
                  for the full detail panel.
                </p>
              </div>

              {/* Invoices */}
              <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-cyan-400" />
                  Invoices for deposits
                </h4>
                <p className="text-sm text-gray-300 leading-relaxed">
                  When invoicing is enabled, every successful deposit
                  generates a tax-compliant invoice that is e-mailed to
                  you and made available from the Transaction History row
                  (look for the download icon). The invoice itemises the
                  credit purchase, the platform fee (if any), and VAT
                  (when applicable). You can find every invoice you have
                  ever received in{" "}
                  <button
                    type="button"
                    onClick={() => scrollToSection("invoices")}
                    className="text-cyan-400 hover:underline"
                  >
                    📄 Invoices &amp; Billing
                  </button>
                  .
                </p>
              </div>

              {/* Safety / chargebacks */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Important: chargebacks &amp; clawbacks
                </h4>
                <ul className="space-y-1.5 text-sm text-gray-300 list-disc pl-5">
                  <li>
                    If you dispute a deposit with your bank, the platform
                    will record a{" "}
                    <code className="text-xs bg-gray-900 px-1.5 py-0.5 rounded">
                      chargeback_clawback
                    </code>{" "}
                    on your wallet for the disputed amount, your account
                    may be restricted while the case is reviewed, and the
                    original deposit invoice is marked as{" "}
                    <strong className="text-orange-400">disputed</strong>.
                  </li>
                  <li>
                    Wallet balances do{" "}
                    <strong className="text-white">not</strong> expire.
                    They stay yours until you spend them, withdraw them,
                    or close your account.
                  </li>
                  <li>
                    The platform never asks for your full card number,
                    CVV, or banking password — card payments are handled
                    end-to-end by our PCI-DSS compliant payment
                    processor.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Profile */}
          <section
            id="profile"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <User className="h-6 w-6 text-cyan-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                👤 Profile & Stats
              </h2>
            </div>

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Your profile is your home in ChartVolt — the place where
                you fine-tune your identity, see your career-level stats,
                manage notifications, KYC, security, and your purchased
                tools. Open it at{" "}
                <Link
                  href="/profile"
                  className="text-cyan-400 hover:underline"
                >
                  /profile
                </Link>{" "}
                or via the avatar dropdown in the top-right.
              </p>

              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 text-xs text-gray-300">
                <strong className="text-cyan-300">Good to know:</strong>{" "}
                There is no public &quot;/profile/username&quot; URL —{" "}
                <code className="bg-gray-900 px-1 py-0.5 rounded">
                  /profile
                </code>{" "}
                always shows <em>your own</em> profile. Other traders see
                a limited card view of you (avatar, bio, public stats) via
                the Profile Card on the leaderboard and on Match Cards.
              </div>

              {/* Tabs map */}
              <div>
                <h3 className="font-semibold text-white text-base mb-2">
                  The seven tabs on /profile
                </h3>
                <p className="text-sm text-gray-400 mb-3">
                  The active tab is reflected in the URL as{" "}
                  <code className="bg-gray-900 px-1 py-0.5 rounded">
                    ?tab=…
                  </code>{" "}
                  so you can bookmark or deep-link directly to any tab.
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Overview */}
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-cyan-400 text-sm mb-1 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Overview
                    </p>
                    <p className="text-xs text-gray-400">
                      Your Trader Level & Title with an XP progress bar
                      (earn XP by collecting badges — see{" "}
                      <button
                        type="button"
                        onClick={() => scrollToSection("trader-levels")}
                        className="text-cyan-400 hover:underline"
                      >
                        Trader Levels
                      </button>
                      ), plus competition and 1v1 summary cards (entered,
                      won, podiums, credits won, victories).
                    </p>
                  </div>

                  {/* Journey */}
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-purple-400 text-sm mb-1 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Journey
                    </p>
                    <p className="text-xs text-gray-400">
                      A visual roadmap of your milestones on the platform
                      — competitions joined, wins, badge unlocks, and
                      account events plotted across your account
                      timeline.
                    </p>
                  </div>

                  {/* Badges */}
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-yellow-400 text-sm mb-1 flex items-center gap-2">
                      <Medal className="h-4 w-4" />
                      Badges
                    </p>
                    <p className="text-xs text-gray-400">
                      Every badge you have earned (and every one you
                      haven&apos;t) with filters by{" "}
                      <strong className="text-white">category</strong>{" "}
                      and{" "}
                      <strong className="text-white">rarity</strong>{" "}
                      (Common / Rare / Epic / Legendary). Click a badge
                      to open the detail card. Each rarity grants XP —
                      see{" "}
                      <button
                        type="button"
                        onClick={() => scrollToSection("badge-system")}
                        className="text-yellow-400 hover:underline"
                      >
                        Badge System
                      </button>
                      .
                    </p>
                  </div>

                  {/* Arsenal */}
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-orange-400 text-sm mb-1 flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Arsenal
                    </p>
                    <p className="text-xs text-gray-400">
                      Your purchased indicators, strategies, Game Master
                      packages, profile frames, and other items from the
                      Marketplace. Toggle items on/off, see expiry dates,
                      and renew. Full details in{" "}
                      <button
                        type="button"
                        onClick={() => scrollToSection("arsenal")}
                        className="text-orange-400 hover:underline"
                      >
                        Trading Arsenal
                      </button>
                      .
                    </p>
                  </div>

                  {/* Verification */}
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-green-400 text-sm mb-1 flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4" />
                      Verification
                    </p>
                    <p className="text-xs text-gray-400">
                      Your identity-verification (KYC) status and the
                      &quot;Start verification&quot; flow. KYC is
                      required before withdrawing
                      {settings.kyc?.enabled &&
                        settings.kyc?.requiredAmount > 0 && (
                          <>
                            {" "}
                            (for amounts at or above{" "}
                            {settings.currency.symbol}
                            {settings.kyc.requiredAmount})
                          </>
                        )}
                      .
                    </p>
                  </div>

                  {/* Notifications */}
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-pink-400 text-sm mb-1 flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Notifications
                    </p>
                    <p className="text-xs text-gray-400">
                      Your in-app notification center: competition
                      invites, challenge requests, prize payouts, KYC
                      updates, marketplace receipts, and system
                      announcements. See{" "}
                      <button
                        type="button"
                        onClick={() => scrollToSection("notifications")}
                        className="text-pink-400 hover:underline"
                      >
                        Notifications
                      </button>
                      .
                    </p>
                  </div>

                  {/* Settings */}
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600 sm:col-span-2">
                    <p className="font-semibold text-gray-200 text-sm mb-1 flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </p>
                    <p className="text-xs text-gray-400">
                      Everything you can change about yourself
                      (picture, bio, name, address), plus password
                      change, two-factor authentication, friend-request
                      privacy, and account deactivation. Full breakdown
                      below.
                    </p>
                  </div>
                </div>
              </div>

              {/* Settings deep-dive */}
              <div>
                <h3 className="font-semibold text-white text-base mb-2 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-gray-300" />
                  What you can change in Settings
                </h3>

                <div className="space-y-3">
                  {/* Picture & bio */}
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1">
                      Profile Picture &amp; Bio
                    </p>
                    <ul className="space-y-1 text-xs text-gray-400 list-disc pl-5">
                      <li>
                        Upload a new picture —{" "}
                        <strong className="text-white">
                          JPEG, PNG, WebP, or GIF
                        </strong>
                        , up to{" "}
                        <strong className="text-white">5&nbsp;MB</strong>.
                      </li>
                      <li>
                        Write a short bio (max{" "}
                        <strong className="text-white">500</strong>{" "}
                        characters). This is what other traders see on
                        your public Profile Card.
                      </li>
                    </ul>
                  </div>

                  {/* Personal info */}
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1">
                      Personal Information
                    </p>
                    <ul className="space-y-1 text-xs text-gray-400 list-disc pl-5">
                      <li>
                        <strong className="text-white">Full name</strong>{" "}
                        — editable.
                      </li>
                      <li>
                        <strong className="text-white">Email</strong> —{" "}
                        <span className="text-red-300">
                          read-only.
                        </span>{" "}
                        Email cannot be changed from this screen for
                        security reasons. Contact support if you need
                        to update it.
                      </li>
                      <li>
                        <strong className="text-white">
                          Address fields
                        </strong>{" "}
                        — country, street, city, postal code, phone.
                        These appear on your tax invoices for deposits
                        and are required for KYC.
                      </li>
                    </ul>
                    <p className="text-xs text-gray-500 mt-2">
                      A sticky bar appears whenever you have unsaved
                      changes; click{" "}
                      <strong className="text-white">
                        &quot;Save changes&quot;
                      </strong>{" "}
                      or{" "}
                      <strong className="text-white">
                        &quot;Discard&quot;
                      </strong>{" "}
                      to commit or revert.
                    </p>
                  </div>

                  {/* Security */}
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-cyan-400" />
                      Security
                    </p>
                    <ul className="space-y-1 text-xs text-gray-400 list-disc pl-5">
                      <li>
                        <strong className="text-white">
                          Change password
                        </strong>{" "}
                        — enter your current password, new password, and
                        confirm. If 2FA is enabled you&apos;ll be
                        prompted for your authenticator code.
                      </li>
                      <li>
                        <strong className="text-white">
                          Two-Factor Authentication (2FA)
                        </strong>{" "}
                        — turn on TOTP-based 2FA with any standard
                        authenticator app (Google Authenticator, Authy,
                        1Password, etc.). Strongly recommended; required
                        for many sensitive actions once enabled.
                      </li>
                    </ul>
                  </div>

                  {/* Privacy */}
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1">
                      Privacy
                    </p>
                    <ul className="space-y-1 text-xs text-gray-400 list-disc pl-5">
                      <li>
                        <strong className="text-white">
                          Allow friend requests
                        </strong>{" "}
                        — when off, other traders can&apos;t send you
                        friend requests. Your stats stay visible on the
                        leaderboard.
                      </li>
                    </ul>
                  </div>

                  {/* Deactivate */}
                  <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                    <p className="font-semibold text-red-400 text-sm mb-1 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Deactivate account
                    </p>
                    <p className="text-xs text-gray-400">
                      Closes your account. You will be signed out and
                      your profile will no longer appear on public
                      surfaces. Any pending withdrawals are processed
                      according to platform policy. Open competitions
                      and challenges must be settled first.
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats — single source of truth */}
              <div>
                <h3 className="font-semibold text-white text-base mb-2 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-400" />
                  Where your stats come from
                </h3>
                <p className="text-sm text-gray-400 mb-3">
                  ChartVolt has a single source of truth so the same
                  number shows up everywhere it appears:
                </p>
                <div className="grid gap-2 text-xs text-gray-300">
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Trading stats
                    </strong>{" "}
                    (Trades, Win Rate, P&amp;L, Profit Factor, best/worst
                    trade, avg win/loss) are computed from the unified{" "}
                    <code className="bg-gray-900 px-1 py-0.5 rounded">
                      TradeHistory
                    </code>{" "}
                    collection — the same one feeding your Dashboard,
                    your competition/challenge result screens, and the
                    Leaderboard.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Competition stats
                    </strong>{" "}
                    (entered, won, podiums, prize money) come from your{" "}
                    <code className="bg-gray-900 px-1 py-0.5 rounded">
                      CompetitionParticipant
                    </code>{" "}
                    rows.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      1v1 stats
                    </strong>{" "}
                    (challenges entered, won, credits won) come from your{" "}
                    <code className="bg-gray-900 px-1 py-0.5 rounded">
                      ChallengeParticipant
                    </code>{" "}
                    rows.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">Score</strong>{" "}
                    (ChartVolt Score) is computed on the leaderboard
                    cache and shown on your Profile Card — the formula
                    and what counts is documented in the{" "}
                    <button
                      type="button"
                      onClick={() => scrollToSection("score-system")}
                      className="text-yellow-400 hover:underline"
                    >
                      ⚡ Score System
                    </button>{" "}
                    section.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      XP &amp; Level / Title
                    </strong>{" "}
                    come from the badges you have earned — see{" "}
                    <button
                      type="button"
                      onClick={() => scrollToSection("trader-levels")}
                      className="text-cyan-400 hover:underline"
                    >
                      Trader Levels
                    </button>
                    .
                  </div>
                </div>
              </div>

              {/* What others see */}
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-cyan-300" />
                  What other traders see of you
                </h4>
                <ul className="space-y-1.5 text-sm text-gray-300 list-disc pl-5">
                  <li>
                    On the{" "}
                    <button
                      type="button"
                      onClick={() => scrollToSection("leaderboard")}
                      className="text-cyan-400 hover:underline"
                    >
                      Leaderboard
                    </button>{" "}
                    and in-competition leaderboard, clicking your name
                    opens a{" "}
                    <strong className="text-white">
                      Profile Card modal
                    </strong>{" "}
                    with your{" "}
                    <strong className="text-white">profile picture</strong>
                    ,{" "}
                    <strong className="text-white">bio</strong>, tier
                    label (Champion / Elite / Veteran / Trader), trading
                    stats (Win Rate, Trades, P&amp;L), competition &amp;
                    1v1 battle record, badges, and Score.
                  </li>
                  <li>
                    On{" "}
                    <button
                      type="button"
                      onClick={() => scrollToSection("matchmaking")}
                      className="text-pink-400 hover:underline"
                    >
                      Match Cards
                    </button>
                    , other traders see your avatar, username, public
                    stats and the matchmaking reasons — no private
                    fields are exposed.
                  </li>
                  <li>
                    <strong className="text-white">
                      Never exposed publicly:
                    </strong>{" "}
                    email, address, phone, country, payment details,
                    transaction history, balance.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Trading Arsenal */}
          <section
            id="arsenal"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Briefcase className="h-6 w-6 text-orange-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                🎯 Trading Arsenal
              </h2>
            </div>

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Your purchased indicators, strategies, and tools. Activate them
                on your charts.
              </p>

              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">
                  💡 How to Use:
                </h4>
                <ol className="space-y-2 text-sm">
                  <li>1. Go to any competition trading view</li>
                  <li>2. Click &quot;Trading Arsenal&quot; in the toolbar</li>
                  <li>3. Toggle ON the tools you want to activate</li>
                  <li>4. See signals directly on your chart</li>
                </ol>
              </div>
            </div>
          </section>

          {/* Game Master */}
          <section
            id="gamemaster"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Award className="h-6 w-6 text-purple-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">👑 Game Master</h2>
            </div>

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Become a Game Master and earn passive income! Share your
                referral link and earn a percentage of entry fees whenever your
                referred users join competitions or challenges.
              </p>

              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">
                  🎮 How to Become a Game Master:
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-bold">
                        1
                      </span>
                      <span className="font-semibold text-white">
                        Purchase Package
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 ml-8">
                      Buy a Game Master package from the Marketplace
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-bold">
                        2
                      </span>
                      <span className="font-semibold text-white">Activate</span>
                    </div>
                    <p className="text-xs text-gray-400 ml-8">
                      Go to Arsenal and activate your package
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-bold">
                        3
                      </span>
                      <span className="font-semibold text-white">
                        Share Link
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 ml-8">
                      Get your unique referral link and share it
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-bold">
                        4
                      </span>
                      <span className="font-semibold text-white">Earn!</span>
                    </div>
                    <p className="text-xs text-gray-400 ml-8">
                      Earn % of entry fees from your referrals
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">
                  📦 Available Packages:
                </h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-bold text-white mb-1">Starter</h5>
                    <p className="text-yellow-400 font-semibold text-sm">
                      299 {settings.credits.name}
                    </p>
                    <ul className="text-xs text-gray-400 mt-2 space-y-1">
                      <li>• 1 competition/day</li>
                      <li>• 30 max users</li>
                      <li>• 5% referral fee</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-purple-500/20 rounded-lg border border-purple-500/30">
                    <h5 className="font-bold text-purple-400 mb-1">Pro ⭐</h5>
                    <p className="text-yellow-400 font-semibold text-sm">
                      599 {settings.credits.name}
                    </p>
                    <ul className="text-xs text-gray-400 mt-2 space-y-1">
                      <li>• 3 competitions/day</li>
                      <li>• 75 max users</li>
                      <li>• 7.5% referral fee</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                    <h5 className="font-bold text-yellow-400 mb-1">Elite ⭐</h5>
                    <p className="text-yellow-400 font-semibold text-sm">
                      999 {settings.credits.name}
                    </p>
                    <ul className="text-xs text-gray-400 mt-2 space-y-1">
                      <li>• 10 competitions/day</li>
                      <li>• 150 max users</li>
                      <li>• 10% referral fee</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                  <h5 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Earning Potential
                  </h5>
                  <p className="text-sm text-gray-400">
                    If you refer 50 users who each join a 100{" "}
                    {settings.credits.name} competition with 10% referral fee,
                    you earn{" "}
                    <span className="text-green-400 font-bold">
                      500 {settings.credits.name}
                    </span>{" "}
                    per competition!
                  </p>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <h5 className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
                    <Eye className="h-4 w-4" /> Dashboard Access
                  </h5>
                  <p className="text-sm text-gray-400">
                    Track your referrals, view earnings history, and manage your
                    subscription from your Game Master Dashboard.
                  </p>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">💡 Pro Tips:</h4>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Referrals are permanent - once linked, you earn from them
                      forever
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Enable auto-renewal to never lose your Game Master status
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Create your own competitions to attract more users
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Earnings are credited directly to your wallet instantly
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section
            id="notifications"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Bell className="h-6 w-6 text-pink-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                🔔 Notifications
              </h2>
            </div>

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Stay informed with real-time notifications about trading
                activity and competitions.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                  <h5 className="font-semibold text-green-400">
                    📈 Trade Executed
                  </h5>
                </div>
                <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                  <h5 className="font-semibold text-red-400">
                    🛑 Trade Closed
                  </h5>
                </div>
                <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                  <h5 className="font-semibold text-yellow-400">
                    🏆 Competition Started
                  </h5>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <h5 className="font-semibold text-blue-400">
                    🏅 Badge Earned
                  </h5>
                </div>
              </div>
            </div>
          </section>

          {/* Trader Levels - DYNAMIC */}
          <section
            id="trader-levels"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Award className="h-6 w-6 text-yellow-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                👑 Trader Levels & Titles
              </h2>
            </div>

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed mb-4">
                Earn badges to gain Experience Points (XP) and progress through{" "}
                {settings.levels.length} prestigious trader levels!
              </p>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">
                  How to Earn XP:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center p-3 rounded-lg bg-gray-700/50">
                    <p className="text-gray-400 text-xs mb-1">
                      ⭐ Common Badge
                    </p>
                    <p className="text-green-400 font-bold text-lg">
                      +{settings.badgeXP.common} XP
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gray-700/50">
                    <p className="text-gray-400 text-xs mb-1">💎 Rare Badge</p>
                    <p className="text-blue-400 font-bold text-lg">
                      +{settings.badgeXP.rare} XP
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gray-700/50">
                    <p className="text-gray-400 text-xs mb-1">👑 Epic Badge</p>
                    <p className="text-purple-400 font-bold text-lg">
                      +{settings.badgeXP.epic} XP
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gray-700/50">
                    <p className="text-gray-400 text-xs mb-1">
                      🌟 Legendary Badge
                    </p>
                    <p className="text-yellow-400 font-bold text-lg">
                      +{settings.badgeXP.legendary} XP
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">
                  All Trader Levels:
                </h4>
                <div className="space-y-2">
                  {settings.levels.map((level, index) => (
                    <div
                      key={level.level}
                      className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg border border-gray-600"
                    >
                      <div className="flex items-center gap-3">
                        <GameIcon name={level.icon as GameIconName} size={28} />
                        <div>
                          <p className={`font-semibold ${level.color}`}>
                            {level.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            Level {level.level}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400">
                        {formatXPRange(index)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Badge System - DYNAMIC */}
          <section
            id="badge-system"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Award className="h-6 w-6 text-purple-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">🏅 Badge System</h2>
            </div>

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed mb-4">
                Earn badges by achieving milestones. Each badge grants XP
                towards your trader level!
              </p>

              <div>
                <h4 className="font-semibold text-white mb-3">
                  Badge Categories:
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-white mb-2">
                      🏆 Competition
                    </h5>
                    <p className="text-sm text-gray-400">
                      First place, podiums, streaks
                    </p>
                  </div>
                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-white mb-2">
                      📈 Trading
                    </h5>
                    <p className="text-sm text-gray-400">
                      Milestones, diversity, volume
                    </p>
                  </div>
                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-white mb-2">💰 Profit</h5>
                    <p className="text-sm text-gray-400">
                      ROI, win streaks, profit factor
                    </p>
                  </div>
                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h5 className="font-semibold text-white mb-2">
                      🛡️ Risk Management
                    </h5>
                    <p className="text-sm text-gray-400">
                      Stop loss usage, avoiding liquidation
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">
                  Badge Rarities & XP:
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">⭐</span>
                      <p className="font-semibold text-gray-400">Common</p>
                    </div>
                    <p className="text-sm text-green-400 font-bold">
                      +{settings.badgeXP.common} XP
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">💎</span>
                      <p className="font-semibold text-blue-400">Rare</p>
                    </div>
                    <p className="text-sm text-blue-400 font-bold">
                      +{settings.badgeXP.rare} XP
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">👑</span>
                      <p className="font-semibold text-purple-400">Epic</p>
                    </div>
                    <p className="text-sm text-purple-400 font-bold">
                      +{settings.badgeXP.epic} XP
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🌟</span>
                      <p className="font-semibold text-yellow-400">Legendary</p>
                    </div>
                    <p className="text-sm text-yellow-400 font-bold">
                      +{settings.badgeXP.legendary} XP
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Risk Management - DYNAMIC */}
          <section
            id="risk-management"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Shield className="h-6 w-6 text-blue-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                🛡️ Risk Management
              </h2>
            </div>

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Understanding margin levels is crucial to avoid liquidation and
                succeed in competitions.
              </p>

              <div>
                <h4 className="font-semibold text-white mb-3">
                  Margin Levels:
                </h4>
                <div className="space-y-3">
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-green-400">
                        ✅ Safe Zone
                      </h5>
                      <span className="text-sm text-green-400">
                        Above {settings.margin.safe}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Account is healthy with plenty of margin.
                    </p>
                  </div>

                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-yellow-400">
                        ⚠️ Warning Zone
                      </h5>
                      <span className="text-sm text-yellow-400">
                        {settings.margin.warning + 1}% - {settings.margin.safe}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Caution! Consider reducing position sizes.
                    </p>
                  </div>

                  <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-orange-400">
                        🚨 Margin Call
                      </h5>
                      <span className="text-sm text-orange-400">
                        {settings.margin.marginCall + 1}% -{" "}
                        {settings.margin.warning}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Danger! Close positions or risk liquidation.
                    </p>
                  </div>

                  <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-red-500">
                        ⚠️ Danger Zone
                      </h5>
                      <span className="text-sm text-red-500">
                        {settings.margin.liquidation + 1}% -{" "}
                        {settings.margin.marginCall}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Danger! You&apos;re approaching liquidation. Close some
                      trades or risk automatic liquidation.
                    </p>
                  </div>

                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-red-400">
                        ❌ Liquidation
                      </h5>
                      <span className="text-sm text-red-400">
                        Below {settings.margin.liquidation}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      All positions automatically closed by system.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">
                  🎓 Best Practices:
                </h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Never risk more than {settings.risk.dailyLossLimit}% of
                      capital daily
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>Always use Stop Loss orders</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Keep max {settings.positions.maxOpen} positions open
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>Stay above {settings.margin.safe}% margin level</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Account Security & Fair Play */}
          <section
            id="account-security"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Eye className="h-6 w-6 text-green-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                🔒 Account Security &amp; Fair Play
              </h2>
            </div>

            <div className="space-y-6 text-gray-300">
              <p className="leading-relaxed">
                We are committed to providing a fair and secure trading competition
                environment for all users. Our platform uses advanced automated systems
                to detect and prevent unfair practices such as multi-accounting and
                collusion. Here&apos;s everything you need to know.
              </p>

              {/* Why We Monitor */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5">
                <h3 className="text-lg font-bold text-green-400 mb-3">
                  ✅ Why We Monitor Accounts
                </h3>
                <p className="text-sm text-gray-300 mb-3">
                  To ensure every competition and challenge is fair, we monitor accounts
                  for signs of manipulation. This is <strong>standard practice</strong> across
                  all competitive trading platforms. The vast majority of users are never
                  affected. If our system does flag your account, it is a routine check —
                  not an accusation.
                </p>
                <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
                  <li>Protects your winnings from being diluted by cheaters</li>
                  <li>Maintains fair prize distribution in competitions</li>
                  <li>Keeps the leaderboard honest and competitive</li>
                  <li>Required by our platform integrity policy</li>
                </ul>
              </div>

              {/* What We Check */}
              <div>
                <h3 className="text-lg font-bold text-white mb-4">
                  🔍 What Our System Checks
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <h5 className="font-semibold text-blue-400 mb-2">🖥️ Device Recognition</h5>
                    <p className="text-xs text-gray-400">
                      We track device information to ensure one person isn&apos;t
                      operating multiple accounts from the same computer or phone.
                      Each account should belong to a unique individual.
                    </p>
                  </div>
                  <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                    <h5 className="font-semibold text-orange-400 mb-2">💳 Payment Verification</h5>
                    <p className="text-xs text-gray-400">
                      We check that each account uses its own unique payment method.
                      Sharing a credit card or bank account across multiple accounts
                      is flagged as a potential multi-account violation.
                    </p>
                  </div>
                  <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <h5 className="font-semibold text-yellow-400 mb-2">🌐 Network Analysis</h5>
                    <p className="text-xs text-gray-400">
                      We record login locations and network information. Multiple accounts
                      frequently logging in from the same network may be reviewed.
                      Using VPNs or proxies may also trigger a review.
                    </p>
                  </div>
                  <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                    <h5 className="font-semibold text-purple-400 mb-2">📊 Trading Pattern Review</h5>
                    <p className="text-xs text-gray-400">
                      We analyse trading patterns to detect if two accounts are making
                      identical or suspiciously similar trades. This includes checking
                      the timing, direction, size, and currency pairs traded. Accounts
                      with highly similar behavior may be flagged for review.
                    </p>
                  </div>
                  <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
                    <h5 className="font-semibold text-cyan-400 mb-2">🏆 Competition Entry Review</h5>
                    <p className="text-xs text-gray-400">
                      If accounts that are already linked by other signals enter the
                      same competition, this is flagged as potential manipulation.
                      Each competition is monitored independently.
                    </p>
                  </div>
                  <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                    <h5 className="font-semibold text-green-400 mb-2">🪪 Identity Verification</h5>
                    <p className="text-xs text-gray-400">
                      During KYC (Know Your Customer) verification, we check that identity
                      documents haven&apos;t been used by another account. Each person should
                      only have one account on the platform.
                    </p>
                  </div>
                </div>
              </div>

              {/* What Happens If Flagged */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5">
                <h3 className="text-lg font-bold text-yellow-400 mb-3">
                  ⚠️ What Happens If My Account Is Flagged?
                </h3>
                <div className="space-y-3 text-sm">
                  <p className="text-gray-300">
                    If our system detects something unusual, you may see a notification
                    on your dashboard. <strong>Don&apos;t panic</strong> — this is a routine
                    security check, not an accusation. Here&apos;s what to expect:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-gray-400">
                    <li>
                      <strong className="text-white">Notification:</strong> You&apos;ll see a security
                      notice on your dashboard explaining that your account is being reviewed.
                    </li>
                    <li>
                      <strong className="text-white">Review period:</strong> Our team will review
                      the flagged activity. During this time, you can usually continue using the
                      platform normally unless your account requires temporary restrictions.
                    </li>
                    <li>
                      <strong className="text-white">Resolution:</strong> If the flag is a false
                      positive (which happens — e.g., shared household WiFi), it will be dismissed
                      and your account will be cleared. You won&apos;t be flagged for the same reason again.
                    </li>
                    <li>
                      <strong className="text-white">Contact support:</strong> If you believe the flag
                      is incorrect, contact our support team with any relevant explanation.
                      We&apos;re here to help and resolve any misunderstandings quickly.
                    </li>
                  </ol>
                </div>
              </div>

              {/* What's Not Allowed */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
                <h3 className="text-lg font-bold text-red-400 mb-3">
                  🚫 What&apos;s Not Allowed
                </h3>
                <ul className="list-disc list-inside text-sm text-gray-400 space-y-2">
                  <li>
                    <strong className="text-white">Multiple accounts:</strong> Each person may only
                    have one account. Creating or operating multiple accounts is strictly prohibited.
                  </li>
                  <li>
                    <strong className="text-white">Account sharing:</strong> Sharing your account
                    credentials with another person or letting someone else trade on your behalf is not allowed.
                  </li>
                  <li>
                    <strong className="text-white">Collusion:</strong> Coordinating trades with another
                    user to manipulate competition outcomes is prohibited.
                  </li>
                  <li>
                    <strong className="text-white">Mirror trading:</strong> Copying trades between two
                    accounts in real-time to guarantee outcomes is considered fraud.
                  </li>
                  <li>
                    <strong className="text-white">VPN abuse:</strong> Using VPNs or proxies to disguise
                    your identity or location for the purpose of circumventing security measures.
                  </li>
                  <li>
                    <strong className="text-white">Document fraud:</strong> Submitting fake or someone
                    else&apos;s identity documents during verification.
                  </li>
                </ul>
              </div>

              {/* Consequences */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">
                  ⚖️ Consequences of Violations
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30 text-center">
                    <h5 className="font-semibold text-yellow-400">Warning</h5>
                    <p className="text-xs text-gray-400 mt-1">
                      First minor violations may receive a warning with an explanation.
                    </p>
                  </div>
                  <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/30 text-center">
                    <h5 className="font-semibold text-orange-400">Suspension</h5>
                    <p className="text-xs text-gray-400 mt-1">
                      Temporary suspension from competitions and challenges. Funds remain accessible.
                    </p>
                  </div>
                  <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30 text-center">
                    <h5 className="font-semibold text-red-400">Permanent Ban</h5>
                    <p className="text-xs text-gray-400 mt-1">
                      Severe or repeated violations result in permanent account deactivation.
                      Remaining funds can be withdrawn.
                    </p>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
                <h3 className="text-lg font-bold text-blue-400 mb-3">
                  💡 Tips to Avoid Being Flagged
                </h3>
                <ul className="list-disc list-inside text-sm text-gray-400 space-y-2">
                  <li>Use only <strong>one account</strong> — do not create backup or secondary accounts</li>
                  <li>Use your <strong>own payment method</strong> — do not share cards with other users on the platform</li>
                  <li>Avoid <strong>VPNs or proxies</strong> when using the platform unless necessary</li>
                  <li>Trade independently — do not coordinate entries or trades with other users</li>
                  <li>Submit your <strong>own genuine documents</strong> for KYC verification</li>
                  <li>If you share a household with another user, <strong>contact support proactively</strong> to let us know — this helps us distinguish legitimate shared networks from multi-accounting</li>
                </ul>
              </div>

              {/* Support */}
              <div className="bg-gray-700/50 border border-gray-600 rounded-xl p-5 text-center">
                <h3 className="text-lg font-bold text-white mb-2">
                  Need Help?
                </h3>
                <p className="text-sm text-gray-400 mb-3">
                  If your account has been flagged and you believe it&apos;s a mistake,
                  or if you have any questions about our security measures, please
                  don&apos;t hesitate to reach out to our support team. We&apos;re
                  committed to resolving any issues fairly and promptly.
                </p>
                {isLoggedIn && (
                  <Link
                    href="/profile"
                    className="inline-block px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-sm"
                  >
                    Go to Profile & Settings
                  </Link>
                )}
              </div>
            </div>
          </section>

          {/* Invoices */}
          <section
            id="invoices"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <FileText className="h-6 w-6 text-teal-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                📄 Invoices & Billing
              </h2>
            </div>

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                All transactions generate invoices for your records.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                  <h5 className="font-semibold text-green-400">
                    💳 Deposit Invoices
                  </h5>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <h5 className="font-semibold text-blue-400">
                    💸 Withdrawal Receipts
                  </h5>
                </div>
                <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                  <h5 className="font-semibold text-purple-400">
                    🛒 Purchase Receipts
                  </h5>
                </div>
                <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                  <h5 className="font-semibold text-yellow-400">
                    🏆 Prize Receipts
                  </h5>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section
            id="faq"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <HelpCircle className="h-6 w-6 text-purple-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">❓ FAQ</h2>
            </div>

            <div className="space-y-4">
              {[
                {
                  q: "Is this real money trading?",
                  a: `No, trading is simulated. Entry fees and prizes are in ${settings.credits.name} (${settings.currency.code}).`,
                },
                {
                  q: `How do I buy ${settings.credits.name}?`,
                  a: `Go to Wallet, click "Buy ${settings.credits.name}", minimum ${settings.currency.symbol}${settings.credits.minimumDeposit}.`,
                },
                {
                  q: "Can I withdraw my winnings?",
                  a: `Yes! Minimum withdrawal is ${settings.currency.symbol}${settings.credits.minimumWithdrawal} with ${settings.credits.withdrawalFee}% fee.`,
                },
                {
                  q: "What happens if I get liquidated?",
                  a: `All positions close at ${settings.margin.liquidation}% margin. You may be disqualified from prizes.`,
                },
                {
                  q: "Can I change my leverage?",
                  a: `Leverage is set between ${settings.leverage.min}x - ${settings.leverage.max}x (default ${settings.leverage.default}x).`,
                },
                {
                  q: "How many positions can I open?",
                  a: `Maximum ${settings.positions.maxOpen} open positions at a time.`,
                },
                {
                  q: "Do badges expire?",
                  a: `No, badges are permanent. XP can only go up!`,
                },
                {
                  q: "When is the market open?",
                  a: "Forex markets are open 24/5 (Monday-Friday), closed weekends.",
                },
                {
                  q: "Why was my account flagged for a security review?",
                  a: "Our automated security system detected something that requires a routine check — such as a shared device, payment method, or network. This is a standard procedure and not an accusation. Most reviews are resolved quickly. You can continue using the platform while the review is in progress.",
                },
                {
                  q: "Can I use a VPN while trading?",
                  a: "Using VPNs may trigger a security flag. We recommend trading without a VPN to avoid unnecessary reviews. If you must use one, be aware that it may result in additional verification steps.",
                },
                {
                  q: "My household member also uses this platform — will we be flagged?",
                  a: "Possibly, since your devices share the same network. We recommend contacting support proactively to let us know about shared households. This helps our team distinguish legitimate use from multi-accounting.",
                },
                {
                  q: "What happens if I'm found to be multi-accounting?",
                  a: "Multi-accounting violates our terms. Consequences range from warnings to temporary suspension or permanent ban depending on severity. Remaining funds can always be withdrawn.",
                },
                {
                  q: "How do I clear a security flag on my account?",
                  a: "Most flags are reviewed and resolved by our team automatically. If you believe the flag is incorrect, contact support with an explanation. Once cleared, you won't be flagged for the same reason again.",
                },
              ].map((faq, index) => (
                <div
                  key={index}
                  className="p-4 bg-gray-700/50 rounded-lg border border-gray-600"
                >
                  <h4 className="font-semibold text-white mb-2">{faq.q}</h4>
                  <p className="text-sm text-gray-400">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Support */}
          <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-xl p-6 border border-yellow-500/30 text-center">
            <Info className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">
              Need More Help?
            </h3>
            <p className="text-gray-300 mb-4">
              Our support team is ready to assist you.
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
