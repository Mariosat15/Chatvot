"use client";

import {
  Users,
  UserCheck,
  Gamepad2,
  Coins,
  Wallet,
  Clock3,
  PieChart,
} from "lucide-react";
import { formatVolts } from "@/lib/utils/format-volts";
import {
  REFERRAL_KINDS,
  REFERRAL_KIND_LABELS,
  REFERRAL_SURFACE_LABELS,
} from "@/lib/services/gamemaster/referral-kind";
import type {
  ReferralGroupTotals,
  ReferredPlayersReport,
} from "@/lib/services/gamemaster/referral-read-model";
import { affiliationConversionPercent } from "@/lib/admin/gm-report-display";

type Tone = "violet" | "indigo" | "sky" | "amber" | "teal" | "rose";

const TONE: Record<Tone, { card: string; icon: string; bar: string }> = {
  violet: {
    card: "border-violet-500/30 bg-gradient-to-br from-violet-950/40 to-gray-900/80",
    icon: "bg-violet-500/15 text-violet-300",
    bar: "bg-violet-400",
  },
  indigo: {
    card: "border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 to-gray-900/80",
    icon: "bg-indigo-500/15 text-indigo-300",
    bar: "bg-indigo-400",
  },
  sky: {
    card: "border-sky-500/30 bg-gradient-to-br from-sky-950/40 to-gray-900/80",
    icon: "bg-sky-500/15 text-sky-300",
    bar: "bg-sky-400",
  },
  amber: {
    card: "border-amber-500/30 bg-gradient-to-br from-amber-950/40 to-gray-900/80",
    icon: "bg-amber-500/15 text-amber-300",
    bar: "bg-amber-400",
  },
  teal: {
    card: "border-teal-500/30 bg-gradient-to-br from-teal-950/40 to-gray-900/80",
    icon: "bg-teal-500/15 text-teal-300",
    bar: "bg-teal-400",
  },
  rose: {
    card: "border-rose-500/30 bg-gradient-to-br from-rose-950/40 to-gray-900/80",
    icon: "bg-rose-500/15 text-rose-300",
    bar: "bg-rose-400",
  },
};

function KpiCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: Tone;
  icon: typeof Users;
}) {
  // Reason: `tone` is a closed Tone union from our own props, never request input.
  // eslint-disable-next-line security/detect-object-injection
  const t = TONE[tone];
  return (
    <div className={`rounded-xl border p-4 ${t.card}`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`rounded-lg p-2 ${t.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-xs font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-50">{value}</div>
    </div>
  );
}

function BreakdownRow({
  label,
  totals,
  barClass,
}: {
  label: string;
  totals: ReferralGroupTotals;
  barClass: string;
}) {
  const conversion = affiliationConversionPercent(totals.players, totals.current);
  return (
    <tr className="border-t border-gray-800/80">
      <td className="px-3 py-2.5 text-gray-100">{label}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{totals.players}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{totals.current}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{totals.active}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{formatVolts(totals.entryFees)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{formatVolts(totals.earned)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{formatVolts(totals.pending)}</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800">
            <div className={`h-full rounded-full ${barClass}`} style={{ width: `${conversion}%` }} />
          </div>
          <span className="w-10 text-right text-xs tabular-nums text-gray-400">{conversion}%</span>
        </div>
      </td>
    </tr>
  );
}

/**
 * Overview figures for the filtered set (`External game plans/24` s7.3 + Part 2 redesign).
 *
 * Reason: every figure comes from the server's `summary`, computed over the WHOLE filtered
 * set - never summed from the 25 rows on screen. Trends / sparklines are deliberately
 * omitted: nothing stores a prior-month snapshot, and inventing one would be a report that
 * lies. Conversion = currently affiliated / referred players for that group.
 */
export default function GmReportSummary({ report }: { report: ReferredPlayersReport }) {
  const { all, byKind, bySurface } = report.summary;
  // Reason: `k` iterates REFERRAL_KINDS, a fixed constant, never request input.
  const sourceCount =
    REFERRAL_KINDS.filter((k) => {
      // eslint-disable-next-line security/detect-object-injection
      return byKind[k].players > 0;
    }).length + bySurface.filter((row) => row.players > 0).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Referred players" value={String(all.players)} tone="violet" icon={Users} />
        <KpiCard label="Currently affiliated" value={String(all.current)} tone="indigo" icon={UserCheck} />
        <KpiCard label="Played in last 30 days" value={String(all.active)} tone="sky" icon={Gamepad2} />
        <KpiCard label="Entry fees (total)" value={formatVolts(all.entryFees)} tone="amber" icon={Coins} />
        <KpiCard label="GM earned (total)" value={formatVolts(all.earned)} tone="teal" icon={Wallet} />
        <KpiCard label="GM pending (total)" value={formatVolts(all.pending)} tone="rose" icon={Clock3} />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-700/80 bg-gray-900/50">
        <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-100">
            <PieChart className="h-4 w-4 text-amber-400" />
            Breakdown by referral source
          </div>
          <span className="rounded-full border border-gray-700 bg-gray-800 px-2.5 py-0.5 text-xs text-gray-300">
            {sourceCount} source{sourceCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm text-gray-300">
            <thead className="bg-gray-950/60 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Referral source</th>
                <th className="px-3 py-2 text-right">Players</th>
                <th className="px-3 py-2 text-right">Active</th>
                <th className="px-3 py-2 text-right">Played (30d)</th>
                <th className="px-3 py-2 text-right">Entry fees</th>
                <th className="px-3 py-2 text-right">GM earned</th>
                <th className="px-3 py-2 text-right">GM pending</th>
                <th className="px-3 py-2 text-left">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {REFERRAL_KINDS.map((kind) => {
                // Reason: `kind` iterates the fixed REFERRAL_KINDS constant, never request input.
                // eslint-disable-next-line security/detect-object-injection
                const label = REFERRAL_KIND_LABELS[kind];
                // eslint-disable-next-line security/detect-object-injection
                const totals = byKind[kind];
                return (
                  <BreakdownRow
                    key={kind}
                    label={label}
                    totals={totals}
                    barClass={kind === "own" ? "bg-emerald-400" : kind === "external" ? "bg-sky-400" : "bg-gray-500"}
                  />
                );
              })}
              {bySurface.map((row) => (
                <BreakdownRow
                  key={row.surface ?? "none"}
                  label={`via ${row.surface ? REFERRAL_SURFACE_LABELS[row.surface] : "unknown surface"}`}
                  totals={row}
                  barClass="bg-amber-400"
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Figures cover every player matching the filters, not just this page. Read at{" "}
        {new Date(report.asOf).toLocaleString()}. Conversion is currently affiliated ÷ referred.
      </p>
    </div>
  );
}
