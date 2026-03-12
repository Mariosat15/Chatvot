// ─── Landing Page Builder — Shared Types & Constants ──────────────────────

// ─── Interfaces ───────────────────────────────────────────────────────────

export interface HolidayScheduleItem {
  id: string;
  name: string;
  themeId: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  enabled: boolean;
}

export interface GlobalThemeEffects {
  particlesEnabled: boolean;
  glowEffectsEnabled: boolean;
  animationsEnabled: boolean;
  snowIntensity: number;
  bloodIntensity: number;
  confettiIntensity: number;
}

export interface CustomTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  headingFont: string;
}

export interface LandingSettings {
  // Theme
  activeTheme: string;
  holidayThemesEnabled: boolean;
  holidaySchedule: HolidayScheduleItem[];
  globalThemeEffects: GlobalThemeEffects;
  customThemeEnabled: boolean;
  customTheme: CustomTheme;

  // Global
  enterprisePageEnabled: boolean;

  // Hero Section
  heroEnabled: boolean;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  heroBadgeText: string;
  heroPrimaryCTAText: string;
  heroPrimaryCTALink: string;
  heroSecondaryCTAText: string;
  heroSecondaryCTALink: string;
  heroParticlesEnabled: boolean;

  // Stats Section
  statsEnabled: boolean;
  statsAnimated: boolean;
  stats: Array<{
    id: string;
    value: string;
    suffix: string;
    label: string;
    icon: string;
    enabled: boolean;
  }>;

  // Features Section
  featuresEnabled: boolean;
  featuresTitle: string;
  featuresSubtitle: string;
  features: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    enabled: boolean;
  }>;

  // How It Works Section
  howItWorksEnabled: boolean;
  howItWorksTitle: string;
  howItWorksSubtitle: string;
  howItWorksSteps: Array<{
    id: string;
    step: number;
    icon: string;
    title: string;
    description: string;
    enabled: boolean;
  }>;

  // Competitions Section
  competitionsEnabled: boolean;
  competitionsTitle: string;
  competitionsSubtitle: string;
  competitionsDescription: string;
  competitionsCTAText: string;
  competitionsCTALink: string;

  // Challenges Section
  challengesEnabled: boolean;
  challengesTitle: string;
  challengesSubtitle: string;
  challengesDescription: string;
  challengesCTAText: string;
  challengesCTALink: string;

  // Final CTA Section
  ctaEnabled: boolean;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaDescription: string;
  ctaButtonText: string;
  ctaButtonLink: string;

  // ── Game Master Section ──────────────────────────────────
  gameMasterEnabled: boolean;
  gameMasterTitle: string;
  gameMasterSubtitle: string;
  gameMasterDescription: string;
  gameMasterBenefits: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    enabled: boolean;
    order: number;
  }>;
  gameMasterCTAText: string;
  gameMasterCTALink: string;

  // ── Competition Types Section ──────────────────────────
  competitionTypesEnabled: boolean;
  competitionTypesTitle: string;
  competitionTypesSubtitle: string;
  competitionTypesDescription: string;
  competitionTypes: Array<{
    id: string;
    icon: string;
    name: string;
    description: string;
    color: string;
    enabled: boolean;
  }>;

  // ── Journey & Badges Section ───────────────────────────
  journeyBadgesEnabled: boolean;
  journeyBadgesTitle: string;
  journeyBadgesSubtitle: string;
  journeyBadgesDescription: string;
  journeyBadgeFeatures: Array<{
    id: string;
    icon: string;
    gameIcon: string;
    title: string;
    description: string;
    enabled: boolean;
    order: number;
  }>;
  journeyBadgesCTAText: string;
  journeyBadgesCTALink: string;

  // ── Marketplace Section ────────────────────────────────
  marketplaceEnabled: boolean;
  marketplaceTitle: string;
  marketplaceSubtitle: string;
  marketplaceDescription: string;
  marketplaceItems: Array<{
    id: string;
    icon: string;
    gameIcon: string;
    name: string;
    description: string;
    price: string;
    enabled: boolean;
    order: number;
  }>;
  marketplaceCTAText: string;
  marketplaceCTALink: string;

  // ── FAQ Section ────────────────────────────────────────
  faqEnabled: boolean;
  faqTitle: string;
  faqSubtitle: string;
  faqItems: Array<{
    id: string;
    question: string;
    answer: string;
    category: string;
    order: number;
    enabled: boolean;
  }>;

  // ── Simple Sections (visibility + title/subtitle) ──────
  liveStatsEnabled: boolean;
  leaderboardEnabled: boolean;
  leaderboardTitle: string;
  leaderboardSubtitle: string;
  activityFeedEnabled: boolean;
  testimonialsEnabled: boolean;
  testimonialsTitle: string;
  testimonialsSubtitle: string;
  trustBadgesEnabled: boolean;
  trustBadgesTitle: string;

  // Section ordering
  sectionOrder: string[];

  // Footer Section
  footerEnabled: boolean;
  footerCopyright: string;
  footerDisclaimer: string;
  footerRiskDisclaimer: string;
  footerMenuPlatform: Array<{
    id: string;
    label: string;
    href: string;
    enabled: boolean;
  }>;
  footerMenuSupport: Array<{
    id: string;
    label: string;
    href: string;
    enabled: boolean;
  }>;
  footerMenuBusiness: Array<{
    id: string;
    label: string;
    href: string;
    enabled: boolean;
  }>;

  // ========== ENTERPRISE PAGE ==========
  enterpriseHeroTitle: string;
  enterpriseHeroSubtitle: string;
  enterpriseHeroDescription: string;
  enterpriseHeroBadge: string;
  enterpriseHeroCTAText: string;
  enterpriseHeroCTALink: string;

  enterpriseWhiteLabelEnabled: boolean;
  enterpriseWhiteLabelTitle: string;
  enterpriseWhiteLabelSubtitle: string;
  enterpriseWhiteLabelFeatures: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    enabled: boolean;
  }>;

  enterpriseAdminEnabled: boolean;
  enterpriseAdminTitle: string;
  enterpriseAdminSubtitle: string;
  enterpriseAdminDescription: string;
  enterpriseAdminFeatures: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    color: string;
    enabled: boolean;
  }>;

  enterprisePricingEnabled: boolean;
  enterprisePricingTitle: string;
  enterprisePricingSubtitle: string;
  enterprisePricingTiers: Array<{
    id: string;
    name: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    ctaText: string;
    highlighted: boolean;
    enabled: boolean;
  }>;

  enterpriseContactEnabled: boolean;
  enterpriseContactTitle: string;
  enterpriseContactSubtitle: string;
  enterpriseContactEmail: string;
  enterpriseContactPhone: string;
  enterpriseContactCTAText: string;
}

// ─── Shared Props for Child Components ────────────────────────────────────

export interface BuilderChildProps {
  settings: LandingSettings;
  updateField: <K extends keyof LandingSettings>(
    key: K,
    value: LandingSettings[K],
  ) => void;
  addItem: <K extends keyof LandingSettings>(
    key: K,
    newItem: LandingSettings[K] extends Array<infer T> ? T : never,
  ) => void;
  removeItem: <K extends keyof LandingSettings>(
    key: K,
    id: string,
  ) => void;
  updateArrayItem: <K extends keyof LandingSettings>(
    key: K,
    id: string,
    updates: Partial<LandingSettings[K] extends Array<infer T> ? T : never>,
  ) => void;
}

// Reason: HeroSectionEditors.tsx and ContentSectionEditors.tsx import EditorProps.
export type EditorProps = BuilderChildProps;

// ─── Constants ────────────────────────────────────────────────────────────

export const availableIcons = [
  "Trophy",
  "Swords",
  "Users",
  "TrendingUp",
  "DollarSign",
  "Zap",
  "Award",
  "BarChart3",
  "ShoppingBag",
  "Star",
  "Shield",
  "Globe",
  "Rocket",
  "Target",
  "Crown",
  "Flame",
  "Lock",
  "LineChart",
  "Wallet",
  "Gamepad2",
];

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Build the preview URL pointing to the main app (not admin). */
export function getMainAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    if (origin.includes("admin.")) {
      return origin.replace("admin.", "").replace(/\/+$/, "");
    }
    return origin.replace(/:\d+$/, ":3000").replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}
