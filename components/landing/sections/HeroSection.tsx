"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingTheme } from "@/lib/themes/landing-themes";
import ThemedBackground from "@/components/landing/ThemedBackground";

// Animated counter for stats
function AnimatedCounter({
  value,
  suffix = "",
}: {
  value: string;
  suffix?: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const numericValue = parseInt(value.replace(/\D/g, "")) || 0;

  useEffect(() => {
    if (!isInView) return () => {};
    const duration = 2000;
    const steps = 60;
    const increment = numericValue / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= numericValue) {
        setCount(numericValue);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [isInView, numericValue]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

interface HeroSectionProps {
  theme: LandingTheme | null;
  effectiveColors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    border?: string;
  };
  effectiveHeadingFont: string;
  heroSubtitle: string;
  heroTitle: string;
  heroDescription: string;
  heroCTAButtons: Array<{
    id: string;
    text: string;
    href: string;
    style: string;
    icon?: string;
    enabled: boolean;
  }>;
  stats: Array<{
    id: string;
    label: string;
    value: string;
    suffix: string;
    icon: string;
    color: string;
    enabled: boolean;
  }>;
  statsAnimated: boolean;
}

export default function HeroSection({
  theme,
  effectiveColors,
  effectiveHeadingFont,
  heroSubtitle,
  heroTitle,
  heroDescription,
  heroCTAButtons,
  stats,
  statsAnimated,
}: HeroSectionProps) {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      <ThemedBackground theme={theme ?? undefined} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full text-sm font-bold mb-8"
            style={{
              background: `linear-gradient(135deg, ${effectiveColors.primary}15, ${effectiveColors.secondary}15)`,
              border: `1px solid ${effectiveColors.primary}40`,
              color: effectiveColors.primary,
              fontFamily: theme?.fonts.accent,
            }}
          >
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              {theme?.heroTextStyle?.titlePrefix ||
                theme?.themeIcons?.trophy ||
                "🏆"}
            </motion.span>
            <span className={theme?.heroTextStyle?.subtitleStyle}>
              {heroSubtitle}
            </span>
            <span>{theme?.themeIcons?.power || "⚡"}</span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-tight tracking-tight"
            style={{ fontFamily: effectiveHeadingFont }}
          >
            <span className="relative">
              <span
                className="absolute inset-0 bg-clip-text text-transparent blur-2xl opacity-60"
                style={{ backgroundImage: theme?.effects.gradientStyle }}
              >
                {theme?.heroTextStyle?.titlePrefix} {heroTitle}
              </span>
              <span
                className={`relative bg-clip-text text-transparent bg-[length:200%_auto] ${theme?.effects.animationStyle === "dynamic" || theme?.effects.animationStyle === "intense" ? "animate-gradient" : ""}`}
                style={{ backgroundImage: theme?.effects.gradientStyle }}
              >
                {heroTitle}
              </span>
            </span>
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-lg md:text-xl max-w-3xl mx-auto mb-10 leading-relaxed"
            style={{ color: theme?.colors.textMuted }}
          >
            {heroDescription}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            {heroCTAButtons
              .filter((btn) => btn.enabled)
              .map((btn) => {
                const isPrimary = btn.style === "primary";
                return (
                  <Link key={btn.id} href={btn.href}>
                    <Button
                      size="lg"
                      className={`text-lg px-8 py-7 font-bold transition-all duration-300 hover:scale-105 ${isPrimary ? "" : "border-2"}`}
                      style={
                        isPrimary
                          ? {
                              background: theme?.effects.gradientStyle,
                              color: theme?.colors.background,
                              boxShadow: `0 25px 50px -12px ${theme?.colors.accentGlow}`,
                              fontFamily: effectiveHeadingFont,
                            }
                          : {
                              backgroundColor: theme?.colors.backgroundCard,
                              borderColor: effectiveColors.primary,
                              color: effectiveColors.primary,
                            }
                      }
                    >
                      <span className="mr-2">
                        {isPrimary
                          ? theme?.heroTextStyle?.ctaIcon ||
                            theme?.themeIcons?.power ||
                            "🚀"
                          : ""}
                      </span>
                      {btn.text}
                      {!isPrimary && (
                        <ArrowRight className="h-5 w-5 ml-2" />
                      )}
                    </Button>
                  </Link>
                );
              })}
          </motion.div>

          {/* Quick Stats */}
          {stats && stats.filter((s) => s.enabled).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mt-16 grid grid-cols-3 gap-4 md:gap-8 max-w-3xl mx-auto"
            >
              {stats
                .filter((s) => s.enabled)
                .slice(0, 3)
                .map((stat, i) => {
                  const statIcons = [
                    theme?.themeIcons?.users,
                    theme?.themeIcons?.currency,
                    theme?.themeIcons?.stats,
                  ];
                  return (
                    <motion.div
                      key={stat.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.9 + i * 0.1 }}
                      className="text-center p-4 rounded-xl"
                      style={{
                        backgroundColor: `${effectiveColors.primary}08`,
                        border: `1px solid ${effectiveColors.primary}20`,
                      }}
                    >
                      <div className="text-2xl mb-2">
                        {statIcons[i] || ["👥", "💰", "📈"][i]}
                      </div>
                      <div
                        className="text-2xl md:text-4xl font-black mb-1"
                        style={{
                          color: effectiveColors.primary,
                          fontFamily: effectiveHeadingFont,
                        }}
                      >
                        {statsAnimated ? (
                          <AnimatedCounter
                            value={stat.value}
                            suffix={stat.suffix}
                          />
                        ) : (
                          `${stat.value}${stat.suffix}`
                        )}
                      </div>
                      <div
                        style={{ color: theme?.colors.textMuted }}
                        className="text-xs md:text-sm"
                      >
                        {stat.label}
                      </div>
                    </motion.div>
                  );
                })}
            </motion.div>
          )}
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="flex flex-col items-center gap-2"
          >
            <span
              className="text-xs uppercase tracking-widest"
              style={{ color: theme?.colors.textMuted }}
            >
              Scroll
            </span>
            <div
              className="w-6 h-10 rounded-full border-2 flex items-start justify-center pt-2"
              style={{ borderColor: `${effectiveColors.primary}40` }}
            >
              <motion.div
                animate={{ y: [0, 12, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-1.5 h-3 rounded-full"
                style={{ backgroundColor: effectiveColors.primary }}
              />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
