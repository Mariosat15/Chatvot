"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ReferredPlayerRow } from "@/lib/services/gamemaster/referral-read-model";
import { gameMasterLabel, type GameMasterOption } from "./GmReportFilters";

const GENERIC_ERROR = "Something went wrong. Please contact support.";
// Reason: the same bounds the server enforces in `admin-affiliation.service.ts`. The server
// is the authority; these only stop an operator sending a request that is certain to fail.
const MIN_REASON = 10;
const MAX_REASON = 500;

export type AffiliationAction = "move" | "detach";

const CONSEQUENCES: Readonly<Record<AffiliationAction, readonly string[]>> = {
  move: [
    "The player's current affiliation ends and a new one starts with the Game Master you choose.",
    "Entry fees the player pays from now on earn for the new Game Master. Earnings already recorded stay with the old one.",
    "The player's terms acceptance does not carry over, so the new Game Master sees no contact details until the player accepts.",
    "The move, your name and your reason are written to the player's audit trail and the system log.",
  ],
  detach: [
    "The player is no longer affiliated with any Game Master.",
    "No Game Master earns from the player's future entry fees. Earnings already recorded are unchanged.",
    "The player may join a Game Master again later.",
    "The detachment, your name and your reason are written to the player's audit trail and the system log.",
  ],
};

/**
 * Admin move or detach of one referred player (`External game plans/24` s7.4, D1).
 *
 * Reason: under D1 a player affiliated with a Game Master is LOCKED - this dialog is the only
 * way one is moved, which is why it demands a reason, states every consequence before the
 * button, and only offers active Game Masters (D7: paused and deleted ones are hidden). The
 * result shown is the server's answer, never what the click implied.
 */
export default function GmAffiliationActionDialog({
  row,
  action,
  gameMasters,
  onClose,
  onDone,
}: {
  row: ReferredPlayerRow;
  action: AffiliationAction;
  gameMasters: GameMasterOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);

  const targets = gameMasters.filter(
    (gm) => gm.status === "active" && gm.userId !== row.gameMasterId && gm.userId !== row.userId,
  );
  const trimmed = reason.trim();
  const canSubmit =
    !saving && trimmed.length >= MIN_REASON && (action === "detach" || target !== "");

  const submit = async () => {
    setSaving(true);
    try {
      const body =
        action === "move"
          ? { action, targetSubscriptionId: target, reason: trimmed }
          : { action, reason: trimmed };
      const res = await fetch(`/api/gamemasters/referred-players/${encodeURIComponent(row.userId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result?.success) {
        toast.error(result?.error || GENERIC_ERROR);
        return;
      }
      toast.success(action === "move" ? "Player moved" : "Player detached");
      onDone();
    } catch {
      toast.error(GENERIC_ERROR);
    } finally {
      setSaving(false);
    }
  };

  const player = row.userName || row.userEmail;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg" className="border-gray-700 bg-gray-900 text-gray-100">
        <DialogHeader>
          <DialogTitle>{action === "move" ? "Move player" : "Detach player"}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {player} is currently with {row.gameMasterEmail || row.gameMasterId}.
          </DialogDescription>
        </DialogHeader>

        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">
          {/* Reason: `action` is the AffiliationAction union set by this screen, never request input. */}
          {/* eslint-disable-next-line security/detect-object-injection */}
          {CONSEQUENCES[action].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        {action === "move" && (
          <label className="block text-xs text-gray-400">
            Move to Game Master
            <select
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Choose an active Game Master</option>
              {targets.map((gm) => (
                <option key={gm.id} value={gm.id}>
                  {gameMasterLabel(gm)}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-xs text-gray-400">
          Reason (required, at least {MIN_REASON} characters)
          <textarea
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
            rows={3}
            maxLength={MAX_REASON}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>

        <DialogFooter>
          <button
            type="button"
            className="rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            onClick={() => void submit()}
          >
            {saving ? "Saving..." : action === "move" ? "Move player" : "Detach player"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
