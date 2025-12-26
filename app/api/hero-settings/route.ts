import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import HeroSettings, { defaultThemePresets } from '@/database/models/hero-settings.model';
import { WhiteLabel } from '@/database/models/whitelabel.model';
import CompanySettings from '@/database/models/company-settings.model';

// GET - Fetch public hero settings (no auth required)
export async function GET() {
  try {
    await connectToDatabase();

    // Get or create hero settings (singleton pattern)
    let settings = await HeroSettings.findOne();
    if (!settings) {
      settings = await HeroSettings.create({
        heroCTAButtons: [
          { id: 'cta1', text: 'START TRADING', href: '/sign-up', style: 'primary', icon: 'Zap', enabled: true },
          { id: 'cta2', text: 'VIEW COMPETITIONS', href: '/competitions', style: 'outline', icon: 'Trophy', enabled: true },
        ],
      });
    }

    // Get branding from WhiteLabel (existing branding settings)
    let whiteLabel = await WhiteLabel.findOne();
    const brandingLogo = whiteLabel?.appLogo || '/assets/icons/logo.svg';

    // Get company settings for site name
    let companySettings = await CompanySettings.findOne();
    const companyName = companySettings?.companyName || settings.siteName || 'TradingArena';

    // Return only public-facing settings - use existing branding
    const publicSettings = {
      // Theme & Effects
      activeTheme: settings.activeTheme || 'gaming-neon',
      holidayThemesEnabled: settings.holidayThemesEnabled ?? true,
      holidaySchedule: settings.holidaySchedule || [],
      globalThemeEffects: settings.globalThemeEffects || {
        particlesEnabled: true,
        glowEffectsEnabled: true,
        animationsEnabled: true,
        snowIntensity: 30,
        bloodIntensity: 20,
        confettiIntensity: 30,
      },
      customThemeEnabled: settings.customThemeEnabled ?? false,
      customTheme: settings.customTheme || {
        primaryColor: '#00ff88',
        secondaryColor: '#00d4ff',
        accentColor: '#ff00ff',
        backgroundColor: '#030712',
        textColor: '#f3f4f6',
        borderColor: '#374151',
        headingFont: 'Orbitron',
      },
      
      // Branding - merged from existing settings
      siteName: companyName,
      tagline: settings.tagline,
      description: settings.description,
      logo: brandingLogo,  // Use logo from existing branding settings
      favicon: settings.favicon || '/favicon.ico',
      
      // Hero Section
      heroTitle: settings.heroTitle,
      heroSubtitle: settings.heroSubtitle,
      heroDescription: settings.heroDescription,
      heroBackgroundImage: settings.heroBackgroundImage,
      heroBackgroundVideo: settings.heroBackgroundVideo,
      heroBackgroundType: settings.heroBackgroundType,
      heroParticlesConfig: settings.heroParticlesConfig,
      heroCTAButtons: settings.heroCTAButtons?.filter((btn: { enabled: boolean }) => btn.enabled) || [],
      heroAnimationType: settings.heroAnimationType,
      
      // Features
      featuresTitle: settings.featuresTitle,
      featuresSubtitle: settings.featuresSubtitle,
      features: settings.features?.filter((f: { enabled: boolean }) => f.enabled) || [],
      featuresLayout: settings.featuresLayout,
      featuresColumns: settings.featuresColumns,
      
      // Stats
      statsTitle: settings.statsTitle,
      statsSubtitle: settings.statsSubtitle,
      stats: settings.stats?.filter((s: { enabled: boolean }) => s.enabled) || [],
      statsBackground: settings.statsBackground,
      statsAnimated: settings.statsAnimated,
      
      // How It Works
      howItWorksTitle: settings.howItWorksTitle,
      howItWorksSubtitle: settings.howItWorksSubtitle,
      howItWorksSteps: settings.howItWorksSteps?.filter((s: { enabled: boolean }) => s.enabled) || [],
      howItWorksLayout: settings.howItWorksLayout,
      
      // Competitions
      competitionsTitle: settings.competitionsTitle,
      competitionsSubtitle: settings.competitionsSubtitle,
      competitionsDescription: settings.competitionsDescription,
      competitionsCTAText: settings.competitionsCTAText,
      competitionsCTALink: settings.competitionsCTALink,
      competitionsShowcase: settings.competitionsShowcase,
      
      // Challenges
      challengesTitle: settings.challengesTitle,
      challengesSubtitle: settings.challengesSubtitle,
      challengesDescription: settings.challengesDescription,
      challengesCTAText: settings.challengesCTAText,
      challengesCTALink: settings.challengesCTALink,
      
      // Leaderboard
      leaderboardTitle: settings.leaderboardTitle,
      leaderboardSubtitle: settings.leaderboardSubtitle,
      leaderboardShowTop: settings.leaderboardShowTop,
      leaderboardStyle: settings.leaderboardStyle,
      
      // Marketplace
      marketplaceTitle: settings.marketplaceTitle,
      marketplaceSubtitle: settings.marketplaceSubtitle,
      marketplaceShowItems: settings.marketplaceShowItems,
      
      // Testimonials
      testimonialsTitle: settings.testimonialsTitle,
      testimonialsSubtitle: settings.testimonialsSubtitle,
      testimonials: settings.testimonials?.filter((t: { enabled: boolean }) => t.enabled) || [],
      testimonialsLayout: settings.testimonialsLayout,
      
      // Admin Showcase
      adminShowcaseTitle: settings.adminShowcaseTitle,
      adminShowcaseSubtitle: settings.adminShowcaseSubtitle,
      adminShowcaseDescription: settings.adminShowcaseDescription,
      adminShowcaseFeatures: settings.adminShowcaseFeatures?.filter((f: { enabled: boolean }) => f.enabled) || [],
      adminShowcaseScreenshots: settings.adminShowcaseScreenshots,
      adminShowcaseCTAText: settings.adminShowcaseCTAText,
      adminShowcaseCTALink: settings.adminShowcaseCTALink,
      
      // Pricing
      pricingTitle: settings.pricingTitle,
      pricingSubtitle: settings.pricingSubtitle,
      pricingDescription: settings.pricingDescription,
      pricingTiers: settings.pricingTiers?.filter((t: { enabled: boolean }) => t.enabled) || [],
      pricingLayout: settings.pricingLayout,
      pricingShowMonthly: settings.pricingShowMonthly,
      pricingShowAnnual: settings.pricingShowAnnual,
      pricingAnnualDiscount: settings.pricingAnnualDiscount,
      
      // FAQ
      faqTitle: settings.faqTitle,
      faqSubtitle: settings.faqSubtitle,
      faqItems: settings.faqItems?.filter((f: { enabled: boolean }) => f.enabled) || [],
      faqLayout: settings.faqLayout,
      
      // CTA
      ctaTitle: settings.ctaTitle,
      ctaSubtitle: settings.ctaSubtitle,
      ctaDescription: settings.ctaDescription,
      ctaButtonText: settings.ctaButtonText,
      ctaButtonLink: settings.ctaButtonLink,
      ctaBackground: settings.ctaBackground,
      ctaStyle: settings.ctaStyle,
      
      // Footer
      footerSections: settings.footerSections?.filter((s: { enabled: boolean }) => s.enabled) || [],
      footerLogo: settings.footerLogo,
      footerDescription: settings.footerDescription,
      footerCopyright: settings.footerCopyright,
      footerDisclaimer: settings.footerDisclaimer,
      footerRiskDisclaimer: settings.footerRiskDisclaimer,
      footerMenus: settings.footerMenus || {
        platform: settings.footerMenuPlatform?.filter((l: { enabled: boolean }) => l.enabled) || [],
        support: settings.footerMenuSupport?.filter((l: { enabled: boolean }) => l.enabled) || [],
        business: settings.footerMenuBusiness?.filter((l: { enabled: boolean }) => l.enabled) || [],
      },
      footerSocialLinks: settings.footerSocialLinks?.filter((l: { enabled: boolean }) => l.enabled) || [],
      footerLegalLinks: settings.footerLegalLinks,
      
      // Section Visibility & Order (admin/enterprise features hidden from public hero page)
      sectionVisibility: {
        ...settings.sectionVisibility,
        whiteLabel: false,      // White label is on /enterprise page
        adminShowcase: false,   // Admin showcase is on /enterprise page
      },
      sectionOrder: settings.sectionOrder,
      
      // SEO
      seo: settings.seo,
      
      // Custom Code (only header/footer code for public)
      headerCode: settings.headerCode,
      footerCode: settings.footerCode,
    };

    // Get the active theme preset for reference
    const activePreset = defaultThemePresets.find(t => t.id === settings.activeTheme);

    return NextResponse.json({
      success: true,
      settings: publicSettings,
      activePreset,
    });
  } catch (error) {
    console.error('Error fetching public hero settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hero settings' },
      { status: 500 }
    );
  }
}

