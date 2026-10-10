/**
 * Landing page templates 6-10: Competition & Prize focused
 * Each template has unique visual identity and pexelsSearchQuery for hero images.
 */
import type { TemplateDefinition } from "./landing-page-templates-1";

// ─── Template 6: Victory Lane ─────────────────────────────────────────────
export const TEMPLATE_VICTORY_LANE: TemplateDefinition = {
  slug: "victory-lane",
  name: "Victory Lane",
  description: "Sports-inspired competitive theme with dynamic racing energy",
  category: "competition",
  thumbnailGradient: "linear-gradient(135deg, #dc2626 0%, #f59e0b 100%)",
  previewColors: {
    primary: "#dc2626",
    accent: "#f59e0b",
    background: "#18181b",
  },
  pexelsSearchQuery: "victory celebration trophy winner podium",
  sections: [
    {
      id: "hero-6",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "Race to Victory",
        subheadline:
          "Your trading skills are your engine. Compete in live head-to-head challenges and tournament-style brackets. The finish line has prizes waiting for you.",
        ctaText: "Enter the Race",
        ctaLink: "/sign-up",
        badge: "🏁 Live Trading Races",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #18181b 0%, #3b0d0d 50%, #18181b 100%)",
      },
    },
    {
      id: "stats-6",
      type: "stats",
      order: 1,
      enabled: true,
      content: {
        headline: "Race Day Numbers",
        items: [
          { value: "1,000+", label: "Daily Races", icon: "Flag" },
          { value: "€100K+", label: "Weekly Prizes", icon: "Trophy" },
          { value: "30 sec", label: "Avg. Match Time", icon: "Timer" },
          { value: "1v1", label: "Head-to-Head", icon: "Swords" },
        ],
      },
    },
    {
      id: "features-6",
      type: "features",
      order: 2,
      enabled: true,
      content: {
        headline: "Compete Your Way",
        items: [
          {
            icon: "Swords",
            title: "1v1 Head-to-Head Challenges",
            description:
              "Challenge any trader directly. Winner takes the spoils. Quick, intense, and fiercely competitive.",
          },
          {
            icon: "Users",
            title: "Multi-Player Tournaments",
            description:
              "8, 16, or 32-player brackets with tiered prize distribution. Survive each round to reach the grand final.",
          },
          {
            icon: "Timer",
            title: "Rapid-Fire Quick Matches",
            description:
              "5-minute, 15-minute, or 1-hour sprint competitions for when you want fast results and instant gratification.",
          },
          {
            icon: "Medal",
            title: "Seasonal Championship Series",
            description:
              "Accumulate points across all competitions throughout the season for massive end-of-season championship prizes.",
          },
        ],
      },
    },
    {
      id: "testimonials-6",
      type: "testimonials",
      order: 3,
      enabled: true,
      content: {
        headline: "What Champions Say",
        items: [
          {
            name: "Jake T.",
            role: "Tournament Champion · Dubai",
            quote:
              "Won my first 16-player bracket with a 23% return in just 2 hours. The adrenaline rush is absolutely unmatched. I'm hooked.",
            rating: 5,
          },
          {
            name: "Lisa W.",
            role: "1v1 Specialist · Toronto",
            quote:
              "The head-to-head format forced me to up my game. I've improved more in 3 months of racing than 2 years of solo trading.",
            rating: 5,
          },
          {
            name: "Omar S.",
            role: "Season Finalist · Cairo",
            quote:
              "The seasonal championship is brilliant. Every single race counts towards the grand prize. It keeps you motivated all year.",
            rating: 5,
          },
        ],
      },
    },
    {
      id: "cta-6",
      type: "cta",
      order: 4,
      enabled: true,
      content: {
        headline: "Your Victory Lane Awaits",
        subheadline:
          "New competitions launch every hour. The starting grid is filling up — claim your spot now.",
        ctaText: "Race Now — It's Free",
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
  previewColors: {
    primary: "#10b981",
    accent: "#34d399",
    background: "#022c22",
  },
  pexelsSearchQuery: "money growth investment earnings profit",
  sections: [
    {
      id: "hero-7",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "Trade Smart. Earn Real Rewards.",
        subheadline:
          "Turn your market knowledge into tangible earnings. Compete in trading competitions and convert your analytical skills into withdrawable credit rewards.",
        ctaText: "Start Earning Today",
        ctaLink: "/sign-up",
        badge: "💰 Real Rewards Platform",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #022c22 0%, #064e3b 100%)",
      },
    },
    {
      id: "features-7",
      type: "features",
      order: 1,
      enabled: true,
      content: {
        headline: "Multiple Paths to Profit",
        items: [
          {
            icon: "Trophy",
            title: "Competition Prize Pools",
            description:
              "Win cash-equivalent credit prizes in daily, weekly, and monthly competitions with transparent prize distribution.",
          },
          {
            icon: "Gift",
            title: "Achievement Rewards",
            description:
              "Earn XP, unlock rare badges, and receive bonus credits for hitting milestones — even outside competitions.",
          },
          {
            icon: "Users",
            title: "Referral Income Stream",
            description:
              "Invite friends and earn a percentage of their competition entry fees. Build passive income from your network forever.",
          },
          {
            icon: "TrendingUp",
            title: "Tier Progression System",
            description:
              "Level up from Bronze to Diamond. Higher tiers unlock bigger competitions, better rewards, and exclusive perks.",
          },
        ],
      },
    },
    {
      id: "how-7",
      type: "how-it-works",
      order: 2,
      enabled: true,
      content: {
        headline: "Your Earning Journey",
        steps: [
          {
            step: 1,
            title: "Sign Up Completely Free",
            description:
              "No deposit required. You receive starter credits on registration to begin competing immediately.",
            icon: "UserPlus",
          },
          {
            step: 2,
            title: "Compete in Daily Contests",
            description:
              "Enter competitions that match your skill level and budget. New contests launch every hour.",
            icon: "Calendar",
          },
          {
            step: 3,
            title: "Withdraw Your Earnings",
            description:
              "Cash out your winnings anytime to your bank account or preferred payment method. Fast, secure, guaranteed.",
            icon: "Wallet",
          },
        ],
      },
    },
    {
      id: "stats-7",
      type: "stats",
      order: 3,
      enabled: true,
      content: {
        headline: "Our Track Record",
        items: [
          { value: "€5M+", label: "Total Paid Out", icon: "Banknote" },
          { value: "89%", label: "Payout Rate", icon: "Percent" },
          { value: "<24h", label: "Withdrawal Speed", icon: "Clock" },
          { value: "Free", label: "To Get Started", icon: "Gift" },
        ],
      },
    },
    {
      id: "testimonials-7",
      type: "testimonials",
      order: 4,
      enabled: true,
      content: {
        headline: "Earners Speak",
        items: [
          {
            name: "Pierre D.",
            role: "Consistent Earner · Paris",
            quote:
              "I started with the free credits and now I'm earning €200+ per month from competitions alone. The referral program is the cherry on top.",
            rating: 5,
          },
          {
            name: "Aisha N.",
            role: "Top 10 Trader · Nairobi",
            quote:
              "Withdrawals are fast and hassle-free. I've cashed out multiple times and the money always arrives within 24 hours. Trustworthy platform.",
            rating: 5,
          },
        ],
      },
    },
    {
      id: "cta-7",
      type: "cta",
      order: 5,
      enabled: true,
      content: {
        headline: "Your Skills Have Real Value",
        subheadline:
          "Stop practicing for free. Start competing for real rewards. Your trading knowledge deserves to pay off.",
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
  description:
    "Technical analysis focused with advanced charting emphasis",
  category: "trading",
  thumbnailGradient:
    "linear-gradient(135deg, #1e1b4b 0%, #6366f1 50%, #818cf8 100%)",
  previewColors: {
    primary: "#6366f1",
    accent: "#818cf8",
    background: "#1e1b4b",
  },
  pexelsSearchQuery: "financial chart analysis trading screen",
  sections: [
    {
      id: "hero-8",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "Where Chart Masters Compete",
        subheadline:
          "Professional-grade charting meets competitive trading. Analyze patterns, execute setups, and prove your technical analysis skills against the best chartists on the planet.",
        ctaText: "Prove Your Analysis Skills",
        ctaLink: "/sign-up",
        badge: "📊 Pro Charting Platform",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
      },
    },
    {
      id: "features-8",
      type: "features",
      order: 1,
      enabled: true,
      content: {
        headline: "A Charting Powerhouse Built for Champions",
        items: [
          {
            icon: "LineChart",
            title: "50+ Technical Indicators",
            description:
              "RSI, MACD, Bollinger Bands, Fibonacci retracements, Ichimoku Cloud, and dozens more — all built in and customizable.",
          },
          {
            icon: "Layers",
            title: "Multi-Timeframe Analysis",
            description:
              "Analyze from 1-minute scalping to monthly macro — all timeframes simultaneously on a single, synced workspace.",
          },
          {
            icon: "PenTool",
            title: "Professional Drawing Tools",
            description:
              "Trendlines, channels, Elliott Wave patterns, Gann fans, pitchforks — everything a serious chartist demands.",
          },
          {
            icon: "Eye",
            title: "Sub-Second Candlestick Updates",
            description:
              "Watch candles form in real-time with institutional-grade data accuracy. Never miss a breakout or reversal.",
          },
        ],
      },
    },
    {
      id: "how-8",
      type: "how-it-works",
      order: 2,
      enabled: true,
      content: {
        headline: "Become a Chart Champion",
        steps: [
          {
            step: 1,
            title: "Set Up Your Workspace",
            description:
              "Customize your chart layout with your favorite indicators, timeframes, and color schemes.",
            icon: "Settings",
          },
          {
            step: 2,
            title: "Enter a Chart Challenge",
            description:
              "Join competitions where pure technical analysis determines the winner. No luck, just skill.",
            icon: "Trophy",
          },
          {
            step: 3,
            title: "Prove Your Edge",
            description:
              "Execute your setups on live data and show the world your chart-reading prowess on the leaderboard.",
            icon: "Award",
          },
        ],
      },
    },
    {
      id: "cta-8",
      type: "cta",
      order: 3,
      enabled: true,
      content: {
        headline: "The Charts Don't Lie. Neither Does the Leaderboard.",
        subheadline:
          "Show the world your edge. The next chart championship starts in minutes.",
        ctaText: "Start Charting Free",
        ctaLink: "/sign-up",
      },
    },
  ],
};

// ─── Template 9: Risk Free Trading ────────────────────────────────────────
export const TEMPLATE_RISK_FREE: TemplateDefinition = {
  slug: "risk-free-trading",
  name: "Risk-Free Trading",
  description:
    "Friendly, approachable design for beginners and cautious traders",
  category: "general",
  thumbnailGradient: "linear-gradient(135deg, #0c4a6e 0%, #38bdf8 100%)",
  previewColors: {
    primary: "#38bdf8",
    accent: "#7dd3fc",
    background: "#0c4a6e",
  },
  pexelsSearchQuery: "learning education business student laptop",
  sections: [
    {
      id: "hero-9",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "Learn to Trade — Completely Risk-Free",
        subheadline:
          "Practice with virtual credits on 100% real market data. Build genuine confidence, develop proven strategies, and compete when you're ready — all without risking a single cent.",
        ctaText: "Start Practicing Free",
        ctaLink: "/sign-up",
        badge: "🛡️ Zero Risk, Real Skills",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #0c4a6e 0%, #164e63 100%)",
      },
    },
    {
      id: "features-9",
      type: "features",
      order: 1,
      enabled: true,
      content: {
        headline: "Trade Fearlessly. Learn Effectively.",
        items: [
          {
            icon: "Shield",
            title: "100% Virtual Capital",
            description:
              "Every trade uses virtual money on live market data. Develop real skills with absolutely zero financial exposure.",
          },
          {
            icon: "GraduationCap",
            title: "Learning by Doing",
            description:
              "The best way to learn trading isn't theory — it's practice. We give you the safest possible environment to do exactly that.",
          },
          {
            icon: "BarChart3",
            title: "Live Institutional Data",
            description:
              "No simulated or delayed prices. Real forex, crypto, and index prices from the same feeds used by professional traders.",
          },
          {
            icon: "Heart",
            title: "Supportive Community",
            description:
              "Join discussion forums, share strategies, ask questions, and learn from experienced traders who were once beginners too.",
          },
        ],
      },
    },
    {
      id: "how-9",
      type: "how-it-works",
      order: 2,
      enabled: true,
      content: {
        headline: "Zero to Confident Trader in 3 Steps",
        steps: [
          {
            step: 1,
            title: "Create Your Free Account",
            description:
              "Sign up and receive virtual credits instantly. No credit card, no deposits, no obligation.",
            icon: "Gift",
          },
          {
            step: 2,
            title: "Practice on Real Markets",
            description:
              "Trade live forex, crypto, and index data in a completely risk-free environment. Learn from every trade.",
            icon: "Target",
          },
          {
            step: 3,
            title: "Compete & Earn When Ready",
            description:
              "Once you've built confidence, enter competitions for real prizes. Your skills will have earned it.",
            icon: "Trophy",
          },
        ],
      },
    },
    {
      id: "faq-9",
      type: "faq",
      order: 3,
      enabled: true,
      content: {
        headline: "Common Questions From New Traders",
        items: [
          {
            question: "Do I need to deposit any money to start?",
            answer:
              "Absolutely not. You start with free virtual credits. You only spend real money if you choose to enter paid competitions later.",
          },
          {
            question: "Is the market data actually real?",
            answer:
              "Yes — 100% real-time institutional data from professional providers. The only virtual thing is your starting capital.",
          },
          {
            question: "Can I really win actual prizes?",
            answer:
              "Yes! Top performers in competitions earn real credit rewards that can be withdrawn. Start free, compete for real.",
          },
          {
            question: "What if I have no trading experience at all?",
            answer:
              "That's exactly who this platform is for. The skill-based matching system ensures you only compete against traders at your level.",
          },
        ],
      },
    },
    {
      id: "cta-9",
      type: "cta",
      order: 4,
      enabled: true,
      content: {
        headline: "Nothing to Lose. Everything to Gain.",
        subheadline:
          "Start your trading journey today. Zero risk, zero cost, unlimited learning potential.",
        ctaText: "Get Your Free Account",
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
  thumbnailGradient:
    "linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #a855f7 100%)",
  previewColors: {
    primary: "#7c3aed",
    accent: "#a855f7",
    background: "#0f0a1e",
  },
  pexelsSearchQuery: "esports gaming tournament arena competition",
  sections: [
    {
      id: "hero-10",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "The Ultimate Trading Tournament Hub",
        subheadline:
          "Bracket-style tournaments, round-robin leagues, and lightning-fast sprint challenges. The most electrifying competitive trading experience on the planet.",
        ctaText: "Browse Tournaments",
        ctaLink: "/sign-up",
        badge: "🎮 Esports-Style Trading",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #0f0a1e 0%, #2e1065 50%, #0f0a1e 100%)",
      },
    },
    {
      id: "features-10",
      type: "features",
      order: 1,
      enabled: true,
      content: {
        headline: "Every Competition Format You Can Imagine",
        items: [
          {
            icon: "Brackets",
            title: "Bracket Tournaments",
            description:
              "Single and double elimination brackets with live round updates. Survive each matchup to advance to the grand final.",
          },
          {
            icon: "RotateCw",
            title: "Round-Robin Leagues",
            description:
              "Face every competitor in your group across multiple rounds. Consistency wins the league — not just one lucky trade.",
          },
          {
            icon: "Zap",
            title: "Sprint Challenges",
            description:
              "15-minute to 1-hour fast-paced trading sprints. Quick entry, instant results, immediate gratification.",
          },
          {
            icon: "Calendar",
            title: "Seasonal Championships",
            description:
              "Accumulate points over 3-month seasons for massive championship prizes and the ultimate bragging rights.",
          },
        ],
      },
    },
    {
      id: "stats-10",
      type: "stats",
      order: 2,
      enabled: true,
      content: {
        headline: "Tournament Stats",
        items: [
          { value: "10K+", label: "Monthly Players", icon: "Users" },
          { value: "200+", label: "Weekly Events", icon: "Calendar" },
          { value: "€50K", label: "Biggest Tournament", icon: "Trophy" },
          { value: "Live", label: "Leaderboards", icon: "BarChart3" },
        ],
      },
    },
    {
      id: "how-10",
      type: "how-it-works",
      order: 3,
      enabled: true,
      content: {
        headline: "How Tournaments Work",
        steps: [
          {
            step: 1,
            title: "Register for Free",
            description:
              "Create your account and browse the tournament schedule. Hundreds of events every week.",
            icon: "UserPlus",
          },
          {
            step: 2,
            title: "Enter Your Tournament",
            description:
              "Pick a format — bracket, league, or sprint — and register. Free and paid entry options available.",
            icon: "Target",
          },
          {
            step: 3,
            title: "Compete Live",
            description:
              "Trade on real market data with live bracket updates. Watch your progress in real-time on the tournament board.",
            icon: "Swords",
          },
          {
            step: 4,
            title: "Claim Your Crown",
            description:
              "Win prizes, earn championship points, and secure your place in the Hall of Champions.",
            icon: "Crown",
          },
        ],
      },
    },
    {
      id: "cta-10",
      type: "cta",
      order: 4,
      enabled: true,
      content: {
        headline: "Tournament Season Is Live Now",
        subheadline:
          "Registrations are open. The brackets are filling. Don't watch from the sidelines — compete.",
        ctaText: "Join a Tournament",
        ctaLink: "/sign-up",
      },
    },
  ],
};
