"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const GENERIC_ERROR = "Something went wrong. Please contact support.";

interface MigrationStatus {
  needingSource: number;
  duplicateActiveUsers: number;
  activeIndexPresent: boolean;
  legacyUniqueIndexPresent: boolean;
  refusedReason?: string;
}

/**
 * One-time Game Master affiliation migration (`External game plans/24` s2.1, D4). Until it
 * runs, a player whose Game Master expired or was deleted cannot join a new one.
 *
 * Reason: the status shown is always what the server read back, never what the click
 * implied, and the button disappears once there is nothing left to do - a button that can
 * be pressed for ever teaches an operator it does nothing.
 */
export default function GmAffiliationMigration() {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [complete, setComplete] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/gamemasters/affiliation-migration");
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success) {
        setError(body?.error || GENERIC_ERROR);
        return;
      }
      setStatus(body.status);
      setComplete(body.complete === true);
    } catch {
      setError(GENERIC_ERROR);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async () => {
    if (!window.confirm("Run the Game Master affiliation migration now? It is safe to run more than once.")) {
      return;
    }
    setRunning(true);
    try {
      const res = await fetch("/api/gamemasters/affiliation-migration", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success) {
        toast.error(body?.error || GENERIC_ERROR);
        return;
      }
      setStatus(body.status);
      setComplete(body.complete === true);
      if (body.applied?.refusedReason) toast.error(body.applied.refusedReason);
      else toast.success("Migration complete.");
    } catch {
      toast.error(GENERIC_ERROR);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-800 p-4">
      <div>
        <p className="font-semibold text-white">Affiliation migration</p>
        <p className="text-sm text-gray-400">
          Lets a player whose Game Master expired or was deleted join a new one. Run once.
        </p>
        {status && !complete && (
          <p className="mt-1 text-sm text-amber-300">
            {status.needingSource} referral row(s) to label
            {status.legacyUniqueIndexPresent ? ", old one-referral-per-player rule still in place" : ""}.
          </p>
        )}
        {status && status.duplicateActiveUsers > 0 && (
          <p className="mt-1 text-sm text-red-400">
            {status.duplicateActiveUsers} player(s) have more than one active Game Master. Resolve
            them before the migration can finish.
          </p>
        )}
        {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
      </div>
      {complete ? (
        <span className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Done</span>
      ) : (
        <button
          type="button"
          onClick={() => void run()}
          disabled={status === null || running}
          className="rounded bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
        >
          {status === null ? "Loading…" : running ? "Running…" : "Run migration"}
        </button>
      )}
    </div>
  );
}
