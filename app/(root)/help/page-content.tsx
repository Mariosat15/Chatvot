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

                {/* Payment methods (only show what the admin has actually enabled) */}
                {settings.payments?.anyEnabled ? (
                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-1.5">
                      Accepted payment methods:
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {settings.payments.stripe && (
                        <span className="px-2 py-1 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                          <CreditCard className="h-3 w-3" /> Cards via Stripe
                        </span>
                      )}
                      {settings.payments.nuvei && (
                        <span className="px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CreditCard className="h-3 w-3" /> Cards via Nuvei
                        </span>
                      )}
                      {settings.payments.paddle && (
                        <span className="px-2 py-1 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                          <CreditCard className="h-3 w-3" /> Cards via Paddle
                        </span>
                      )}
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
                      href="/match-cards"
                      className="text-yellow-400 hover:text-yellow-300 underline underline-offset-2"
                    >
                      Match Card
                    </Link>{" "}
                    swipe, a leaderboard row, or their profile page.
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
                    href="/match-cards"
                    className="p-3 bg-gray-900/40 border border-gray-700 rounded-lg hover:bg-gray-800/40 transition-colors block"
                  >
                    <div className="font-semibold text-red-300">
                      /match-cards
                    </div>
                    <p className="text-gray-400 mt-1">
                      Swipe-style matchmaking — find similar-skill opponents
                      and send them a challenge directly from the card.
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

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Find the perfect trading opponent using our smart matchmaking
                system! Swipe through traders and challenge those with similar
                skill levels.
              </p>

              <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">
                  🎴 How Match Cards Work:
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-3 bg-gray-700/50 rounded-lg">
                    <p className="text-sm">
                      <span className="text-pink-400 font-bold">
                        👈 Swipe Left
                      </span>{" "}
                      = Skip this trader
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg">
                    <p className="text-sm">
                      <span className="text-green-400 font-bold">
                        👉 Swipe Right
                      </span>{" "}
                      = Challenge this trader
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                  <h5 className="font-semibold text-purple-400 mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Find Best Match
                  </h5>
                  <p className="text-sm text-gray-400">
                    Our algorithm finds traders with similar stats, experience,
                    and skill level for a fair competition.
                  </p>
                </div>
                <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
                  <h5 className="font-semibold text-cyan-400 mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" /> VS Screen
                  </h5>
                  <p className="text-sm text-gray-400">
                    Before challenging, see a head-to-head comparison of you vs
                    your opponent with stats and profile images.
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">
                  📊 What the Card Shows:
                </h4>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <p className="text-sm text-gray-400">
                      💖 <span className="text-white">Match %</span> - How well
                      you match
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <p className="text-sm text-gray-400">
                      🟢 <span className="text-white">Online Status</span> - Is
                      trader online
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <p className="text-sm text-gray-400">
                      🎯 <span className="text-white">Win Rate</span> - % of
                      winning trades
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <p className="text-sm text-gray-400">
                      💰 <span className="text-white">P&L</span> - Total
                      profit/loss
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <p className="text-sm text-gray-400">
                      🏆 <span className="text-white">Competitions</span> -
                      Entries count
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <p className="text-sm text-gray-400">
                      ⚔️ <span className="text-white">1v1 Challenges</span> -
                      Entries count
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">
                  ✨ Why You Match Section:
                </h4>
                <p className="text-sm text-gray-400 mb-3">
                  Each card shows reasons why you&apos;re a good match:
                </p>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Similar experience
                    level (beginner, intermediate, expert)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Similar profit
                    factor
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Online &amp; ready
                    to compete
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Similar
                    competition experience
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

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Your <strong className="text-yellow-400">Score</strong> is a
                composite rating that represents your overall trading
                performance. It&apos;s used in the Leaderboard and Match Cards.
              </p>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">
                  📊 How Score is Calculated:
                </h4>
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
                <h4 className="font-semibold text-white mb-3">
                  📈 Score Breakdown:
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">💰</span>
                      <div>
                        <p className="font-semibold text-green-400">
                          Total P&L
                        </p>
                        <p className="text-xs text-gray-500">
                          Your cumulative profit/loss
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-green-400 font-mono">
                      × 0.3 pts
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📈</span>
                      <div>
                        <p className="font-semibold text-blue-400">
                          ROI Percentage
                        </p>
                        <p className="text-xs text-gray-500">
                          Return on investment %
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
                          % of winning trades
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
                          Gross profit ÷ gross loss
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-purple-400 font-mono">
                      × 10 pts
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🥇</span>
                      <div>
                        <p className="font-semibold text-yellow-400">
                          Competition Wins
                        </p>
                        <p className="text-xs text-gray-500">
                          1st place finishes
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-yellow-400 font-mono">
                      × 50 pts each
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🏅</span>
                      <div>
                        <p className="font-semibold text-orange-400">
                          Podium Finishes
                        </p>
                        <p className="text-xs text-gray-500">Top 3 finishes</p>
                      </div>
                    </div>
                    <p className="text-sm text-orange-400 font-mono">
                      × 20 pts each
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">⚔️</span>
                      <div>
                        <p className="font-semibold text-red-400">
                          Challenge Wins
                        </p>
                        <p className="text-xs text-gray-500">
                          1v1 challenge victories
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-red-400 font-mono">
                      × 25 pts each
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-pink-500/10 rounded-lg border border-pink-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🏅</span>
                      <div>
                        <p className="font-semibold text-pink-400">
                          Total Badges
                        </p>
                        <p className="text-xs text-gray-500">
                          All badges earned
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-pink-400 font-mono">
                      × 2 pts each
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🌟</span>
                      <div>
                        <p className="font-semibold text-indigo-400">
                          Legendary Badges
                        </p>
                        <p className="text-xs text-gray-500">
                          Legendary rarity badges
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-indigo-400 font-mono">
                      × 10 pts each
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">
                  💡 Example Calculation:
                </h4>
                <div className="bg-gray-900/50 rounded-lg p-3 text-sm">
                  <p className="text-gray-400 mb-2">A trader with:</p>
                  <ul className="space-y-1 text-gray-300 mb-3">
                    <li>
                      • P&L: $500 → 500 × 0.3 ={" "}
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

              <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">
                  📍 Where Score is Shown:
                </h4>
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

            <div className="space-y-4 text-gray-300">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Settings className="h-4 w-4 text-blue-400" /> Professional
                    Mode
                  </h5>
                  <p className="text-sm text-gray-400">
                    Advanced charts, 50+ indicators, drawing tools.
                  </p>
                </div>
                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-purple-400" /> Game Mode
                  </h5>
                  <p className="text-sm text-gray-400">
                    Simplified interface, quick bets, great for beginners.
                  </p>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">
                  ⚙️ Trading Parameters:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400">Leverage:</span>
                    <span className="text-white ml-2">
                      {settings.leverage.min}x - {settings.leverage.max}x
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Default Leverage:</span>
                    <span className="text-white ml-2">
                      {settings.leverage.default}x
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Max Positions:</span>
                    <span className="text-white ml-2">
                      {settings.positions.maxOpen}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Max Lot Size:</span>
                    <span className="text-white ml-2">
                      {settings.positions.maxSize}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Daily Loss Limit:</span>
                    <span className="text-white ml-2">
                      {settings.risk.dailyLossLimit}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Max Drawdown:</span>
                    <span className="text-white ml-2">
                      {settings.risk.maxDrawdown}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                  <h5 className="font-semibold text-green-400 mb-2">
                    🎯 Take Profit
                  </h5>
                  <p className="text-sm text-gray-400">
                    Auto-close at profit target
                  </p>
                </div>
                <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                  <h5 className="font-semibold text-red-400 mb-2">
                    🛡️ Stop Loss
                  </h5>
                  <p className="text-sm text-gray-400">
                    Auto-close to limit losses
                  </p>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <h5 className="font-semibold text-blue-400 mb-2">
                    ⚖️ Position Size
                  </h5>
                  <p className="text-sm text-gray-400">
                    Control risk per trade
                  </p>
                </div>
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

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Purchase trading tools, indicators, and strategies to enhance
                your trading.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                  <h5 className="font-semibold text-purple-400 mb-2 flex items-center gap-2">
                    <LineChart className="h-4 w-4" /> Technical Indicators
                  </h5>
                  <p className="text-sm text-gray-400">
                    Custom indicators for your charts.
                  </p>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <h5 className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" /> Trading Strategies
                  </h5>
                  <p className="text-sm text-gray-400">
                    Complete systems with entry/exit rules.
                  </p>
                </div>
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                  <h5 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
                    <Eye className="h-4 w-4" /> Signal Providers
                  </h5>
                  <p className="text-sm text-gray-400">
                    Real-time trade signals and alerts.
                  </p>
                </div>
                <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                  <h5 className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Tool Bundles
                  </h5>
                  <p className="text-sm text-gray-400">
                    Discounted indicator packages.
                  </p>
                </div>
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

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                The Global Leaderboard ranks all traders based on XP, badges,
                and overall performance.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-yellow-400 mb-2">
                    🏆 XP & Level
                  </h5>
                  <p className="text-sm text-gray-400">
                    Total experience points from badges.
                  </p>
                </div>
                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-green-400 mb-2">
                    💰 Total Winnings
                  </h5>
                  <p className="text-sm text-gray-400">
                    Total {settings.credits.name.toLowerCase()} won.
                  </p>
                </div>
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
                {settings.credits.name} ({settings.credits.symbol}) are the
                platform currency. Buy with {settings.currency.code} and
                withdraw your winnings.
              </p>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">
                  💱 Conversion Rate:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Rate:</p>
                    <p className="text-white font-bold">
                      {settings.currency.symbol}1 ={" "}
                      {settings.credits.eurToCreditsRate}{" "}
                      {settings.credits.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Min. Deposit:</p>
                    <p className="text-white font-bold">
                      {settings.currency.symbol}
                      {settings.credits.minimumDeposit}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Min. Withdrawal:</p>
                    <p className="text-white font-bold">
                      {settings.currency.symbol}
                      {settings.credits.minimumWithdrawal}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Withdrawal Fee:</p>
                    <p className="text-white font-bold">
                      {settings.credits.withdrawalFee}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                  <h5 className="font-semibold text-green-400 mb-2">
                    💳 Buy {settings.credits.name}
                  </h5>
                  <p className="text-sm text-gray-400">
                    Pay {settings.currency.symbol}
                    {settings.credits.minimumDeposit} → Get{" "}
                    {settings.credits.minimumDeposit *
                      settings.credits.eurToCreditsRate}{" "}
                    {settings.credits.name}
                  </p>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <h5 className="font-semibold text-blue-400 mb-2">
                    💸 Withdraw
                  </h5>
                  <p className="text-sm text-gray-400">
                    Convert {settings.credits.name} back to{" "}
                    {settings.currency.code} (minus{" "}
                    {settings.credits.withdrawalFee}% fee)
                  </p>
                </div>
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
                Your Profile shows trading history, statistics, badges, and
                account settings.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-cyan-400 mb-2">
                    📊 Competition Stats
                  </h5>
                  <p className="text-sm text-gray-400">
                    Entries, wins, podiums, best P&L.
                  </p>
                </div>
                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <h5 className="font-semibold text-yellow-400 mb-2">
                    🏅 Badge Collection
                  </h5>
                  <p className="text-sm text-gray-400">
                    All earned badges organized by category.
                  </p>
                </div>
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
