"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import ChargebackCasePanel from "./ChargebackCasePanel";

interface Row {
  _id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  provider: string;
  reasonCode?: string;
  amount: number;
  currency: string;
  status: string;
  outcome?: string;
  receivedAt: string;
  createdAt: string;
  clawback?: {
    userWallet?: { applied?: boolean; amount?: number };
    platformBank?: { applied?: boolean; amount?: number };
  };
}

const STATUS_BADGE: Record<string, string> = {
  pending_review: "bg-amber-950/40 border-amber-700 text-amber-300",
  initiated: "bg-blue-950/40 border-blue-700 text-blue-300",
  represented: "bg-indigo-950/40 border-indigo-700 text-indigo-300",
  won: "bg-green-950/40 border-green-700 text-green-300",
  lost: "bg-red-950/40 border-red-700 text-red-300",
  withdrawn: "bg-gray-800 border-gray-600 text-gray-300",
};

const STATUSES = [
  "",
  "pending_review",
  "initiated",
  "represented",
  "won",
  "lost",
  "withdrawn",
] as const;

export default function ChargebacksFinancialTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}&limit=200` : "?limit=200";
      const res = await fetch(`/api/chargebacks${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setRows(json.items || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    let open = 0;
    let lost = 0;
    let totalBankLoss = 0;
    let totalClawedBack = 0;
    for (const r of rows) {
      if (!["won", "lost", "withdrawn"].includes(r.status)) open++;
      if (r.status === "lost") lost++;
      if (r.clawback?.platformBank?.applied) {
        totalBankLoss += Number(r.clawback.platformBank.amount || 0);
      }
      if (r.clawback?.userWallet?.applied) {
        totalClawedBack += Number(r.clawback.userWallet.amount || 0);
      }
    }
    return { open, lost, totalBankLoss, totalClawedBack };
  }, [rows]);

  if (selectedId) {
    return (
      <div className="space-y-4">
        <ChargebackCasePanel
          caseId={selectedId}
          onBack={() => {
            setSelectedId(null);
            load();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Open cases" value={String(summary.open)} tone="amber" />
        <SummaryCard label="Lost cases" value={String(summary.lost)} tone="red" />
        <SummaryCard
          label="Bank loss (total)"
          value={`${summary.totalBankLoss.toFixed(2)}`}
          tone="red"
        />
        <SummaryCard
          label="Clawed back from users"
          value={`${summary.totalClawedBack.toFixed(2)}`}
          tone="green"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-gray-200 rounded-md text-sm px-2 py-1"
          >
            {STATUSES.map((s) => (
              <option key={s || "all"} value={s}>
                {s || "All"}
              </option>
            ))}
          </select>
        </div>
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      </div>

      <div className="rounded-lg border border-gray-700 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-800 text-gray-300">
            <tr>
              <th className="text-left px-3 py-2">Received</th>
              <th className="text-left px-3 py-2">User</th>
              <th className="text-left px-3 py-2">PSP</th>
              <th className="text-left px-3 py-2">Amount</th>
              <th className="text-left px-3 py-2">Reason</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-gray-400">
                  No chargeback cases.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r._id}
                  className="border-t border-gray-800 hover:bg-gray-800/50"
                >
                  <td className="px-3 py-2 text-gray-300">
                    {new Date(r.receivedAt || r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-gray-200">
                    {r.userName || r.userEmail || r.userId}
                  </td>
                  <td className="px-3 py-2 text-gray-300">{r.provider}</td>
                  <td className="px-3 py-2 font-mono text-gray-200">
                    {r.amount} {r.currency}
                  </td>
                  <td className="px-3 py-2 text-gray-400">
                    {r.reasonCode || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      className={`border ${
                        STATUS_BADGE[r.status] ||
                        "bg-gray-800 border-gray-700 text-gray-300"
                      }`}
                    >
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedId(r._id)}
                    >
                      Open
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "amber" | "red" | "green" | "blue";
}) {
  const toneCls: Record<string, string> = {
    amber: "border-amber-700 text-amber-300",
    red: "border-red-700 text-red-300",
    green: "border-green-700 text-green-300",
    blue: "border-blue-700 text-blue-300",
  };
  return (
    // eslint-disable-next-line security/detect-object-injection -- tone is a controlled enum literal
    <div className={`rounded-lg border bg-gray-900/50 p-3 ${toneCls[tone]}`}>
      <div className="text-xs uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <div className="text-xl font-mono mt-1">{value}</div>
    </div>
  );
}
