import mongoose, { Schema, Document } from 'mongoose';

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
  buttonStyle: 'solid' | 'gradient' | 'outline' | 'glow';
  cardStyle: 'glassmorphism' | 'solid' | 'gradient' | 'neon';
  animationStyle: 'minimal' | 'dynamic' | 'cinematic';
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
  style: 'primary' | 'secondary' | 'outline' | 'ghost';
  icon?: string;
  enabled: boolean;
}

// Section visibility
export interface ISectionVisibility {
  hero: boolean;
  features: boolean;
  stats: boolean;
  howItWorks: boolean;
  competitions: boolean;
  challenges: boolean;
  leaderboard: boolean;
  marketplace: boolean;
  testimonials: boolean;
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
  category: 'analytics' | 'management' | 'security' | 'customization';
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
  heroBackgroundType: 'color' | 'gradient' | 'image' | 'video' | 'particles';
  heroParticlesConfig: {
    enabled: boolean;
    color: string;
    count: number;
    speed: number;
    shape: 'circle' | 'square' | 'triangle' | 'star';
  };
  heroCTAButtons: ICTAButton[];
  heroAnimationType: 'fade' | 'slide' | 'zoom' | 'typewriter' | 'glitch';
  
  // Features Section
  featuresTitle: string;
  featuresSubtitle: string;
  features: IFeatureCard[];
  featuresLayout: 'grid' | 'carousel' | 'masonry';
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
  howItWorksLayout: 'timeline' | 'cards' | 'steps';
  
  // Competitions Showcase
  competitionsTitle: string;
  competitionsSubtitle: string;
  competitionsDescription: string;
  competitionsCTAText: string;
  competitionsCTALink: string;
  competitionsShowcase: {
    showLiveCompetitions: boolean;
    maxCompetitionsToShow: number;
    showcaseStyle: 'cards' | 'carousel' | 'featured';
  };
  
  // Challenges Showcase
  challengesTitle: string;
  challengesSubtitle: string;
  challengesDescription: string;
  challengesCTAText: string;
  challengesCTALink: string;
  
  // Leaderboard Preview
  leaderboardTitle: string;
  leaderboardSubtitle: string;
  leaderboardShowTop: number;
  leaderboardStyle: 'table' | 'cards' | 'podium';
  
  // Marketplace Preview
  marketplaceTitle: string;
  marketplaceSubtitle: string;
  marketplaceShowItems: number;
  
  // Testimonials
  testimonialsTitle: string;
  testimonialsSubtitle: string;
  testimonials: ITestimonial[];
  testimonialsLayout: 'carousel' | 'grid' | 'masonry';
  
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
  pricingLayout: 'cards' | 'table' | 'comparison';
  pricingShowMonthly: boolean;
  pricingShowAnnual: boolean;
  pricingAnnualDiscount: number;
  
  // FAQ Section
  faqTitle: string;
  faqSubtitle: string;
  faqItems: IFAQItem[];
  faqLayout: 'accordion' | 'grid' | 'tabs';
  
  // Final CTA Section
  ctaTitle: string;
  ctaSubtitle: string;
  ctaDescription: string;
  ctaButtonText: string;
  ctaButtonLink: string;
  ctaBackground: string;
  ctaStyle: 'simple' | 'gradient' | 'image' | 'animated';
  
  // Footer
  footerSections: IFooterSection[];
  footerLogo: string;
  footerDescription: string;
  footerCopyright: string;
  footerDisclaimer: string;
  footerRiskDisclaimer: string;
  footerMenuPlatform: Array<{ id: string; label: string; href: string; enabled: boolean }>;
  footerMenuSupport: Array<{ id: string; label: string; href: string; enabled: boolean }>;
  footerMenuBusiness: Array<{ id: string; label: string; href: string; enabled: boolean }>;
  footerMenus: {
    platform: Array<{ label: string; href: string; enabled: boolean }>;
    support: Array<{ label: string; href: string; enabled: boolean }>;
    business: Array<{ label: string; href: string; enabled: boolean }>;
  };
  footerSocialLinks: ISocialLink[];
  footerLegalLinks: { label: string; href: string }[];
  
  // Section Visibility
  sectionVisibility: ISectionVisibility;
  sectionOrder: string[];
  
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
  
  // Enterprise Section Visibility
  enterpriseSectionVisibility: {
    hero: boolean;
    trustBadges: boolean;
    whiteLabel: boolean;
    adminShowcase: boolean;
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

// Default theme presets
export const defaultThemePresets: IThemePreset[] = [
  {
    id: 'cyber-neon',
    name: 'Cyber Neon',
    description: 'Futuristic neon glow gaming aesthetic',
    primaryColor: '#00f0ff',
    secondaryColor: '#ff00ff',
    accentColor: '#ffff00',
    backgroundColor: '#0a0a0f',
    gradientFrom: '#00f0ff',
    gradientTo: '#ff00ff',
    fontFamily: 'Orbitron',
    buttonStyle: 'glow',
    cardStyle: 'neon',
    animationStyle: 'dynamic',
  },
  {
    id: 'dark-gold',
    name: 'Dark Gold',
    description: 'Elegant dark theme with gold accents',
    primaryColor: '#ffd700',
    secondaryColor: '#b8860b',
    accentColor: '#ffffff',
    backgroundColor: '#0d0d0d',
    gradientFrom: '#ffd700',
    gradientTo: '#b8860b',
    fontFamily: 'Cinzel',
    buttonStyle: 'gradient',
    cardStyle: 'glassmorphism',
    animationStyle: 'cinematic',
  },
  {
    id: 'midnight-purple',
    name: 'Midnight Purple',
    description: 'Deep purple gaming vibes',
    primaryColor: '#a855f7',
    secondaryColor: '#6366f1',
    accentColor: '#22d3ee',
    backgroundColor: '#0f0a1a',
    gradientFrom: '#a855f7',
    gradientTo: '#6366f1',
    fontFamily: 'Rajdhani',
    buttonStyle: 'gradient',
    cardStyle: 'glassmorphism',
    animationStyle: 'dynamic',
  },
  {
    id: 'emerald-matrix',
    name: 'Emerald Matrix',
    description: 'Matrix-inspired green theme',
    primaryColor: '#10b981',
    secondaryColor: '#059669',
    accentColor: '#22c55e',
    backgroundColor: '#020a06',
    gradientFrom: '#10b981',
    gradientTo: '#059669',
    fontFamily: 'Share Tech Mono',
    buttonStyle: 'outline',
    cardStyle: 'neon',
    animationStyle: 'cinematic',
  },
  {
    id: 'fire-storm',
    name: 'Fire Storm',
    description: 'Intense red and orange flames',
    primaryColor: '#f97316',
    secondaryColor: '#ef4444',
    accentColor: '#fbbf24',
    backgroundColor: '#0f0505',
    gradientFrom: '#f97316',
    gradientTo: '#ef4444',
    fontFamily: 'Bebas Neue',
    buttonStyle: 'solid',
    cardStyle: 'gradient',
    animationStyle: 'dynamic',
  },
  {
    id: 'arctic-frost',
    name: 'Arctic Frost',
    description: 'Cool ice blue aesthetic',
    primaryColor: '#38bdf8',
    secondaryColor: '#0ea5e9',
    accentColor: '#e0f2fe',
    backgroundColor: '#030712',
    gradientFrom: '#38bdf8',
    gradientTo: '#0ea5e9',
    fontFamily: 'Exo 2',
    buttonStyle: 'gradient',
    cardStyle: 'glassmorphism',
    animationStyle: 'minimal',
  },
];

// Default feature cards
const defaultFeatures: IFeatureCard[] = [
  {
    id: 'competitions',
    icon: 'Trophy',
    title: 'Trading Competitions',
    description: 'Compete in real-time trading competitions with live leaderboards and massive prize pools.',
    color: '#ffd700',
    order: 1,
    enabled: true,
  },
  {
    id: 'challenges',
    icon: 'Swords',
    title: '1v1 Challenges',
    description: 'Challenge other traders to head-to-head battles and prove your trading skills.',
    color: '#ef4444',
    order: 2,
    enabled: true,
  },
  {
    id: 'leaderboard',
    icon: 'Medal',
    title: 'Global Leaderboard',
    description: 'Climb the ranks and earn your place among the world\'s best traders.',
    color: '#8b5cf6',
    order: 3,
    enabled: true,
  },
  {
    id: 'marketplace',
    icon: 'ShoppingBag',
    title: 'Trading Arsenal',
    description: 'Unlock exclusive avatars, badges, and profile customizations.',
    color: '#06b6d4',
    order: 4,
    enabled: true,
  },
  {
    id: 'analytics',
    icon: 'BarChart3',
    title: 'Advanced Analytics',
    description: 'Track your performance with detailed statistics and insights.',
    color: '#10b981',
    order: 5,
    enabled: true,
  },
  {
    id: 'rewards',
    icon: 'Gift',
    title: 'Rewards & Badges',
    description: 'Earn XP, unlock achievements, and collect legendary badges.',
    color: '#f97316',
    order: 6,
    enabled: true,
  },
];

// Default stats
const defaultStats: IStatCounter[] = [
  { id: 'traders', label: 'Active Traders', value: '50000', suffix: '+', icon: 'Users', color: '#ffd700', enabled: true, order: 1 },
  { id: 'competitions', label: 'Competitions Held', value: '1200', suffix: '+', icon: 'Trophy', color: '#ef4444', enabled: true, order: 2 },
  { id: 'prizes', label: 'Prizes Distributed', value: '5', suffix: 'M+', icon: 'DollarSign', color: '#10b981', enabled: true, order: 3 },
  { id: 'trades', label: 'Trades Executed', value: '10', suffix: 'M+', icon: 'TrendingUp', color: '#8b5cf6', enabled: true, order: 4 },
];

// Default how it works steps
const defaultHowItWorks: IHowItWorksStep[] = [
  { id: 'step1', step: 1, title: 'Create Account', description: 'Sign up in seconds and verify your profile', icon: 'UserPlus', enabled: true },
  { id: 'step2', step: 2, title: 'Join Competition', description: 'Browse active competitions and enter your choice', icon: 'Trophy', enabled: true },
  { id: 'step3', step: 3, title: 'Start Trading', description: 'Execute trades and build your portfolio', icon: 'TrendingUp', enabled: true },
  { id: 'step4', step: 4, title: 'Win Prizes', description: 'Top the leaderboard and claim your rewards', icon: 'Award', enabled: true },
];

// Default admin showcase features
const defaultAdminFeatures: IAdminShowcaseFeature[] = [
  { id: 'dashboard', title: 'Real-time Dashboard', description: 'Monitor all platform activity with live metrics', icon: 'LayoutDashboard', category: 'analytics', enabled: true, order: 1 },
  { id: 'users', title: 'User Management', description: 'Complete control over user accounts and permissions', icon: 'Users', category: 'management', enabled: true, order: 2 },
  { id: 'fraud', title: 'Fraud Detection', description: 'AI-powered fraud prevention and monitoring', icon: 'Shield', category: 'security', enabled: true, order: 3 },
  { id: 'branding', title: 'Full Customization', description: 'White-label everything from colors to content', icon: 'Palette', category: 'customization', enabled: true, order: 4 },
];

// Default white label features
const defaultWhiteLabelFeatures: IWhiteLabelFeature[] = [
  { id: 'branding', title: 'Complete Branding Control', description: 'Your logo, colors, fonts, and style everywhere', icon: 'Palette', enabled: true, order: 1 },
  { id: 'domain', title: 'Custom Domain', description: 'Run on your own domain with SSL included', icon: 'Globe', enabled: true, order: 2 },
  { id: 'emails', title: 'Branded Communications', description: 'All emails and notifications in your brand', icon: 'Mail', enabled: true, order: 3 },
  { id: 'api', title: 'API Access', description: 'Full API access for custom integrations', icon: 'Code', enabled: true, order: 4 },
];

const HeroSettingsSchema = new Schema<IHeroSettings>({
  // General
  isActive: { type: Boolean, default: true },
  enterprisePageEnabled: { type: Boolean, default: true },
  heroBadgeText: { type: String, default: '🔥 Live Trading Battles' },
  lastUpdated: { type: Date, default: Date.now },
  updatedBy: { type: String, default: '' },
  
  // Branding
  siteName: { type: String, default: 'TradingArena' },
  tagline: { type: String, default: 'Where Champions Trade' },
  description: { type: String, default: 'The ultimate competitive trading platform' },
  logo: { type: String, default: '' },
  favicon: { type: String, default: '' },
  
  // Theme - Complete Visual Theme ID
  activeTheme: { type: String, default: 'gaming-neon' },
  
  // Auto Holiday Theme Switching
  holidayThemesEnabled: { type: Boolean, default: true },
  holidaySchedule: { type: [Object], default: [
    { id: 'christmas', name: 'Christmas', themeId: 'christmas', startMonth: 12, startDay: 1, endMonth: 12, endDay: 31, enabled: true },
    { id: 'halloween', name: 'Halloween', themeId: 'halloween', startMonth: 10, startDay: 15, endMonth: 11, endDay: 1, enabled: true },
    { id: 'easter', name: 'Easter', themeId: 'easter', startMonth: 3, startDay: 15, endMonth: 4, endDay: 30, enabled: true },
    { id: 'black-friday', name: 'Black Friday', themeId: 'black-friday', startMonth: 11, startDay: 20, endMonth: 11, endDay: 30, enabled: true },
  ]},
  
  // Per-Theme Customization (overrides default theme values)
  themeCustomizations: { type: Object, default: {} }, // { themeId: { colors: {...}, fonts: {...}, effects: {...} } }
  
  // Global Theme Effects (applies to all pages)
  globalThemeEffects: {
    particlesEnabled: { type: Boolean, default: true },
    glowEffectsEnabled: { type: Boolean, default: true },
    animationsEnabled: { type: Boolean, default: true },
    // Intensity controls (0-100) - lower = better performance
    snowIntensity: { type: Number, default: 30, min: 10, max: 100 },
    bloodIntensity: { type: Number, default: 20, min: 10, max: 100 },
    confettiIntensity: { type: Number, default: 30, min: 10, max: 100 },
  },
  
  // Custom Theme Override
  customThemeEnabled: { type: Boolean, default: false },
  customTheme: {
    primaryColor: { type: String, default: '#00f0ff' },
    secondaryColor: { type: String, default: '#ff00ff' },
    accentColor: { type: String, default: '#ffd700' },
    backgroundColor: { type: String, default: '#0a0a0f' },
    textColor: { type: String, default: '#ffffff' },
    borderColor: { type: String, default: '#374151' },
    headingFont: { type: String, default: 'Orbitron' },
  },
  
  // Hero Section
  heroTitle: { type: String, default: 'DOMINATE THE MARKETS' },
  heroSubtitle: { type: String, default: 'Compete • Trade • Win' },
  heroDescription: { type: String, default: 'Join the world\'s most exciting trading competitions. Battle other traders in real-time, climb the leaderboards, and win massive prizes.' },
  heroBackgroundImage: { type: String, default: '' },
  heroBackgroundVideo: { type: String, default: '' },
  heroBackgroundType: { type: String, enum: ['color', 'gradient', 'image', 'video', 'particles'], default: 'particles' },
  heroParticlesConfig: {
    enabled: { type: Boolean, default: true },
    color: { type: String, default: '#00f0ff' },
    count: { type: Number, default: 50 },
    speed: { type: Number, default: 2 },
    shape: { type: String, enum: ['circle', 'square', 'triangle', 'star'], default: 'circle' },
  },
  heroCTAButtons: [{
    id: { type: String },
    text: { type: String },
    href: { type: String },
    style: { type: String, enum: ['primary', 'secondary', 'outline', 'ghost'] },
    icon: { type: String },
    enabled: { type: Boolean, default: true },
  }],
  heroAnimationType: { type: String, enum: ['fade', 'slide', 'zoom', 'typewriter', 'glitch'], default: 'glitch' },
  
  // Features Section
  featuresTitle: { type: String, default: 'UNLEASH YOUR POTENTIAL' },
  featuresSubtitle: { type: String, default: 'Everything you need to dominate' },
  features: { type: [Object], default: defaultFeatures },
  featuresLayout: { type: String, enum: ['grid', 'carousel', 'masonry'], default: 'grid' },
  featuresColumns: { type: Number, enum: [2, 3, 4], default: 3 },
  
  // Stats Section
  statsTitle: { type: String, default: 'THE NUMBERS SPEAK' },
  statsSubtitle: { type: String, default: 'Join the fastest growing trading community' },
  stats: { type: [Object], default: defaultStats },
  statsBackground: { type: String, default: 'gradient' },
  statsAnimated: { type: Boolean, default: true },
  
  // How It Works
  howItWorksTitle: { type: String, default: 'START WINNING IN 4 STEPS' },
  howItWorksSubtitle: { type: String, default: 'From zero to champion' },
  howItWorksSteps: { type: [Object], default: defaultHowItWorks },
  howItWorksLayout: { type: String, enum: ['timeline', 'cards', 'steps'], default: 'timeline' },
  
  // Competitions
  competitionsTitle: { type: String, default: 'LIVE COMPETITIONS' },
  competitionsSubtitle: { type: String, default: 'Enter the arena' },
  competitionsDescription: { type: String, default: 'Real-time trading battles with live leaderboards and massive prize pools' },
  competitionsCTAText: { type: String, default: 'View All Competitions' },
  competitionsCTALink: { type: String, default: '/competitions' },
  competitionsShowcase: {
    showLiveCompetitions: { type: Boolean, default: true },
    maxCompetitionsToShow: { type: Number, default: 3 },
    showcaseStyle: { type: String, enum: ['cards', 'carousel', 'featured'], default: 'cards' },
  },
  
  // Challenges
  challengesTitle: { type: String, default: '1V1 CHALLENGES' },
  challengesSubtitle: { type: String, default: 'Prove your skills' },
  challengesDescription: { type: String, default: 'Challenge any trader to a head-to-head battle' },
  challengesCTAText: { type: String, default: 'Start a Challenge' },
  challengesCTALink: { type: String, default: '/challenges' },
  
  // Leaderboard
  leaderboardTitle: { type: String, default: 'TOP TRADERS' },
  leaderboardSubtitle: { type: String, default: 'The elite of the elite' },
  leaderboardShowTop: { type: Number, default: 5 },
  leaderboardStyle: { type: String, enum: ['table', 'cards', 'podium'], default: 'podium' },
  
  // Marketplace
  marketplaceTitle: { type: String, default: 'TRADING ARSENAL' },
  marketplaceSubtitle: { type: String, default: 'Upgrade your style' },
  marketplaceShowItems: { type: Number, default: 4 },
  
  // Testimonials
  testimonialsTitle: { type: String, default: 'TRADER TESTIMONIALS' },
  testimonialsSubtitle: { type: String, default: 'What champions say' },
  testimonials: { type: [Object], default: [] },
  testimonialsLayout: { type: String, enum: ['carousel', 'grid', 'masonry'], default: 'carousel' },
  
  // Admin Showcase
  adminShowcaseTitle: { type: String, default: 'POWERFUL ADMIN PANEL' },
  adminShowcaseSubtitle: { type: String, default: 'Total control at your fingertips' },
  adminShowcaseDescription: { type: String, default: 'Manage every aspect of your trading platform with our comprehensive admin dashboard' },
  adminShowcaseFeatures: { type: [Object], default: defaultAdminFeatures },
  adminShowcaseScreenshots: { type: [String], default: [] },
  adminShowcaseCTAText: { type: String, default: 'See Admin Features' },
  adminShowcaseCTALink: { type: String, default: '#admin-features' },
  
  // White Label
  whiteLabelTitle: { type: String, default: 'WHITE LABEL SOLUTION' },
  whiteLabelSubtitle: { type: String, default: 'Your brand, your platform' },
  whiteLabelDescription: { type: String, default: 'Launch your own branded trading competition platform in days, not months' },
  whiteLabelFeatures: { type: [Object], default: defaultWhiteLabelFeatures },
  whiteLabelCTAText: { type: String, default: 'Get Started' },
  whiteLabelCTALink: { type: String, default: '/contact' },
  whiteLabelShowcase: {
    enabled: { type: Boolean, default: true },
    screenshots: { type: [String], default: [] },
    demoUrl: { type: String, default: '' },
  },
  
  // Pricing
  pricingTitle: { type: String, default: 'CHOOSE YOUR PLAN' },
  pricingSubtitle: { type: String, default: 'Start trading today' },
  pricingDescription: { type: String, default: '' },
  pricingTiers: { type: [Object], default: [] },
  pricingLayout: { type: String, enum: ['cards', 'table', 'comparison'], default: 'cards' },
  pricingShowMonthly: { type: Boolean, default: true },
  pricingShowAnnual: { type: Boolean, default: true },
  pricingAnnualDiscount: { type: Number, default: 20 },
  
  // FAQ
  faqTitle: { type: String, default: 'FREQUENTLY ASKED QUESTIONS' },
  faqSubtitle: { type: String, default: 'Got questions? We\'ve got answers' },
  faqItems: { type: [Object], default: [] },
  faqLayout: { type: String, enum: ['accordion', 'grid', 'tabs'], default: 'accordion' },
  
  // CTA
  ctaTitle: { type: String, default: 'READY TO DOMINATE?' },
  ctaSubtitle: { type: String, default: 'Join thousands of traders already winning' },
  ctaDescription: { type: String, default: 'Create your free account and start competing today' },
  ctaButtonText: { type: String, default: 'START TRADING NOW' },
  ctaButtonLink: { type: String, default: '/sign-up' },
  ctaBackground: { type: String, default: '' },
  ctaStyle: { type: String, enum: ['simple', 'gradient', 'image', 'animated'], default: 'animated' },
  
  // Footer
  footerSections: { type: [Object], default: [] },
  footerLogo: { type: String, default: '' },
  footerDescription: { type: String, default: '' },
  footerCopyright: { type: String, default: '© 2024 TradingArena. All rights reserved.' },
  footerDisclaimer: { type: String, default: '' },
  footerRiskDisclaimer: { type: String, default: 'Trading in financial markets involves substantial risk of loss and is not suitable for every investor. The valuation of financial instruments may fluctuate, and as a result, traders may lose more than their original investment. Past performance is not indicative of future results. All trading strategies are used at your own risk. This platform is for educational and entertainment purposes only. Virtual currency used on this platform has no real monetary value.' },
  footerMenuPlatform: { type: [Object], default: [
    { id: '1', label: 'Competitions', href: '/competitions', enabled: true },
    { id: '2', label: 'Challenges', href: '/challenges', enabled: true },
    { id: '3', label: 'Leaderboard', href: '/leaderboard', enabled: true },
    { id: '4', label: 'Marketplace', href: '/marketplace', enabled: true },
  ]},
  footerMenuSupport: { type: [Object], default: [
    { id: '1', label: 'Help Center', href: '/help', enabled: true },
    { id: '2', label: 'Contact Us', href: 'mailto:support@chartvolt.com', enabled: true },
    { id: '3', label: 'Terms of Service', href: '/terms', enabled: true },
    { id: '4', label: 'Privacy Policy', href: '/privacy', enabled: true },
  ]},
  footerMenuBusiness: { type: [Object], default: [
    { id: '1', label: 'Enterprise Solutions', href: '/enterprise', enabled: true },
    { id: '2', label: 'Pricing', href: '/enterprise#pricing', enabled: true },
    { id: '3', label: 'Contact Sales', href: '/enterprise#contact', enabled: true },
  ]},
  footerMenus: { type: Object, default: {} },
  footerSocialLinks: { type: [Object], default: [] },
  footerLegalLinks: { type: [Object], default: [] },
  
  // Section Visibility
  sectionVisibility: {
    hero: { type: Boolean, default: true },
    features: { type: Boolean, default: true },
    stats: { type: Boolean, default: true },
    howItWorks: { type: Boolean, default: true },
    competitions: { type: Boolean, default: true },
    challenges: { type: Boolean, default: true },
    leaderboard: { type: Boolean, default: true },
    marketplace: { type: Boolean, default: true },
    testimonials: { type: Boolean, default: false },
    adminShowcase: { type: Boolean, default: true },
    whiteLabel: { type: Boolean, default: true },
    pricing: { type: Boolean, default: false },
    faq: { type: Boolean, default: true },
    cta: { type: Boolean, default: true },
    footer: { type: Boolean, default: true },
  },
  sectionOrder: { type: [String], default: [
    'hero', 'stats', 'features', 'howItWorks', 'competitions', 
    'challenges', 'leaderboard', 'marketplace', 'adminShowcase', 
    'whiteLabel', 'testimonials', 'pricing', 'faq', 'cta', 'footer'
  ]},
  
  // SEO
  seo: {
    metaTitle: { type: String, default: '' },
    metaDescription: { type: String, default: '' },
    metaKeywords: { type: [String], default: [] },
    ogImage: { type: String, default: '' },
    ogTitle: { type: String, default: '' },
    ogDescription: { type: String, default: '' },
    twitterCard: { type: String, default: 'summary_large_image' },
    twitterSite: { type: String, default: '' },
    canonicalUrl: { type: String, default: '' },
    structuredData: { type: String, default: '' },
  },
  
  // ============ ENTERPRISE PAGE SETTINGS ============
  
  // Enterprise Hero
  enterpriseHeroTitle: { type: String, default: 'Launch Your Own Trading Platform' },
  enterpriseHeroSubtitle: { type: String, default: 'Enterprise Solutions' },
  enterpriseHeroDescription: { type: String, default: 'Complete white-label solution with powerful admin panel, fraud detection, payment processing, and everything you need to run a successful trading competition platform.' },
  enterpriseHeroBadge: { type: String, default: 'Enterprise Solutions' },
  enterpriseHeroCTAText: { type: String, default: 'Request Demo' },
  enterpriseHeroCTALink: { type: String, default: '#contact' },
  enterpriseHeroSecondaryCTAText: { type: String, default: 'See Admin Panel' },
  enterpriseHeroSecondaryCTALink: { type: String, default: '#admin' },
  
  // Enterprise Trust Badges
  enterpriseTrustBadges: { type: [Object], default: [
    { id: 'trust1', icon: 'Shield', text: 'Enterprise Security', enabled: true },
    { id: 'trust2', icon: 'Server', text: '99.9% Uptime SLA', enabled: true },
    { id: 'trust3', icon: 'Headphones', text: '24/7 Support', enabled: true },
  ]},
  
  // White Label Section
  enterpriseWhiteLabelTitle: { type: String, default: 'White Label Solution' },
  enterpriseWhiteLabelSubtitle: { type: String, default: 'Launch your own branded trading platform without writing a single line of code' },
  enterpriseWhiteLabelFeatures: { type: [Object], default: [
    { id: 'wl1', icon: 'Palette', title: 'Full Branding Control', description: 'Custom logo, colors, fonts, and styling to match your brand identity perfectly.', enabled: true, order: 1 },
    { id: 'wl2', icon: 'Globe', title: 'Custom Domain', description: 'Run the platform on your own domain with SSL certificate included.', enabled: true, order: 2 },
    { id: 'wl3', icon: 'Mail', title: 'Email Branding', description: 'Branded emails with your logo, colors, and custom templates.', enabled: true, order: 3 },
    { id: 'wl4', icon: 'Code', title: 'API Access', description: 'Full API access for custom integrations and third-party services.', enabled: true, order: 4 },
    { id: 'wl5', icon: 'Server', title: 'Dedicated Infrastructure', description: 'Your own dedicated servers for maximum performance and reliability.', enabled: true, order: 5 },
    { id: 'wl6', icon: 'Headphones', title: 'Priority Support', description: '24/7 dedicated support team with direct communication channels.', enabled: true, order: 6 },
  ]},
  
  // Admin Panel Showcase
  enterpriseAdminTitle: { type: String, default: 'Complete Control Center' },
  enterpriseAdminSubtitle: { type: String, default: 'Powerful Admin Panel' },
  enterpriseAdminDescription: { type: String, default: 'Everything you need to manage your platform, users, competitions, and revenue in one place' },
  enterpriseAdminFeatures: { type: [Object], default: [
    { id: 'admin1', icon: 'BarChart3', title: 'Real-Time Analytics', description: 'Monitor platform performance, user activity, and revenue in real-time.', color: 'from-cyan-500 to-blue-600', enabled: true, order: 1 },
    { id: 'admin2', icon: 'Users', title: 'User Management', description: 'Complete control over users, roles, permissions, and restrictions.', color: 'from-purple-500 to-pink-600', enabled: true, order: 2 },
    { id: 'admin3', icon: 'Trophy', title: 'Competition Control', description: 'Create, manage, and monitor trading competitions with customizable rules.', color: 'from-yellow-500 to-orange-600', enabled: true, order: 3 },
    { id: 'admin4', icon: 'Shield', title: 'Fraud Detection', description: 'AI-powered fraud detection with behavioral analysis and alerts.', color: 'from-red-500 to-rose-600', enabled: true, order: 4 },
    { id: 'admin5', icon: 'CreditCard', title: 'Payment Processing', description: 'Multiple payment providers with automatic fee calculation.', color: 'from-green-500 to-emerald-600', enabled: true, order: 5 },
    { id: 'admin6', icon: 'Bell', title: 'Notification System', description: 'Customizable email templates and in-app notifications.', color: 'from-indigo-500 to-violet-600', enabled: true, order: 6 },
    { id: 'admin7', icon: 'FileText', title: 'Audit Logging', description: 'Complete audit trail of all admin actions for compliance.', color: 'from-amber-500 to-yellow-600', enabled: true, order: 7 },
    { id: 'admin8', icon: 'PieChart', title: 'Financial Dashboard', description: 'Track revenue, fees, VAT, and platform financials.', color: 'from-teal-500 to-cyan-600', enabled: true, order: 8 },
  ]},
  
  // Pricing Section
  enterprisePricingTitle: { type: String, default: 'Simple, Transparent Pricing' },
  enterprisePricingSubtitle: { type: String, default: 'Choose the plan that fits your needs. All plans include core features.' },
  enterprisePricingTiers: { type: [Object], default: [
    { id: 'tier1', name: 'Starter', price: '$499', period: '/month', description: 'Perfect for small trading communities', features: ['Up to 1,000 users', 'Basic admin panel', '5 competitions/month', 'Email support', 'Standard analytics'], ctaText: 'Get Started', highlighted: false, enabled: true, order: 1 },
    { id: 'tier2', name: 'Professional', price: '$1,499', period: '/month', description: 'For growing trading platforms', features: ['Up to 10,000 users', 'Full admin panel', 'Unlimited competitions', 'Priority support', 'Advanced analytics', 'Custom branding', 'API access'], ctaText: 'Start Free Trial', highlighted: true, enabled: true, order: 2 },
    { id: 'tier3', name: 'Enterprise', price: 'Custom', period: '', description: 'For large-scale operations', features: ['Unlimited users', 'White label solution', 'Dedicated servers', '24/7 phone support', 'Custom development', 'SLA guarantee', 'On-premise option'], ctaText: 'Contact Sales', highlighted: false, enabled: true, order: 3 },
  ]},
  
  // Contact Section
  enterpriseContactTitle: { type: String, default: 'Ready to Get Started?' },
  enterpriseContactSubtitle: { type: String, default: 'Contact our sales team for a personalized demo and quote' },
  enterpriseContactEmail: { type: String, default: 'enterprise@chartvolt.com' },
  enterpriseContactPhone: { type: String, default: '+1 (234) 567-890' },
  enterpriseContactCTAText: { type: String, default: 'Schedule Demo' },
  
  // Enterprise Section Visibility
  enterpriseSectionVisibility: {
    hero: { type: Boolean, default: true },
    trustBadges: { type: Boolean, default: true },
    whiteLabel: { type: Boolean, default: true },
    adminShowcase: { type: Boolean, default: true },
    pricing: { type: Boolean, default: true },
    contact: { type: Boolean, default: true },
    footer: { type: Boolean, default: true },
  },
  
  // Auth Page (Login/Signup) Settings
  authPageTestimonialText: { type: String, default: 'chatvolt turned my watchlist into a winning list. The alerts are spot-on, and I feel more confident making moves in the market' },
  authPageTestimonialAuthor: { type: String, default: 'Ethan R.' },
  authPageTestimonialRole: { type: String, default: 'Retail Investor' },
  authPageTestimonialRating: { type: Number, default: 5, min: 1, max: 5 },
  authPageDashboardImage: { type: String, default: '/assets/images/dashboard.png' },
  
  // Advanced
  customCSS: { type: String, default: '' },
  customJS: { type: String, default: '' },
  headerCode: { type: String, default: '' },
  footerCode: { type: String, default: '' },
  
  // Analytics
  googleAnalyticsId: { type: String, default: '' },
  facebookPixelId: { type: String, default: '' },
  hotjarId: { type: String, default: '' },
}, {
  timestamps: true,
});

// Ensure only one document exists (singleton pattern)
HeroSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      heroCTAButtons: [
        { id: 'cta1', text: 'START TRADING', href: '/sign-up', style: 'primary', icon: 'Zap', enabled: true },
        { id: 'cta2', text: 'VIEW COMPETITIONS', href: '/competitions', style: 'outline', icon: 'Trophy', enabled: true },
      ],
    });
  }
  return settings;
};

const HeroSettings = mongoose.models.HeroSettings || mongoose.model<IHeroSettings>('HeroSettings', HeroSettingsSchema);

export default HeroSettings;

