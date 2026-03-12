import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import HeroSettings, {
  defaultThemePresets,
} from "@/database/models/hero-settings.model";

// Reason: This route reads from MongoDB on every request. Without this flag,
// Next.js treats the GET handler as static and caches the response at build
// time, which means admin changes to hero settings are never reflected on the
// live landing page.
export const dynamic = "force-dynamic";

import {
  defaultGameMasterBenefits,
  defaultCompetitionTypes,
  defaultFaqItems,
  defaultTestimonials,
  defaultFooterMenuPlatform,
  defaultFooterMenuSupport,
  defaultFooterMenuBusiness,
  defaultJourneyBadgeFeatures,
  defaultMarketplaceItems,
} from "@/database/models/hero-settings.defaults";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import CompanySettings from "@/database/models/company-settings.model";

// GET - Fetch public hero settings (no auth required)
export async function GET() {
  try {
    await connectToDatabase();

    // Get or create hero settings (singleton pattern)
    let settings = await HeroSettings.findOne();
    if (!settings) {
      settings = await HeroSettings.create({
        heroCTAButtons: [
          {
            id: "cta1",
            text: "START TRADING",
            href: "/sign-up",
            style: "primary",
            icon: "Zap",
            enabled: true,
          },
          {
            id: "cta2",
            text: "VIEW COMPETITIONS",
            href: "/competitions",
            style: "outline",
            icon: "Trophy",
            enabled: true,
          },
        ],
      });
    }

    // Get branding from WhiteLabel (existing branding settings)
    const whiteLabel = await WhiteLabel.findOne();
    // Reason: The default logo.png now ships in public/assets/images/ alongside
    // appLogo.png, so we no longer need to filter it out. If the admin uploads a
    // custom logo, the path in WhiteLabel.appLogo will change; otherwise the
    // default file is served.
    const brandingLogo = whiteLabel?.appLogo || "/assets/images/logo.png";

    // Get company settings for site name
    const companySettings = await CompanySettings.findOne();
    const companyName =
      companySettings?.companyName || settings.siteName || "TradingArena";

    // Return only public-facing settings - use existing branding
    const publicSettings = {
      // Theme & Effects
      activeTheme: settings.activeTheme || "gaming-neon",
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
        primaryColor: "#00ff88",
        secondaryColor: "#00d4ff",
        accentColor: "#ff00ff",
        backgroundColor: "#030712",
        textColor: "#f3f4f6",
        borderColor: "#374151",
        headingFont: "Orbitron",
      },

      // Branding - merged from existing settings
      siteName: companyName,
      tagline: settings.tagline,
      description: settings.description,
      logo: brandingLogo, // Use logo from existing branding settings
      favicon: settings.favicon || "/favicon.ico",

      // Hero Section
      heroTitle: settings.heroTitle,
      heroSubtitle: settings.heroSubtitle,
      heroDescription: settings.heroDescription,
      heroBackgroundImage: settings.heroBackgroundImage,
      heroBackgroundVideo: settings.heroBackgroundVideo,
      heroBackgroundType: settings.heroBackgroundType,
      heroParticlesConfig: settings.heroParticlesConfig,
      heroCTAButtons:
        settings.heroCTAButtons?.filter(
          (btn: { enabled: boolean }) => btn.enabled,
        ) || [],
      heroAnimationType: settings.heroAnimationType,

      // Features
      featuresTitle: settings.featuresTitle,
      featuresSubtitle: settings.featuresSubtitle,
      features:
        settings.features?.filter((f: { enabled: boolean }) => f.enabled) || [],
      featuresLayout: settings.featuresLayout,
      featuresColumns: settings.featuresColumns,

      // Stats
      statsTitle: settings.statsTitle,
      statsSubtitle: settings.statsSubtitle,
      stats:
        settings.stats?.filter((s: { enabled: boolean }) => s.enabled) || [],
      statsBackground: settings.statsBackground,
      statsAnimated: settings.statsAnimated,

      // How It Works
      howItWorksTitle: settings.howItWorksTitle,
      howItWorksSubtitle: settings.howItWorksSubtitle,
      howItWorksSteps:
        settings.howItWorksSteps?.filter(
          (s: { enabled: boolean }) => s.enabled,
        ) || [],
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

      // Game Master Showcase
      // Reason: These fields were added after initial deployment, so existing DB documents
      // won't have them. We fall back to defaults so the sections render immediately.
      gameMasterTitle: settings.gameMasterTitle || "BECOME A GAME MASTER",
      gameMasterSubtitle: settings.gameMasterSubtitle || "Host competitions. Build a business. Earn from every trade.",
      gameMasterDescription: settings.gameMasterDescription || "Game Masters are the entrepreneurial backbone of the platform. Subscribe to a GM plan, create events, invite players, and earn referral fees from every prize pool.",
      gameMasterBenefits: (settings.gameMasterBenefits?.filter((b: { enabled: boolean }) => b.enabled) ?? []).length > 0
        ? settings.gameMasterBenefits.filter((b: { enabled: boolean }) => b.enabled)
        : defaultGameMasterBenefits.filter(b => b.enabled),
      gameMasterCTAText: settings.gameMasterCTAText || "Become a Game Master",
      gameMasterCTALink: settings.gameMasterCTALink || "/sign-up",

      // Competition Types Showcase
      competitionTypesTitle: settings.competitionTypesTitle || "6 WAYS TO COMPETE",
      competitionTypesSubtitle: settings.competitionTypesSubtitle || "Choose your battlefield. Every competition type tests a different edge.",
      competitionTypesDescription: settings.competitionTypesDescription || "Whether you are a steady grinder, a high-risk sniper, or a consistency machine — there is a competition format designed for your style.",
      competitionTypes: (settings.competitionTypes?.filter((t: { enabled: boolean }) => t.enabled) ?? []).length > 0
        ? settings.competitionTypes.filter((t: { enabled: boolean }) => t.enabled)
        : defaultCompetitionTypes.filter(t => t.enabled),

      // Leaderboard
      leaderboardTitle: settings.leaderboardTitle,
      leaderboardSubtitle: settings.leaderboardSubtitle,
      leaderboardShowTop: settings.leaderboardShowTop,
      leaderboardStyle: settings.leaderboardStyle,

      // Journey & Badge Showcase
      // Reason: New section — fall back to defaults for existing DB documents
      journeyBadgesTitle: settings.journeyBadgesTitle || "YOUR TRADING JOURNEY",
      journeyBadgesSubtitle: settings.journeyBadgesSubtitle || "Level up, earn badges, and climb the ranks",
      journeyBadgesDescription: settings.journeyBadgesDescription || "Every trade brings you closer to the next milestone. Track your progression, unlock achievements, and prove your trading mastery.",
      journeyBadgeFeatures: (settings.journeyBadgeFeatures?.filter((f: { enabled: boolean }) => f.enabled) ?? []).length > 0
        ? settings.journeyBadgeFeatures.filter((f: { enabled: boolean }) => f.enabled)
        : defaultJourneyBadgeFeatures.filter(f => f.enabled),
      journeyBadgesCTAText: settings.journeyBadgesCTAText || "Start Your Journey",
      journeyBadgesCTALink: settings.journeyBadgesCTALink || "/sign-up",

      // Marketplace Showcase
      // Reason: New section — fall back to defaults for existing DB documents
      marketplaceTitle: settings.marketplaceTitle || "TRADING ARSENAL",
      marketplaceSubtitle: settings.marketplaceSubtitle || "Upgrade your style",
      marketplaceDescription: settings.marketplaceDescription || "Customize your trading experience with exclusive items, boosters, and premium tools from the marketplace.",
      marketplaceItems: (settings.marketplaceItems?.filter((i: { enabled: boolean }) => i.enabled) ?? []).length > 0
        ? settings.marketplaceItems.filter((i: { enabled: boolean }) => i.enabled)
        : defaultMarketplaceItems.filter(i => i.enabled),
      marketplaceCTAText: settings.marketplaceCTAText || "Browse Marketplace",
      marketplaceCTALink: settings.marketplaceCTALink || "/marketplace",
      marketplaceShowItems: settings.marketplaceShowItems,

      // Testimonials
      // Reason: New section — fall back to defaults for existing DB documents
      testimonialsTitle: settings.testimonialsTitle || "TRADER TESTIMONIALS",
      testimonialsSubtitle: settings.testimonialsSubtitle || "What champions say",
      testimonials: (settings.testimonials?.filter((t: { enabled: boolean }) => t.enabled) ?? []).length > 0
        ? settings.testimonials.filter((t: { enabled: boolean }) => t.enabled)
        : defaultTestimonials.filter(t => t.enabled),
      testimonialsLayout: settings.testimonialsLayout,

      // Admin Showcase
      adminShowcaseTitle: settings.adminShowcaseTitle,
      adminShowcaseSubtitle: settings.adminShowcaseSubtitle,
      adminShowcaseDescription: settings.adminShowcaseDescription,
      adminShowcaseFeatures:
        settings.adminShowcaseFeatures?.filter(
          (f: { enabled: boolean }) => f.enabled,
        ) || [],
      adminShowcaseScreenshots: settings.adminShowcaseScreenshots,
      adminShowcaseCTAText: settings.adminShowcaseCTAText,
      adminShowcaseCTALink: settings.adminShowcaseCTALink,

      // Pricing
      pricingTitle: settings.pricingTitle,
      pricingSubtitle: settings.pricingSubtitle,
      pricingDescription: settings.pricingDescription,
      pricingTiers:
        settings.pricingTiers?.filter((t: { enabled: boolean }) => t.enabled) ||
        [],
      pricingLayout: settings.pricingLayout,
      pricingShowMonthly: settings.pricingShowMonthly,
      pricingShowAnnual: settings.pricingShowAnnual,
      pricingAnnualDiscount: settings.pricingAnnualDiscount,

      // FAQ
      faqTitle: settings.faqTitle || "Frequently Asked Questions",
      faqSubtitle: settings.faqSubtitle || "Everything you need to know about competitive trading",
      faqItems: (settings.faqItems?.filter((f: { enabled: boolean }) => f.enabled) ?? []).length > 0
        ? settings.faqItems.filter((f: { enabled: boolean }) => f.enabled)
        : defaultFaqItems.filter(f => f.enabled),
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
      footerSections:
        settings.footerSections?.filter(
          (s: { enabled: boolean }) => s.enabled,
        ) || [],
      footerLogo: settings.footerLogo,
      footerDescription: settings.footerDescription,
      footerCopyright: settings.footerCopyright,
      footerDisclaimer: settings.footerDisclaimer,
      footerRiskDisclaimer: settings.footerRiskDisclaimer,
      footerMenus: settings.footerMenus || {
        platform:
          settings.footerMenuPlatform?.filter(
            (l: { enabled: boolean }) => l.enabled,
          ) || defaultFooterMenuPlatform.filter(l => l.enabled),
        support:
          settings.footerMenuSupport?.filter(
            (l: { enabled: boolean }) => l.enabled,
          ) || defaultFooterMenuSupport.filter(l => l.enabled),
        business:
          settings.footerMenuBusiness?.filter(
            (l: { enabled: boolean }) => l.enabled,
          ) || defaultFooterMenuBusiness.filter(l => l.enabled),
      },
      footerSocialLinks:
        settings.footerSocialLinks?.filter(
          (l: { enabled: boolean }) => l.enabled,
        ) || [],
      footerLegalLinks: settings.footerLegalLinks,

      // Section Visibility & Order (admin/enterprise features hidden from public hero page)
      // Reason: New sections default to true so they appear on existing deployments
      // without requiring the admin to toggle them on manually.
      sectionVisibility: {
        hero: true,
        features: true,
        stats: true,
        liveStats: true,
        howItWorks: true,
        gameMaster: true,
        competitionTypes: true,
        competitions: true,
        challenges: true,
        leaderboard: true,
        activityFeed: true,
        marketplace: true,
        journeyBadges: true,
        testimonials: true,
        trustBadges: true,
        faq: true,
        cta: true,
        footer: true,
        // Apply any overrides from the admin settings
        ...settings.sectionVisibility,
        // Always hide enterprise-only sections on the public hero page
        whiteLabel: false,
        adminShowcase: false,
      },
      // Reason: Fall back to the canonical order when the DB document
      // was created before the sectionOrder field was added.
      // Enterprise keys and "footer" are excluded — they are not orderable.
      sectionOrder:
        Array.isArray(settings.sectionOrder) && settings.sectionOrder.length > 0
          ? settings.sectionOrder.filter(
              // Reason: Strip enterprise-only keys that may exist in legacy data
              (k: string) => !["adminShowcase", "whiteLabel", "pricing", "footer"].includes(k),
            )
          : [
              "hero", "liveStats", "stats", "features", "howItWorks",
              "gameMaster", "competitionTypes", "competitions", "challenges",
              "activityFeed", "leaderboard", "journeyBadges", "marketplace",
              "testimonials", "trustBadges", "faq", "cta",
            ],

      // SEO
      seo: settings.seo,

      // Custom Code (only header/footer code for public)
      headerCode: settings.headerCode,
      footerCode: settings.footerCode,
    };

    // Get the active theme preset for reference
    const activePreset = defaultThemePresets.find(
      (t) => t.id === settings.activeTheme,
    );

    return NextResponse.json({
      success: true,
      settings: publicSettings,
      activePreset,
    });
  } catch (error) {
    console.error("Error fetching public hero settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch hero settings" },
      { status: 500 },
    );
  }
}
