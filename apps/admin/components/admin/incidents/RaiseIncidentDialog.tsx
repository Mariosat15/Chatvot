"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { LiveSubject } from "./types";

const TYPES = [
  "technical_error",
  "unfair_result",
  "price_feed_failure",
  "user_complaint",
  "system_error",
  "other",
] as const;

export default function RaiseIncidentDialog({
  subject,
  open,
  onClose,
  onCreated,
}: {
  subject: LiveSubject | null;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("technical_error");
  const [severity, setSeverity] = useState("high");
  const [busy, setBusy] = useState(false);

  if (!open || !subject) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const body: Record<string, string> = {
        title,
        description,
        type,
        severity,
        subjectType: subject.kind,
      };
      if (subject.kind === "competition") body.competitionId = subject.id;
      if (subject.kind === "challenge") body.challengeId = subject.id;
      if (subject.kind === "round") {
        body.roundId = subject.id;
        if (subject.contestId) body.competitionId = subject.contestId;
      }
      if (subject.gameKey) body.gameKey = subject.gameKey;

      const response = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Could not record the incident.");
        return;
      }
      toast.success("Incident recorded.");
      setTitle("");
      setDescription("");
      onCreated();
      onClose();
    } catch {
      toast.error("Could not record the incident.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg space-y-4 rounded-xl border border-gray-700 bg-gray-900 p-5">
        <h3 className="text-lg font-semibold text-white">Raise an incident</h3>
        <p className="text-sm text-gray-300">
          {subject.badge}: {subject.name}
        </p>
        <p className="text-sm text-gray-400">{subject.problem}</p>
        <label className="block text-sm text-gray-300">
          Type
          <select
            className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 p-2 text-white"
            value={type}
            onChange={(event) =>
              setType(event.target.value as (typeof TYPES)[number])
            }
          >
            {TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-gray-300">
          Severity
          <select
            className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 p-2 text-white"
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
          >
            {["low", "medium", "high", "critical"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-gray-300">
          Title
          <input
            className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 p-2 text-white"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="block text-sm text-gray-300">
          What went wrong
          <textarea
            className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 p-2 text-white"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
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
            disabled={busy}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-gray-950"
            onClick={submit}
          >
            Record incident
          </button>
        </div>
      </div>
    </div>
  );
}
