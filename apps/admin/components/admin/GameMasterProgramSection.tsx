"use client";

import { useRouter, useSearchParams } from "next/navigation";
import GameMasterManagementSection from "./GameMasterManagementSection";
import GmReferredPlayersReport from "./gamemaster/GmReferredPlayersReport";
import { GM_TAB_PARAM, resolveGmTab, type GmTab } from "@/lib/admin/gm-report-query";

const TABS: ReadonlyArray<{ id: GmTab; label: string }> = [
  { id: "masters", label: "Game Masters" },
  { id: "players", label: "Referred players" },
];

/**
 * The admin Game Master area (`External game plans/24` s7.3): the existing management
 * screen, and the referred-players report beside it.
 *
 * Reason: a wrapper rather than a sixth tab inside `GameMasterManagementSection`, which is
 * already over 700 lines. The tab is in the URL (`gmTab`), and `gmId` - the deep link from a
 * player's detail panel into one Game Master - always opens the masters tab, so that link
 * keeps working whatever tab the operator last left open. Leaving the masters tab drops
 * `gmId`, or the detail view would reopen the next time they return to it.
 */
export default function GameMasterProgramSection({
  initialGmId,
  canExport,
}: {
  initialGmId?: string;
  canExport: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = resolveGmTab(searchParams);

  const select = (next: GmTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(GM_TAB_PARAM, next);
    if (next !== "masters") params.delete("gmId");
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-700" role="tablist">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === id
                ? "border-yellow-500 text-yellow-300"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
            onClick={() => select(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "masters" ? (
        <GameMasterManagementSection initialGmId={initialGmId} canExport={canExport} />
      ) : (
        <GmReferredPlayersReport canExport={canExport} />
      )}
    </div>
  );
}
