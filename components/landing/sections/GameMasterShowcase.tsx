"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Crown,
  DollarSign,
  Users,
  Swords,
  BarChart3,
  Rocket,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Shield,
  Trophy,
  Target,
  Zap,
  Award,
  Gift,
  Flame,
  Globe,
  Lock,
  CreditCard,
  Bell,
  FileText,
  PieChart,
  Headphones,
  Server,
  Database,
  Code,
  Mail,
  Phone,
  Star,
  Timer,
  Coins,
  ShoppingBag,
  Medal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingTheme } from "@/lib/themes/landing-themes";

// Icon mapping for dynamic icon rendering
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Crown, DollarSign, Users, Swords, BarChart3, Rocket, Sparkles,
  TrendingUp, Shield, Trophy, Target, Zap, Award, Gift, Flame,
  Globe, Lock, CreditCard, Bell, FileText, PieChart, Headphones,
  Server, Database, Code, Mail, Phone, Star, Timer, Coins,
  ShoppingBag, Medal, ChevronRight,
};

// Game icon images mapped to GM benefit IDs
const GM_GAME_ICONS: Record<string, string> = {
  gm1: "/game-icons/1. TROPHY.png",        // Host tournaments
  gm2: "/game-icons/Pirate Coins.png",      // Earn referral fees
  gm3: "/game-icons/Pirate Flag.png",       // Build community
  gm4: "/game-icons/9. Sword.png",          // 1v1 challenges
  gm5: "/game-icons/portofolio.png",        // Revenue dashboard
  gm6: "/game-icons/incrase provit.png",    // Scale without limits
};

// GM journey steps — showing the path from player to GM empire
const GM_JOURNEY = [
  { step: 1, title: "Subscribe", desc: "Choose a GM plan that fits your goals", icon: "/game-icons/15. Key.png" },
  { step: 2, title: "Create Events", desc: "Design competitions & 1v1 challenges", icon: "/game-icons/1. TROPHY.png" },
  { step: 3, title: "Invite Players", desc: "Build your trading community", icon: "/game-icons/Pirate Flag.png" },
  { step: 4, title: "Earn & Grow", desc: "Collect referral fees from every prize pool", icon: "/game-icons/treasure.png" },
];

interface GameMasterBenefit {
  id: string;
  icon: string;
  title: string;
  description: string;
  enabled: boolean;
  order: number;
}

interface GameMasterShowcaseProps {
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
  title: string;
  subtitle: string;
  description: string;
  benefits: GameMasterBenefit[];
  ctaText: string;
  ctaLink: string;
}

export default function GameMasterShowcase({
  theme,
  effectiveColors,
  effectiveHeadingFont,
  title,
  subtitle,
  description,
  benefits,
  ctaText,
  ctaLink,
}: GameMasterShowcaseProps) {
  const enabledBenefits = benefits
    .filter((b) => b.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <section id="game-master" className="py-24 relative overflow-hidden">
      {/* Background gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at top right, ${effectiveColors.primary}12, transparent 50%), radial-gradient(ellipse at bottom left, ${effectiveColors.secondary}12, transparent 50%)`,
        }}
      />

      {/* Floating crown (game icon) */}
      <motion.div
        className="absolute top-16 right-12 opacity-[0.08] pointer-events-none hidden lg:block"
        animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <img src="/game-icons/16. Crown.png" alt="" width={120} height={120} className="drop-shadow-2xl" />
      </motion.div>
      <motion.div
        className="absolute bottom-20 left-8 opacity-[0.06] pointer-events-none hidden lg:block"
        animate={{ y: [0, 15, 0], rotate: [-3, 3, -3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      >
        <img src="/game-icons/Pirate Coins.png" alt="" width={90} height={90} className="drop-shadow-2xl" />
      </motion.div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold mb-6"
            style={{
              backgroundColor: `${effectiveColors.primary}15`,
              border: `1px solid ${effectiveColors.primary}30`,
              color: effectiveColors.primary,
            }}
          >
            <Crown className="h-4 w-4" />
            <span>Entrepreneurship Meets Trading</span>
          </motion.div>

          <h2
            className="text-4xl md:text-6xl font-black mb-6"
            style={{ fontFamily: effectiveHeadingFont }}
          >
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, ${effectiveColors.primary}, ${effectiveColors.accent || effectiveColors.secondary}, ${effectiveColors.primary})`,
              }}
            >
              {title}
            </span>
          </h2>
          <p
            className="text-xl max-w-3xl mx-auto mb-2 font-medium"
            style={{ color: effectiveColors.text }}
          >
            {subtitle}
          </p>
          <p
            className="text-lg max-w-2xl mx-auto"
            style={{ color: theme?.colors.textMuted }}
          >
            {description}
          </p>
        </motion.div>

        {/* ─── GM Journey Path ────────────────────────────────────────── */}
        <div className="mb-16">
          <h3
            className="text-xl md:text-2xl font-bold text-center mb-10"
            style={{ fontFamily: effectiveHeadingFont, color: effectiveColors.text }}
          >
            Your Game Master Journey
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto">
            {GM_JOURNEY.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12 }}
                viewport={{ once: true }}
                whileHover={{ y: -6 }}
                className="group flex flex-col items-center text-center"
              >
                {/* Step circle with game icon */}
                <div
                  className="relative w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all duration-500 group-hover:shadow-[0_0_25px_rgba(255,215,0,0.25)]"
                  style={{
                    background: `linear-gradient(145deg, ${effectiveColors.background}cc, ${effectiveColors.primary}12)`,
                    border: `2px solid ${effectiveColors.primary}30`,
                  }}
                >
                  <div
                    className="absolute inset-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: `radial-gradient(circle, ${effectiveColors.primary}20, transparent 70%)` }}
                  />
                  <img
                    src={s.icon}
                    alt={s.title}
                    width={44}
                    height={44}
                    className="relative z-10 drop-shadow-lg group-hover:scale-110 transition-transform duration-300"
                  />
                  {/* Step number */}
                  <span
                    className="absolute -top-1 -left-1 w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${effectiveColors.primary}, ${effectiveColors.secondary})`,
                      color: effectiveColors.background,
                    }}
                  >
                    {s.step}
                  </span>
                </div>
                <h4 className="text-sm font-bold mb-1" style={{ color: effectiveColors.text, fontFamily: effectiveHeadingFont }}>
                  {s.title}
                </h4>
                <p className="text-xs" style={{ color: theme?.colors.textMuted }}>{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Benefits Grid — now with game-icon images */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {enabledBenefits.map((benefit, index) => {
            const IconComponent = iconMap[benefit.icon] || Crown;
            // eslint-disable-next-line security/detect-object-injection
            const gameIcon = GM_GAME_ICONS[benefit.id];
            return (
              <motion.div
                key={benefit.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -6, scale: 1.02 }}
                className="group relative p-8 rounded-2xl overflow-hidden transition-all duration-300"
                style={{
                  backgroundColor: theme?.colors.backgroundCard,
                  border: `1px solid ${theme?.colors.border}`,
                }}
              >
                {/* Hover glow */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500"
                  style={{
                    background: `linear-gradient(135deg, ${effectiveColors.primary}08, ${effectiveColors.secondary}08)`,
                  }}
                />

                {/* Top accent line */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-all duration-300"
                  style={{
                    background: `linear-gradient(90deg, ${effectiveColors.primary}, ${effectiveColors.secondary || effectiveColors.primary})`,
                  }}
                />

                <div className="relative z-10">
                  {/* Icon area — game icon + Lucide icon */}
                  <div className="flex items-center gap-3 mb-5">
                    {gameIcon ? (
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 relative overflow-hidden"
                        style={{
                          background: `linear-gradient(135deg, ${effectiveColors.primary}20, ${effectiveColors.secondary}15)`,
                        }}
                      >
                        {/* Glow behind icon */}
                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                          style={{ background: `radial-gradient(circle, ${effectiveColors.primary}30, transparent 70%)` }}
                        />
                        <img
                          src={gameIcon}
                          alt={benefit.title}
                          width={36}
                          height={36}
                          className="relative z-10 drop-shadow-md group-hover:drop-shadow-lg"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                        style={{
                          background: `linear-gradient(135deg, ${effectiveColors.primary}25, ${effectiveColors.secondary}25)`,
                        }}
                      >
                        <IconComponent
                          className="h-7 w-7"
                        />
                      </div>
                    )}
                  </div>

                  <h3
                    className="text-lg font-bold mb-3"
                    style={{
                      color: effectiveColors.text,
                      fontFamily: effectiveHeadingFont,
                    }}
                  >
                    {benefit.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: theme?.colors.textMuted }}
                  >
                    {benefit.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Link href={ctaLink}>
            <Button
              size="lg"
              className="font-bold text-lg px-10 py-6 hover:scale-105 transition-all duration-300 rounded-xl"
              style={{
                background: theme?.effects.gradientStyle,
                color: theme?.colors.background,
                boxShadow: `0 10px 40px ${theme?.colors.accentGlow}`,
              }}
            >
              <Crown className="h-5 w-5 mr-2" />
              {ctaText}
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
          <p
            className="mt-4 text-sm"
            style={{ color: theme?.colors.textMuted }}
          >
            Start earning from Day 1 — no upfront costs, just results.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
