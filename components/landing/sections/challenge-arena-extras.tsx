"use client";

import { motion } from "framer-motion";
import { Trophy, Crown } from "lucide-react";
import Image from "next/image";
import { GAME_ICONS } from "@/lib/constants/game-icons";
import type {
  EffectiveColors,
  CompletedChallenge,
  ChallengeStats,
} from "./challenge-arena-parts";

// ─── Empty State (Arena Invitation) ──────────────────────────────────────────

export function ArenaEmptyState({
  effectiveColors,
  effectiveHeadingFont,
  theme,
}: {
  effectiveColors: EffectiveColors;
  effectiveHeadingFont: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  theme: any;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative rounded-2xl overflow-hidden"
      style={{
        backgroundColor: theme?.colors?.backgroundCard,
        border: `1px solid ${theme?.colors?.border}`,
      }}
    >
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: `radial-gradient(ellipse at 30% 50%, ${effectiveColors.primary}30, transparent 50%),
                       radial-gradient(ellipse at 70% 50%, ${effectiveColors.secondary}30, transparent 50%)`,
        }}
      />
      <div
        className="absolute top-0 bottom-0 left-1/2 w-px opacity-20"
        style={{
          background: `linear-gradient(to bottom, transparent, ${effectiveColors.accent}, transparent)`,
        }}
      />

      <div className="relative z-10 py-16 px-8">
        <div className="flex items-center justify-center gap-8 sm:gap-16 mb-8">
          <motion.div
            animate={{ x: [0, 5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center"
          >
            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center mb-3"
              style={{
                background: `linear-gradient(135deg, ${effectiveColors.primary}30, ${effectiveColors.primary}10)`,
                border: `2px solid ${effectiveColors.primary}40`,
                boxShadow: `0 0 30px ${effectiveColors.primary}15`,
              }}
            >
              <Image
                src={GAME_ICONS.helmet1}
                alt="Challenger"
                width={56}
                height={56}
                className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
                style={{ filter: `drop-shadow(0 0 8px ${effectiveColors.primary})` }}
              />
            </div>
            <span
              className="text-sm font-bold"
              style={{ color: effectiveColors.primary }}
            >
              YOU
            </span>
          </motion.div>

          <div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image
                src={GAME_ICONS.swordNumbered}
                alt="VS"
                width={48}
                height={48}
                className="w-12 h-12 object-contain"
                style={{ filter: `drop-shadow(0 0 10px ${effectiveColors.accent})` }}
              />
            </motion.div>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center font-black text-xl"
              style={{
                background: theme?.effects?.gradientStyle,
                color: theme?.colors?.background,
                boxShadow: `0 0 40px ${effectiveColors.accent}40`,
              }}
            >
              VS
            </div>
          </div>

          <motion.div
            animate={{ x: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center"
          >
            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center mb-3"
              style={{
                background: `linear-gradient(135deg, ${effectiveColors.secondary}30, ${effectiveColors.secondary}10)`,
                border: `2px solid ${effectiveColors.secondary}40`,
                boxShadow: `0 0 30px ${effectiveColors.secondary}15`,
              }}
            >
              <Image
                src={GAME_ICONS.helmet2}
                alt="Opponent"
                width={56}
                height={56}
                className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
                style={{ filter: `drop-shadow(0 0 8px ${effectiveColors.secondary})` }}
              />
            </div>
            <span
              className="text-sm font-bold"
              style={{ color: effectiveColors.secondary }}
            >
              OPPONENT
            </span>
          </motion.div>
        </div>

        <h4
          className="font-black text-2xl text-center mb-3"
          style={{ fontFamily: effectiveHeadingFont, color: effectiveColors.text }}
        >
          The Arena Awaits
        </h4>
        <p
          className="text-center max-w-md mx-auto"
          style={{ color: theme?.colors?.textMuted }}
        >
          No active duels right now. Be the first to throw down the gauntlet —
          pick an opponent, set the stakes, and let the charts decide.
        </p>
      </div>
    </motion.div>
  );
}

// ─── Recent Victors List ─────────────────────────────────────────────────────

export function RecentVictors({
  challenges,
  effectiveColors,
  theme,
}: {
  challenges: CompletedChallenge[];
  effectiveColors: EffectiveColors;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  theme: any;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="mb-10"
    >
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5" style={{ color: effectiveColors.accent }} />
        <h3
          className="font-bold text-lg"
          style={{ color: effectiveColors.text }}
        >
          Recent Victors
        </h3>
      </div>
      <div className="space-y-2">
        {challenges.slice(0, 5).map((result, i) => (
          <motion.div
            key={result.id || i}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 p-3 rounded-xl hover:scale-[1.01] transition-transform"
            style={{
              backgroundColor: theme?.colors?.backgroundCard,
              border: `1px solid ${theme?.colors?.border}`,
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${effectiveColors.accent}25, ${effectiveColors.accent}10)`,
              }}
            >
              {i === 0 ? (
                <Crown
                  className="h-5 w-5"
                  style={{ color: effectiveColors.accent }}
                />
              ) : (
                <Image
                  src={
                    i === 1
                      ? GAME_ICONS.rank2
                      : i === 2
                        ? GAME_ICONS.rank3
                        : GAME_ICONS.sword
                  }
                  alt=""
                  width={22}
                  height={22}
                  className="w-[22px] h-[22px] object-contain"
                />
              )}
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span
                className="font-bold text-sm truncate"
                style={{ color: effectiveColors.accent }}
              >
                {result.winner}
              </span>
              <Image
                src={GAME_ICONS.swordNumbered}
                alt="vs"
                width={14}
                height={14}
                className="w-3.5 h-3.5 object-contain opacity-50 flex-shrink-0"
              />
              <span
                className="text-sm truncate"
                style={{ color: theme?.colors?.textMuted }}
              >
                {result.loser}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Image
                src={GAME_ICONS.coin}
                alt=""
                width={16}
                height={16}
                className="w-4 h-4 object-contain"
              />
              <span
                className="font-bold text-sm"
                style={{ color: effectiveColors.accent }}
              >
                {result.winnerPrizeFormatted}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Stats Bar ───────────────────────────────────────────────────────────────

export function ChallengeStatsBar({
  stats,
  effectiveColors,
  theme,
}: {
  stats: ChallengeStats;
  effectiveColors: EffectiveColors;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  theme: any;
}) {
  const statItems = [
    {
      gameIcon: GAME_ICONS.swordNumbered,
      value: stats.totalActive,
      label: "Active Duels",
      color: effectiveColors.secondary,
    },
    {
      gameIcon: GAME_ICONS.trophy,
      value: stats.totalCompleted.toLocaleString(),
      label: "Battles Fought",
      color: effectiveColors.primary,
    },
    {
      gameIcon: GAME_ICONS.chest1,
      value: stats.activePrizePoolFormatted,
      label: "At Stake Now",
      color: effectiveColors.accent,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="grid grid-cols-3 gap-4 mb-10"
    >
      {statItems.map((stat, i) => (
        <motion.div
          key={i}
          whileHover={{ y: -3 }}
          className="group text-center p-5 rounded-xl relative overflow-hidden"
          style={{
            backgroundColor: theme?.colors?.backgroundCard,
            border: `1px solid ${theme?.colors?.border}`,
          }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              background: `linear-gradient(90deg, transparent, ${stat.color}, transparent)`,
            }}
          />
          <div className="flex justify-center mb-2">
            <Image
              src={stat.gameIcon}
              alt=""
              width={28}
              height={28}
              className="w-7 h-7 object-contain"
              style={{ filter: `drop-shadow(0 0 4px ${stat.color})` }}
            />
          </div>
          <div
            className="text-2xl sm:text-3xl font-black"
            style={{ color: stat.color }}
          >
            {stat.value}
          </div>
          <div
            className="text-xs font-medium uppercase tracking-wider mt-1"
            style={{ color: theme?.colors?.textMuted }}
          >
            {stat.label}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
