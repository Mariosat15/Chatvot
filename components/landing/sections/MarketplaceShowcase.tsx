"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight, ShoppingBag, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingTheme } from "@/lib/themes/landing-themes";

// Marketplace item images from /game-icons/
const MARKETPLACE_ITEMS = [
  {
    id: "avatars",
    title: "Premium Avatars",
    description: "Stand out with exclusive animated and 3D avatars. Show your rank and style on every leaderboard.",
    image: "/game-icons/helmet 1.png",
    badge: "Popular",
    bgGradient: "from-purple-500/10 to-pink-500/10",
  },
  {
    id: "badges",
    title: "Rare Badges",
    description: "Collect limited-edition badges that showcase your achievements, competitions won, and milestones reached.",
    image: "/game-icons/14. STAR BADGE.png",
    badge: "Collectible",
    bgGradient: "from-yellow-500/10 to-orange-500/10",
  },
  {
    id: "borders",
    title: "Profile Borders",
    description: "Decorate your profile with animated borders — from golden flames to icy crystals. Prestige meets style.",
    image: "/game-icons/Magic Shiled 3D.png",
    badge: "Premium",
    bgGradient: "from-cyan-500/10 to-blue-500/10",
  },
  {
    id: "effects",
    title: "Trading Effects",
    description: "Add visual flair to your trades with particle effects, sound cues, and victory animations.",
    image: "/game-icons/lightning speel.png",
    badge: "New",
    bgGradient: "from-green-500/10 to-emerald-500/10",
  },
  {
    id: "titles",
    title: "Custom Titles",
    description: "Equip exclusive titles like 'The Oracle', 'Pip Slayer', or 'Market Shark' next to your name.",
    image: "/game-icons/16. Crown.png",
    badge: "Exclusive",
    bgGradient: "from-red-500/10 to-rose-500/10",
  },
  {
    id: "chest",
    title: "Mystery Chests",
    description: "Open chests to discover random cosmetics, XP boosts, and rare collectibles. Fortune favors the bold.",
    image: "/game-icons/chest 1.png",
    badge: "Loot",
    bgGradient: "from-amber-500/10 to-yellow-500/10",
  },
];

interface MarketplaceShowcaseProps {
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
}

export default function MarketplaceShowcase({
  theme,
  effectiveColors,
  effectiveHeadingFont,
}: MarketplaceShowcaseProps) {
  return (
    <section id="marketplace" className="py-24 relative overflow-hidden">
      {/* Subtle grid pattern background */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(${effectiveColors.primary}40 1px, transparent 1px),
            linear-gradient(90deg, ${effectiveColors.primary}40 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Floating decoration */}
      <motion.div
        className="absolute top-20 right-16 opacity-[0.06] pointer-events-none hidden lg:block"
        animate={{ y: [0, -12, 0], rotate: [0, 8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <img src="/game-icons/pouch 1.png" alt="" width={100} height={100} />
      </motion.div>
      <motion.div
        className="absolute bottom-28 left-10 opacity-[0.06] pointer-events-none hidden lg:block"
        animate={{ y: [0, 10, 0], rotate: [0, -6, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <img src="/game-icons/4. Gems.png" alt="" width={80} height={80} />
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
              backgroundColor: `${effectiveColors.secondary}15`,
              border: `1px solid ${effectiveColors.secondary}30`,
              color: effectiveColors.secondary,
            }}
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Trading Arsenal & Marketplace</span>
          </motion.div>

          <h2
            className="text-4xl md:text-6xl font-black mb-6"
            style={{ fontFamily: effectiveHeadingFont }}
          >
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, ${effectiveColors.secondary}, ${effectiveColors.accent || effectiveColors.primary})`,
              }}
            >
              GEAR UP FOR GLORY
            </span>
          </h2>
          <p className="text-xl max-w-3xl mx-auto mb-2" style={{ color: effectiveColors.text }}>
            Customize your trading identity with exclusive cosmetics, rare collectibles, and powerful upgrades.
          </p>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: theme?.colors.textMuted }}>
            Earn items through achievements or browse the marketplace. Your style, your statement.
          </p>
        </motion.div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {MARKETPLACE_ITEMS.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              whileHover={{ y: -8 }}
              className="group relative rounded-2xl overflow-hidden transition-all duration-500"
              style={{
                backgroundColor: theme?.colors.backgroundCard,
                border: `1px solid ${theme?.colors.border}`,
              }}
            >
              {/* Hover glow overlay */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse at center, ${effectiveColors.primary}08, transparent 70%)`,
                }}
              />

              {/* Top accent */}
              <div
                className="absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-all duration-300"
                style={{
                  background: `linear-gradient(90deg, ${effectiveColors.secondary}, ${effectiveColors.primary})`,
                }}
              />

              {/* Badge tag */}
              <div className="absolute top-4 right-4 z-20">
                <span
                  className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background: `${effectiveColors.primary}20`,
                    color: effectiveColors.primary,
                    border: `1px solid ${effectiveColors.primary}30`,
                  }}
                >
                  {item.badge}
                </span>
              </div>

              {/* Image area */}
              <div
                className="relative h-44 flex items-center justify-center overflow-hidden"
                style={{
                  background: `linear-gradient(180deg, ${effectiveColors.primary}06, ${effectiveColors.secondary}04)`,
                }}
              >
                {/* Radial glow behind item */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700"
                  style={{
                    background: `radial-gradient(circle at center, ${effectiveColors.primary}15, transparent 60%)`,
                  }}
                />

                <motion.img
                  src={item.image}
                  alt={item.title}
                  width={90}
                  height={90}
                  className="relative z-10 drop-shadow-2xl"
                  whileHover={{ scale: 1.15, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                />

                {/* Sparkle decorations */}
                <Sparkles
                  className="absolute top-6 left-6 h-4 w-4 opacity-0 group-hover:opacity-60 transition-all duration-500"
                  style={{ color: effectiveColors.accent }}
                />
                <Sparkles
                  className="absolute bottom-8 right-8 h-3 w-3 opacity-0 group-hover:opacity-40 transition-all duration-700"
                  style={{ color: effectiveColors.primary }}
                />
              </div>

              {/* Content */}
              <div className="relative z-10 p-6 pt-4">
                <h3
                  className="text-lg font-bold mb-2"
                  style={{ color: effectiveColors.text, fontFamily: effectiveHeadingFont }}
                >
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: theme?.colors.textMuted }}>
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Link href="/marketplace">
            <Button
              size="lg"
              className="font-bold text-lg px-10 py-6 hover:scale-105 transition-all duration-300 rounded-xl"
              style={{
                background: theme?.effects.gradientStyle,
                color: theme?.colors.background,
                boxShadow: `0 10px 40px ${theme?.colors.accentGlow}`,
              }}
            >
              <ShoppingBag className="h-5 w-5 mr-2" />
              Browse Marketplace
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
          <p className="mt-4 text-sm" style={{ color: theme?.colors.textMuted }}>
            New items drop weekly. Collect them all.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
