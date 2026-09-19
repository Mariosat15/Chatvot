"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  Timer,
} from "lucide-react";
import Image from "next/image";
import { GAME_ICONS } from "@/lib/constants/game-icons";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ActiveChallenge {
  id: string;
  challenger: string;
  challenged: string;
  stake: number;
  stakeFormatted: string;
  status: string;
  statusLabel: string;
  timeRemaining: string;
}

export interface CompletedChallenge {
  id: string;
  winner: string;
  loser: string;
  winnerPrize: number;
  winnerPrizeFormatted: string;
  completedAt: string;
}

export interface ChallengeStats {
  totalActive: number;
  totalCompleted: number;
  activePrizePool: number;
  activePrizePoolFormatted: string;
}

export interface EffectiveColors {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
}

// ─── PlayerAvatar ────────────────────────────────────────────────────────────

export function PlayerAvatar({
  name,
  side,
  color,
  gameIcon,
}: {
  name: string;
  side: "left" | "right";
  color: string;
  gameIcon: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -30 : 30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className="flex flex-col items-center gap-2 flex-1 min-w-0"
    >
      <motion.div
        whileHover={{ scale: 1.1, rotate: side === "left" ? -5 : 5 }}
        className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${color}40, ${color}15)`,
          border: `2px solid ${color}50`,
          boxShadow: `0 0 20px ${color}20, inset 0 0 20px ${color}10`,
        }}
      >
        <Image
          src={gameIcon}
          alt={name}
          width={48}
          height={48}
          className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
        <div
          className="absolute inset-0 rounded-2xl opacity-50"
          style={{
            background: `radial-gradient(circle at center, ${color}20, transparent 70%)`,
          }}
        />
      </motion.div>
      <span
        className="font-bold text-sm truncate max-w-full px-1"
        style={{ color: "#fff" }}
      >
        {name}
      </span>
    </motion.div>
  );
}

// ─── VSBadge ─────────────────────────────────────────────────────────────────

export function VSBadge({
  gradientStyle,
  bgColor,
}: {
  gradientStyle?: string;
  bgColor?: string;
}) {
  return (
    <motion.div
      animate={{ scale: [1, 1.15, 1], rotate: [0, 3, -3, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      className="relative flex-shrink-0"
    >
      <div
        className="absolute inset-0 rounded-full blur-lg opacity-60"
        style={{ background: gradientStyle }}
      />
      <div
        className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center z-10"
        style={{
          background: gradientStyle,
          boxShadow: "0 0 30px rgba(255,100,0,0.4)",
        }}
      >
        <span
          className="text-xl sm:text-2xl font-black tracking-tighter"
          style={{ color: bgColor || "#0a0a0a" }}
        >
          VS
        </span>
      </div>
    </motion.div>
  );
}

// ─── Active Challenge Cards ──────────────────────────────────────────────────

const leftIcons = [GAME_ICONS.helmet1, GAME_ICONS.lord, GAME_ICONS.archer];
const rightIcons = [GAME_ICONS.helmet2, GAME_ICONS.war, GAME_ICONS.rookie];

export function ActiveChallengeCards({
  challenges,
  effectiveColors,
  theme,
}: {
  challenges: ActiveChallenge[];
  effectiveColors: EffectiveColors;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  theme: any;
}) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      <AnimatePresence>
        {challenges.slice(0, 3).map((challenge, index) => (
          <motion.div
            key={challenge.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -6, scale: 1.02 }}
            className="group relative rounded-2xl p-6 overflow-hidden"
            style={{
              backgroundColor: theme?.colors?.backgroundCard,
              border: `1px solid ${theme?.colors?.border}`,
            }}
          >
            {/* Top accent */}
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{
                background: `linear-gradient(90deg, ${effectiveColors.secondary}, ${effectiveColors.accent}, ${effectiveColors.secondary})`,
              }}
            />
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500"
              style={{
                background: `radial-gradient(ellipse at center, ${effectiveColors.secondary}08, transparent 70%)`,
              }}
            />

            {/* Status badge */}
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-1.5">
                <Flame className="h-4 w-4" style={{ color: "#ef4444" }} />
                <span
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: "#ef4444" }}
                >
                  LIVE
                </span>
              </div>
              <span
                className="px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: `${effectiveColors.secondary}20`,
                  color: effectiveColors.secondary,
                  border: `1px solid ${effectiveColors.secondary}30`,
                }}
              >
                {challenge.statusLabel}
              </span>
            </div>

            {/* VS Display */}
            <div className="flex items-center justify-center gap-3 mb-5 relative z-10">
              <PlayerAvatar
                name={challenge.challenger}
                side="left"
                color={effectiveColors.primary}
                gameIcon={leftIcons[index % leftIcons.length] || GAME_ICONS.helmet1}
              />
              <VSBadge
                gradientStyle={theme?.effects?.gradientStyle}
                bgColor={theme?.colors?.background}
              />
              <PlayerAvatar
                name={challenge.challenged}
                side="right"
                color={effectiveColors.secondary}
                gameIcon={rightIcons[index % rightIcons.length] || GAME_ICONS.helmet2}
              />
            </div>

            {/* Prize Pool */}
            <div
              className="relative z-10 p-4 rounded-xl text-center"
              style={{
                background: `linear-gradient(135deg, ${effectiveColors.accent}12, ${effectiveColors.accent}06)`,
                border: `1px solid ${effectiveColors.accent}20`,
              }}
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <Image
                  src={GAME_ICONS.coin}
                  alt=""
                  width={18}
                  height={18}
                  className="w-[18px] h-[18px] object-contain"
                />
                <span
                  className="text-xs uppercase tracking-wider font-semibold"
                  style={{ color: theme?.colors?.textMuted }}
                >
                  Prize Pool
                </span>
              </div>
              <div
                className="text-2xl font-black"
                style={{ color: effectiveColors.accent }}
              >
                {challenge.stakeFormatted}
              </div>
              {challenge.timeRemaining && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Timer
                    className="h-3 w-3"
                    style={{ color: theme?.colors?.textMuted }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: theme?.colors?.textMuted }}
                  >
                    {challenge.timeRemaining} remaining
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
