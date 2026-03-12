import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import HeroSettings from "@/database/models/hero-settings.model";
import {
  defaultGameMasterBenefits,
  defaultCompetitionTypes,
  defaultEnterpriseTrustBadges,
  defaultEnterpriseWhiteLabelFeatures,
  defaultEnterpriseAdminFeatures,
  defaultEnterprisePricingTiers,
} from "@/database/models/hero-settings.defaults";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import CompanySettings from "@/database/models/company-settings.model";

// GET - Fetch public enterprise page settings (no auth required)
export async function GET() {
  try {
    await connectToDatabase();

    let settings = await HeroSettings.findOne();
    if (!settings) {
      settings = await HeroSettings.create({});
    }

    // Get branding
    const whiteLabel = await WhiteLabel.findOne();
    const companySettings = await CompanySettings.findOne();

    // Check if enterprise page is disabled
    if (settings.enterprisePageEnabled === false) {
      return NextResponse.json({
        success: false,
        enabled: false,
        message: "Enterprise page is disabled",
      });
    }

    // Reason: Many fields were added after initial deployment. The existing DB document
    // won't have them, so we fall back to defaults so all sections render correctly.
    const filterEnabled = (arr: Array<{ enabled: boolean }> | undefined) =>
      arr?.filter((item) => item.enabled) ?? [];
    const sortByOrder = (arr: Array<{ order: number }>) =>
      [...arr].sort((a, b) => a.order - b.order);

    const trustBadges = filterEnabled(settings.enterpriseTrustBadges);
    const whiteLabelFeatures = filterEnabled(settings.enterpriseWhiteLabelFeatures);
    const adminFeatures = filterEnabled(settings.enterpriseAdminFeatures);
    const pricingTiers = filterEnabled(settings.enterprisePricingTiers);
    const compTypes = filterEnabled(settings.competitionTypes);
    const gmBenefits = filterEnabled(settings.gameMasterBenefits);

    const enterpriseSettings = {
      // Branding
      siteName:
        companySettings?.companyName || settings.siteName || "ChartVolt",
      logo:
        whiteLabel?.appLogo && whiteLabel.appLogo.length > 0
          ? whiteLabel.appLogo
          : "",

      // Hero Section
      heroTitle: settings.enterpriseHeroTitle || "Enterprise Trading Platform",
      heroSubtitle: settings.enterpriseHeroSubtitle || "White-Label Competitive Trading",
      heroDescription: settings.enterpriseHeroDescription || "Launch your own branded competitive trading platform with our enterprise-grade white-label solution.",
      heroBadge: settings.enterpriseHeroBadge || "Enterprise Solutions",
      heroCTAText: settings.enterpriseHeroCTAText || "Request Demo",
      heroCTALink: settings.enterpriseHeroCTALink || "#contact",
      heroSecondaryCTAText: settings.enterpriseHeroSecondaryCTAText || "View Pricing",
      heroSecondaryCTALink: settings.enterpriseHeroSecondaryCTALink || "#pricing",

      // Trust Badges
      trustBadges: trustBadges.length > 0
        ? trustBadges
        : defaultEnterpriseTrustBadges.filter(b => b.enabled),

      // White Label Section
      whiteLabelTitle: settings.enterpriseWhiteLabelTitle || "Complete White-Label Solution",
      whiteLabelSubtitle: settings.enterpriseWhiteLabelSubtitle || "Your brand, our technology. Launch in weeks, not months.",
      whiteLabelFeatures: whiteLabelFeatures.length > 0
        ? sortByOrder(whiteLabelFeatures as Array<{ order: number; enabled: boolean }>)
        : sortByOrder(defaultEnterpriseWhiteLabelFeatures.filter(f => f.enabled)),

      // Admin Showcase Section
      adminTitle: settings.enterpriseAdminTitle || "Powerful Admin Panel",
      adminSubtitle: settings.enterpriseAdminSubtitle || "Full control over every aspect of your platform",
      adminDescription: settings.enterpriseAdminDescription || "Monitor, manage, and optimize your trading platform with our comprehensive admin dashboard.",
      adminFeatures: adminFeatures.length > 0
        ? sortByOrder(adminFeatures as Array<{ order: number; enabled: boolean }>)
        : sortByOrder(defaultEnterpriseAdminFeatures.filter(f => f.enabled)),

      // Pricing Section
      pricingTitle: settings.enterprisePricingTitle || "Simple, Transparent Pricing",
      pricingSubtitle: settings.enterprisePricingSubtitle || "Choose the plan that fits your business",
      pricingTiers: pricingTiers.length > 0
        ? sortByOrder(pricingTiers as Array<{ order: number; enabled: boolean }>)
        : sortByOrder(defaultEnterprisePricingTiers.filter(t => t.enabled)),

      // Contact Section
      contactTitle: settings.enterpriseContactTitle || "Ready to Get Started?",
      contactSubtitle: settings.enterpriseContactSubtitle || "Contact our enterprise sales team",
      contactEmail: settings.enterpriseContactEmail || "enterprise@chartvolt.com",
      contactPhone: settings.enterpriseContactPhone || "",
      contactCTAText: settings.enterpriseContactCTAText || "Contact Sales",

      // Platform Capabilities (competition types)
      competitionTypes: compTypes.length > 0
        ? compTypes
        : defaultCompetitionTypes.filter(t => t.enabled),

      // Game Master Program
      gameMasterBenefits: gmBenefits.length > 0
        ? sortByOrder(gmBenefits as Array<{ order: number; enabled: boolean }>)
        : sortByOrder(defaultGameMasterBenefits.filter(b => b.enabled)),

      // Case Studies
      caseStudies:
        settings.enterpriseCaseStudies
          ?.filter((c: { enabled: boolean }) => c.enabled)
          ?.sort(
            (a: { order: number }, b: { order: number }) => a.order - b.order,
          ) || [],
      caseStudiesTitle: settings.enterpriseCaseStudiesTitle,
      caseStudiesSubtitle: settings.enterpriseCaseStudiesSubtitle,

      // Demo Scheduling
      demoScheduling: settings.enterpriseDemoScheduling || {
        enabled: false,
        calendlyUrl: "",
        buttonText: "Schedule a Demo",
      },

      // Section Visibility
      sectionVisibility: {
        hero: true,
        trustBadges: true,
        whiteLabel: true,
        platformCapabilities: true,
        gameMasterProgram: true,
        adminShowcase: true,
        caseStudies: true,
        pricing: true,
        contact: true,
        footer: true,
        ...settings.enterpriseSectionVisibility,
      },

      // Footer (shared with hero page)
      footerCopyright: settings.footerCopyright || `© ${new Date().getFullYear()} All Rights Reserved.`,
    };

    return NextResponse.json({
      success: true,
      settings: enterpriseSettings,
    });
  } catch (error) {
    console.error("Error fetching enterprise settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch enterprise settings" },
      { status: 500 },
    );
  }
}
