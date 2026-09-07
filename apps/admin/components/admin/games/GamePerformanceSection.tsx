"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Game Performance - `12` s5's "New: Game Performance" screen.
 *
 * WHAT IT ANSWERS, and why it is not the analytics screen. `CompetitionAnalytics` answers "what
 * did we earn from each game"; this answers "is each game working for the people playing it".
 * A game can be healthy on one and broken on the other, and the direction that matters is the
 * quiet one: a title whose rounds are abandoned half the time still books its entry fees, so
 * the money screen shows a profitable game and nothing anywhere shows the problem.
 *
 * NO MONEY ON IT, DELIBERATELY. See `game-performance.service.ts` - the short form is that this
 * screen is granted by a games section while revenue is granted by `analytics` and `financial`,
 * so putting revenue here would widen who can read it while looking like a convenience.
 *
 * HOW IT DIFFERS FROM PROVIDER HEALTH, which sits beside it. Health is per **provider** over 24
 * hours and answers "who do I ring". This is per **title** over weeks and answers "which game
 * should we keep running". Two questions, two granularities, two windows - and neither is a
 * summary of the other, which is why duplicating a verdict across them would be wrong rather
 * than redundant.
 */

interface PerformanceRow {
  gameKey: string;
  gameCode: string;
  providerKey: string;
  title: string;
  providerName: string;
  inCatalogue: boolean;
  rounds: {
    started: number;
    ranFullCourse: number;
    leftEarly: number;
    cutOff: number;
    cancelled: number;
    neverReported: number;
    live: number;
  };
  scoreProducing: number;
  abandonmentRate: number | null;
  cutOffRate: number | null;
  averagePlaySeconds: number | null;
  averageResultLatencySeconds: number | null;
  clockSkewedResults: number;
  players: number;
  contests: number;
  entrantsWhoNeverPlayed: number | null;
  windowDays: number;
  verdict: "healthy" | "watch" | "problem" | "no_traffic";
  summary: string;
}

/**
 * Four verdicts, four presentations.
 *
 * `no_traffic` is grey rather than green for the reason `ProviderHealthSection` records about
 * its own: it means the measurement does not apply, and colouring it like an outcome teaches an
 * operator to stop reading the column. `watch` is amber rather than red because a hard game is
 * not a broken one - the action is to read the settings, not to raise an incident.
 */
const VERDICTS = {
  healthy: {
    label: "Healthy",
    icon: CheckCircle2,
    pill: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    bar: "bg-emerald-500",
  },
  watch: {
    label: "Worth a look",
    icon: AlertTriangle,
    pill: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    bar: "bg-amber-500",
  },
  problem: {
    label: "Problem",
    icon: XCircle,
    pill: "border-red-500/40 bg-red-500/10 text-red-300",
    bar: "bg-red-500",
  },
  no_traffic: {
    label: "No traffic to judge by",
    icon: HelpCircle,
    pill: "border-slate-500/40 bg-slate-500/10 text-slate-300",
    bar: "bg-slate-500",
  },
} as const;

/** Seconds as something readable. A latency of 0.4s and a play time of 4 minutes both occur. */
function duration(seconds: number | null): string {
  if (seconds === null) return "-";
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 90) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

export default function GamePerformanceSection() {
  const [rows, setRows] = useState<PerformanceRow[]>([]);
  const [windowDays, setWindowDays] = useState(30);
  const [windows, setWindows] = useState<number[]>([7, 30, 90]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (days: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/games/performance?days=${days}`);
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }
      setRows(data.games ?? []);
      // Reason the window is read back from the response rather than trusted locally: the
      // server matches it against a fixed set, so an unrecognised value silently becomes the
      // default. Showing the value we asked for would caption the figures with a window they
      // were not measured over.
      if (typeof data.windowDays === "number") setWindowDays(data.windowDays);
      if (Array.isArray(data.availableWindows)) setWindows(data.availableWindows);
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(30);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
            <BarChart3 className="h-5 w-5 text-cyan-400" />
            Game Performance
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-white/60">
            How each game is going for the players, measured from the rounds themselves over the
            last {windowDays} days. Ranked contests only - practice rounds are excluded, since
            nothing is at stake in them. There is no money on this screen; entry-fee volume and
            fee revenue by game are on Competition Analytics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {windows.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => void load(days)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                windowDays === days
                  ? "border-cyan-500/60 bg-cyan-500/20 text-cyan-300"
                  : "border-slate-700 bg-slate-900/60 text-white/50 hover:text-white/80"
              }`}
            >
              {days}d
            </button>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => void load(windowDays)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-10 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-white/40" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-10 text-center">
          <BarChart3 className="mx-auto mb-3 h-8 w-8 text-white/30" />
          <p className="text-sm text-white/70">
            No ranked rounds were played in the last {windowDays} days.
          </p>
          <p className="mt-1 text-xs text-white/40">
            This screen is measured from rounds, so a game with no play has nothing to show
            rather than a row of zeroes.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <PerformanceCard key={row.gameKey} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function PerformanceCard({ row }: { row: PerformanceRow }) {
  const verdict = VERDICTS[row.verdict];
  const Icon = verdict.icon;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50">
      <div className={`h-1 w-full ${verdict.bar}`} />

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-white">{row.title}</h3>
              <span className="text-xs text-white/40">{row.providerName}</span>
              {/*
                A title can leave the catalogue while its rounds stay - a disabled game's rows
                are retired, never deleted (R29), and `gameKey` is immutable so its history
                stays addressable. Saying so is the difference between a row an operator can
                explain and one that looks like corrupt data.
              */}
              {!row.inCatalogue && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/40 bg-slate-500/10 px-2 py-0.5 text-[10px] text-slate-300">
                  <Archive className="h-3 w-3" />
                  no longer in the catalogue
                </span>
              )}
            </div>
            <p className="mt-1 max-w-2xl text-sm text-white/70">{row.summary}</p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${verdict.pill}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {verdict.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <Stat label="Rounds started" value={row.rounds.started.toLocaleString()} />
          {/*
            Reason this reads `scoreProducing` and not a status count: a round the contest
            closed over, or one the player walked out of, still scores what they achieved and
            still pays them (R48). Counting only `completed` here told an operator that a
            well-attended contest produced almost no results.
          */}
          <Stat
            label="Scored"
            value={row.scoreProducing.toLocaleString()}
            sub="incl. partial runs"
            tone="good"
          />
          <Stat
            label="Walked out"
            value={
              row.abandonmentRate === null
                ? "-"
                : `${Math.round(row.abandonmentRate * 100)}%`
            }
            sub={`${row.rounds.leftEarly} rounds`}
            tone={
              row.abandonmentRate !== null && row.abandonmentRate > 0.35
                ? "warn"
                : "plain"
            }
          />
          {/*
            Held apart from "Walked out" because the remedy is different: a high share here is
            the play window being short for the round length, not a game people dislike.
          */}
          <Stat
            label="Cut off"
            value={
              row.cutOffRate === null ? "-" : `${Math.round(row.cutOffRate * 100)}%`
            }
            sub="contest closed first"
            tone={row.cutOffRate !== null && row.cutOffRate > 0.5 ? "warn" : "plain"}
          />
          <Stat
            label="Never reported"
            value={row.rounds.neverReported.toLocaleString()}
            tone={row.rounds.neverReported > 0 ? "bad" : "plain"}
          />
          <Stat label="Average play" value={duration(row.averagePlaySeconds)} />
          <Stat
            label="Result latency"
            value={duration(row.averageResultLatencySeconds)}
            sub="provider to us"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-800 pt-3 text-xs text-white/50">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {row.players} players across {row.contests}{" "}
            {row.contests === 1 ? "competition" : "competitions"}
          </span>
          {row.rounds.live > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {row.rounds.live} in play now
            </span>
          )}
          {/*
            An entrant who never started a round is invisible on every other screen - they
            simply rank last. It is either a player who could not find the button or a launch
            that refused, and both are worth knowing. Rendered only when there are some, because
            a permanent "0 entrants never played" is furniture.
          */}
          {row.entrantsWhoNeverPlayed !== null && row.entrantsWhoNeverPlayed > 0 && (
            <span className="text-amber-300/80">
              {row.entrantsWhoNeverPlayed} entrants never started a round
            </span>
          )}
          {/*
            Held apart from latency rather than averaged in. A negative delay means the two
            clocks disagree, which is a different problem from a slow provider - and averaging
            it in would hide both. Same reasoning as provider health keeping signature failures
            out of its general error count.
          */}
          {row.clockSkewedResults > 0 && (
            <span className="text-amber-300/80">
              {row.clockSkewedResults} results claimed to finish after we received them - the
              provider&apos;s clock is ahead of ours
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "plain",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "plain" | "good" | "warn" | "bad";
}) {
  const colour =
    tone === "good"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-amber-300"
        : tone === "bad"
          ? "text-red-300"
          : "text-white";

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${colour}`}>{value}</div>
      {sub && <div className="text-[10px] text-white/35">{sub}</div>}
    </div>
  );
}
