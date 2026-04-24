"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, Plus, RefreshCw } from "lucide-react";
import ChargebackCasePanel from "./ChargebackCasePanel";

/** Thin list of a user's chargeback cases. Clicking opens the detail view. */

interface ChargebackSummary {
  _id: string;
  status: string;
  outcome?: string;
  amount: number;
  currency: string;
  provider: string;
  reasonCode?: string;
  providerTransactionId?: string;
  chargebackCaseId?: string;
  receivedAt: string;
  createdAt: string;
}

interface Props {
  userId: string;
  userEmail?: string;
  userName?: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending_review: "bg-amber-950/40 border-amber-700 text-amber-300",
  initiated: "bg-blue-950/40 border-blue-700 text-blue-300",
  represented: "bg-indigo-950/40 border-indigo-700 text-indigo-300",
  won: "bg-green-950/40 border-green-700 text-green-300",
  lost: "bg-red-950/40 border-red-700 text-red-300",
  withdrawn: "bg-gray-800 border-gray-600 text-gray-300",
};

export default function ChargebacksTab({ userId, userEmail, userName }: Props) {
  const [cases, setCases] = useState<ChargebackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/chargebacks`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("request failed");
      const json = await res.json();
      setCases(json.cases || []);
    } catch (err) {
      console.error("load chargebacks failed", err);
      toast.error("Failed to load chargebacks");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const onManualCreate = useCallback(async () => {
    const amountStr = window.prompt(
      "Chargeback amount (in EUR credits):",
      "0",
    );
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (!(amount > 0)) {
      toast.error("Amount must be a positive number");
      return;
    }
    const provider = window.prompt("Provider (e.g. nuvei):", "nuvei") || "";
    if (!provider.trim()) return;
    const reasonCode = window.prompt("Reason code (optional):", "") || undefined;
    const providerTx = window.prompt("Provider transaction id (optional):", "") || undefined;

    try {
      const res = await fetch(`/api/users/${userId}/chargebacks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount,
          provider: provider.trim(),
          reasonCode,
          providerTransactionId: providerTx,
          userEmail,
          userName,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed");
      }
      toast.success("Chargeback case created");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create case");
    }
  }, [userId, userEmail, userName, load]);

  const sorted = useMemo(
    () =>
      [...cases].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [cases],
  );

  if (selectedId) {
    return (
      <ChargebackCasePanel
        caseId={selectedId}
        onBack={() => {
          setSelectedId(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">
            Chargeback cases — each case tracks a payment dispute end-to-end.
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={onManualCreate}>
            <Plus className="h-3 w-3 mr-1" />
            Add case
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading chargebacks…</div>
      ) : sorted.length === 0 ? (
        <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-6 text-center text-sm text-gray-400">
          No chargeback cases on record for this user.
        </div>
      ) : (
        <div className="rounded-lg border border-gray-700 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-800 text-gray-300">
              <tr>
                <th className="text-left px-3 py-2">Received</th>
                <th className="text-left px-3 py-2">Amount</th>
                <th className="text-left px-3 py-2">PSP</th>
                <th className="text-left px-3 py-2">Reason</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr
                  key={c._id}
                  className="border-t border-gray-800 hover:bg-gray-800/50"
                >
                  <td className="px-3 py-2 text-gray-300">
                    {new Date(c.receivedAt || c.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-200">
                    {c.amount} {c.currency}
                  </td>
                  <td className="px-3 py-2 text-gray-300">{c.provider}</td>
                  <td className="px-3 py-2 text-gray-400">
                    {c.reasonCode || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      className={`border ${
                        STATUS_BADGE[c.status] ||
                        "bg-gray-800 border-gray-700 text-gray-300"
                      }`}
                    >
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedId(c._id)}
                    >
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
