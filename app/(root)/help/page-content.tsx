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
  Map,
  Flag,
  MessageSquare,
  UserPlus,
  Headphones,
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
  { id: "journey", title: "🗺️ Trader's Journey", icon: Map },
  { id: "trader-levels", title: "👑 Trader Levels", icon: Award },
  { id: "badge-system", title: "🏅 Badge System", icon: Award },
  { id: "risk-management", title: "🛡️ Risk Management", icon: Shield },
  { id: "account-security", title: "🔒 Account Security", icon: Eye },
  { id: "support", title: "💬 Support & Messaging", icon: MessageSquare },
  { id: "invoices", title: "📄 Invoices & Billing", icon: FileText },
  { id: "faq", title: "❓ FAQ", icon: HelpCircle },
];

// Default settings as fallback (mirrors lib/constants/levels.ts — keep in sync)
const defaultSettings: HelpSettings = {
  badgeXP: { common: 10, rare: 25, epic: 50, legendary: 100 },
  levels: [
    { level: 1, title: "Novice Trader", minXP: 0, icon: "starBadge", color: "text-gray-400" },
    { level: 2, title: "Apprentice", minXP: 50, icon: "guideBook", color: "text-gray-300" },
    { level: 3, title: "Trainee", minXP: 125, icon: "sword", color: "text-green-500" },
    { level: 4, title: "Junior Trader", minXP: 250, icon: "trade", color: "text-green-400" },
    { level: 5, title: "Rising Trader", minXP: 375, icon: "profit", color: "text-teal-400" },
    { level: 6, title: "Skilled Trader", minXP: 500, icon: "target", color: "text-blue-400" },
    { level: 7, title: "Competent Trader", minXP: 750, icon: "archer", color: "text-blue-300" },
    { level: 8, title: "Proficient Trader", minXP: 1100, icon: "shield1", color: "text-cyan-400" },
    { level: 9, title: "Expert Trader", minXP: 1450, icon: "swordNumbered", color: "text-cyan-300" },
    { level: 10, title: "Senior Trader", minXP: 1800, icon: "gems", color: "text-purple-400" },
    { level: 11, title: "Elite Trader", minXP: 2000, icon: "star1", color: "text-purple-300" },
    { level: 12, title: "Master Trader", minXP: 2500, icon: "crown", color: "text-pink-400" },
    { level: 13, title: "Grand Master", minXP: 3000, icon: "fireSpell", color: "text-pink-300" },
    { level: 14, title: "Trading Virtuoso", minXP: 3500, icon: "blueFireSpell", color: "text-orange-400" },
    { level: 15, title: "Trading Champion", minXP: 4000, icon: "trophy", color: "text-orange-300" },
    { level: 16, title: "Market Legend", minXP: 5000, icon: "starAward", color: "text-yellow-400" },
    { level: 17, title: "Trading Titan", minXP: 6000, icon: "goldMedal", color: "text-yellow-300" },
    { level: 18, title: "Market Overlord", minXP: 7500, icon: "lord", color: "text-red-400" },
    { level: 19, title: "Trading Immortal", minXP: 10000, icon: "champion", color: "text-red-300" },
    { level: 20, title: "Trading God", minXP: 15000, icon: "victory", color: "text-amber-400" },
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
                    on your wallet for the disputed amount and your
                    account may be restricted while the case is
                    reviewed by both your bank and our team. The case
                    is filed in our internal chargeback register and
                    cross-linked to the original deposit transaction
                    and its invoice for evidence packaging.
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
                👤 Profile &amp; Stats
              </h2>
            </div>

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Your profile is your home base on ChartVolt — the place
                where you fine-tune your identity, view your career
                stats, manage your KYC and security, control
                notifications, and operate every item you have bought
                from the Marketplace. Open it from the avatar dropdown
                in the top-right, the sidebar, or directly at{" "}
                <Link
                  href="/profile"
                  className="text-cyan-400 hover:underline"
                >
                  /profile
                </Link>
                .
              </p>

              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 text-xs text-gray-300">
                <strong className="text-cyan-300">Good to know:</strong>{" "}
                There is no public{" "}
                <code className="bg-gray-900 px-1 py-0.5 rounded">
                  /profile/username
                </code>{" "}
                URL —{" "}
                <code className="bg-gray-900 px-1 py-0.5 rounded">
                  /profile
                </code>{" "}
                always shows <em>your own</em> profile. Other traders
                only see a curated <strong>Profile Card</strong> with
                public stats (avatar, bio, tier, trading stats, battle
                record, badges, Score) — never your email, address,
                phone, payment details, balance or transaction history.
              </div>

              {/* The profile header */}
              <div>
                <h3 className="font-semibold text-white text-base mb-2 flex items-center gap-2">
                  <User className="h-4 w-4 text-cyan-300" />
                  The header at the top of the page
                </h3>
                <p className="text-sm text-gray-400 mb-3">
                  Above the tabs, every profile page renders a hero
                  header that summarises who you are at a glance:
                </p>
                <div className="grid gap-2 text-xs text-gray-300">
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Avatar &amp; level ring.
                    </strong>{" "}
                    Your current profile picture wrapped in the active
                    frame you applied from the Marketplace (if any),
                    with a level-ring badge showing your current Trader
                    Level number.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Display name, email, member-since.
                    </strong>{" "}
                    Your name and the email you signed up with,
                    alongside the date your account was created.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Total XP &amp; wins.
                    </strong>{" "}
                    A quick XP read-out for your current title plus
                    your total wins across competitions and 1v1
                    challenges.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Wallet balance card.
                    </strong>{" "}
                    Your current{" "}
                    <strong className="text-white">
                      {settings.credits.name}
                    </strong>{" "}
                    balance. Click it to jump straight to{" "}
                    <Link
                      href="/wallet"
                      className="text-cyan-400 hover:underline"
                    >
                      /wallet
                    </Link>
                    .
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Game Master badge.
                    </strong>{" "}
                    If you currently own an active Game Master pack, a
                    GM badge links to the GM Dashboard at{" "}
                    <Link
                      href="/gamemaster"
                      className="text-purple-400 hover:underline"
                    >
                      /gamemaster
                    </Link>
                    .
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">Quick Stats panel.</strong>{" "}
                    Collapsible row showing your total trades, win
                    rate, competitions entered, and 1v1s entered — a
                    bird&apos;s-eye summary before you dive into the
                    Overview tab.
                  </div>
                </div>
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
                      Two main cards:{" "}
                      <strong className="text-white">
                        Trader Level &amp; Title
                      </strong>{" "}
                      (current title, total XP, progress to next title,
                      full grid of all 20 titles, and a &quot;How to
                      earn XP&quot; matrix per badge rarity — see{" "}
                      <button
                        type="button"
                        onClick={() => scrollToSection("trader-levels")}
                        className="text-cyan-400 hover:underline"
                      >
                        Trader Levels
                      </button>
                      ), and{" "}
                      <strong className="text-white">Performance</strong>{" "}
                      tiles for Competitions (entered, podiums, active,
                      total prizes) and 1v1 Challenges (total, won,
                      lost, credits won).
                    </p>
                  </div>

                  {/* Journey */}
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-amber-400 text-sm mb-1 flex items-center gap-2">
                      <Map className="h-4 w-4" />
                      Journey
                    </p>
                    <p className="text-xs text-gray-400">
                      Your{" "}
                      <button
                        type="button"
                        onClick={() => scrollToSection("journey")}
                        className="text-amber-400 hover:underline"
                      >
                        Trader&apos;s Journey
                      </button>{" "}
                      — an interactive multi-map progression of
                      milestones built from your real account events
                      (trades, deposits, competitions, badges). Awards
                      XP and badges as you go.
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
                      (Common / Rare / Epic / Legendary). Locked badges
                      show their unlock condition and a level gate when
                      the rarity is restricted. Click any badge for the
                      detail card. Full mechanics in the{" "}
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
                      Everything you have bought from the Marketplace,
                      filtered by category (Game Master, Trading Bots,
                      Indicators, Strategies, Cosmetics). Enable /
                      disable items, edit settings, apply avatars &amp;
                      frames, and run the full GM subscription panel
                      (pause, schedule cancel, renew). Full breakdown
                      in{" "}
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
                      Verification (KYC)
                    </p>
                    <p className="text-xs text-gray-400">
                      Your identity-verification status, the{" "}
                      <strong className="text-white">
                        Start verification
                      </strong>{" "}
                      flow, what to prepare, the document types you can
                      use, the verification expiry date, and the data
                      retention notice. Complete breakdown in the{" "}
                      <button
                        type="button"
                        onClick={() => scrollToSection("kyc")}
                        className="text-green-400 hover:underline"
                      >
                        🪪 KYC
                      </button>{" "}
                      block below.
                    </p>
                  </div>

                  {/* Notifications */}
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-pink-400 text-sm mb-1 flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Notifications
                    </p>
                    <p className="text-xs text-gray-400">
                      Your full notification history with filters,
                      search, and a sub-tab for notification preferences
                      (master switch, email, per-category opt-outs,
                      quiet hours, challenge popups). Identical to the
                      page at{" "}
                      <Link
                        href="/notifications"
                        className="text-pink-400 hover:underline"
                      >
                        /notifications
                      </Link>{" "}
                      — see the{" "}
                      <button
                        type="button"
                        onClick={() => scrollToSection("notifications")}
                        className="text-pink-400 hover:underline"
                      >
                        Notifications
                      </button>{" "}
                      section.
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
                      privacy, and account deactivation. Full
                      field-by-field breakdown below.
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
                <p className="text-xs text-gray-400 mb-3">
                  Settings is divided into clear blocks. A sticky bar
                  appears at the bottom whenever you have unsaved
                  changes with{" "}
                  <strong className="text-white">Save changes</strong>{" "}
                  and{" "}
                  <strong className="text-white">Discard</strong>{" "}
                  buttons. The page also warns you if you try to leave
                  with unsaved edits.
                </p>

                <div className="space-y-3">
                  {/* Picture */}
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1">
                      Profile Picture
                    </p>
                    <ul className="space-y-1 text-xs text-gray-400 list-disc pl-5">
                      <li>
                        Click your avatar (or the &quot;Change
                        photo&quot; overlay) to upload a new picture.
                      </li>
                      <li>
                        Accepted formats:{" "}
                        <strong className="text-white">
                          JPEG, JPG, PNG, WebP, GIF
                        </strong>
                        . Maximum size:{" "}
                        <strong className="text-white">5&nbsp;MB</strong>
                        .
                      </li>
                      <li>
                        The picture is shown together with the{" "}
                        <strong className="text-white">profile frame</strong>{" "}
                        you have currently activated from the Marketplace
                        (Arsenal tab), and on every public surface
                        (Profile Card, Match Cards, leaderboards).
                      </li>
                    </ul>
                  </div>

                  {/* Bio */}
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1">
                      Bio
                    </p>
                    <ul className="space-y-1 text-xs text-gray-400 list-disc pl-5">
                      <li>
                        Short freeform text (max{" "}
                        <strong className="text-white">500</strong>{" "}
                        characters) shown on your public Profile Card.
                        Use it to share your style, time-zone, or
                        favourite pairs — nothing sensitive.
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
                        — editable. Appears on your invoices and on the
                        Profile Card other traders see.
                      </li>
                      <li>
                        <strong className="text-white">Email</strong> —{" "}
                        <span className="text-red-300">read-only</span>
                        . Sign-in email cannot be changed from this
                        screen — a deliberate choice to prevent
                        account take-over. Contact support if you
                        genuinely need to update it.
                      </li>
                      <li>
                        <strong className="text-white">Country</strong>{" "}
                        — dropdown. For EU consumers, the platform
                        automatically applies VAT on deposits when
                        applicable.
                      </li>
                      <li>
                        <strong className="text-white">
                          Street, City, Postal code, Phone
                        </strong>{" "}
                        — required for KYC and printed on tax invoices
                        for deposits.
                      </li>
                    </ul>
                  </div>

                  {/* Privacy */}
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
                      <Eye className="h-4 w-4 text-cyan-400" />
                      Privacy
                    </p>
                    <ul className="space-y-1 text-xs text-gray-400 list-disc pl-5">
                      <li>
                        <strong className="text-white">
                          Allow friend requests
                        </strong>{" "}
                        — toggle. When off, other traders can&apos;t
                        send you friend invites. Your stats stay
                        visible on the leaderboard either way.
                      </li>
                    </ul>
                  </div>

                  {/* Password */}
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-cyan-400" />
                      Change password
                    </p>
                    <ul className="space-y-1 text-xs text-gray-400 list-disc pl-5">
                      <li>
                        Enter your{" "}
                        <strong className="text-white">
                          current password
                        </strong>
                        , a{" "}
                        <strong className="text-white">
                          new password
                        </strong>{" "}
                        (minimum 8 characters, maximum 128), and
                        confirm. Each field has a show/hide toggle.
                      </li>
                      <li>
                        If 2FA is enabled, the form will ask for your
                        authenticator code before the change is
                        applied.
                      </li>
                      <li>
                        Passwords are hashed with bcrypt server-side
                        — neither support nor admins can read them.
                      </li>
                    </ul>
                  </div>

                  {/* 2FA */}
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4 text-green-400" />
                      Two-Factor Authentication (2FA)
                    </p>
                    <ul className="space-y-1 text-xs text-gray-400 list-disc pl-5">
                      <li>
                        <strong className="text-white">Method:</strong>{" "}
                        TOTP, compatible with any standard authenticator
                        app — Google Authenticator, Authy, 1Password,
                        Microsoft Authenticator, etc.
                      </li>
                      <li>
                        <strong className="text-white">Setup:</strong>{" "}
                        scan the QR code (or enter the manual secret),
                        then verify with a 6-digit code from the app.
                      </li>
                      <li>
                        <strong className="text-white">Backup codes:</strong>{" "}
                        you receive a set of one-time codes at setup —
                        store them somewhere safe. They let you sign
                        in if you lose access to your authenticator.
                        You can regenerate them at any time (this
                        invalidates the old set).
                      </li>
                      <li>
                        <strong className="text-white">
                          Email OTP fallback
                        </strong>{" "}
                        — if both your authenticator and your backup
                        codes are unavailable, an email-based one-time
                        code can still get you in.
                      </li>
                      <li>
                        <strong className="text-white">
                          Disabling 2FA
                        </strong>{" "}
                        requires confirming a current 2FA code. Once
                        disabled, accept that your account is
                        materially less secure.
                      </li>
                    </ul>
                  </div>

                  {/* Account info */}
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1">
                      Account information (read-only)
                    </p>
                    <ul className="space-y-1 text-xs text-gray-400 list-disc pl-5">
                      <li>Account created date.</li>
                      <li>Last updated date.</li>
                    </ul>
                  </div>

                  {/* Deactivate */}
                  <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                    <p className="font-semibold text-red-400 text-sm mb-1 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Deactivate account
                    </p>
                    <p className="text-xs text-gray-400 mb-2">
                      A protected action that closes your account.
                      You&apos;ll be asked to type{" "}
                      <code className="bg-gray-900 px-1.5 py-0.5 rounded">
                        DEACTIVATE
                      </code>{" "}
                      to confirm. After deactivation:
                    </p>
                    <ul className="space-y-1 text-xs text-gray-400 list-disc pl-5">
                      <li>
                        You are signed out and your profile is hidden
                        from public surfaces (Leaderboard, Match
                        Cards).
                      </li>
                      <li>
                        Any pending withdrawals continue through their
                        normal processing flow.
                      </li>
                      <li>
                        Open competitions or 1v1 challenges must be
                        settled first.
                      </li>
                      <li>
                        Support can reactivate the account if you
                        change your mind. Some data is retained per our
                        privacy policy and applicable law.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* KYC deep-dive */}
              <div
                id="kyc"
                className="scroll-mt-6 bg-green-500/10 border border-green-500/30 rounded-xl p-5 space-y-4"
              >
                <h3 className="text-lg font-bold text-green-400 flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5" />
                  🪪 Identity Verification (KYC) — full guide
                </h3>

                <p className="text-sm text-gray-300 leading-relaxed">
                  <strong className="text-white">KYC</strong>{" "}
                  (&quot;Know Your Customer&quot;) is the regulated
                  identity-verification step that confirms you are a
                  real person and that the documents you provide match
                  you. ChartVolt uses{" "}
                  <strong className="text-white">Veriff</strong>, a
                  PCI-DSS / GDPR-compliant identity provider, to run the
                  whole flow — ChartVolt never touches your raw ID
                  documents.
                </p>

                <p className="text-xs text-gray-400">
                  Run it from{" "}
                  <Link
                    href="/profile?tab=verification"
                    className="text-green-400 hover:underline"
                  >
                    /profile?tab=verification
                  </Link>
                  . The Verification card only appears when KYC is
                  enabled by the platform.
                </p>

                {/* When required */}
                <div>
                  <p className="font-semibold text-white text-sm mb-2">
                    When KYC is required
                  </p>
                  <ul className="space-y-1.5 text-xs text-gray-300 list-disc pl-5">
                    {settings.kyc?.requiredForDeposit && (
                      <li>
                        <strong className="text-white">Deposits</strong>{" "}
                        — required before you can fund the wallet
                        {settings.kyc?.requiredAmount > 0 && (
                          <>
                            {" "}
                            for amounts at or above{" "}
                            {settings.currency.symbol}
                            {settings.kyc.requiredAmount}
                          </>
                        )}
                        .
                      </li>
                    )}
                    {settings.kyc?.requiredForWithdrawal && (
                      <li>
                        <strong className="text-white">Withdrawals</strong>{" "}
                        — required before your first withdrawal is
                        approved
                        {settings.kyc?.requiredAmount > 0 && (
                          <>
                            {" "}
                            for amounts at or above{" "}
                            {settings.currency.symbol}
                            {settings.kyc.requiredAmount}
                          </>
                        )}
                        . The withdrawal dialog will redirect you to
                        verification if needed.
                      </li>
                    )}
                    <li>
                      <strong className="text-white">
                        After expiry
                      </strong>{" "}
                      — verification is valid for a fixed period
                      (typically one year). When it expires, the
                      platform automatically resets your KYC status and
                      asks you to re-verify before your next gated
                      action.
                    </li>
                    <li>
                      <strong className="text-white">
                        Admin request
                      </strong>{" "}
                      — for high-risk activity (chargeback dispute,
                      suspected multi-accounting, etc.) the team may
                      require re-verification regardless of expiry.
                    </li>
                  </ul>
                </div>

                {/* What you'll need */}
                <div>
                  <p className="font-semibold text-white text-sm mb-2">
                    What you&apos;ll need before you start
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 text-xs text-gray-300">
                    <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                      <strong className="text-white">
                        A valid government-issued ID
                      </strong>{" "}
                      — passport, national ID card, driver&apos;s
                      license, or residence permit. It must be current
                      (not expired) and the photo must be clear.
                    </div>
                    <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                      <strong className="text-white">
                        A camera-capable device
                      </strong>{" "}
                      — phone or laptop webcam. Veriff captures the
                      document image and a short live selfie video for
                      face matching.
                    </div>
                    <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                      <strong className="text-white">Good lighting</strong>{" "}
                      and a steady hand. Glare, blur, or covered
                      corners are the most common reasons a session
                      gets sent for resubmission.
                    </div>
                    <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                      <strong className="text-white">About 5 minutes</strong>{" "}
                      end-to-end. The session itself rarely takes more
                      than 2–3 minutes; the decision typically comes
                      back within a few minutes after submission.
                    </div>
                  </div>
                </div>

                {/* Step by step */}
                <div>
                  <p className="font-semibold text-white text-sm mb-2">
                    Step-by-step
                  </p>
                  <ol className="space-y-2 text-xs text-gray-300 list-decimal pl-5">
                    <li>
                      Go to{" "}
                      <Link
                        href="/profile?tab=verification"
                        className="text-green-400 hover:underline"
                      >
                        Profile → Verification
                      </Link>
                      . If your address fields are missing, the page
                      will prompt you to complete them in{" "}
                      <Link
                        href="/profile?tab=settings"
                        className="text-cyan-400 hover:underline"
                      >
                        Settings
                      </Link>{" "}
                      first.
                    </li>
                    <li>
                      Click{" "}
                      <strong className="text-white">
                        Start verification
                      </strong>
                      . A Veriff session opens in a popup window
                      (allow pop-ups for ChartVolt). Veriff handles
                      everything from here.
                    </li>
                    <li>
                      Pick the country your document was issued in and
                      the document type (passport / ID card / driving
                      licence / residence permit).
                    </li>
                    <li>
                      Capture the document — front and back where
                      applicable. Hold steady, fill the frame, no
                      glare.
                    </li>
                    <li>
                      Record the short selfie /{" "}
                      <strong className="text-white">liveness check</strong>{" "}
                      so Veriff can confirm you are the person in the
                      document.
                    </li>
                    <li>
                      Submit. The popup closes and you&apos;re
                      returned to the Verification tab, which switches
                      to{" "}
                      <strong className="text-yellow-300">Pending</strong>
                      . The page polls automatically and the status
                      flips to{" "}
                      <strong className="text-green-300">Approved</strong>{" "}
                      (or to{" "}
                      <strong className="text-orange-300">
                        Resubmission requested
                      </strong>{" "}
                      /{" "}
                      <strong className="text-red-300">Declined</strong>
                      ) as soon as the result comes back.
                    </li>
                  </ol>
                </div>

                {/* Statuses */}
                <div>
                  <p className="font-semibold text-white text-sm mb-2">
                    Statuses you may see
                  </p>
                  <div className="grid gap-2 text-xs text-gray-300">
                    <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                      <strong className="text-gray-300">
                        Not started.
                      </strong>{" "}
                      No verification on file. Gated actions (deposits,
                      withdrawals) will ask you to verify when you
                      attempt them.
                    </div>
                    <div className="p-2.5 bg-gray-700/40 rounded border border-yellow-500/30">
                      <strong className="text-yellow-300">Pending.</strong>{" "}
                      Documents submitted, awaiting Veriff&apos;s
                      decision. Usually a few minutes; up to a few
                      hours during peak times. You can use the rest of
                      the platform normally while you wait. A{" "}
                      <strong className="text-white">
                        Check Verification Status
                      </strong>{" "}
                      button is available to refresh manually.
                    </div>
                    <div className="p-2.5 bg-gray-700/40 rounded border border-green-500/30">
                      <strong className="text-green-300">Approved.</strong>{" "}
                      You&apos;re verified. The page shows the date
                      you were verified, the expiry date (re-verify
                      after this), and a data-retention notice.
                    </div>
                    <div className="p-2.5 bg-gray-700/40 rounded border border-orange-500/30">
                      <strong className="text-orange-300">
                        Resubmission requested.
                      </strong>{" "}
                      Veriff couldn&apos;t read the document well
                      enough — usually a glare, blur, or cropped
                      corner issue. Just retry from the same page; the
                      attempt counts against your remaining attempts.
                    </div>
                    <div className="p-2.5 bg-gray-700/40 rounded border border-red-500/30">
                      <strong className="text-red-300">Declined.</strong>{" "}
                      Verification failed (e.g. document type or
                      country not currently supported, expired
                      document, face/document mismatch). Reach out to
                      support — most declines are resolvable.
                    </div>
                    <div className="p-2.5 bg-gray-700/40 rounded border border-gray-500/30">
                      <strong className="text-gray-300">Expired.</strong>{" "}
                      Your previous approval&apos;s validity period
                      has run out. Click{" "}
                      <strong className="text-white">
                        Start verification
                      </strong>{" "}
                      again to renew.
                    </div>
                    <div className="p-2.5 bg-gray-700/40 rounded border border-gray-500/30">
                      <strong className="text-gray-400">Abandoned.</strong>{" "}
                      You closed the popup without completing. You can
                      restart at any time; the previous session is
                      discarded automatically.
                    </div>
                  </div>
                </div>

                {/* What we collect */}
                <div>
                  <p className="font-semibold text-white text-sm mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-green-300" />
                    What ChartVolt receives after approval
                  </p>
                  <p className="text-xs text-gray-400 mb-2">
                    Veriff sends only the{" "}
                    <strong className="text-white">structured data</strong>{" "}
                    from your check — never raw images to our servers.
                    On approval we store, on the verification record
                    only:
                  </p>
                  <ul className="space-y-1 text-xs text-gray-300 list-disc pl-5">
                    <li>
                      <strong className="text-white">Identity:</strong>{" "}
                      first name, last name, date of birth, gender,
                      nationality, and an ID number (where the document
                      provides one).
                    </li>
                    <li>
                      <strong className="text-white">Document:</strong>{" "}
                      type, document number, issuing country, valid-from
                      and valid-until dates.
                    </li>
                    <li>
                      <strong className="text-white">Wallet flags:</strong>{" "}
                      <code className="text-[10px] bg-gray-900 px-1 py-0.5 rounded">
                        kycVerified
                      </code>{" "}
                      = true, plus verified-at and expires-at
                      timestamps used to gate deposits / withdrawals
                      and trigger re-verification.
                    </li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2">
                    The raw photographs and the selfie video remain
                    with Veriff and are retained according to their own
                    policy (typically 2 years), then deleted. ChartVolt
                    never stores the document image itself.
                  </p>
                </div>

                {/* Duplicate detection */}
                <div>
                  <p className="font-semibold text-white text-sm mb-2">
                    Duplicate-document check
                  </p>
                  <p className="text-xs text-gray-400">
                    Each approved KYC is compared against existing
                    records to make sure the same identity document
                    isn&apos;t already in use on another account. We
                    check four signals: document number + issuing
                    country, identity number, an anonymised document
                    fingerprint, and name + date of birth. If a match
                    is found, the case is sent for manual review and
                    flagged in our fraud system — see{" "}
                    <button
                      type="button"
                      onClick={() => scrollToSection("account-security")}
                      className="text-green-400 hover:underline"
                    >
                      Account Security &amp; Fair Play
                    </button>{" "}
                    for what happens next.
                  </p>
                </div>

                {/* Retries and expiry */}
                <div>
                  <p className="font-semibold text-white text-sm mb-2">
                    Retries &amp; expiry
                  </p>
                  <ul className="space-y-1.5 text-xs text-gray-300 list-disc pl-5">
                    <li>
                      You get a limited number of attempts per account
                      (configured by the platform). The attempt counter
                      is shown when a session fails so you know how
                      many tries remain.
                    </li>
                    <li>
                      A session that is started but not submitted
                      expires after a configurable window (typically{" "}
                      <strong className="text-white">
                        30 minutes
                      </strong>
                      ); a new one can be started immediately after.
                    </li>
                    <li>
                      A successful approval is valid for the platform&apos;s
                      configured period (typically{" "}
                      <strong className="text-white">365 days</strong>
                      ). Once it expires, the next deposit or
                      withdrawal will prompt you to verify again.
                    </li>
                  </ul>
                </div>

                {/* Troubleshooting */}
                <div>
                  <p className="font-semibold text-white text-sm mb-2">
                    Troubleshooting
                  </p>
                  <ul className="space-y-1.5 text-xs text-gray-300 list-disc pl-5">
                    <li>
                      <strong className="text-white">
                        Popup blocked?
                      </strong>{" "}
                      Allow pop-ups for ChartVolt or click{" "}
                      <strong className="text-white">
                        Start verification
                      </strong>{" "}
                      again — Veriff opens in a 500×700 window.
                    </li>
                    <li>
                      <strong className="text-white">
                        Camera permission denied?
                      </strong>{" "}
                      You&apos;ll need to enable camera access in your
                      browser/OS, then restart the session.
                    </li>
                    <li>
                      <strong className="text-white">
                        Stuck on Pending?
                      </strong>{" "}
                      Click{" "}
                      <strong className="text-white">
                        Check Verification Status
                      </strong>
                      . If nothing changes after a couple of hours,
                      contact support — Veriff can request
                      resubmission in a few edge cases.
                    </li>
                    <li>
                      <strong className="text-white">
                        Wrong country or document type listed?
                      </strong>{" "}
                      The platform restricts the document types it
                      accepts. If yours isn&apos;t supported, contact
                      support for a manual review option.
                    </li>
                    <li>
                      <strong className="text-white">
                        Lost access to the account
                      </strong>{" "}
                      that owns the KYC? Don&apos;t open a new one —
                      that triggers the duplicate-document check and
                      delays things further. Recover the original via
                      support.
                    </li>
                  </ul>
                </div>

                <div className="text-xs text-gray-500 italic">
                  Verification is powered by Veriff. ChartVolt acts as
                  the data controller for the structured outcome
                  (verified / not), Veriff acts as the data processor
                  for the underlying check.
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
                The <strong className="text-white">Trading Arsenal</strong>{" "}
                is the home for every item you have bought from the
                Marketplace — chart{" "}
                <strong className="text-white">indicators</strong>,
                signal{" "}
                <strong className="text-white">strategies</strong>,{" "}
                <strong className="text-white">cosmetics</strong> (avatars
                and profile frames), and your{" "}
                <strong className="text-white">Game Master</strong>{" "}
                package. You manage it from your profile, and you put it
                to work on the chart inside competitions and 1v1
                challenges.
              </p>

              {/* Where to find it */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                  <p className="font-semibold text-orange-400 text-sm mb-1 flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Profile → Arsenal tab
                  </p>
                  <p className="text-xs text-gray-400">
                    Visit{" "}
                    <Link
                      href="/profile?tab=arsenal"
                      className="text-orange-400 hover:underline"
                    >
                      /profile?tab=arsenal
                    </Link>{" "}
                    to see your full inventory, browse by category, toggle
                    items on/off, apply cosmetics, and manage your Game
                    Master subscription.
                  </p>
                </div>
                <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                  <p className="font-semibold text-purple-400 text-sm mb-1 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Trading view side panel
                  </p>
                  <p className="text-xs text-gray-400">
                    Inside any competition or 1v1 trade page, look for
                    the &quot;Trading Arsenal&quot; panel in the side
                    column. This is where you switch indicators and
                    strategies on for the chart you&apos;re currently
                    looking at.
                  </p>
                </div>
              </div>

              {/* What's in it */}
              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-orange-400" />
                  What can live in your Arsenal
                </h4>
                <div className="grid gap-2 text-sm">
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600 flex items-start gap-2">
                    <LineChart className="h-4 w-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Indicators.</strong>{" "}
                      Technical overlays that draw directly on your chart
                      (moving averages, RSI, MACD, Bollinger Bands,
                      Supertrend, VWAP, and premium proprietary
                      indicators). Each one is rendered as a real chart
                      series — not a static image.
                    </span>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600 flex items-start gap-2">
                    <Zap className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Strategies.</strong>{" "}
                      Signal generators that scan the live candle stream
                      and plot{" "}
                      <strong className="text-green-400">
                        buy / sell markers
                      </strong>{" "}
                      on the chart when their rules trigger. You decide
                      whether to act on the signal — strategies
                      don&apos;t place orders for you.
                    </span>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600 flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-pink-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Cosmetics.</strong>{" "}
                      Visual upgrades for your profile —{" "}
                      <em>avatars</em>, <em>profile frames</em>,{" "}
                      <em>titles</em>, and{" "}
                      <em>special badge skins</em>. These don&apos;t
                      affect trading, only how you appear on the
                      leaderboard, Match Cards, and your Profile Card.
                    </span>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600 flex items-start gap-2">
                    <Award className="h-4 w-4 text-purple-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">
                        Game Master packages.
                      </strong>{" "}
                      If you have an active GM subscription it appears
                      here too, with renewal, pause, and scheduled-
                      cancellation controls. Full details in the{" "}
                      <button
                        type="button"
                        onClick={() => scrollToSection("gamemaster")}
                        className="text-purple-400 hover:underline"
                      >
                        👑 Game Master
                      </button>{" "}
                      section.
                    </span>
                  </div>
                </div>
              </div>

              {/* How activation works */}
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-orange-400" />
                  How activation works
                </h4>
                <ul className="space-y-1.5 text-sm text-gray-300 list-disc pl-5">
                  <li>
                    Every item has a per-account{" "}
                    <strong className="text-white">on / off</strong>{" "}
                    toggle. Switching it on from{" "}
                    <Link
                      href="/profile?tab=arsenal"
                      className="text-orange-400 hover:underline"
                    >
                      /profile?tab=arsenal
                    </Link>{" "}
                    activates it everywhere you trade — there&apos;s no
                    need to re-enable it per competition or per
                    challenge.
                  </li>
                  <li>
                    You can run{" "}
                    <strong className="text-white">
                      multiple indicators and strategies at the same
                      time
                    </strong>
                    . The chart layers them on top of each other so you
                    can combine systems (e.g. a trend indicator + a
                    momentum strategy).
                  </li>
                  <li>
                    Cosmetics work differently — only{" "}
                    <strong className="text-white">one</strong> avatar
                    and <strong className="text-white">one</strong>{" "}
                    profile frame can be active at a time. Tap the one
                    you want to wear, and it&apos;s applied immediately
                    to your public surfaces.
                  </li>
                  <li>
                    The in-trade side panel mirrors the same toggles —
                    flipping a strategy off there also turns it off in
                    your profile. State stays consistent across the app.
                  </li>
                </ul>
              </div>

              {/* Strategies vs trading manually */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  Important: strategies are signals, not auto-trading
                </h4>
                <p className="text-sm text-gray-300">
                  Even when a strategy plots a clear{" "}
                  <strong className="text-green-400">BUY</strong> or{" "}
                  <strong className="text-red-400">SELL</strong> marker
                  on the chart, <strong className="text-white">no
                  order is ever placed automatically on your behalf</strong>
                  . You still have to open the order ticket and decide
                  the size, leverage, stop-loss and take-profit yourself.
                  Strategies are a decision aid, not a robot — see the{" "}
                  <button
                    type="button"
                    onClick={() => scrollToSection("trading")}
                    className="text-cyan-400 hover:underline"
                  >
                    📈 Trading Guide
                  </button>{" "}
                  for how to translate a signal into an actual position.
                </p>
              </div>

              {/* Ownership & expiry */}
              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-400" />
                  Ownership &amp; expiry
                </h4>
                <div className="grid gap-2 text-sm">
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Indicators, strategies and cosmetics are lifetime.
                    </strong>{" "}
                    Once purchased they stay in your Arsenal forever —
                    they don&apos;t expire, and they don&apos;t need to
                    be re-purchased after a season ends.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Game Master packages are subscriptions.
                    </strong>{" "}
                    They run for a fixed period (typically 30 days), and
                    move to <em>expired</em> if you don&apos;t renew. The
                    GM card in your Arsenal shows the exact remaining
                    days and the &quot;Renew now&quot; button.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Marketplace purchases are final.
                    </strong>{" "}
                    Because items are delivered to your account
                    immediately, marketplace credit purchases are not
                    refundable. You can however{" "}
                    <strong className="text-white">disable</strong> any
                    item at any time so it stops affecting your chart or
                    profile.
                  </div>
                </div>
              </div>

              {/* How to use */}
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  How to use it (quick start)
                </h4>
                <ol className="space-y-2 text-sm text-gray-300 list-decimal pl-5">
                  <li>
                    Buy an item from the{" "}
                    <button
                      type="button"
                      onClick={() => scrollToSection("marketplace")}
                      className="text-orange-400 hover:underline"
                    >
                      Marketplace
                    </button>
                    . It is delivered to your account instantly.
                  </li>
                  <li>
                    Open{" "}
                    <Link
                      href="/profile?tab=arsenal"
                      className="text-orange-400 hover:underline"
                    >
                      /profile?tab=arsenal
                    </Link>{" "}
                    and find it by category. Toggle{" "}
                    <strong className="text-white">Enabled</strong> to
                    activate it.
                  </li>
                  <li>
                    For cosmetics, click{" "}
                    <strong className="text-white">Apply</strong> on the
                    item card. It&apos;s now live on your Profile Card
                    and the leaderboard.
                  </li>
                  <li>
                    For indicators and strategies, jump into any
                    competition or 1v1 trade page. Open the{" "}
                    <strong className="text-white">
                      Trading Arsenal
                    </strong>{" "}
                    side panel and confirm the items you want active on
                    that chart — they&apos;ll start drawing on the price
                    chart immediately.
                  </li>
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
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                👑 Game Master
              </h2>
            </div>

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                The Game Master (GM) program turns you into a
                community-builder: you get a personal{" "}
                <strong className="text-white">referral link</strong>,
                you can <strong className="text-white">create your own
                competitions</strong>, and you earn a percentage of every
                entry fee paid by traders you refer. Everything lives at{" "}
                <Link
                  href="/gamemaster"
                  className="text-purple-400 hover:underline"
                >
                  /gamemaster
                </Link>{" "}
                once you&apos;ve activated a package.
              </p>

              {/* 4-step flow */}
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">
                  🎮 How to become a Game Master
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-bold">
                        1
                      </span>
                      <span className="font-semibold text-white">
                        Buy a package
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 ml-8">
                      Open the{" "}
                      <button
                        type="button"
                        onClick={() => scrollToSection("marketplace")}
                        className="text-purple-400 hover:underline"
                      >
                        Marketplace
                      </button>{" "}
                      → <em>Game Master</em> category and pick a package
                      that fits your audience size and goals.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-bold">
                        2
                      </span>
                      <span className="font-semibold text-white">
                        Auto-activate
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 ml-8">
                      Your subscription activates the moment the purchase
                      goes through, and a{" "}
                      <strong className="text-white">GM Dashboard</strong>{" "}
                      link appears in your sidebar.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-bold">
                        3
                      </span>
                      <span className="font-semibold text-white">
                        Share your link
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 ml-8">
                      Your unique{" "}
                      <code className="bg-gray-900 px-1 py-0.5 rounded">
                        /sign-up?ref=GM…
                      </code>{" "}
                      link is on the GM Dashboard with one-click copy and
                      social-share buttons.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-bold">
                        4
                      </span>
                      <span className="font-semibold text-white">
                        Build &amp; earn
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 ml-8">
                      Create competitions for your community and earn a %
                      of every entry fee your referrals pay across the
                      platform.
                    </p>
                  </div>
                </div>
              </div>

              {/* What's inside a package */}
              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-purple-400" />
                  What&apos;s inside a Game Master package
                </h4>
                <p className="text-sm text-gray-400 mb-3">
                  Every GM package is configured by the platform team and
                  exposes the same set of levers. Exact numbers are shown
                  on each package&apos;s Marketplace card and on your GM
                  Dashboard.
                </p>
                <div className="grid gap-2 text-sm">
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600 flex items-start gap-2">
                    <Clock className="h-4 w-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">
                        Subscription duration
                      </strong>{" "}
                      — typically 30 days. After that the subscription
                      moves to <em>expired</em> unless you renew (or have
                      auto-renew on).
                    </span>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600 flex items-start gap-2">
                    <Trophy className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">
                        Daily competition quota
                      </strong>{" "}
                      — how many competitions you can{" "}
                      <em>create</em> per calendar day (
                      <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                        maxCompetitionsPerDay
                      </code>
                      ). Counter resets every day automatically.
                    </span>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600 flex items-start gap-2">
                    <Users className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">
                        Max participants per competition
                      </strong>{" "}
                      — the cap on how many traders can join one of your
                      competitions.
                    </span>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600 flex items-start gap-2">
                    <Coins className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">
                        Competition referral fee %
                      </strong>{" "}
                      — your slice of every entry fee paid by a referred
                      trader who joins <em>any</em> competition.
                    </span>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600 flex items-start gap-2">
                    <Swords className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">
                        1v1 challenge earnings (optional)
                      </strong>{" "}
                      — higher-tier packages unlock earnings on 1v1
                      stakes too, with an optional separate referral fee
                      % for challenges (
                      <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                        canEarnFromChallenges
                      </code>{" "}
                      +{" "}
                      <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                        challengeReferralFeePercentage
                      </code>
                      ).
                    </span>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600 flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">
                        Competition creation permission
                      </strong>{" "}
                      — most packages allow you to create your own
                      competitions; some entry-level packs may not (
                      <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                        canCreateCompetitions
                      </code>
                      ).
                    </span>
                  </div>
                </div>
              </div>

              {/* GM Dashboard */}
              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4 text-purple-400" />
                  Your GM Dashboard ({" "}
                  <Link
                    href="/gamemaster"
                    className="text-purple-400 hover:underline"
                  >
                    /gamemaster
                  </Link>{" "}
                  )
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1">
                      Overview &amp; KPIs
                    </p>
                    <p className="text-xs text-gray-400">
                      Total earnings, pending earnings, total referrals,
                      active referrals, competitions created, days left
                      until renewal, current package and its limits.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1">
                      Referral link &amp; code
                    </p>
                    <p className="text-xs text-gray-400">
                      Your{" "}
                      <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                        GM…
                      </code>{" "}
                      code plus a copy-to-clipboard ready{" "}
                      <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                        /sign-up?ref=…
                      </code>{" "}
                      URL.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1">
                      Competitions tab
                    </p>
                    <p className="text-xs text-gray-400">
                      Every competition you have created with current
                      status, participants, prize pool and entry fee.
                      &quot;Create competition&quot; opens the wizard at{" "}
                      <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                        /gamemaster/create-competition
                      </code>
                      .
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1">
                      Referrals tab
                    </p>
                    <p className="text-xs text-gray-400">
                      Every trader who signed up via your link with their
                      join date and active-status flag.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600 sm:col-span-2">
                    <p className="font-semibold text-white text-sm mb-1">
                      Earnings tab
                    </p>
                    <p className="text-xs text-gray-400">
                      A line-item ledger of every earning — source
                      (competition or challenge), referred user, entry
                      fee, your % at the time, gross, platform cut and
                      net credited to your wallet. Status flips from{" "}
                      <strong className="text-yellow-400">pending</strong>{" "}
                      to{" "}
                      <strong className="text-green-400">paid</strong>{" "}
                      automatically when the source event settles.
                    </p>
                  </div>
                </div>
              </div>

              {/* Creating competitions */}
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-400" />
                  Creating your own competitions
                </h4>
                <p className="text-sm text-gray-300 mb-3">
                  GMs with{" "}
                  <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                    canCreateCompetitions
                  </code>{" "}
                  enabled can spin up custom competitions from{" "}
                  <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                    /gamemaster/create-competition
                  </code>
                  . You control:
                </p>
                <ul className="space-y-1 text-xs text-gray-400 list-disc pl-5">
                  <li>
                    Name, description, difficulty, level requirement,
                    starting capital, leverage caps.
                  </li>
                  <li>
                    <strong className="text-white">Entry fee</strong> and{" "}
                    <strong className="text-white">
                      prize distribution
                    </strong>{" "}
                    (1st / 2nd / 3rd splits).
                  </li>
                  <li>
                    <strong className="text-white">Asset classes</strong>{" "}
                    (Forex, Crypto, Stocks — currently Forex is the only
                    live execution market, see{" "}
                    <button
                      type="button"
                      onClick={() => scrollToSection("trading")}
                      className="text-cyan-400 hover:underline"
                    >
                      Trading Guide
                    </button>
                    ), risk limits, start &amp; end times.
                  </li>
                  <li>
                    <strong className="text-white">Min / max
                    participants</strong> — your max is capped at your
                    package&apos;s{" "}
                    <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                      maxUsersPerCompetition
                    </code>
                    .
                  </li>
                </ul>
                <p className="text-xs text-gray-500 mt-3">
                  Your competitions live in the same public catalogue as
                  every other one (
                  <Link
                    href="/competitions"
                    className="text-cyan-400 hover:underline"
                  >
                    /competitions
                  </Link>
                  ), so any trader can join — not just your referrals.
                  Daily creation count is enforced against your
                  package&apos;s{" "}
                  <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                    maxCompetitionsPerDay
                  </code>
                  .
                </p>
              </div>

              {/* How earnings work */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Coins className="h-4 w-4 text-green-400" />
                  How earnings actually work
                </h4>
                <div className="space-y-2 text-sm text-gray-300">
                  <p>
                    <strong className="text-white">Attribution.</strong>{" "}
                    When somebody opens your link
                    (
                    <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                      /sign-up?ref=GM…
                    </code>
                    ) and creates an account, they are permanently
                    linked to you. Both the user record and a{" "}
                    <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                      UserReferral
                    </code>{" "}
                    document are stamped at registration. Once linked,
                    you keep earning from them for as long as your
                    subscription stays active.
                  </p>
                  <p>
                    <strong className="text-white">
                      Competition entries.
                    </strong>{" "}
                    When a referred trader pays an entry fee, your share
                    is calculated as{" "}
                    <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                      entryFee × referralFeePercentage
                    </code>
                    . It is credited to your wallet{" "}
                    <strong className="text-white">
                      when the competition finalises
                    </strong>{" "}
                    — not at the moment they pay. The wallet line shows
                    up as a{" "}
                    <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                      gamemaster_earning
                    </code>{" "}
                    transaction.
                  </p>
                  <p>
                    <strong className="text-white">
                      1v1 challenge entries.
                    </strong>{" "}
                    Only paid when your package has{" "}
                    <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                      canEarnFromChallenges
                    </code>{" "}
                    enabled. Calculated as{" "}
                    <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                      entryFee × challengeReferralFeePercentage
                    </code>{" "}
                    (falls back to your competition rate when not set).
                    Credited when the challenge settles as a{" "}
                    <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                      gamemaster_challenge_referral
                    </code>{" "}
                    transaction.
                  </p>
                  <p>
                    <strong className="text-white">Earnings cap.</strong>{" "}
                    Total GM payouts for any single competition or
                    challenge are <em>capped at the platform fee</em> on
                    that event. If multiple GMs have referrals in the
                    same event and the sum of their commissions would
                    exceed the platform fee, every GM&apos;s share is
                    scaled down proportionally — you cannot earn more
                    than the platform actually collected.
                  </p>
                </div>
              </div>

              {/* Subscription lifecycle */}
              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-400" />
                  Subscription lifecycle
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-green-400 mb-1">
                      Active
                    </p>
                    <p className="text-xs text-gray-400">
                      Default state after purchase or successful
                      renewal. You can create competitions (within your
                      daily quota), earn fees, and view all dashboard
                      tabs. Sidebar shows the{" "}
                      <strong className="text-white">GM Dashboard</strong>{" "}
                      link.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-orange-400 mb-1">
                      Paused (optional)
                    </p>
                    <p className="text-xs text-gray-400">
                      You can pause earnings from the dashboard. The
                      subscription stays valid, you keep all referrals,
                      but no new fees are credited to your wallet while
                      paused. Un-pause anytime to resume earning.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-yellow-400 mb-1">
                      Expired
                    </p>
                    <p className="text-xs text-gray-400">
                      Reached after{" "}
                      <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                        endDate
                      </code>{" "}
                      when auto-renew is off or the renewal payment
                      fails. The GM Dashboard link disappears from the
                      sidebar; you can still visit{" "}
                      <code className="text-xs bg-gray-900 px-1 py-0.5 rounded">
                        /gamemaster
                      </code>{" "}
                      to see the &quot;Renew now&quot; banner. Already
                      paid earnings remain in your wallet; no new fees
                      accrue while expired.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-cyan-400 mb-1">
                      Renew anytime
                    </p>
                    <p className="text-xs text-gray-400">
                      Click{" "}
                      <strong className="text-white">
                        &quot;Renew now&quot;
                      </strong>{" "}
                      on the GM Dashboard, in the Marketplace, or in your
                      Trading Arsenal&apos;s package card. Your wallet is
                      charged the package&apos;s current renewal price,
                      the subscription returns to{" "}
                      <strong className="text-green-400">active</strong>,
                      and a new period begins immediately.
                    </p>
                  </div>
                </div>
              </div>

              {/* Pro tips */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">💡 Pro tips</h4>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Once a trader signs up via your link they stay
                      linked to you forever — even if you let your
                      subscription expire and renew later (you simply
                      stop earning while expired).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Turn on{" "}
                      <strong className="text-white">auto-renew</strong>{" "}
                      so you never miss a payout window because your
                      package expired between a referral entering and a
                      competition finalising.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Running your own competitions is the best way to
                      activate referrals — your audience already trusts
                      you, and they will play in the events you create
                      for them.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>
                      GM earnings credit straight to your{" "}
                      <button
                        type="button"
                        onClick={() => scrollToSection("credits")}
                        className="text-yellow-400 hover:underline"
                      >
                        wallet
                      </button>{" "}
                      as standard wallet transactions — you can spend
                      them, withdraw them, or stack them up like any
                      other balance.
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
                ChartVolt sends you an in-app notification whenever
                something happens to your account — a trade fills, a
                competition ends, a challenge invite lands in your lap,
                a deposit clears, a badge is unlocked. You get the same
                stream everywhere you log in, with full control over
                what you receive and how loud it is.
              </p>

              {/* Where to find them */}
              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-pink-400" />
                  Where to find your notifications
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1">
                      The bell icon (top right)
                    </p>
                    <p className="text-xs text-gray-400">
                      The bell in the header — and in the desktop
                      sidebar — shows an unread badge with a small ping
                      animation when something new arrives. Click it to
                      drop down your{" "}
                      <strong className="text-white">20 most recent</strong>{" "}
                      notifications.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1">
                      Full page —{" "}
                      <Link
                        href="/notifications"
                        className="text-pink-400 hover:underline"
                      >
                        /notifications
                      </Link>
                    </p>
                    <p className="text-xs text-gray-400">
                      The full history with search, category filters,
                      and bulk actions. Loads up to 100 at a time.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600 sm:col-span-2">
                    <p className="font-semibold text-white text-sm mb-1">
                      Profile → Notifications tab
                    </p>
                    <p className="text-xs text-gray-400">
                      Open{" "}
                      <Link
                        href="/profile?tab=notifications"
                        className="text-pink-400 hover:underline"
                      >
                        /profile?tab=notifications
                      </Link>{" "}
                      for the same Notification Center, plus the{" "}
                      <strong className="text-white">
                        Notification Settings
                      </strong>{" "}
                      panel for managing what you receive.
                    </p>
                  </div>
                </div>
              </div>

              {/* Categories */}
              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-pink-400" />
                  What ChartVolt notifies you about
                </h4>
                <p className="text-sm text-gray-400 mb-3">
                  Notifications are grouped into{" "}
                  <strong className="text-white">ten categories</strong>{" "}
                  so you can fine-tune which ones reach you. Examples
                  below are representative — the exact triggers depend
                  on what you do on the platform.
                </p>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <p className="font-semibold text-cyan-400 mb-0.5 flex items-center gap-2">
                      <Trophy className="h-3.5 w-3.5" />
                      Competitions
                    </p>
                    <p className="text-xs text-gray-400">
                      Joined / starting soon / started / ending / final
                      ranking &amp; prize, cancellation refund,
                      disqualification.
                    </p>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <p className="font-semibold text-red-400 mb-0.5 flex items-center gap-2">
                      <Swords className="h-3.5 w-3.5" />
                      Challenges
                    </p>
                    <p className="text-xs text-gray-400">
                      Incoming 1v1 invite, accepted, declined, expired,
                      completed, you won.
                    </p>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <p className="font-semibold text-blue-400 mb-0.5 flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Trading
                    </p>
                    <p className="text-xs text-gray-400">
                      Order filled, position closed, stop-loss /
                      take-profit hit, margin warning, liquidation.
                    </p>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <p className="font-semibold text-green-400 mb-0.5 flex items-center gap-2">
                      <CreditCard className="h-3.5 w-3.5" />
                      Purchases &amp; wallet
                    </p>
                    <p className="text-xs text-gray-400">
                      Deposit initiated / completed / failed,
                      withdrawal status changes, marketplace receipts.
                    </p>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <p className="font-semibold text-yellow-400 mb-0.5 flex items-center gap-2">
                      <Medal className="h-3.5 w-3.5" />
                      Achievements
                    </p>
                    <p className="text-xs text-gray-400">
                      Badge unlocked, milestone reached, level-up.
                    </p>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <p className="font-semibold text-purple-400 mb-0.5 flex items-center gap-2">
                      <Heart className="h-3.5 w-3.5" />
                      Social
                    </p>
                    <p className="text-xs text-gray-400">
                      Friend requests, new messages, match-card
                      activity.
                    </p>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <p className="font-semibold text-pink-400 mb-0.5 flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" />
                      Messaging
                    </p>
                    <p className="text-xs text-gray-400">
                      Inbox replies and direct-message threads.
                    </p>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <p className="font-semibold text-emerald-400 mb-0.5 flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5" />
                      Security (always on)
                    </p>
                    <p className="text-xs text-gray-400">
                      KYC status changes, password changes, suspicious
                      activity. You cannot mute this category — it
                      protects your account.
                    </p>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <p className="font-semibold text-gray-300 mb-0.5 flex items-center gap-2">
                      <Info className="h-3.5 w-3.5" />
                      System
                    </p>
                    <p className="text-xs text-gray-400">
                      Platform announcements, scheduled maintenance,
                      terms updates.
                    </p>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <p className="font-semibold text-orange-400 mb-0.5 flex items-center gap-2">
                      <User className="h-3.5 w-3.5" />
                      Admin
                    </p>
                    <p className="text-xs text-gray-400">
                      Direct messages from the support / ops team to
                      your account.
                    </p>
                  </div>
                </div>
              </div>

              {/* Priority */}
              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  Priority &amp; styling
                </h4>
                <p className="text-sm text-gray-400 mb-3">
                  Every notification carries one of four priority
                  levels, and the UI highlights higher-priority items
                  with a coloured left border and a slightly more
                  prominent treatment.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-gray-700/40 rounded border-l-2 border-gray-500 text-gray-300">
                    <strong className="text-gray-300">Low</strong> —
                    quiet info
                  </div>
                  <div className="p-2 bg-gray-700/40 rounded border-l-2 border-blue-500 text-gray-300">
                    <strong className="text-blue-300">Normal</strong> —
                    default
                  </div>
                  <div className="p-2 bg-gray-700/40 rounded border-l-2 border-orange-500 text-gray-300">
                    <strong className="text-orange-300">High</strong> —
                    needs your attention
                  </div>
                  <div className="p-2 bg-red-500/10 rounded border-l-2 border-red-500 text-gray-300">
                    <strong className="text-red-300">Urgent</strong> —
                    take action now
                  </div>
                </div>
              </div>

              {/* Real-time delivery */}
              <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-pink-400" />
                  How fast do they arrive?
                </h4>
                <ul className="space-y-1.5 text-sm text-gray-300 list-disc pl-5">
                  <li>
                    <strong className="text-white">
                      Incoming 1v1 challenges are pushed in real-time
                    </strong>{" "}
                    over a live connection — a Challenge popup appears
                    instantly with Accept / Decline buttons. You can
                    silence the popup separately if you only want the
                    bell badge.
                  </li>
                  <li>
                    Everything else lands the next time the bell polls
                    for updates —{" "}
                    <strong className="text-white">every 15 seconds</strong>{" "}
                    while the dropdown is open, and{" "}
                    <strong className="text-white">every 60 seconds</strong>{" "}
                    in the background. Refresh the page or open the
                    bell for an immediate fetch.
                  </li>
                  <li>
                    Each notification can carry an{" "}
                    <strong className="text-white">action button</strong>{" "}
                    that deep-links to the relevant page (the
                    competition, the challenge, the wallet, the trade
                    detail).
                  </li>
                </ul>
              </div>

              {/* Read / unread / delete */}
              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  Reading, clearing &amp; deleting
                </h4>
                <ul className="space-y-1.5 text-sm text-gray-300 list-disc pl-5">
                  <li>
                    Clicking a row{" "}
                    <strong className="text-white">marks it as read</strong>{" "}
                    and navigates you to the related page if it has
                    one.
                  </li>
                  <li>
                    The dropdown has a{" "}
                    <strong className="text-white">
                      &quot;Mark all read&quot;
                    </strong>{" "}
                    button. The full page also lets you{" "}
                    <strong className="text-white">delete</strong>{" "}
                    individual notifications or{" "}
                    <strong className="text-white">clear all</strong>.
                  </li>
                  <li>
                    Read notifications stay in your history so you can
                    scroll back through them; the bell&apos;s unread
                    badge only counts the ones you haven&apos;t seen
                    yet.
                  </li>
                </ul>
              </div>

              {/* Settings */}
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-purple-400" />
                  Notification Settings
                </h4>
                <p className="text-sm text-gray-300 mb-3">
                  Open{" "}
                  <Link
                    href="/profile?tab=notifications"
                    className="text-purple-400 hover:underline"
                  >
                    /profile?tab=notifications
                  </Link>{" "}
                  → the{" "}
                  <strong className="text-white">
                    Notification Settings
                  </strong>{" "}
                  sub-tab to control:
                </p>
                <div className="grid gap-2 text-sm">
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">Master switch.</strong>{" "}
                    One toggle that pauses everything except Security
                    notifications.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Delivery methods.
                    </strong>{" "}
                    In-app notifications are{" "}
                    <strong className="text-pink-300">always on</strong>{" "}
                    (they live on this site). Email delivery has its
                    own toggle for the few categories that also send
                    you a confirmation message by email.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Challenge popup alerts.
                    </strong>{" "}
                    Turn the real-time 1v1 challenge popup on or off
                    while still receiving the bell notification.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Category toggles.
                    </strong>{" "}
                    Mute or un-mute entire categories
                    (Competitions, Challenges, Trading, Achievements,
                    Social, Messaging, Purchases, System, Admin).
                    Security stays on.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Per-notification fine-tuning.
                    </strong>{" "}
                    Inside each category you can disable individual
                    notification types — for example, keep
                    &quot;Competition started&quot; but mute
                    &quot;Competition starting soon&quot;.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">Quiet hours.</strong>{" "}
                    Define a time window during which non-urgent
                    notifications are held back. Urgent and Security
                    notifications always come through.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Reset to defaults.
                    </strong>{" "}
                    One click puts every preference back to the
                    out-of-the-box setting.
                  </div>
                </div>
              </div>

              {/* Pro tips */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">💡 Pro tips</h4>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>
                      If the bell stops badging unexpectedly, check the
                      master switch first — it&apos;s the most common
                      cause of &quot;quiet&quot; accounts.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Quiet hours pair well with disabling the
                      challenge popup — you still see invites in your
                      bell when you wake up, without the screen taking
                      over your evening.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Use category filters on{" "}
                      <Link
                        href="/notifications"
                        className="text-yellow-400 hover:underline"
                      >
                        /notifications
                      </Link>{" "}
                      to focus on Trading or Competition events when
                      you&apos;re running a busy session.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Trader's Journey */}
          <section
            id="journey"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Map className="h-6 w-6 text-amber-400" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                🗺️ Trader&apos;s Journey
              </h2>
            </div>

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                The Trader&apos;s Journey is your{" "}
                <strong className="text-white">in-game progression map</strong>{" "}
                — a curated path of milestones that turns your real actions
                on the platform (depositing, trading, entering
                competitions, accepting 1v1s, earning badges, climbing
                levels) into a visible adventure. Each milestone you
                complete drops <strong className="text-white">XP</strong>{" "}
                into your account, can hand you a{" "}
                <strong className="text-white">badge</strong>, and pushes
                you closer to the next{" "}
                <strong className="text-white">Trader Level</strong>.
              </p>

              <p className="text-sm text-gray-400">
                You can open it in two places: the{" "}
                <Link
                  href="/profile?tab=journey"
                  className="text-amber-400 hover:underline"
                >
                  Journey tab
                </Link>{" "}
                in your profile, or the dedicated{" "}
                <Link
                  href="/journey"
                  className="text-amber-400 hover:underline"
                >
                  /journey
                </Link>{" "}
                page from the sidebar.
              </p>

              {/* How it works */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
                <h3 className="text-lg font-bold text-amber-400 mb-3 flex items-center gap-2">
                  <Flag className="h-5 w-5" />
                  How the journey is built
                </h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span>
                      The journey is split into up to{" "}
                      <strong className="text-white">10 maps</strong>,
                      each themed around a stage of your trading career
                      (onboarding, first competitions, multi-asset
                      mastery, etc.).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Each map contains a chain of{" "}
                      <strong className="text-white">milestones</strong>{" "}
                      (nodes). They unlock in order — you can&apos;t
                      jump ahead, but you can always look at the next
                      node to see what unlocks it.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Milestone conditions are checked against your{" "}
                      <strong className="text-white">real account
                      stats</strong> (deposits, closed trades, lifetime
                      PnL, competitions entered/won, 1v1s won, badges
                      earned, account level, days active, etc.). Nothing
                      is awarded for clicking — only for actually doing
                      the thing.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Progress is evaluated automatically every time you
                      open the Journey tab, plus after every trade
                      closes, every deposit completes, and every
                      competition / 1v1 settles — so the map updates as
                      you play.
                    </span>
                  </li>
                </ul>
              </div>

              {/* What you see on the Journey page */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">
                  What you see on the Journey page
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-4 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-amber-300 text-sm mb-1">
                      🧭 Stat cards
                    </p>
                    <p className="text-xs text-gray-400">
                      Total Journey XP earned, total milestones
                      completed across all maps, days since you joined
                      the journey, and maps completed (e.g.{" "}
                      <code className="text-[10px] bg-gray-900 px-1 py-0.5 rounded">
                        3 / 10
                      </code>
                      ).
                    </p>
                  </div>
                  <div className="p-4 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-amber-300 text-sm mb-1">
                      🗺️ Map picker
                    </p>
                    <p className="text-xs text-gray-400">
                      Horizontal strip of all available maps. Completed
                      maps are checked off, the current map is
                      highlighted, and later maps appear locked until
                      you unlock them.
                    </p>
                  </div>
                  <div className="p-4 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-amber-300 text-sm mb-1">
                      📍 Map canvas
                    </p>
                    <p className="text-xs text-gray-400">
                      The active map itself: a draggable board with
                      nodes for each milestone. Nodes are colour-coded{" "}
                      <span className="text-gray-400">locked</span> →{" "}
                      <span className="text-cyan-400">unlocked</span> →{" "}
                      <span className="text-amber-300">current</span> →{" "}
                      <span className="text-green-400">completed</span>.
                      A small 🏆 marker appears on nodes that also award
                      a badge.
                    </p>
                  </div>
                  <div className="p-4 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-amber-300 text-sm mb-1">
                      🏅 Recent Achievements
                    </p>
                    <p className="text-xs text-gray-400">
                      The last <strong className="text-white">five</strong>{" "}
                      milestones you completed on the current map, in
                      reverse chronological order — handy for jumping
                      back to a node you just cleared.
                    </p>
                  </div>
                </div>
              </div>

              {/* How a milestone completes */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
                <h3 className="text-lg font-bold text-blue-400 mb-3">
                  How a milestone completes
                </h3>
                <ol className="space-y-2 text-sm text-gray-300 list-decimal pl-5">
                  <li>
                    The milestone declares a set of{" "}
                    <strong className="text-white">conditions</strong>{" "}
                    (e.g. <em>3 closed trades</em>,{" "}
                    <em>first deposit</em>,{" "}
                    <em>5 competitions entered</em>,{" "}
                    <em>reach Level 5</em>, <em>earn the &quot;First
                    Blood&quot; badge</em>).
                  </li>
                  <li>
                    Whenever a relevant event happens, the platform
                    re-checks the conditions for the current and
                    next-up milestones — using the same stats engine
                    that drives badges.
                  </li>
                  <li>
                    When every condition is satisfied, the milestone is
                    marked <strong className="text-green-400">completed</strong>{" "}
                    and its rewards are paid out at once: XP credited to
                    your{" "}
                    <button
                      type="button"
                      onClick={() => scrollToSection("trader-levels")}
                      className="text-cyan-400 hover:underline"
                    >
                      Trader Level
                    </button>
                    , an optional{" "}
                    <button
                      type="button"
                      onClick={() => scrollToSection("badge-system")}
                      className="text-yellow-400 hover:underline"
                    >
                      badge
                    </button>
                    , an optional title, and any platform features the
                    map chooses to unlock at that node.
                  </li>
                  <li>
                    A toast / notification fires for the completion. If
                    the XP push also crossed a level threshold,{" "}
                    <strong className="text-white">you level up at
                    the same time</strong>.
                  </li>
                </ol>
              </div>

              {/* Connection to badges */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5">
                <h3 className="text-lg font-bold text-yellow-400 mb-3 flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  How the Journey ties into Badges
                </h3>
                <div className="space-y-3 text-sm text-gray-300">
                  <p>
                    The Journey and the{" "}
                    <button
                      type="button"
                      onClick={() => scrollToSection("badge-system")}
                      className="text-yellow-400 hover:underline"
                    >
                      🏅 Badge System
                    </button>{" "}
                    feed into each other in three ways:
                  </p>
                  <ul className="space-y-2 list-disc pl-5 text-gray-400">
                    <li>
                      <strong className="text-white">
                        Milestones award badges.
                      </strong>{" "}
                      Every &quot;first&quot;-style achievement on
                      ChartVolt — first deposit, first trade, first
                      competition entered, first 1v1 won, etc. — is
                      handled by Journey milestones, and the badge for
                      that achievement is granted the moment the
                      milestone completes. (This is why the standalone
                      Badge System doesn&apos;t duplicate &quot;first
                      X&quot; badges.)
                    </li>
                    <li>
                      <strong className="text-white">
                        Badges can gate milestones.
                      </strong>{" "}
                      Later milestones can require specific badges as a
                      pre-condition — e.g. a competition-mastery
                      milestone that only unlocks after you&apos;ve
                      earned the &quot;Podium Finisher&quot; badge.
                    </li>
                    <li>
                      <strong className="text-white">
                        Earning a badge re-checks the Journey.
                      </strong>{" "}
                      When the badge engine awards you anything, it
                      immediately re-runs the milestone evaluator —
                      so if that new badge was the last missing piece
                      of a milestone, the milestone completes in the
                      same step.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Connection to levels */}
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-5">
                <h3 className="text-lg font-bold text-cyan-400 mb-3 flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  How the Journey ties into Trader Levels
                </h3>
                <div className="space-y-3 text-sm text-gray-300">
                  <p>
                    Journey XP is{" "}
                    <strong className="text-white">
                      the same XP
                    </strong>{" "}
                    used by your account-wide{" "}
                    <button
                      type="button"
                      onClick={() => scrollToSection("trader-levels")}
                      className="text-cyan-400 hover:underline"
                    >
                      Trader Level
                    </button>{" "}
                    — there is only one XP pool. Milestones simply
                    push into it from one more source (alongside
                    badges, trades, competitions, and challenges).
                  </p>
                  <ul className="space-y-2 list-disc pl-5 text-gray-400">
                    <li>
                      Completing a milestone calls the same{" "}
                      <code className="text-[11px] bg-gray-900 px-1.5 py-0.5 rounded">
                        awardXP
                      </code>{" "}
                      service that the Badge System uses, so the XP
                      bar on your Overview tab and the Journey&apos;s
                      &quot;Total XP&quot; figure are always in sync.
                    </li>
                    <li>
                      Some maps and milestones have a{" "}
                      <strong className="text-white">
                        level requirement
                      </strong>{" "}
                      (e.g. &quot;reach Level 5 to unlock Map 2&quot;).
                      Those nodes stay locked even if you meet the
                      action conditions until you cross the level
                      threshold.
                    </li>
                    <li>
                      Big milestones can hand out enough XP to{" "}
                      <strong className="text-white">trigger a
                      level-up in the same moment</strong>. You&apos;ll
                      get the milestone toast followed immediately by
                      the level-up notification.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Summary table */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">
                  Quick recap: Journey vs Badges vs Levels
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border border-gray-700 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-gray-700/50 text-gray-300">
                        <th className="px-3 py-2 text-left">System</th>
                        <th className="px-3 py-2 text-left">
                          What it&apos;s for
                        </th>
                        <th className="px-3 py-2 text-left">
                          Awards XP?
                        </th>
                        <th className="px-3 py-2 text-left">
                          Granted automatically?
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-300">
                      <tr className="border-t border-gray-700">
                        <td className="px-3 py-2 font-semibold text-amber-300">
                          Journey
                        </td>
                        <td className="px-3 py-2 text-gray-400">
                          Ordered path of milestones turning your
                          actions into a visible progression map.
                        </td>
                        <td className="px-3 py-2 text-green-400">
                          Yes
                        </td>
                        <td className="px-3 py-2 text-green-400">
                          Yes — re-evaluated on relevant events
                        </td>
                      </tr>
                      <tr className="border-t border-gray-700">
                        <td className="px-3 py-2 font-semibold text-yellow-300">
                          Badges
                        </td>
                        <td className="px-3 py-2 text-gray-400">
                          Collectible achievements you can show off on
                          your profile and the leaderboard.
                        </td>
                        <td className="px-3 py-2 text-green-400">
                          Yes
                        </td>
                        <td className="px-3 py-2 text-green-400">
                          Yes — event-driven + hourly
                        </td>
                      </tr>
                      <tr className="border-t border-gray-700">
                        <td className="px-3 py-2 font-semibold text-cyan-300">
                          Trader Levels
                        </td>
                        <td className="px-3 py-2 text-gray-400">
                          Single account-wide level driven by the total
                          XP earned from all sources.
                        </td>
                        <td className="px-3 py-2 text-gray-400">
                          (Levels consume XP)
                        </td>
                        <td className="px-3 py-2 text-green-400">
                          Yes — every XP grant recalculates
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CTA */}
              {isLoggedIn && (
                <div className="bg-gray-700/50 border border-gray-600 rounded-xl p-5 text-center">
                  <p className="text-sm text-gray-400 mb-3">
                    Pick up where you left off — every closed trade,
                    every deposit, every podium finish nudges you a
                    little further down the map.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Link
                      href="/journey"
                      className="inline-block px-6 py-2 bg-amber-500 hover:bg-amber-600 text-gray-900 rounded-lg transition-colors font-medium text-sm"
                    >
                      Open the Journey
                    </Link>
                    <Link
                      href="/profile?tab=journey"
                      className="inline-block px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium text-sm border border-gray-600"
                    >
                      Profile → Journey tab
                    </Link>
                  </div>
                </div>
              )}
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
                👑 Trader Levels &amp; Titles
              </h2>
            </div>

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Every trader on ChartVolt has a{" "}
                <strong className="text-white">Level</strong> and a{" "}
                <strong className="text-white">Title</strong> earned
                through{" "}
                <strong className="text-white">Experience Points (XP)</strong>
                . XP is awarded for the things you actually do on the
                platform — unlocking badges, finishing trades, competing
                in events, winning 1v1 challenges, and ticking off
                onboarding milestones. Climb the{" "}
                <strong className="text-white">
                  {settings.levels.length} ranks
                </strong>{" "}
                from <em>Novice Trader</em> all the way to{" "}
                <em className="text-amber-400">Trading God</em>.
              </p>

              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 text-xs text-gray-300">
                <strong className="text-cyan-300">Where you see it:</strong>{" "}
                Your current title appears under your name on the{" "}
                <button
                  type="button"
                  onClick={() => scrollToSection("profile")}
                  className="text-cyan-400 hover:underline"
                >
                  Profile
                </button>{" "}
                header, on the{" "}
                <button
                  type="button"
                  onClick={() => scrollToSection("dashboard")}
                  className="text-cyan-400 hover:underline"
                >
                  Dashboard
                </button>{" "}
                player card, and on every row of the{" "}
                <button
                  type="button"
                  onClick={() => scrollToSection("leaderboard")}
                  className="text-cyan-400 hover:underline"
                >
                  Leaderboard
                </button>
                . The XP progress bar (current XP → next level&apos;s
                threshold) lives on your Profile.
              </div>

              {/* XP sources */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">
                  How to earn XP
                </h4>
                <p className="text-sm text-gray-400 mb-3">
                  Five real sources of XP — every one of them feeds the
                  same pool on your profile.
                </p>

                {/* Badges */}
                <div className="mb-4">
                  <p className="font-semibold text-white text-sm mb-2 flex items-center gap-2">
                    <Medal className="h-4 w-4 text-yellow-400" />
                    Unlock badges
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="text-center p-3 rounded-lg bg-gray-700/50">
                      <p className="text-gray-400 text-xs mb-1">
                        ⭐ Common
                      </p>
                      <p className="text-green-400 font-bold text-lg">
                        +{settings.badgeXP.common} XP
                      </p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-gray-700/50">
                      <p className="text-gray-400 text-xs mb-1">
                        💎 Rare
                      </p>
                      <p className="text-blue-400 font-bold text-lg">
                        +{settings.badgeXP.rare} XP
                      </p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-gray-700/50">
                      <p className="text-gray-400 text-xs mb-1">
                        👑 Epic
                      </p>
                      <p className="text-purple-400 font-bold text-lg">
                        +{settings.badgeXP.epic} XP
                      </p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-gray-700/50">
                      <p className="text-gray-400 text-xs mb-1">
                        🌟 Legendary
                      </p>
                      <p className="text-yellow-400 font-bold text-lg">
                        +{settings.badgeXP.legendary} XP
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Full list of badges and how to earn each one in the{" "}
                    <button
                      type="button"
                      onClick={() => scrollToSection("badge-system")}
                      className="text-yellow-400 hover:underline"
                    >
                      🏅 Badge System
                    </button>{" "}
                    section.
                  </p>
                </div>

                {/* Trading activity */}
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <p className="font-semibold text-blue-400 mb-1 flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5" /> Trading
                    </p>
                    <p className="text-xs text-gray-400">
                      <strong className="text-white">+2 XP</strong> per
                      trade you close, plus{" "}
                      <strong className="text-white">+3 XP</strong> if
                      it was a winner.{" "}
                      <em>Daily cap: 100 XP combined</em>, so grinding
                      one-tick scalps won&apos;t game the system.
                    </p>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <p className="font-semibold text-yellow-400 mb-1 flex items-center gap-2">
                      <Trophy className="h-3.5 w-3.5" /> Competitions
                    </p>
                    <p className="text-xs text-gray-400">
                      <strong className="text-white">+25 XP</strong> for
                      finishing,{" "}
                      <strong className="text-white">+20 / +35 / +50 XP</strong>{" "}
                      bonus for 3rd / 2nd / 1st place podiums.
                    </p>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <p className="font-semibold text-red-400 mb-1 flex items-center gap-2">
                      <Swords className="h-3.5 w-3.5" /> 1v1 Challenges
                    </p>
                    <p className="text-xs text-gray-400">
                      <strong className="text-white">+15 XP</strong> for
                      every completed 1v1, plus{" "}
                      <strong className="text-white">+30 XP</strong>{" "}
                      bonus if you took the win.
                    </p>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <p className="font-semibold text-purple-400 mb-1 flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5" /> Milestones
                    </p>
                    <p className="text-xs text-gray-400">
                      Bonus XP from the onboarding Journey and key
                      account milestones (first deposit, first trade,
                      first podium, etc.).
                    </p>
                  </div>
                </div>
              </div>

              {/* Tiers overview */}
              <div>
                <h4 className="font-semibold text-white mb-2">
                  Four tiers, twenty titles
                </h4>
                <div className="grid gap-2 sm:grid-cols-2 text-sm mb-4">
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600 flex items-center gap-2">
                    <span className="text-gray-300 font-bold">Tier 1</span>
                    <span className="text-xs text-gray-400">
                      Beginner — Levels 1-5 (0-499 XP)
                    </span>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600 flex items-center gap-2">
                    <span className="text-blue-300 font-bold">Tier 2</span>
                    <span className="text-xs text-gray-400">
                      Intermediate — Levels 6-10 (500-1,999 XP)
                    </span>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600 flex items-center gap-2">
                    <span className="text-purple-300 font-bold">Tier 3</span>
                    <span className="text-xs text-gray-400">
                      Advanced — Levels 11-15 (2,000-4,999 XP)
                    </span>
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600 flex items-center gap-2">
                    <span className="text-yellow-300 font-bold">Tier 4</span>
                    <span className="text-xs text-gray-400">
                      Elite — Levels 16-20 (5,000+ XP)
                    </span>
                  </div>
                </div>

                <h4 className="font-semibold text-white mb-3">
                  All {settings.levels.length} trader levels
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

              {/* FAQ-ish notes */}
              <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-2 text-sm text-gray-300">
                <p>
                  <strong className="text-white">Do levels affect trading?</strong>{" "}
                  Levels are a progression badge. Some Game Master
                  competitions can require a minimum level to join, but
                  trading rules (leverage, lot size, risk caps) are set
                  by the contest, not your level.
                </p>
                <p>
                  <strong className="text-white">Can XP go down?</strong>{" "}
                  No. XP is cumulative — once earned, it stays on your
                  account.
                </p>
                <p>
                  <strong className="text-white">
                    What if admins re-balance the thresholds?
                  </strong>{" "}
                  Titles and XP requirements are configurable by the
                  platform team. If a level chart change happens, your
                  current XP is automatically remapped to the new title
                  the next time you load your profile.
                </p>
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
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                🏅 Badge System
              </h2>
            </div>

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Badges are how ChartVolt celebrates the things you
                actually do — winning competitions, mastering a strategy,
                running a clean risk book, surviving drawdowns,
                stringing wins together. Every badge you earn{" "}
                <strong className="text-white">adds XP</strong> to your
                trader level and feeds into your{" "}
                <button
                  type="button"
                  onClick={() => scrollToSection("score-system")}
                  className="text-yellow-400 hover:underline"
                >
                  ChartVolt Score
                </button>
                . There is no cost to earn one — they unlock
                automatically the moment you hit the criteria.
              </p>

              {/* Where badges live */}
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-xs text-gray-300">
                <strong className="text-purple-300">Where to see them:</strong>{" "}
                Open the{" "}
                <Link
                  href="/profile?tab=badges"
                  className="text-purple-400 hover:underline"
                >
                  Badges tab
                </Link>{" "}
                in your profile for the full collection (earned and
                locked), the{" "}
                <button
                  type="button"
                  onClick={() => scrollToSection("dashboard")}
                  className="text-purple-400 hover:underline"
                >
                  Dashboard
                </button>{" "}
                player card for your most-recent wins, and the{" "}
                <button
                  type="button"
                  onClick={() => scrollToSection("leaderboard")}
                  className="text-purple-400 hover:underline"
                >
                  Leaderboard
                </button>{" "}
                for every trader&apos;s badge count.
              </div>

              {/* Rarities + XP */}
              <div>
                <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-400" />
                  Four rarities — XP they grant
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">⭐</span>
                      <div>
                        <p className="font-semibold text-gray-200">
                          Common
                        </p>
                        <p className="text-xs text-gray-500">
                          Everyday milestones and easy wins
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-green-400 font-bold">
                      +{settings.badgeXP.common} XP
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">💎</span>
                      <div>
                        <p className="font-semibold text-blue-400">
                          Rare
                        </p>
                        <p className="text-xs text-gray-500">
                          Real consistency — you&apos;ve been at it for
                          a while
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-blue-400 font-bold">
                      +{settings.badgeXP.rare} XP
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">👑</span>
                      <div>
                        <p className="font-semibold text-purple-400">
                          Epic
                        </p>
                        <p className="text-xs text-gray-500">
                          Hard to fake — usually demands a podium or a
                          tough drawdown survival
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-purple-400 font-bold">
                      +{settings.badgeXP.epic} XP
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🌟</span>
                      <div>
                        <p className="font-semibold text-yellow-400">
                          Legendary
                        </p>
                        <p className="text-xs text-gray-500">
                          Few traders ever see these — Hall-of-Fame
                          tier
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-yellow-400 font-bold">
                      +{settings.badgeXP.legendary} XP
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  XP per rarity is admin-configurable. The numbers above
                  are pulled live from your platform&apos;s current
                  settings.
                </p>
              </div>

              {/* Real categories */}
              <div>
                <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Medal className="h-4 w-4 text-yellow-400" />
                  Nine badge categories
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-yellow-400 text-sm mb-1 flex items-center gap-2">
                      <Trophy className="h-3.5 w-3.5" /> Competition
                    </p>
                    <p className="text-xs text-gray-400">
                      Competitions entered, first wins, podium finishes,
                      consecutive top-3 streaks.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-blue-400 text-sm mb-1 flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5" /> Trading
                    </p>
                    <p className="text-xs text-gray-400">
                      Total trades closed, daily/weekly volume, asset
                      diversity, and time-of-day milestones.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-green-400 text-sm mb-1 flex items-center gap-2">
                      <Coins className="h-3.5 w-3.5" /> Profit
                    </p>
                    <p className="text-xs text-gray-400">
                      Profit factor, ROI thresholds, consecutive
                      profitable days, and total P&amp;L crossed.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-cyan-400 text-sm mb-1 flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5" /> Risk
                    </p>
                    <p className="text-xs text-gray-400">
                      Surviving drawdowns, holding low max-drawdown %,
                      and competition risk discipline.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-orange-400 text-sm mb-1 flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5" /> Speed
                    </p>
                    <p className="text-xs text-gray-400">
                      Fast scalps, quick competition climbs, rapid
                      milestone unlocks.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-pink-400 text-sm mb-1 flex items-center gap-2">
                      <Target className="h-3.5 w-3.5" /> Consistency
                    </p>
                    <p className="text-xs text-gray-400">
                      Win streaks, consecutive trading days, and stable
                      win rates over time.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-purple-400 text-sm mb-1 flex items-center gap-2">
                      <BarChart3 className="h-3.5 w-3.5" /> Strategy
                    </p>
                    <p className="text-xs text-gray-400">
                      Smart play markers — favourable risk-reward,
                      Sharpe-style metrics, balanced entries.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-rose-400 text-sm mb-1 flex items-center gap-2">
                      <Heart className="h-3.5 w-3.5" /> Social
                    </p>
                    <p className="text-xs text-gray-400">
                      Community engagement (friends, messages,
                      challenges accepted) — some entries are still
                      being expanded.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600 sm:col-span-2">
                    <p className="font-semibold text-amber-400 text-sm mb-1 flex items-center gap-2">
                      <Award className="h-3.5 w-3.5" /> Legendary
                    </p>
                    <p className="text-xs text-gray-400">
                      A small pantheon of top-tier achievements
                      (Hall-of-Fame ranks, undefeated runs, lifetime
                      milestones). These are the badges the Score
                      System highlights separately.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Filter the full grid by category and rarity on{" "}
                  <Link
                    href="/profile?tab=badges"
                    className="text-purple-400 hover:underline"
                  >
                    /profile?tab=badges
                  </Link>
                  . Locked badges stay visible (greyed out) so you can
                  see what you&apos;re working towards.
                </p>
              </div>

              {/* How they're awarded */}
              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  How badges are awarded
                </h4>
                <ul className="space-y-1.5 text-sm text-gray-300 list-disc pl-5">
                  <li>
                    Whenever you take a trading action — closing a
                    position, entering or finishing a competition,
                    completing a 1v1, completing a deposit, getting KYC
                    approved — the platform re-evaluates the relevant
                    badge group and unlocks any that you now qualify
                    for.
                  </li>
                  <li>
                    On top of those event hooks, there&apos;s a
                    background pass{" "}
                    <strong className="text-white">every hour</strong>{" "}
                    that re-checks the full catalogue for any active
                    competitor, so badges based on long-running streaks
                    or aggregate stats never get missed.
                  </li>
                  <li>
                    When a badge unlocks you get a real-time{" "}
                    <button
                      type="button"
                      onClick={() => scrollToSection("notifications")}
                      className="text-pink-400 hover:underline"
                    >
                      notification
                    </button>{" "}
                    and the XP is added to your trader level the same
                    moment.
                  </li>
                  <li>
                    Higher-rarity badges have built-in
                    &quot;earn-your-stripes&quot; gates — even if your
                    condition technically fits, an{" "}
                    <em>Epic</em> or <em>Legendary</em> badge will only
                    fire once you have enough closed trades or finished
                    competitions to prove it wasn&apos;t a one-off.
                  </li>
                  <li>
                    Some badges are{" "}
                    <strong className="text-white">level-gated</strong>{" "}
                    — they appear on your profile as locked until you
                    reach the required trader level.
                  </li>
                </ul>
              </div>

              {/* Pro tips */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">💡 Pro tips</h4>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Don&apos;t farm trades just for badges — the
                      higher tiers explicitly check for closed-trade
                      and competition counts, so quality counts more
                      than quantity.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Mixed-category collections pay off — every badge
                      counts towards your Score&apos;s badge total, and
                      Legendary badges add an extra boost in the
                      ranking formula (
                      <button
                        type="button"
                        onClick={() => scrollToSection("score-system")}
                        className="text-yellow-400 hover:underline"
                      >
                        full formula here
                      </button>
                      ).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>
                      If you think you should have a badge that
                      hasn&apos;t triggered yet, give it up to an hour
                      — the background pass will catch it. If
                      it&apos;s still missing, contact support with
                      the badge name.
                    </span>
                  </li>
                </ul>
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
                Trading on ChartVolt uses virtual capital, but it follows
                the same{" "}
                <strong className="text-white">margin and leverage
                rules</strong>{" "}
                you&apos;d find at a real broker. This section explains
                how your account is monitored, what the platform does
                automatically when a position goes against you, and the
                guard-rails individual competitions can layer on top.
              </p>

              {/* Margin formula */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-400" />
                  How margin level is calculated
                </h4>
                <p className="text-sm text-gray-300 mb-3">
                  Every position you open locks a slice of your virtual
                  capital as <strong className="text-white">margin</strong>{" "}
                  (proportional to position size ÷ leverage). The
                  platform constantly tracks one number — your{" "}
                  <strong className="text-white">margin level</strong> —
                  and that drives every guard-rail below:
                </p>
                <div className="bg-gray-900/60 rounded-lg p-3 font-mono text-sm text-cyan-300 mb-3 border border-gray-700">
                  Margin Level (%) ={" "}
                  <span className="text-yellow-300">Equity</span> ÷{" "}
                  <span className="text-yellow-300">Used Margin</span> ×
                  100
                </div>
                <p className="text-xs text-gray-400">
                  <strong className="text-white">Equity</strong> = your
                  current contest balance + the live unrealised P&amp;L
                  on every open position. As prices move in your favour
                  the number climbs; as they move against you it falls.
                  When no positions are open, margin level is{" "}
                  &quot;∞&quot; — there is nothing to liquidate.
                </p>
              </div>

              {/* Margin tiers */}
              <div>
                <h4 className="font-semibold text-white mb-3">
                  Margin levels &amp; what happens at each tier
                </h4>
                <div className="space-y-3">
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-green-400">
                        ✅ Safe
                      </h5>
                      <span className="text-sm text-green-400">
                        ≥ {settings.margin.warning}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Plenty of room to absorb adverse price moves. No
                      automated action runs at this level. The order
                      ticket will let you open more trades.
                    </p>
                  </div>

                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-yellow-400">
                        ⚠️ Warning
                      </h5>
                      <span className="text-sm text-yellow-400">
                        {settings.margin.marginCall}% –{" "}
                        {settings.margin.warning}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Your equity has dipped close to your used margin.
                      Position sizes start to feel heavy. Consider
                      reducing exposure or letting losers run only with
                      defined Stop Losses.
                    </p>
                  </div>

                  <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-orange-400">
                        🚨 Margin Call zone
                      </h5>
                      <span className="text-sm text-orange-400">
                        {settings.margin.liquidation}% –{" "}
                        {settings.margin.marginCall}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      You&apos;ve crossed below the margin-call line.
                      The trading UI will highlight your account in red
                      and the order ticket may{" "}
                      <strong className="text-white">block new trades</strong>{" "}
                      until you free up margin. Close losing trades or
                      tighten stops before the next tier kicks in.
                    </p>
                  </div>

                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-red-400">
                        ❌ Liquidation
                      </h5>
                      <span className="text-sm text-red-400">
                        &lt; {settings.margin.liquidation}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      The platform takes over — see the &quot;What
                      happens at liquidation&quot; block below for the
                      exact steps.
                    </p>
                  </div>
                </div>
              </div>

              {/* Monitoring + liquidation */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  Monitoring &amp; what happens at liquidation
                </h4>
                <ul className="space-y-1.5 text-sm text-gray-300 list-disc pl-5">
                  <li>
                    A background margin monitor evaluates every active
                    participant{" "}
                    <strong className="text-white">every minute</strong>
                    , and the price stream also evaluates margin in
                    real-time as quotes update on your chart.
                  </li>
                  <li>
                    When your margin level drops below{" "}
                    <strong className="text-red-300">
                      {settings.margin.liquidation}%
                    </strong>{" "}
                    the platform{" "}
                    <strong className="text-white">
                      automatically closes every open position you
                      have in that contest
                    </strong>{" "}
                    at the current market price.
                  </li>
                  <li>
                    Your participant record is flagged as{" "}
                    <code className="text-xs bg-gray-900 px-1.5 py-0.5 rounded">
                      liquidated
                    </code>{" "}
                    and you{" "}
                    <strong className="text-white">
                      cannot open new trades in the same
                      competition or 1v1
                    </strong>{" "}
                    afterwards.
                  </li>
                  <li>
                    You get an in-app notification immediately, plus a
                    second one if the competition&apos;s rules also{" "}
                    <strong className="text-white">
                      disqualify on liquidation
                    </strong>{" "}
                    (some competitions allow you to keep your final
                    balance and ranking, others mark you eliminated).
                  </li>
                  <li>
                    Liquidation is{" "}
                    <strong className="text-white">contest-scoped</strong>{" "}
                    — getting liquidated in one event does{" "}
                    <em>not</em> affect your wallet credits, your
                    profile stats, or your ability to join the next
                    competition or challenge.
                  </li>
                </ul>
              </div>

              {/* Stop Loss / Take Profit */}
              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4 text-cyan-400" />
                  Stop Loss &amp; Take Profit
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-red-400 text-sm mb-1">
                      Stop Loss (SL)
                    </p>
                    <p className="text-xs text-gray-400">
                      A price level that auto-closes the position at a
                      loss to cap your downside. Set it on the order
                      ticket or edit it on any open position.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-green-400 text-sm mb-1">
                      Take Profit (TP)
                    </p>
                    <p className="text-xs text-gray-400">
                      A price level that auto-closes the position at a
                      profit to lock in gains without watching the
                      chart.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  SL/TP triggers in real-time off the live price feed —
                  there is no &quot;reaction delay&quot; from a
                  background worker. When a level is hit, the position
                  is closed at the next available tick. Trading with SL
                  enabled is the single best protection against
                  liquidation.
                </p>
              </div>

              {/* Per-contest risk caps */}
              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-purple-400" />
                  Per-competition risk caps (optional)
                </h4>
                <p className="text-sm text-gray-400 mb-3">
                  Individual competitions can enable extra risk rules
                  on top of margin levels. When enabled, these are
                  checked <strong className="text-white">before</strong>{" "}
                  every order is placed — the platform will refuse the
                  trade rather than let you exceed the cap.
                </p>
                <div className="grid gap-2 text-sm">
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">Max drawdown.</strong>{" "}
                    A percentage of starting capital you&apos;re allowed
                    to lose on closed positions (e.g.{" "}
                    {settings.risk.maxDrawdown}% by default). Crossing
                    it blocks new orders for the rest of the contest.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Daily loss limit.
                    </strong>{" "}
                    A cap on realised losses since UTC midnight (e.g.{" "}
                    {settings.risk.dailyLossLimit}% by default). Resets
                    each new day.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Equity drawdown.
                    </strong>{" "}
                    Stricter rule that includes unrealised P&amp;L on
                    open positions — even paper losses count towards
                    the cap. Only enabled in competitions that
                    explicitly turn it on.
                  </div>
                </div>
              </div>

              {/* Position & leverage limits */}
              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-orange-400" />
                  Position &amp; leverage limits
                </h4>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">Leverage.</strong>{" "}
                    Configurable per contest. Platform default is{" "}
                    {settings.leverage.default}× with a maximum of{" "}
                    {settings.leverage.max}× and a minimum of{" "}
                    {settings.leverage.min}×. You can request a lower
                    leverage on the order ticket — the contest cap is
                    the ceiling, not a forced value.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Max open positions.
                    </strong>{" "}
                    By default up to{" "}
                    <strong className="text-white">
                      {settings.positions.maxOpen}
                    </strong>{" "}
                    open positions at once. Competitions can tighten
                    that cap further.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600 sm:col-span-2">
                    <strong className="text-white">Lot size.</strong>{" "}
                    Bounded by per-symbol min/max lot sizes plus a
                    safety cap of{" "}
                    {settings.positions.maxSize} lots per trade.
                    Symbol-specific limits always take priority — see
                    the order ticket for the live range when you pick a
                    pair.
                  </div>
                </div>
              </div>

              {/* Best practices */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">
                  🎓 Best practices
                </h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Always trade with a{" "}
                      <strong className="text-white">Stop Loss</strong>
                      . It is the cheapest insurance against a margin
                      call.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Aim to keep your margin level{" "}
                      <strong className="text-white">above{" "}
                      {settings.margin.warning}%</strong>{" "}
                      — drops below the warning band are a signal to
                      reduce, not to add.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Don&apos;t max-leverage to chase a podium.
                      Drawdown / daily-loss caps can lock you out of a
                      contest just as effectively as a liquidation.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Spread risk — keeping{" "}
                      <strong className="text-white">no more than {settings.positions.maxOpen}</strong>{" "}
                      positions open at a time helps you actually watch
                      each one. Treat it as a budget, not a target.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Before you join a competition, check its{" "}
                      <strong className="text-white">terms screen</strong>{" "}
                      — leverage cap, position cap, optional risk
                      limits and the &quot;disqualify on
                      liquidation&quot; flag are all shown there.
                    </span>
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
                ChartVolt protects you on two fronts: the{" "}
                <strong className="text-white">controls you own</strong>{" "}
                on your account (password, 2FA, KYC), and the{" "}
                <strong className="text-white">
                  automated platform integrity systems
                </strong>{" "}
                that keep competitions free of multi-accounting, mirror
                trading, and payment fraud. Both run quietly in the
                background so honest traders never have to think about
                them.
              </p>

              {/* Your own security controls */}
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-5">
                <h3 className="text-lg font-bold text-cyan-400 mb-3 flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Your account security controls
                </h3>
                <p className="text-sm text-gray-300 mb-3">
                  Manage all of these from{" "}
                  <Link
                    href="/profile?tab=settings"
                    className="text-cyan-400 hover:underline"
                  >
                    /profile?tab=settings
                  </Link>
                  .
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4 text-green-400" />
                      Two-Factor Authentication (2FA)
                    </p>
                    <p className="text-xs text-gray-400">
                      TOTP-based 2FA using any standard authenticator
                      app (Google Authenticator, Authy, 1Password,
                      etc.). Backup codes are issued at setup and there
                      is an email-OTP fallback if you lose your
                      authenticator.{" "}
                      <strong className="text-white">
                        Strongly recommended.
                      </strong>
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
                      <LogIn className="h-4 w-4 text-blue-400" />
                      Password
                    </p>
                    <p className="text-xs text-gray-400">
                      Minimum 8 characters, maximum 128. Passwords are
                      hashed with bcrypt server-side. Use a long,
                      unique passphrase you don&apos;t reuse anywhere
                      else.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-pink-400" />
                      Email is read-only
                    </p>
                    <p className="text-xs text-gray-400">
                      Your sign-in email cannot be changed from the
                      profile UI — a deliberate choice to prevent
                      account take-over. Contact support if you
                      genuinely need to update it.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4 text-emerald-400" />
                      Identity verification (KYC)
                    </p>
                    <p className="text-xs text-gray-400">
                      Required for withdrawals
                      {settings.kyc?.enabled &&
                        settings.kyc?.requiredAmount > 0 && (
                          <>
                            {" "}
                            at or above {settings.currency.symbol}
                            {settings.kyc.requiredAmount}
                          </>
                        )}
                      . Run the flow from the{" "}
                      <Link
                        href="/profile?tab=verification"
                        className="text-cyan-400 hover:underline"
                      >
                        Verification tab
                      </Link>{" "}
                      whenever you&apos;re ready.
                    </p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-400">
                  Card payments are handled end-to-end by a PCI-DSS
                  compliant payment processor — ChartVolt never sees or
                  stores your full card number. Repeated declined
                  payments temporarily pause new deposit attempts on
                  your account to protect against card-testing fraud.
                </div>
              </div>

              {/* Why we monitor */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5">
                <h3 className="text-lg font-bold text-green-400 mb-3">
                  ✅ Why we monitor accounts
                </h3>
                <p className="text-sm text-gray-300 mb-3">
                  Real prize pools are at stake in competitions and 1v1
                  challenges. To make every event fair, ChartVolt runs
                  background checks on the signals that typically come
                  with multi-accounting or collusion. This is standard
                  practice across competitive trading platforms — the
                  vast majority of users are never affected, and a flag
                  is a <strong>routine review, not an accusation</strong>
                  .
                </p>
                <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
                  <li>
                    Protects your prize pool from being diluted by
                    coordinated entries.
                  </li>
                  <li>
                    Keeps the leaderboard honest and the Score System
                    meaningful.
                  </li>
                  <li>
                    Catches payment fraud (chargebacks, card testing)
                    before it affects other users.
                  </li>
                  <li>
                    Required by our platform integrity policy and
                    payment-processor obligations.
                  </li>
                </ul>
              </div>

              {/* What our system checks */}
              <div>
                <h3 className="text-lg font-bold text-white mb-4">
                  🔍 What our system checks
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <h5 className="font-semibold text-blue-400 mb-2">
                      🖥️ Device recognition
                    </h5>
                    <p className="text-xs text-gray-400">
                      Each browser session generates a privacy-respecting
                      device fingerprint (no spyware, no personal data —
                      just an anonymised identifier). If the same device
                      is used to sign in to many different accounts, the
                      cluster is flagged for review.
                    </p>
                  </div>
                  <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                    <h5 className="font-semibold text-orange-400 mb-2">
                      💳 Payment verification
                    </h5>
                    <p className="text-xs text-gray-400">
                      The platform stores an anonymised card / payment
                      method fingerprint so the same card showing up on
                      multiple accounts is detected. ChartVolt never
                      sees your full card number; only the
                      processor&apos;s opaque fingerprint is used.
                    </p>
                  </div>
                  <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <h5 className="font-semibold text-yellow-400 mb-2">
                      🌐 IP &amp; network analysis
                    </h5>
                    <p className="text-xs text-gray-400">
                      We record the IP address at sign-up, sign-in and
                      deposit time. Known VPN, proxy and Tor exit nodes
                      are flagged because they make multi-accounting
                      easier — using one isn&apos;t a ban by itself,
                      but it may trigger additional review.
                    </p>
                  </div>
                  <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                    <h5 className="font-semibold text-purple-400 mb-2">
                      📊 Trading pattern review
                    </h5>
                    <p className="text-xs text-gray-400">
                      After every trade closes, the platform builds an
                      anonymised behavioural profile (preferred pairs,
                      typical hold times, hour-of-day, risk style). Two
                      accounts whose profiles are unusually similar, or
                      whose trades fire within seconds of each other on
                      the same pair, are flagged as possible mirror
                      trading or collusion.
                    </p>
                  </div>
                  <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
                    <h5 className="font-semibold text-cyan-400 mb-2">
                      🏆 Competition entry review
                    </h5>
                    <p className="text-xs text-gray-400">
                      When the same competition gets several entries
                      within minutes of each other from accounts that
                      were already linked by other signals, that
                      cluster is reviewed independently for each
                      competition.
                    </p>
                  </div>
                  <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                    <h5 className="font-semibold text-green-400 mb-2">
                      🪪 Identity verification (KYC)
                    </h5>
                    <p className="text-xs text-gray-400">
                      During KYC the platform checks that the same
                      identity document isn&apos;t already in use on
                      another account. Each real person should have
                      exactly one ChartVolt account.
                    </p>
                  </div>
                </div>
                <div className="mt-3 bg-gray-800/60 border border-gray-700 rounded-lg p-3 text-xs text-gray-400">
                  <strong className="text-white">What we don&apos;t do:</strong>{" "}
                  we don&apos;t record what you type, where your mouse
                  moves, what tabs you open, or what other sites you
                  visit. Nothing is shared with third parties for
                  advertising. The only signals we use are the ones
                  needed to keep competitions fair and payments safe.
                </div>
              </div>

              {/* What happens if flagged */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5">
                <h3 className="text-lg font-bold text-yellow-400 mb-3">
                  ⚠️ What happens if my account is flagged?
                </h3>
                <div className="space-y-3 text-sm">
                  <p className="text-gray-300">
                    If our system detects something that looks like
                    multi-accounting or coordination,{" "}
                    <strong>don&apos;t panic</strong> — it is a routine
                    review, not a verdict. Here&apos;s what happens:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-gray-400">
                    <li>
                      <strong className="text-white">
                        In-app notification.
                      </strong>{" "}
                      You&apos;ll see a security notice in your
                      notifications and on your dashboard explaining
                      that your account is being reviewed.
                    </li>
                    <li>
                      <strong className="text-white">Review period.</strong>{" "}
                      For most flags you can{" "}
                      <em>continue using the platform normally</em>{" "}
                      while the case is reviewed. If the flag is severe
                      enough to need temporary restrictions, you may be
                      blocked from one or more actions —{" "}
                      <strong className="text-white">trading</strong>,{" "}
                      <strong className="text-white">deposits</strong>,{" "}
                      <strong className="text-white">withdrawals</strong>{" "}
                      and{" "}
                      <strong className="text-white">
                        competition entries
                      </strong>{" "}
                      each have their own switch and can be applied
                      individually.
                    </li>
                    <li>
                      <strong className="text-white">Account Review page.</strong>{" "}
                      When any action is blocked, attempting it
                      redirects you to{" "}
                      <Link
                        href="/account/review"
                        className="text-yellow-400 hover:underline"
                      >
                        /account/review
                      </Link>
                      , which spells out what&apos;s on hold and how to
                      contact support. You can always sign in and view
                      your account.
                    </li>
                    <li>
                      <strong className="text-white">Resolution.</strong>{" "}
                      Common false positives (shared household Wi-Fi,
                      family payment method, traveling and switching
                      networks) get cleared by support after a quick
                      check. Once a case is closed in your favour, your
                      account is fully unblocked and the flag is
                      retired.
                    </li>
                    <li>
                      <strong className="text-white">Contact support.</strong>{" "}
                      Reach out at any time with context — the more
                      detail you give (relationship to other accounts
                      on your network, etc.) the faster a human can
                      clear it.
                    </li>
                  </ol>
                </div>
              </div>

              {/* What's not allowed */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
                <h3 className="text-lg font-bold text-red-400 mb-3">
                  🚫 What&apos;s not allowed
                </h3>
                <ul className="list-disc list-inside text-sm text-gray-400 space-y-2">
                  <li>
                    <strong className="text-white">
                      Multiple accounts.
                    </strong>{" "}
                    Each real person may only have one account.
                    Creating or operating multiples — including
                    &quot;backup&quot; accounts — is prohibited.
                  </li>
                  <li>
                    <strong className="text-white">
                      Account sharing.
                    </strong>{" "}
                    Don&apos;t hand over your credentials or let
                    somebody else trade on your behalf. Anything done
                    from your session is treated as you.
                  </li>
                  <li>
                    <strong className="text-white">Collusion.</strong>{" "}
                    Coordinating trades or competition entries with
                    another user to manipulate outcomes is prohibited.
                  </li>
                  <li>
                    <strong className="text-white">Mirror trading.</strong>{" "}
                    Running two accounts that open/close identical
                    trades in the same window is treated as collusion
                    even if you control both of them.
                  </li>
                  <li>
                    <strong className="text-white">VPN abuse.</strong>{" "}
                    Casual VPN use is fine; using one to disguise that
                    several accounts come from the same person — or to
                    bypass a restriction — is not.
                  </li>
                  <li>
                    <strong className="text-white">Document fraud.</strong>{" "}
                    Submitting forged, stolen, or third-party identity
                    documents at KYC results in a permanent ban.
                  </li>
                  <li>
                    <strong className="text-white">
                      Card-testing &amp; chargeback abuse.
                    </strong>{" "}
                    Cycling declined cards or filing fraudulent
                    chargebacks on legitimate deposits is treated as
                    payment fraud — see{" "}
                    <button
                      type="button"
                      onClick={() => scrollToSection("credits")}
                      className="text-red-300 hover:underline"
                    >
                      Credits &amp; Wallet
                    </button>{" "}
                    for the clawback flow.
                  </li>
                </ul>
              </div>

              {/* Consequences */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">
                  ⚖️ Consequences of violations
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <h5 className="font-semibold text-yellow-400 mb-1 text-center">
                      Warning &amp; Review
                    </h5>
                    <p className="text-xs text-gray-400 text-center">
                      Minor or first-time signals trigger a routine
                      review. You may keep using the platform while it
                      runs.
                    </p>
                  </div>
                  <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                    <h5 className="font-semibold text-orange-400 mb-1 text-center">
                      Restrictions
                    </h5>
                    <p className="text-xs text-gray-400 text-center">
                      Confirmed cases lead to{" "}
                      <strong className="text-white">temporary</strong>{" "}
                      restrictions — any combination of trading,
                      deposits, withdrawals, and competition entries
                      can be paused.
                    </p>
                  </div>
                  <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                    <h5 className="font-semibold text-red-400 mb-1 text-center">
                      Permanent Ban
                    </h5>
                    <p className="text-xs text-gray-400 text-center">
                      Severe or repeated violations result in a
                      permanent ban. Legitimate remaining funds can
                      still be released by support on request.
                    </p>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
                <h3 className="text-lg font-bold text-blue-400 mb-3">
                  💡 Tips to keep your account healthy
                </h3>
                <ul className="list-disc list-inside text-sm text-gray-400 space-y-2">
                  <li>
                    Turn on{" "}
                    <strong className="text-white">2FA</strong> as
                    soon as you can — it stops 99% of password-leak
                    attacks.
                  </li>
                  <li>
                    Stick to{" "}
                    <strong className="text-white">one account</strong>{" "}
                    per person; don&apos;t make &quot;backup&quot;
                    accounts.
                  </li>
                  <li>
                    Use your{" "}
                    <strong className="text-white">
                      own payment method
                    </strong>{" "}
                    for deposits and withdrawals.
                  </li>
                  <li>
                    If you share a household, a workplace or a college
                    network with another trader,{" "}
                    <strong className="text-white">
                      tell support proactively
                    </strong>{" "}
                    — flags resolve much faster when context is on
                    file.
                  </li>
                  <li>
                    Trade <strong className="text-white">independently</strong>{" "}
                    — don&apos;t coordinate entries, sizes, or close
                    times with friends in the same competition.
                  </li>
                  <li>
                    Submit your{" "}
                    <strong className="text-white">
                      own genuine documents
                    </strong>{" "}
                    at KYC, and keep them current if the platform asks
                    for re-verification.
                  </li>
                  <li>
                    Avoid VPNs when not strictly needed — they make
                    legitimate use look like the kind of thing the
                    fraud system flags.
                  </li>
                </ul>
              </div>

              {/* Support */}
              <div className="bg-gray-700/50 border border-gray-600 rounded-xl p-5 text-center">
                <h3 className="text-lg font-bold text-white mb-2">
                  Need help?
                </h3>
                <p className="text-sm text-gray-400 mb-3">
                  If your account has been flagged and you believe
                  it&apos;s a mistake, or if you have questions about
                  our security measures, reach out to support. We are
                  committed to resolving issues fairly and quickly —
                  most reviews end with the account fully cleared.
                </p>
                {isLoggedIn && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Link
                      href="/profile?tab=settings"
                      className="inline-block px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors font-medium text-sm"
                    >
                      Security settings
                    </Link>
                    <Link
                      href="/account/review"
                      className="inline-block px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 rounded-lg transition-colors font-medium text-sm"
                    >
                      Account Review
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Support & Messaging */}
          <section
            id="support"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <MessageSquare className="h-6 w-6 text-pink-400" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                💬 Support &amp; Messaging
              </h2>
            </div>

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                ChartVolt&apos;s entire messaging experience lives at
                one address:{" "}
                <Link
                  href="/messaging"
                  className="text-pink-400 hover:underline"
                >
                  /messaging
                </Link>
                . The same page is used to{" "}
                <strong className="text-white">talk to our support team</strong>{" "}
                (with an AI first responder and a real human behind it
                when needed) and to{" "}
                <strong className="text-white">
                  chat directly with other traders
                </strong>{" "}
                you&apos;ve connected with. You can open it from the{" "}
                <strong className="text-white">Messages</strong>{" "}
                sidebar entry, which shows a numeric badge whenever you
                have unread messages waiting.
              </p>

              <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-3 text-xs text-gray-300">
                <strong className="text-pink-300">Quick map:</strong>{" "}
                The left pane lists{" "}
                <strong className="text-white">
                  Support tickets &amp; chats
                </strong>{" "}
                (your conversations with us) and{" "}
                <strong className="text-white">Direct messages</strong>{" "}
                (your conversations with other traders). The right
                pane is the active thread. On mobile, the two panes
                stack and you tap a row to enter the thread.
              </div>

              {/* ───── Customer support ───── */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-pink-400" />
                  How customer support works
                </h3>

                {/* Two-stage model */}
                <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mb-3">
                  <p className="text-sm text-gray-300 mb-3">
                    Support is a{" "}
                    <strong className="text-white">two-stage system</strong>
                    : an AI assistant handles routine questions
                    instantly, and a human{" "}
                    <strong className="text-white">support agent</strong>{" "}
                    takes over the moment the conversation needs a real
                    person.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                      <p className="font-semibold text-cyan-300 text-sm mb-1 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Stage 1 — AI assistant
                      </p>
                      <p className="text-xs text-gray-400">
                        The first responder is an AI built on a curated
                        knowledge base of platform documentation, fees,
                        rules, and frequent procedures. It typically
                        answers in seconds, 24/7. You&apos;ll see an
                        AI tag on its replies — it never pretends to be
                        a person.
                      </p>
                    </div>
                    <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                      <p className="font-semibold text-pink-300 text-sm mb-1 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Stage 2 — Human agent
                      </p>
                      <p className="text-xs text-gray-400">
                        When a question is beyond &quot;how do I…&quot;
                        territory — payments, KYC edge cases, account
                        restrictions, refunds, disputes — a human agent
                        picks up the same thread. Their replies are
                        tagged with the agent&apos;s name.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Start a chat */}
                <div className="mb-3">
                  <h4 className="font-semibold text-white text-sm mb-2">
                    Starting a support chat
                  </h4>
                  <ol className="space-y-2 text-sm text-gray-300 list-decimal pl-5">
                    <li>
                      Open{" "}
                      <Link
                        href="/messaging"
                        className="text-pink-400 hover:underline"
                      >
                        /messaging
                      </Link>{" "}
                      and use the{" "}
                      <strong className="text-white">Contact Support</strong>{" "}
                      action above the conversation list. A new
                      conversation is created and routed to the AI by
                      default.
                    </li>
                    <li>
                      Type your question in plain language. Be
                      specific (the action you took, the page, any
                      transaction ID or error message). Concrete
                      details cut resolution time dramatically.
                    </li>
                    <li>
                      The AI replies in the same thread. If its
                      answer resolves your question, you&apos;re done.
                      You can re-open the ticket later by sending a
                      new message in the same thread.
                    </li>
                  </ol>
                </div>

                {/* Escalation */}
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 mb-3">
                  <h4 className="font-semibold text-white text-sm mb-2 flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-cyan-300" />
                    How a conversation reaches a human agent
                  </h4>
                  <p className="text-xs text-gray-300 mb-2">
                    Escalation is automatic — you don&apos;t need to
                    fill in a separate ticket form. It happens when
                    any one of these is true:
                  </p>
                  <ul className="space-y-1.5 text-xs text-gray-300 list-disc pl-5">
                    <li>
                      You explicitly ask for one. Phrases like{" "}
                      <code className="bg-gray-900 px-1.5 py-0.5 rounded">
                        human
                      </code>
                      ,{" "}
                      <code className="bg-gray-900 px-1.5 py-0.5 rounded">
                        agent
                      </code>
                      ,{" "}
                      <code className="bg-gray-900 px-1.5 py-0.5 rounded">
                        talk to someone
                      </code>
                      ,{" "}
                      <code className="bg-gray-900 px-1.5 py-0.5 rounded">
                        representative
                      </code>{" "}
                      flip the conversation to the human queue
                      immediately. (Just typing &quot;please&quot; is
                      not enough — be explicit.)
                    </li>
                    <li>
                      The conversation has reached the configured
                      maximum number of AI replies — usually around
                      ten. After that the AI hands off to a person
                      automatically, even if you didn&apos;t ask.
                    </li>
                    <li>
                      The AI is uncertain about its own answer (low
                      confidence). When the platform can tell the
                      reply might be wrong, it escalates instead of
                      guessing.
                    </li>
                  </ul>
                  <p className="text-xs text-gray-400 mt-2">
                    Once escalated, an internal notice is pushed to
                    the available agents in real-time so the next one
                    available can pick up. The AI stops replying on
                    that thread the moment a person takes over.
                  </p>
                </div>

                {/* Agent assignment */}
                <div className="mb-3">
                  <h4 className="font-semibold text-white text-sm mb-2">
                    How an agent gets assigned to you
                  </h4>
                  <p className="text-xs text-gray-300 mb-2">
                    Routing follows a clear priority order:
                  </p>
                  <ol className="space-y-1.5 text-xs text-gray-300 list-decimal pl-5">
                    <li>
                      <strong className="text-white">
                        Dedicated account manager.
                      </strong>{" "}
                      If you already have a relationship with a
                      specific agent (high-balance accounts, ongoing
                      cases, VIP traders), every new support thread
                      routes to that same agent so you don&apos;t have
                      to re-explain context.
                    </li>
                    <li>
                      <strong className="text-white">
                        Department queue.
                      </strong>{" "}
                      If no personal assignment exists, the
                      conversation enters the queue of any available
                      Back-office, Support Agent, or Full Admin who is
                      currently online and accepting chats.
                    </li>
                    <li>
                      <strong className="text-white">Sticky thread.</strong>{" "}
                      Once an agent replies in a thread, they
                      &quot;own&quot; it. Follow-up messages reach the
                      same agent until they hand the case off, the
                      ticket is resolved, or you reopen it later.
                    </li>
                  </ol>
                  <p className="text-xs text-gray-400 mt-2">
                    Agents can also{" "}
                    <strong className="text-white">transfer</strong>{" "}
                    your thread to a colleague better suited to the
                    case (e.g. payments → finance team). You&apos;ll
                    see a system note in the thread when that happens.
                  </p>
                </div>

                {/* What you see in the thread */}
                <div className="mb-3">
                  <h4 className="font-semibold text-white text-sm mb-2">
                    What you see inside a support thread
                  </h4>
                  <div className="grid gap-2 text-xs text-gray-300">
                    <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                      <strong className="text-white">Sender tag.</strong>{" "}
                      Each message is labelled — your name on your
                      messages, the AI tag on AI replies, the
                      agent&apos;s name on human replies, and{" "}
                      <em>system</em> for routing notes (escalation,
                      transfer, resolution).
                    </div>
                    <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                      <strong className="text-white">
                        Read receipts.
                      </strong>{" "}
                      Each message shows when it was delivered and
                      when the recipient read it.
                    </div>
                    <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                      <strong className="text-white">Attachments.</strong>{" "}
                      You can include images / screenshots and short
                      files when explaining a bug, a payment screen, a
                      KYC document issue, etc.
                    </div>
                    <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                      <strong className="text-white">
                        Ticket number.
                      </strong>{" "}
                      Every support thread carries a unique ticket
                      number so support can reference it across
                      e-mail, internal notes, and follow-ups.
                    </div>
                  </div>
                </div>

                {/* States */}
                <div className="mb-3">
                  <h4 className="font-semibold text-white text-sm mb-2">
                    Conversation states
                  </h4>
                  <div className="grid gap-2 text-xs text-gray-300">
                    <div className="p-2.5 bg-gray-700/40 rounded border border-green-500/30">
                      <strong className="text-green-300">Active.</strong>{" "}
                      The thread is open. Either the AI is currently
                      handling it, or it&apos;s in the human queue, or
                      an agent is actively responding.
                    </div>
                    <div className="p-2.5 bg-gray-700/40 rounded border border-gray-500/30">
                      <strong className="text-gray-300">Resolved / Archived.</strong>{" "}
                      An agent marked your case resolved. The full
                      transcript stays in your inbox; send a new
                      message in the same thread to re-open it.
                    </div>
                    <div className="p-2.5 bg-gray-700/40 rounded border border-gray-500/30">
                      <strong className="text-gray-300">Closed.</strong>{" "}
                      Long-inactive or administratively closed.
                      Open a fresh ticket via Contact Support if you
                      still need help.
                    </div>
                  </div>
                </div>

                {/* AI limitations */}
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <h4 className="font-semibold text-white text-sm mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-400" />
                    What the AI is good at — and what it isn&apos;t
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2 text-xs text-gray-300">
                    <div>
                      <p className="font-semibold text-green-300 mb-1">
                        Good at
                      </p>
                      <ul className="space-y-1 list-disc pl-5 text-gray-400">
                        <li>
                          Explaining platform rules (fees, limits,
                          leverage, market hours).
                        </li>
                        <li>
                          Walking you through where a feature lives.
                        </li>
                        <li>
                          Re-stating policy in plain language.
                        </li>
                        <li>Suggesting the right help section.</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-red-300 mb-1">
                        Not allowed to do
                      </p>
                      <ul className="space-y-1 list-disc pl-5 text-gray-400">
                        <li>
                          Touch your account (no balance adjustments,
                          no refunds, no KYC overrides).
                        </li>
                        <li>
                          Reveal someone else&apos;s data or your
                          full card / banking details.
                        </li>
                        <li>
                          Make commercial promises (fee waivers,
                          custom prizes).
                        </li>
                        <li>
                          Handle disputes — those always go to a human.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* ───── User to user messaging ───── */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <Users className="h-5 w-5 text-cyan-400" />
                  Chatting with other traders
                </h3>

                <p className="text-sm text-gray-300 mb-3">
                  Direct messages live in the same Messages inbox.
                  Each DM is a one-on-one thread between you and
                  another trader — there are no public chat rooms.
                </p>

                {/* Finding another trader */}
                <div className="mb-3">
                  <h4 className="font-semibold text-white text-sm mb-2">
                    Finding someone to chat with
                  </h4>
                  <ul className="space-y-1.5 text-sm text-gray-300 list-disc pl-5">
                    <li>
                      <strong className="text-white">
                        From the leaderboard
                      </strong>{" "}
                      — click any trader to open their Profile Card,
                      then use the Message / Add Friend buttons.
                    </li>
                    <li>
                      <strong className="text-white">From Match Cards</strong>{" "}
                      — every card has a quick action to start a
                      conversation or jump to the VS screen.
                    </li>
                    <li>
                      <strong className="text-white">
                        From an in-competition leaderboard
                      </strong>{" "}
                      — competitors you&apos;re racing against in a
                      live event.
                    </li>
                  </ul>
                </div>

                {/* Friend system */}
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 mb-3">
                  <h4 className="font-semibold text-white text-sm mb-2 flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-cyan-300" />
                    Friend requests &amp; the friends-only rule
                  </h4>
                  <ul className="space-y-1.5 text-xs text-gray-300 list-disc pl-5">
                    <li>
                      Some platforms require you to be{" "}
                      <strong className="text-white">friends</strong>{" "}
                      before DMs are allowed. When that rule is
                      enabled, trying to message a stranger first
                      sends them a{" "}
                      <strong className="text-white">friend request</strong>
                      ; once they accept, the thread opens.
                    </li>
                    <li>
                      You can{" "}
                      <strong className="text-white">
                        turn friend requests off
                      </strong>{" "}
                      altogether from{" "}
                      <Link
                        href="/profile?tab=settings"
                        className="text-cyan-400 hover:underline"
                      >
                        Profile → Settings → Privacy
                      </Link>{" "}
                      using the &quot;Allow friend requests&quot;
                      toggle. Your stats stay visible on the
                      leaderboard either way.
                    </li>
                    <li>
                      Pending and accepted requests appear in your
                      messaging sidebar, with notifications routed
                      through the bell icon.
                    </li>
                  </ul>
                </div>

                {/* Online presence */}
                <div className="mb-3">
                  <h4 className="font-semibold text-white text-sm mb-2">
                    Online presence &amp; availability
                  </h4>
                  <ul className="space-y-1.5 text-sm text-gray-300 list-disc pl-5">
                    <li>
                      A small dot beside someone&apos;s avatar shows
                      whether they are{" "}
                      <strong className="text-green-300">online</strong>{" "}
                      right now. Offline messages are queued and
                      delivered when they next sign in.
                    </li>
                    <li>
                      For 1v1 challenges, traders also expose an{" "}
                      <strong className="text-white">
                        accepting challenges
                      </strong>{" "}
                      flag — the same flag controls whether the
                      Challenge button in their thread is active.
                    </li>
                    <li>
                      Read receipts work both ways: you can see
                      when your message has been read, and they can
                      see when you have read theirs.
                    </li>
                  </ul>
                </div>

                {/* Safety */}
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <h4 className="font-semibold text-white text-sm mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-red-400" />
                    Block, report &amp; safety
                  </h4>
                  <ul className="space-y-1.5 text-xs text-gray-300 list-disc pl-5">
                    <li>
                      <strong className="text-white">Block.</strong>{" "}
                      From any DM thread you can block the other
                      trader — they stop appearing in your inbox,
                      they can&apos;t message you, and they can&apos;t
                      send you friend / challenge requests. You can
                      unblock at any time.
                    </li>
                    <li>
                      <strong className="text-white">
                        Report suspicious behaviour.
                      </strong>{" "}
                      If another trader is harassing you, trying to
                      coordinate trades, asking for credentials, or
                      offering to share an account, contact support
                      via the{" "}
                      <strong className="text-white">Contact Support</strong>{" "}
                      flow. Include the trader&apos;s username and
                      the relevant conversation — agents have
                      full-context tools to investigate.
                    </li>
                    <li>
                      <strong className="text-white">
                        Never share credentials, 2FA codes, or
                        document scans
                      </strong>{" "}
                      with another trader. Real support staff will
                      <em> never </em>ask for them either.
                    </li>
                  </ul>
                </div>
              </div>

              {/* ───── Real-time + notifications ───── */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <Bell className="h-5 w-5 text-yellow-400" />
                  How fast messages arrive &amp; how you&apos;re alerted
                </h3>
                <ul className="space-y-1.5 text-sm text-gray-300 list-disc pl-5">
                  <li>
                    Both support replies and DMs are pushed in{" "}
                    <strong className="text-white">real-time</strong>{" "}
                    over a persistent WebSocket connection — messages
                    arrive instantly while the app is open.
                  </li>
                  <li>
                    If the WebSocket drops (flaky network, sleeping
                    laptop), the app{" "}
                    <strong className="text-white">polls every few
                    seconds</strong>{" "}
                    as a fallback so nothing is missed.
                  </li>
                  <li>
                    The <strong className="text-white">Messages</strong>{" "}
                    sidebar entry shows an unread count badge. The
                    badge updates roughly every 10 seconds and
                    instantly when a message arrives.
                  </li>
                  <li>
                    New replies also surface in the{" "}
                    <button
                      type="button"
                      onClick={() => scrollToSection("notifications")}
                      className="text-pink-400 hover:underline"
                    >
                      🔔 Notification center
                    </button>
                    . You can mute the category, enable e-mail copies,
                    or set quiet hours from Profile → Notifications.
                  </li>
                </ul>
              </div>

              {/* CTA */}
              {isLoggedIn && (
                <div className="bg-gray-700/50 border border-gray-600 rounded-xl p-5 text-center">
                  <p className="text-sm text-gray-400 mb-3">
                    Need a hand or want to ping another trader? Open
                    the Messages inbox — the AI is usually a few
                    seconds away, and a human agent is one keyword away
                    if you need it.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Link
                      href="/messaging"
                      className="inline-block px-6 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors font-medium text-sm"
                    >
                      Open Messages
                    </Link>
                    <Link
                      href="/profile?tab=settings"
                      className="inline-block px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium text-sm border border-gray-600"
                    >
                      Privacy &amp; preferences
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Invoices & Billing */}
          <section
            id="invoices"
            className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 scroll-mt-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <FileText className="h-6 w-6 text-teal-500" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                📄 Invoices &amp; Billing
              </h2>
            </div>

            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Every time you successfully fund your wallet with{" "}
                {settings.currency.code}, the platform issues a
                tax-compliant invoice for that deposit, e-mails it to
                you with a PDF attached, and stores it on your account
                for download from the wallet. Internal{" "}
                <strong className="text-white">
                  {settings.credits.name}
                </strong>{" "}
                movements — competition entries, prize payouts,
                Marketplace buys, GM commissions, withdrawal refunds —
                do <em>not</em> generate a separate invoice; they live
                in your Transaction History instead.
              </p>

              {/* When invoices are issued */}
              <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-5">
                <h3 className="text-lg font-bold text-teal-300 mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  When you get an invoice
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-green-300 text-sm mb-1 flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Deposit invoices
                    </p>
                    <p className="text-xs text-gray-400">
                      Generated automatically the moment the payment
                      processor confirms a successful card payment.
                      The invoice is issued in your name with the
                      {" "}line-itemised breakdown of{" "}
                      {settings.credits.name} purchased, the optional
                      platform fee, and VAT where applicable.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                    <p className="font-semibold text-gray-300 text-sm mb-1 flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Withdrawals &amp; in-app spending
                    </p>
                    <p className="text-xs text-gray-400">
                      Withdrawals, competition entries, 1v1 stakes,
                      Marketplace purchases, GM commissions, and prize
                      payouts are recorded as wallet transactions with
                      a full audit trail in your{" "}
                      <button
                        type="button"
                        onClick={() => scrollToSection("credits")}
                        className="text-cyan-400 hover:underline"
                      >
                        Transaction History
                      </button>
                      , but they don&apos;t produce a separate
                      PDF invoice.
                    </p>
                  </div>
                </div>
              </div>

              {/* What's on the invoice */}
              <div>
                <h3 className="font-semibold text-white text-base mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-teal-300" />
                  What appears on a deposit invoice
                </h3>
                <div className="grid gap-2 text-xs text-gray-300">
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">Invoice header.</strong>{" "}
                    Title (e.g.{" "}
                    <code className="bg-gray-900 px-1 py-0.5 rounded">
                      INVOICE
                    </code>
                    ), invoice number, invoice date, and a{" "}
                    <span className="text-green-300 font-semibold">
                      PAID
                    </span>{" "}
                    status badge — invoices are issued after the
                    money settles, so they&apos;re always paid at
                    creation.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Seller block (&quot;From&quot;).
                    </strong>{" "}
                    Company legal name, address, country, registration
                    number, VAT number, support email, and optional
                    company logo. This block is a snapshot — it
                    reflects the company details on file at the moment
                    the invoice was issued.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Buyer block (&quot;Bill To&quot;).
                    </strong>{" "}
                    Your full name and account email. If you have
                    completed your{" "}
                    <button
                      type="button"
                      onClick={() => scrollToSection("profile")}
                      className="text-cyan-400 hover:underline"
                    >
                      profile address fields
                    </button>{" "}
                    (street, city, postal code, country), they appear
                    here too — so make sure they&apos;re correct
                    before depositing.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">Line items.</strong>{" "}
                    A primary line for the{" "}
                    {settings.credits.name} purchase (e.g.{" "}
                    <code className="bg-gray-900 px-1 py-0.5 rounded">
                      Credit Purchase — 100.00 Credits
                    </code>
                    ) with unit price in {settings.currency.code}. If a{" "}
                    <strong className="text-white">
                      platform processing fee
                    </strong>{" "}
                    is configured, it appears as its own line.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Subtotal, VAT, Total.
                    </strong>{" "}
                    Subtotal is the sum of all lines. VAT is added on
                    top (VAT-exclusive pricing). The grand total is
                    what your card was actually charged.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">Payment terms.</strong>{" "}
                    Spells out that the invoice was settled at
                    issuance.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Bank details (optional).
                    </strong>{" "}
                    If the company has bank details configured, they
                    appear at the foot of the invoice (useful for
                    accounting reconciliation).
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-600">
                    <strong className="text-white">
                      Legal &amp; thank-you footer.
                    </strong>{" "}
                    Configurable disclaimer text (VAT/B2B note,
                    contact details, etc.).
                  </div>
                </div>
              </div>

              {/* Currency + numbering */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                  <p className="font-semibold text-white text-sm mb-1">
                    Numbering &amp; series
                  </p>
                  <p className="text-xs text-gray-400">
                    Invoices use a single sequential counter with a
                    configurable prefix and zero-padding (e.g.{" "}
                    <code className="bg-gray-900 px-1 py-0.5 rounded">
                      INV-000123
                    </code>
                    ). The counter is incremented atomically, so two
                    deposits made at the same moment still get
                    distinct, in-order numbers.
                  </p>
                </div>
                <div className="p-3 bg-gray-700/40 rounded-lg border border-gray-600">
                  <p className="font-semibold text-white text-sm mb-1">
                    Currency
                  </p>
                  <p className="text-xs text-gray-400">
                    Invoices are issued in{" "}
                    <strong className="text-white">
                      {settings.currency.code}
                    </strong>
                    , the platform&apos;s native fiat currency. Card
                    payments in other currencies are converted by
                    your bank at their rate; the invoice always
                    reflects the {settings.currency.code} amount
                    settled to the platform.
                  </p>
                </div>
              </div>

              {/* Where to find it */}
              <div>
                <h3 className="font-semibold text-white text-base mb-3 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-teal-300" />
                  Where to find your invoices
                </h3>
                <ol className="space-y-2 text-sm text-gray-300 list-decimal pl-5">
                  <li>
                    <strong className="text-white">By email.</strong>{" "}
                    Each invoice is e-mailed to your account address
                    as soon as it&apos;s issued, with a PDF
                    attachment (generated with{" "}
                    <code className="text-[11px] bg-gray-900 px-1.5 py-0.5 rounded">
                      pdf-lib
                    </code>{" "}
                    — no third-party rendering, no tracking pixels).
                    The body summarises the totals and links back to
                    the wallet.
                  </li>
                  <li>
                    <strong className="text-white">
                      In Transaction History.
                    </strong>{" "}
                    On the{" "}
                    <Link
                      href="/wallet"
                      className="text-cyan-400 hover:underline"
                    >
                      wallet page
                    </Link>
                    , every completed deposit row exposes a small{" "}
                    <strong className="text-white">
                      View Invoice
                    </strong>{" "}
                    button that opens the full HTML invoice in a new
                    tab — ready to print or save to PDF from your
                    browser. Use the browser&apos;s &quot;Save as
                    PDF&quot; for a fresh PDF if you no longer have
                    the e-mail attachment.
                  </li>
                  <li>
                    <strong className="text-white">
                      By accountant request.
                    </strong>{" "}
                    If you need a re-issue (e.g. corrected name or
                    address, lost copy, B2B reverse charge), contact
                    support — admins can resend any invoice to your
                    e-mail.
                  </li>
                </ol>
              </div>

              {/* Status */}
              <div>
                <h3 className="font-semibold text-white text-base mb-3">
                  Invoice statuses
                </h3>
                <div className="grid gap-2 text-xs text-gray-300">
                  <div className="p-2.5 bg-gray-700/40 rounded border border-green-500/30">
                    <strong className="text-green-300">Paid.</strong>{" "}
                    Default state for newly issued invoices. The
                    deposit settled successfully.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-cyan-500/30">
                    <strong className="text-cyan-300">Sent.</strong>{" "}
                    The invoice e-mail with PDF attachment has been
                    delivered to your inbox. Set automatically after
                    the mailer reports success.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-gray-500/30">
                    <strong className="text-gray-300">Cancelled.</strong>{" "}
                    Admin-only state used in rare correction
                    scenarios (e.g. duplicate issuance or system
                    test). Cancelled invoices are no longer
                    accounting-valid.
                  </div>
                  <div className="p-2.5 bg-gray-700/40 rounded border border-orange-500/30">
                    <strong className="text-orange-300">Refunded.</strong>{" "}
                    The underlying deposit was refunded back to the
                    payment method. Reach out to support if you need
                    a separate refund document.
                  </div>
                </div>
              </div>

              {/* Snapshot + accuracy callout */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  Get your details right{" "}
                  <em>before</em> you deposit
                </h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Each invoice is a{" "}
                  <strong className="text-white">snapshot</strong>{" "}
                  of your name and address at the moment of issuance.
                  Updating your profile <em>after</em> a deposit does
                  not edit older invoices retroactively. If you need
                  a previously issued invoice corrected (legal name
                  change, address typo, missing line, etc.), support
                  will issue a corrected copy on request — but the
                  cleanest path is to complete the{" "}
                  <button
                    type="button"
                    onClick={() => scrollToSection("profile")}
                    className="text-cyan-400 hover:underline"
                  >
                    Profile → Settings
                  </button>{" "}
                  address fields before your next deposit.
                </p>
              </div>

              {/* Privacy / retention */}
              <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gray-300" />
                  Storage &amp; retention
                </h4>
                <ul className="space-y-1 text-xs text-gray-300 list-disc pl-5">
                  <li>
                    Invoice records (numbers, totals, line items,
                    customer + company snapshot) are stored on the
                    platform indefinitely — required for tax and
                    accounting compliance.
                  </li>
                  <li>
                    The HTML version is rendered live from that data
                    each time you click{" "}
                    <strong className="text-white">View Invoice</strong>
                    .
                  </li>
                  <li>
                    PDFs are generated on-demand at e-mail time and
                    are not retained as files on our servers; your
                    inbox copy and the &quot;Save as PDF&quot; from
                    the browser are the canonical local copies.
                  </li>
                </ul>
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
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                ❓ FAQ
              </h2>
            </div>

            <p className="text-sm text-gray-400 mb-5">
              Short answers to the questions support gets most often.
              Each topic links back to the deep-dive section above for
              the full picture.
            </p>

            <div className="space-y-6">
              {[
                {
                  title: "🚀 Getting started",
                  sectionId: "getting-started",
                  items: [
                    {
                      q: "Is this real-money trading?",
                      a: `No. All trading on ChartVolt is simulated against live market quotes — you cannot lose real money on a trade. The only real-money flow is buying ${settings.credits.name} with ${settings.currency.code} to pay competition / 1v1 entry fees, Marketplace purchases, and to receive prize payouts, all of which you can withdraw back to ${settings.currency.code}.`,
                    },
                    {
                      q: "Do I need to verify my email to use the platform?",
                      a: "You can browse and complete the Getting Started checklist without verifying, but verified email is required before you can enter competitions, accept 1v1 challenges, deposit, or withdraw. You'll see a banner with a one-click resend if your address is unverified.",
                    },
                    {
                      q: "Is the platform free to use?",
                      a: `Creating an account, demo trading and browsing competitions are free. Competitions and 1v1 challenges have entry fees in ${settings.credits.name}. Wallet deposits may include a configurable platform fee${
                        settings.payments &&
                        settings.payments.depositFeePercentage > 0
                          ? ` (currently ${settings.payments.depositFeePercentage}%)`
                          : ""
                      } and EU VAT where applicable.`,
                    },
                    {
                      q: "What devices do you support?",
                      a: "Any modern desktop or mobile browser. Charts and the order ticket are fully responsive. There is no mobile app yet — the web app is the supported surface.",
                    },
                  ],
                },
                {
                  title: `💰 Wallet, ${settings.credits.name} & payments`,
                  sectionId: "credits",
                  items: [
                    {
                      q: `How do I buy ${settings.credits.name}?`,
                      a: `Open the wallet (/wallet), click "Buy ${settings.credits.name}", enter an amount in ${settings.currency.code} (minimum ${settings.currency.symbol}${settings.credits.minimumDeposit}), then complete the secure card payment. At the current rate of ${settings.currency.symbol}1 = ${settings.credits.eurToCreditsRate} ${settings.credits.symbol}, ${settings.currency.symbol}${settings.credits.minimumDeposit} gives you ${(settings.credits.minimumDeposit * settings.credits.eurToCreditsRate).toLocaleString()} ${settings.credits.name}. ${settings.credits.name} are credited automatically the instant the processor confirms the charge.`,
                    },
                    {
                      q: "Why was my deposit declined?",
                      a: "Most declines come from your bank (insufficient funds, 3D-Secure failure, regional card restriction, suspected fraud). After 3 declined attempts within 10 minutes, ChartVolt temporarily pauses new deposit attempts on your account for an hour to protect you from card-testing fraud. Try a different card, contact your bank, or wait and retry.",
                    },
                    {
                      q: "Can I withdraw my winnings?",
                      a: `Yes. Open the wallet, click "Withdraw", enter at least ${settings.currency.symbol}${settings.credits.minimumWithdrawal}. The dialog shows the fee (default ${settings.credits.withdrawalFee}%), the net payout, and the available payout method — usually a refund to the card you deposited from, or a manual bank transfer if a card refund isn't possible. Withdrawals move through pending → approved → processing → completed.`,
                    },
                    {
                      q: "Why can't I withdraw right now?",
                      a: "A withdrawal request can be blocked by: pending KYC, an active competition or 1v1 with locked stakes, a recent deposit still inside the hold period, an active account restriction, the daily/monthly withdrawal cap, or a cooldown between requests. The withdrawal dialog tells you exactly which rule is blocking the request.",
                    },
                    {
                      q: `Do ${settings.credits.name} expire?`,
                      a: `No. Wallet balances stay yours until you spend them, withdraw them, or close your account. There is no inactivity fee.`,
                    },
                    {
                      q: "Will I be charged VAT?",
                      a: settings.vat?.enabled
                        ? `VAT is charged only when your country is in the EU AND the operating company is in the EU AND VAT is enabled (currently ${settings.vat.percentage}%). It applies only to the credit purchase line — not to the platform processing fee. The deposit dialog always shows the VAT amount before you confirm.`
                        : "VAT is not currently being collected. If applicable rules change, the deposit dialog will always show any VAT amount before you confirm.",
                    },
                    {
                      q: "Where can I get my invoices?",
                      a: "Every successful deposit generates a tax-compliant invoice, e-mailed to you with a PDF attachment. You can also re-open the HTML version from the Transaction History row on the wallet page (look for the View Invoice icon). Withdrawals, in-app spending, and prizes don't generate separate invoices — they're tracked in Transaction History.",
                    },
                  ],
                },
                {
                  title: "🏆 Competitions",
                  sectionId: "competitions",
                  items: [
                    {
                      q: "How do I enter a competition?",
                      a: "Open /competitions, pick one, accept the terms, and pay the entry fee. The platform checks your email verification, restrictions, registration deadline, and balance — if anything blocks you, the dialog says so. After entering, you trade with the contest's starting virtual capital, separate from your real wallet.",
                    },
                    {
                      q: "What ranks me in a competition?",
                      a: "It depends on the competition's ranking method (P&L, ROI %, etc.) shown on the terms screen. Live ranking updates while the contest runs; the final ranking applies tie-breakers (e.g. higher win-rate, lower drawdown) and platform fees before the prize pool is paid out.",
                    },
                    {
                      q: "Do I keep the virtual capital after the competition?",
                      a: "No. Virtual capital is contest-scoped — it resets every time you enter. Your real wallet only changes through entry fees in, and prize payouts out, in your wallet currency.",
                    },
                    {
                      q: "Can I leave a competition I've joined?",
                      a: "No, entry is final once paid. You can stop trading, but your entry fee is not refunded except in narrow admin-handled cases (e.g. a competition is cancelled before it starts).",
                    },
                    {
                      q: "What happens if I'm the last one trading?",
                      a: "Some competitions allow the last remaining active participant to trigger an early finalization. When eligible, a Claim Early End button appears on the competition page.",
                    },
                  ],
                },
                {
                  title: "⚔️ 1v1 Challenges",
                  sectionId: "challenges",
                  items: [
                    {
                      q: "How does a 1v1 challenge work?",
                      a: "You create or accept a 1v1 against a specific trader. Both sides put up an equal stake. You each trade the same virtual capital for the agreed duration. Whoever has the higher P&L at the deadline wins the combined pot (minus the platform fee). If a challenge is never accepted, it expires and your stake is refunded.",
                    },
                    {
                      q: "Can I challenge anyone?",
                      a: "Only traders who are online and have accepting challenges turned on. You'll see their availability badge on Match Cards and on their Profile Card. Send the challenge from the VS screen; they have a limited window to accept before it expires.",
                    },
                    {
                      q: "What if my opponent declines or never responds?",
                      a: "Declined or expired challenges return your stake to your wallet automatically as a challenge_declined or challenge_expired transaction.",
                    },
                    {
                      q: "Are draws possible?",
                      a: "Yes, when both sides finish with identical scoring metrics. The platform follows the configured tie policy (typically refund-both or split-pot minus the fee).",
                    },
                  ],
                },
                {
                  title: "📈 Trading & Risk",
                  sectionId: "trading",
                  items: [
                    {
                      q: "When is the market open?",
                      a: "Forex pairs are open 24/5 (Sunday 22:00 UTC → Friday 22:00 UTC, broker-defined). Outside those hours, the order ticket is disabled and the chart shows a market-closed banner. Some symbols may have additional maintenance windows.",
                    },
                    {
                      q: "Can I change my leverage?",
                      a: `Leverage is configurable per competition. The platform default is ${settings.leverage.default}× with a maximum of ${settings.leverage.max}× and a minimum of ${settings.leverage.min}×. Some competitions tighten this. You can request a lower leverage on the order ticket — the contest cap is the ceiling, not a forced value.`,
                    },
                    {
                      q: "How many positions can I open?",
                      a: `By default up to ${settings.positions.maxOpen} simultaneous open positions per contest. Some competitions tighten this further. Pending orders count against the cap once they trigger.`,
                    },
                    {
                      q: "What happens if I get liquidated?",
                      a: `When your margin level drops below ${settings.margin.liquidation}%, the platform automatically closes every open position in that contest at market and flags your participant record as liquidated. You cannot open new trades in the same competition / 1v1 after that. Whether liquidation also disqualifies you from prizes depends on each competition's rules.`,
                    },
                    {
                      q: "Will my Stop Loss / Take Profit actually fire?",
                      a: "Yes — SL and TP triggers off the live price feed in real time as quotes update. There is no worker-delay or polling gap. When a level is hit, the position is closed at the next available tick. Trading with SL set is the single best protection against liquidation.",
                    },
                    {
                      q: "Does it cost anything to keep a position open overnight?",
                      a: "No. ChartVolt does not charge swap / overnight financing on simulated positions. Spread is the only cost baked into each trade, applied at open and close from the live feed.",
                    },
                  ],
                },
                {
                  title: "🛒 Marketplace & Game Master",
                  sectionId: "marketplace",
                  items: [
                    {
                      q: "Are Marketplace purchases refundable?",
                      a: `${settings.credits.name} purchases are generally final once delivered. Refunds are handled by support on a case-by-case basis (e.g. an item is broken or the purchase was an obvious mistake captured within a short window).`,
                    },
                    {
                      q: "What happens to my indicators if my Game Master pack expires?",
                      a: "Indicators and strategies you bought as separate Marketplace items stay yours forever. GM packages, on the other hand, expire and need to be renewed from the Arsenal tab, the Game Master page, or the Marketplace card.",
                    },
                    {
                      q: "How do I renew an expired Game Master pack?",
                      a: "Either click Renew on the GM card in /profile?tab=arsenal, click Renew now on /gamemaster, or open the same GM package in the Marketplace and use the Renew button. Your GM Dashboard reappears in the sidebar the moment the renewal completes — no page refresh needed.",
                    },
                    {
                      q: "Do I get commission as a Game Master?",
                      a: "Yes — every competition and 1v1 you create earns a configurable referral commission on entries from your referred traders, credited to your wallet as gamemaster_earning / gamemaster_challenge_referral transactions.",
                    },
                  ],
                },
                {
                  title: "🗺️ Journey, Badges & Trader Levels",
                  sectionId: "journey",
                  items: [
                    {
                      q: "Do badges expire?",
                      a: "No, badges are permanent. Once earned, they stay on your profile forever and XP only goes up.",
                    },
                    {
                      q: "What gives me XP?",
                      a: "Five sources, all feeding the same XP pool: earning badges (XP per rarity), completing Journey milestones, closing trades, finishing competitions, and finishing 1v1 challenges. The XP bar on your Overview tab is the single source of truth.",
                    },
                    {
                      q: "Why don't I see a badge for my first deposit / first trade?",
                      a: `Because "first X" achievements are handled by Journey milestones, not the standalone Badge System — to avoid duplication. Open /profile?tab=journey to see them.`,
                    },
                    {
                      q: "How does my level affect my account?",
                      a: "Level is mostly a display of your progression — the title that shows up on your profile, Profile Card, leaderboard, and chat. Some Journey milestones and Marketplace items can have a minimum-level requirement, but most platform features (trading, competitions, 1v1s, withdrawals) don't gate on level.",
                    },
                    {
                      q: "Can I lose XP?",
                      a: "No. XP is non-decreasing — badges can't be revoked through normal play, so XP only accumulates. The level under your avatar can only go up.",
                    },
                  ],
                },
                {
                  title: "💖 Match Cards & Social",
                  sectionId: "matchmaking",
                  items: [
                    {
                      q: "How does Match Cards pick opponents for me?",
                      a: "The matchmaking engine builds a score from a few factors: similar trader level, similar trading style (pairs, hold time, risk), recent activity, and online availability. You see the top reasons your match was selected on each card.",
                    },
                    {
                      q: "Why does someone appear as offline / unavailable?",
                      a: 'Either they\'re currently signed out, or they have "accepting challenges" turned off in their settings. Cards still let you view their profile but the Challenge button is disabled.',
                    },
                    {
                      q: "Can I turn off Match Cards entirely?",
                      a: "You can stop appearing in matchmaking by toggling off your acceptance setting on the profile, or by privacy options that suppress friend requests. Your stats remain visible on the leaderboard either way.",
                    },
                  ],
                },
                {
                  title: "👤 Profile, KYC & Security",
                  sectionId: "profile",
                  items: [
                    {
                      q: "Can I change my email?",
                      a: "Not from the Settings UI — sign-in email is intentionally read-only to prevent account take-over. Contact support if you genuinely need to update it; we'll verify ownership of both addresses first.",
                    },
                    {
                      q: "Do I have to do KYC?",
                      a: settings.kyc?.enabled
                        ? `Yes, when you reach a gated action. KYC is required ${
                            settings.kyc.requiredForDeposit
                              ? "before deposits"
                              : ""
                          }${
                            settings.kyc.requiredForDeposit &&
                            settings.kyc.requiredForWithdrawal
                              ? " and "
                              : ""
                          }${
                            settings.kyc.requiredForWithdrawal
                              ? "before your first withdrawal"
                              : ""
                          }${
                            settings.kyc.requiredAmount > 0
                              ? ` for amounts at or above ${settings.currency.symbol}${settings.kyc.requiredAmount}`
                              : ""
                          }. The flow uses Veriff, takes about 5 minutes, and your raw documents stay with Veriff — never on our servers.`
                        : "KYC is not currently required on this platform. If that changes, you'll be prompted to verify when you next try a gated action.",
                    },
                    {
                      q: "How long does KYC take?",
                      a: "Usually a few minutes after you submit. During peak times it can take up to a few hours. The Verification tab polls automatically and the status flips from Pending → Approved (or Resubmission / Declined) the moment Veriff returns a decision.",
                    },
                    {
                      q: "What if my KYC is declined?",
                      a: "Most declines are resolvable (blurry document, glare, expired ID, unsupported country). The page tells you whether you can retry directly or whether you need to contact support. You have a limited number of attempts before support has to intervene.",
                    },
                    {
                      q: "Do I have to enable 2FA?",
                      a: "Not required, but strongly recommended. TOTP-based 2FA stops 99% of password-leak takeovers. Setup is in Profile → Settings → Two-Factor Authentication, with backup codes you can regenerate and an email-OTP fallback if you lose your authenticator.",
                    },
                    {
                      q: "Why was my account flagged for a security review?",
                      a: "Our automated systems spotted a signal that needs a routine check — shared device or payment method with another account, an IP/VPN pattern, or an unusual coordination of competition entries. Most flags clear quickly. You can use the platform normally during the review unless a specific action is paused.",
                    },
                    {
                      q: "Can I use a VPN?",
                      a: "Casual VPN use is fine but may trigger an extra review, especially if it's combined with other signals (different device, different country, etc.). Using a VPN to disguise multi-accounting or bypass a restriction is not allowed.",
                    },
                    {
                      q: "My household member also trades here — will we both get flagged?",
                      a: "Possibly, because you share IP / device cookies. Tell support proactively that you share a household — flags resolve dramatically faster when context is on file.",
                    },
                    {
                      q: "What happens if I'm caught multi-accounting?",
                      a: "Confirmed multi-accounting leads to temporary or permanent restrictions on a per-action basis (trading, deposits, withdrawals, competition entries can each be paused independently). Severe / repeated violations result in a permanent ban; legitimate remaining funds can still be released by support on request.",
                    },
                  ],
                },
                {
                  title: "💸 Chargebacks & disputes",
                  sectionId: "credits",
                  items: [
                    {
                      q: "What happens if I file a chargeback on a deposit?",
                      a: "ChartVolt records a chargeback_clawback against your wallet for the disputed amount, opens an internal case, and cross-links your deposit's invoice as evidence. Your account may be restricted while the case is reviewed by both your bank and our team. If the chargeback is found legitimate the funds are released to your bank; if it's reversed in our favour, the clawback stays in place.",
                    },
                    {
                      q: "Will a chargeback affect my account?",
                      a: "Yes — fraudulent chargebacks are treated as payment fraud. Confirmed cases lead to a permanent ban. If you have a legitimate dispute, contact support before filing with your bank — most issues resolve faster that way.",
                    },
                  ],
                },
                {
                  title: "🔔 Notifications",
                  sectionId: "notifications",
                  items: [
                    {
                      q: "Why didn't I get an email for that notification?",
                      a: "Email delivery follows your preferences in Profile → Notifications. Email is opt-in per category; the bell-icon in-app feed is always real-time for challenges and polled every ~30s for everything else.",
                    },
                    {
                      q: "Can I turn off competition or 1v1 popups?",
                      a: "Yes — open Profile → Notifications → Preferences. You can mute by category (Competitions, Challenges, Marketplace, etc.), turn off the master switch, set quiet hours, or disable the on-screen challenge popup specifically.",
                    },
                  ],
                },
              ].map((group) => (
                <div key={group.sectionId} className="space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b border-gray-700 pb-1">
                    <h3 className="text-base font-bold text-white">
                      {group.title}
                    </h3>
                    <button
                      type="button"
                      onClick={() => scrollToSection(group.sectionId)}
                      className="text-xs text-purple-300 hover:text-purple-200 hover:underline whitespace-nowrap"
                    >
                      Open full section →
                    </button>
                  </div>
                  {group.items.map((faq, index) => (
                    <details
                      key={`${group.sectionId}-${index}`}
                      className="group p-4 bg-gray-700/40 rounded-lg border border-gray-600 open:bg-gray-700/60 open:border-purple-500/30 transition-colors"
                    >
                      <summary className="flex items-start justify-between gap-3 cursor-pointer list-none">
                        <span className="font-semibold text-white text-sm">
                          {faq.q}
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0 transition-transform group-open:rotate-90" />
                      </summary>
                      <p className="text-sm text-gray-300 leading-relaxed mt-3">
                        {faq.a}
                      </p>
                    </details>
                  ))}
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
