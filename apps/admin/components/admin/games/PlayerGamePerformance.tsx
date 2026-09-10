"use client";

import { Archive, Gamepad2, Trophy } from "lucide-react";
import { humanizeMetric } from "@/lib/utils/humanize-metric";

/**
 * One player's game performance, beside their trading performance - tasks 21-24.
 *
 * IT RENDERS WHAT IT IS GIVEN AND NAMES NO GAME. There is no `switch` on a game code, no
 * category-to-metric table and no fixed list of labels. The metric rows come from the round's
 * own `scoreBreakdown` and are labelled by `humanizeMetric`, which knows no game's field names
 * - so a racing title shows lap times and a block game shows lines cleared, with no code here
 * changing between them. A test forbids a game code, key or provider key appearing in this file
 * at all, because that is the single failure mode of the no-developer-needed claim.
 *
 * THE EMPTY STATE IS TASK 23's, and which of its two options applies depends on the level. A
 * player with no game rounds at all renders NOTHING - the caller passes an empty list and this
 * returns null - so a pure trader's tab looks exactly as it did before. A player who HAS played
 * a game that reports no detail gets the sentence, because the game and the score are real and
 * only the breakdown is missing; hiding the whole card there would hide the rounds too.
 *
 * NO MONEY, matching the service. Prizes are granted by `analytics` and `financial`.
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

/** Seconds as something readable. A 40-second puzzle and an 8-minute race both occur. */
function duration(seconds: number | null): string {
  if (seconds === null) return "-";
  if (seconds < 90) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

/**
 * A score with its unit, or a dash.
 *
 * The dash is not cosmetic. `null` means nothing this player played produced a score, and a
 * nought is a real score on a points game - so rendering absence as `0` reports a player who
 * never scored as one who scored nothing. Same rule as R45's unheld rank and R50's phantom
 * participant score, which is where that nought came from the last two times.
 */
function score(value: number | null, unit?: string): string {
  if (value === null) return "-";
  const shown = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return unit ? `${shown} ${unit}` : shown;
}

export default function PlayerGamePerformance({
  games,
}: {
  games: PlayerGamePerformanceRowView[];
}) {
  if (games.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
          <Gamepad2 className="h-5 w-5 text-emerald-400" />
          Game Performance
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Every game this client has played a ranked round in. Each game is measured on what it
          actually reports, so two games here will not show the same rows.
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
                {/*
                  Task 9's vocabulary, resolved by the service and rendered as given. This must
                  not re-derive a label from the slug: a second copy of that rule is how one
                  screen shows "Racing" and another "racing", and `category` is the key every
                  grouping in analytics and discovery joins on.
                */}
                {game.category && (
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                    {game.category.label}
                  </span>
                )}
                {/*
                  A title can leave the catalogue while a player's rounds stay - a disabled
                  game's rows are retired, never deleted (R29). Saying so is the difference
                  between a row an operator can explain and one that looks like bad data.
                */}
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
            <Tile label="Rounds played" value={game.rounds.started.toLocaleString()} />
            <Tile
              label="Scored"
              value={game.rounds.scored.toLocaleString()}
              hint="incl. partial runs"
            />
            <Tile label="Average round" value={duration(game.averagePlaySeconds)} />
            <Tile
              label="Contests"
              value={`${game.competitions}`}
              hint={
                game.challenges > 0
                  ? `+ ${game.challenges} challenge${game.challenges === 1 ? "" : "s"}`
                  : undefined
              }
            />
          </div>

          {game.rounds.live > 0 && (
            <p className="mt-3 text-xs text-amber-300/80">
              {game.rounds.live} round{game.rounds.live === 1 ? "" : "s"} in play now
            </p>
          )}

          <div className="mt-4 border-t border-gray-700 pt-3">
            <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-500">
              Their best round in detail
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
