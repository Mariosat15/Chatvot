import type {
  LandingSettings,
  HolidayScheduleItem,
  GlobalThemeEffects,
  CustomTheme,
} from "./types";
import { defaultSettings } from "./defaults";

// ─── Map FROM Database → LandingSettings ──────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapFromDbSettings(db: Record<string, any>): LandingSettings {
  const sv = (db.sectionVisibility as Record<string, boolean>) || {};
  const esv = (db.enterpriseSectionVisibility as Record<string, boolean>) || {};
  const cta0 = (db.heroCTAButtons as any[])?.[0];
  const cta1 = (db.heroCTAButtons as any[])?.[1];

  return {
    activeTheme: (db.activeTheme as string) || defaultSettings.activeTheme,
    holidayThemesEnabled: (db.holidayThemesEnabled as boolean) ?? true,
    holidaySchedule:
      (db.holidaySchedule as HolidayScheduleItem[]) || defaultSettings.holidaySchedule,
    globalThemeEffects:
      (db.globalThemeEffects as GlobalThemeEffects) || defaultSettings.globalThemeEffects,
    customThemeEnabled: (db.customThemeEnabled as boolean) ?? false,
    customTheme: (db.customTheme as CustomTheme) || defaultSettings.customTheme,

    enterprisePageEnabled: (db.enterprisePageEnabled as boolean) ?? true,

    heroEnabled: sv.hero ?? true,
    heroTitle: (db.heroTitle as string) || defaultSettings.heroTitle,
    heroSubtitle: (db.heroSubtitle as string) || defaultSettings.heroSubtitle,
    heroDescription: (db.heroDescription as string) || defaultSettings.heroDescription,
    heroBadgeText: (db.heroBadgeText as string) || defaultSettings.heroBadgeText,
    heroPrimaryCTAText: cta0?.text || defaultSettings.heroPrimaryCTAText,
    heroPrimaryCTALink: cta0?.href || defaultSettings.heroPrimaryCTALink,
    heroSecondaryCTAText: cta1?.text || defaultSettings.heroSecondaryCTAText,
    heroSecondaryCTALink: cta1?.href || defaultSettings.heroSecondaryCTALink,
    heroParticlesEnabled:
      (db.heroParticlesConfig as Record<string, boolean>)?.enabled ?? true,

    statsEnabled: sv.stats ?? true,
    statsAnimated: (db.statsAnimated as boolean) ?? true,
    stats: (db.stats as LandingSettings["stats"]) || defaultSettings.stats,

    featuresEnabled: sv.features ?? true,
    featuresTitle: (db.featuresTitle as string) || defaultSettings.featuresTitle,
    featuresSubtitle: (db.featuresSubtitle as string) || defaultSettings.featuresSubtitle,
    features: (db.features as LandingSettings["features"]) || defaultSettings.features,

    howItWorksEnabled: sv.howItWorks ?? true,
    howItWorksTitle: (db.howItWorksTitle as string) || defaultSettings.howItWorksTitle,
    howItWorksSubtitle: (db.howItWorksSubtitle as string) || defaultSettings.howItWorksSubtitle,
    howItWorksSteps:
      (db.howItWorksSteps as LandingSettings["howItWorksSteps"]) ||
      defaultSettings.howItWorksSteps,

    competitionsEnabled: sv.competitions ?? true,
    competitionsTitle: (db.competitionsTitle as string) || defaultSettings.competitionsTitle,
    competitionsSubtitle: (db.competitionsSubtitle as string) || defaultSettings.competitionsSubtitle,
    competitionsDescription: (db.competitionsDescription as string) || defaultSettings.competitionsDescription,
    competitionsCTAText: (db.competitionsCTAText as string) || defaultSettings.competitionsCTAText,
    competitionsCTALink: (db.competitionsCTALink as string) || defaultSettings.competitionsCTALink,

    challengesEnabled: sv.challenges ?? true,
    challengesTitle: (db.challengesTitle as string) || defaultSettings.challengesTitle,
    challengesSubtitle: (db.challengesSubtitle as string) || defaultSettings.challengesSubtitle,
    challengesDescription: (db.challengesDescription as string) || defaultSettings.challengesDescription,
    challengesCTAText: (db.challengesCTAText as string) || defaultSettings.challengesCTAText,
    challengesCTALink: (db.challengesCTALink as string) || defaultSettings.challengesCTALink,

    gameMasterEnabled: sv.gameMaster ?? true,
    competitionTypesEnabled: sv.competitionTypes ?? true,
    journeyBadgesEnabled: sv.journeyBadges ?? true,
    marketplaceEnabled: sv.marketplace ?? true,
    faqEnabled: sv.faq ?? true,
    liveStatsEnabled: sv.liveStats ?? true,
    leaderboardEnabled: sv.leaderboard ?? true,
    activityFeedEnabled: sv.activityFeed ?? true,
    testimonialsEnabled: sv.testimonials ?? true,
    trustBadgesEnabled: sv.trustBadges ?? true,
    sectionOrder: (db.sectionOrder as string[]) || defaultSettings.sectionOrder,

    ctaEnabled: sv.cta ?? true,
    ctaTitle: (db.ctaTitle as string) || defaultSettings.ctaTitle,
    ctaSubtitle: (db.ctaSubtitle as string) || defaultSettings.ctaSubtitle,
    ctaDescription: (db.ctaDescription as string) || defaultSettings.ctaDescription,
    ctaButtonText: (db.ctaButtonText as string) || defaultSettings.ctaButtonText,
    ctaButtonLink: (db.ctaButtonLink as string) || defaultSettings.ctaButtonLink,

    footerEnabled: sv.footer ?? true,
    footerCopyright: (db.footerCopyright as string) || defaultSettings.footerCopyright,
    footerDisclaimer: (db.footerDisclaimer as string) || defaultSettings.footerDisclaimer,
    footerRiskDisclaimer: (db.footerRiskDisclaimer as string) || defaultSettings.footerRiskDisclaimer,
    footerMenuPlatform:
      (db.footerMenuPlatform as LandingSettings["footerMenuPlatform"]) ||
      defaultSettings.footerMenuPlatform,
    footerMenuSupport:
      (db.footerMenuSupport as LandingSettings["footerMenuSupport"]) ||
      defaultSettings.footerMenuSupport,
    footerMenuBusiness:
      (db.footerMenuBusiness as LandingSettings["footerMenuBusiness"]) ||
      defaultSettings.footerMenuBusiness,

    enterpriseHeroTitle: (db.enterpriseHeroTitle as string) || defaultSettings.enterpriseHeroTitle,
    enterpriseHeroSubtitle: (db.enterpriseHeroSubtitle as string) || defaultSettings.enterpriseHeroSubtitle,
    enterpriseHeroDescription: (db.enterpriseHeroDescription as string) || defaultSettings.enterpriseHeroDescription,
    enterpriseHeroBadge: (db.enterpriseHeroBadge as string) || defaultSettings.enterpriseHeroBadge,
    enterpriseHeroCTAText: (db.enterpriseHeroCTAText as string) || defaultSettings.enterpriseHeroCTAText,
    enterpriseHeroCTALink: (db.enterpriseHeroCTALink as string) || defaultSettings.enterpriseHeroCTALink,

    enterpriseWhiteLabelEnabled: esv.whiteLabel ?? true,
    enterpriseWhiteLabelTitle: (db.enterpriseWhiteLabelTitle as string) || defaultSettings.enterpriseWhiteLabelTitle,
    enterpriseWhiteLabelSubtitle: (db.enterpriseWhiteLabelSubtitle as string) || defaultSettings.enterpriseWhiteLabelSubtitle,
    enterpriseWhiteLabelFeatures:
      (db.enterpriseWhiteLabelFeatures as LandingSettings["enterpriseWhiteLabelFeatures"]) ||
      defaultSettings.enterpriseWhiteLabelFeatures,

    enterpriseAdminEnabled: esv.adminShowcase ?? true,
    enterpriseAdminTitle: (db.enterpriseAdminTitle as string) || defaultSettings.enterpriseAdminTitle,
    enterpriseAdminSubtitle: (db.enterpriseAdminSubtitle as string) || defaultSettings.enterpriseAdminSubtitle,
    enterpriseAdminDescription: (db.enterpriseAdminDescription as string) || defaultSettings.enterpriseAdminDescription,
    enterpriseAdminFeatures:
      (db.enterpriseAdminFeatures as LandingSettings["enterpriseAdminFeatures"]) ||
      defaultSettings.enterpriseAdminFeatures,

    enterprisePricingEnabled: esv.pricing ?? true,
    enterprisePricingTitle: (db.enterprisePricingTitle as string) || defaultSettings.enterprisePricingTitle,
    enterprisePricingSubtitle: (db.enterprisePricingSubtitle as string) || defaultSettings.enterprisePricingSubtitle,
    enterprisePricingTiers:
      (db.enterprisePricingTiers as LandingSettings["enterprisePricingTiers"]) ||
      defaultSettings.enterprisePricingTiers,

    enterpriseContactEnabled: esv.contact ?? true,
    enterpriseContactTitle: (db.enterpriseContactTitle as string) || defaultSettings.enterpriseContactTitle,
    enterpriseContactSubtitle: (db.enterpriseContactSubtitle as string) || defaultSettings.enterpriseContactSubtitle,
    enterpriseContactEmail: (db.enterpriseContactEmail as string) || defaultSettings.enterpriseContactEmail,
    enterpriseContactPhone: (db.enterpriseContactPhone as string) || defaultSettings.enterpriseContactPhone,
    enterpriseContactCTAText: (db.enterpriseContactCTAText as string) || defaultSettings.enterpriseContactCTAText,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Map TO Database ──────────────────────────────────────────────────────

export function mapToDbSettings(s: LandingSettings) {
  return {
    activeTheme: s.activeTheme,
    holidayThemesEnabled: s.holidayThemesEnabled,
    holidaySchedule: s.holidaySchedule,
    globalThemeEffects: s.globalThemeEffects,
    customThemeEnabled: s.customThemeEnabled,
    customTheme: s.customTheme,

    enterprisePageEnabled: s.enterprisePageEnabled,

    heroTitle: s.heroTitle,
    heroSubtitle: s.heroSubtitle,
    heroDescription: s.heroDescription,
    heroBadgeText: s.heroBadgeText,
    heroCTAButtons: [
      { id: "1", text: s.heroPrimaryCTAText, href: s.heroPrimaryCTALink, style: "primary", icon: "Rocket", enabled: true },
      { id: "2", text: s.heroSecondaryCTAText, href: s.heroSecondaryCTALink, style: "secondary", icon: "", enabled: true },
    ],
    heroParticlesConfig: { enabled: s.heroParticlesEnabled, color: "#eab308", count: 80, speed: 1, shape: "circle" },

    statsAnimated: s.statsAnimated,
    stats: s.stats,

    featuresTitle: s.featuresTitle,
    featuresSubtitle: s.featuresSubtitle,
    features: s.features,

    howItWorksTitle: s.howItWorksTitle,
    howItWorksSubtitle: s.howItWorksSubtitle,
    howItWorksSteps: s.howItWorksSteps,

    competitionsTitle: s.competitionsTitle,
    competitionsSubtitle: s.competitionsSubtitle,
    competitionsDescription: s.competitionsDescription,
    competitionsCTAText: s.competitionsCTAText,
    competitionsCTALink: s.competitionsCTALink,

    challengesTitle: s.challengesTitle,
    challengesSubtitle: s.challengesSubtitle,
    challengesDescription: s.challengesDescription,
    challengesCTAText: s.challengesCTAText,
    challengesCTALink: s.challengesCTALink,

    ctaTitle: s.ctaTitle,
    ctaSubtitle: s.ctaSubtitle,
    ctaDescription: s.ctaDescription,
    ctaButtonText: s.ctaButtonText,
    ctaButtonLink: s.ctaButtonLink,

    footerCopyright: s.footerCopyright,
    footerDisclaimer: s.footerDisclaimer,
    footerRiskDisclaimer: s.footerRiskDisclaimer,
    footerMenuPlatform: s.footerMenuPlatform,
    footerMenuSupport: s.footerMenuSupport,
    footerMenuBusiness: s.footerMenuBusiness,
    footerMenus: {
      platform: s.footerMenuPlatform,
      support: s.footerMenuSupport,
      business: s.footerMenuBusiness,
    },

    sectionVisibility: {
      hero: s.heroEnabled,
      features: s.featuresEnabled,
      stats: s.statsEnabled,
      liveStats: s.liveStatsEnabled,
      howItWorks: s.howItWorksEnabled,
      competitions: s.competitionsEnabled,
      challenges: s.challengesEnabled,
      gameMaster: s.gameMasterEnabled,
      competitionTypes: s.competitionTypesEnabled,
      journeyBadges: s.journeyBadgesEnabled,
      marketplace: s.marketplaceEnabled,
      leaderboard: s.leaderboardEnabled,
      activityFeed: s.activityFeedEnabled,
      testimonials: s.testimonialsEnabled,
      trustBadges: s.trustBadgesEnabled,
      faq: s.faqEnabled,
      cta: s.ctaEnabled,
      footer: s.footerEnabled,
    },
    sectionOrder: s.sectionOrder,

    enterpriseHeroTitle: s.enterpriseHeroTitle,
    enterpriseHeroSubtitle: s.enterpriseHeroSubtitle,
    enterpriseHeroDescription: s.enterpriseHeroDescription,
    enterpriseHeroBadge: s.enterpriseHeroBadge,
    enterpriseHeroCTAText: s.enterpriseHeroCTAText,
    enterpriseHeroCTALink: s.enterpriseHeroCTALink,

    enterpriseWhiteLabelTitle: s.enterpriseWhiteLabelTitle,
    enterpriseWhiteLabelSubtitle: s.enterpriseWhiteLabelSubtitle,
    enterpriseWhiteLabelFeatures: s.enterpriseWhiteLabelFeatures,

    enterpriseAdminTitle: s.enterpriseAdminTitle,
    enterpriseAdminSubtitle: s.enterpriseAdminSubtitle,
    enterpriseAdminDescription: s.enterpriseAdminDescription,
    enterpriseAdminFeatures: s.enterpriseAdminFeatures,

    enterprisePricingTitle: s.enterprisePricingTitle,
    enterprisePricingSubtitle: s.enterprisePricingSubtitle,
    enterprisePricingTiers: s.enterprisePricingTiers,

    enterpriseContactTitle: s.enterpriseContactTitle,
    enterpriseContactSubtitle: s.enterpriseContactSubtitle,
    enterpriseContactEmail: s.enterpriseContactEmail,
    enterpriseContactPhone: s.enterpriseContactPhone,
    enterpriseContactCTAText: s.enterpriseContactCTAText,

    enterpriseSectionVisibility: {
      hero: true,
      trustBadges: true,
      whiteLabel: s.enterpriseWhiteLabelEnabled,
      adminShowcase: s.enterpriseAdminEnabled,
      pricing: s.enterprisePricingEnabled,
      contact: s.enterpriseContactEnabled,
      footer: true,
    },
  };
}
