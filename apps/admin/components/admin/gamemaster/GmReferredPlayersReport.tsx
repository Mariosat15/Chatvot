"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  ReferredPlayerRow,
  ReferredPlayersReport,
} from "@/lib/services/gamemaster/referral-read-model";
import {
  REPORT_PAGE_SIZE,
  readReportState,
  toApiQuery,
  writeReportState,
  type ReportState,
} from "@/lib/admin/gm-report-query";
import GmReportFilters, { type GameMasterOption } from "./GmReportFilters";
import GmReportSummary from "./GmReportSummary";
import GmReportTable from "./GmReportTable";
import GmExportButton from "./GmExportButton";
import GmAffiliationActionDialog, { type AffiliationAction } from "./GmAffiliationActionDialog";

const GENERIC_ERROR = "Something went wrong. Please contact support.";
// Reason: the list endpoint pages at the caller's limit; 100 covers today's programme. A
// Game Master beyond it is still reachable through the search box, by name or email.
const GAME_MASTER_LIST_LIMIT = 100;

/**
 * The admin referred-players report (`External game plans/24` s7.3-s7.5): filters,
 * overview figures, the per-affiliation table, export, and move / detach.
 *
 * Reason: the filters live in the URL (`rp_*`), read once per render into `state`, so the
 * report, the export and the page number can never describe three different filter sets.
 */
export default function GmReferredPlayersReport({ canExport }: { canExport: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramString = searchParams.toString();
  const state = useMemo(() => readReportState(new URLSearchParams(paramString)), [paramString]);

  const [report, setReport] = useState<ReferredPlayersReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [gameMasters, setGameMasters] = useState<GameMasterOption[]>([]);
  const [pending, setPending] = useState<{ row: ReferredPlayerRow; action: AffiliationAction } | null>(
    null,
  );

  const applyState = useCallback(
    (next: ReportState) => {
      const params = writeReportState(new URLSearchParams(paramString), next);
      router.replace(`/dashboard?${params.toString()}`, { scroll: false });
    },
    [paramString, router],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/gamemasters/referred-players?${toApiQuery(state)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success) {
        setError(body?.error || GENERIC_ERROR);
        return;
      }
      setReport(body.data as ReferredPlayersReport);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setLoading(false);
    }
  }, [state]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/gamemasters?limit=${GAME_MASTER_LIST_LIMIT}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled && Array.isArray(body?.gamemasters)) setGameMasters(body.gamemasters);
      })
      .catch(() => {
        // The filters still work without the list; the search box covers the gap.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const page = report?.page ?? 1;
  const totalPages = report ? Math.max(1, Math.ceil(report.total / REPORT_PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      <GmReportFilters state={state} gameMasters={gameMasters} onApply={applyState} />

      {error && (
        <div className="rounded-lg border border-red-700 bg-red-900/30 p-3 text-sm text-red-200">{error}</div>
      )}

      {report && <GmReportSummary report={report} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-gray-400">
          {loading ? "Loading..." : report ? `${report.total} affiliations` : ""}
        </span>
        <GmExportButton state={state} canExport={canExport} />
      </div>

      {report && (
        <GmReportTable
          rows={report.rows}
          canManage
          onAction={(row, action) => setPending({ row, action })}
        />
      )}

      {report && totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-gray-300">
          <button
            type="button"
            disabled={page <= 1}
            className="rounded border border-gray-600 px-3 py-1 disabled:opacity-40"
            onClick={() => applyState({ ...state, page: String(page - 1) })}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            className="rounded border border-gray-600 px-3 py-1 disabled:opacity-40"
            onClick={() => applyState({ ...state, page: String(page + 1) })}
          >
            Next
          </button>
        </div>
      )}

      {pending && (
        <GmAffiliationActionDialog
          row={pending.row}
          action={pending.action}
          gameMasters={gameMasters}
          onClose={() => setPending(null)}
          onDone={() => {
            setPending(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
