"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Provider health - the fifth and last of chapter 12 section 4's admin destinations.
 *
 * WHAT IT ANSWERS: is this provider actually working, and if not, is that an outage or a
 * switch somebody left off. Those two need different actions, so they are different verdicts
 * rather than two shades of red.
 *
 * THE VERDICT IS DERIVED, NEVER READ FROM A FIELD. `game_provider.healthStatus` exists and
 * nothing has ever written to it, and it defaults to `"down"` - so a panel that rendered it
 * would report every provider permanently down, including one that had just settled a
 * contest. See `provider-health.service.ts`.
 *
 * `no_traffic` IS THE VERDICT THAT MAKES THIS HONEST. A provider with no rounds is neither
 * healthy nor down; there is nothing to judge by. A green badge there would be a guess
 * presented as a measurement, and an operator would stop checking.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: list or resolve individual rounds. That is the round
 * inspector beside it. This screen answers "which provider should I look at", and duplicating
 * the round list here would give an operator two places to act and no reason to prefer either.
 */

interface HealthRow {
  providerKey: string;
  displayName: string;
  verdict:
    | "healthy"
    | "degraded"
    | "down"
    | "no_traffic"
    | "not_configured";
  summary: string;
  blockers: string[];
  windowHours: number;
  rounds: {
    total: number;
    live: number;
    completed: number;
    unresolved: number;
    endedWithoutResult: number;
  };
  events: {
    total: number;
    scored: number;
    signatureInvalid: number;
    otherFailures: number;
  };
  lastSuccessfulRoundAt?: string | null;
  lastCatalogueSyncAt?: string | null;
  titleCount: number;
  enabledTitleCount: number;
}

/**
 * Five verdicts, five presentations.
 *
 * Reason `no_traffic` and `not_configured` are grey and amber rather than green or red: both
 * mean "this measurement does not apply", and colouring them like an outcome is what teaches
 * an operator to ignore the column.
 */
const VERDICTS = {
  healthy: {
    label: "Healthy",
    icon: CheckCircle2,
    pill: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    bar: "bg-emerald-500",
  },
  degraded: {
    label: "Degraded",
    icon: AlertTriangle,
    pill: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    bar: "bg-amber-500",
  },
  down: {
    label: "Down",
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
  not_configured: {
    label: "Not runnable",
    icon: SlidersHorizontal,
    pill: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    bar: "bg-amber-500",
  },
} as const;

function when(value?: string | null): string {
  if (!value) return "never";
  return new Date(value).toLocaleString();
}

export default function ProviderHealthSection() {
  const [rows, setRows] = useState<HealthRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/games/provider-health");
      const data = await response.json();
      if (!response.ok) {
        toast.error(
          data.error ?? "Something went wrong. Please contact support.",
        );
        return;
      }
      setRows(data.providers ?? []);
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
            <Activity className="h-5 w-5 text-violet-400" />
            Provider Health
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Measured from the rounds and result deliveries of the last 24 hours.
            Nothing here is a stored status, so it cannot go stale.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void load()}
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

      {loading && rows.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-10 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-white/40" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-10 text-center">
          <Activity className="mx-auto mb-3 h-8 w-8 text-white/30" />
          <p className="text-sm text-white/70">No game providers registered.</p>
          <p className="mt-1 text-xs text-white/40">
            Register one under Game Providers first.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <HealthCard key={row.providerKey} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function HealthCard({ row }: { row: HealthRow }) {
  const verdict = VERDICTS[row.verdict];
  const Icon = verdict.icon;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50">
      <div className={`h-1 w-full ${verdict.bar}`} />

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white">
                {row.displayName}
              </h3>
              <span className="font-[var(--font-geist-mono)] text-xs text-white/40">
                {row.providerKey}
              </span>
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

        {row.blockers.length > 0 && (
          <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
              Stops this provider running
            </p>
            <ul className="space-y-1">
              {row.blockers.map((blocker) => (
                <li
                  key={blocker}
                  className="flex items-start gap-2 text-sm text-amber-100/90"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{blocker}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Reason signature failures get their own row and their own colour rather than being
            folded into a general error count: a signature failure is either a wrong secret or
            an attack, and those are indistinguishable in the log. Averaged into "errors" it
            disappears entirely. */}
        {row.events.signatureInvalid > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {row.events.signatureInvalid} result{" "}
              {row.events.signatureInvalid === 1 ? "delivery" : "deliveries"}{" "}
              failed signature verification. Either the shared secret does not
              match theirs, or the traffic is not from them - the log cannot tell
              those apart.
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label={`Rounds (${row.windowHours}h)`}
            value={row.rounds.total}
          />
          <Stat label="Scored" value={row.rounds.completed} />
          <Stat
            label="Never reported"
            value={row.rounds.unresolved}
            tone={row.rounds.unresolved > 0 ? "bad" : "plain"}
          />
          <Stat label="In play now" value={row.rounds.live} />
        </div>

        <div className="grid gap-x-6 gap-y-1 text-xs text-white/50 sm:grid-cols-2">
          <Fact
            label="Last round that scored"
            value={when(row.lastSuccessfulRoundAt)}
          />
          <Fact
            label="Catalogue last synced"
            value={when(row.lastCatalogueSyncAt)}
          />
          <Fact
            label="Titles"
            value={`${row.enabledTitleCount} of ${row.titleCount} switched on`}
          />
          <Fact
            label="Deliveries received"
            value={`${row.events.total} (${row.events.scored} scored${
              row.events.otherFailures > 0
                ? `, ${row.events.otherFailures} refused`
                : ""
            })`}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "plain",
}: {
  label: string;
  value: number;
  tone?: "plain" | "bad";
}) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-800/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-white/40">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-semibold ${
          tone === "bad" && value > 0 ? "text-red-300" : "text-white"
        }`}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-white/40">{label}:</span>{" "}
      <span className="text-white/70">{value}</span>
    </p>
  );
}
