"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Zap } from "lucide-react";
import {
  getThemeById,
  LandingTheme,
  getActiveHolidayTheme,
} from "@/lib/themes/landing-themes";
import GlobalThemeEffects from "@/components/theme/GlobalThemeEffects";
import {
  LiveStatsBar,
  LiveCompetitions,
  LiveChallenges,
  LiveActivityFeed,
  LeaderboardPreview,
  TestimonialsSection,
  FAQSection,
  TrustBadges,
  FinalCTA,
  GameMasterShowcase,
  CompetitionTypesShowcase,
  HeroSection,
  LandingFooter,
  FeaturesGrid,
  HowItWorksSection,
  LandingNav,
  JourneyBadgeShowcase,
  MarketplaceShowcase,
} from "@/components/landing/sections";
import type { HeroSettings } from "./types";

// ─── Default section order (fallback when DB has none) ───────────────────────

const DEFAULT_SECTION_ORDER = [
  "hero",
  "liveStats",
  "features",
  "howItWorks",
  "gameMaster",
  "competitionTypes",
  "competitions",
  "challenges",
  "activityFeed",
  "leaderboard",
  "journeyBadges",
  "marketplace",
  "testimonials",
  "trustBadges",
  "faq",
  "cta",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useThemeColors(
  settings: HeroSettings | null,
  theme: LandingTheme | undefined,
) {
  const customOverrides = settings?.customThemeEnabled && settings?.customTheme;

  const effectiveColors = {
    primary: customOverrides
      ? settings?.customTheme?.primaryColor || theme?.colors.primary
      : theme?.colors.primary,
    secondary: customOverrides
      ? settings?.customTheme?.secondaryColor || theme?.colors.secondary
      : theme?.colors.secondary,
    accent: customOverrides
      ? settings?.customTheme?.accentColor || theme?.colors.accent
      : theme?.colors.accent,
    background: customOverrides
      ? settings?.customTheme?.backgroundColor || theme?.colors.background
      : theme?.colors.background,
    text: customOverrides
      ? settings?.customTheme?.textColor || theme?.colors.text
      : theme?.colors.text,
    border: customOverrides
      ? settings?.customTheme?.borderColor || theme?.colors.border
      : theme?.colors.border,
  };

  const effectiveHeadingFont = customOverrides
    ? settings?.customTheme?.headingFont || theme?.fonts.heading || "inherit"
    : theme?.fonts.heading || "inherit";

  const themeStyles = theme
    ? ({
        "--theme-primary": effectiveColors.primary,
        "--theme-secondary": effectiveColors.secondary,
        "--theme-accent": effectiveColors.accent,
        "--theme-background": effectiveColors.background,
        "--theme-text": effectiveColors.text,
        "--theme-text-muted": theme.colors.textMuted,
        "--theme-border": effectiveColors.border,
        "--theme-glow": theme.effects.glowColor,
      } as React.CSSProperties)
    : {};

  return { effectiveColors, effectiveHeadingFont, themeStyles };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function LandingPageContent() {
  const [settings, setSettings] = useState<HeroSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const headerBg = useTransform(
    scrollYProgress,
    [0, 0.05],
    ["rgba(3, 7, 18, 0)", "rgba(3, 7, 18, 0.95)"],
  );

  // === Combined landing data (replaces individual polls with 1) ===
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [combinedData, setCombinedData] = useState<{
    stats: any;
    activity: any;
    competitions: any;
    challenges: any;
  } | null>(null);

  const fetchCombinedData = useCallback(async () => {
    try {
      const response = await fetch("/api/landing/combined");
      if (response.ok) {
        const data = await response.json();
        setCombinedData(data);
      }
    } catch {
      // Silent fail — components will fall back to individual fetching
    }
  }, []);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch("/api/hero-settings");
        if (response.ok) {
          const data = await response.json();
          setSettings(data.settings);
        }
      } catch (error) {
        console.error("Error fetching hero settings:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  // Start combined polling once settings are loaded
  useEffect(() => {
    if (loading) return;
    fetchCombinedData();
    const interval = setInterval(fetchCombinedData, 30000);
    return () => clearInterval(interval);
  }, [loading, fetchCombinedData]);

  // Determine active theme (with holiday override support)
  const getEffectiveThemeId = (): string => {
    if (!settings) return "gaming-neon";
    if (settings.holidayThemesEnabled && settings.holidaySchedule) {
      const holidayTheme = getActiveHolidayTheme(settings.holidaySchedule);
      if (holidayTheme) return holidayTheme;
    }
    return settings.activeTheme || "gaming-neon";
  };

  const effectiveThemeId = getEffectiveThemeId();
  const theme: LandingTheme | undefined = getThemeById(effectiveThemeId);
  const { effectiveColors, effectiveHeadingFont, themeStyles } =
    useThemeColors(settings, theme);

  // ─── Section Registry ─────────────────────────────────────────────────
  // Reason: Instead of hardcoding section order in JSX, we build a map of
  // section keys → JSX render functions so the admin-configured sectionOrder
  // array controls what appears and in what order.

  const sectionRegistry = useMemo(() => {
    if (!settings) return {};

    const sv = settings.sectionVisibility;
    // Reason: themeContent provides unique wording per template.
    // Priority: themeContent (if present) → admin settings → hardcoded fallback.
    const tc = theme?.themeContent;

    const registry: Record<string, React.ReactNode> = {};

    // Hero Section
    if (sv.hero) {
      registry["hero"] = (
        <HeroSection
          key="hero"
          theme={theme || null}
          effectiveColors={effectiveColors}
          effectiveHeadingFont={effectiveHeadingFont}
          heroSubtitle={tc?.heroSubtitle || settings.heroSubtitle}
          heroTitle={tc?.heroTitle || settings.heroTitle}
          heroDescription={tc?.heroDescription || settings.heroDescription}
          heroCTAButtons={settings.heroCTAButtons}
          stats={settings.stats}
          statsAnimated={settings.statsAnimated}
        />
      );
    }

    // Live Stats Bar
    if (sv.liveStats && settings.liveDataSettings?.showRealStats) {
      registry["liveStats"] = (
        <LiveStatsBar
          key="liveStats"
          theme={theme}
          effectiveColors={effectiveColors}
          customStats={settings.stats}
          animated={settings.statsAnimated}
          externalData={combinedData?.stats}
        />
      );
    }

    // Features Section
    if (sv.features && settings.features.length > 0) {
      registry["features"] = (
        <FeaturesGrid
          key="features"
          theme={theme || null}
          effectiveColors={effectiveColors}
          effectiveHeadingFont={effectiveHeadingFont}
          title={settings.featuresTitle}
          subtitle={settings.featuresSubtitle}
          features={settings.features}
        />
      );
    }

    // How It Works Section
    if (sv.howItWorks && settings.howItWorksSteps.length > 0) {
      registry["howItWorks"] = (
        <HowItWorksSection
          key="howItWorks"
          theme={theme || null}
          effectiveColors={effectiveColors}
          effectiveHeadingFont={effectiveHeadingFont}
          title={settings.howItWorksTitle}
          subtitle={settings.howItWorksSubtitle}
          steps={settings.howItWorksSteps}
        />
      );
    }

    // Game Master Showcase
    if (
      sv.gameMaster &&
      settings.gameMasterBenefits &&
      settings.gameMasterBenefits.length > 0
    ) {
      registry["gameMaster"] = (
        <GameMasterShowcase
          key="gameMaster"
          theme={theme || null}
          effectiveColors={effectiveColors}
          effectiveHeadingFont={effectiveHeadingFont}
          title={settings.gameMasterTitle || "BECOME A GAME MASTER"}
          subtitle={
            settings.gameMasterSubtitle ||
            "Host competitions. Build a business. Earn from every trade."
          }
          description={
            settings.gameMasterDescription ||
            "Game Masters are the entrepreneurial backbone of the platform."
          }
          benefits={settings.gameMasterBenefits}
          ctaText={settings.gameMasterCTAText || "Become a Game Master"}
          ctaLink={settings.gameMasterCTALink || "/sign-up"}
        />
      );
    }

    // Competition Types Showcase
    if (
      sv.competitionTypes &&
      settings.competitionTypes &&
      settings.competitionTypes.length > 0
    ) {
      registry["competitionTypes"] = (
        <CompetitionTypesShowcase
          key="competitionTypes"
          theme={theme || null}
          effectiveColors={effectiveColors}
          effectiveHeadingFont={effectiveHeadingFont}
          title={settings.competitionTypesTitle || "6 WAYS TO COMPETE"}
          subtitle={
            settings.competitionTypesSubtitle ||
            "Choose your battlefield. Every competition type tests a different edge."
          }
          description={
            settings.competitionTypesDescription ||
            "Whether you are a steady grinder, a high-risk sniper, or a consistency machine — there is a competition format designed for your style."
          }
          competitionTypes={settings.competitionTypes}
        />
      );
    }

    // Competitions Section (Live Data)
    if (sv.competitions) {
      registry["competitions"] = (
        <LiveCompetitions
          key="competitions"
          theme={theme}
          effectiveColors={effectiveColors}
          effectiveHeadingFont={effectiveHeadingFont}
          title={settings.competitionsTitle}
          subtitle={settings.competitionsSubtitle}
          description={settings.competitionsDescription}
          ctaText={settings.competitionsCTAText}
          ctaLink={settings.competitionsCTALink}
          externalData={combinedData?.competitions}
        />
      );
    }

    // Challenges Section (Live Data)
    if (sv.challenges) {
      registry["challenges"] = (
        <LiveChallenges
          key="challenges"
          theme={theme}
          effectiveColors={effectiveColors}
          effectiveHeadingFont={effectiveHeadingFont}
          title={settings.challengesTitle}
          subtitle={settings.challengesSubtitle}
          description={settings.challengesDescription}
          ctaText={settings.challengesCTAText}
          ctaLink={settings.challengesCTALink}
          externalData={combinedData?.challenges}
        />
      );
    }

    // Live Activity Feed
    if (sv.activityFeed && settings.liveDataSettings?.showActivityFeed) {
      registry["activityFeed"] = (
        <section key="activityFeed" className="py-12 relative overflow-hidden">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <LiveActivityFeed
              theme={theme}
              effectiveColors={effectiveColors}
              refreshInterval={
                settings.liveDataSettings?.activityFeedRefreshRate || 30000
              }
              externalData={combinedData?.activity}
            />
          </div>
        </section>
      );
    }

    // Leaderboard Preview
    if (sv.leaderboard && settings.liveDataSettings?.showLeaderboardPreview) {
      registry["leaderboard"] = (
        <LeaderboardPreview
          key="leaderboard"
          theme={theme}
          effectiveColors={effectiveColors}
          effectiveHeadingFont={effectiveHeadingFont}
        />
      );
    }

    // Journey & Badge Showcase
    if (
      sv.journeyBadges &&
      settings.journeyBadgeFeatures &&
      settings.journeyBadgeFeatures.length > 0
    ) {
      registry["journeyBadges"] = (
        <JourneyBadgeShowcase
          key="journeyBadges"
          theme={theme || null}
          effectiveColors={effectiveColors}
          effectiveHeadingFont={effectiveHeadingFont}
          title={settings.journeyBadgesTitle || "YOUR TRADING JOURNEY"}
          subtitle={
            settings.journeyBadgesSubtitle ||
            "Level up, earn badges, and climb the ranks"
          }
          description={
            settings.journeyBadgesDescription ||
            "Every trade brings you closer to the next milestone."
          }
          features={settings.journeyBadgeFeatures}
          ctaText={settings.journeyBadgesCTAText || "Start Your Journey"}
          ctaLink={settings.journeyBadgesCTALink || "/sign-up"}
        />
      );
    }

    // Marketplace Showcase
    if (
      sv.marketplace &&
      settings.marketplaceItems &&
      settings.marketplaceItems.length > 0
    ) {
      registry["marketplace"] = (
        <MarketplaceShowcase
          key="marketplace"
          theme={theme || null}
          effectiveColors={effectiveColors}
          effectiveHeadingFont={effectiveHeadingFont}
          title={settings.marketplaceTitle || "TRADING ARSENAL"}
          subtitle={settings.marketplaceSubtitle || "Upgrade your style"}
          description={
            settings.marketplaceDescription ||
            "Customize your trading experience with exclusive items."
          }
          items={settings.marketplaceItems}
          ctaText={settings.marketplaceCTAText || "Browse Marketplace"}
          ctaLink={settings.marketplaceCTALink || "/marketplace"}
        />
      );
    }

    // Testimonials
    if (
      sv.testimonials &&
      settings.testimonials &&
      settings.testimonials.length > 0
    ) {
      registry["testimonials"] = (
        <TestimonialsSection
          key="testimonials"
          theme={theme}
          effectiveColors={effectiveColors}
          effectiveHeadingFont={effectiveHeadingFont}
          testimonials={settings.testimonials}
          title={settings.testimonialsTitle}
          subtitle={settings.testimonialsSubtitle}
        />
      );
    }

    // Trust Badges
    if (
      sv.trustBadges &&
      settings.trustBadges &&
      settings.trustBadges.length > 0
    ) {
      registry["trustBadges"] = (
        <TrustBadges
          key="trustBadges"
          theme={theme}
          effectiveColors={effectiveColors}
          badges={settings.trustBadges}
          title={settings.trustBadgesTitle}
        />
      );
    }

    // FAQ
    if (sv.faq && settings.faqItems && settings.faqItems.length > 0) {
      registry["faq"] = (
        <FAQSection
          key="faq"
          theme={theme}
          effectiveColors={effectiveColors}
          effectiveHeadingFont={effectiveHeadingFont}
          faqItems={settings.faqItems}
          title={settings.faqTitle}
          subtitle={settings.faqSubtitle}
        />
      );
    }

    // Final CTA
    if (sv.cta) {
      registry["cta"] = (
        <FinalCTA
          key="cta"
          theme={theme}
          effectiveColors={effectiveColors}
          effectiveHeadingFont={effectiveHeadingFont}
          title={settings.ctaTitle}
          subtitle={settings.ctaSubtitle}
          primaryCTA={{
            text: tc?.ctaPrimaryText || settings.ctaButtonText,
            href: settings.ctaButtonLink,
          }}
          secondaryCTA={{ text: tc?.ctaSecondaryText || "View Competitions", href: "/competitions" }}
        />
      );
    }

    return registry;
  }, [settings, theme, effectiveColors, effectiveHeadingFont, combinedData]);

  // ─── Compute ordered sections ─────────────────────────────────────────
  // Reason: Use the admin-configured sectionOrder array to determine render
  // order. If a section key exists in the order but wasn't added to the
  // registry (e.g. because its visibility is off), it's silently skipped.
  const orderedSections = useMemo(() => {
    const order = settings?.sectionOrder ?? DEFAULT_SECTION_ORDER;
    const rendered: React.ReactNode[] = [];

    for (const key of order) {
      // eslint-disable-next-line security/detect-object-injection
      const node = sectionRegistry[key];
      if (node) rendered.push(node);
    }

    // Catch any sections that exist in the registry but aren't in the order
    // array (e.g. newly added sections the admin hasn't ordered yet)
    for (const key of Object.keys(sectionRegistry)) {
      if (!order.includes(key)) {
        // eslint-disable-next-line security/detect-object-injection
        rendered.push(sectionRegistry[key]);
      }
    }

    return rendered;
  }, [sectionRegistry, settings?.sectionOrder]);

  // ─── Loading / Error states ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-16 h-16 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Zap className="h-6 w-6 text-yellow-500" />
          </motion.div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <p>Failed to load landing page</p>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      className={`min-h-screen overflow-x-hidden ${theme?.customClasses.heroBackground || "bg-gray-950"}`}
      style={{
        ...themeStyles,
        backgroundColor: effectiveColors.background || "#030712",
        color: effectiveColors.text || "#f3f4f6",
        fontFamily: theme?.fonts.body || "inherit",
        backgroundImage: theme?.effects.backgroundPattern || undefined,
      }}
    >
      {/* Theme custom styles */}
      {theme && (
        <style jsx global>{`
          @import url("https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Rajdhani:wght@300;400;500;600;700&family=Press+Start+2P&family=VT323&family=Exo+2:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700;800;900&family=Cinzel:wght@400;500;600;700;800;900&family=Roboto+Condensed:wght@300;400;700&family=Righteous&family=Monoton&family=Nunito:wght@300;400;500;600;700;800&family=Mountains+of+Christmas:wght@400;700&family=Great+Vibes&family=Pacifico&family=Quicksand:wght@300;400;500;600;700&family=Dancing+Script:wght@400;500;600;700&family=Bebas+Neue&family=Creepster&family=Nosifer&family=Inter:wght@300;400;500;600;700;800;900&family=Lato:wght@300;400;700;900&family=JetBrains+Mono:wght@300;400;500;600;700;800&display=swap");

          .theme-heading {
            font-family: ${theme.fonts.heading};
          }
          .theme-body {
            font-family: ${theme.fonts.body};
          }
          .theme-accent-font {
            font-family: ${theme.fonts.accent};
          }
          .theme-text-gradient {
            ${theme.customClasses.textGradient.includes("bg-gradient") ? "" : `color: ${theme.colors.primary};`}
          }
          .theme-glow {
            ${theme.customClasses.glowEffect}
          }
          .theme-button-primary {
            ${theme.customClasses.buttonPrimary}
          }
          .theme-card {
            ${theme.customClasses.cardBackground}
          }

          @keyframes gradient {
            0%,
            100% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
          }
          .animate-gradient {
            animation: gradient 3s ease infinite;
          }
        `}</style>
      )}

      {/* Global Theme Effects */}
      <GlobalThemeEffects
        themeId={effectiveThemeId}
        effects={
          settings?.globalThemeEffects || {
            particlesEnabled: true,
            glowEffectsEnabled: true,
            animationsEnabled: true,
            snowIntensity: 30,
            bloodIntensity: 20,
            confettiIntensity: 30,
          }
        }
      />

      {/* Navigation — always at the top */}
      <LandingNav
        settings={settings}
        theme={theme}
        effectiveColors={effectiveColors}
        effectiveHeadingFont={effectiveHeadingFont}
        headerBg={headerBg}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      {/* ── Dynamic Section Rendering ─────────────────────────────── */}
      {/* Reason: Sections are rendered based on settings.sectionOrder  */}
      {/* so the admin can reorder them from the Landing Page Builder.  */}
      {orderedSections}

      {/* Footer — always at the bottom */}
      <LandingFooter
        theme={theme || null}
        effectiveColors={effectiveColors}
        effectiveHeadingFont={effectiveHeadingFont}
        siteName={settings.siteName}
        tagline={settings.tagline}
        logo={settings.logo}
        footerCopyright={settings.footerCopyright}
        footerDisclaimer={settings.footerDisclaimer}
        footerRiskDisclaimer={settings.footerRiskDisclaimer}
        footerMenus={settings.footerMenus}
      />
    </div>
  );
}
