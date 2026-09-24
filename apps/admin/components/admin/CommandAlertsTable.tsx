"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  categoryForAlertType,
  labelForCategory,
} from "@/lib/admin/command-alert-categories";
import { fraudDeepLinkForAlert } from "@/lib/admin/command-alert-links";

export interface CommandAlertRow {
  _id: string;
  alertType: string;
  severity: "low" | "medium" | "high" | "critical";
  source: string;
  provider?: string;
  reason: string;
  acknowledged: boolean;
  createdAt: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  acknowledgmentNote?: string;
}

const SEVERITY_CLASS = {
  critical: "bg-red-500/20 text-red-300 border-red-500/40",
  high: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  medium: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  low: "bg-gray-500/20 text-gray-300 border-gray-500/40",
} as const;

function severityClass(severity: CommandAlertRow["severity"]): string {
  switch (severity) {
    case "critical":
      return SEVERITY_CLASS.critical;
    case "high":
      return SEVERITY_CLASS.high;
    case "medium":
      return SEVERITY_CLASS.medium;
    case "low":
      return SEVERITY_CLASS.low;
  }
}

interface Props {
  alerts: CommandAlertRow[];
  loading: boolean;
  selected: Set<string>;
  total: number;
  page: number;
  totalPages: number;
  exporting?: boolean;
  onToggle: (id: string) => void;
  onSelectPage: (ids: string[]) => void;
  onClearSelection: () => void;
  onDeleteIds: (ids: string[]) => void;
  onDeleteMatching: () => void;
  onAcknowledgeIds: (ids: string[]) => void;
  onExportCsv: () => void;
  onOpenDetail: (alert: CommandAlertRow) => void;
  onCopy: (text: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

export function CommandAlertsTable({
  alerts,
  loading,
  selected,
  total,
  page,
  totalPages,
  exporting,
  onToggle,
  onSelectPage,
  onClearSelection,
  onDeleteIds,
  onDeleteMatching,
  onAcknowledgeIds,
  onExportCsv,
  onOpenDetail,
  onCopy,
  onPrev,
  onNext,
}: Props) {
  const allOnPageSelected =
    alerts.length > 0 && alerts.every((a) => selected.has(a._id));
  const selectedOpenIds = alerts
    .filter((a) => selected.has(a._id) && !a.acknowledged)
    .map((a) => a._id);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => onAcknowledgeIds(selectedOpenIds)}
          disabled={selectedOpenIds.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 disabled:opacity-40"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Acknowledge selected ({selectedOpenIds.length})
        </button>
        <button
          type="button"
          onClick={() =>
            onDeleteIds(alerts.filter((a) => selected.has(a._id)).map((a) => a._id))
          }
          disabled={selected.size === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 text-red-300 border border-red-500/40 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete selected ({selected.size})
        </button>
        <button
          type="button"
          onClick={onDeleteMatching}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/40 text-red-200 border border-red-700/50"
        >
          Delete matching filters
        </button>
        <button
          type="button"
          onClick={onExportCsv}
          disabled={exporting || total === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-200 border border-gray-600 disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
        <span className="text-gray-500 text-xs ml-auto">
          {total} matching · page {page}/{totalPages}
        </span>
      </div>

      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900/80 text-gray-400 text-left">
            <tr>
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={() => {
                    if (allOnPageSelected) onClearSelection();
                    else onSelectPage(alerts.map((a) => a._id));
                  }}
                />
              </th>
              <th className="p-3">When</th>
              <th className="p-3">Severity</th>
              <th className="p-3">Type / Category</th>
              <th className="p-3">Reason</th>
              <th className="p-3 w-28" />
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  {loading ? "Loading…" : "No alerts match these filters."}
                </td>
              </tr>
            )}
            {alerts.map((a) => {
              const cat = categoryForAlertType(a.alertType);
              const link = fraudDeepLinkForAlert(a);
              return (
                <tr
                  key={a._id}
                  className="border-t border-gray-800/80 hover:bg-gray-900/40 align-top"
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(a._id)}
                      onChange={() => onToggle(a._id)}
                    />
                  </td>
                  <td className="p-3 text-gray-400 whitespace-nowrap">
                    {new Date(a.createdAt).toLocaleString()}
                    {a.acknowledged ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-emerald-400 text-xs">
                        <CheckCircle2 className="h-3 w-3" /> ack
                      </span>
                    ) : (
                      <span className="ml-2 inline-flex items-center gap-1 text-amber-400 text-xs">
                        <AlertTriangle className="h-3 w-3" /> open
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded border text-xs ${severityClass(a.severity)}`}
                    >
                      {a.severity}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="text-white font-mono text-xs">
                      {a.alertType}
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5">
                      {labelForCategory(cat)} · {a.source}
                      {a.provider ? ` · ${a.provider}` : ""}
                    </div>
                  </td>
                  <td className="p-3 text-gray-200 max-w-xl">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(a)}
                      className="text-left hover:text-white"
                    >
                      {a.reason}
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        title="Details"
                        onClick={() => onOpenDetail(a)}
                        className="p-1.5 rounded hover:bg-gray-800 text-gray-400"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {!a.acknowledged && (
                        <button
                          type="button"
                          title="Acknowledge"
                          onClick={() => onAcknowledgeIds([a._id])}
                          className="p-1.5 rounded hover:bg-emerald-900/40 text-emerald-400"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {link && (
                        <Link
                          href={link.href}
                          title={link.label}
                          className="p-1.5 rounded hover:bg-blue-900/40 text-blue-400"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      <button
                        type="button"
                        title="Copy reason"
                        onClick={() => onCopy(a.reason)}
                        className="p-1.5 rounded hover:bg-gray-800 text-gray-400"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => onDeleteIds([a._id])}
                        className="p-1.5 rounded hover:bg-red-900/40 text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          disabled={page <= 1}
          onClick={onPrev}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <span className="text-sm text-gray-400">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={onNext}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm disabled:opacity-40"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}
