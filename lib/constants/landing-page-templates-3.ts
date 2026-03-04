/**
 * Landing page templates 11-15: Diverse themes
 */
import type { TemplateDefinition } from "./landing-page-templates-1";

// ─── Template 11: Profit Race ─────────────────────────────────────────────
export const TEMPLATE_PROFIT_RACE: TemplateDefinition = {
  slug: "profit-race",
  name: "Profit Race",
  description: "Fast-paced racing theme with speedometer visuals",
  category: "competition",
  thumbnailGradient: "linear-gradient(135deg, #0f172a 0%, #22c55e 50%, #16a34a 100%)",
  previewColors: { primary: "#22c55e", accent: "#86efac", background: "#0f172a" },
  sections: [
    {
      id: "hero-11", type: "hero", order: 0, enabled: true,
      content: {
        headline: "The Profit Race Is On",
        subheadline: "Fastest P&L wins. Real-time equity tracking shows every trader's progress. Sprint to the finish line and claim the prize.",
        ctaText: "Join the Race",
        ctaLink: "/sign-up",
        badge: "🏎️ Speed Trading Competitions",
        backgroundGradient: "linear-gradient(135deg, #0f172a 0%, #052e16 100%)",
      },
    },
    {
      id: "stats-11", type: "stats", order: 1, enabled: true,
      content: {
        items: [
          { value: "5min", label: "Fastest Race", icon: "Timer" },
          { value: "Live", label: "Equity Tracking", icon: "Activity" },
          { value: "€25K+", label: "Daily Prizes", icon: "Coins" },
          { value: "Instant", label: "Results", icon: "Zap" },
        ],
      },
    },
    {
      id: "features-11", type: "features", order: 2, enabled: true,
      content: {
        headline: "Speed. Precision. Victory.",
        items: [
          { icon: "Gauge", title: "Real-Time P&L Tracker", description: "Watch your equity move in real-time against all competitors." },
          { icon: "Timer", title: "Multiple Race Durations", description: "From 5-minute sprints to 24-hour marathons." },
          { icon: "Trophy", title: "Instant Payouts", description: "Prizes credited instantly when the race ends." },
          { icon: "Repeat", title: "Non-Stop Races", description: "New races start every few minutes. Always one to join." },
        ],
      },
    },
    {
      id: "cta-11", type: "cta", order: 3, enabled: true,
      content: {
        headline: "On Your Marks...",
        subheadline: "The next race starts in minutes. Don't miss the green light.",
        ctaText: "Race Now",
        ctaLink: "/sign-up",
      },
    },
  ],
};

// ─── Template 12: Smart Trading ───────────────────────────────────────────
export const TEMPLATE_SMART_TRADING: TemplateDefinition = {
  slug: "smart-trading",
  name: "Smart Trading",
  description: "AI/analytics theme with data visualization emphasis",
  category: "trading",
  thumbnailGradient: "linear-gradient(135deg, #0f172a 0%, #3b82f6 50%, #2563eb 100%)",
  previewColors: { primary: "#3b82f6", accent: "#60a5fa", background: "#0f172a" },
  sections: [
    {
      id: "hero-12", type: "hero", order: 0, enabled: true,
      content: {
        headline: "Trade Smarter, Not Harder",
        subheadline: "Advanced analytics, performance insights, and data-driven competition. Use intelligence to gain your edge in every trade.",
        ctaText: "Get Smart Access",
        ctaLink: "/sign-up",
        badge: "🧠 Data-Driven Trading",
        backgroundGradient: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
      },
    },
    {
      id: "features-12", type: "features", order: 1, enabled: true,
      content: {
        headline: "Intelligence at Your Fingertips",
        items: [
          { icon: "Brain", title: "Performance Analytics", description: "Win rate, risk/reward ratio, Sharpe ratio — know your numbers." },
          { icon: "BarChart3", title: "Equity Curves", description: "Track your growth over time with detailed equity visualizations." },
          { icon: "Target", title: "Trade Scoring", description: "Every trade scored on timing, risk management, and execution." },
          { icon: "Lightbulb", title: "Strategy Insights", description: "Discover which strategies work best in different market conditions." },
        ],
      },
    },
    {
      id: "how-12", type: "how-it-works", order: 2, enabled: true,
      content: {
        headline: "Data-Driven Success",
        steps: [
          { step: 1, title: "Analyze", description: "Study your performance metrics and identify patterns.", icon: "Search" },
          { step: 2, title: "Optimize", description: "Refine your strategy based on data, not gut feeling.", icon: "Settings" },
          { step: 3, title: "Execute", description: "Trade with confidence backed by analytics.", icon: "Zap" },
          { step: 4, title: "Dominate", description: "Rise through the ranks as a data-driven champion.", icon: "Crown" },
        ],
      },
    },
    {
      id: "cta-12", type: "cta", order: 3, enabled: true,
      content: {
        headline: "Let Data Be Your Edge",
        subheadline: "Smart traders win more. Start analyzing today.",
        ctaText: "Join Free",
        ctaLink: "/sign-up",
      },
    },
  ],
};

// ─── Template 13: Money Moves ─────────────────────────────────────────────
export const TEMPLATE_MONEY_MOVES: TemplateDefinition = {
  slug: "money-moves",
  name: "Money Moves",
  description: "Urban, trendy dark/gold theme for the modern trader",
  category: "general",
  thumbnailGradient: "linear-gradient(135deg, #0a0a0a 0%, #d4a338 100%)",
  previewColors: { primary: "#d4a338", accent: "#fbbf24", background: "#0a0a0a" },
  sections: [
    {
      id: "hero-13", type: "hero", order: 0, enabled: true,
      content: {
        headline: "Make Your Money Move",
        subheadline: "Stop watching others trade. Step into the arena and show the world your moves. Real markets. Real competition. Real rewards.",
        ctaText: "Make Your Move",
        ctaLink: "/sign-up",
        badge: "💸 Where Money Meets Skill",
        backgroundGradient: "linear-gradient(135deg, #0a0a0a 0%, #1c1917 50%, #0a0a0a 100%)",
      },
    },
    {
      id: "features-13", type: "features", order: 1, enabled: true,
      content: {
        headline: "Level Up Your Game",
        items: [
          { icon: "Flame", title: "Hot Competitions", description: "New competitions launching every day with fresh prize pools." },
          { icon: "Users", title: "Global Community", description: "Trade against competitors from 150+ countries worldwide." },
          { icon: "Wallet", title: "Easy Payouts", description: "Withdraw your winnings instantly to your preferred method." },
          { icon: "Star", title: "Street Cred", description: "Build your reputation, earn badges, and get recognized." },
        ],
      },
    },
    {
      id: "stats-13", type: "stats", order: 2, enabled: true,
      content: {
        items: [
          { value: "150+", label: "Countries", icon: "Globe" },
          { value: "24/7", label: "Competition", icon: "Clock" },
          { value: "Free", label: "To Join", icon: "Gift" },
          { value: "Instant", label: "Payouts", icon: "Zap" },
        ],
      },
    },
    {
      id: "cta-13", type: "cta", order: 3, enabled: true,
      content: {
        headline: "Your Move",
        subheadline: "The market doesn't wait. Neither should you.",
        ctaText: "Start Now",
        ctaLink: "/sign-up",
      },
    },
  ],
};

// ─── Template 14: Bull Run ────────────────────────────────────────────────
export const TEMPLATE_BULL_RUN: TemplateDefinition = {
  slug: "bull-run",
  name: "Bull Run",
  description: "Bull market energy with red/green trading colors",
  category: "trading",
  thumbnailGradient: "linear-gradient(135deg, #14532d 0%, #22c55e 50%, #ef4444 100%)",
  previewColors: { primary: "#22c55e", accent: "#ef4444", background: "#0f172a" },
  sections: [
    {
      id: "hero-14", type: "hero", order: 0, enabled: true,
      content: {
        headline: "Ride the Bull Run",
        subheadline: "Markets are moving. Are you? Join the most exciting trading competitions and profit from every trend — up or down.",
        ctaText: "Ride the Wave",
        ctaLink: "/sign-up",
        badge: "🐂 Bull & Bear Competitions",
        backgroundGradient: "linear-gradient(135deg, #0f172a 0%, #14532d 50%, #0f172a 100%)",
      },
    },
    {
      id: "features-14", type: "features", order: 1, enabled: true,
      content: {
        headline: "Profit in Any Market",
        items: [
          { icon: "TrendingUp", title: "Go Long", description: "Ride the bulls in uptrending markets for maximum gains." },
          { icon: "TrendingDown", title: "Go Short", description: "Profit from falling markets with short selling capabilities." },
          { icon: "Shuffle", title: "Multi-Asset", description: "Trade forex, crypto, indices, and commodities in one platform." },
          { icon: "Shield", title: "Risk Controls", description: "Stop loss, take profit, and margin management built in." },
        ],
      },
    },
    {
      id: "testimonials-14", type: "testimonials", order: 2, enabled: true,
      content: {
        headline: "Trader Stories",
        items: [
          { name: "David R.", role: "Swing Trader", quote: "I caught a 15% move on EUR/USD during a competition. The platform execution was flawless.", rating: 5 },
          { name: "Yuki S.", role: "Crypto Trader", quote: "Being able to go long and short in competitions makes it so much more strategic than just buying.", rating: 5 },
          { name: "Carlos M.", role: "Day Trader", quote: "The real-time leaderboard adds so much excitement. You can literally watch your position change live.", rating: 5 },
        ],
      },
    },
    {
      id: "cta-14", type: "cta", order: 3, enabled: true,
      content: {
        headline: "Bulls or Bears — You Decide",
        subheadline: "Every market condition is an opportunity. Seize it.",
        ctaText: "Start Trading",
        ctaLink: "/sign-up",
      },
    },
  ],
};

// ─── Template 15: Global Markets ──────────────────────────────────────────
export const TEMPLATE_GLOBAL_MARKETS: TemplateDefinition = {
  slug: "global-markets",
  name: "Global Markets",
  description: "International theme with world map and multi-asset focus",
  category: "general",
  thumbnailGradient: "linear-gradient(135deg, #1e293b 0%, #0284c7 50%, #0369a1 100%)",
  previewColors: { primary: "#0284c7", accent: "#38bdf8", background: "#1e293b" },
  sections: [
    {
      id: "hero-15", type: "hero", order: 0, enabled: true,
      content: {
        headline: "Trade Global Markets",
        subheadline: "Access forex, crypto, indices, and commodities from around the world. Compete against international traders in a truly global arena.",
        ctaText: "Go Global",
        ctaLink: "/sign-up",
        badge: "🌍 150+ Countries Connected",
        backgroundGradient: "linear-gradient(135deg, #1e293b 0%, #0c4a6e 100%)",
      },
    },
    {
      id: "stats-15", type: "stats", order: 1, enabled: true,
      content: {
        items: [
          { value: "150+", label: "Countries", icon: "Globe" },
          { value: "100+", label: "Instruments", icon: "BarChart3" },
          { value: "5", label: "Asset Classes", icon: "Layers" },
          { value: "24/5", label: "Market Hours", icon: "Clock" },
        ],
      },
    },
    {
      id: "features-15", type: "features", order: 2, enabled: true,
      content: {
        headline: "One Platform, All Markets",
        items: [
          { icon: "Globe", title: "Multi-Asset Trading", description: "Forex, crypto, indices, commodities — all in one place." },
          { icon: "Languages", title: "Global Community", description: "Traders from every continent. Compete across time zones." },
          { icon: "Lock", title: "Secure & Regulated", description: "Bank-grade encryption and compliant operations." },
          { icon: "Headphones", title: "24/7 Support", description: "Round-the-clock support in multiple languages." },
        ],
      },
    },
    {
      id: "cta-15", type: "cta", order: 3, enabled: true,
      content: {
        headline: "The World Is Your Market",
        subheadline: "Join a global community of competitive traders.",
        ctaText: "Trade Globally",
        ctaLink: "/sign-up",
      },
    },
  ],
};
