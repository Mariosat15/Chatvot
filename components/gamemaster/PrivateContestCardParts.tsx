"use client";

/**
 * The private-contest pieces of a competition card: a "Private" badge, and - for anyone who is
 * not a member - the button that replaces "Enter Arena". Both link to the lobby, whose gate
 * (`PrivateContestGate`) performs the actual Join GM step; the card never joins anybody itself,
 * so there is one place that can.
 */

import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isPrivateCardAccess,
  privateContestCardCopy,
} from "@/lib/utils/private-contest-card-copy";

export function PrivateContestBadge({ access }: { access: unknown }) {
  if (!isPrivateCardAccess(access)) return null;
  return (
    <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-300">
      <Lock className="h-3 w-3" aria-hidden />
      Private
    </span>
  );
}

/** Returns null for a member (and for a public contest), so the ordinary button renders. */
export function PrivateContestCardAction({
  competitionId,
  access,
  gameMasterName,
}: {
  competitionId: string;
  access: unknown;
  gameMasterName?: string;
}) {
  if (!isPrivateCardAccess(access)) return null;
  const copy = privateContestCardCopy(access, gameMasterName);
  if (!copy.action) return null;
  return (
    <div>
      <Link href={`/competitions/${competitionId}`} className="block">
        <Button
          className={`w-full rounded-xl py-6 text-base font-black ${
            copy.tone === "invite"
              ? "bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white shadow-lg shadow-purple-500/30 hover:from-purple-400 hover:to-fuchsia-400"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          <Lock className="mr-2 h-4 w-4" aria-hidden />
          {copy.action}
        </Button>
      </Link>
      {copy.hint && <p className="mt-2 text-center text-xs text-gray-400">{copy.hint}</p>}
    </div>
  );
}
