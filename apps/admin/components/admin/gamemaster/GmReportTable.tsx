"use client";

import Link from "next/link";
import { Eye, ArrowLeftRight, Trash2 } from "lucide-react";
import { formatVolts } from "@/lib/utils/format-volts";
import type { ReferredPlayerRow } from "@/lib/services/gamemaster/referral-read-model";
import { describeEndedReason } from "@/lib/services/gamemaster/referral-kind";
import AffiliationSourceBadge from "./AffiliationSourceBadge";
import type { AffiliationAction } from "./GmAffiliationActionDialog";
import {
  formatPhoneDisplay,
  formatRelativeActivity,
} from "@/lib/admin/gm-report-display";

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function initials(name: string | null, email: string): string {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function AffiliationPill({ row }: { row: ReferredPlayerRow }) {
  if (!row.isCurrent) {
    const reason = describeEndedReason(row.endedReason);
    return (
      <div>
        <span className="inline-flex rounded-full border border-gray-600 bg-gray-800 px-2 py-0.5 text-xs text-gray-300">
          Not affiliated
        </span>
        <div className="mt-1 text-[11px] text-gray-500">
          Ended {formatDate(row.endedAt)}
          {reason ? ` (${reason})` : ""}
        </div>
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      Affiliated
    </span>
  );
}

/**
 * One row per player per Game Master: a player who left and rejoined the same Game Master is
 * ONE row with their stints summed; a player moved to another appears once under each.
 *
 * Reason: Move and Detach are offered ONLY on a current affiliation - an ended row has
 * nothing to move. View always opens the player detail screen.
 */
export default function GmReportTable({
  rows,
  canManage,
  onAction,
}: {
  rows: ReferredPlayerRow[];
  canManage: boolean;
  onAction: (row: ReferredPlayerRow, action: AffiliationAction) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-400">
        No referred players match these filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
        <table className="w-full min-w-[78rem] text-sm text-gray-300">
          <thead className="bg-gray-950/70 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-3 text-left">Player</th>
              <th className="px-3 py-3 text-left">Country</th>
              <th className="px-3 py-3 text-left">Game Master</th>
              <th className="px-3 py-3 text-left">Referral type</th>
              <th className="px-3 py-3 text-left">Joined</th>
              <th className="px-3 py-3 text-left">Affiliation</th>
              <th className="px-3 py-3 text-left">Last activity</th>
              <th className="px-3 py-3 text-right">Contests</th>
              <th className="px-3 py-3 text-right">Challenges</th>
              <th className="px-3 py-3 text-right">Entry fees</th>
              <th className="px-3 py-3 text-right">Earned</th>
              <th className="px-3 py-3 text-right">Pending</th>
              <th className="px-3 py-3 text-left">Terms</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const phone = formatPhoneDisplay(row.phone);
              const relative = formatRelativeActivity(row.lastActivityAt);
              return (
                <tr key={row.referralId} className="border-t border-gray-800/80 align-top hover:bg-gray-800/30">
                  <td className="px-3 py-3">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/30 to-violet-600/30 text-xs font-semibold text-amber-100">
                        {initials(row.userName, row.userEmail)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-gray-100">{row.userName || "-"}</div>
                        <div className="truncate text-xs text-gray-400">{row.userEmail}</div>
                        {phone && <div className="mt-0.5 text-xs tabular-nums text-gray-500">{phone}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-300">{row.country || "—"}</td>
                  <td className="px-3 py-3 text-xs">
                    <div className="max-w-[12rem] truncate text-gray-200">
                      {row.gameMasterEmail || row.gameMasterId}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <AffiliationSourceBadge kind={row.kind} surface={row.surface} />
                  </td>
                  <td className="px-3 py-3 text-xs tabular-nums">{formatDate(row.joinedAt)}</td>
                  <td className="px-3 py-3">
                    <AffiliationPill row={row} />
                    {row.affiliations > 1 && (
                      <div className="mt-1 text-[11px] text-gray-500">
                        Rejoined · {row.affiliations} stints since {formatDate(row.firstJoinedAt)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <div className={row.lastActivityAt ? "text-gray-200" : "text-gray-500"}>
                      {row.lastActivityAt ? `Active ${relative}` : relative}
                    </div>
                    {row.lastActivityAt && (
                      <div className="text-[11px] text-gray-500">{formatDate(row.lastActivityAt)}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.competitionsEntered}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.challengesEntered}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatVolts(row.entryFees)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatVolts(row.earned)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatVolts(row.pending)}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${
                        row.termsAccepted
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                      }`}
                    >
                      {row.termsAccepted ? "Accepted" : "Not accepted"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Link
                        href={`/dashboard?activeTab=users&userId=${row.userId}`}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800"
                        title="View player"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Link>
                      {canManage && row.isCurrent && (
                        <>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-sky-700/60 px-2 py-1 text-xs text-sky-300 hover:bg-sky-950/40"
                            onClick={() => onAction(row, "move")}
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            Move
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-red-700/60 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40"
                            onClick={() => onAction(row, "detach")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Detach
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
    </div>
  );
}
