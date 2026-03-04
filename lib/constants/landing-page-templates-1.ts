/**
 * Landing page templates 1-5: Trading & Competition focused
 * Reason: Split into separate files to stay under 500-line limit per file.
 */
import type { ILPSection } from "@/database/models/landing-page-template.model";

export interface TemplateDefinition {
  slug: string;
  name: string;
  description: string;
  category: "trading" | "competition" | "crypto" | "general";
  thumbnailGradient: string;
  previewColors: { primary: string; accent: string; background: string };
  sections: ILPSection[];
}

// ─── Template 1: Trading Arena ────────────────────────────────────────────
export const TEMPLATE_TRADING_ARENA: TemplateDefinition = {
  slug: "trading-arena",
  name: "Trading Arena",
  description: "High-energy competition landing page with dark theme and neon accents",
  category: "competition",
  thumbnailGradient: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
  previewColors: { primary: "#8b5cf6", accent: "#06b6d4", background: "#0f0c29" },
  sections: [
    {
      id: "hero-1", type: "hero", order: 0, enabled: true,
      content: {
        headline: "Enter the Trading Arena",
        subheadline: "Compete against the world's best traders in real-time competitions. Prove your skills, climb the leaderboard, and win big.",
        ctaText: "Join Now — It's Free",
        ctaLink: "/sign-up",
        badge: "🏆 Live Trading Competitions",
        backgroundGradient: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
      },
    },
    {
      id: "stats-1", type: "stats", order: 1, enabled: true,
      content: {
        items: [
          { value: "50,000+", label: "Active Traders", icon: "Users" },
          { value: "€2M+", label: "Prizes Distributed", icon: "Trophy" },
          { value: "500+", label: "Competitions Hosted", icon: "Target" },
          { value: "24/7", label: "Live Markets", icon: "Activity" },
        ],
      },
    },
    {
      id: "features-1", type: "features", order: 2, enabled: true,
      content: {
        headline: "Why Trade With Us?",
        items: [
          { icon: "Zap", title: "Real-Time Execution", description: "Lightning-fast order execution with live market data and zero requotes." },
          { icon: "Shield", title: "Risk-Free Competitions", description: "Trade with virtual credits — real skills, zero financial risk." },
          { icon: "Trophy", title: "Win Real Prizes", description: "Top performers earn real credit rewards they can withdraw." },
          { icon: "BarChart3", title: "Advanced Charts", description: "Professional charting tools with 50+ technical indicators." },
        ],
      },
    },
    {
      id: "how-1", type: "how-it-works", order: 3, enabled: true,
      content: {
        headline: "How It Works",
        steps: [
          { step: 1, title: "Sign Up Free", description: "Create your account in under 60 seconds. No credit card required.", icon: "UserPlus" },
          { step: 2, title: "Join a Competition", description: "Pick from dozens of live competitions matching your skill level.", icon: "Trophy" },
          { step: 3, title: "Trade & Compete", description: "Execute trades on real market data and climb the leaderboard.", icon: "TrendingUp" },
          { step: 4, title: "Win Prizes", description: "Top performers earn credits, badges, and exclusive rewards.", icon: "Gift" },
        ],
      },
    },
    {
      id: "testimonials-1", type: "testimonials", order: 4, enabled: true,
      content: {
        headline: "What Traders Say",
        items: [
          { name: "Alex M.", role: "Day Trader", quote: "The competition format pushed me to become a much better trader. Won my first tournament within a month!", rating: 5 },
          { name: "Sarah K.", role: "Forex Enthusiast", quote: "Finally a platform where I can test strategies against real competition without risking my savings.", rating: 5 },
          { name: "Marcus R.", role: "Pro Trader", quote: "The real-time leaderboard and live equity tracking make every competition incredibly exciting.", rating: 5 },
        ],
      },
    },
    {
      id: "cta-1", type: "cta", order: 5, enabled: true,
      content: {
        headline: "Ready to Prove Your Trading Skills?",
        subheadline: "Join thousands of traders competing for real prizes. Your next victory is one click away.",
        ctaText: "Start Trading Now",
        ctaLink: "/sign-up",
        secondaryCtaText: "View Competitions",
        secondaryCtaLink: "/competitions",
      },
    },
  ],
};

// ─── Template 2: Crypto Challenge ─────────────────────────────────────────
export const TEMPLATE_CRYPTO_CHALLENGE: TemplateDefinition = {
  slug: "crypto-challenge",
  name: "Crypto Challenge",
  description: "Bitcoin and crypto-focused landing with dynamic energy",
  category: "crypto",
  thumbnailGradient: "linear-gradient(135deg, #f7931a 0%, #4a1d96 100%)",
  previewColors: { primary: "#f7931a", accent: "#8b5cf6", background: "#0a0a0a" },
  sections: [
    {
      id: "hero-2", type: "hero", order: 0, enabled: true,
      content: {
        headline: "The Ultimate Crypto Trading Challenge",
        subheadline: "Trade BTC, ETH, and top altcoins in head-to-head competitions. Show the crypto world what you're made of.",
        ctaText: "Accept the Challenge",
        ctaLink: "/sign-up",
        badge: "₿ Crypto Trading Competitions",
        backgroundGradient: "linear-gradient(135deg, #0a0a0a 0%, #1a0533 50%, #0a0a0a 100%)",
      },
    },
    {
      id: "stats-2", type: "stats", order: 1, enabled: true,
      content: {
        items: [
          { value: "100+", label: "Crypto Pairs", icon: "Coins" },
          { value: "€500K+", label: "Monthly Prizes", icon: "Trophy" },
          { value: "10K+", label: "Crypto Traders", icon: "Users" },
          { value: "<1s", label: "Execution Speed", icon: "Zap" },
        ],
      },
    },
    {
      id: "features-2", type: "features", order: 2, enabled: true,
      content: {
        headline: "Built for Crypto Traders",
        items: [
          { icon: "Bitcoin", title: "Major & Alt Pairs", description: "Trade BTC, ETH, SOL, and 100+ crypto pairs with real-time data." },
          { icon: "Lock", title: "Secure Platform", description: "Enterprise-grade security with encrypted credentials and 2FA." },
          { icon: "LineChart", title: "Pro Charting", description: "TradingView-quality charts with crypto-specific indicators." },
          { icon: "Flame", title: "24/7 Markets", description: "Crypto never sleeps — compete around the clock, worldwide." },
        ],
      },
    },
    {
      id: "how-2", type: "how-it-works", order: 3, enabled: true,
      content: {
        headline: "Start in 3 Steps",
        steps: [
          { step: 1, title: "Create Account", description: "Quick signup with email verification. Start in minutes.", icon: "UserPlus" },
          { step: 2, title: "Pick Your Challenge", description: "Choose from BTC, ETH, or multi-crypto challenges.", icon: "Target" },
          { step: 3, title: "Trade & Win", description: "Outperform rivals and claim your crypto trading crown.", icon: "Crown" },
        ],
      },
    },
    {
      id: "cta-2", type: "cta", order: 4, enabled: true,
      content: {
        headline: "The Crypto Arena Awaits",
        subheadline: "New challenges launch daily. Don't miss your shot at the leaderboard.",
        ctaText: "Join the Challenge",
        ctaLink: "/sign-up",
      },
    },
  ],
};

// ─── Template 3: Forex Masters ────────────────────────────────────────────
export const TEMPLATE_FOREX_MASTERS: TemplateDefinition = {
  slug: "forex-masters",
  name: "Forex Masters",
  description: "Professional forex-focused design with clean, authoritative feel",
  category: "trading",
  thumbnailGradient: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0ea5e9 100%)",
  previewColors: { primary: "#0ea5e9", accent: "#22d3ee", background: "#0f172a" },
  sections: [
    {
      id: "hero-3", type: "hero", order: 0, enabled: true,
      content: {
        headline: "Master the Forex Markets",
        subheadline: "Join a community of elite forex traders. Compete on live EUR/USD, GBP/USD, and 28+ major pairs with institutional-grade tools.",
        ctaText: "Start Your Journey",
        ctaLink: "/sign-up",
        badge: "📊 Professional Forex Platform",
        backgroundGradient: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
      },
    },
    {
      id: "stats-3", type: "stats", order: 1, enabled: true,
      content: {
        items: [
          { value: "28+", label: "Forex Pairs", icon: "Globe" },
          { value: "0.1", label: "Pip Spreads", icon: "TrendingDown" },
          { value: "99.9%", label: "Uptime", icon: "CheckCircle" },
          { value: "150+", label: "Countries", icon: "Map" },
        ],
      },
    },
    {
      id: "features-3", type: "features", order: 2, enabled: true,
      content: {
        headline: "Institutional-Grade Trading",
        items: [
          { icon: "Globe", title: "28+ Currency Pairs", description: "Trade all major, minor, and exotic forex pairs with tight spreads." },
          { icon: "BarChart3", title: "Advanced Analytics", description: "Equity curves, drawdown analysis, and Sharpe ratio tracking." },
          { icon: "Users", title: "Skill-Based Matching", description: "Compete against traders at your level with our smart matchmaking." },
          { icon: "Award", title: "Certified Rankings", description: "Earn verifiable trading performance certificates." },
        ],
      },
    },
    {
      id: "how-3", type: "how-it-works", order: 3, enabled: true,
      content: {
        headline: "Your Path to Mastery",
        steps: [
          { step: 1, title: "Register Free", description: "Professional accounts with instant access to all features.", icon: "UserPlus" },
          { step: 2, title: "Choose Your Arena", description: "Daily, weekly, or monthly competitions across all forex pairs.", icon: "Calendar" },
          { step: 3, title: "Prove Your Edge", description: "Trade live markets and build your verifiable track record.", icon: "Award" },
        ],
      },
    },
    {
      id: "faq-3", type: "faq", order: 4, enabled: true,
      content: {
        headline: "Frequently Asked Questions",
        items: [
          { question: "Is it free to join?", answer: "Yes! Creating an account is completely free. Some competitions may have entry fees that go into the prize pool." },
          { question: "Do I trade with real money?", answer: "You trade with virtual credits on real market data. Prizes won can be withdrawn as real money." },
          { question: "What forex pairs are available?", answer: "We offer 28+ pairs including all majors (EUR/USD, GBP/USD, etc.), minors, and select exotics." },
          { question: "How are winners determined?", answer: "Winners are ranked by P&L percentage over the competition period. Verified and transparent." },
        ],
      },
    },
    {
      id: "cta-3", type: "cta", order: 5, enabled: true,
      content: {
        headline: "Join the Elite",
        subheadline: "Where skill meets opportunity. Start your forex mastery journey today.",
        ctaText: "Create Free Account",
        ctaLink: "/sign-up",
      },
    },
  ],
};

// ─── Template 4: Pro Trader Elite ─────────────────────────────────────────
export const TEMPLATE_PRO_TRADER: TemplateDefinition = {
  slug: "pro-trader-elite",
  name: "Pro Trader Elite",
  description: "Premium, gold-themed VIP experience for serious traders",
  category: "trading",
  thumbnailGradient: "linear-gradient(135deg, #1a1a2e 0%, #e2b53f 100%)",
  previewColors: { primary: "#e2b53f", accent: "#f59e0b", background: "#1a1a2e" },
  sections: [
    {
      id: "hero-4", type: "hero", order: 0, enabled: true,
      content: {
        headline: "Trade Like a Professional",
        subheadline: "Access the same tools and market data used by institutional traders. Compete in elite tournaments with substantial prize pools.",
        ctaText: "Go Pro Today",
        ctaLink: "/sign-up",
        badge: "👑 Elite Trading Experience",
        backgroundGradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      },
    },
    {
      id: "features-4", type: "features", order: 1, enabled: true,
      content: {
        headline: "The Professional Edge",
        items: [
          { icon: "Crown", title: "VIP Competitions", description: "Exclusive high-stakes tournaments with premium prize pools." },
          { icon: "TrendingUp", title: "Pro Analytics Suite", description: "Risk metrics, win probability, equity curves, and performance scoring." },
          { icon: "Shield", title: "Verified Track Record", description: "Your performance is cryptographically verified and shareable." },
          { icon: "Gem", title: "Premium Rewards", description: "Exclusive badges, rankings, and recognition for top performers." },
        ],
      },
    },
    {
      id: "stats-4", type: "stats", order: 2, enabled: true,
      content: {
        items: [
          { value: "Top 1%", label: "Trader Community", icon: "Crown" },
          { value: "€1M+", label: "Prize Pools", icon: "Coins" },
          { value: "5-Star", label: "Platform Rating", icon: "Star" },
          { value: "0ms", label: "Execution Lag", icon: "Zap" },
        ],
      },
    },
    {
      id: "cta-4", type: "cta", order: 3, enabled: true,
      content: {
        headline: "Elevate Your Trading",
        subheadline: "Join the elite. Compete at the highest level.",
        ctaText: "Get Started",
        ctaLink: "/sign-up",
        secondaryCtaText: "View Prizes",
        secondaryCtaLink: "/competitions",
      },
    },
  ],
};

// ─── Template 5: Market Pulse ─────────────────────────────────────────────
export const TEMPLATE_MARKET_PULSE: TemplateDefinition = {
  slug: "market-pulse",
  name: "Market Pulse",
  description: "Live market data theme with tech-forward design",
  category: "trading",
  thumbnailGradient: "linear-gradient(135deg, #020617 0%, #059669 50%, #0d9488 100%)",
  previewColors: { primary: "#059669", accent: "#14b8a6", background: "#020617" },
  sections: [
    {
      id: "hero-5", type: "hero", order: 0, enabled: true,
      content: {
        headline: "Feel the Market Pulse",
        subheadline: "Real-time data. Real-time competition. Trade forex, crypto, and indices with live market feeds and compete for glory.",
        ctaText: "Start Trading Live",
        ctaLink: "/sign-up",
        badge: "📈 Real-Time Market Data",
        backgroundGradient: "linear-gradient(135deg, #020617 0%, #0a2540 100%)",
      },
    },
    {
      id: "features-5", type: "features", order: 1, enabled: true,
      content: {
        headline: "Live Market Intelligence",
        items: [
          { icon: "Activity", title: "Live Price Feeds", description: "Sub-second price updates from institutional-grade data providers." },
          { icon: "BarChart3", title: "Interactive Charts", description: "Candlestick, area, and line charts with 50+ indicators." },
          { icon: "Bell", title: "Smart Alerts", description: "Get notified of market moves, competition starts, and results." },
          { icon: "Smartphone", title: "Trade Anywhere", description: "Fully responsive platform — trade from any device, anytime." },
        ],
      },
    },
    {
      id: "how-5", type: "how-it-works", order: 2, enabled: true,
      content: {
        headline: "Plug In & Compete",
        steps: [
          { step: 1, title: "Connect", description: "Sign up and connect to live market data instantly.", icon: "Wifi" },
          { step: 2, title: "Analyze", description: "Use pro-grade tools to spot opportunities.", icon: "Search" },
          { step: 3, title: "Execute", description: "Place trades in milliseconds on live markets.", icon: "Zap" },
          { step: 4, title: "Win", description: "Beat the competition and climb the global leaderboard.", icon: "Trophy" },
        ],
      },
    },
    {
      id: "cta-5", type: "cta", order: 3, enabled: true,
      content: {
        headline: "Don't Miss a Beat",
        subheadline: "Markets move fast. So should you.",
        ctaText: "Join Now — Free",
        ctaLink: "/sign-up",
      },
    },
  ],
};
