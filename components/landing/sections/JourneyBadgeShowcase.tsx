"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight, Map, Award, Star, Sparkles, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingTheme } from "@/lib/themes/landing-themes";

// Game icon paths for the journey/badge showcase
const JOURNEY_ICONS = {
  map: "/game-icons/Pirate Map.png",
  compass: "/game-icons/Compass.png",
  ship: "/game-icons/Pirate Ship.png",
  treasure: "/game-icons/treasure.png",
  chest: "/game-icons/chest 1.png",
  crown: "/game-icons/16. Crown.png",
  trophy: "/game-icons/1. TROPHY.png",
  starBadge: "/game-icons/14. STAR BADGE.png",
  shieldAward: "/game-icons/5. SHIELD AWARD.png",
  goldMedal: "/game-icons/3. GOLD MEDAL.png",
  champion: "/game-icons/11. CHAMPION AWARD.png",
  victory: "/game-icons/20. VICTORY AWARD.png",
  starAward: "/game-icons/9. STAR AWARD.png",
  scroll: "/game-icons/7. SCROLL AWARD.png",
  helmet: "/game-icons/helmet 1.png",
  sword: "/game-icons/sword.png",
  guideBook: "/game-icons/20. GuideBook.png",
  gems: "/game-icons/4. Gems.png",
  coins: "/game-icons/Pirate Coins.png",
  anchor: "/game-icons/Anchor.png",
};

// Journey milestones displayed on the landing page
const JOURNEY_MILESTONES = [
  { icon: JOURNEY_ICONS.anchor, title: "First Voyage", desc: "Sign up & complete your profile", level: "1" },
  { icon: JOURNEY_ICONS.compass, title: "Navigator", desc: "Complete your first 10 trades", level: "5" },
  { icon: JOURNEY_ICONS.ship, title: "Captain", desc: "Win your first competition", level: "10" },
  { icon: JOURNEY_ICONS.chest, title: "Treasure Hunter", desc: "Earn 1,000 XP from trading", level: "15" },
  { icon: JOURNEY_ICONS.sword, title: "Warrior", desc: "Win 5 head-to-head challenges", level: "20" },
  { icon: JOURNEY_ICONS.crown, title: "Legend", desc: "Reach the top 10 leaderboard", level: "30" },
];

// Badge categories
const BADGE_CATEGORIES = [
  {
    title: "Trading Milestones",
    badges: [
      { icon: JOURNEY_ICONS.trophy, name: "First Blood", desc: "Close your first profitable trade" },
      { icon: JOURNEY_ICONS.goldMedal, name: "Streak Master", desc: "5 winning trades in a row" },
      { icon: JOURNEY_ICONS.starBadge, name: "Sharp Shooter", desc: "Achieve 80%+ win rate in a comp" },
    ],
  },
  {
    title: "Competition Glory",
    badges: [
      { icon: JOURNEY_ICONS.champion, name: "Champion", desc: "Win a tournament with 10+ players" },
      { icon: JOURNEY_ICONS.victory, name: "Undefeated", desc: "Win 3 competitions back-to-back" },
      { icon: JOURNEY_ICONS.starAward, name: "Grand Master", desc: "Collect all competition badges" },
    ],
  },
  {
    title: "Community & Prestige",
    badges: [
      { icon: JOURNEY_ICONS.helmet, name: "Veteran", desc: "Trade for 30 consecutive days" },
      { icon: JOURNEY_ICONS.gems, name: "Diamond Hands", desc: "Reach Level 25+" },
      { icon: JOURNEY_ICONS.scroll, name: "Scholar", desc: "Complete all learning milestones" },
    ],
  },
];

interface JourneyBadgeShowcaseProps {
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
  title?: string;
  subtitle?: string;
  description?: string;
  features?: Array<{ id: string; icon: string; gameIcon?: string; title: string; description: string; enabled: boolean; order: number }>;
  ctaText?: string;
  ctaLink?: string;
}

export default function JourneyBadgeShowcase({
  theme,
  effectiveColors,
  effectiveHeadingFont,
}: JourneyBadgeShowcaseProps) {
  return (
    <section id="journey" className="py-24 relative overflow-hidden">
      {/* Background mesh gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 20% 40%, ${effectiveColors.primary}0a, transparent),
            radial-gradient(ellipse 60% 50% at 80% 60%, ${effectiveColors.secondary}08, transparent)
          `,
        }}
      />

      {/* Floating decorative icons */}
      <motion.div
        className="absolute top-16 left-8 opacity-[0.07] pointer-events-none hidden lg:block"
        animate={{ y: [0, -15, 0], rotate: [-5, 5, -5] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      >
        <img src={JOURNEY_ICONS.map} alt="" width={120} height={120} className="drop-shadow-2xl" />
      </motion.div>
      <motion.div
        className="absolute bottom-20 right-12 opacity-[0.07] pointer-events-none hidden lg:block"
        animate={{ y: [0, 12, 0], rotate: [5, -5, 5] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <img src={JOURNEY_ICONS.treasure} alt="" width={100} height={100} className="drop-shadow-2xl" />
      </motion.div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold mb-6"
            style={{
              backgroundColor: `${effectiveColors.accent}15`,
              border: `1px solid ${effectiveColors.accent}30`,
              color: effectiveColors.accent,
            }}
          >
            <Map className="h-4 w-4" />
            <span>Your Trading Adventure</span>
          </motion.div>

          <h2
            className="text-4xl md:text-6xl font-black mb-6"
            style={{ fontFamily: effectiveHeadingFont }}
          >
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, ${effectiveColors.accent}, ${effectiveColors.primary}, ${effectiveColors.secondary})`,
              }}
            >
              JOURNEY & BADGES
            </span>
          </h2>
          <p className="text-xl max-w-3xl mx-auto mb-2" style={{ color: effectiveColors.text }}>
            Every trade is a step on your epic journey. Collect badges, level up, and carve your legend.
          </p>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: theme?.colors.textMuted }}>
            From your first trade to the Hall of Legends — track your progress across an immersive, gamified adventure map.
          </p>
        </motion.div>

        {/* ─── Journey Path ─────────────────────────────────────────────── */}
        <div className="mb-24">
          <h3
            className="text-2xl md:text-3xl font-bold text-center mb-12"
            style={{ fontFamily: effectiveHeadingFont, color: effectiveColors.text }}
          >
            <Compass className="inline h-7 w-7 mr-2" style={{ color: effectiveColors.primary }} />
            The Trader&apos;s Journey
          </h3>

          <div className="relative">
            {/* Connecting line */}
            <div
              className="absolute top-1/2 left-0 right-0 h-0.5 hidden lg:block -translate-y-1/2"
              style={{
                background: `linear-gradient(90deg, transparent, ${effectiveColors.primary}40, ${effectiveColors.secondary}40, transparent)`,
              }}
            />

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {JOURNEY_MILESTONES.map((m, i) => (
                <motion.div
                  key={m.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -8, scale: 1.05 }}
                  className="group relative flex flex-col items-center text-center"
                >
                  {/* Glow ring on hover */}
                  <div
                    className="relative w-24 h-24 rounded-full flex items-center justify-center mb-4 transition-all duration-500 group-hover:shadow-[0_0_30px_rgba(255,215,0,0.3)]"
                    style={{
                      background: `linear-gradient(145deg, ${effectiveColors.background}cc, ${effectiveColors.primary}12)`,
                      border: `2px solid ${effectiveColors.primary}30`,
                    }}
                  >
                    {/* Inner glow */}
                    <div
                      className="absolute inset-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{
                        background: `radial-gradient(circle, ${effectiveColors.primary}20, transparent 70%)`,
                      }}
                    />
                    <img
                      src={m.icon}
                      alt={m.title}
                      width={52}
                      height={52}
                      className="relative z-10 drop-shadow-lg group-hover:scale-110 transition-transform duration-300"
                      // Reason: game-icons are in /public/game-icons/ — <img> is used for these static assets.
                    />
                    {/* Level badge */}
                    <span
                      className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full text-[10px] font-black flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${effectiveColors.primary}, ${effectiveColors.secondary})`,
                        color: effectiveColors.background,
                        boxShadow: `0 2px 8px ${effectiveColors.primary}40`,
                      }}
                    >
                      L{m.level}
                    </span>
                  </div>

                  <h4
                    className="text-sm font-bold mb-1"
                    style={{ color: effectiveColors.text, fontFamily: effectiveHeadingFont }}
                  >
                    {m.title}
                  </h4>
                  <p className="text-xs leading-relaxed" style={{ color: theme?.colors.textMuted }}>
                    {m.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Badge Showcase ──────────────────────────────────────────── */}
        <div className="mb-16">
          <h3
            className="text-2xl md:text-3xl font-bold text-center mb-4"
            style={{ fontFamily: effectiveHeadingFont, color: effectiveColors.text }}
          >
            <Award className="inline h-7 w-7 mr-2" style={{ color: effectiveColors.accent }} />
            Collectible Badges
          </h3>
          <p className="text-center text-lg mb-12" style={{ color: theme?.colors.textMuted }}>
            Unlock over 50 unique badges as you master trading, win competitions, and build your legacy.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {BADGE_CATEGORIES.map((cat, catIdx) => (
              <motion.div
                key={cat.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: catIdx * 0.15 }}
                viewport={{ once: true }}
                className="group rounded-2xl overflow-hidden"
                style={{
                  backgroundColor: theme?.colors.backgroundCard,
                  border: `1px solid ${theme?.colors.border}`,
                }}
              >
                {/* Category header */}
                <div
                  className="px-6 py-4"
                  style={{
                    background: `linear-gradient(135deg, ${effectiveColors.primary}12, ${effectiveColors.secondary}08)`,
                    borderBottom: `1px solid ${theme?.colors.border}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5" style={{ color: effectiveColors.accent }} />
                    <h4 className="font-bold text-lg" style={{ color: effectiveColors.text, fontFamily: effectiveHeadingFont }}>
                      {cat.title}
                    </h4>
                  </div>
                </div>

                {/* Badges */}
                <div className="p-5 space-y-4">
                  {cat.badges.map((badge, bIdx) => (
                    <motion.div
                      key={badge.name}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: catIdx * 0.15 + bIdx * 0.1 }}
                      viewport={{ once: true }}
                      whileHover={{ x: 4 }}
                      className="flex items-center gap-4 group/badge cursor-default"
                    >
                      <div
                        className="relative w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center transition-all duration-300 group-hover/badge:shadow-[0_0_20px_rgba(255,215,0,0.25)]"
                        style={{
                          background: `linear-gradient(145deg, ${effectiveColors.primary}15, ${effectiveColors.secondary}10)`,
                          border: `1px solid ${effectiveColors.primary}20`,
                        }}
                      >
                        <img
                          src={badge.icon}
                          alt={badge.name}
                          width={36}
                          height={36}
                          className="drop-shadow-md group-hover/badge:scale-110 transition-transform duration-300"
                        />
                        {/* Sparkle on hover */}
                        <Sparkles
                          className="absolute -top-1 -right-1 h-3 w-3 opacity-0 group-hover/badge:opacity-100 transition-opacity duration-300"
                          style={{ color: effectiveColors.accent }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: effectiveColors.text }}>
                          {badge.name}
                        </p>
                        <p className="text-xs" style={{ color: theme?.colors.textMuted }}>
                          {badge.desc}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Link href="/sign-up">
            <Button
              size="lg"
              className="font-bold text-lg px-10 py-6 hover:scale-105 transition-all duration-300 rounded-xl"
              style={{
                background: theme?.effects.gradientStyle,
                color: theme?.colors.background,
                boxShadow: `0 10px 40px ${theme?.colors.accentGlow}`,
              }}
            >
              <Map className="h-5 w-5 mr-2" />
              Start Your Journey
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
          <p className="mt-4 text-sm" style={{ color: theme?.colors.textMuted }}>
            Over 50 badges to collect. How far can you go?
          </p>
        </motion.div>
      </div>
    </section>
  );
}
