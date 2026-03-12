/* eslint-disable @next/next/no-img-element */
// Reason: Logo is served via /api/assets/images/ — next/image can't optimize API-route-served images.
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Shield, Zap, Globe, Palette, BarChart3, Users, Trophy,
  Settings, Lock, Server, Headphones, Code, Star, Building2,
  Briefcase, TrendingUp, Layers, Database, Bell, CreditCard,
  FileText, PieChart, Target, Award, Crown, ArrowRight, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CaseStudies,
  EnterprisePlatformSection,
  EnterpriseAdminShowcase,
  EnterprisePricingContact,
} from "@/components/landing/enterprise";
import type { EnterpriseSettings } from "@/components/landing/enterprise/types";

// Icon mapping for hero trust badges & white label features
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield, Zap, Globe, Palette, BarChart3, Users, Trophy,
  Settings, Lock, Server, Headphones, Code, Star, Building2,
  Briefcase, TrendingUp, Layers, Database, Bell, CreditCard,
  FileText, PieChart, Target, Award, Crown,
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function EnterprisePage() {
  const [settings, setSettings] = useState<EnterpriseSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch("/api/enterprise-settings");
        if (response.ok) {
          const data = await response.json();
          if (data.enabled === false) {
            window.location.href = "/";
            return;
          }
          setSettings(data.settings);
        }
      } catch (error) {
        console.error("Error fetching enterprise settings:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full"
        />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <p>Failed to load page</p>
      </div>
    );
  }

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "Admin Panel", href: "#admin" },
    { label: "Pricing", href: "#pricing" },
    { label: "Contact", href: "#contact" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-950/90 backdrop-blur-xl border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              {settings.logo ? (
                <img
                  src={settings.logo}
                  alt={settings.siteName}
                  className="h-8 w-auto max-w-[140px] object-contain"
                />
              ) : (
                <>
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center">
                    <Zap className="h-6 w-6 text-gray-900" />
                  </div>
                  <span className="text-xl font-bold hidden sm:block">
                    {settings.siteName}
                  </span>
                </>
              )}
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-gray-400 hover:text-purple-400 transition-colors text-sm font-medium"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <Link href="/">
                <Button
                  variant="ghost"
                  className="text-gray-400 hover:text-white hidden sm:flex"
                >
                  Back to Home
                </Button>
              </Link>
              <a href="#contact">
                <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-semibold">
                  Get Quote
                </Button>
              </a>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-400"
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
          <div className="md:hidden border-t border-gray-800 bg-gray-950/95">
            <nav className="px-4 py-4 space-y-2">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-3 px-4 text-gray-400 hover:text-white rounded-lg"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section */}
      {settings.sectionVisibility.hero && (
        <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-purple-950/20 to-gray-950" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-pink-500/10 via-transparent to-transparent" />
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: `linear-gradient(rgba(168, 85, 247, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(168, 85, 247, 0.5) 1px, transparent 1px)`,
                backgroundSize: "60px 60px",
              }}
            />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium mb-8"
              >
                <Building2 className="h-4 w-4" />
                {settings.heroBadge}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-tight tracking-tight"
              >
                <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-yellow-500 bg-clip-text text-transparent">
                  {settings.heroTitle}
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed"
              >
                {settings.heroDescription}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                <a href={settings.heroCTALink}>
                  <Button
                    size="lg"
                    className="text-lg px-8 py-6 font-bold bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white shadow-lg shadow-purple-500/25"
                  >
                    <Briefcase className="h-5 w-5 mr-2" />
                    {settings.heroCTAText}
                  </Button>
                </a>
                <a href={settings.heroSecondaryCTALink}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-lg px-8 py-6 font-bold border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                  >
                    {settings.heroSecondaryCTAText}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </a>
              </motion.div>

              {/* Trust badges */}
              {settings.sectionVisibility.trustBadges &&
                settings.trustBadges.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="mt-16 flex flex-wrap items-center justify-center gap-8 text-gray-500"
                  >
                    {settings.trustBadges.map((badge) => {
                      const IconComponent = iconMap[badge.icon];
                      return (
                        <div key={badge.id} className="flex items-center gap-2">
                          {IconComponent && (
                            <IconComponent className="h-5 w-5 text-purple-500" />
                          )}
                          <span className="text-sm">{badge.text}</span>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
            </motion.div>
          </div>
        </section>
      )}

      {/* White Label Features */}
      {settings.sectionVisibility.whiteLabel && (
        <section id="features" className="py-24 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-black mb-4">
                <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                  {settings.whiteLabelTitle}
                </span>
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                {settings.whiteLabelSubtitle}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {settings.whiteLabelFeatures.map((feature, index) => {
                const IconComponent = iconMap[feature.icon];
                return (
                  <motion.div
                    key={feature.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="group p-8 rounded-2xl bg-gradient-to-br from-gray-900/80 to-gray-900/40 border border-gray-800/50 hover:border-purple-500/30 transition-all duration-300"
                  >
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      {IconComponent && (
                        <IconComponent className="h-7 w-7 text-purple-400" />
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">
                      {feature.title}
                    </h3>
                    <p className="text-gray-400">{feature.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Platform Capabilities + Game Master Program */}
      <EnterprisePlatformSection
        showCapabilities={settings.sectionVisibility.platformCapabilities !== false}
        competitionTypes={settings.competitionTypes}
        showGameMaster={settings.sectionVisibility.gameMasterProgram !== false}
        gameMasterBenefits={settings.gameMasterBenefits}
      />

      {/* Admin Panel Showcase */}
      {settings.sectionVisibility.adminShowcase && (
        <EnterpriseAdminShowcase
          adminTitle={settings.adminTitle}
          adminSubtitle={settings.adminSubtitle}
          adminDescription={settings.adminDescription}
          adminFeatures={settings.adminFeatures}
        />
      )}

      {/* Pricing + Contact */}
      <EnterprisePricingContact
        showPricing={settings.sectionVisibility.pricing}
        pricingTitle={settings.pricingTitle}
        pricingSubtitle={settings.pricingSubtitle}
        pricingTiers={settings.pricingTiers}
        showContact={settings.sectionVisibility.contact}
        contactTitle={settings.contactTitle}
        contactSubtitle={settings.contactSubtitle}
        contactEmail={settings.contactEmail}
        contactPhone={settings.contactPhone}
        contactCTAText={settings.contactCTAText}
        demoScheduling={settings.demoScheduling}
      />

      {/* Case Studies */}
      {settings.sectionVisibility.caseStudies &&
        settings.caseStudies &&
        settings.caseStudies.length > 0 && (
          <CaseStudies
            effectiveColors={{
              primary: "#a855f7",
              secondary: "#ec4899",
              accent: "#fbbf24",
              text: "#ffffff",
            }}
            effectiveHeadingFont="inherit"
            caseStudies={settings.caseStudies}
            title={settings.caseStudiesTitle || "Success Stories"}
            subtitle={
              settings.caseStudiesSubtitle ||
              "See how our clients are succeeding"
            }
          />
        )}

      {/* Footer */}
      {settings.sectionVisibility.footer && (
        <footer className="py-12 border-t border-gray-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                {settings.logo ? (
                  <img
                    src={settings.logo}
                    alt={settings.siteName}
                    className="h-6 w-auto max-w-[100px] object-contain opacity-70"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
                    <Zap className="h-5 w-5 text-gray-900" />
                  </div>
                )}
                <span className="text-gray-400">
                  {settings.footerCopyright?.replace(
                    /\{YEAR\}/g,
                    String(new Date().getFullYear()),
                  )}
                </span>
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-400">
                <Link href="/" className="hover:text-purple-400 transition-colors">
                  Home
                </Link>
                <Link href="/terms" className="hover:text-purple-400 transition-colors">
                  Terms
                </Link>
                <Link href="/privacy" className="hover:text-purple-400 transition-colors">
                  Privacy
                </Link>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
