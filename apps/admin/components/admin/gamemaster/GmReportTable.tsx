"use client";

import { formatVolts } from "@/lib/utils/format-volts";
import type { ReferredPlayerRow } from "@/lib/services/gamemaster/referral-read-model";
import { describeAffiliationState, describeEndedReason } from "@/lib/services/gamemaster/referral-kind";
import AffiliationSourceBadge from "./AffiliationSourceBadge";
import type { AffiliationAction } from "./GmAffiliationActionDialog";

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : "-";
}

/**
 * One row per player per Game Master: a player who left and rejoined the same Game Master is
 * ONE row with their stints summed; a player moved to another appears once under each.
 *
 * Reason: Move and Detach are offered ONLY on a current affiliation - an ended row has
 * nothing to move, and a button whose only outcome is a refusal teaches the operator the
 * screen is broken. `canManage` hides both for a viewer without the management grant;
 * the route refuses them anyway.
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
      <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-6 text-center text-sm text-gray-400">
        No referred players match these filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700">
      <table className="w-full min-w-[72rem] text-sm text-gray-300">
        <thead className="bg-gray-800 text-xs uppercase text-gray-400">
          <tr>
            <th className="px-3 py-2 text-left">Player</th>
            <th className="px-3 py-2 text-left">Game Master</th>
            <th className="px-3 py-2 text-left">Type</th>
            <th className="px-3 py-2 text-left">Joined</th>
            <th className="px-3 py-2 text-left">Affiliation</th>
            <th className="px-3 py-2 text-left">Last activity</th>
            <th className="px-3 py-2 text-right">Contests</th>
            <th className="px-3 py-2 text-right">Challenges</th>
            <th className="px-3 py-2 text-right">Entry fees</th>
            <th className="px-3 py-2 text-right">Earned</th>
            <th className="px-3 py-2 text-right">Pending</th>
            <th className="px-3 py-2 text-left">Terms</th>
            {canManage && <th className="px-3 py-2 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.referralId} className="border-t border-gray-700 align-top">
              <td className="px-3 py-2">
                <div className="text-gray-100">{row.userName || "-"}</div>
                <div className="text-xs text-gray-400">
                  {row.userEmail}
                  {row.phone && <span className="ml-2 text-gray-500">{row.phone}</span>}
                </div>
                <div className="text-xs text-gray-500">{row.country || "Country not set"}</div>
              </td>
              <td className="px-3 py-2 text-xs">{row.gameMasterEmail || row.gameMasterId}</td>
              <td className="px-3 py-2">
                <AffiliationSourceBadge kind={row.kind} surface={row.surface} />
              </td>
              <td className="px-3 py-2 text-xs">{formatDate(row.joinedAt)}</td>
              <td className="px-3 py-2 text-xs">
                {row.isCurrent ? (
                  <span className={row.isActive ? "text-emerald-300" : "text-gray-300"}>
                    {describeAffiliationState(row)}
                  </span>
                ) : (
                  <span className="text-gray-400">
                    {describeAffiliationState(row)} {formatDate(row.endedAt)}
                    {describeEndedReason(row.endedReason) ? ` (${describeEndedReason(row.endedReason)})` : ""}
                  </span>
                )}
                {row.affiliations > 1 && (
                  <div className="mt-0.5 text-gray-500">
                    Rejoined - {row.affiliations} stints since {formatDate(row.firstJoinedAt)}
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-xs">{formatDate(row.lastActivityAt)}</td>
              <td className="px-3 py-2 text-right">{row.competitionsEntered}</td>
              <td className="px-3 py-2 text-right">{row.challengesEntered}</td>
              <td className="px-3 py-2 text-right">{formatVolts(row.entryFees)}</td>
              <td className="px-3 py-2 text-right">{formatVolts(row.earned)}</td>
              <td className="px-3 py-2 text-right">{formatVolts(row.pending)}</td>
              <td className="px-3 py-2 text-xs">{row.termsAccepted ? "Accepted" : "Not accepted"}</td>
              {canManage && (
                <td className="px-3 py-2 text-right">
                  {row.isCurrent && (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded border border-gray-600 px-2 py-1 text-xs hover:bg-gray-700"
                        onClick={() => onAction(row, "move")}
                      >
                        Move
                      </button>
                      <button
                        type="button"
                        className="rounded border border-red-700 px-2 py-1 text-xs text-red-300 hover:bg-red-900/40"
                        onClick={() => onAction(row, "detach")}
                      >
                        Detach
                      </button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
