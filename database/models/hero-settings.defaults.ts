import type {
  IThemePreset,
  IFeatureCard,
  IStatCounter,
  IHowItWorksStep,
  IAdminShowcaseFeature,
  IWhiteLabelFeature,
  IFAQItem,
} from "./hero-settings.interfaces";

// Default theme presets
export const defaultThemePresets: IThemePreset[] = [
  {
    id: "cyber-neon",
    name: "Cyber Neon",
    description: "Futuristic neon glow gaming aesthetic",
    primaryColor: "#00f0ff",
    secondaryColor: "#ff00ff",
    accentColor: "#ffff00",
    backgroundColor: "#0a0a0f",
    gradientFrom: "#00f0ff",
    gradientTo: "#ff00ff",
    fontFamily: "Orbitron",
    buttonStyle: "glow",
    cardStyle: "neon",
    animationStyle: "dynamic",
  },
  {
    id: "dark-gold",
    name: "Dark Gold",
    description: "Elegant dark theme with gold accents",
    primaryColor: "#ffd700",
    secondaryColor: "#b8860b",
    accentColor: "#ffffff",
    backgroundColor: "#0d0d0d",
    gradientFrom: "#ffd700",
    gradientTo: "#b8860b",
    fontFamily: "Cinzel",
    buttonStyle: "gradient",
    cardStyle: "glassmorphism",
    animationStyle: "cinematic",
  },
  {
    id: "midnight-purple",
    name: "Midnight Purple",
    description: "Deep purple gaming vibes",
    primaryColor: "#a855f7",
    secondaryColor: "#6366f1",
    accentColor: "#22d3ee",
    backgroundColor: "#0f0a1a",
    gradientFrom: "#a855f7",
    gradientTo: "#6366f1",
    fontFamily: "Rajdhani",
    buttonStyle: "gradient",
    cardStyle: "glassmorphism",
    animationStyle: "dynamic",
  },
  {
    id: "emerald-matrix",
    name: "Emerald Matrix",
    description: "Matrix-inspired green theme",
    primaryColor: "#10b981",
    secondaryColor: "#059669",
    accentColor: "#22c55e",
    backgroundColor: "#020a06",
    gradientFrom: "#10b981",
    gradientTo: "#059669",
    fontFamily: "Share Tech Mono",
    buttonStyle: "outline",
    cardStyle: "neon",
    animationStyle: "cinematic",
  },
  {
    id: "fire-storm",
    name: "Fire Storm",
    description: "Intense red and orange flames",
    primaryColor: "#f97316",
    secondaryColor: "#ef4444",
    accentColor: "#fbbf24",
    backgroundColor: "#0f0505",
    gradientFrom: "#f97316",
    gradientTo: "#ef4444",
    fontFamily: "Bebas Neue",
    buttonStyle: "solid",
    cardStyle: "gradient",
    animationStyle: "dynamic",
  },
  {
    id: "arctic-frost",
    name: "Arctic Frost",
    description: "Cool ice blue aesthetic",
    primaryColor: "#38bdf8",
    secondaryColor: "#0ea5e9",
    accentColor: "#e0f2fe",
    backgroundColor: "#030712",
    gradientFrom: "#38bdf8",
    gradientTo: "#0ea5e9",
    fontFamily: "Exo 2",
    buttonStyle: "gradient",
    cardStyle: "glassmorphism",
    animationStyle: "minimal",
  },
];

// Default feature cards
export const defaultFeatures: IFeatureCard[] = [
  {
    id: "competitions",
    icon: "Trophy",
    title: "Epic Trading Competitions",
    description:
      "Battle in competitions ranked by P&L, ROI, Win Rate, Profit Factor and more. Multiple prize tiers, live leaderboards, and real-time rankings keep every trade thrilling.",
    color: "#ffd700",
    order: 1,
    enabled: true,
  },
  {
    id: "challenges",
    icon: "Swords",
    title: "1v1 Head-to-Head Challenges",
    description:
      "Challenge any trader to a high-stakes duel. Pick your ranking method, set your entry fee, and prove who's the superior trader in a direct showdown.",
    color: "#ef4444",
    order: 2,
    enabled: true,
  },
  {
    id: "gamemaster",
    icon: "Crown",
    title: "Become a Game Master",
    description:
      "Launch and host your own competitions and challenges. Earn referral fees from every prize pool — build a lucrative business around competitive trading.",
    color: "#a855f7",
    order: 3,
    enabled: true,
  },
  {
    id: "leaderboard",
    icon: "Medal",
    title: "Global Leaderboard & Rankings",
    description:
      "Climb the all-time rankings with performance across every competition. Earn titles, prestige, and recognition among the world's top traders.",
    color: "#8b5cf6",
    order: 4,
    enabled: true,
  },
  {
    id: "arena",
    icon: "Flame",
    title: "Live Arena & Broadcast",
    description:
      "Watch trades unfold in real-time on the Arena broadcast page. Spectate competitions, track live P&L, and feel the energy of every trade.",
    color: "#f97316",
    order: 5,
    enabled: true,
  },
  {
    id: "analytics",
    icon: "BarChart3",
    title: "Advanced Analytics Dashboard",
    description:
      "Deep-dive into your performance with equity curves, daily P&L charts, win-rate breakdowns, and AI-powered trading insights. Know your edge.",
    color: "#10b981",
    order: 6,
    enabled: true,
  },
  {
    id: "rewards",
    icon: "Gift",
    title: "XP, Levels & Legendary Badges",
    description:
      "Every trade earns XP. Level up through tiered ranks, unlock exclusive badges, and collect achievements that showcase your trading journey.",
    color: "#06b6d4",
    order: 7,
    enabled: true,
  },
  {
    id: "marketplace",
    icon: "ShoppingBag",
    title: "Trading Arsenal & Marketplace",
    description:
      "Customize your profile with exclusive avatars, animated badges, and trading accessories. Stand out on every leaderboard.",
    color: "#ec4899",
    order: 8,
    enabled: true,
  },
  {
    id: "security",
    icon: "Shield",
    title: "Fair Play & Fraud Protection",
    description:
      "AI-powered fraud detection, KYC verification, and behavioral monitoring ensure every competition is fair. Trade with confidence.",
    color: "#3b82f6",
    order: 9,
    enabled: true,
  },
];

// Default stats
export const defaultStats: IStatCounter[] = [
  {
    id: "traders",
    label: "Active Traders",
    value: "50000",
    suffix: "+",
    icon: "Users",
    color: "#ffd700",
    enabled: true,
    order: 1,
  },
  {
    id: "competitions",
    label: "Competitions Held",
    value: "1200",
    suffix: "+",
    icon: "Trophy",
    color: "#ef4444",
    enabled: true,
    order: 2,
  },
  {
    id: "prizes",
    label: "Prizes Distributed",
    value: "5",
    suffix: "M+",
    icon: "DollarSign",
    color: "#10b981",
    enabled: true,
    order: 3,
  },
  {
    id: "trades",
    label: "Trades Executed",
    value: "10",
    suffix: "M+",
    icon: "TrendingUp",
    color: "#8b5cf6",
    enabled: true,
    order: 4,
  },
];

// Default how it works steps
export const defaultHowItWorks: IHowItWorksStep[] = [
  {
    id: "step1",
    step: 1,
    title: "Create Your Account",
    description:
      "Sign up in seconds with email or social login. Complete your profile, pick an avatar, and get ready to enter the arena.",
    icon: "UserPlus",
    enabled: true,
  },
  {
    id: "step2",
    step: 2,
    title: "Fund & Choose Your Battle",
    description:
      "Deposit credits, browse live competitions ranked by P&L, ROI, Win Rate and more — or challenge a specific trader to a 1v1 duel.",
    icon: "Trophy",
    enabled: true,
  },
  {
    id: "step3",
    step: 3,
    title: "Trade in Real-Time",
    description:
      "Execute forex trades with live price feeds, professional charting, and real-time leaderboard updates. Every pip counts.",
    icon: "TrendingUp",
    enabled: true,
  },
  {
    id: "step4",
    step: 4,
    title: "Win & Level Up",
    description:
      "Top the leaderboard, claim prize pools, earn XP, unlock badges, and climb the global rankings. Your trading legacy starts here.",
    icon: "Award",
    enabled: true,
  },
];

// Default admin showcase features
export const defaultAdminFeatures: IAdminShowcaseFeature[] = [
  {
    id: "dashboard",
    title: "Real-time Dashboard",
    description: "Monitor all platform activity with live metrics",
    icon: "LayoutDashboard",
    category: "analytics",
    enabled: true,
    order: 1,
  },
  {
    id: "users",
    title: "User Management",
    description: "Complete control over user accounts and permissions",
    icon: "Users",
    category: "management",
    enabled: true,
    order: 2,
  },
  {
    id: "fraud",
    title: "Fraud Detection",
    description: "AI-powered fraud prevention and monitoring",
    icon: "Shield",
    category: "security",
    enabled: true,
    order: 3,
  },
  {
    id: "branding",
    title: "Full Customization",
    description: "White-label everything from colors to content",
    icon: "Palette",
    category: "customization",
    enabled: true,
    order: 4,
  },
];

// Default white label features
export const defaultWhiteLabelFeatures: IWhiteLabelFeature[] = [
  {
    id: "branding",
    title: "Complete Branding Control",
    description: "Your logo, colors, fonts, and style everywhere",
    icon: "Palette",
    enabled: true,
    order: 1,
  },
  {
    id: "domain",
    title: "Custom Domain",
    description: "Run on your own domain with SSL included",
    icon: "Globe",
    enabled: true,
    order: 2,
  },
  {
    id: "emails",
    title: "Branded Communications",
    description: "All emails and notifications in your brand",
    icon: "Mail",
    enabled: true,
    order: 3,
  },
  {
    id: "api",
    title: "API Access",
    description: "Full API access for custom integrations",
    icon: "Code",
    enabled: true,
    order: 4,
  },
];

// Default holiday schedule
export const defaultHolidaySchedule = [
  { id: "christmas", name: "Christmas", themeId: "christmas", startMonth: 12, startDay: 1, endMonth: 12, endDay: 31, enabled: true },
  { id: "halloween", name: "Halloween", themeId: "halloween", startMonth: 10, startDay: 15, endMonth: 11, endDay: 1, enabled: true },
  { id: "easter", name: "Easter", themeId: "easter", startMonth: 3, startDay: 15, endMonth: 4, endDay: 30, enabled: true },
  { id: "black-friday", name: "Black Friday", themeId: "black-friday", startMonth: 11, startDay: 20, endMonth: 11, endDay: 30, enabled: true },
];

// Default Game Master benefits
export const defaultGameMasterBenefits = [
  { id: "gm1", icon: "Crown", title: "Host Your Own Tournaments", description: "Create competitions with custom rules, entry fees, prize pools, and ranking methods. Run weekly leagues or one-off showdowns.", enabled: true, order: 1 },
  { id: "gm2", icon: "DollarSign", title: "Earn Referral Fees", description: "Earn a percentage of every prize pool when your referred users compete. The more active your community, the more you earn.", enabled: true, order: 2 },
  { id: "gm3", icon: "Users", title: "Build Your Community", description: "Invite traders, grow your player base, and create a loyal community around your competitions. Track engagement with built-in analytics.", enabled: true, order: 3 },
  { id: "gm4", icon: "Swords", title: "Create 1v1 Challenges", description: "Set up head-to-head challenges for your players. Choose the ranking method, stake, and watch the battles unfold in real-time.", enabled: true, order: 4 },
  { id: "gm5", icon: "BarChart3", title: "Revenue Dashboard", description: "Track your earnings, player activity, and competition performance with a dedicated Game Master analytics dashboard.", enabled: true, order: 5 },
  { id: "gm6", icon: "Rocket", title: "Scale Without Limits", description: "No cap on competitions or players. Upgrade your GM subscription for higher limits and premium features. Your business, your rules.", enabled: true, order: 6 },
];

// Default competition types
export const defaultCompetitionTypes = [
  { id: "pnl", icon: "TrendingUp", name: "P&L (Profit & Loss)", description: "Pure profit rules. The trader with the highest net profit at the end wins. Simple, ruthless, rewarding.", color: "#10b981", enabled: true },
  { id: "roi", icon: "Target", name: "ROI (Return on Investment)", description: "Percentage gains matter. It does not matter if you start with €100 or €10,000 — the best percentage return wins.", color: "#8b5cf6", enabled: true },
  { id: "win_rate", icon: "Award", name: "Win Rate", description: "Consistency is king. The trader who closes the highest percentage of profitable trades takes the crown.", color: "#f59e0b", enabled: true },
  { id: "total_capital", icon: "Coins", name: "Total Capital", description: "Grow your portfolio to the maximum. The trader with the highest account balance at the end wins it all.", color: "#3b82f6", enabled: true },
  { id: "total_wins", icon: "Flame", name: "Total Wins", description: "Volume and precision. The trader with the most winning trades dominates. Every green trade is a step closer to victory.", color: "#ef4444", enabled: true },
  { id: "profit_factor", icon: "Shield", name: "Profit Factor", description: "Risk management meets performance. The ratio of gross profit to gross loss determines the champion. Smart trading wins.", color: "#06b6d4", enabled: true },
];

// Default FAQ items
export const defaultFaqItems: IFAQItem[] = [
  { id: "faq1", question: "What is competitive trading?", answer: "Competitive trading lets you pit your forex trading skills against other traders in organized competitions and 1v1 challenges. You trade with virtual capital in a risk-free environment, compete based on metrics like P&L, ROI, or Win Rate, and win real prize pools. Think of it as esports for traders.", category: "general", order: 1, enabled: true },
  { id: "faq2", question: "How do competitions work?", answer: "Competitions have a fixed start and end time, an entry fee, and a prize pool. You join, trade forex during the competition window, and your performance is ranked against other participants using the competition's ranking method (e.g., P&L, ROI, Win Rate). Top performers win a share of the prize pool.", category: "competitions", order: 2, enabled: true },
  { id: "faq3", question: "What competition types are available?", answer: "We offer 6 ranking methods: P&L (highest profit wins), ROI (best percentage return), Win Rate (most consistent trader), Total Capital (largest portfolio), Total Wins (most winning trades), and Profit Factor (best risk-adjusted returns). Each format tests a different trading skill.", category: "competitions", order: 3, enabled: true },
  { id: "faq4", question: "What are 1v1 challenges?", answer: "Challenges are head-to-head trading battles between two traders. You can challenge any player, set the stake and ranking method, and trade against each other in real-time. The winner takes the prize pool. It is the ultimate test of skill.", category: "challenges", order: 4, enabled: true },
  { id: "faq5", question: "What is a Game Master?", answer: "Game Masters are entrepreneurial users who host their own competitions and challenges. They subscribe to a GM plan, create events, invite players, and earn referral fees from every prize pool their referred users participate in. It is a way to build a business on the platform.", category: "game-master", order: 5, enabled: true },
  { id: "faq6", question: "Is real money at risk?", answer: "Trading in competitions uses virtual capital — you do not risk real funds on trades. However, entry fees and prize pools use platform credits that you purchase. Your potential loss is limited to the competition entry fee.", category: "general", order: 6, enabled: true },
  { id: "faq7", question: "How are winners determined?", answer: "Winners are determined by the competition's ranking method. If there is a tie, the configured tiebreaker rules apply (e.g., trade count, win rate, join time). Prize distribution is automatic and instant upon competition completion.", category: "competitions", order: 7, enabled: true },
  { id: "faq8", question: "Can I withdraw my winnings?", answer: "Yes. Prize winnings are credited to your platform wallet and can be withdrawn to your bank account or used to enter more competitions. Withdrawal processing times depend on your verification status and payment method.", category: "general", order: 8, enabled: true },
];

// Default enterprise trust badges
export const defaultEnterpriseTrustBadges = [
  { id: "trust1", icon: "Shield", text: "Enterprise Security", enabled: true },
  { id: "trust2", icon: "Server", text: "99.9% Uptime SLA", enabled: true },
  { id: "trust3", icon: "Headphones", text: "24/7 Support", enabled: true },
];

// Default enterprise white label features
export const defaultEnterpriseWhiteLabelFeatures = [
  { id: "wl1", icon: "Palette", title: "Full Branding Control", description: "Custom logo, colors, fonts, and styling to match your brand identity perfectly.", enabled: true, order: 1 },
  { id: "wl2", icon: "Globe", title: "Custom Domain", description: "Run the platform on your own domain with SSL certificate included.", enabled: true, order: 2 },
  { id: "wl3", icon: "Mail", title: "Email Branding", description: "Branded emails with your logo, colors, and custom templates.", enabled: true, order: 3 },
  { id: "wl4", icon: "Code", title: "API Access", description: "Full API access for custom integrations and third-party services.", enabled: true, order: 4 },
  { id: "wl5", icon: "Server", title: "Dedicated Infrastructure", description: "Your own dedicated servers for maximum performance and reliability.", enabled: true, order: 5 },
  { id: "wl6", icon: "Headphones", title: "Priority Support", description: "24/7 dedicated support team with direct communication channels.", enabled: true, order: 6 },
];

// Default enterprise admin features
export const defaultEnterpriseAdminFeatures = [
  { id: "admin1", icon: "BarChart3", title: "Real-Time Analytics", description: "Monitor platform performance, user activity, and revenue in real-time.", color: "from-cyan-500 to-blue-600", enabled: true, order: 1 },
  { id: "admin2", icon: "Users", title: "User Management", description: "Complete control over users, roles, permissions, and restrictions.", color: "from-purple-500 to-pink-600", enabled: true, order: 2 },
  { id: "admin3", icon: "Trophy", title: "Competition Control", description: "Create, manage, and monitor trading competitions with customizable rules.", color: "from-yellow-500 to-orange-600", enabled: true, order: 3 },
  { id: "admin4", icon: "Shield", title: "Fraud Detection", description: "AI-powered fraud detection with behavioral analysis and alerts.", color: "from-red-500 to-rose-600", enabled: true, order: 4 },
  { id: "admin5", icon: "CreditCard", title: "Payment Processing", description: "Multiple payment providers with automatic fee calculation.", color: "from-green-500 to-emerald-600", enabled: true, order: 5 },
  { id: "admin6", icon: "Bell", title: "Notification System", description: "Customizable email templates and in-app notifications.", color: "from-indigo-500 to-violet-600", enabled: true, order: 6 },
  { id: "admin7", icon: "FileText", title: "Audit Logging", description: "Complete audit trail of all admin actions for compliance.", color: "from-amber-500 to-yellow-600", enabled: true, order: 7 },
  { id: "admin8", icon: "PieChart", title: "Financial Dashboard", description: "Track revenue, fees, VAT, and platform financials.", color: "from-teal-500 to-cyan-600", enabled: true, order: 8 },
];

// Default enterprise pricing tiers
export const defaultEnterprisePricingTiers = [
  { id: "tier1", name: "Starter", price: "$499", period: "/month", description: "Perfect for small trading communities", features: ["Up to 1,000 users", "Basic admin panel", "5 competitions/month", "Email support", "Standard analytics"], ctaText: "Get Started", highlighted: false, enabled: true, order: 1 },
  { id: "tier2", name: "Professional", price: "$1,499", period: "/month", description: "For growing trading platforms", features: ["Up to 10,000 users", "Full admin panel", "Unlimited competitions", "Priority support", "Advanced analytics", "Custom branding", "API access"], ctaText: "Start Free Trial", highlighted: true, enabled: true, order: 2 },
  { id: "tier3", name: "Enterprise", price: "Custom", period: "", description: "For large-scale operations", features: ["Unlimited users", "White label solution", "Dedicated servers", "24/7 phone support", "Custom development", "SLA guarantee", "On-premise option"], ctaText: "Contact Sales", highlighted: false, enabled: true, order: 3 },
];

// Default footer menus
export const defaultFooterMenuPlatform = [
  { id: "1", label: "Competitions", href: "/competitions", enabled: true },
  { id: "2", label: "Challenges", href: "/challenges", enabled: true },
  { id: "3", label: "Leaderboard", href: "/leaderboard", enabled: true },
  { id: "4", label: "Marketplace", href: "/marketplace", enabled: true },
];

export const defaultFooterMenuSupport = [
  { id: "1", label: "Help Center", href: "/help", enabled: true },
  { id: "2", label: "Contact Us", href: "mailto:support@chartvolt.com", enabled: true },
  { id: "3", label: "Terms of Service", href: "/terms", enabled: true },
  { id: "4", label: "Privacy Policy", href: "/privacy", enabled: true },
];

export const defaultFooterMenuBusiness = [
  { id: "1", label: "Enterprise Solutions", href: "/enterprise", enabled: true },
  { id: "2", label: "Pricing", href: "/enterprise#pricing", enabled: true },
  { id: "3", label: "Contact Sales", href: "/enterprise#contact", enabled: true },
];

// Default Journey & Badge features (for landing page showcase)
export const defaultJourneyBadgeFeatures = [
  {
    id: "jb-progression",
    icon: "Map",
    gameIcon: "/game-icons/19. Maps.png",
    title: "Trading Journey Map",
    description: "Follow a visual progression through zones — from Rookie to Legend. Each zone unlocks new challenges, badges, and exclusive rewards.",
    enabled: true,
    order: 1,
  },
  {
    id: "jb-badges",
    icon: "Award",
    gameIcon: "/game-icons/9. STAR AWARD.png",
    title: "Collectible Badges",
    description: "Earn badges for milestones like first win, 100 trades, competition champion, and more. Display them on your profile for all to see.",
    enabled: true,
    order: 2,
  },
  {
    id: "jb-xp",
    icon: "Zap",
    gameIcon: "/game-icons/energi potion.png",
    title: "XP & Level System",
    description: "Every trade, competition entry, and challenge earns XP. Level up through tiered ranks and unlock perks at each milestone.",
    enabled: true,
    order: 3,
  },
  {
    id: "jb-ranks",
    icon: "Trophy",
    gameIcon: "/game-icons/16. Crown.png",
    title: "Prestige Ranks",
    description: "Rise from Bronze to Diamond and beyond. Higher ranks unlock exclusive competition access, reduced fees, and legendary badges.",
    enabled: true,
    order: 4,
  },
  {
    id: "jb-achievements",
    icon: "Sparkles",
    gameIcon: "/game-icons/4. Gems.png",
    title: "Achievement System",
    description: "Hidden and visible achievements track your trading prowess. Unlock secret rewards by discovering rare achievement conditions.",
    enabled: true,
    order: 5,
  },
  {
    id: "jb-leaderboard",
    icon: "Users",
    gameIcon: "/game-icons/3. GOLD MEDAL.png",
    title: "Seasonal Leaderboards",
    description: "Compete for seasonal rankings. Top performers earn exclusive seasonal badges, bonus credits, and a spot in the Hall of Fame.",
    enabled: true,
    order: 6,
  },
];

// Default Marketplace items (for landing page showcase)
export const defaultMarketplaceItems = [
  {
    id: "mp-avatars",
    icon: "Sparkles",
    gameIcon: "/game-icons/helmet 1.png",
    name: "Premium Avatars",
    description: "Stand out with exclusive animated avatars and profile frames. Show your rank and style on every leaderboard.",
    price: "From 50 Credits",
    enabled: true,
    order: 1,
  },
  {
    id: "mp-badges",
    icon: "Gem",
    gameIcon: "/game-icons/14. STAR BADGE.png",
    name: "Exclusive Badges",
    description: "Collector badges that showcase your achievements. Limited edition designs released each season.",
    price: "From 100 Credits",
    enabled: true,
    order: 2,
  },
  {
    id: "mp-indicators",
    icon: "Star",
    gameIcon: "/game-icons/technology 3.png",
    name: "Trading Indicators",
    description: "Advanced technical indicators and overlays to sharpen your competitive edge in competitions.",
    price: "From 200 Credits",
    enabled: true,
    order: 3,
  },
  {
    id: "mp-themes",
    icon: "ShoppingBag",
    gameIcon: "/game-icons/chest 2.png",
    name: "Chart Themes",
    description: "Custom chart color schemes and visual themes. Trade in style with unique visual configurations.",
    price: "From 75 Credits",
    enabled: true,
    order: 4,
  },
  {
    id: "mp-boosters",
    icon: "DollarSign",
    gameIcon: "/game-icons/lightning potion.png",
    name: "XP Boosters",
    description: "Temporary boosts that multiply your XP earnings. Level up faster and unlock rewards sooner.",
    price: "From 150 Credits",
    enabled: true,
    order: 5,
  },
  {
    id: "mp-gm-packages",
    icon: "Star",
    gameIcon: "/game-icons/16. Crown.png",
    name: "Game Master Packages",
    description: "Everything you need to start hosting competitions. Includes templates, branding tools, and premium support.",
    price: "From 500 Credits",
    enabled: true,
    order: 6,
  },
];

// Default section order
export const defaultSectionOrder = [
  "hero", "liveStats", "stats", "features", "howItWorks", "gameMaster",
  "competitionTypes", "competitions", "challenges", "activityFeed",
  "leaderboard", "journeyBadges", "marketplace", "testimonials", "trustBadges",
  "adminShowcase", "whiteLabel", "pricing", "faq", "cta", "footer",
];

// Default CTA buttons (for singleton creation)
export const defaultCTAButtons = [
  { id: "cta1", text: "START TRADING", href: "/sign-up", style: "primary", icon: "Zap", enabled: true },
  { id: "cta2", text: "VIEW COMPETITIONS", href: "/competitions", style: "outline", icon: "Trophy", enabled: true },
];
