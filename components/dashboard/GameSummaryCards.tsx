"use client";

/**
 * Per-game summary cards on the dashboard (13 s5 / s5.1f).
 *
 * Contests entered, best finish, current rating — read from UserGameStats via
 * the action, never recomputed here. Local view type only (R58): the stats
 * service imports Mongoose and must not reach a client file as a value import.
 *
 * Hide games never played (no stored row). Rating omitted on trading — PnL
 * lives on the trading chrome. bestRank 0 → dash (absent, never "0").
 */

import type { ReactNode } from "react";
import { Medal, Trophy, Gamepad2 } from "lucide-react";
import { motion } from "framer-motion";

export interface GameSummaryRowView {
  gameKey: string;
  label: string;
  isTrading: boolean;
  contestsEntered: number;
  bestRank: number;
  rating: number;
}

export interface GameSummaryStandingView {
  perGame: GameSummaryRowView[];
  startsFromCaption: string;
}

function formatBestFinish(rank: number): string {
  // Reason: bestRank defaults to 0 until a real finish is recorded ($min).
  // Showing "0" would look like a podium place nobody earned (R45/R50 read-side).
  if (!Number.isFinite(rank) || rank <= 0) return "—";
  return `#${Math.round(rank)}`;
}

export default function GameSummaryCards({
  standing,
}: {
  standing: GameSummaryStandingView;
}) {
  if (standing.perGame.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-gray-400">
          <Gamepad2 className="h-4 w-4 text-emerald-400" />
          By game
        </h3>
        {standing.startsFromCaption ? (
          <p className="text-xs text-gray-500 max-w-xl">
            {standing.startsFromCaption}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {standing.perGame.map((game, i) => (
          <motion.div
            key={game.gameKey}
            className="rounded-2xl border border-gray-700/50 bg-gray-800/30 p-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 * i }}
          >
            <p className="truncate font-semibold text-white">{game.label}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat
                icon={<Trophy className="h-3.5 w-3.5" />}
                label="Entered"
                value={String(game.contestsEntered)}
              />
              <Stat
                icon={<Medal className="h-3.5 w-3.5" />}
                label="Best finish"
                value={formatBestFinish(game.bestRank)}
              />
              <Stat
                icon={<Gamepad2 className="h-3.5 w-3.5" />}
                label="Rating"
                value={
                  game.isTrading ? "—" : String(Math.round(game.rating))
                }
                hint={
                  game.isTrading
                    ? "Trading skill stays in Performance"
                    : undefined
                }
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg bg-gray-900/50 px-2 py-2" title={hint}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 text-sm font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}
