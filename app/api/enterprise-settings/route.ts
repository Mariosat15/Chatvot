import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import HeroSettings from '@/database/models/hero-settings.model';
import { WhiteLabel } from '@/database/models/whitelabel.model';
import CompanySettings from '@/database/models/company-settings.model';

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
        message: 'Enterprise page is disabled',
      });
    }

    const enterpriseSettings = {
      // Branding
      siteName: companySettings?.companyName || settings.siteName || 'ChartVolt',
      logo: whiteLabel?.appLogo || '/assets/icons/logo.svg',
      
      // Hero Section
      heroTitle: settings.enterpriseHeroTitle,
      heroSubtitle: settings.enterpriseHeroSubtitle,
      heroDescription: settings.enterpriseHeroDescription,
      heroBadge: settings.enterpriseHeroBadge,
      heroCTAText: settings.enterpriseHeroCTAText,
      heroCTALink: settings.enterpriseHeroCTALink,
      heroSecondaryCTAText: settings.enterpriseHeroSecondaryCTAText,
      heroSecondaryCTALink: settings.enterpriseHeroSecondaryCTALink,
      
      // Trust Badges
      trustBadges: settings.enterpriseTrustBadges?.filter((b: { enabled: boolean }) => b.enabled) || [],
      
      // White Label Section
      whiteLabelTitle: settings.enterpriseWhiteLabelTitle,
      whiteLabelSubtitle: settings.enterpriseWhiteLabelSubtitle,
      whiteLabelFeatures: settings.enterpriseWhiteLabelFeatures
        ?.filter((f: { enabled: boolean }) => f.enabled)
        ?.sort((a: { order: number }, b: { order: number }) => a.order - b.order) || [],
      
      // Admin Showcase Section
      adminTitle: settings.enterpriseAdminTitle,
      adminSubtitle: settings.enterpriseAdminSubtitle,
      adminDescription: settings.enterpriseAdminDescription,
      adminFeatures: settings.enterpriseAdminFeatures
        ?.filter((f: { enabled: boolean }) => f.enabled)
        ?.sort((a: { order: number }, b: { order: number }) => a.order - b.order) || [],
      
      // Pricing Section
      pricingTitle: settings.enterprisePricingTitle,
      pricingSubtitle: settings.enterprisePricingSubtitle,
      pricingTiers: settings.enterprisePricingTiers
        ?.filter((t: { enabled: boolean }) => t.enabled)
        ?.sort((a: { order: number }, b: { order: number }) => a.order - b.order) || [],
      
      // Contact Section
      contactTitle: settings.enterpriseContactTitle,
      contactSubtitle: settings.enterpriseContactSubtitle,
      contactEmail: settings.enterpriseContactEmail,
      contactPhone: settings.enterpriseContactPhone,
      contactCTAText: settings.enterpriseContactCTAText,
      
      // Section Visibility
      sectionVisibility: settings.enterpriseSectionVisibility || {
        hero: true,
        trustBadges: true,
        whiteLabel: true,
        adminShowcase: true,
        pricing: true,
        contact: true,
        footer: true,
      },
      
      // Footer (shared with hero page)
      footerCopyright: settings.footerCopyright,
    };

    return NextResponse.json({
      success: true,
      settings: enterpriseSettings,
    });
  } catch (error) {
    console.error('Error fetching enterprise settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enterprise settings' },
      { status: 500 }
    );
  }
}

