"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, User, Users } from "lucide-react";
import type { ReferredPlayerRow } from "@/lib/services/gamemaster/referral-read-model";
import { describeAffiliationState, describeEndedReason } from "@/lib/services/gamemaster/referral-kind";
import { filterDetailReferrals } from "@/lib/admin/gm-detail-referrals";
import AffiliationSourceBadge from "./AffiliationSourceBadge";
import GmExportButton from "./GmExportButton";
import type { AdminAwaitingClaimRow, AdminTermsReminderState } from "@/lib/admin/admin-terms-reminder-view";
import {
  AdminAwaitingTermsTable,
  AdminSendTermsButton,
  ConsentCell,
  ReminderStatusCell,
} from "./GmTermsReminderCells";

/** A row of the assigned list, with the consent and reminder facts the detail route adds. */
export type ReferralTabRow = ReferredPlayerRow & { termsState?: AdminTermsReminderState | null };

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
}

/**
 * The Referrals tab inside Manage Game Masters (`External game plans/24` s5.5).
 *
 * Reason: it renders `ReferredPlayerRow`s from the shared read model rather than the old
 * `referredUsers` list, so the Own/External badge, phone, country and status here are the
 * same facts the Referred Players report and its CSV show - one producer, three screens.
 * Admins see contact details unconditionally (D6 limits the GAME MASTER's view, not ours).
 */
export default function GmDetailReferralsTab({
  rows,
  total,
  gameMasterId,
  subscriptionId,
  awaitingTerms = [],
  canExport,
}: {
  rows: ReferralTabRow[];
  total: number;
  gameMasterId: string;
  /** The subscription id - the `[id]` of every `/api/gamemasters/[id]` route. */
  subscriptionId: string;
  awaitingTerms?: AdminAwaitingClaimRow[];
  canExport: boolean;
}) {
  const [search, setSearch] = useState("");
  // Reason: a send only moves the reminder counters, so the row is updated in place rather
  // than reloading the whole Game Master.
  const [sent, setSent] = useState<Map<string, { count: number; at: string }>>(new Map());
  const filtered = useMemo(() => filterDetailReferrals(rows, search), [rows, search]);
  const stateOf = (row: ReferralTabRow): AdminTermsReminderState | null => {
    const base = row.termsState ?? null;
    const local = sent.get(row.referralId);
    return base && local ? { ...base, adminReminderCount: local.count, lastAdminReminderAt: local.at } : base;
  };

  return (
    <div className="space-y-4">
      <AdminAwaitingTermsTable rows={awaitingTerms} subscriptionId={subscriptionId} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-gray-400">
          Total referrals: {total}
          {total > rows.length && ` (showing the latest ${rows.length} - export for all)`}
        </span>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, phone, country, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm placeholder-gray-400"
            />
          </div>
          <GmExportButton state={{ gameMasterId }} canExport={canExport} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Users className="h-10 w-10 mx-auto mb-2 text-gray-600" />
          {search ? "No referrals match your search." : "No referrals yet."}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm border-b border-gray-700 bg-gray-900/50">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Email / Phone</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Assigned Status</th>
                  <th className="px-4 py-3">Consent Status</th>
                  <th className="px-4 py-3">Terms Reminder Status</th>
                  <th className="px-4 py-3">Referred At</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.referralId} className="border-b border-gray-700/50 hover:bg-gray-900/30 align-top">
                    <td className="px-4 py-3">
                      <p className="text-white text-sm font-medium">{row.userName || "-"}</p>
                      <span className="text-gray-500 text-xs font-mono">{row.userId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <AffiliationSourceBadge kind={row.kind} surface={row.surface} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="text-gray-300">{row.userEmail || "-"}</div>
                      <div className="text-gray-500 text-xs">{row.phone || "No phone"}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{row.country || "Not set"}</td>
                    <td className="px-4 py-3 text-xs">
                      {row.isCurrent ? (
                        <span className={row.isActive ? "text-emerald-300" : "text-gray-300"}>
                          {describeAffiliationState(row)}
                        </span>
                      ) : (
                        <span className="text-gray-400">
                          Ended
                          {describeEndedReason(row.endedReason) && ` · ${describeEndedReason(row.endedReason)}`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {row.termsState ? (
                        <ConsentCell state={stateOf(row)} />
                      ) : row.termsAccepted ? (
                        <span className="text-emerald-300">Accepted</span>
                      ) : (
                        <span className="text-amber-300">Pending Terms</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ReminderStatusCell state={stateOf(row)} />
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{formatDate(row.joinedAt)}</td>
                    <td className="px-4 py-3 space-y-1.5">
                      <AdminSendTermsButton
                        subscriptionId={subscriptionId}
                        userId={row.userId}
                        state={stateOf(row)}
                        onSent={(count, at) =>
                          setSent((prev) => new Map(prev).set(row.referralId, { count, at }))
                        }
                      />
                      <Link
                        href={`/dashboard?activeTab=users&userId=${row.userId}`}
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        <User className="h-3 w-3" />
                        View User
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
