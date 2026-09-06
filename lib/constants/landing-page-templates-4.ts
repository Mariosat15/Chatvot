/**
 * Landing page templates 16-20: Specialized themes
 * Each template has unique visual identity and pexelsSearchQuery for hero images.
 */
import type { TemplateDefinition } from "./landing-page-templates-1";

// ─── Template 16: Day Trader ──────────────────────────────────────────────
export const TEMPLATE_DAY_TRADER: TemplateDefinition = {
  slug: "day-trader",
  name: "Day Trader",
  description: "Fast-paced day trading theme with high-energy design",
  category: "trading",
  thumbnailGradient:
    "linear-gradient(135deg, #1a1a2e 0%, #e94560 50%, #0f3460 100%)",
  previewColors: {
    primary: "#e94560",
    accent: "#f87171",
    background: "#1a1a2e",
  },
  pexelsSearchQuery: "stock trading multiple monitors screens desk",
  sections: [
    {
      id: "hero-16",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "Day Trading Competitions",
        subheadline:
          "Fast markets. Fast decisions. Fast rewards. Compete in intraday challenges where every pip counts, every second matters, and speed is king.",
        ctaText: "Start Day Trading",
        ctaLink: "/sign-up",
        badge: "⚡ Intraday Competitions",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
      },
    },
    {
      id: "features-16",
      type: "features",
      order: 1,
      enabled: true,
      content: {
        headline: "Built for Speed Traders",
        items: [
          {
            icon: "Zap",
            title: "Millisecond Execution",
            description:
              "Ultra-fast order routing designed for scalpers and intraday specialists. Every millisecond of edge counts.",
          },
          {
            icon: "Clock",
            title: "Intraday-Only Focus",
            description:
              "Competitions that open and close within a single trading session. No overnight risk, no weekend worry.",
          },
          {
            icon: "BarChart3",
            title: "Scalper-Optimized Charts",
            description:
              "Tight spreads, tick-level data, 1-second candles, and DOM (Depth of Market) visualization for precision entries.",
          },
          {
            icon: "Award",
            title: "Daily Fresh Leaderboards",
            description:
              "New leaderboards every single day. Yesterday's results are history — today is your new shot at the top.",
          },
        ],
      },
    },
    {
      id: "how-16",
      type: "how-it-works",
      order: 2,
      enabled: true,
      content: {
        headline: "Day Trader Quick Start",
        steps: [
          {
            step: 1,
            title: "Register in 60 Seconds",
            description:
              "Lightning-fast signup with instant access to all markets and competition features. No forms, no delays.",
            icon: "UserPlus",
          },
          {
            step: 2,
            title: "Pick Your Session",
            description:
              "Choose from Asian, European, or American session competitions — each with unique market characteristics.",
            icon: "Globe",
          },
          {
            step: 3,
            title: "Scalp, Swing & Win",
            description:
              "Execute your intraday strategy on live market data and dominate the daily leaderboard. Prizes paid daily.",
            icon: "Zap",
          },
        ],
      },
    },
    {
      id: "stats-16",
      type: "stats",
      order: 3,
      enabled: true,
      content: {
        headline: "Intraday Stats",
        items: [
          { value: "3", label: "Trading Sessions", icon: "Globe" },
          { value: "Daily", label: "Prize Distribution", icon: "Trophy" },
          { value: "<1ms", label: "Order Latency", icon: "Zap" },
          { value: "100+", label: "Instruments", icon: "BarChart3" },
        ],
      },
    },
    {
      id: "cta-16",
      type: "cta",
      order: 4,
      enabled: true,
      content: {
        headline: "Today's Session Is Live",
        subheadline:
          "Markets are open. The daily leaderboard is waiting. Show us what you can do before the bell rings.",
        ctaText: "Jump In Now — Free",
        ctaLink: "/sign-up",
      },
    },
  ],
};

// ─── Template 17: Wealth Builder ──────────────────────────────────────────
export const TEMPLATE_WEALTH_BUILDER: TemplateDefinition = {
  slug: "wealth-builder",
  name: "Wealth Builder",
  description: "Sophisticated, long-term focused design with premium feel",
  category: "general",
  thumbnailGradient:
    "linear-gradient(135deg, #1e293b 0%, #059669 50%, #065f46 100%)",
  previewColors: {
    primary: "#059669",
    accent: "#10b981",
    background: "#1e293b",
  },
  pexelsSearchQuery: "city skyline luxury building wealth architecture",
  sections: [
    {
      id: "hero-17",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "Build Your Trading Legacy",
        subheadline:
          "Long-term competitions that reward consistency, discipline, and risk management over luck. Develop a proven track record and build lasting trading wealth.",
        ctaText: "Build Your Legacy",
        ctaLink: "/sign-up",
        badge: "🏗️ Consistency Over Luck",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #1e293b 0%, #064e3b 100%)",
      },
    },
    {
      id: "features-17",
      type: "features",
      order: 1,
      enabled: true,
      content: {
        headline: "Designed for the Long Game",
        items: [
          {
            icon: "TrendingUp",
            title: "Monthly & Quarterly Competitions",
            description:
              "30, 60, and 90-day competitions that reward sustainable, consistent trading — not one lucky day.",
          },
          {
            icon: "Shield",
            title: "Risk-Adjusted Scoring",
            description:
              "Not just P&L — we measure Sharpe ratio, maximum drawdown, consistency score, and risk-adjusted returns.",
          },
          {
            icon: "Award",
            title: "Verified Performance Record",
            description:
              "Build a cryptographically verifiable performance history over months and years. A real trading resume.",
          },
          {
            icon: "Target",
            title: "Progressive Tier System",
            description:
              "Level up through Bronze, Silver, Gold, and Diamond tiers. Each tier unlocks bigger pools and exclusive perks.",
          },
        ],
      },
    },
    {
      id: "stats-17",
      type: "stats",
      order: 2,
      enabled: true,
      content: {
        headline: "Long-Game Numbers",
        items: [
          { value: "12 mo", label: "Longest Season", icon: "Calendar" },
          { value: "€100K", label: "Season Grand Prize", icon: "Trophy" },
          { value: "4 Tiers", label: "Progression Levels", icon: "Layers" },
          { value: "Verified", label: "Performance Certs", icon: "CheckCircle" },
        ],
      },
    },
    {
      id: "testimonials-17",
      type: "testimonials",
      order: 3,
      enabled: true,
      content: {
        headline: "Long-Term Champions",
        items: [
          {
            name: "Margaret L.",
            role: "Diamond Tier · London",
            quote:
              "The risk-adjusted scoring changed my entire approach. I'm a fundamentally better trader now — more patient, more disciplined, more profitable.",
            rating: 5,
          },
          {
            name: "Thomas K.",
            role: "Quarterly Champion · Frankfurt",
            quote:
              "The verified track record I built here helped me land a conversation with a prop firm. This platform is a career builder.",
            rating: 5,
          },
        ],
      },
    },
    {
      id: "cta-17",
      type: "cta",
      order: 4,
      enabled: true,
      content: {
        headline: "Great Traders Think Long-Term",
        subheadline:
          "Consistency compounds. Start building your verified track record today and reap the rewards for years to come.",
        ctaText: "Begin Your Journey — Free",
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
  thumbnailGradient:
    "linear-gradient(135deg, #0f0a1e 0%, #dc2626 50%, #991b1b 100%)",
  previewColors: {
    primary: "#dc2626",
    accent: "#f87171",
    background: "#0f0a1e",
  },
  pexelsSearchQuery: "chess strategy battle dark dramatic",
  sections: [
    {
      id: "hero-18",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "Trade Wars: Battle for Supremacy",
        subheadline:
          "Epic trading battles where only skill determines the victor. Enter the battleground, outmaneuver your opponents, and claim the spoils of war.",
        ctaText: "Enter the Battleground",
        ctaLink: "/sign-up",
        badge: "⚔️ Epic Trading Battles",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #0f0a1e 0%, #450a0a 50%, #0f0a1e 100%)",
      },
    },
    {
      id: "features-18",
      type: "features",
      order: 1,
      enabled: true,
      content: {
        headline: "Choose Your Weapon",
        items: [
          {
            icon: "Swords",
            title: "1v1 Duels",
            description:
              "Challenge any trader to a direct skill showdown. Two enter, one leaves victorious with the prize.",
          },
          {
            icon: "Users",
            title: "Squad Battles",
            description:
              "Form a 3-person squad and wage war against other teams. Combined P&L determines the winning squad.",
          },
          {
            icon: "Map",
            title: "Campaign Mode",
            description:
              "Multi-round warfare campaigns with escalating stakes and prizes. Win battles to advance to the final siege.",
          },
          {
            icon: "Crown",
            title: "Warlord Rankings",
            description:
              "Climb the global warlord leaderboard. Top warlords earn legendary status, exclusive badges, and ultimate bragging rights.",
          },
        ],
      },
    },
    {
      id: "testimonials-18",
      type: "testimonials",
      order: 2,
      enabled: true,
      content: {
        headline: "Battle Reports From the Front",
        items: [
          {
            name: "Victor L.",
            role: "Warlord Rank · Moscow",
            quote:
              "Trade Wars is the most intense competitive trading experience I've ever had. The campaign mode is incredibly addictive. I can't stop.",
            rating: 5,
          },
          {
            name: "Kim P.",
            role: "Squad Leader · Seoul",
            quote:
              "Team battles are a complete game-changer. Coordinating strategy with my squad, assigning forex vs. crypto roles — it's next level.",
            rating: 5,
          },
          {
            name: "Elena T.",
            role: "Duel Specialist · Barcelona",
            quote:
              "Nothing beats the tension of a 1v1 duel where every pip matters. It's chess with money and the clock is ticking.",
            rating: 5,
          },
        ],
      },
    },
    {
      id: "stats-18",
      type: "stats",
      order: 3,
      enabled: true,
      content: {
        headline: "War Statistics",
        items: [
          { value: "1v1", label: "Duels Available", icon: "Swords" },
          { value: "3v3", label: "Squad Battles", icon: "Users" },
          { value: "Multi-Round", label: "Campaigns", icon: "Map" },
          { value: "€75K+", label: "Monthly War Prizes", icon: "Trophy" },
        ],
      },
    },
    {
      id: "cta-18",
      type: "cta",
      order: 4,
      enabled: true,
      content: {
        headline: "War Has Been Declared",
        subheadline:
          "The battlefield awaits your presence, soldier. Pick your weapon, choose your side, and fight for glory.",
        ctaText: "Join the War — Free",
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
  thumbnailGradient:
    "linear-gradient(135deg, #312e81 0%, #4f46e5 50%, #6366f1 100%)",
  previewColors: {
    primary: "#4f46e5",
    accent: "#818cf8",
    background: "#1e1b4b",
  },
  pexelsSearchQuery: "student studying business education laptop",
  sections: [
    {
      id: "hero-19",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "Master the Markets",
        subheadline:
          "Learn by competing. Our platform uniquely combines education with live competition — so you genuinely improve with every single trade and contest you enter.",
        ctaText: "Start Your Mastery Path",
        ctaLink: "/sign-up",
        badge: "🎓 Learn. Trade. Master.",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
      },
    },
    {
      id: "features-19",
      type: "features",
      order: 1,
      enabled: true,
      content: {
        headline: "A Structured Path to Trading Mastery",
        items: [
          {
            icon: "GraduationCap",
            title: "Skill-Based Tier System",
            description:
              "Start as a Beginner and progress through Intermediate, Advanced, and Master tiers based on verified performance.",
          },
          {
            icon: "BookOpen",
            title: "Learn by Competing",
            description:
              "Every competition teaches you something new. Post-competition analytics show exactly what worked and what didn't.",
          },
          {
            icon: "BarChart3",
            title: "Detailed Performance Insights",
            description:
              "After every session, receive a comprehensive performance breakdown with specific areas for improvement highlighted.",
          },
          {
            icon: "Medal",
            title: "Mastery Certification Badges",
            description:
              "Earn verifiable mastery badges as you demonstrate proficiency in risk management, technical analysis, and execution.",
          },
        ],
      },
    },
    {
      id: "how-19",
      type: "how-it-works",
      order: 2,
      enabled: true,
      content: {
        headline: "The Mastery Path",
        steps: [
          {
            step: 1,
            title: "Assess Your Current Level",
            description:
              "Take the free skill assessment to determine your starting tier. It takes less than 5 minutes.",
            icon: "Target",
          },
          {
            step: 2,
            title: "Compete at Your Level",
            description:
              "Face opponents matched to your skill level. Fair, challenging, and educational. You grow with every match.",
            icon: "Users",
          },
          {
            step: 3,
            title: "Review & Improve",
            description:
              "Study detailed performance analytics after each competition. Identify patterns, fix weaknesses, celebrate strengths.",
            icon: "BarChart3",
          },
          {
            step: 4,
            title: "Level Up & Repeat",
            description:
              "As your skills improve, progress through tiers. Unlock harder competitions, bigger prizes, and mastery certifications.",
            icon: "TrendingUp",
          },
        ],
      },
    },
    {
      id: "faq-19",
      type: "faq",
      order: 3,
      enabled: true,
      content: {
        headline: "Questions About the Mastery Program",
        items: [
          {
            question: "Do I need any trading experience to join?",
            answer:
              "Not at all! Our tier system ensures beginners only compete against other beginners. Everyone starts somewhere.",
          },
          {
            question: "How long does it take to reach Master tier?",
            answer:
              "It depends on your dedication and learning pace. Some reach it in 3 months, others in a year. Mastery is a journey, not a sprint.",
          },
          {
            question: "Are the performance analytics free?",
            answer:
              "Yes, 100% free. All analytics, insights, and improvement recommendations are included with every account.",
          },
          {
            question: "Can I use the mastery badges on my resume?",
            answer:
              "Absolutely. Each badge is cryptographically verified and comes with a shareable link proving your achievement.",
          },
        ],
      },
    },
    {
      id: "cta-19",
      type: "cta",
      order: 4,
      enabled: true,
      content: {
        headline: "Every Master Was Once a Beginner",
        subheadline:
          "The journey of a thousand trades begins with a single click. Start free, learn forever.",
        ctaText: "Begin Your Mastery Path",
        ctaLink: "/sign-up",
      },
    },
  ],
};

// ─── Template 20: Lucky Trader ────────────────────────────────────────────
export const TEMPLATE_LUCKY_TRADER: TemplateDefinition = {
  slug: "lucky-trader",
  name: "Lucky Trader",
  description: "Fun gamification theme with achievements, XP, and leveling",
  category: "general",
  thumbnailGradient:
    "linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #f97316 100%)",
  previewColors: {
    primary: "#ea580c",
    accent: "#fb923c",
    background: "#1c1917",
  },
  pexelsSearchQuery: "gaming achievement trophy neon fun",
  sections: [
    {
      id: "hero-20",
      type: "hero",
      order: 0,
      enabled: true,
      content: {
        headline: "Feel Lucky, Trader?",
        subheadline:
          "Where trading skill meets gaming excitement. Enter competitions, collect rare achievements, level up your profile, and unlock exclusive rewards that only the luckiest — and best — traders earn.",
        ctaText: "Try Your Luck",
        ctaLink: "/sign-up",
        badge: "🎰 Gamified Trading Experience",
        backgroundImage: "",
        backgroundGradient:
          "linear-gradient(135deg, #1c1917 0%, #44403c 50%, #1c1917 100%)",
      },
    },
    {
      id: "features-20",
      type: "features",
      order: 1,
      enabled: true,
      content: {
        headline: "Way More Than Just Trading",
        items: [
          {
            icon: "Gamepad2",
            title: "100+ Achievements to Unlock",
            description:
              "Complete challenges, hit milestones, and discover hidden achievements. Every accomplishment earns XP and rewards.",
          },
          {
            icon: "Star",
            title: "XP & Leveling System",
            description:
              "Earn experience points for every trade, competition, and interaction. Level up from Rookie (Lv1) to Legend (Lv50).",
          },
          {
            icon: "Gift",
            title: "Daily Login Rewards",
            description:
              "Log in daily for bonus credits, XP multipliers, and surprise rewards. Streak bonuses for consecutive days.",
          },
          {
            icon: "Gem",
            title: "Rare & Legendary Badges",
            description:
              "Collect common, rare, epic, and legendary badges. Show them off on your profile. Some are so rare, fewer than 1% of traders have them.",
          },
        ],
      },
    },
    {
      id: "stats-20",
      type: "stats",
      order: 2,
      enabled: true,
      content: {
        headline: "Gamification Stats",
        items: [
          { value: "100+", label: "Achievements", icon: "Trophy" },
          { value: "50", label: "Levels", icon: "TrendingUp" },
          { value: "200+", label: "Collectible Badges", icon: "Award" },
          { value: "Daily", label: "Login Rewards", icon: "Gift" },
        ],
      },
    },
    {
      id: "how-20",
      type: "how-it-works",
      order: 3,
      enabled: true,
      content: {
        headline: "Your Trading Adventure Begins Here",
        steps: [
          {
            step: 1,
            title: "Create Your Trader Profile",
            description:
              "Choose your avatar, pick your starting class (Scalper, Swinger, or Investor), and enter the world.",
            icon: "UserPlus",
          },
          {
            step: 2,
            title: "Complete Trading Quests",
            description:
              "Guided quests teach you platform features while earning XP, credits, and your first achievement badges.",
            icon: "Map",
          },
          {
            step: 3,
            title: "Battle Other Traders",
            description:
              "Enter the competitive arena and battle other traders. Win duels, climb ranks, earn rare loot.",
            icon: "Swords",
          },
          {
            step: 4,
            title: "Collect, Flex & Dominate",
            description:
              "Build your collection of badges, achievements, and trophies. Show off your legend status to the world.",
            icon: "Gem",
          },
        ],
      },
    },
    {
      id: "testimonials-20",
      type: "testimonials",
      order: 4,
      enabled: true,
      content: {
        headline: "Player Reviews",
        items: [
          {
            name: "Kian R.",
            role: "Level 42 · Amsterdam",
            quote:
              "I came for the trading, I stayed for the gamification. Chasing achievements and leveling up makes me trade every single day. Addictive in the best way.",
            rating: 5,
          },
          {
            name: "Sophie M.",
            role: "Level 38 · Berlin",
            quote:
              "The daily rewards and quest system keep me coming back. I've genuinely become a better trader because the gamification motivates me to practice constantly.",
            rating: 5,
          },
        ],
      },
    },
    {
      id: "cta-20",
      type: "cta",
      order: 5,
      enabled: true,
      content: {
        headline: "Your Trading Adventure Awaits!",
        subheadline:
          "Join thousands of traders on an epic gamified trading journey. Level up, collect rare badges, and become a legend.",
        ctaText: "Start Your Adventure — Free",
        ctaLink: "/sign-up",
      },
    },
  ],
};
