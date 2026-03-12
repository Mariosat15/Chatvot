import mongoose, { Schema } from "mongoose";
import type { IHeroSettings } from "./hero-settings.interfaces";
import {
  defaultFeatures,
  defaultStats,
  defaultHowItWorks,
  defaultAdminFeatures,
  defaultWhiteLabelFeatures,
  defaultHolidaySchedule,
  defaultGameMasterBenefits,
  defaultCompetitionTypes,
  defaultFaqItems,
  defaultEnterpriseTrustBadges,
  defaultEnterpriseWhiteLabelFeatures,
  defaultEnterpriseAdminFeatures,
  defaultEnterprisePricingTiers,
  defaultFooterMenuPlatform,
  defaultFooterMenuSupport,
  defaultFooterMenuBusiness,
  defaultSectionOrder,
  defaultCTAButtons,
} from "./hero-settings.defaults";

// Re-export interfaces and defaults for backward compatibility
export type { IHeroSettings } from "./hero-settings.interfaces";
export type {
  IThemePreset,
  IFeatureCard,
  ITestimonial,
  IStatCounter,
  ICTAButton,
  ISectionVisibility,
  IHowItWorksStep,
  IFAQItem,
  ITrustBadge,
  ICaseStudy,
  ILiveDataSettings,
  IPricingTier,
  IAdminShowcaseFeature,
  IWhiteLabelFeature,
  IFooterSection,
  ISocialLink,
} from "./hero-settings.interfaces";
export { defaultThemePresets } from "./hero-settings.defaults";

const HeroSettingsSchema = new Schema<IHeroSettings>(
  {
    // General
    isActive: { type: Boolean, default: true },
    enterprisePageEnabled: { type: Boolean, default: true },
    heroBadgeText: { type: String, default: "🔥 Live Trading Battles" },
    lastUpdated: { type: Date, default: Date.now },
    updatedBy: { type: String, default: "" },

    // Branding
    siteName: { type: String, default: "TradingArena" },
    tagline: { type: String, default: "Where Champions Trade" },
    description: { type: String, default: "The ultimate competitive trading platform" },
    logo: { type: String, default: "" },
    favicon: { type: String, default: "" },

    // Theme
    activeTheme: { type: String, default: "gaming-neon" },
    holidayThemesEnabled: { type: Boolean, default: true },
    holidaySchedule: { type: [Object], default: defaultHolidaySchedule },
    themeCustomizations: { type: Object, default: {} },
    globalThemeEffects: {
      particlesEnabled: { type: Boolean, default: true },
      glowEffectsEnabled: { type: Boolean, default: true },
      animationsEnabled: { type: Boolean, default: true },
      snowIntensity: { type: Number, default: 30, min: 10, max: 100 },
      bloodIntensity: { type: Number, default: 20, min: 10, max: 100 },
      confettiIntensity: { type: Number, default: 30, min: 10, max: 100 },
    },
    customThemeEnabled: { type: Boolean, default: false },
    customTheme: {
      primaryColor: { type: String, default: "#00f0ff" },
      secondaryColor: { type: String, default: "#ff00ff" },
      accentColor: { type: String, default: "#ffd700" },
      backgroundColor: { type: String, default: "#0a0a0f" },
      textColor: { type: String, default: "#ffffff" },
      borderColor: { type: String, default: "#374151" },
      headingFont: { type: String, default: "Orbitron" },
    },

    // Hero Section
    heroTitle: { type: String, default: "DOMINATE THE MARKETS" },
    heroSubtitle: { type: String, default: "Compete • Trade • Win" },
    heroDescription: {
      type: String,
      default: "Join the world's most exciting trading competitions. Battle other traders in real-time, climb the leaderboards, and win massive prizes.",
    },
    heroBackgroundImage: { type: String, default: "" },
    heroBackgroundVideo: { type: String, default: "" },
    heroBackgroundType: { type: String, enum: ["color", "gradient", "image", "video", "particles"], default: "particles" },
    heroParticlesConfig: {
      enabled: { type: Boolean, default: true },
      color: { type: String, default: "#00f0ff" },
      count: { type: Number, default: 50 },
      speed: { type: Number, default: 2 },
      shape: { type: String, enum: ["circle", "square", "triangle", "star"], default: "circle" },
    },
    heroCTAButtons: [{
      id: { type: String },
      text: { type: String },
      href: { type: String },
      style: { type: String, enum: ["primary", "secondary", "outline", "ghost"] },
      icon: { type: String },
      enabled: { type: Boolean, default: true },
    }],
    heroAnimationType: { type: String, enum: ["fade", "slide", "zoom", "typewriter", "glitch"], default: "glitch" },

    // Features Section
    featuresTitle: { type: String, default: "UNLEASH YOUR POTENTIAL" },
    featuresSubtitle: { type: String, default: "Everything you need to dominate" },
    features: { type: [Object], default: defaultFeatures },
    featuresLayout: { type: String, enum: ["grid", "carousel", "masonry"], default: "grid" },
    featuresColumns: { type: Number, enum: [2, 3, 4], default: 3 },

    // Stats Section
    statsTitle: { type: String, default: "THE NUMBERS SPEAK" },
    statsSubtitle: { type: String, default: "Join the fastest growing trading community" },
    stats: { type: [Object], default: defaultStats },
    statsBackground: { type: String, default: "gradient" },
    statsAnimated: { type: Boolean, default: true },

    // How It Works
    howItWorksTitle: { type: String, default: "START WINNING IN 4 STEPS" },
    howItWorksSubtitle: { type: String, default: "From zero to champion" },
    howItWorksSteps: { type: [Object], default: defaultHowItWorks },
    howItWorksLayout: { type: String, enum: ["timeline", "cards", "steps"], default: "timeline" },

    // Competitions
    competitionsTitle: { type: String, default: "LIVE COMPETITIONS" },
    competitionsSubtitle: { type: String, default: "Enter the arena" },
    competitionsDescription: { type: String, default: "Real-time trading battles with live leaderboards and massive prize pools" },
    competitionsCTAText: { type: String, default: "View All Competitions" },
    competitionsCTALink: { type: String, default: "/competitions" },
    competitionsShowcase: {
      showLiveCompetitions: { type: Boolean, default: true },
      maxCompetitionsToShow: { type: Number, default: 3 },
      showcaseStyle: { type: String, enum: ["cards", "carousel", "featured"], default: "cards" },
    },

    // Challenges
    challengesTitle: { type: String, default: "1V1 CHALLENGES" },
    challengesSubtitle: { type: String, default: "Prove your skills" },
    challengesDescription: { type: String, default: "Challenge any trader to a head-to-head battle" },
    challengesCTAText: { type: String, default: "Start a Challenge" },
    challengesCTALink: { type: String, default: "/challenges" },

    // Game Master Showcase
    gameMasterTitle: { type: String, default: "BECOME A GAME MASTER" },
    gameMasterSubtitle: { type: String, default: "Host competitions. Build a business. Earn from every trade." },
    gameMasterDescription: {
      type: String,
      default: "Game Masters are the entrepreneurial backbone of the platform. Subscribe, create competitions & challenges, invite players, and earn referral fees from every prize pool. Build your own competitive trading empire.",
    },
    gameMasterBenefits: { type: [Object], default: defaultGameMasterBenefits },
    gameMasterCTAText: { type: String, default: "Become a Game Master" },
    gameMasterCTALink: { type: String, default: "/sign-up" },

    // Competition Types Showcase
    competitionTypesTitle: { type: String, default: "6 WAYS TO COMPETE" },
    competitionTypesSubtitle: { type: String, default: "Choose your battlefield. Every competition type tests a different edge." },
    competitionTypesDescription: {
      type: String,
      default: "Whether you are a steady grinder, a high-risk sniper, or a consistency machine — there is a competition format designed for your style.",
    },
    competitionTypes: { type: [Object], default: defaultCompetitionTypes },

    // Leaderboard
    leaderboardTitle: { type: String, default: "TOP TRADERS" },
    leaderboardSubtitle: { type: String, default: "The elite of the elite" },
    leaderboardShowTop: { type: Number, default: 5 },
    leaderboardStyle: { type: String, enum: ["table", "cards", "podium"], default: "podium" },

    // Marketplace
    marketplaceTitle: { type: String, default: "TRADING ARSENAL" },
    marketplaceSubtitle: { type: String, default: "Upgrade your style" },
    marketplaceShowItems: { type: Number, default: 4 },

    // Testimonials
    testimonialsTitle: { type: String, default: "TRADER TESTIMONIALS" },
    testimonialsSubtitle: { type: String, default: "What champions say" },
    testimonials: { type: [Object], default: [] },
    testimonialsLayout: { type: String, enum: ["carousel", "grid", "masonry"], default: "carousel" },

    // Admin Showcase
    adminShowcaseTitle: { type: String, default: "POWERFUL ADMIN PANEL" },
    adminShowcaseSubtitle: { type: String, default: "Total control at your fingertips" },
    adminShowcaseDescription: { type: String, default: "Manage every aspect of your trading platform with our comprehensive admin dashboard" },
    adminShowcaseFeatures: { type: [Object], default: defaultAdminFeatures },
    adminShowcaseScreenshots: { type: [String], default: [] },
    adminShowcaseCTAText: { type: String, default: "See Admin Features" },
    adminShowcaseCTALink: { type: String, default: "#admin-features" },

    // White Label
    whiteLabelTitle: { type: String, default: "WHITE LABEL SOLUTION" },
    whiteLabelSubtitle: { type: String, default: "Your brand, your platform" },
    whiteLabelDescription: { type: String, default: "Launch your own branded trading competition platform in days, not months" },
    whiteLabelFeatures: { type: [Object], default: defaultWhiteLabelFeatures },
    whiteLabelCTAText: { type: String, default: "Get Started" },
    whiteLabelCTALink: { type: String, default: "/contact" },
    whiteLabelShowcase: {
      enabled: { type: Boolean, default: true },
      screenshots: { type: [String], default: [] },
      demoUrl: { type: String, default: "" },
    },

    // Pricing
    pricingTitle: { type: String, default: "CHOOSE YOUR PLAN" },
    pricingSubtitle: { type: String, default: "Start trading today" },
    pricingDescription: { type: String, default: "" },
    pricingTiers: { type: [Object], default: [] },
    pricingLayout: { type: String, enum: ["cards", "table", "comparison"], default: "cards" },
    pricingShowMonthly: { type: Boolean, default: true },
    pricingShowAnnual: { type: Boolean, default: true },
    pricingAnnualDiscount: { type: Number, default: 20 },

    // FAQ
    faqTitle: { type: String, default: "FREQUENTLY ASKED QUESTIONS" },
    faqSubtitle: { type: String, default: "Got questions? We've got answers" },
    faqItems: { type: [Object], default: defaultFaqItems },
    faqLayout: { type: String, enum: ["accordion", "grid", "tabs"], default: "accordion" },

    // CTA
    ctaTitle: { type: String, default: "READY TO DOMINATE?" },
    ctaSubtitle: { type: String, default: "Join thousands of traders already winning" },
    ctaDescription: { type: String, default: "Create your free account and start competing today" },
    ctaButtonText: { type: String, default: "START TRADING NOW" },
    ctaButtonLink: { type: String, default: "/sign-up" },
    ctaBackground: { type: String, default: "" },
    ctaStyle: { type: String, enum: ["simple", "gradient", "image", "animated"], default: "animated" },

    // Footer
    footerSections: { type: [Object], default: [] },
    footerLogo: { type: String, default: "" },
    footerDescription: { type: String, default: "" },
    footerCopyright: { type: String, default: "© 2024 TradingArena. All rights reserved." },
    footerDisclaimer: { type: String, default: "" },
    footerRiskDisclaimer: {
      type: String,
      default: "Trading in financial markets involves substantial risk of loss and is not suitable for every investor. The valuation of financial instruments may fluctuate, and as a result, traders may lose more than their original investment. Past performance is not indicative of future results. All trading strategies are used at your own risk. This platform is for educational and entertainment purposes only. Virtual currency used on this platform has no real monetary value.",
    },
    footerMenuPlatform: { type: [Object], default: defaultFooterMenuPlatform },
    footerMenuSupport: { type: [Object], default: defaultFooterMenuSupport },
    footerMenuBusiness: { type: [Object], default: defaultFooterMenuBusiness },
    footerMenus: { type: Object, default: {} },
    footerSocialLinks: { type: [Object], default: [] },
    footerLegalLinks: { type: [Object], default: [] },

    // Section Visibility
    sectionVisibility: {
      hero: { type: Boolean, default: true },
      features: { type: Boolean, default: true },
      stats: { type: Boolean, default: true },
      liveStats: { type: Boolean, default: true },
      howItWorks: { type: Boolean, default: true },
      gameMaster: { type: Boolean, default: true },
      competitionTypes: { type: Boolean, default: true },
      competitions: { type: Boolean, default: true },
      challenges: { type: Boolean, default: true },
      leaderboard: { type: Boolean, default: true },
      activityFeed: { type: Boolean, default: true },
      marketplace: { type: Boolean, default: true },
      testimonials: { type: Boolean, default: false },
      trustBadges: { type: Boolean, default: false },
      adminShowcase: { type: Boolean, default: true },
      whiteLabel: { type: Boolean, default: true },
      pricing: { type: Boolean, default: false },
      faq: { type: Boolean, default: true },
      cta: { type: Boolean, default: true },
      footer: { type: Boolean, default: true },
    },
    sectionOrder: { type: [String], default: defaultSectionOrder },

    // Trust Badges (Landing Page)
    trustBadges: { type: [Object], default: [] },
    trustBadgesTitle: { type: String, default: "Trusted By Traders Worldwide" },

    // Live Data Settings
    liveDataSettings: {
      showRealStats: { type: Boolean, default: true },
      showActivityFeed: { type: Boolean, default: true },
      showLeaderboardPreview: { type: Boolean, default: true },
      activityFeedRefreshRate: { type: Number, default: 30000 },
      statsRefreshRate: { type: Number, default: 60000 },
    },

    // SEO
    seo: {
      metaTitle: { type: String, default: "" },
      metaDescription: { type: String, default: "" },
      metaKeywords: { type: [String], default: [] },
      ogImage: { type: String, default: "" },
      ogTitle: { type: String, default: "" },
      ogDescription: { type: String, default: "" },
      twitterCard: { type: String, default: "summary_large_image" },
      twitterSite: { type: String, default: "" },
      canonicalUrl: { type: String, default: "" },
      structuredData: { type: String, default: "" },
    },

    // ============ ENTERPRISE PAGE SETTINGS ============

    // Enterprise Hero
    enterpriseHeroTitle: { type: String, default: "Launch Your Own Trading Platform" },
    enterpriseHeroSubtitle: { type: String, default: "Enterprise Solutions" },
    enterpriseHeroDescription: {
      type: String,
      default: "Complete white-label solution with powerful admin panel, fraud detection, payment processing, and everything you need to run a successful trading competition platform.",
    },
    enterpriseHeroBadge: { type: String, default: "Enterprise Solutions" },
    enterpriseHeroCTAText: { type: String, default: "Request Demo" },
    enterpriseHeroCTALink: { type: String, default: "#contact" },
    enterpriseHeroSecondaryCTAText: { type: String, default: "See Admin Panel" },
    enterpriseHeroSecondaryCTALink: { type: String, default: "#admin" },

    // Enterprise Trust Badges
    enterpriseTrustBadges: { type: [Object], default: defaultEnterpriseTrustBadges },

    // White Label Section
    enterpriseWhiteLabelTitle: { type: String, default: "White Label Solution" },
    enterpriseWhiteLabelSubtitle: { type: String, default: "Launch your own branded trading platform without writing a single line of code" },
    enterpriseWhiteLabelFeatures: { type: [Object], default: defaultEnterpriseWhiteLabelFeatures },

    // Admin Panel Showcase
    enterpriseAdminTitle: { type: String, default: "Complete Control Center" },
    enterpriseAdminSubtitle: { type: String, default: "Powerful Admin Panel" },
    enterpriseAdminDescription: { type: String, default: "Everything you need to manage your platform, users, competitions, and revenue in one place" },
    enterpriseAdminFeatures: { type: [Object], default: defaultEnterpriseAdminFeatures },

    // Pricing Section
    enterprisePricingTitle: { type: String, default: "Simple, Transparent Pricing" },
    enterprisePricingSubtitle: { type: String, default: "Choose the plan that fits your needs. All plans include core features." },
    enterprisePricingTiers: { type: [Object], default: defaultEnterprisePricingTiers },

    // Contact Section
    enterpriseContactTitle: { type: String, default: "Ready to Get Started?" },
    enterpriseContactSubtitle: { type: String, default: "Contact our sales team for a personalized demo and quote" },
    enterpriseContactEmail: { type: String, default: "enterprise@chartvolt.com" },
    enterpriseContactPhone: { type: String, default: "+1 (234) 567-890" },
    enterpriseContactCTAText: { type: String, default: "Schedule Demo" },

    // Enterprise Case Studies
    enterpriseCaseStudies: { type: [Object], default: [] },
    enterpriseCaseStudiesTitle: { type: String, default: "Success Stories" },
    enterpriseCaseStudiesSubtitle: { type: String, default: "See how our clients are succeeding with their trading platforms" },

    // Demo Scheduling
    enterpriseDemoScheduling: {
      enabled: { type: Boolean, default: false },
      calendlyUrl: { type: String, default: "" },
      buttonText: { type: String, default: "Schedule a Demo" },
    },

    // Enterprise Section Visibility
    enterpriseSectionVisibility: {
      hero: { type: Boolean, default: true },
      trustBadges: { type: Boolean, default: true },
      whiteLabel: { type: Boolean, default: true },
      platformCapabilities: { type: Boolean, default: true },
      gameMasterProgram: { type: Boolean, default: true },
      adminShowcase: { type: Boolean, default: true },
      caseStudies: { type: Boolean, default: false },
      pricing: { type: Boolean, default: true },
      contact: { type: Boolean, default: true },
      footer: { type: Boolean, default: true },
    },

    // Auth Page (Login/Signup) Settings
    authPageTestimonialText: {
      type: String,
      default: "chatvolt turned my watchlist into a winning list. The alerts are spot-on, and I feel more confident making moves in the market",
    },
    authPageTestimonialAuthor: { type: String, default: "Ethan R." },
    authPageTestimonialRole: { type: String, default: "Retail Investor" },
    authPageTestimonialRating: { type: Number, default: 5, min: 0, max: 5 },
    authPageDashboardImage: { type: String, default: "/assets/images/dashboard.png" },

    // Advanced
    customCSS: { type: String, default: "" },
    customJS: { type: String, default: "" },
    headerCode: { type: String, default: "" },
    footerCode: { type: String, default: "" },

    // Analytics
    googleAnalyticsId: { type: String, default: "" },
    facebookPixelId: { type: String, default: "" },
    hotjarId: { type: String, default: "" },
  },
  { timestamps: true },
);

// Ensure only one document exists (singleton pattern)
HeroSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({ heroCTAButtons: defaultCTAButtons });
  }
  return settings;
};

const HeroSettings =
  mongoose.models.HeroSettings ||
  mongoose.model<IHeroSettings>("HeroSettings", HeroSettingsSchema);

export default HeroSettings;
