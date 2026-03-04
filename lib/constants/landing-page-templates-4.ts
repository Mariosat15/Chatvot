/**
 * Landing page templates 16-20: Specialized themes
 */
import type { TemplateDefinition } from "./landing-page-templates-1";

// ─── Template 16: Day Trader ──────────────────────────────────────────────
export const TEMPLATE_DAY_TRADER: TemplateDefinition = {
  slug: "day-trader",
  name: "Day Trader",
  description: "Fast-paced day trading theme with high-energy design",
  category: "trading",
  thumbnailGradient: "linear-gradient(135deg, #1a1a2e 0%, #e94560 50%, #0f3460 100%)",
  previewColors: { primary: "#e94560", accent: "#f87171", background: "#1a1a2e" },
  sections: [
    {
      id: "hero-16", type: "hero", order: 0, enabled: true,
      content: {
        headline: "Day Trading Competitions",
        subheadline: "Fast markets. Fast decisions. Fast rewards. Compete in intraday challenges where every pip counts and speed is king.",
        ctaText: "Start Day Trading",
        ctaLink: "/sign-up",
        badge: "⚡ Intraday Competitions",
        backgroundGradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
      },
    },
    {
      id: "features-16", type: "features", order: 1, enabled: true,
      content: {
        headline: "Built for Speed Traders",
        items: [
          { icon: "Zap", title: "Millisecond Execution", description: "Ultra-fast order routing for the fastest traders." },
          { icon: "Clock", title: "Intraday Focus", description: "Competitions that start and end within the trading day." },
          { icon: "BarChart3", title: "Scalper-Friendly", description: "Tight spreads and rapid chart updates for scalping strategies." },
          { icon: "Award", title: "Daily Rankings", description: "Fresh leaderboards every day. New chances to win daily." },
        ],
      },
    },
    {
      id: "how-16", type: "how-it-works", order: 2, enabled: true,
      content: {
        headline: "Quick Start Guide",
        steps: [
          { step: 1, title: "Register", description: "60-second signup. Instant market access.", icon: "UserPlus" },
          { step: 2, title: "Pick a Session", description: "Asian, European, or American session competitions.", icon: "Globe" },
          { step: 3, title: "Scalp & Win", description: "Execute your strategy and beat the daily leaderboard.", icon: "Zap" },
        ],
      },
    },
    {
      id: "cta-16", type: "cta", order: 3, enabled: true,
      content: {
        headline: "Today's Competition Is Live",
        subheadline: "Markets are open. The leaderboard is waiting for you.",
        ctaText: "Jump In Now",
        ctaLink: "/sign-up",
      },
    },
  ],
};

// ─── Template 17: Wealth Builder ──────────────────────────────────────────
export const TEMPLATE_WEALTH_BUILDER: TemplateDefinition = {
  slug: "wealth-builder",
  name: "Wealth Builder",
  description: "Sophisticated, long-term focused with premium feel",
  category: "general",
  thumbnailGradient: "linear-gradient(135deg, #1e293b 0%, #059669 50%, #065f46 100%)",
  previewColors: { primary: "#059669", accent: "#10b981", background: "#1e293b" },
  sections: [
    {
      id: "hero-17", type: "hero", order: 0, enabled: true,
      content: {
        headline: "Build Your Trading Legacy",
        subheadline: "Long-term competitions that reward consistency over luck. Develop a proven track record and build lasting trading wealth.",
        ctaText: "Build Your Legacy",
        ctaLink: "/sign-up",
        badge: "🏗️ Consistency Wins",
        backgroundGradient: "linear-gradient(135deg, #1e293b 0%, #064e3b 100%)",
      },
    },
    {
      id: "features-17", type: "features", order: 1, enabled: true,
      content: {
        headline: "For the Long Game",
        items: [
          { icon: "TrendingUp", title: "Monthly Competitions", description: "30-day competitions that reward sustainable trading." },
          { icon: "Shield", title: "Risk-Adjusted Scoring", description: "Not just P&L — we measure Sharpe ratio, drawdown, and consistency." },
          { icon: "Award", title: "Verified Track Record", description: "Build a verifiable performance history over months and years." },
          { icon: "Target", title: "Progressive Tiers", description: "Level up through Bronze, Silver, Gold, and Diamond tiers." },
        ],
      },
    },
    {
      id: "stats-17", type: "stats", order: 2, enabled: true,
      content: {
        items: [
          { value: "12mo", label: "Longest Season", icon: "Calendar" },
          { value: "€100K", label: "Season Prize Pool", icon: "Trophy" },
          { value: "4", label: "Trader Tiers", icon: "Layers" },
          { value: "Verified", label: "Performance", icon: "CheckCircle" },
        ],
      },
    },
    {
      id: "cta-17", type: "cta", order: 3, enabled: true,
      content: {
        headline: "Great Traders Think Long-Term",
        subheadline: "Start building your track record today.",
        ctaText: "Begin Your Journey",
        ctaLink: "/sign-up",
      },
    },
  ],
};

// ─── Template 18: Trade Wars ──────────────────────────────────────────────
export const TEMPLATE_TRADE_WARS: TemplateDefinition = {
  slug: "trade-wars",
  name: "Trade Wars",
  description: "Battle-themed competitive design with dramatic visuals",
  category: "competition",
  thumbnailGradient: "linear-gradient(135deg, #0f0a1e 0%, #dc2626 50%, #991b1b 100%)",
  previewColors: { primary: "#dc2626", accent: "#f87171", background: "#0f0a1e" },
  sections: [
    {
      id: "hero-18", type: "hero", order: 0, enabled: true,
      content: {
        headline: "Trade Wars: Battle for Supremacy",
        subheadline: "Epic trading battles where skill determines the victor. Enter the battleground, defeat your opponents, and claim the spoils of war.",
        ctaText: "Enter the Battleground",
        ctaLink: "/sign-up",
        badge: "⚔️ Epic Trading Battles",
        backgroundGradient: "linear-gradient(135deg, #0f0a1e 0%, #450a0a 50%, #0f0a1e 100%)",
      },
    },
    {
      id: "features-18", type: "features", order: 1, enabled: true,
      content: {
        headline: "Choose Your Weapon",
        items: [
          { icon: "Swords", title: "1v1 Duels", description: "Challenge any trader to a direct skill showdown." },
          { icon: "Users", title: "Team Battles", description: "Form squads and compete in team-based trading wars." },
          { icon: "Map", title: "Campaign Mode", description: "Multi-round campaigns with escalating prizes." },
          { icon: "Crown", title: "Warlord Rankings", description: "Climb the global warlord leaderboard and earn legendary status." },
        ],
      },
    },
    {
      id: "testimonials-18", type: "testimonials", order: 2, enabled: true,
      content: {
        headline: "Battle Reports",
        items: [
          { name: "Victor L.", role: "Warlord Rank", quote: "Trade Wars is the most intense trading experience I've ever had. The battle format is incredible.", rating: 5 },
          { name: "Kim P.", role: "Squad Leader", quote: "Team battles are a game-changer. Coordinating strategies with my squad is so much fun.", rating: 5 },
        ],
      },
    },
    {
      id: "cta-18", type: "cta", order: 3, enabled: true,
      content: {
        headline: "War Is Declared",
        subheadline: "Pick your side. The battlefield awaits.",
        ctaText: "Join the War",
        ctaLink: "/sign-up",
      },
    },
  ],
};

// ─── Template 19: Market Masters Academy ──────────────────────────────────
export const TEMPLATE_MARKET_MASTERS: TemplateDefinition = {
  slug: "market-masters-academy",
  name: "Market Masters Academy",
  description: "Education meets competition — mastery-focused design",
  category: "general",
  thumbnailGradient: "linear-gradient(135deg, #312e81 0%, #4f46e5 50%, #6366f1 100%)",
  previewColors: { primary: "#4f46e5", accent: "#818cf8", background: "#1e1b4b" },
  sections: [
    {
      id: "hero-19", type: "hero", order: 0, enabled: true,
      content: {
        headline: "Master the Markets",
        subheadline: "Learn, practice, and compete. Our platform combines education with live competition so you improve while you compete.",
        ctaText: "Start Learning",
        ctaLink: "/sign-up",
        badge: "🎓 Learn. Trade. Master.",
        backgroundGradient: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
      },
    },
    {
      id: "features-19", type: "features", order: 1, enabled: true,
      content: {
        headline: "Your Path to Mastery",
        items: [
          { icon: "GraduationCap", title: "Skill Levels", description: "Start as a Beginner and progress to Master through skill-based tiers." },
          { icon: "BookOpen", title: "Learn by Competing", description: "Every competition teaches you something new about the markets." },
          { icon: "BarChart3", title: "Performance Insights", description: "Detailed analytics show you exactly where to improve." },
          { icon: "Medal", title: "Mastery Badges", description: "Earn verifiable badges as you master different trading aspects." },
        ],
      },
    },
    {
      id: "how-19", type: "how-it-works", order: 2, enabled: true,
      content: {
        headline: "The Mastery Path",
        steps: [
          { step: 1, title: "Assess Your Level", description: "Take the free assessment to find your starting tier.", icon: "Target" },
          { step: 2, title: "Compete at Your Level", description: "Face opponents matched to your skill level.", icon: "Users" },
          { step: 3, title: "Analyze & Improve", description: "Review detailed performance analytics after each competition.", icon: "BarChart3" },
          { step: 4, title: "Level Up", description: "Progress through tiers as your skills improve.", icon: "TrendingUp" },
        ],
      },
    },
    {
      id: "faq-19", type: "faq", order: 3, enabled: true,
      content: {
        headline: "Questions About Mastery",
        items: [
          { question: "Do I need trading experience?", answer: "No! Our tier system ensures you compete against others at your level, from complete beginner to expert." },
          { question: "How long does it take to reach Master tier?", answer: "It depends on your dedication. Some reach it in 3 months, others in a year. It's about consistency." },
          { question: "Are the performance analytics free?", answer: "Yes, all analytics and insights are included free with every account." },
        ],
      },
    },
    {
      id: "cta-19", type: "cta", order: 4, enabled: true,
      content: {
        headline: "Every Master Was Once a Beginner",
        subheadline: "Start your mastery journey today. It's free.",
        ctaText: "Begin Your Path",
        ctaLink: "/sign-up",
      },
    },
  ],
};

// ─── Template 20: Lucky Trader ────────────────────────────────────────────
export const TEMPLATE_LUCKY_TRADER: TemplateDefinition = {
  slug: "lucky-trader",
  name: "Lucky Trader",
  description: "Fun gamification theme with achievements and leveling",
  category: "general",
  thumbnailGradient: "linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #f97316 100%)",
  previewColors: { primary: "#ea580c", accent: "#fb923c", background: "#1c1917" },
  sections: [
    {
      id: "hero-20", type: "hero", order: 0, enabled: true,
      content: {
        headline: "Feel Lucky, Trader?",
        subheadline: "Where skill meets excitement. Enter competitions, collect achievements, level up your trader profile, and unlock exclusive rewards.",
        ctaText: "Try Your Luck",
        ctaLink: "/sign-up",
        badge: "🎰 Gamified Trading",
        backgroundGradient: "linear-gradient(135deg, #1c1917 0%, #44403c 50%, #1c1917 100%)",
      },
    },
    {
      id: "features-20", type: "features", order: 1, enabled: true,
      content: {
        headline: "More Than Just Trading",
        items: [
          { icon: "Gamepad2", title: "Achievement System", description: "100+ achievements to unlock as you trade and compete." },
          { icon: "Star", title: "XP & Leveling", description: "Earn XP for every action and level up your trader profile." },
          { icon: "Gift", title: "Daily Rewards", description: "Log in daily for bonus credits, XP boosts, and surprises." },
          { icon: "Gem", title: "Rare Badges", description: "Collect rare and legendary badges that show off your skills." },
        ],
      },
    },
    {
      id: "stats-20", type: "stats", order: 2, enabled: true,
      content: {
        items: [
          { value: "100+", label: "Achievements", icon: "Trophy" },
          { value: "50", label: "Levels", icon: "TrendingUp" },
          { value: "200+", label: "Badges", icon: "Award" },
          { value: "Daily", label: "Rewards", icon: "Gift" },
        ],
      },
    },
    {
      id: "how-20", type: "how-it-works", order: 3, enabled: true,
      content: {
        headline: "Your Adventure Begins",
        steps: [
          { step: 1, title: "Create Character", description: "Choose your trader avatar and pick your starting class.", icon: "UserPlus" },
          { step: 2, title: "Complete Quests", description: "Trading quests guide you through features while earning XP.", icon: "Map" },
          { step: 3, title: "Battle Others", description: "Enter the arena and battle other traders for glory.", icon: "Swords" },
          { step: 4, title: "Collect & Flex", description: "Build your collection of badges, achievements, and trophies.", icon: "Gem" },
        ],
      },
    },
    {
      id: "cta-20", type: "cta", order: 4, enabled: true,
      content: {
        headline: "Adventure Awaits!",
        subheadline: "Join thousands of traders on an epic gamified trading journey.",
        ctaText: "Start Your Adventure",
        ctaLink: "/sign-up",
      },
    },
  ],
};
