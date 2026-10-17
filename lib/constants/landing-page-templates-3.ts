/**
 * Landing page templates 11-15: Diverse themes
 * Each template has unique visual identity and pexelsSearchQuery for hero images.
 */
import type { TemplateDefinition } from "./landing-page-templates-1";

// ─── Template 11: Profit Race ─────────────────────────────────────────────
export const TEMPLATE_PROFIT_RACE: TemplateDefinition = {
  slug: "profit-race",
  name: "Profit Race",
  description: "Fast-paced racing theme with speedometer visuals and urgency",
  category: "competition",
  thumbnailGradient:
    "linear-gradient(135deg, #0f172a 0%, #22c55e 50%, #16a34a 100%)",
  previewColors: {
    primary: "#22c55e",
    accent: "#86efac",
    background: "#0f172a",
  },
  pexelsSearchQuery: "racing car speed neon fast",
  sections: [
    {
      id: "hero-11",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "The Profit Race Is On",
        subheadline:
          "Fastest P&L wins. Real-time equity tracking shows every trader's progress live. Sprint to the finish line and claim a prize that matches your speed.",
        ctaText: "Join the Race",
        ctaLink: "/sign-up",
        badge: "🏎️ Speed Trading Competitions",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #0f172a 0%, #052e16 100%)",
      },
    },
    {
      id: "stats-11",
      type: "stats",
      order: 1,
      enabled: true,
      content: {
        headline: "Race Statistics",
        items: [
          { value: "5 min", label: "Fastest Race", icon: "Timer" },
          { value: "Live", label: "Equity Tracking", icon: "Activity" },
          { value: "€25K+", label: "Daily Prizes", icon: "Coins" },
          { value: "Instant", label: "Results & Payouts", icon: "Zap" },
        ],
      },
    },
    {
      id: "features-11",
      type: "features",
      order: 2,
      enabled: true,
      content: {
        headline: "Speed. Precision. Victory.",
        items: [
          {
            icon: "Gauge",
            title: "Real-Time P&L Speedometer",
            description:
              "Watch your equity move in real-time against all competitors on a live, animated leaderboard that updates every second.",
          },
          {
            icon: "Timer",
            title: "Multiple Race Durations",
            description:
              "From 5-minute blitz sprints to 24-hour endurance marathons. Pick the race that matches your trading style and stamina.",
          },
          {
            icon: "Trophy",
            title: "Instant Prize Credits",
            description:
              "Prizes are credited to your account the moment the race ends. No waiting, no processing delays.",
          },
          {
            icon: "Repeat",
            title: "Non-Stop Race Schedule",
            description:
              "New races launch every few minutes around the clock. There's always a starting grid with an open seat.",
          },
        ],
      },
    },
    {
      id: "how-11",
      type: "how-it-works",
      order: 3,
      enabled: true,
      content: {
        headline: "Your Race Starts in 3 Steps",
        steps: [
          {
            step: 1,
            title: "Strap In",
            description:
              "Create your free account and browse the race schedule. New races start every 5 minutes.",
            icon: "UserPlus",
          },
          {
            step: 2,
            title: "Hit the Gas",
            description:
              "Enter a race, place your trades on live market data, and watch the P&L speedometer climb.",
            icon: "Zap",
          },
          {
            step: 3,
            title: "Cross the Finish Line",
            description:
              "Beat the competition and see your name at the top. Prizes credited instantly. Next race starts soon.",
            icon: "Trophy",
          },
        ],
      },
    },
    {
      id: "cta-11",
      type: "cta",
      order: 4,
      enabled: true,
      content: {
        headline: "On Your Marks... Get Set...",
        subheadline:
          "The next race starts in minutes. The grid is filling up. Don't miss the green light.",
        ctaText: "Race Now — Free Entry",
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
  thumbnailGradient:
    "linear-gradient(135deg, #0f172a 0%, #3b82f6 50%, #2563eb 100%)",
  previewColors: {
    primary: "#3b82f6",
    accent: "#60a5fa",
    background: "#0f172a",
  },
  pexelsSearchQuery: "artificial intelligence data analytics technology",
  sections: [
    {
      id: "hero-12",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "Trade Smarter, Not Harder",
        subheadline:
          "Advanced analytics, AI-powered performance insights, and data-driven competition. Let intelligence — not guesswork — drive every trading decision you make.",
        ctaText: "Get Smart Access",
        ctaLink: "/sign-up",
        badge: "🧠 Data-Driven Trading Platform",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
      },
    },
    {
      id: "features-12",
      type: "features",
      order: 1,
      enabled: true,
      content: {
        headline: "Intelligence at Your Fingertips",
        items: [
          {
            icon: "Brain",
            title: "Deep Performance Analytics",
            description:
              "Win rate, risk/reward ratio, Sharpe ratio, maximum drawdown, profit factor — know every number that defines your edge.",
          },
          {
            icon: "BarChart3",
            title: "Interactive Equity Curves",
            description:
              "Track your growth over time with detailed equity visualizations. Compare your curve against the competition in real-time.",
          },
          {
            icon: "Target",
            title: "Trade Scoring Engine",
            description:
              "Every single trade scored on timing, risk management, position sizing, and execution quality. See exactly where to improve.",
          },
          {
            icon: "Lightbulb",
            title: "Strategy Insights Dashboard",
            description:
              "Discover which strategies work best in trending vs. ranging vs. volatile markets. Data-backed recommendations.",
          },
        ],
      },
    },
    {
      id: "how-12",
      type: "how-it-works",
      order: 2,
      enabled: true,
      content: {
        headline: "The Data-Driven Success Loop",
        steps: [
          {
            step: 1,
            title: "Analyze Your Edge",
            description:
              "Study your performance metrics, identify strengths, and pinpoint exactly where your strategy leaks money.",
            icon: "Search",
          },
          {
            step: 2,
            title: "Optimize Your Approach",
            description:
              "Refine your strategy based on hard data, not gut feeling. A/B test ideas in risk-free competitions.",
            icon: "Settings",
          },
          {
            step: 3,
            title: "Execute With Confidence",
            description:
              "Trade with conviction backed by analytics. Know your expected outcome before you click the button.",
            icon: "Zap",
          },
          {
            step: 4,
            title: "Dominate the Leaderboard",
            description:
              "Rise through the ranks as a data-driven champion. Consistent, methodical, unstoppable.",
            icon: "Crown",
          },
        ],
      },
    },
    {
      id: "stats-12",
      type: "stats",
      order: 3,
      enabled: true,
      content: {
        headline: "Analytics Power",
        items: [
          { value: "15+", label: "Performance Metrics", icon: "BarChart3" },
          { value: "Real-Time", label: "Trade Scoring", icon: "Target" },
          { value: "AI", label: "Strategy Insights", icon: "Brain" },
          { value: "Free", label: "All Analytics", icon: "Gift" },
        ],
      },
    },
    {
      id: "cta-12",
      type: "cta",
      order: 4,
      enabled: true,
      content: {
        headline: "Let Data Be Your Unfair Advantage",
        subheadline:
          "Smart traders consistently outperform. Start analyzing, optimizing, and dominating today.",
        ctaText: "Join Free — Start Analyzing",
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
  previewColors: {
    primary: "#d4a338",
    accent: "#fbbf24",
    background: "#0a0a0a",
  },
  pexelsSearchQuery: "gold luxury wealth coins money",
  sections: [
    {
      id: "hero-13",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "Make Your Money Move",
        subheadline:
          "Stop watching from the sidelines. Step into the arena and show the world what your moves are worth. Real markets. Real competition. Real rewards.",
        ctaText: "Make Your Move",
        ctaLink: "/sign-up",
        badge: "💸 Where Skill Meets Fortune",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #0a0a0a 0%, #1c1917 50%, #0a0a0a 100%)",
      },
    },
    {
      id: "features-13",
      type: "features",
      order: 1,
      enabled: true,
      content: {
        headline: "Level Up Your Game",
        items: [
          {
            icon: "Flame",
            title: "Hot Competitions Daily",
            description:
              "New competitions launching every single day with fresh prize pools. The action never stops and neither should you.",
          },
          {
            icon: "Users",
            title: "Global Competitor Network",
            description:
              "Trade against sharp competitors from 150+ countries. Prove your skills on the world stage.",
          },
          {
            icon: "Wallet",
            title: "Fast & Easy Payouts",
            description:
              "Withdraw your winnings instantly to your preferred payment method. No hoops, no delays, no excuses.",
          },
          {
            icon: "Star",
            title: "Build Your Reputation",
            description:
              "Climb the ranks, earn exclusive badges, get featured on the leaderboard, and build a reputation that precedes you.",
          },
        ],
      },
    },
    {
      id: "stats-13",
      type: "stats",
      order: 2,
      enabled: true,
      content: {
        headline: "Global Reach",
        items: [
          { value: "150+", label: "Countries", icon: "Globe" },
          { value: "24/7", label: "Competition", icon: "Clock" },
          { value: "Free", label: "Entry Available", icon: "Gift" },
          { value: "Instant", label: "Payouts", icon: "Zap" },
        ],
      },
    },
    {
      id: "testimonials-13",
      type: "testimonials",
      order: 3,
      enabled: true,
      content: {
        headline: "Real Talk From Real Traders",
        items: [
          {
            name: "Dante J.",
            role: "Day Trader · Miami",
            quote:
              "The vibe is incredible. It's like the trading floor meets a competitive gaming arena. I've never been this motivated to trade well.",
            rating: 5,
          },
          {
            name: "Priya K.",
            role: "Swing Trader · Mumbai",
            quote:
              "Instant payouts, global competition, and a clean UI. This platform gets everything right. My money is always moving.",
            rating: 5,
          },
        ],
      },
    },
    {
      id: "cta-13",
      type: "cta",
      order: 4,
      enabled: true,
      content: {
        headline: "It's Your Move",
        subheadline:
          "The market doesn't wait. Neither should you. Step in, compete, earn.",
        ctaText: "Start Now — Free",
        ctaLink: "/sign-up",
      },
    },
  ],
};

// ─── Template 14: Bull Run ────────────────────────────────────────────────
export const TEMPLATE_BULL_RUN: TemplateDefinition = {
  slug: "bull-run",
  name: "Bull Run",
  description: "Bull market energy with vibrant green/red trading colors",
  category: "trading",
  thumbnailGradient:
    "linear-gradient(135deg, #14532d 0%, #22c55e 50%, #ef4444 100%)",
  previewColors: {
    primary: "#22c55e",
    accent: "#ef4444",
    background: "#0f172a",
  },
  pexelsSearchQuery: "wall street bull statue financial market",
  sections: [
    {
      id: "hero-14",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "Ride the Bull Run",
        subheadline:
          "Markets are in motion. Are you? Join the most exciting trading competitions and profit from every trend — whether the bull charges or the bear strikes.",
        ctaText: "Ride the Wave",
        ctaLink: "/sign-up",
        badge: "🐂 Bull & Bear Competitions",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #0f172a 0%, #14532d 50%, #0f172a 100%)",
      },
    },
    {
      id: "features-14",
      type: "features",
      order: 1,
      enabled: true,
      content: {
        headline: "Profit in Any Market Condition",
        items: [
          {
            icon: "TrendingUp",
            title: "Go Long — Ride the Bulls",
            description:
              "Buy the dip, ride the momentum, and capitalize on uptrends. Go long when the bulls are charging.",
          },
          {
            icon: "TrendingDown",
            title: "Go Short — Tame the Bears",
            description:
              "Profit from falling markets with short selling. The best traders make money in any direction.",
          },
          {
            icon: "Shuffle",
            title: "Multi-Asset Universe",
            description:
              "Trade forex, crypto, indices, and commodities — all within a single unified platform and account.",
          },
          {
            icon: "Shield",
            title: "Built-In Risk Controls",
            description:
              "Automatic stop loss, take profit, and margin management tools keep your risk in check at all times.",
          },
        ],
      },
    },
    {
      id: "testimonials-14",
      type: "testimonials",
      order: 2,
      enabled: true,
      content: {
        headline: "Bull Run Stories",
        items: [
          {
            name: "David R.",
            role: "Swing Trader · Sydney",
            quote:
              "Caught a 15% move on EUR/USD during a weekly competition. The platform execution was flawless — not a single requote.",
            rating: 5,
          },
          {
            name: "Yuki S.",
            role: "Crypto Trader · Tokyo",
            quote:
              "Going long AND short in competitions makes it so much more strategic than spot trading. I love the versatility.",
            rating: 5,
          },
          {
            name: "Carlos M.",
            role: "Day Trader · São Paulo",
            quote:
              "The real-time leaderboard adds insane excitement. Watching your position change live while trading is pure adrenaline.",
            rating: 5,
          },
        ],
      },
    },
    {
      id: "stats-14",
      type: "stats",
      order: 3,
      enabled: true,
      content: {
        headline: "Market Access",
        items: [
          { value: "100+", label: "Instruments", icon: "BarChart3" },
          { value: "Long/Short", label: "Both Directions", icon: "Shuffle" },
          { value: "24/7", label: "Crypto Markets", icon: "Clock" },
          { value: "5", label: "Asset Classes", icon: "Layers" },
        ],
      },
    },
    {
      id: "cta-14",
      type: "cta",
      order: 4,
      enabled: true,
      content: {
        headline: "Bulls or Bears — The Choice Is Yours",
        subheadline:
          "Every market condition is an opportunity when you have the right tools. Seize it.",
        ctaText: "Start Trading Now",
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
  thumbnailGradient:
    "linear-gradient(135deg, #1e293b 0%, #0284c7 50%, #0369a1 100%)",
  previewColors: {
    primary: "#0284c7",
    accent: "#38bdf8",
    background: "#1e293b",
  },
  pexelsSearchQuery: "globe world map international business",
  sections: [
    {
      id: "hero-15",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "Trade the World's Markets",
        subheadline:
          "Access forex, crypto, indices, and commodities from every major financial center on the planet. Compete against international traders in a truly global arena.",
        ctaText: "Go Global",
        ctaLink: "/sign-up",
        badge: "🌍 150+ Countries Connected",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #1e293b 0%, #0c4a6e 100%)",
      },
    },
    {
      id: "stats-15",
      type: "stats",
      order: 1,
      enabled: true,
      content: {
        headline: "Global Footprint",
        items: [
          { value: "150+", label: "Countries", icon: "Globe" },
          { value: "100+", label: "Instruments", icon: "BarChart3" },
          { value: "5", label: "Asset Classes", icon: "Layers" },
          { value: "24/5", label: "Market Hours", icon: "Clock" },
        ],
      },
    },
    {
      id: "features-15",
      type: "features",
      order: 2,
      enabled: true,
      content: {
        headline: "One Platform, Every Market",
        items: [
          {
            icon: "Globe",
            title: "Multi-Asset Trading",
            description:
              "Forex pairs, cryptocurrency, stock indices, and commodities — all accessible from a single account and interface.",
          },
          {
            icon: "Languages",
            title: "Global Trading Community",
            description:
              "Traders from every continent compete across time zones. The leaderboard is always active somewhere in the world.",
          },
          {
            icon: "Lock",
            title: "Enterprise-Grade Security",
            description:
              "Bank-level AES-256 encryption, mandatory 2FA, and compliant operations. Your data and funds are always protected.",
          },
          {
            icon: "Headphones",
            title: "24/7 Multilingual Support",
            description:
              "Round-the-clock customer support available in English, Spanish, Arabic, Chinese, and more.",
          },
        ],
      },
    },
    {
      id: "how-15",
      type: "how-it-works",
      order: 3,
      enabled: true,
      content: {
        headline: "Go Global in 3 Steps",
        steps: [
          {
            step: 1,
            title: "Create Your Account",
            description:
              "Free registration available worldwide. No geographic restrictions — if you have internet, you can trade.",
            icon: "UserPlus",
          },
          {
            step: 2,
            title: "Choose Your Markets",
            description:
              "Select from forex, crypto, indices, or commodities. Trade one asset class or all of them.",
            icon: "Globe",
          },
          {
            step: 3,
            title: "Compete Globally",
            description:
              "Enter international competitions and measure yourself against the best traders on Earth.",
            icon: "Trophy",
          },
        ],
      },
    },
    {
      id: "cta-15",
      type: "cta",
      order: 4,
      enabled: true,
      content: {
        headline: "The World Is Your Trading Floor",
        subheadline:
          "Join a truly global community of competitive traders. No borders, no limits.",
        ctaText: "Trade Globally — Free",
        ctaLink: "/sign-up",
      },
    },
  ],
};
