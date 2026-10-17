/**
 * Landing page templates 1-5: Trading & Competition focused
 * Reason: Split into separate files to stay under 500-line limit per file.
 * Each template has unique copy, visual identity, and a pexelsSearchQuery
 * used by the seed service to fetch a hero background image from Pexels.
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
  /** Pexels search query used to auto-fetch a hero background during seeding */
  pexelsSearchQuery: string;
}

// ─── Template 1: Trading Arena ────────────────────────────────────────────
export const TEMPLATE_TRADING_ARENA: TemplateDefinition = {
  slug: "trading-arena",
  name: "Trading Arena",
  description:
    "High-energy competition landing page with dark theme and neon accents",
  category: "competition",
  thumbnailGradient:
    "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
  previewColors: {
    primary: "#8b5cf6",
    accent: "#06b6d4",
    background: "#0f0c29",
  },
  pexelsSearchQuery: "trading competition esports neon screens",
  sections: [
    {
      id: "hero-1",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "Enter the Trading Arena",
        subheadline:
          "Compete against the world's best traders in real-time competitions. Prove your skills on live markets, climb the leaderboard, and walk away a champion.",
        ctaText: "Join the Arena — It's Free",
        ctaLink: "/sign-up",
        badge: "🏆 Live Trading Competitions",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
      },
    },
    {
      id: "stats-1",
      type: "stats",
      order: 1,
      enabled: true,
      content: {
        headline: "The Numbers Speak",
        items: [
          { value: "50,000+", label: "Active Traders", icon: "Users" },
          { value: "€2M+", label: "Prizes Distributed", icon: "Trophy" },
          { value: "500+", label: "Competitions Hosted", icon: "Target" },
          { value: "24/7", label: "Live Markets", icon: "Activity" },
        ],
      },
    },
    {
      id: "features-1",
      type: "features",
      order: 2,
      enabled: true,
      content: {
        headline: "Why Thousands Choose Our Arena",
        items: [
          {
            icon: "Zap",
            title: "Lightning-Fast Execution",
            description:
              "Sub-second order execution powered by institutional-grade infrastructure. No requotes, no slippage on entries.",
          },
          {
            icon: "Shield",
            title: "Zero Financial Risk",
            description:
              "Trade with virtual capital on real market data. Hone your strategy without ever risking your savings.",
          },
          {
            icon: "Trophy",
            title: "Real Prizes, Real Glory",
            description:
              "Top performers earn withdrawable credit rewards, exclusive badges, and their name on the all-time leaderboard.",
          },
          {
            icon: "BarChart3",
            title: "Professional-Grade Charts",
            description:
              "50+ indicators, multi-timeframe analysis, and drawing tools trusted by institutional traders worldwide.",
          },
        ],
      },
    },
    {
      id: "how-1",
      type: "how-it-works",
      order: 3,
      enabled: true,
      content: {
        headline: "From Sign-Up to Victory in 4 Steps",
        steps: [
          {
            step: 1,
            title: "Create Your Free Account",
            description:
              "Sign up in under 60 seconds with just your email. No credit card, no deposits, no catch.",
            icon: "UserPlus",
          },
          {
            step: 2,
            title: "Choose Your Battleground",
            description:
              "Browse dozens of live competitions — from 5-minute sprints to week-long marathons — and pick your arena.",
            icon: "Trophy",
          },
          {
            step: 3,
            title: "Trade on Live Markets",
            description:
              "Execute trades on real-time forex, crypto, and index data. Your P&L is tracked on the live leaderboard.",
            icon: "TrendingUp",
          },
          {
            step: 4,
            title: "Claim Your Rewards",
            description:
              "Finish in the prize zone and earn credits, badges, and bragging rights you can share anywhere.",
            icon: "Gift",
          },
        ],
      },
    },
    {
      id: "testimonials-1",
      type: "testimonials",
      order: 4,
      enabled: true,
      content: {
        headline: "Hear From Our Champions",
        items: [
          {
            name: "Alex M.",
            role: "Day Trader · Berlin",
            quote:
              "The competition format completely transformed my trading discipline. I won my first tournament within a month and haven't looked back since.",
            rating: 5,
          },
          {
            name: "Sarah K.",
            role: "Forex Enthusiast · London",
            quote:
              "I finally found a platform where I can pressure-test strategies against real competition — without putting my savings at risk. Absolutely love it.",
            rating: 5,
          },
          {
            name: "Marcus R.",
            role: "Pro Trader · Singapore",
            quote:
              "The live equity curve tracking and real-time leaderboard make every single competition pulse-pounding. It's the closest thing to a trading adrenaline rush.",
            rating: 5,
          },
        ],
      },
    },
    {
      id: "cta-1",
      type: "cta",
      order: 5,
      enabled: true,
      content: {
        headline: "Ready to Prove Your Trading Skills?",
        subheadline:
          "Join 50,000+ traders competing for real prizes every single day. Your next victory is one click away.",
        ctaText: "Start Trading Now",
        ctaLink: "/sign-up",
        secondaryCtaText: "View Active Competitions",
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
  previewColors: {
    primary: "#f7931a",
    accent: "#8b5cf6",
    background: "#0a0a0a",
  },
  pexelsSearchQuery: "cryptocurrency bitcoin digital gold",
  sections: [
    {
      id: "hero-2",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "The Ultimate Crypto Trading Challenge",
        subheadline:
          "Trade BTC, ETH, SOL, and 100+ altcoins in head-to-head competitions. No bots, no luck — just pure crypto trading skill.",
        ctaText: "Accept the Challenge",
        ctaLink: "/sign-up",
        badge: "₿ Crypto Trading Competitions",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #0a0a0a 0%, #1a0533 50%, #0a0a0a 100%)",
      },
    },
    {
      id: "stats-2",
      type: "stats",
      order: 1,
      enabled: true,
      content: {
        headline: "Crypto Arena Stats",
        items: [
          { value: "100+", label: "Crypto Pairs", icon: "Coins" },
          { value: "€500K+", label: "Monthly Prizes", icon: "Trophy" },
          { value: "10,000+", label: "Crypto Traders", icon: "Users" },
          { value: "<1s", label: "Execution Speed", icon: "Zap" },
        ],
      },
    },
    {
      id: "features-2",
      type: "features",
      order: 2,
      enabled: true,
      content: {
        headline: "Purpose-Built for Crypto Traders",
        items: [
          {
            icon: "Bitcoin",
            title: "Every Major & Alt Pair",
            description:
              "Trade BTC, ETH, SOL, ADA, DOGE, and 100+ crypto pairs with real-time data from top-tier exchanges.",
          },
          {
            icon: "Lock",
            title: "Bank-Grade Security",
            description:
              "Enterprise encryption, 2FA authentication, and zero custody risk — your credentials are always safe.",
          },
          {
            icon: "LineChart",
            title: "Pro-Level Charting",
            description:
              "TradingView-quality candlestick charts with crypto-specific indicators like VWAP, Order Flow, and Funding Rate.",
          },
          {
            icon: "Flame",
            title: "24/7 Non-Stop Markets",
            description:
              "Crypto never sleeps — neither do we. Compete around the clock from any timezone on the planet.",
          },
        ],
      },
    },
    {
      id: "how-2",
      type: "how-it-works",
      order: 3,
      enabled: true,
      content: {
        headline: "Three Steps to Crypto Glory",
        steps: [
          {
            step: 1,
            title: "Create Your Free Account",
            description:
              "Quick signup with email verification. You'll be trading within 2 minutes.",
            icon: "UserPlus",
          },
          {
            step: 2,
            title: "Pick Your Challenge",
            description:
              "Choose from BTC-only, ETH-only, or multi-crypto challenges that match your expertise and risk appetite.",
            icon: "Target",
          },
          {
            step: 3,
            title: "Trade & Win",
            description:
              "Outperform your rivals on live crypto data and claim your spot on the leaderboard. Winners take all.",
            icon: "Crown",
          },
        ],
      },
    },
    {
      id: "faq-2",
      type: "faq",
      order: 4,
      enabled: true,
      content: {
        headline: "Crypto Challenge FAQ",
        items: [
          {
            question: "Do I need to own cryptocurrency to participate?",
            answer:
              "No! You trade with virtual credits on real-time crypto prices. No wallet, no deposits, no financial risk.",
          },
          {
            question: "Which crypto pairs are available?",
            answer:
              "We offer BTC/USD, ETH/USD, SOL/USD, ADA/USD, DOGE/USD, and 100+ pairs with real-time exchange data.",
          },
          {
            question: "How are winners determined?",
            answer:
              "Rankings are based on percentage P&L over the competition period. All results are transparent and verifiable.",
          },
        ],
      },
    },
    {
      id: "cta-2",
      type: "cta",
      order: 5,
      enabled: true,
      content: {
        headline: "The Crypto Arena Is Waiting",
        subheadline:
          "New challenges launch every hour. The next one starts in minutes — will you be in it?",
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
  description:
    "Professional forex-focused design with clean, authoritative feel",
  category: "trading",
  thumbnailGradient:
    "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0ea5e9 100%)",
  previewColors: {
    primary: "#0ea5e9",
    accent: "#22d3ee",
    background: "#0f172a",
  },
  pexelsSearchQuery: "forex currency exchange financial district",
  sections: [
    {
      id: "hero-3",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "Master the Forex Markets",
        subheadline:
          "Join an elite community of forex traders. Compete on EUR/USD, GBP/USD, and 28+ major currency pairs with institutional-grade execution and analytics.",
        ctaText: "Start Your Journey",
        ctaLink: "/sign-up",
        badge: "📊 Professional Forex Platform",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
      },
    },
    {
      id: "stats-3",
      type: "stats",
      order: 1,
      enabled: true,
      content: {
        headline: "Platform Performance",
        items: [
          { value: "28+", label: "Forex Pairs", icon: "Globe" },
          { value: "0.1 pip", label: "Tight Spreads", icon: "TrendingDown" },
          { value: "99.97%", label: "Platform Uptime", icon: "CheckCircle" },
          { value: "150+", label: "Countries Served", icon: "Map" },
        ],
      },
    },
    {
      id: "features-3",
      type: "features",
      order: 2,
      enabled: true,
      content: {
        headline: "Institutional-Grade Trading Experience",
        items: [
          {
            icon: "Globe",
            title: "28+ Currency Pairs",
            description:
              "Trade all major, minor, and exotic forex pairs with spreads as tight as 0.1 pips on EUR/USD.",
          },
          {
            icon: "BarChart3",
            title: "Advanced Analytics Suite",
            description:
              "Equity curves, drawdown analysis, Sharpe ratio tracking, and detailed trade scoring after every session.",
          },
          {
            icon: "Users",
            title: "Skill-Based Matchmaking",
            description:
              "Our smart algorithm matches you against traders at your level — ensuring fair, competitive, and rewarding contests.",
          },
          {
            icon: "Award",
            title: "Verifiable Track Record",
            description:
              "Earn cryptographically verified performance certificates you can share with brokers, fund managers, or your community.",
          },
        ],
      },
    },
    {
      id: "how-3",
      type: "how-it-works",
      order: 3,
      enabled: true,
      content: {
        headline: "Your Path to Forex Mastery",
        steps: [
          {
            step: 1,
            title: "Register for Free",
            description:
              "Professional accounts with instant access to all 28+ forex pairs and competition features.",
            icon: "UserPlus",
          },
          {
            step: 2,
            title: "Choose Your Arena",
            description:
              "Daily, weekly, or monthly competitions across all forex pairs — from EUR/USD sprints to multi-pair marathons.",
            icon: "Calendar",
          },
          {
            step: 3,
            title: "Prove Your Edge",
            description:
              "Trade live institutional data, build your verifiable track record, and earn your place among the Masters.",
            icon: "Award",
          },
        ],
      },
    },
    {
      id: "faq-3",
      type: "faq",
      order: 4,
      enabled: true,
      content: {
        headline: "Frequently Asked Questions",
        items: [
          {
            question: "Is it completely free to join?",
            answer:
              "Yes! Account creation is 100% free. Some premium competitions may have small entry fees that fund the prize pool.",
          },
          {
            question: "Am I trading with real money?",
            answer:
              "You trade with virtual credits on live institutional market data. Prizes won in competitions can be withdrawn as real money.",
          },
          {
            question: "What forex pairs are available?",
            answer:
              "We offer 28+ pairs including all majors (EUR/USD, GBP/USD, USD/JPY), minors (EUR/GBP, AUD/NZD), and select exotics.",
          },
          {
            question: "How are winners ranked?",
            answer:
              "Winners are ranked by percentage P&L over the competition period. All results are verified, transparent, and auditable.",
          },
        ],
      },
    },
    {
      id: "cta-3",
      type: "cta",
      order: 5,
      enabled: true,
      content: {
        headline: "Join the Elite",
        subheadline:
          "Where discipline meets opportunity. Your forex mastery journey starts with a single click.",
        ctaText: "Create Your Free Account",
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
  previewColors: {
    primary: "#e2b53f",
    accent: "#f59e0b",
    background: "#1a1a2e",
  },
  pexelsSearchQuery: "luxury gold finance executive office",
  sections: [
    {
      id: "hero-4",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "Trade Like a Professional",
        subheadline:
          "Access the same tools, data feeds, and analytics used by hedge fund managers. Compete in exclusive elite tournaments with substantial prize pools.",
        ctaText: "Go Pro Today",
        ctaLink: "/sign-up",
        badge: "👑 Elite Trading Experience",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      },
    },
    {
      id: "features-4",
      type: "features",
      order: 1,
      enabled: true,
      content: {
        headline: "The Professional Edge",
        items: [
          {
            icon: "Crown",
            title: "VIP-Only Tournaments",
            description:
              "Exclusive high-stakes competitions reserved for proven traders. Bigger pools, fiercer competition, greater glory.",
          },
          {
            icon: "TrendingUp",
            title: "Institutional Analytics Suite",
            description:
              "Risk metrics, win probability curves, Monte Carlo simulation, equity heatmaps, and performance attribution analysis.",
          },
          {
            icon: "Shield",
            title: "Verified & Certified",
            description:
              "Every trade is cryptographically logged. Build a verifiable performance record recognized by industry professionals.",
          },
          {
            icon: "Gem",
            title: "Premium Rewards Program",
            description:
              "Exclusive Diamond-tier badges, priority customer support, early access to features, and invitation-only events.",
          },
        ],
      },
    },
    {
      id: "stats-4",
      type: "stats",
      order: 2,
      enabled: true,
      content: {
        headline: "Elite Performance Metrics",
        items: [
          { value: "Top 1%", label: "Trader Community", icon: "Crown" },
          { value: "€1M+", label: "Annual Prize Pools", icon: "Coins" },
          { value: "5-Star", label: "Platform Rating", icon: "Star" },
          { value: "<1ms", label: "Execution Latency", icon: "Zap" },
        ],
      },
    },
    {
      id: "testimonials-4",
      type: "testimonials",
      order: 3,
      enabled: true,
      content: {
        headline: "What Elite Traders Say",
        items: [
          {
            name: "Richard H.",
            role: "Hedge Fund Analyst · New York",
            quote:
              "The analytics suite rivals what I use at work. The competition format keeps me sharp. This is the real deal.",
            rating: 5,
          },
          {
            name: "Jennifer L.",
            role: "Portfolio Manager · Hong Kong",
            quote:
              "I've been trading for 15 years. This platform's performance attribution tools are genuinely world-class. Highly recommended.",
            rating: 5,
          },
        ],
      },
    },
    {
      id: "cta-4",
      type: "cta",
      order: 4,
      enabled: true,
      content: {
        headline: "Elevate Your Trading to the Next Level",
        subheadline:
          "The elite compete here. The question is: are you ready to join them?",
        ctaText: "Get Started Now",
        ctaLink: "/sign-up",
        secondaryCtaText: "View Prize Pools",
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
  thumbnailGradient:
    "linear-gradient(135deg, #020617 0%, #059669 50%, #0d9488 100%)",
  previewColors: {
    primary: "#059669",
    accent: "#14b8a6",
    background: "#020617",
  },
  pexelsSearchQuery: "stock market screens data technology",
  sections: [
    {
      id: "hero-5",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "Feel the Market Pulse",
        subheadline:
          "Real-time data. Real-time competition. Trade forex, crypto, and indices with institutional live market feeds and compete for global recognition.",
        ctaText: "Start Trading Live",
        ctaLink: "/sign-up",
        badge: "📈 Real-Time Market Data",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #020617 0%, #0a2540 100%)",
      },
    },
    {
      id: "features-5",
      type: "features",
      order: 1,
      enabled: true,
      content: {
        headline: "Live Market Intelligence at Your Fingertips",
        items: [
          {
            icon: "Activity",
            title: "Sub-Second Price Feeds",
            description:
              "Institutional-grade data with sub-second latency. See every tick, every move, before the market leaves you behind.",
          },
          {
            icon: "BarChart3",
            title: "Interactive Charts",
            description:
              "Candlestick, area, and line charts with 50+ technical indicators. Multi-timeframe analysis from 1m to monthly.",
          },
          {
            icon: "Bell",
            title: "Intelligent Alerts",
            description:
              "Price alerts, competition start notifications, and real-time result updates — never miss an opportunity.",
          },
          {
            icon: "Smartphone",
            title: "Trade From Anywhere",
            description:
              "Fully responsive platform optimized for desktop, tablet, and mobile. Your arena travels with you.",
          },
        ],
      },
    },
    {
      id: "how-5",
      type: "how-it-works",
      order: 2,
      enabled: true,
      content: {
        headline: "Plug In & Compete",
        steps: [
          {
            step: 1,
            title: "Connect",
            description:
              "Sign up and instantly connect to live market data from institutional providers.",
            icon: "Wifi",
          },
          {
            step: 2,
            title: "Analyze",
            description:
              "Use 50+ pro-grade technical indicators to identify high-probability setups.",
            icon: "Search",
          },
          {
            step: 3,
            title: "Execute",
            description:
              "Place trades in milliseconds on real-time forex, crypto, and index markets.",
            icon: "Zap",
          },
          {
            step: 4,
            title: "Dominate",
            description:
              "Outperform the competition and climb the global leaderboard to earn prizes and recognition.",
            icon: "Trophy",
          },
        ],
      },
    },
    {
      id: "stats-5",
      type: "stats",
      order: 3,
      enabled: true,
      content: {
        headline: "Platform Performance",
        items: [
          { value: "<100ms", label: "Data Latency", icon: "Zap" },
          { value: "50+", label: "Indicators", icon: "BarChart3" },
          { value: "100+", label: "Instruments", icon: "Layers" },
          { value: "99.9%", label: "Uptime SLA", icon: "CheckCircle" },
        ],
      },
    },
    {
      id: "cta-5",
      type: "cta",
      order: 4,
      enabled: true,
      content: {
        headline: "Don't Miss a Single Beat",
        subheadline:
          "Markets move fast. The fastest traders win. Plug in now and feel the pulse.",
        ctaText: "Join Now — Free",
        ctaLink: "/sign-up",
      },
    },
  ],
};
