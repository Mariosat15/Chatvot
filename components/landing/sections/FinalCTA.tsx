"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingTheme } from "@/lib/themes/landing-themes";

interface FinalCTAProps {
  theme?: LandingTheme;
  effectiveColors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    text?: string;
  };
  effectiveHeadingFont?: string;
  title?: string;
  subtitle?: string;
  primaryCTA?: { text: string; href: string };
  secondaryCTA?: { text: string; href: string };
}

export default function FinalCTA({
  theme,
  effectiveColors: propColors,
  effectiveHeadingFont: propFont,
  title = "Ready to Start Winning?",
  subtitle = "Join thousands of traders competing for real prizes. Sign up now and get your welcome bonus!",
  primaryCTA = { text: "Start Trading Now", href: "/sign-up" },
  secondaryCTA = { text: "View Competitions", href: "/competitions" },
}: FinalCTAProps) {
  const effectiveColors = {
    primary: propColors?.primary || "#00f0ff",
    secondary: propColors?.secondary || "#ff00ff",
    accent: propColors?.accent || "#ffd700",
    text: propColors?.text || "#ffffff",
  };
  const effectiveHeadingFont = propFont || "inherit";
  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className="relative py-24 md:py-32 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${effectiveColors.primary}15 0%, ${effectiveColors.secondary}15 50%, ${effectiveColors.accent}15 100%)`,
      }}
    >
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[150px] opacity-30"
          style={{ backgroundColor: effectiveColors.primary }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-[150px] opacity-30"
          style={{ backgroundColor: effectiveColors.secondary }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-8"
          style={{
            background: theme?.effects?.gradientStyle,
            color: theme?.colors?.background,
          }}
        >
          <Sparkles className="h-4 w-4" />
          Limited Time Offer
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-6xl font-black mb-6"
          style={{
            color: effectiveColors.text,
            fontFamily: effectiveHeadingFont,
          }}
        >
          {title}
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-xl mb-10 max-w-2xl mx-auto"
          style={{ color: theme?.colors?.textMuted }}
        >
          {subtitle}
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row justify-center gap-4"
        >
          <Link href={primaryCTA.href}>
            <Button
              size="lg"
              className="font-bold text-lg px-8 py-6 hover:scale-105 transition-all group"
              style={{
                background: theme?.effects?.gradientStyle,
                color: theme?.colors?.background,
                boxShadow: `0 20px 50px ${effectiveColors.primary}40`,
              }}
            >
              {primaryCTA.text}
              <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>

          <Link href={secondaryCTA.href}>
            <Button
              size="lg"
              variant="outline"
              className="font-bold text-lg px-8 py-6 hover:scale-105 transition-all"
              style={{
                borderColor: effectiveColors.primary,
                color: effectiveColors.primary,
              }}
            >
              {secondaryCTA.text}
            </Button>
          </Link>
        </motion.div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-12 flex flex-wrap justify-center gap-6 text-sm"
          style={{ color: theme?.colors?.textMuted }}
        >
          <span className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            No hidden fees
          </span>
          <span className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            Instant withdrawals
          </span>
          <span className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            24/7 Support
          </span>
          <span className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            Secure & Fair
          </span>
        </motion.div>
      </div>
    </motion.section>
  );
}
