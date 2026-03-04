/**
 * Landing page templates 6-10: Competition & Prize focused
 */
import type { TemplateDefinition } from "./landing-page-templates-1";

// ─── Template 6: Victory Lane ─────────────────────────────────────────────
export const TEMPLATE_VICTORY_LANE: TemplateDefinition = {
  slug: "victory-lane",
  name: "Victory Lane",
  description: "Sports-inspired competitive theme with dynamic energy",
  category: "competition",
  thumbnailGradient: "linear-gradient(135deg, #dc2626 0%, #f59e0b 100%)",
  previewColors: { primary: "#dc2626", accent: "#f59e0b", background: "#18181b" },
  sections: [
    {
      id: "hero-6", type: "hero", order: 0, enabled: true,
      content: {
        headline: "Race to Victory",
        subheadline: "Your trading skills are your engine. Compete in live head-to-head challenges and tournament-style competitions. The finish line has prizes.",
        ctaText: "Enter the Race",
        ctaLink: "/sign-up",
        badge: "🏁 Live Trading Races",
        backgroundGradient: "linear-gradient(135deg, #18181b 0%, #3b0d0d 50%, #18181b 100%)",
      },
    },
    {
      id: "stats-6", type: "stats", order: 1, enabled: true,
      content: {
        items: [
          { value: "1,000+", label: "Daily Races", icon: "Flag" },
          { value: "€100K+", label: "Weekly Prizes", icon: "Trophy" },
          { value: "30s", label: "Avg. Match Time", icon: "Timer" },
          { value: "1v1", label: "Head-to-Head", icon: "Swords" },
        ],
      },
    },
    {
      id: "features-6", type: "features", order: 2, enabled: true,
      content: {
        headline: "Compete Your Way",
        items: [
          { icon: "Swords", title: "1v1 Challenges", description: "Challenge any trader to a direct head-to-head battle." },
          { icon: "Users", title: "Tournaments", description: "Multi-player competitions with tiered prize distribution." },
          { icon: "Timer", title: "Quick Matches", description: "5-minute, 15-minute, or 1-hour rapid competitions." },
          { icon: "Medal", title: "Season Rankings", description: "Earn points across all competitions for seasonal rewards." },
        ],
      },
    },
    {
      id: "testimonials-6", type: "testimonials", order: 3, enabled: true,
      content: {
        headline: "Champions Speak",
        items: [
          { name: "Jake T.", role: "Tournament Winner", quote: "Won my first tournament with a 23% return in just 2 hours. The adrenaline is unmatched!", rating: 5 },
          { name: "Lisa W.", role: "1v1 Champion", quote: "The head-to-head format is addictive. I've improved more in 3 months than 2 years of solo trading.", rating: 5 },
        ],
      },
    },
    {
      id: "cta-6", type: "cta", order: 4, enabled: true,
      content: {
        headline: "Your Victory Awaits",
        subheadline: "New competitions launch every hour. Jump in now.",
        ctaText: "Race Now",
        ctaLink: "/sign-up",
      },
    },
  ],
};

// ─── Template 7: Trade & Earn ─────────────────────────────────────────────
export const TEMPLATE_TRADE_EARN: TemplateDefinition = {
  slug: "trade-and-earn",
  name: "Trade & Earn",
  description: "Earnings-focused green theme highlighting reward potential",
  category: "general",
  thumbnailGradient: "linear-gradient(135deg, #064e3b 0%, #10b981 100%)",
  previewColors: { primary: "#10b981", accent: "#34d399", background: "#022c22" },
  sections: [
    {
      id: "hero-7", type: "hero", order: 0, enabled: true,
      content: {
        headline: "Trade Smart. Earn More.",
        subheadline: "Turn your market knowledge into real earnings. Compete in trading competitions and convert your skills into withdrawable rewards.",
        ctaText: "Start Earning",
        ctaLink: "/sign-up",
        badge: "💰 Real Rewards",
        backgroundGradient: "linear-gradient(135deg, #022c22 0%, #064e3b 100%)",
      },
    },
    {
      id: "features-7", type: "features", order: 1, enabled: true,
      content: {
        headline: "Multiple Ways to Earn",
        items: [
          { icon: "Trophy", title: "Competition Prizes", description: "Win cash prizes in daily, weekly, and monthly competitions." },
          { icon: "Gift", title: "Achievement Rewards", description: "Earn XP, badges, and bonus credits for milestones." },
          { icon: "Users", title: "Referral Income", description: "Invite friends and earn a percentage of their entry fees forever." },
          { icon: "TrendingUp", title: "Skill Progression", description: "Level up your trader tier for access to higher-stake competitions." },
        ],
      },
    },
    {
      id: "how-7", type: "how-it-works", order: 2, enabled: true,
      content: {
        headline: "Your Earning Path",
        steps: [
          { step: 1, title: "Sign Up Free", description: "No deposit required. Get starter credits on registration.", icon: "UserPlus" },
          { step: 2, title: "Compete Daily", description: "Enter competitions that match your skill and budget.", icon: "Calendar" },
          { step: 3, title: "Withdraw Earnings", description: "Cash out your winnings anytime to your bank account.", icon: "Wallet" },
        ],
      },
    },
    {
      id: "stats-7", type: "stats", order: 3, enabled: true,
      content: {
        items: [
          { value: "€5M+", label: "Total Paid Out", icon: "Banknote" },
          { value: "89%", label: "Payout Rate", icon: "Percent" },
          { value: "<24h", label: "Withdrawal Time", icon: "Clock" },
          { value: "Free", label: "To Start", icon: "Gift" },
        ],
      },
    },
    {
      id: "cta-7", type: "cta", order: 4, enabled: true,
      content: {
        headline: "Start Earning Today",
        subheadline: "Your trading skills have real value. Monetize them now.",
        ctaText: "Claim Your Free Account",
        ctaLink: "/sign-up",
      },
    },
  ],
};

// ─── Template 8: Chart Champions ──────────────────────────────────────────
export const TEMPLATE_CHART_CHAMPIONS: TemplateDefinition = {
  slug: "chart-champions",
  name: "Chart Champions",
  description: "Technical analysis focused with advanced charting emphasis",
  category: "trading",
  thumbnailGradient: "linear-gradient(135deg, #1e1b4b 0%, #6366f1 50%, #818cf8 100%)",
  previewColors: { primary: "#6366f1", accent: "#818cf8", background: "#1e1b4b" },
  sections: [
    {
      id: "hero-8", type: "hero", order: 0, enabled: true,
      content: {
        headline: "Where Chart Masters Compete",
        subheadline: "Professional-grade charting meets competitive trading. Analyze, execute, and prove your technical analysis skills against the best.",
        ctaText: "Prove Your Analysis",
        ctaLink: "/sign-up",
        badge: "📊 Pro Charting Platform",
        backgroundGradient: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
      },
    },
    {
      id: "features-8", type: "features", order: 1, enabled: true,
      content: {
        headline: "Charting Powerhouse",
        items: [
          { icon: "LineChart", title: "50+ Indicators", description: "RSI, MACD, Bollinger, Fibonacci, and dozens more built-in." },
          { icon: "Layers", title: "Multi-Timeframe", description: "Analyze from 1-minute to monthly timeframes simultaneously." },
          { icon: "PenTool", title: "Drawing Tools", description: "Trendlines, channels, patterns — everything a chartist needs." },
          { icon: "Eye", title: "Real-Time View", description: "Sub-second candlestick updates with institutional-grade accuracy." },
        ],
      },
    },
    {
      id: "cta-8", type: "cta", order: 2, enabled: true,
      content: {
        headline: "Show the World Your Edge",
        subheadline: "The charts don't lie. Neither does the leaderboard.",
        ctaText: "Start Charting",
        ctaLink: "/sign-up",
      },
    },
  ],
};

// ─── Template 9: Risk Free Trading ────────────────────────────────────────
export const TEMPLATE_RISK_FREE: TemplateDefinition = {
  slug: "risk-free-trading",
  name: "Risk-Free Trading",
  description: "Friendly, approachable design for beginners and cautious traders",
  category: "general",
  thumbnailGradient: "linear-gradient(135deg, #0c4a6e 0%, #38bdf8 100%)",
  previewColors: { primary: "#38bdf8", accent: "#7dd3fc", background: "#0c4a6e" },
  sections: [
    {
      id: "hero-9", type: "hero", order: 0, enabled: true,
      content: {
        headline: "Learn to Trade — Risk Free",
        subheadline: "Practice with virtual credits on real markets. Build confidence, develop strategies, and compete when you're ready — all without risking a cent.",
        ctaText: "Start Practicing Free",
        ctaLink: "/sign-up",
        badge: "🛡️ Zero Risk, Real Skills",
        backgroundGradient: "linear-gradient(135deg, #0c4a6e 0%, #164e63 100%)",
      },
    },
    {
      id: "features-9", type: "features", order: 1, enabled: true,
      content: {
        headline: "Trade Without Fear",
        items: [
          { icon: "Shield", title: "Virtual Credits", description: "Trade with virtual money on real live market data. No financial risk." },
          { icon: "GraduationCap", title: "Learn by Doing", description: "The best way to learn trading is by trading. We make it safe." },
          { icon: "BarChart3", title: "Real Market Data", description: "No simulations. Real forex, crypto, and index prices." },
          { icon: "Heart", title: "Supportive Community", description: "Join forums, share strategies, and learn from experienced traders." },
        ],
      },
    },
    {
      id: "how-9", type: "how-it-works", order: 2, enabled: true,
      content: {
        headline: "Zero to Trader in 3 Steps",
        steps: [
          { step: 1, title: "Free Account", description: "Sign up and receive virtual credits instantly.", icon: "Gift" },
          { step: 2, title: "Practice Trading", description: "Trade real markets with zero financial risk.", icon: "Target" },
          { step: 3, title: "Compete & Earn", description: "When ready, enter competitions for real prizes.", icon: "Trophy" },
        ],
      },
    },
    {
      id: "faq-9", type: "faq", order: 3, enabled: true,
      content: {
        headline: "Common Questions",
        items: [
          { question: "Do I need to deposit money?", answer: "No! You start with free virtual credits. You only need real money if you want to enter paid competitions." },
          { question: "Is the market data real?", answer: "Yes, 100% real-time data from institutional providers. The only thing virtual is your starting capital." },
          { question: "Can I really win prizes?", answer: "Absolutely. Top performers in competitions earn real credit rewards that can be withdrawn." },
        ],
      },
    },
    {
      id: "cta-9", type: "cta", order: 4, enabled: true,
      content: {
        headline: "Nothing to Lose, Everything to Gain",
        subheadline: "Start your trading journey today — completely free.",
        ctaText: "Get Free Account",
        ctaLink: "/sign-up",
      },
    },
  ],
};

// ─── Template 10: Tournament Hub ──────────────────────────────────────────
export const TEMPLATE_TOURNAMENT_HUB: TemplateDefinition = {
  slug: "tournament-hub",
  name: "Tournament Hub",
  description: "Esports-inspired tournament page with bracket styling",
  category: "competition",
  thumbnailGradient: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #a855f7 100%)",
  previewColors: { primary: "#7c3aed", accent: "#a855f7", background: "#0f0a1e" },
  sections: [
    {
      id: "hero-10", type: "hero", order: 0, enabled: true,
      content: {
        headline: "The Trading Tournament Hub",
        subheadline: "Bracket-style tournaments, round-robin leagues, and sprint challenges. The most exciting competitive trading on the planet.",
        ctaText: "View Tournaments",
        ctaLink: "/sign-up",
        badge: "🎮 Esports-Style Trading",
        backgroundGradient: "linear-gradient(135deg, #0f0a1e 0%, #2e1065 50%, #0f0a1e 100%)",
      },
    },
    {
      id: "features-10", type: "features", order: 1, enabled: true,
      content: {
        headline: "Competition Formats",
        items: [
          { icon: "Brackets", title: "Bracket Tournaments", description: "Single and double elimination brackets with live updates." },
          { icon: "RotateCw", title: "Round Robin", description: "Face every competitor in your group over multiple rounds." },
          { icon: "Zap", title: "Sprint Challenges", description: "15-minute to 1-hour fast-paced trading sprints." },
          { icon: "Calendar", title: "Seasonal Leagues", description: "Accumulate points over months for massive season-end prizes." },
        ],
      },
    },
    {
      id: "stats-10", type: "stats", order: 2, enabled: true,
      content: {
        items: [
          { value: "10K+", label: "Monthly Players", icon: "Users" },
          { value: "200+", label: "Weekly Events", icon: "Calendar" },
          { value: "€50K", label: "Biggest Tournament", icon: "Trophy" },
          { value: "Live", label: "Leaderboards", icon: "BarChart3" },
        ],
      },
    },
    {
      id: "cta-10", type: "cta", order: 3, enabled: true,
      content: {
        headline: "Tournament Season Is Live",
        subheadline: "Register now and compete for the championship title.",
        ctaText: "Join Tournament",
        ctaLink: "/sign-up",
      },
    },
  ],
};
