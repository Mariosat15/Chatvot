"use client";

import Link from "next/link";
import Image from "next/image";
import { LandingTheme } from "@/lib/themes/landing-themes";

interface FooterMenuLink {
  label: string;
  href: string;
  enabled: boolean;
}

interface LandingFooterProps {
  theme: LandingTheme | null;
  effectiveColors: {
    primary?: string;
    secondary?: string;
    text?: string;
    border?: string;
  };
  effectiveHeadingFont: string;
  siteName: string;
  tagline: string;
  logo?: string;
  footerCopyright?: string;
  footerDisclaimer?: string;
  footerRiskDisclaimer?: string;
  footerMenus?: {
    platform: FooterMenuLink[];
    support: FooterMenuLink[];
    business: FooterMenuLink[];
  };
}

const defaultPlatformLinks: FooterMenuLink[] = [
  { label: "Competitions", href: "/competitions", enabled: true },
  { label: "Challenges", href: "/challenges", enabled: true },
  { label: "Leaderboard", href: "/leaderboard", enabled: true },
  { label: "Marketplace", href: "/marketplace", enabled: true },
];

const defaultSupportLinks: FooterMenuLink[] = [
  { label: "Help Center", href: "/help", enabled: true },
  { label: "Contact Us", href: "mailto:support@chartvolt.com", enabled: true },
  { label: "Terms of Service", href: "/terms", enabled: true },
  { label: "Privacy Policy", href: "/privacy", enabled: true },
];

const defaultBusinessLinks: FooterMenuLink[] = [
  { label: "Enterprise Solutions", href: "/enterprise", enabled: true },
  { label: "Pricing", href: "/enterprise#pricing", enabled: true },
  { label: "Contact Sales", href: "/enterprise#contact", enabled: true },
];

function FooterLinkList({
  title,
  links,
  theme,
  effectiveColors,
}: {
  title: string;
  links: FooterMenuLink[];
  theme: LandingTheme | null;
  effectiveColors: LandingFooterProps["effectiveColors"];
}) {
  return (
    <div>
      <h4
        className="font-semibold mb-4"
        style={{ color: effectiveColors.text }}
      >
        {title}
      </h4>
      <ul className="space-y-2">
        {links
          .filter((item) => item.enabled)
          .map((item, i) => (
            <li key={i}>
              {item.href.startsWith("mailto:") ? (
                <a
                  href={item.href}
                  className="text-sm transition-colors hover:opacity-80"
                  style={{ color: theme?.colors.textMuted }}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  href={item.href}
                  className="text-sm transition-colors hover:opacity-80"
                  style={{ color: theme?.colors.textMuted }}
                >
                  {item.label}
                </Link>
              )}
            </li>
          ))}
      </ul>
    </div>
  );
}

export default function LandingFooter({
  theme,
  effectiveColors,
  effectiveHeadingFont,
  siteName,
  tagline,
  logo,
  footerCopyright,
  footerDisclaimer,
  footerRiskDisclaimer,
  footerMenus,
}: LandingFooterProps) {
  return (
    <footer
      style={{
        backgroundColor: theme?.colors.backgroundSecondary,
        borderTop: `1px solid ${theme?.colors.border}`,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer */}
        <div className="py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <Link href="/" className="flex items-center gap-3 mb-4">
              {logo && logo.length > 0 ? (
                <Image
                  src={logo}
                  alt={siteName}
                  width={120}
                  height={28}
                  className="h-7 w-auto"
                />
              ) : (
                <>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: theme?.effects.gradientStyle }}
                  >
                    <span>{theme?.themeIcons?.special || "⚡"}</span>
                  </div>
                  <span
                    className="text-lg font-bold"
                    style={{
                      color: effectiveColors.text,
                      fontFamily: effectiveHeadingFont,
                    }}
                  >
                    {siteName}
                  </span>
                </>
              )}
            </Link>
            <p className="text-sm" style={{ color: theme?.colors.textMuted }}>
              {tagline}
            </p>
          </div>

          <FooterLinkList
            title="Platform"
            links={footerMenus?.platform || defaultPlatformLinks}
            theme={theme}
            effectiveColors={effectiveColors}
          />

          <FooterLinkList
            title="Support"
            links={footerMenus?.support || defaultSupportLinks}
            theme={theme}
            effectiveColors={effectiveColors}
          />

          <FooterLinkList
            title="Business"
            links={footerMenus?.business || defaultBusinessLinks}
            theme={theme}
            effectiveColors={effectiveColors}
          />
        </div>

        {/* Risk Disclaimer */}
        <div
          className="py-6"
          style={{ borderTop: `1px solid ${theme?.colors.border}` }}
        >
          <p
            className="text-xs leading-relaxed"
            style={{ color: theme?.colors.textMuted }}
          >
            <strong style={{ color: effectiveColors.text }}>
              Risk Disclaimer:
            </strong>{" "}
            {footerRiskDisclaimer ||
              "Trading in financial markets involves substantial risk of loss and is not suitable for every investor. The valuation of financial instruments may fluctuate, and as a result, traders may lose more than their original investment. Past performance is not indicative of future results. All trading strategies are used at your own risk. This platform is for educational and entertainment purposes only. Virtual currency used on this platform has no real monetary value."}
            {footerDisclaimer && ` ${footerDisclaimer}`}
          </p>
        </div>

        {/* Copyright */}
        <div
          className="py-6 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderTop: `1px solid ${theme?.colors.border}` }}
        >
          <p className="text-sm" style={{ color: theme?.colors.textMuted }}>
            {/* Reason: Replace {YEAR} placeholder with current year */}
            {footerCopyright?.replace(
              /\{YEAR\}/g,
              String(new Date().getFullYear()),
            )}
          </p>
          <div className="flex items-center gap-4">
            <span
              className="text-xs"
              style={{ color: theme?.colors.textMuted }}
            >
              Powered by
            </span>
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded flex items-center justify-center"
                style={{ background: theme?.effects.gradientStyle }}
              >
                <span className="text-xs">
                  {theme?.themeIcons?.power || "⚡"}
                </span>
              </div>
              <span
                className="text-sm font-medium"
                style={{ color: theme?.colors.textMuted }}
              >
                ChartVolt
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
