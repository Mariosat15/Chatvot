import { Document } from "mongoose";

// Theme preset interface
export interface IThemePreset {
  id: string;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  gradientFrom: string;
  gradientTo: string;
  fontFamily: string;
  buttonStyle: "solid" | "gradient" | "outline" | "glow";
  cardStyle: "glassmorphism" | "solid" | "gradient" | "neon";
  animationStyle: "minimal" | "dynamic" | "cinematic";
}

// Feature card interface
export interface IFeatureCard {
  id: string;
  icon: string; // Icon name from Lucide icons
  title: string;
  description: string;
  color: string;
  order: number;
  enabled: boolean;
}

// Testimonial interface
export interface ITestimonial {
  id: string;
  name: string;
  role: string;
  avatar: string;
  content: string;
  rating: number;
  enabled: boolean;
  order: number;
}

// Stats counter interface
export interface IStatCounter {
  id: string;
  label: string;
  value: string;
  suffix: string;
  icon: string;
  color: string;
  enabled: boolean;
  order: number;
}

// CTA (Call to Action) button interface
export interface ICTAButton {
  id: string;
  text: string;
  href: string;
  style: "primary" | "secondary" | "outline" | "ghost";
  icon?: string;
  enabled: boolean;
}

// Section visibility
export interface ISectionVisibility {
  hero: boolean;
  features: boolean;
  stats: boolean;
  liveStats: boolean;
  howItWorks: boolean;
  gameMaster: boolean;
  competitionTypes: boolean;
  competitions: boolean;
  challenges: boolean;
  leaderboard: boolean;
  activityFeed: boolean;
  marketplace: boolean;
  journeyBadges: boolean;
  testimonials: boolean;
  trustBadges: boolean;
  adminShowcase: boolean;
  whiteLabel: boolean;
  pricing: boolean;
  faq: boolean;
  cta: boolean;
  footer: boolean;
}

// How it works step
export interface IHowItWorksStep {
  id: string;
  step: number;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
}

// FAQ item
export interface IFAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  enabled: boolean;
}

// Trust badge interface
export interface ITrustBadge {
  id: string;
  type: "security" | "partner" | "press" | "award";
  name: string;
  logo: string;
  url?: string;
  enabled: boolean;
}

// Case study interface
export interface ICaseStudy {
  id: string;
  companyName: string;
  companyLogo: string;
  industry: string;
  quote: string;
  quotePerson: string;
  quoteTitle: string;
  metrics: { label: string; value: string }[];
  enabled: boolean;
  order: number;
}

// Live data settings interface
export interface ILiveDataSettings {
  showRealStats: boolean;
  showActivityFeed: boolean;
  showLeaderboardPreview: boolean;
  activityFeedRefreshRate: number;
  statsRefreshRate: number;
}

// Pricing tier
export interface IPricingTier {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted: boolean;
  buttonText: string;
  buttonHref: string;
  enabled: boolean;
  order: number;
}

// Admin showcase feature
export interface IAdminShowcaseFeature {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: "analytics" | "management" | "security" | "customization";
  enabled: boolean;
  order: number;
}

// White label feature
export interface IWhiteLabelFeature {
  id: string;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
  order: number;
}

// Footer section
export interface IFooterSection {
  id: string;
  title: string;
  links: { label: string; href: string }[];
  enabled: boolean;
  order: number;
}

// Social link
export interface ISocialLink {
  id: string;
  platform: string;
  url: string;
  icon: string;
  enabled: boolean;
}

// Main Hero Settings interface
export interface IHeroSettings extends Document {
  // General Settings
  isActive: boolean;
  enterprisePageEnabled: boolean;
  heroBadgeText: string;
  lastUpdated: Date;
  updatedBy: string;

  // Branding
  siteName: string;
  tagline: string;
  description: string;
  logo: string;
  favicon: string;

  // Theme
  activeTheme: string; // Theme preset ID
  customThemeEnabled: boolean;
  customTheme: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    headingFont: string;
  };
  globalThemeEffects: {
    particlesEnabled: boolean;
    glowEffectsEnabled: boolean;
    animationsEnabled: boolean;
    snowIntensity: number;
    bloodIntensity: number;
    confettiIntensity: number;
  };
  holidayThemesEnabled: boolean;
  holidaySchedule: Array<{
    id: string;
    name: string;
    themeId: string;
    startMonth: number;
    startDay: number;
    endMonth: number;
    endDay: number;
    enabled: boolean;
  }>;
  themeCustomizations: Record<string, unknown>;

  // Hero Section
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  heroBackgroundImage: string;
  heroBackgroundVideo: string;
  heroBackgroundType: "color" | "gradient" | "image" | "video" | "particles";
  heroParticlesConfig: {
    enabled: boolean;
    color: string;
    count: number;
    speed: number;
    shape: "circle" | "square" | "triangle" | "star";
  };
  heroCTAButtons: ICTAButton[];
  heroAnimationType: "fade" | "slide" | "zoom" | "typewriter" | "glitch";

  // Features Section
  featuresTitle: string;
  featuresSubtitle: string;
  features: IFeatureCard[];
  featuresLayout: "grid" | "carousel" | "masonry";
  featuresColumns: 2 | 3 | 4;

  // Stats Section
  statsTitle: string;
  statsSubtitle: string;
  stats: IStatCounter[];
  statsBackground: string;
  statsAnimated: boolean;

  // How It Works Section
  howItWorksTitle: string;
  howItWorksSubtitle: string;
  howItWorksSteps: IHowItWorksStep[];
  howItWorksLayout: "timeline" | "cards" | "steps";

  // Competitions Showcase
  competitionsTitle: string;
  competitionsSubtitle: string;
  competitionsDescription: string;
  competitionsCTAText: string;
  competitionsCTALink: string;
  competitionsShowcase: {
    showLiveCompetitions: boolean;
    maxCompetitionsToShow: number;
    showcaseStyle: "cards" | "carousel" | "featured";
  };

  // Challenges Showcase
  challengesTitle: string;
  challengesSubtitle: string;
  challengesDescription: string;
  challengesCTAText: string;
  challengesCTALink: string;

  // Game Master Showcase
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

  // Competition Types Showcase
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

  // Leaderboard Preview
  leaderboardTitle: string;
  leaderboardSubtitle: string;
  leaderboardShowTop: number;
  leaderboardStyle: "table" | "cards" | "podium";

  // Marketplace Preview
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
  marketplaceShowItems: number;

  // Testimonials
  testimonialsTitle: string;
  testimonialsSubtitle: string;
  testimonials: ITestimonial[];
  testimonialsLayout: "carousel" | "grid" | "masonry";

  // Admin Panel Showcase
  adminShowcaseTitle: string;
  adminShowcaseSubtitle: string;
  adminShowcaseDescription: string;
  adminShowcaseFeatures: IAdminShowcaseFeature[];
  adminShowcaseScreenshots: string[];
  adminShowcaseCTAText: string;
  adminShowcaseCTALink: string;

  // White Label Section
  whiteLabelTitle: string;
  whiteLabelSubtitle: string;
  whiteLabelDescription: string;
  whiteLabelFeatures: IWhiteLabelFeature[];
  whiteLabelCTAText: string;
  whiteLabelCTALink: string;
  whiteLabelShowcase: {
    enabled: boolean;
    screenshots: string[];
    demoUrl: string;
  };

  // Pricing Section
  pricingTitle: string;
  pricingSubtitle: string;
  pricingDescription: string;
  pricingTiers: IPricingTier[];
  pricingLayout: "cards" | "table" | "comparison";
  pricingShowMonthly: boolean;
  pricingShowAnnual: boolean;
  pricingAnnualDiscount: number;

  // FAQ Section
  faqTitle: string;
  faqSubtitle: string;
  faqItems: IFAQItem[];
  faqLayout: "accordion" | "grid" | "tabs";

  // Final CTA Section
  ctaTitle: string;
  ctaSubtitle: string;
  ctaDescription: string;
  ctaButtonText: string;
  ctaButtonLink: string;
  ctaBackground: string;
  ctaStyle: "simple" | "gradient" | "image" | "animated";

  // Footer
  footerSections: IFooterSection[];
  footerLogo: string;
  footerDescription: string;
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
  footerMenus: {
    platform: Array<{ label: string; href: string; enabled: boolean }>;
    support: Array<{ label: string; href: string; enabled: boolean }>;
    business: Array<{ label: string; href: string; enabled: boolean }>;
  };
  footerSocialLinks: ISocialLink[];
  footerLegalLinks: { label: string; href: string }[];

  // Journey & Badges
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

  // Section Visibility
  sectionVisibility: ISectionVisibility;
  sectionOrder: string[];

  // Trust Badges (Landing Page)
  trustBadges: ITrustBadge[];
  trustBadgesTitle: string;

  // Live Data Settings
  liveDataSettings: ILiveDataSettings;

  // SEO
  seo: {
    metaTitle: string;
    metaDescription: string;
    metaKeywords: string[];
    ogImage: string;
    ogTitle: string;
    ogDescription: string;
    twitterCard: string;
    twitterSite: string;
    canonicalUrl: string;
    structuredData: string;
  };

  // ============ ENTERPRISE PAGE SETTINGS ============

  // Enterprise Hero
  enterpriseHeroTitle: string;
  enterpriseHeroSubtitle: string;
  enterpriseHeroDescription: string;
  enterpriseHeroBadge: string;
  enterpriseHeroCTAText: string;
  enterpriseHeroCTALink: string;
  enterpriseHeroSecondaryCTAText: string;
  enterpriseHeroSecondaryCTALink: string;

  // Enterprise Trust Badges
  enterpriseTrustBadges: Array<{
    id: string;
    icon: string;
    text: string;
    enabled: boolean;
  }>;

  // White Label Section
  enterpriseWhiteLabelTitle: string;
  enterpriseWhiteLabelSubtitle: string;
  enterpriseWhiteLabelFeatures: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    enabled: boolean;
    order: number;
  }>;

  // Admin Panel Showcase
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
    order: number;
  }>;

  // Pricing Section
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
    order: number;
  }>;

  // Contact Section
  enterpriseContactTitle: string;
  enterpriseContactSubtitle: string;
  enterpriseContactEmail: string;
  enterpriseContactPhone: string;
  enterpriseContactCTAText: string;

  // Enterprise Case Studies
  enterpriseCaseStudies: ICaseStudy[];
  enterpriseCaseStudiesTitle: string;
  enterpriseCaseStudiesSubtitle: string;

  // Demo Scheduling
  enterpriseDemoScheduling: {
    enabled: boolean;
    calendlyUrl: string;
    buttonText: string;
  };

  // Enterprise Section Visibility
  enterpriseSectionVisibility: {
    hero: boolean;
    trustBadges: boolean;
    whiteLabel: boolean;
    platformCapabilities: boolean;
    gameMasterProgram: boolean;
    adminShowcase: boolean;
    caseStudies: boolean;
    pricing: boolean;
    contact: boolean;
    footer: boolean;
  };

  // Auth Page (Login/Signup) Settings
  authPageTestimonialText: string;
  authPageTestimonialAuthor: string;
  authPageTestimonialRole: string;
  authPageTestimonialRating: number;
  authPageDashboardImage: string;

  // Advanced
  customCSS: string;
  customJS: string;
  headerCode: string;
  footerCode: string;

  // Analytics
  googleAnalyticsId: string;
  facebookPixelId: string;
  hotjarId: string;

  createdAt: Date;
  updatedAt: Date;
}
