"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "@/components/landing/sections";
import type { HeroSettings } from "./types";

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

      {/* Navigation */}
      <LandingNav
        settings={settings}
        theme={theme}
        effectiveColors={effectiveColors}
        effectiveHeadingFont={effectiveHeadingFont}
        headerBg={headerBg}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      {/* Hero Section */}
      {settings.sectionVisibility.hero && (
        <HeroSection
          theme={theme || null}
          effectiveColors={effectiveColors}
          effectiveHeadingFont={effectiveHeadingFont}
          heroSubtitle={settings.heroSubtitle}
          heroTitle={settings.heroTitle}
          heroDescription={settings.heroDescription}
          heroCTAButtons={settings.heroCTAButtons}
          stats={settings.stats}
          statsAnimated={settings.statsAnimated}
        />
      )}

      {/* Live Stats Bar */}
      {settings.sectionVisibility.liveStats &&
        settings.liveDataSettings?.showRealStats && (
          <LiveStatsBar
            theme={theme}
            effectiveColors={effectiveColors}
            customStats={settings.stats}
            animated={settings.statsAnimated}
            externalData={combinedData?.stats}
          />
        )}

      {/* Features Section */}
      {settings.sectionVisibility.features && settings.features.length > 0 && (
        <FeaturesGrid
          theme={theme || null}
          effectiveColors={effectiveColors}
          effectiveHeadingFont={effectiveHeadingFont}
          title={settings.featuresTitle}
          subtitle={settings.featuresSubtitle}
          features={settings.features}
        />
      )}

      {/* How It Works Section */}
      {settings.sectionVisibility.howItWorks &&
        settings.howItWorksSteps.length > 0 && (
          <HowItWorksSection
            theme={theme || null}
            effectiveColors={effectiveColors}
            effectiveHeadingFont={effectiveHeadingFont}
            title={settings.howItWorksTitle}
            subtitle={settings.howItWorksSubtitle}
            steps={settings.howItWorksSteps}
          />
        )}

      {/* Game Master Showcase */}
      {settings.sectionVisibility.gameMaster &&
        settings.gameMasterBenefits &&
        settings.gameMasterBenefits.length > 0 && (
          <GameMasterShowcase
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
        )}

      {/* Competition Types Showcase */}
      {settings.sectionVisibility.competitionTypes &&
        settings.competitionTypes &&
        settings.competitionTypes.length > 0 && (
          <CompetitionTypesShowcase
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
        )}

      {/* Competitions Section (Live Data) */}
      {settings.sectionVisibility.competitions && (
        <LiveCompetitions
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
      )}

      {/* Challenges Section (Live Data) */}
      {settings.sectionVisibility.challenges && (
        <LiveChallenges
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
      )}

      {/* Live Activity Feed */}
      {settings.sectionVisibility.activityFeed &&
        settings.liveDataSettings?.showActivityFeed && (
          <section className="py-12 relative overflow-hidden">
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
        )}

      {/* Leaderboard Preview */}
      {settings.sectionVisibility.leaderboard &&
        settings.liveDataSettings?.showLeaderboardPreview && (
          <LeaderboardPreview
            theme={theme}
            effectiveColors={effectiveColors}
            effectiveHeadingFont={effectiveHeadingFont}
          />
        )}

      {/* Testimonials */}
      {settings.sectionVisibility.testimonials &&
        settings.testimonials &&
        settings.testimonials.length > 0 && (
          <TestimonialsSection
            theme={theme}
            effectiveColors={effectiveColors}
            effectiveHeadingFont={effectiveHeadingFont}
            testimonials={settings.testimonials}
            title={settings.testimonialsTitle}
            subtitle={settings.testimonialsSubtitle}
          />
        )}

      {/* Trust Badges */}
      {settings.sectionVisibility.trustBadges &&
        settings.trustBadges &&
        settings.trustBadges.length > 0 && (
          <TrustBadges
            theme={theme}
            effectiveColors={effectiveColors}
            badges={settings.trustBadges}
            title={settings.trustBadgesTitle}
          />
        )}

      {/* FAQ */}
      {settings.sectionVisibility.faq &&
        settings.faqItems &&
        settings.faqItems.length > 0 && (
          <FAQSection
            theme={theme}
            effectiveColors={effectiveColors}
            effectiveHeadingFont={effectiveHeadingFont}
            faqItems={settings.faqItems}
            title={settings.faqTitle}
            subtitle={settings.faqSubtitle}
          />
        )}

      {/* Final CTA */}
      {settings.sectionVisibility.cta && (
        <FinalCTA
          theme={theme}
          effectiveColors={effectiveColors}
          effectiveHeadingFont={effectiveHeadingFont}
          title={settings.ctaTitle}
          subtitle={settings.ctaSubtitle}
          primaryCTA={{
            text: settings.ctaButtonText,
            href: settings.ctaButtonLink,
          }}
          secondaryCTA={{ text: "View Competitions", href: "/competitions" }}
        />
      )}

      {/* Footer */}
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
