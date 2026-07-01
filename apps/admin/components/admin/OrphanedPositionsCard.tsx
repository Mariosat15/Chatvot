"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Play,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Unplug,
  Trash2,
} from "lucide-react";

interface OrphanSample {
  id: string;
  userId: string;
  symbol: string;
  side: string;
  contextId: string;
  parentType: string;
  parentStatus: string;
  exitPrice: number;
  closeReason: string;
}
interface ScanResult {
  success: boolean;
  totalOpen?: number;
  orphanCount?: number;
  byStatus?: Record<string, number>;
  sample?: OrphanSample[];
  checkedAt?: string;
  error?: string;
}
interface CloseResult {
  success: boolean;
  closed?: number;
  attempted?: number;
  remaining?: number;
  message?: string;
  error?: string;
}

const ENDPOINT = "/api/simulator/close-orphaned-positions";

export default function OrphanedPositionsCard() {
  const [scanLoading, setScanLoading] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  const scan = async () => {
    setScanLoading(true);
    try {
      const res = await fetch(ENDPOINT);
      const data: ScanResult = await res.json();
      if (data.success) {
        setResult(data);
        if (!data.orphanCount) {
          toast.success("No orphaned open positions — nothing to clean up.");
        } else {
          toast.warning(
            `${data.orphanCount} orphaned open position(s) on ended contests`,
          );
        }
      } else {
        toast.error(data.error || "Scan failed");
      }
    } catch (error) {
      toast.error("Scan failed");
      console.error(error);
    } finally {
      setScanLoading(false);
    }
  };

  const closeOrphans = async () => {
    if (!result?.orphanCount) return;
    if (
      !window.confirm(
        `Close ${result.orphanCount} orphaned open position(s)? They belong to contests that are already over, so this only clears leftovers. This cannot be undone.`,
      )
    ) {
      return;
    }
    setCloseLoading(true);
    try {
      const res = await fetch(ENDPOINT, { method: "POST" });
      const data: CloseResult = await res.json();
      if (data.success) {
        toast.success(data.message || `Closed ${data.closed ?? 0} position(s).`);
        await scan();
      } else {
        toast.error(data.error || "Close failed");
      }
    } catch (error) {
      toast.error("Close failed");
      console.error(error);
    } finally {
      setCloseLoading(false);
    }
  };

  const byStatus = result?.byStatus
    ? Object.entries(result.byStatus).sort((a, b) => b[1] - a[1])
    : [];
  const busy = scanLoading || closeLoading;
  const hasOrphans = (result?.orphanCount ?? 0) > 0;

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Unplug className="h-5 w-5 text-orange-400" />
              Orphaned Open Positions
            </CardTitle>
            <CardDescription className="text-gray-400">
              Finds positions still marked <span className="text-gray-300">open</span>{" "}
              even though their contest is already over (finalization skipped them
              when the price feed had no price for the symbol). Scan is read-only;
              closing clears the leftovers at the last known price.
            </CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              onClick={scan}
              disabled={busy}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {scanLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Scan
                </>
              )}
            </Button>
            {hasOrphans && (
              <Button
                onClick={closeOrphans}
                disabled={busy}
                variant="destructive"
              >
                {closeLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Closing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Close {result?.orphanCount}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {result && (
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-gray-400">
              Total open positions:{" "}
              <span className="text-white font-medium">{result.totalOpen ?? 0}</span>
            </span>
            <span className="text-gray-500">·</span>
            <span className="text-gray-400">
              Orphaned (on ended/missing contests):{" "}
              <span
                className={
                  hasOrphans ? "text-orange-400 font-medium" : "text-green-400 font-medium"
                }
              >
                {result.orphanCount ?? 0}
              </span>
            </span>
          </div>

          {!hasOrphans ? (
            <div className="flex items-center gap-3 rounded-lg bg-green-500/10 border border-green-700 p-4">
              <CheckCircle className="h-6 w-6 text-green-400" />
              <div>
                <p className="text-green-400 font-medium">
                  No orphaned open positions
                </p>
                <p className="text-xs text-gray-400">
                  Every open position belongs to a live (active/finalizing) contest.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-orange-500/10 border border-orange-700 p-4">
                <AlertTriangle className="h-6 w-6 text-orange-400" />
                <p className="text-orange-300 text-sm">
                  These positions will never close on their own — use{" "}
                  <span className="font-medium">Close</span> to clear them.
                </p>
              </div>

              {byStatus.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {byStatus.map(([status, count]) => (
                    <Badge
                      key={status}
                      variant="outline"
                      className="border-orange-700 text-orange-300"
                    >
                      {status}: {count}
                    </Badge>
                  ))}
                </div>
              )}

              <ScrollArea className="max-h-[320px]">
                <table className="w-full text-xs">
                  <thead className="text-gray-500">
                    <tr className="text-left">
                      <th className="py-1 pr-2">symbol</th>
                      <th className="py-1 pr-2">side</th>
                      <th className="py-1 pr-2">contest</th>
                      <th className="py-1 pr-2">status</th>
                      <th className="py-1 pr-2">user</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300 font-mono">
                    {result.sample?.map((o) => (
                      <tr key={o.id} className="border-t border-gray-800">
                        <td className="py-1 pr-2">{o.symbol}</td>
                        <td className="py-1 pr-2">{o.side}</td>
                        <td className="py-1 pr-2">
                          {o.parentType !== "unknown"
                            ? `${o.parentType.slice(0, 4)}·`
                            : ""}
                          {o.contextId.slice(-8)}
                        </td>
                        <td className="py-1 pr-2 text-orange-400">
                          {o.parentStatus}
                        </td>
                        <td className="py-1 pr-2">{o.userId.slice(-8)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
              {result.orphanCount &&
              result.sample &&
              result.orphanCount > result.sample.length ? (
                <p className="text-xs text-gray-500">
                  Showing first {result.sample.length} of {result.orphanCount}.
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
