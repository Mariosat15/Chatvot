import type { LandingSettings } from "./types";

// ─── Default Settings ─────────────────────────────────────────────────────

export const defaultSettings: LandingSettings = {
  // Theme
  activeTheme: "gaming-neon",
  holidayThemesEnabled: true,
  holidaySchedule: [
    {
      id: "christmas",
      name: "Christmas",
      themeId: "christmas",
      startMonth: 12,
      startDay: 1,
      endMonth: 12,
      endDay: 31,
      enabled: true,
    },
    {
      id: "halloween",
      name: "Halloween",
      themeId: "halloween",
      startMonth: 10,
      startDay: 15,
      endMonth: 11,
      endDay: 1,
      enabled: true,
    },
    {
      id: "easter",
      name: "Easter",
      themeId: "easter",
      startMonth: 3,
      startDay: 15,
      endMonth: 4,
      endDay: 30,
      enabled: true,
    },
    {
      id: "black-friday",
      name: "Black Friday",
      themeId: "black-friday",
      startMonth: 11,
      startDay: 20,
      endMonth: 11,
      endDay: 30,
      enabled: true,
    },
  ],
  globalThemeEffects: {
    particlesEnabled: true,
    glowEffectsEnabled: true,
    animationsEnabled: true,
    snowIntensity: 30,
    bloodIntensity: 20,
    confettiIntensity: 30,
  },
  customThemeEnabled: false,
  customTheme: {
    primaryColor: "#00ff88",
    secondaryColor: "#00d4ff",
    accentColor: "#ff00ff",
    backgroundColor: "#030712",
    textColor: "#f3f4f6",
    borderColor: "#374151",
    headingFont: "Orbitron",
  },

  enterprisePageEnabled: true,

  // Hero
  heroEnabled: true,
  heroTitle: "TRADE. COMPETE. CONQUER.",
  heroSubtitle: "THE ULTIMATE TRADING ARENA",
  heroDescription:
    "Enter the world's most electrifying trading competition platform. Compete head-to-head against traders worldwide, climb the leaderboards, and win real prizes — all with zero financial risk.",
  heroBadgeText: "🔥 Live Trading Battles — Join 10,000+ Traders",
  heroPrimaryCTAText: "Join the Arena",
  heroPrimaryCTALink: "/sign-up",
  heroSecondaryCTAText: "Watch Live Competitions",
  heroSecondaryCTALink: "/competitions",
  heroParticlesEnabled: true,

  // Stats
  statsEnabled: true,
  statsAnimated: true,
  stats: [
    { id: "1", value: "10000", suffix: "+", label: "Active Traders Worldwide", icon: "Users", enabled: true },
    { id: "2", value: "1000000", suffix: "$+", label: "Total Prizes Awarded", icon: "Trophy", enabled: true },
    { id: "3", value: "250000", suffix: "+", label: "Trades Executed Daily", icon: "TrendingUp", enabled: true },
    { id: "4", value: "120", suffix: "+", label: "Countries Represented", icon: "Globe", enabled: true },
  ],

  // Features
  featuresEnabled: true,
  featuresTitle: "Built for Champions",
  featuresSubtitle:
    "Every tool, every edge, every advantage — engineered to help you dominate the competition",
  features: [
    { id: "1", icon: "Trophy", title: "Live Trading Competitions", description: "Enter daily, weekly, and monthly tournaments with real-time leaderboards. Compete for cash prizes, exclusive badges, and global bragging rights.", enabled: true },
    { id: "2", icon: "Swords", title: "1v1 Head-to-Head Duels", description: "Challenge any trader to a direct showdown. Set the stake, choose the timeframe, and prove you're the better trader in intense one-on-one battles.", enabled: true },
    { id: "3", icon: "BarChart3", title: "Professional-Grade Charts", description: "Trade on advanced TradingView-powered charts with 50+ technical indicators, drawing tools, and multi-timeframe analysis — all in real-time.", enabled: true },
    { id: "4", icon: "Award", title: "Global Leaderboards & Rankings", description: "Track your rank against thousands of traders. Earn XP, climb seasonal tiers, and showcase your achievements on your public profile.", enabled: true },
    { id: "5", icon: "Shield", title: "Zero Financial Risk", description: "Trade with virtual capital in a risk-free environment. Perfect your strategy, test new approaches, and build confidence — all without risking a single dollar.", enabled: true },
    { id: "6", icon: "Zap", title: "Real-Time Price Feeds", description: "Execute trades on live market prices streamed directly from institutional-grade data providers. No delays, no re-quotes — just raw market action.", enabled: true },
    { id: "7", icon: "Gift", title: "Rewards & Achievement System", description: "Unlock badges, earn XP for every trade, and collect rewards as you progress. From Bronze to Legendary — every milestone is recognized and celebrated.", enabled: true },
    { id: "8", icon: "Globe", title: "Trade 28+ Forex Pairs", description: "Access all major, minor, and exotic currency pairs with institutional-grade spreads. Diversify your strategy across the world's most liquid markets.", enabled: true },
    { id: "9", icon: "Users", title: "Thriving Trader Community", description: "Join a global community of competitive traders. Share strategies, follow top performers, and learn from the best in real-time activity feeds.", enabled: true },
  ],

  // How It Works
  howItWorksEnabled: true,
  howItWorksTitle: "From Sign-Up to Victory in Minutes",
  howItWorksSubtitle: "Your path to the top of the leaderboard",
  howItWorksSteps: [
    { id: "1", step: 1, icon: "UserPlus", title: "Create Your Free Account", description: "Sign up in under 60 seconds with just your email. No credit card required, no hidden fees — instant access to the full trading arena.", enabled: true },
    { id: "2", step: 2, icon: "Trophy", title: "Pick Your Battlefield", description: "Choose from daily sprint tournaments, weekly marathons, or intense 1v1 duels. Filter by entry fee, prize pool, or trading pairs to find your perfect match.", enabled: true },
    { id: "3", step: 3, icon: "TrendingUp", title: "Trade Like a Pro", description: "Execute trades on real-time market data using professional charts and tools. Deploy your strategy across 28+ forex pairs with zero financial risk.", enabled: true },
    { id: "4", step: 4, icon: "Award", title: "Claim Your Prizes", description: "Finish at the top of the leaderboard and withdraw your winnings instantly. Earn badges, XP, and seasonal rewards as you build your legacy.", enabled: true },
  ],

  // Competitions
  competitionsEnabled: true,
  competitionsTitle: "Trading Competitions",
  competitionsSubtitle: "🏆 Where Legends Are Made",
  competitionsDescription:
    "Join thousands of traders in high-stakes tournaments with real cash prizes. From 5-minute blitz rounds to month-long marathons — there's a competition for every trading style. Enter now and prove you have what it takes.",
  competitionsCTAText: "Browse Competitions",
  competitionsCTALink: "/competitions",

  // Challenges
  challengesEnabled: true,
  challengesTitle: "1v1 Trading Duels",
  challengesSubtitle: "⚔️ Settle It Head-to-Head",
  challengesDescription:
    "Think you're better than another trader? Prove it. Challenge anyone to a direct 1v1 duel — choose the stake, set the rules, and let the market decide the winner. No luck, just pure skill.",
  challengesCTAText: "Challenge a Trader",
  challengesCTALink: "/challenges",

  // CTA
  ctaEnabled: true,
  ctaTitle: "Your Next Trade Could Change Everything",
  ctaSubtitle: "Join 10,000+ traders already competing",
  ctaDescription:
    "Create your free account in under 60 seconds. No credit card. No risk. Just pure competitive trading. The leaderboard is waiting — are you ready to claim your spot?",
  ctaButtonText: "Start Competing Now — It's Free",
  ctaButtonLink: "/sign-up",

  // ── Game Master ──────────────────────────────────────────
  gameMasterEnabled: true,
  gameMasterTitle: "BECOME A GAME MASTER",
  gameMasterSubtitle: "Host competitions. Build a business. Earn from every trade.",
  gameMasterDescription: "Game Masters are the entrepreneurial backbone of the platform. Subscribe to a GM plan, create events, invite players, and earn referral fees from every prize pool.",
  gameMasterBenefits: [
    { id: "gm1", icon: "Crown", title: "Host Your Own Tournaments", description: "Create competitions with custom rules, entry fees, prize pools, and ranking methods.", enabled: true, order: 1 },
    { id: "gm2", icon: "DollarSign", title: "Earn Referral Fees", description: "Earn a percentage of every prize pool when your referred users compete.", enabled: true, order: 2 },
    { id: "gm3", icon: "Users", title: "Build Your Community", description: "Invite traders, grow your player base, and track engagement with built-in analytics.", enabled: true, order: 3 },
    { id: "gm4", icon: "Swords", title: "Create 1v1 Challenges", description: "Set up head-to-head challenges for your players with any ranking method.", enabled: true, order: 4 },
    { id: "gm5", icon: "BarChart3", title: "Revenue Dashboard", description: "Track your earnings, player activity, and competition performance.", enabled: true, order: 5 },
    { id: "gm6", icon: "Rocket", title: "Scale Without Limits", description: "No cap on competitions or players. Upgrade your GM subscription for premium features.", enabled: true, order: 6 },
  ],
  gameMasterCTAText: "Become a Game Master",
  gameMasterCTALink: "/sign-up",

  // ── Competition Types ──────────────────────────────────
  competitionTypesEnabled: true,
  competitionTypesTitle: "6 WAYS TO COMPETE",
  competitionTypesSubtitle: "Choose your battlefield. Every competition type tests a different edge.",
  competitionTypesDescription: "Whether you are a steady grinder, a high-risk sniper, or a consistency machine — there is a format designed for your style.",
  competitionTypes: [
    { id: "pnl", icon: "TrendingUp", name: "P&L (Profit & Loss)", description: "The trader with the highest net profit at the end wins.", color: "#10b981", enabled: true },
    { id: "roi", icon: "Target", name: "ROI (Return on Investment)", description: "Best percentage return wins — regardless of starting capital.", color: "#8b5cf6", enabled: true },
    { id: "win_rate", icon: "Award", name: "Win Rate", description: "Highest percentage of profitable trades takes the crown.", color: "#f59e0b", enabled: true },
    { id: "total_capital", icon: "Coins", name: "Total Capital", description: "Grow your portfolio to the maximum account balance.", color: "#3b82f6", enabled: true },
    { id: "total_wins", icon: "Flame", name: "Total Wins", description: "Most winning trades dominates. Every green trade counts.", color: "#ef4444", enabled: true },
    { id: "profit_factor", icon: "Shield", name: "Profit Factor", description: "Ratio of gross profit to gross loss determines the champion.", color: "#06b6d4", enabled: true },
  ],

  // ── Journey & Badges ───────────────────────────────────
  journeyBadgesEnabled: true,
  journeyBadgesTitle: "YOUR TRADING JOURNEY",
  journeyBadgesSubtitle: "Level up, earn badges, and climb the ranks",
  journeyBadgesDescription: "Every trade brings you closer to the next milestone. Track your progression, unlock achievements, and prove your trading mastery.",
  journeyBadgeFeatures: [
    { id: "jb1", icon: "Map", gameIcon: "/game-icons/19. Maps.png", title: "Trading Journey Map", description: "Follow a visual progression through zones — from Rookie to Legend.", enabled: true, order: 1 },
    { id: "jb2", icon: "Award", gameIcon: "/game-icons/9. STAR AWARD.png", title: "Collectible Badges", description: "Earn badges for milestones like first win, 100 trades, competition champion.", enabled: true, order: 2 },
    { id: "jb3", icon: "Zap", gameIcon: "/game-icons/energi potion.png", title: "XP & Level System", description: "Every trade earns XP. Level up through tiered ranks and unlock perks.", enabled: true, order: 3 },
    { id: "jb4", icon: "Trophy", gameIcon: "/game-icons/16. Crown.png", title: "Prestige Ranks", description: "Rise from Bronze to Diamond and beyond. Higher ranks unlock exclusives.", enabled: true, order: 4 },
    { id: "jb5", icon: "Sparkles", gameIcon: "/game-icons/4. Gems.png", title: "Achievement System", description: "Hidden and visible achievements track your trading prowess.", enabled: true, order: 5 },
    { id: "jb6", icon: "Users", gameIcon: "/game-icons/3. GOLD MEDAL.png", title: "Seasonal Leaderboards", description: "Compete for seasonal rankings and earn exclusive seasonal badges.", enabled: true, order: 6 },
  ],
  journeyBadgesCTAText: "Start Your Journey",
  journeyBadgesCTALink: "/sign-up",

  // ── Marketplace ────────────────────────────────────────
  marketplaceEnabled: true,
  marketplaceTitle: "TRADING ARSENAL",
  marketplaceSubtitle: "Upgrade your style",
  marketplaceDescription: "Customize your trading experience with exclusive items, boosters, and premium tools from the marketplace.",
  marketplaceItems: [
    { id: "mp1", icon: "Sparkles", gameIcon: "/game-icons/helmet 1.png", name: "Premium Avatars", description: "Stand out with exclusive animated avatars and profile frames.", price: "From 50 Credits", enabled: true, order: 1 },
    { id: "mp2", icon: "Gem", gameIcon: "/game-icons/14. STAR BADGE.png", name: "Exclusive Badges", description: "Collector badges that showcase your achievements. Limited edition designs.", price: "From 100 Credits", enabled: true, order: 2 },
    { id: "mp3", icon: "Star", gameIcon: "/game-icons/technology 3.png", name: "Trading Indicators", description: "Advanced technical indicators and overlays for your competitive edge.", price: "From 200 Credits", enabled: true, order: 3 },
    { id: "mp4", icon: "ShoppingBag", gameIcon: "/game-icons/chest 2.png", name: "Chart Themes", description: "Custom chart color schemes and visual themes for trading in style.", price: "From 75 Credits", enabled: true, order: 4 },
    { id: "mp5", icon: "DollarSign", gameIcon: "/game-icons/lightning potion.png", name: "XP Boosters", description: "Temporary boosts that multiply your XP earnings.", price: "From 150 Credits", enabled: true, order: 5 },
    { id: "mp6", icon: "Star", gameIcon: "/game-icons/16. Crown.png", name: "Game Master Packages", description: "Everything you need to start hosting competitions.", price: "From 500 Credits", enabled: true, order: 6 },
  ],
  marketplaceCTAText: "Browse Marketplace",
  marketplaceCTALink: "/marketplace",

  // ── FAQ ────────────────────────────────────────────────
  faqEnabled: true,
  faqTitle: "Frequently Asked Questions",
  faqSubtitle: "Everything you need to know about competitive trading",
  faqItems: [
    { id: "faq1", question: "What is competitive trading?", answer: "Competitive trading lets you pit your forex trading skills against other traders in organized competitions and 1v1 challenges. Trade with virtual capital, compete on metrics like P&L, ROI, or Win Rate, and win real prize pools.", category: "general", order: 1, enabled: true },
    { id: "faq2", question: "How do competitions work?", answer: "Competitions have a fixed start and end time, an entry fee, and a prize pool. You trade forex during the competition window, and your performance is ranked against other participants.", category: "competitions", order: 2, enabled: true },
    { id: "faq3", question: "What competition types are available?", answer: "We offer 6 ranking methods: P&L, ROI, Win Rate, Total Capital, Total Wins, and Profit Factor. Each format tests a different trading skill.", category: "competitions", order: 3, enabled: true },
    { id: "faq4", question: "What are 1v1 challenges?", answer: "Challenges are head-to-head trading battles between two traders. Challenge any player, set the stake and ranking method, and trade in real-time.", category: "challenges", order: 4, enabled: true },
    { id: "faq5", question: "What is a Game Master?", answer: "Game Masters host their own competitions and challenges, invite players, and earn referral fees from every prize pool.", category: "game-master", order: 5, enabled: true },
    { id: "faq6", question: "Is real money at risk?", answer: "Trading uses virtual capital — you don't risk real funds on trades. However, entry fees use platform credits that you purchase.", category: "general", order: 6, enabled: true },
    { id: "faq7", question: "How are winners determined?", answer: "Winners are determined by the competition's ranking method. Tiebreaker rules apply if there's a tie. Prize distribution is automatic.", category: "competitions", order: 7, enabled: true },
    { id: "faq8", question: "Can I withdraw my winnings?", answer: "Yes. Prize winnings are credited to your wallet and can be withdrawn to your bank account.", category: "general", order: 8, enabled: true },
  ],

  // ── Simple Sections ────────────────────────────────────
  liveStatsEnabled: true,
  leaderboardEnabled: true,
  leaderboardTitle: "TOP TRADERS",
  leaderboardSubtitle: "The elite of the elite",
  activityFeedEnabled: true,
  testimonialsEnabled: true,
  testimonialsTitle: "TRADER TESTIMONIALS",
  testimonialsSubtitle: "What champions say",
  testimonials: [
    { id: "test1", name: "Alex M.", role: "Competition Champion", avatar: "", content: "I turned a €10 entry fee into €150 in a single P&L competition. The rush is real — and the platform makes it effortless to compete. Best trading experience I have ever had.", rating: 5, enabled: true, order: 1 },
    { id: "test2", name: "Sarah K.", role: "Game Master", avatar: "", content: "As a Game Master I host weekly competitions for my community. The referral fees alone cover my subscription — everything else is pure profit. It is a genuine business opportunity.", rating: 5, enabled: true, order: 2 },
    { id: "test3", name: "Marcus T.", role: "Forex Trader", avatar: "", content: "The 1v1 challenge system is addictive. Nothing sharpens your trading like knowing someone is watching every pip. My win rate has improved dramatically since I started competing.", rating: 5, enabled: true, order: 3 },
    { id: "test4", name: "Priya R.", role: "Win Rate Specialist", avatar: "", content: "I love that there are different competition types. Win Rate competitions reward consistency, not just big bets. It completely changed how I approach risk management.", rating: 4, enabled: true, order: 4 },
    { id: "test5", name: "David L.", role: "Leaderboard Regular", avatar: "", content: "The journey and badge system keeps me coming back every day. Watching my XP grow and unlocking new ranks feels like levelling up in a game — except the prizes are real cash.", rating: 5, enabled: true, order: 5 },
  ],
  trustBadgesEnabled: true,
  trustBadgesTitle: "Trusted By Traders Worldwide",
  trustBadges: [
    { id: "tb1", type: "security" as const, name: "SSL Encrypted", logo: "", url: "", enabled: true },
    { id: "tb2", type: "security" as const, name: "2FA Protected", logo: "", url: "", enabled: true },
    { id: "tb3", type: "security" as const, name: "GDPR Compliant", logo: "", url: "", enabled: true },
    { id: "tb4", type: "partner" as const, name: "Massive.com Data", logo: "", url: "", enabled: true },
    { id: "tb5", type: "award" as const, name: "Best Trading Platform 2026", logo: "", url: "", enabled: true },
  ],
  // Reason: Must match the canonical order in hero-settings.defaults.ts
  sectionOrder: [
    "hero", "liveStats", "stats", "features", "howItWorks", "gameMaster",
    "competitionTypes", "competitions", "challenges", "activityFeed",
    "leaderboard", "journeyBadges", "marketplace", "testimonials",
    "trustBadges", "faq", "cta",
  ],

  // Footer
  footerEnabled: true,
  footerCopyright: "© {YEAR} ChartVolt. All rights reserved.",
  footerDisclaimer:
    "ChartVolt is a competitive trading platform that uses virtual currency for educational and entertainment purposes. Results from virtual trading do not guarantee real-world performance.",
  footerRiskDisclaimer:
    "Trading in financial markets involves substantial risk of loss and is not suitable for every investor. The valuation of financial instruments may fluctuate, and as a result, traders may lose more than their original investment. Past performance is not indicative of future results. All trading strategies are used at your own risk. This platform is for educational and entertainment purposes only. Virtual currency used on this platform has no real monetary value.",
  footerMenuPlatform: [
    { id: "1", label: "Competitions", href: "/competitions", enabled: true },
    { id: "2", label: "Challenges", href: "/challenges", enabled: true },
    { id: "3", label: "Leaderboard", href: "/leaderboard", enabled: true },
    { id: "4", label: "Marketplace", href: "/marketplace", enabled: true },
  ],
  footerMenuSupport: [
    { id: "1", label: "Help Center", href: "/help", enabled: true },
    { id: "2", label: "Contact Us", href: "mailto:support@chartvolt.com", enabled: true },
    { id: "3", label: "Terms of Service", href: "/terms", enabled: true },
    { id: "4", label: "Privacy Policy", href: "/privacy", enabled: true },
  ],
  footerMenuBusiness: [
    { id: "1", label: "Enterprise Solutions", href: "/enterprise", enabled: true },
    { id: "2", label: "Pricing", href: "/enterprise#pricing", enabled: true },
    { id: "3", label: "Contact Sales", href: "/enterprise#contact", enabled: true },
  ],

  // Enterprise
  enterpriseHeroTitle: "Launch Your Own Trading Competition Platform",
  enterpriseHeroSubtitle: "Enterprise White-Label Solutions",
  enterpriseHeroDescription:
    "Deploy a fully branded, production-ready trading competition platform in weeks — not months. Complete with real-time price feeds, advanced admin panel, competition engine, and everything you need to engage and monetize a global audience of traders.",
  enterpriseHeroBadge: "🏢 Enterprise White-Label",
  enterpriseHeroCTAText: "Request a Live Demo",
  enterpriseHeroCTALink: "#contact",

  enterpriseWhiteLabelEnabled: true,
  enterpriseWhiteLabelTitle: "Your Brand. Your Platform. Our Technology.",
  enterpriseWhiteLabelSubtitle:
    "Everything you need to launch a world-class trading arena under your own brand",
  enterpriseWhiteLabelFeatures: [
    { id: "1", icon: "Palette", title: "Complete Brand Customization", description: "Your logo, colors, fonts, and styling everywhere — from the landing page to email notifications. Fully white-labeled, zero ChartVolt branding.", enabled: true },
    { id: "2", icon: "Globe", title: "Custom Domain & SSL", description: "Run on your own domain (e.g., arena.yourbrand.com) with enterprise-grade SSL encryption and CDN-backed global delivery.", enabled: true },
    { id: "3", icon: "Mail", title: "Branded Communications", description: "Automated email templates, transactional emails, and notification systems — all branded with your identity and customizable via the admin panel.", enabled: true },
    { id: "4", icon: "Code", title: "REST API & Webhooks", description: "Full API access for third-party integrations, custom analytics pipelines, and webhook events for real-time platform monitoring.", enabled: true },
    { id: "5", icon: "Server", title: "Dedicated Infrastructure", description: "Isolated servers, dedicated database instances, and guaranteed uptime SLAs. Your platform runs independently for maximum performance and security.", enabled: true },
    { id: "6", icon: "Headphones", title: "24/7 Priority Support & Onboarding", description: "Dedicated account manager, priority support queue, and comprehensive onboarding — from setup to your first live competition.", enabled: true },
  ],

  enterpriseAdminEnabled: true,
  enterpriseAdminTitle: "The Most Powerful Admin Panel in Trading",
  enterpriseAdminSubtitle: "Complete Operations Control Center",
  enterpriseAdminDescription:
    "Manage every aspect of your platform from a single, intuitive dashboard — users, competitions, payments, content, and more. Built for operators who demand total control.",
  enterpriseAdminFeatures: [
    { id: "1", icon: "BarChart3", title: "Real-Time Analytics Dashboard", description: "Live user metrics, revenue tracking, competition performance, and engagement analytics — all visualized with professional charts and exportable reports.", color: "from-cyan-500 to-blue-600", enabled: true },
    { id: "2", icon: "Users", title: "Advanced User Management", description: "Full user lifecycle control — KYC verification, role-based access, wallet management, activity logs, and automated restriction systems.", color: "from-purple-500 to-pink-600", enabled: true },
    { id: "3", icon: "Trophy", title: "Competition Engine", description: "Create unlimited competition types — tournaments, leagues, 1v1 duels, and custom formats. Configure entry fees, prize pools, rules, and schedules with granular control.", color: "from-yellow-500 to-orange-600", enabled: true },
    { id: "4", icon: "Shield", title: "Fraud Detection & Security", description: "AI-powered anomaly detection, IP tracking, multi-account prevention, and real-time risk scoring — protecting your platform and your users around the clock.", color: "from-red-500 to-rose-600", enabled: true },
  ],

  enterprisePricingEnabled: true,
  enterprisePricingTitle: "Transparent, Scalable Pricing",
  enterprisePricingSubtitle:
    "Plans that grow with your business — from startup to global scale",
  enterprisePricingTiers: [
    { id: "1", name: "Starter", price: "$499", period: "/month", description: "Perfect for communities and startups", features: ["Up to 1,000 active users", "Basic admin panel", "5 concurrent competitions", "Email support (48h SLA)", "Standard branding options"], ctaText: "Start Free Trial", highlighted: false, enabled: true },
    { id: "2", name: "Professional", price: "$1,499", period: "/month", description: "For growing platforms and brokers", features: ["Up to 10,000 active users", "Full admin + analytics", "Unlimited competitions", "Priority support (4h SLA)", "Complete white-label branding", "Custom domain & SSL", "API access & webhooks"], ctaText: "Start 14-Day Trial", highlighted: true, enabled: true },
    { id: "3", name: "Enterprise", price: "Custom", period: "", description: "For global operators and institutions", features: ["Unlimited users", "Full white-label solution", "Dedicated servers & SLA", "24/7 dedicated support", "Custom integrations", "Onboarding & training", "Source code escrow"], ctaText: "Talk to Sales", highlighted: false, enabled: true },
  ],

  enterpriseContactEnabled: true,
  enterpriseContactTitle: "Ready to Launch Your Trading Platform?",
  enterpriseContactSubtitle:
    "Get a personalized demo and custom proposal from our enterprise team",
  enterpriseContactEmail: "enterprise@chartvolt.com",
  enterpriseContactPhone: "+1 (234) 567-890",
  enterpriseContactCTAText: "Schedule a Live Demo",
};
