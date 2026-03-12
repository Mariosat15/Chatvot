export interface HeroSettings {
  siteName: string;
  tagline: string;
  logo?: string;
  activeTheme?: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  heroAnimationType: string;
  heroParticlesConfig: { enabled: boolean; color: string; count: number };
  heroCTAButtons: Array<{
    id: string;
    text: string;
    href: string;
    style: string;
    icon?: string;
    enabled: boolean;
  }>;
  featuresTitle: string;
  featuresSubtitle: string;
  features: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    color: string;
    enabled: boolean;
  }>;
  stats: Array<{
    id: string;
    label: string;
    value: string;
    suffix: string;
    icon: string;
    color: string;
    enabled: boolean;
  }>;
  statsAnimated: boolean;
  howItWorksTitle: string;
  howItWorksSubtitle: string;
  howItWorksSteps: Array<{
    id: string;
    step: number;
    title: string;
    description: string;
    icon: string;
    enabled: boolean;
  }>;
  competitionsTitle: string;
  competitionsSubtitle: string;
  competitionsDescription: string;
  competitionsCTAText: string;
  competitionsCTALink: string;
  challengesTitle: string;
  challengesSubtitle: string;
  challengesDescription: string;
  challengesCTAText: string;
  challengesCTALink: string;
  // Game Master Showcase
  gameMasterTitle?: string;
  gameMasterSubtitle?: string;
  gameMasterDescription?: string;
  gameMasterBenefits?: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    enabled: boolean;
    order: number;
  }>;
  gameMasterCTAText?: string;
  gameMasterCTALink?: string;
  // Competition Types Showcase
  competitionTypesTitle?: string;
  competitionTypesSubtitle?: string;
  competitionTypesDescription?: string;
  competitionTypes?: Array<{
    id: string;
    icon: string;
    name: string;
    description: string;
    color: string;
    enabled: boolean;
  }>;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaDescription: string;
  ctaButtonText: string;
  ctaButtonLink: string;
  // Journey & Badge Showcase
  journeyBadgesTitle?: string;
  journeyBadgesSubtitle?: string;
  journeyBadgesDescription?: string;
  journeyBadgeFeatures?: Array<{
    id: string;
    icon: string;
    gameIcon?: string;
    title: string;
    description: string;
    enabled: boolean;
    order: number;
  }>;
  journeyBadgesCTAText?: string;
  journeyBadgesCTALink?: string;
  // Marketplace Showcase
  marketplaceTitle?: string;
  marketplaceSubtitle?: string;
  marketplaceDescription?: string;
  marketplaceItems?: Array<{
    id: string;
    icon: string;
    gameIcon?: string;
    name: string;
    description: string;
    price: string;
    enabled: boolean;
    order: number;
  }>;
  marketplaceCTAText?: string;
  marketplaceCTALink?: string;
  sectionVisibility: {
    hero: boolean;
    features: boolean;
    stats: boolean;
    liveStats?: boolean;
    howItWorks: boolean;
    gameMaster?: boolean;
    competitionTypes?: boolean;
    competitions: boolean;
    challenges: boolean;
    leaderboard?: boolean;
    activityFeed?: boolean;
    marketplace?: boolean;
    journeyBadges?: boolean;
    testimonials?: boolean;
    trustBadges?: boolean;
    faq?: boolean;
    cta: boolean;
    footer: boolean;
  };
  // Trust Badges
  trustBadges?: Array<{
    id: string;
    type: "security" | "partner" | "press" | "award";
    name: string;
    logo: string;
    url?: string;
    enabled: boolean;
  }>;
  trustBadgesTitle?: string;
  // Live Data Settings
  liveDataSettings?: {
    showRealStats?: boolean;
    showActivityFeed?: boolean;
    showLeaderboardPreview?: boolean;
    activityFeedRefreshRate?: number;
    statsRefreshRate?: number;
  };
  // Testimonials
  testimonialsTitle?: string;
  testimonialsSubtitle?: string;
  testimonials?: Array<{
    id: string;
    name: string;
    role: string;
    avatar: string;
    content: string;
    rating: number;
    enabled: boolean;
    order: number;
  }>;
  // FAQ
  faqTitle?: string;
  faqSubtitle?: string;
  faqItems?: Array<{
    id: string;
    question: string;
    answer: string;
    category: string;
    order: number;
    enabled: boolean;
  }>;
  footerCopyright: string;
  footerDisclaimer?: string;
  footerRiskDisclaimer?: string;
  footerMenus?: {
    platform: Array<{ label: string; href: string; enabled: boolean }>;
    support: Array<{ label: string; href: string; enabled: boolean }>;
    business: Array<{ label: string; href: string; enabled: boolean }>;
  };
  // Theme & Effects
  holidayThemesEnabled?: boolean;
  holidaySchedule?: Array<{
    id: string;
    name: string;
    themeId: string;
    startMonth: number;
    startDay: number;
    endMonth: number;
    endDay: number;
    enabled: boolean;
  }>;
  globalThemeEffects?: {
    particlesEnabled?: boolean;
    glowEffectsEnabled?: boolean;
    animationsEnabled?: boolean;
    snowIntensity?: number;
    bloodIntensity?: number;
    confettiIntensity?: number;
  };
  customThemeEnabled?: boolean;
  customTheme?: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    textColor?: string;
    borderColor?: string;
    headingFont?: string;
  };
}
