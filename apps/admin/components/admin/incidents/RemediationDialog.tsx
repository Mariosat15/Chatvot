"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { CatalogueAction } from "./types";

export default function RemediationDialog({
  incidentId,
  isProviderGame,
  open,
  onClose,
  onApplied,
}: {
  incidentId: string;
  isProviderGame: boolean;
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [actions, setActions] = useState<CatalogueAction[]>([]);
  const [actionId, setActionId] = useState("");
  const [reason, setReason] = useState("");
  const [roundIds, setRoundIds] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [newRank, setNewRank] = useState("");
  const [newPrize, setNewPrize] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/incidents/${incidentId}/act`);
      const body = await response.json();
      if (cancelled) return;
      if (!response.ok) {
        toast.error(body.error || "Could not load solutions.");
        setActions([]);
        return;
      }
      const list = (body.actions ?? []) as CatalogueAction[];
      setActions(list);
      setActionId(list[0]?.id ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [open, incidentId]);

  if (!open) return null;

  const selected = actions.find((action) => action.id === actionId);

  const submit = async () => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { actionId, reason };
      if (actionId === "re_settle") {
        payload.roundIds = roundIds
          .split(/[\s,]+/)
          .map((id) => id.trim())
          .filter(Boolean);
      }
      if (actionId === "adjust_results") {
        payload.adjustments = [
          {
            participantId: participantId.trim(),
            reason,
            ...(newRank.trim() ? { newRank: Number(newRank) } : {}),
            ...(newPrize.trim() ? { newPrize: Number(newPrize) } : {}),
          },
        ];
      }
      const response = await fetch(`/api/incidents/${incidentId}/act`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        toast.error(data.error || "The action was refused.");
        onApplied();
        return;
      }
      if (actionId === "emergency_cancel") {
        toast.success(
          isProviderGame
            ? `Competition emergency cancelled! ${data.voidedRounds ?? 0} rounds voided, ${data.detail || ""}`
            : `Competition emergency cancelled! ${data.closedPositions ?? 0} positions closed, ${data.detail || ""}`,
        );
      } else {
        toast.success(data.detail || "Applied.");
      }
      onApplied();
      onClose();
    } catch {
      toast.error("The action failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-5 space-y-4">
        <h3 className="text-lg font-semibold text-white">Choose a solution</h3>
        {actions.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nothing can be done to this subject in its current state.
          </p>
        ) : (
          <label className="block text-sm text-gray-300">
            Solution
            <select
              className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 p-2 text-white"
              value={actionId}
              onChange={(event) => setActionId(event.target.value)}
            >
              {actions.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {selected ? (
          <div className="space-y-2 text-sm text-gray-200">
            <p>
              {selected.irreversible ? "Irreversible. " : "Reversible. "}
              {selected.movesMoney ? "This moves money." : "This does not move money."}
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {selected.consequences.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {actionId === "re_settle" ? (
          <label className="block text-sm text-gray-300">
            Round ids to void
            <textarea
              className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 p-2 text-white"
              rows={3}
              value={roundIds}
              onChange={(event) => setRoundIds(event.target.value)}
            />
          </label>
        ) : null}
        {actionId === "adjust_results" ? (
          <div className="space-y-2">
            <label className="block text-sm text-gray-300">
              Participant id
              <input
                className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 p-2 text-white"
                value={participantId}
                onChange={(event) => setParticipantId(event.target.value)}
              />
            </label>
            <label className="block text-sm text-gray-300">
              New rank
              <input
                className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 p-2 text-white"
                value={newRank}
                onChange={(event) => setNewRank(event.target.value)}
              />
            </label>
            <label className="block text-sm text-gray-300">
              New prize
              <input
                className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 p-2 text-white"
                value={newPrize}
                onChange={(event) => setNewPrize(event.target.value)}
              />
            </label>
          </div>
        ) : null}
        <label className="block text-sm text-gray-300">
          Reason
          <textarea
            className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 p-2 text-white"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-gray-600 px-3 py-1.5 text-sm text-gray-200"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            disabled={busy || !selected}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-gray-950 disabled:opacity-50"
            onClick={submit}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
