"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, MotionValue } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingTheme } from "@/lib/themes/landing-themes";

interface LandingNavProps {
  settings: {
    siteName: string;
    logo?: string;
  };
  theme: LandingTheme | undefined;
  effectiveColors: {
    primary?: string;
    secondary?: string;
    text?: string;
  };
  effectiveHeadingFont: string;
  headerBg: MotionValue<string>;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Competitions", href: "#competitions" },
  { label: "Challenges", href: "#challenges" },
  { label: "Enterprise", href: "/enterprise", isLink: true },
];

export default function LandingNav({
  settings,
  theme,
  effectiveColors,
  effectiveHeadingFont,
  headerBg,
  mobileMenuOpen,
  setMobileMenuOpen,
}: LandingNavProps) {
  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl"
      style={{
        backgroundColor: headerBg,
        borderColor: theme?.colors.border || "rgba(31, 41, 55, 0.5)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            {settings.logo && settings.logo.length > 0 ? (
              <Image
                src={settings.logo}
                alt={settings.siteName}
                width={140}
                height={32}
                className="h-8 w-auto"
              />
            ) : (
              <>
                <div className="relative">
                  <div
                    className="absolute inset-0 blur-lg opacity-50"
                    style={{ backgroundColor: effectiveColors.primary }}
                  />
                  <div
                    className="relative w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background:
                        theme?.effects.gradientStyle ||
                        `linear-gradient(135deg, ${effectiveColors.primary}, ${effectiveColors.secondary})`,
                    }}
                  >
                    <span className="text-xl">
                      {theme?.themeIcons?.special || "⚡"}
                    </span>
                  </div>
                </div>
                <span
                  className="text-xl font-bold hidden sm:block"
                  style={{
                    color: effectiveColors.text,
                    fontFamily: effectiveHeadingFont,
                  }}
                >
                  {settings.siteName}
                </span>
              </>
            )}
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) =>
              link.isLink ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className="transition-colors text-sm font-medium"
                  style={{ color: theme?.colors.textMuted }}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className="transition-colors text-sm font-medium"
                  style={{ color: theme?.colors.textMuted }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.color =
                      effectiveColors.primary || "")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.color =
                      theme?.colors.textMuted || "")
                  }
                >
                  {link.label}
                </a>
              ),
            )}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/sign-in">
              <Button
                variant="ghost"
                className="hidden sm:flex"
                style={{ color: theme?.colors.textMuted }}
              >
                Sign In
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button
                className="font-bold"
                style={{
                  background:
                    theme?.effects.gradientStyle ||
                    `linear-gradient(135deg, ${effectiveColors.primary}, ${effectiveColors.secondary})`,
                  color: theme?.colors.background || "#030712",
                  boxShadow: `0 10px 30px ${theme?.colors.accentGlow || "rgba(234, 179, 8, 0.3)"}`,
                }}
              >
                <span className="mr-2">
                  {theme?.themeIcons?.power || "⚡"}
                </span>
                Get Started
              </Button>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2"
              style={{ color: theme?.colors.textMuted }}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden border-t backdrop-blur-xl"
          style={{
            backgroundColor: theme?.colors.backgroundOverlay,
            borderColor: theme?.colors.border,
          }}
        >
          <nav className="px-4 py-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block py-3 px-4 rounded-lg"
                style={{ color: theme?.colors.textMuted }}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/sign-in"
              className="block py-3 px-4 rounded-lg"
              style={{ color: theme?.colors.textMuted }}
            >
              Sign In
            </Link>
          </nav>
        </motion.div>
      )}
    </motion.header>
  );
}
