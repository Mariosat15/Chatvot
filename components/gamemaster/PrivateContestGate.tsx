"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import ActionTermsDialog, { ACTION_TERM_SLUGS } from "@/components/ActionTermsDialog";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { formatVolts } from "@/lib/utils/format-volts";
import { privateContestInvitation } from "@/lib/utils/private-contest-card-copy";
import type { PrivateContestGate as GateFacts } from "@/lib/services/gamemaster/private-contest-gate.service";

const GENERIC_ERROR = "Something went wrong. Please contact support.";

/**
 * The lobby for a private contest the viewer may not see yet (`24` s6.2).
 *
 * Shows ONLY the name, the Game Master and the entry fee - never the leaderboard or a
 * participant name, because those are what "private" protects.
 *
 * Reason the join ends in `router.refresh()` rather than rendering the entry button here: the
 * server re-reads eligibility with the same check the entry gate runs, so the ordinary lobby -
 * entry button and all - appears only once the server agrees the player is affiliated. A
 * client-side "you may enter now" would be a second answer to that question.
 */
export default function PrivateContestGate({
  competitionId,
  competitionName,
  entryFee,
  gate,
}: {
  competitionId: string;
  competitionName: string;
  entryFee: number | null | undefined;
  gate: GateFacts;
}) {
  const router = useRouter();
  const { settings } = useAppSettings();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const gmName = gate.gameMasterName || "this Game Master";
  const invitation = privateContestInvitation(gate.gameMasterName);

  const handleAccepted = async (acceptanceId?: string) => {
    setDialogOpen(false);
    if (!acceptanceId || !gate.subscriptionId) {
      toast.error(GENERIC_ERROR);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/gamemasters/${encodeURIComponent(gate.subscriptionId)}/join`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ termsAcceptanceId: acceptanceId, competitionId }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success) {
        toast.error(body?.error || GENERIC_ERROR);
        return;
      }
      toast.success(`You joined ${gmName}. You can now enter the competition.`);
      router.refresh();
    } catch {
      toast.error(GENERIC_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-12">
      <div className="rounded-2xl border border-cyan-500/30 bg-gray-950 p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-cyan-300">
          <Lock className="h-4 w-4" />
          Private competition
        </div>
        <h1 className="text-2xl font-semibold text-white">{competitionName}</h1>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-gray-500">Game Master</dt>
            <dd className="text-gray-200">{gate.gameMasterName || "-"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Entry fee</dt>
            <dd className="text-gray-200">
              {formatVolts(entryFee, { symbol: settings?.credits?.symbol })}
            </dd>
          </div>
        </dl>

        <h2 className="mt-5 text-base font-semibold text-white">{invitation.title}</h2>
        <p className="mt-2 text-sm text-gray-400">{invitation.body}</p>
        {gate.state === "joinable" && (
          <p className="mt-2 text-sm text-gray-400">{invitation.notLinked}</p>
        )}

        <div className="mt-5">
          {gate.state === "joinable" && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => setDialogOpen(true)}
              className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 font-semibold text-gray-950 hover:bg-cyan-400 disabled:opacity-60"
            >
              {submitting ? "Joining..." : "Join GM to enter"}
            </button>
          )}
          {gate.state === "locked" && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              You already belong to {gate.currentGameMasterName || "another Game Master"}. Only an
              administrator can move you to another Game Master.
            </p>
          )}
          {gate.state === "signed_out" && (
            <Link
              href="/sign-in"
              className="block w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-center font-semibold text-gray-950"
            >
              Sign in to join
            </Link>
          )}
          {(gate.state === "join_disabled" || gate.state === "unavailable") && (
            <p className="rounded-lg border border-gray-700 bg-gray-900 p-3 text-sm text-gray-300">
              Joining this Game Master is not available right now.
            </p>
          )}
        </div>
      </div>
      <Link href="/competitions" className="text-sm text-gray-400 hover:text-gray-200">
        Back to competitions
      </Link>

      {dialogOpen && gate.gameMasterUserId && (
        <ActionTermsDialog
          slug={ACTION_TERM_SLUGS.GM_AFFILIATION}
          open
          recordedContext={{ gameMasterId: gate.gameMasterUserId }}
          variables={{ gameMasterName: gmName }}
          onAccept={(id) => void handleAccepted(id)}
          onDecline={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}
