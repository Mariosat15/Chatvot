"use client";

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

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-3">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-100">{value}</div>
    </div>
  );
}

function TotalsRow({ label, totals }: { label: string; totals: ReferralGroupTotals }) {
  return (
    <tr className="border-t border-gray-700">
      <td className="px-3 py-2 text-gray-200">{label}</td>
      <td className="px-3 py-2 text-right">{totals.players}</td>
      <td className="px-3 py-2 text-right">{totals.current}</td>
      <td className="px-3 py-2 text-right">{totals.active}</td>
      <td className="px-3 py-2 text-right">{formatVolts(totals.entryFees)}</td>
      <td className="px-3 py-2 text-right">{formatVolts(totals.earned)}</td>
      <td className="px-3 py-2 text-right">{formatVolts(totals.pending)}</td>
    </tr>
  );
}

/**
 * Overview figures for the filtered set (`External game plans/24` s7.3).
 *
 * Reason: every figure comes from the server's `summary`, computed over the WHOLE filtered
 * set - never summed from the 25 rows on screen, which would make the headline change when
 * the operator turns a page. The caption says so, with the moment it was read.
 */
export default function GmReportSummary({ report }: { report: ReferredPlayersReport }) {
  const { all, byKind, bySurface } = report.summary;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Figure label="Referred players" value={String(all.players)} />
        <Figure label="Currently affiliated" value={String(all.current)} />
        <Figure label="Active (30 days)" value={String(all.active)} />
        <Figure label="Entry fees" value={formatVolts(all.entryFees)} />
        <Figure label="GM earned" value={formatVolts(all.earned)} />
        <Figure label="GM pending" value={formatVolts(all.pending)} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm text-gray-300">
          <thead className="bg-gray-800 text-xs uppercase text-gray-400">
            <tr>
              <th className="px-3 py-2 text-left">Breakdown</th>
              <th className="px-3 py-2 text-right">Players</th>
              <th className="px-3 py-2 text-right">Current</th>
              <th className="px-3 py-2 text-right">Active</th>
              <th className="px-3 py-2 text-right">Entry fees</th>
              <th className="px-3 py-2 text-right">Earned</th>
              <th className="px-3 py-2 text-right">Pending</th>
            </tr>
          </thead>
          <tbody>
            {REFERRAL_KINDS.map((kind) => (
              // Reason: `kind` iterates the fixed REFERRAL_KINDS constant, never request input.
              // eslint-disable-next-line security/detect-object-injection
              <TotalsRow key={kind} label={REFERRAL_KIND_LABELS[kind]} totals={byKind[kind]} />
            ))}
            {bySurface.map((row) => (
              <TotalsRow
                key={row.surface ?? "none"}
                label={`via ${row.surface ? REFERRAL_SURFACE_LABELS[row.surface] : "unknown surface"}`}
                totals={row}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        Figures cover every player matching the filters, not just this page. Read at{" "}
        {new Date(report.asOf).toLocaleString()}.
      </p>
    </div>
  );
}
