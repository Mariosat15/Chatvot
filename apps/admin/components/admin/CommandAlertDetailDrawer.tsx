"use client";

import { ExternalLink, X } from "lucide-react";
import {
  categoryForAlertType,
  labelForCategory,
} from "@/lib/admin/command-alert-categories";
import { fraudDeepLinkForAlert } from "@/lib/admin/command-alert-links";
import type { CommandAlertRow } from "@/components/admin/CommandAlertsTable";

interface Props {
  alert: CommandAlertRow | null;
  onClose: () => void;
  onAcknowledge: (id: string) => void;
  onDelete: (id: string) => void;
}

export function CommandAlertDetailDrawer({
  alert,
  onClose,
  onAcknowledge,
  onDelete,
}: Props) {
  if (!alert) return null;

  const cat = categoryForAlertType(alert.alertType);
  const link = fraudDeepLinkForAlert(alert);
  let metadataJson = "";
  try {
    metadataJson = alert.metadata
      ? JSON.stringify(alert.metadata, null, 2)
      : "";
  } catch {
    metadataJson = String(alert.metadata);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close drawer backdrop"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <aside
        className="relative w-full max-w-lg h-full bg-gray-950 border-l border-gray-800 shadow-xl overflow-y-auto"
        role="dialog"
        aria-labelledby="command-alert-drawer-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 bg-gray-950/95 border-b border-gray-800 backdrop-blur">
          <h2
            id="command-alert-drawer-title"
            className="text-sm font-semibold text-white truncate"
          >
            Alert detail
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-1">Type</p>
            <p className="font-mono text-white">{alert.alertType}</p>
            <p className="text-xs text-gray-500 mt-1">
              {labelForCategory(cat)} · {alert.severity}
              {alert.acknowledged ? " · acknowledged" : " · open"}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Reason</p>
            <p className="text-gray-200 whitespace-pre-wrap">{alert.reason}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-gray-500">When</dt>
              <dd className="text-gray-200">
                {new Date(alert.createdAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Source</dt>
              <dd className="text-gray-200 break-all">{alert.source}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Provider</dt>
              <dd className="text-gray-200">{alert.provider || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">User ID</dt>
              <dd className="text-gray-200 font-mono break-all">
                {alert.userId || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">IP</dt>
              <dd className="text-gray-200">{alert.ip || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Alert ID</dt>
              <dd className="text-gray-200 font-mono break-all">{alert._id}</dd>
            </div>
            {alert.acknowledged && (
              <>
                <div>
                  <dt className="text-gray-500">Ack by</dt>
                  <dd className="text-gray-200">
                    {alert.acknowledgedBy || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Ack at</dt>
                  <dd className="text-gray-200">
                    {alert.acknowledgedAt
                      ? new Date(alert.acknowledgedAt).toLocaleString()
                      : "—"}
                  </dd>
                </div>
              </>
            )}
          </dl>

          {alert.userAgent && (
            <div>
              <p className="text-xs text-gray-500 mb-1">User agent</p>
              <p className="text-gray-400 text-xs break-all">{alert.userAgent}</p>
            </div>
          )}

          {metadataJson && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Metadata</p>
              <pre className="text-xs text-lime-200/90 bg-gray-900 border border-gray-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                {metadataJson}
              </pre>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-800">
            {!alert.acknowledged && (
              <button
                type="button"
                onClick={() => onAcknowledge(alert._id)}
                className="px-3 py-2 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 text-xs"
              >
                Acknowledge
              </button>
            )}
            {link && (
              <a
                href={link.href}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/40 text-xs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {link.label}
              </a>
            )}
            <button
              type="button"
              onClick={() => onDelete(alert._id)}
              className="px-3 py-2 rounded-lg bg-red-600/20 text-red-300 border border-red-500/40 text-xs"
            >
              Delete
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
