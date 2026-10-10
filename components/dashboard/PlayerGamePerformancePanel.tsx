"use client";

import { Archive, Gamepad2, Trophy } from "lucide-react";
import { humanizeMetric } from "@/lib/utils/humanize-metric";
import { useTerms } from "@/contexts/TerminologyContext";

/**
 * Player-facing twin of admin `PlayerGamePerformance` (R64 residual).
 *
 * Renders ranked-round performance per game on the dashboard Performance tab.
 * Names no game in code — metrics come from each round's `scoreBreakdown` via
 * `humanizeMetric`. Empty list → null (pure traders see unchanged trading UI).
 *
 * View type is local (R58): the service imports Mongoose models and must not
 * reach a `"use client"` file. Section labels read `useTerms()` (X8 pass 5).
 */

export interface PlayerGamePerformanceRowView {
  gameKey: string;
  title: string;
  providerName: string;
  category?: { slug: string; label: string; isKnown: boolean };
  inCatalogue: boolean;
  rounds: { started: number; scored: number; live: number };
  competitions: number;
  challenges: number;
  bestScore: number | null;
  scoreUnit?: string;
  scoreDirection: "higher_is_better" | "lower_is_better";
  averagePlaySeconds: number | null;
  lastPlayedAt: string | null;
  bestRoundBreakdown: Record<string, unknown> | null;
}

function duration(seconds: number | null): string {
  if (seconds === null) return "-";
  if (seconds < 90) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function score(value: number | null, unit?: string): string {
  // Reason: null ≠ 0 (R45/R50 read-side). Absence is a dash.
  if (value === null) return "-";
  const shown = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return unit ? `${shown} ${unit}` : shown;
}

export default function PlayerGamePerformancePanel({
  games,
}: {
  games: PlayerGamePerformanceRowView[];
}) {
  const terms = useTerms();
  if (games.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
          <Gamepad2 className="h-5 w-5 text-emerald-400" />
          {terms.game} Performance
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Every {terms.game} you have played a ranked {terms.round} in. Each{" "}
          {terms.game} is measured on what it reports, so two {terms.games} here
          will not show the same rows.
        </p>
      </div>

      {games.map((game) => (
        <div
          key={game.gameKey}
          className="rounded-lg border border-gray-700 bg-gray-800/50 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-semibold text-white">{game.title}</h4>
                {game.providerName && (
                  <span className="text-xs text-gray-500">{game.providerName}</span>
                )}
                {game.category && (
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                    {game.category.label}
                  </span>
                )}
                {!game.inCatalogue && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/40 bg-slate-500/10 px-2 py-0.5 text-[10px] text-slate-300">
                    <Archive className="h-3 w-3" />
                    no longer in the catalogue
                  </span>
                )}
              </div>
              {game.lastPlayedAt && (
                <p className="mt-1 text-xs text-gray-500">
                  Last played {new Date(game.lastPlayedAt).toLocaleString()}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <div className="flex items-center justify-end gap-1.5 text-[10px] uppercase tracking-wide text-gray-500">
                <Trophy className="h-3 w-3" />
                {game.scoreDirection === "lower_is_better"
                  ? "best (lowest)"
                  : "best (highest)"}
              </div>
              <div className="text-lg font-semibold tabular-nums text-emerald-300">
                {score(game.bestScore, game.scoreUnit)}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label={`${terms.rounds} played`} value={game.rounds.started.toLocaleString()} />
            <Tile
              label="Scored"
              value={game.rounds.scored.toLocaleString()}
              hint="incl. partial runs"
            />
            <Tile
              label={`Average ${terms.round}`}
              value={duration(game.averagePlaySeconds)}
            />
            <Tile
              label={terms.contests}
              value={`${game.competitions}`}
              hint={
                game.challenges > 0
                  ? `+ ${game.challenges} ${game.challenges === 1 ? terms.challenge : terms.challenges}`
                  : undefined
              }
            />
          </div>

          {game.rounds.live > 0 && (
            <p className="mt-3 text-xs text-amber-300/80">
              {game.rounds.live} round{game.rounds.live === 1 ? "" : "s"} in play
              now
            </p>
          )}

          <div className="mt-4 border-t border-gray-700 pt-3">
            <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-500">
              Your best round in detail
            </p>
            {game.bestRoundBreakdown ? (
              <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {Object.entries(game.bestRoundBreakdown).map(([key, value]) => {
                  const metric = humanizeMetric(key, value);
                  return (
                    <div key={key} className="flex justify-between gap-4 text-xs">
                      <dt className="text-gray-400">{metric.label}</dt>
                      <dd className="tabular-nums text-white">{metric.value}</dd>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="text-xs text-gray-500">
                Detailed performance metrics are not available for this game.
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-gray-700 bg-gray-900/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</div>
      {hint && <div className="text-[10px] text-gray-600">{hint}</div>}
    </div>
  );
}
