"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Swords, Loader2 } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { LandingTheme } from "@/lib/themes/landing-themes";
import { GAME_ICONS } from "@/lib/constants/game-icons";
import SectionWrapper from "./SectionWrapper";
import {
  ActiveChallenge,
  CompletedChallenge,
  ChallengeStats,
  ActiveChallengeCards,
} from "./challenge-arena-parts";
import {
  ArenaEmptyState,
  RecentVictors,
  ChallengeStatsBar,
} from "./challenge-arena-extras";

interface LiveChallengesProps {
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
  description?: string;
  ctaText?: string;
  ctaLink?: string;
  externalData?: {
    active: ActiveChallenge[];
    completed: CompletedChallenge[];
    stats: ChallengeStats;
  };
}

export default function LiveChallenges({
  theme,
  effectiveColors: propColors,
  effectiveHeadingFont: propFont,
  title = "1v1 Trading Duels",
  subtitle = "Settle It Head-to-Head",
  description = "Think you're better than another trader? Prove it. Challenge anyone to a direct 1v1 duel — choose the stake, set the rules, and let the market decide the winner. No luck, just pure skill.",
  ctaText = "Challenge a Trader",
  ctaLink = "/challenges",
  externalData,
}: LiveChallengesProps) {
  const effectiveColors = {
    primary: propColors?.primary || "#00f0ff",
    secondary: propColors?.secondary || "#ff00ff",
    accent: propColors?.accent || "#ffd700",
    text: propColors?.text || "#ffffff",
  };
  const effectiveHeadingFont = propFont || "inherit";

  const [activeChallenges, setActiveChallenges] = useState<ActiveChallenge[]>(
    [],
  );
  const [completedChallenges, setCompletedChallenges] = useState<
    CompletedChallenge[]
  >([]);
  const [stats, setStats] = useState<ChallengeStats | null>(null);
  const [loading, setLoading] = useState(!externalData);

  useEffect(() => {
    if (externalData) {
      setActiveChallenges(externalData.active || []);
      setCompletedChallenges(externalData.completed || []);
      setStats(externalData.stats);
      setLoading(false);
    }
  }, [externalData]);

  useEffect(() => {
    if (externalData) return;
    const fetchChallenges = async () => {
      try {
        const response = await fetch("/api/landing/challenges");
        if (response.ok) {
          const data = await response.json();
          setActiveChallenges(data.active || []);
          setCompletedChallenges(data.completed || []);
          setStats(data.stats);
        }
      } catch (error) {
        console.error("Failed to fetch challenges:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchChallenges();
    const interval = setInterval(fetchChallenges, 30000);
    return () => clearInterval(interval);
  }, [externalData]);

  return (
    <SectionWrapper id="challenges" className="py-24 relative overflow-hidden">
      {/* Decorative crossed swords background */}
      <motion.div
        className="absolute top-20 left-8 opacity-[0.06] pointer-events-none hidden lg:block"
        animate={{ y: [0, -15, 0], rotate: [0, -8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image
          src={GAME_ICONS.sword1}
          alt=""
          width={120}
          height={120}
          className="w-28 h-28"
        />
      </motion.div>
      <motion.div
        className="absolute top-20 right-8 opacity-[0.06] pointer-events-none hidden lg:block"
        animate={{ y: [0, -15, 0], rotate: [0, 8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        style={{ transform: "scaleX(-1)" }}
      >
        <Image
          src={GAME_ICONS.sword1}
          alt=""
          width={120}
          height={120}
          className="w-28 h-28"
        />
      </motion.div>
      <motion.div
        className="absolute bottom-32 left-1/2 -translate-x-1/2 opacity-[0.04] pointer-events-none hidden lg:block"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image
          src={GAME_ICONS.shield1}
          alt=""
          width={180}
          height={180}
          className="w-44 h-44"
        />
      </motion.div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* ═══ Section Header ═══ */}
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
            <Swords className="h-4 w-4" />
            <Image
              src={GAME_ICONS.swordNumbered}
              alt=""
              width={16}
              height={16}
              className="h-4 w-4 object-contain"
            />
            {subtitle}
          </motion.div>

          <h2
            className="text-4xl md:text-6xl font-black mb-6"
            style={{ fontFamily: effectiveHeadingFont }}
          >
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, ${effectiveColors.secondary}, ${effectiveColors.accent}, ${effectiveColors.secondary})`,
                backgroundSize: "200% 200%",
              }}
            >
              {title}
            </span>
          </h2>

          <p
            className="text-lg max-w-3xl mx-auto leading-relaxed"
            style={{ color: theme?.colors?.textMuted }}
          >
            {description}
          </p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2
              className="h-8 w-8 animate-spin"
              style={{ color: effectiveColors.secondary }}
            />
          </div>
        ) : (
          <>
            {/* ═══ LIVE BATTLE ARENA ═══ */}
            <div className="mb-12">
              {activeChallenges.length > 0 ? (
                <ActiveChallengeCards
                  challenges={activeChallenges}
                  effectiveColors={effectiveColors}
                  theme={theme}
                />
              ) : (
                <ArenaEmptyState
                  effectiveColors={effectiveColors}
                  effectiveHeadingFont={effectiveHeadingFont}
                  theme={theme}
                />
              )}
            </div>

            {/* ═══ RECENT VICTORS ═══ */}
            {completedChallenges.length > 0 && (
              <RecentVictors
                challenges={completedChallenges}
                effectiveColors={effectiveColors}
                theme={theme}
              />
            )}

            {/* ═══ STATS BAR ═══ */}
            {stats && (
              <ChallengeStatsBar
                stats={stats}
                effectiveColors={effectiveColors}
                theme={theme}
              />
            )}
          </>
        )}

        {/* ═══ CTA ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Link href={ctaLink}>
            <Button
              size="lg"
              className="font-bold text-lg px-10 py-6 hover:scale-105 transition-all duration-300 rounded-xl group"
              style={{
                background: `linear-gradient(135deg, ${effectiveColors.secondary}, ${effectiveColors.primary})`,
                color: theme?.colors?.background,
                boxShadow: `0 10px 40px ${effectiveColors.secondary}40`,
              }}
            >
              <Image
                src={GAME_ICONS.swordNumbered}
                alt=""
                width={20}
                height={20}
                className="w-5 h-5 mr-2 object-contain group-hover:rotate-12 transition-transform"
                style={{ filter: "brightness(0) invert(1)" }}
              />
              {ctaText}
              <ChevronRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <p
            className="mt-4 text-sm"
            style={{ color: theme?.colors?.textMuted }}
          >
            Pick your opponent. Set the stakes. Let the market decide.
          </p>
        </motion.div>
      </div>
    </SectionWrapper>
  );
}
