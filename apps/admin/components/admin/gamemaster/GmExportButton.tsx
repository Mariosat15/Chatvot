"use client";

import { useState } from "react";
import { toast } from "sonner";
import { toApiQuery, type ReportState } from "@/lib/admin/gm-report-query";

const GENERIC_ERROR = "Something went wrong. Please contact support.";

/**
 * Exports the WHOLE filtered set as CSV (`External game plans/24` s7.5).
 *
 * Reason: withheld with its reason rather than hidden when the operator lacks the
 * `gamemaster-reports-export` grant - a screen that silently lacks a button reads as a
 * missing feature, and the operator should know which grant to ask for. The server refuses
 * either way; this only spares a request that is certain to fail. A refusal at the row cap
 * arrives as JSON and is shown as written, because it names the fix (narrow the filters).
 */
export default function GmExportButton({
  state,
  canExport,
}: {
  state: ReportState;
  canExport: boolean;
}) {
  const [busy, setBusy] = useState(false);

  if (!canExport) {
    return (
      <span className="text-xs text-gray-500">
        Export needs the &quot;Export GM Reports&quot; permission.
      </span>
    );
  }

  const run = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/gamemasters/report/export?${toApiQuery(state, { forExport: true })}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error || GENERIC_ERROR);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `gm-referred-players-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      className="rounded-md border border-yellow-600 px-4 py-2 text-sm text-yellow-300 hover:bg-yellow-900/30 disabled:opacity-50"
      onClick={() => void run()}
    >
      {busy ? "Preparing CSV..." : "Export CSV"}
    </button>
  );
}
