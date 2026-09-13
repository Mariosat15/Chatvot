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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Play,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Calculator,
  Wrench,
} from "lucide-react";

interface FixSample {
  id: string;
  username: string;
  contestType: string;
  contestId: string;
  before: { realizedPnl: number; winningTrades: number; losingTrades: number };
  after: { realizedPnl: number; winningTrades: number; losingTrades: number };
}
interface ScanResult {
  success: boolean;
  scanned?: number;
  fixCount?: number;
  sample?: FixSample[];
  checkedAt?: string;
  error?: string;
}
interface ApplyResult {
  success: boolean;
  fixed?: number;
  attempted?: number;
  remaining?: number;
  message?: string;
  error?: string;
}

const ENDPOINT = "/api/simulator/recompute-finished-stats";

export default function RecomputeStatsCard() {
  const [scanLoading, setScanLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  const scan = async () => {
    setScanLoading(true);
    try {
      const res = await fetch(ENDPOINT);
      const data: ScanResult = await res.json();
      if (data.success) {
        setResult(data);
        if (!data.fixCount) {
          toast.success("All finished-contest stats already match trade history.");
        } else {
          toast.warning(
            `${data.fixCount} finished participant record(s) drifted from trade history`,
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

  const apply = async () => {
    if (!result?.fixCount) return;
    if (
      !window.confirm(
        `Recompute ${result.fixCount} finished participant record(s) from their trade history? This corrects realized P&L and win/loss counts to match the actual trades. Ranks and prizes are NOT touched. This cannot be undone.`,
      )
    ) {
      return;
    }
    setApplyLoading(true);
    try {
      const res = await fetch(ENDPOINT, { method: "POST" });
      const data: ApplyResult = await res.json();
      if (data.success) {
        toast.success(data.message || `Reconciled ${data.fixed ?? 0} record(s).`);
        await scan();
      } else {
        toast.error(data.error || "Recompute failed");
      }
    } catch (error) {
      toast.error("Recompute failed");
      console.error(error);
    } finally {
      setApplyLoading(false);
    }
  };

  const busy = scanLoading || applyLoading;
  const hasFixes = (result?.fixCount ?? 0) > 0;

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Calculator className="h-5 w-5 text-cyan-400" />
              Recompute Finished-Contest Stats
            </CardTitle>
            <CardDescription className="text-gray-400">
              Finds <span className="text-gray-300">completed</span> contests
              whose stored participant totals (realized P&amp;L, win/loss counts)
              no longer match the sum of their actual trades in trade history —
              leftover drift from the old finalization. Scan is read-only;
              recompute rewrites the totals from trade history. Ranks and prizes
              are never changed.
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
            {hasFixes && (
              <Button
                onClick={apply}
                disabled={busy}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {applyLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Recomputing...
                  </>
                ) : (
                  <>
                    <Wrench className="h-4 w-4 mr-2" />
                    Recompute {result?.fixCount}
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
              Finished participants scanned:{" "}
              <span className="text-white font-medium">{result.scanned ?? 0}</span>
            </span>
            <span className="text-gray-500">·</span>
            <span className="text-gray-400">
              Drifted (need recompute):{" "}
              <span
                className={
                  hasFixes
                    ? "text-cyan-400 font-medium"
                    : "text-green-400 font-medium"
                }
              >
                {result.fixCount ?? 0}
              </span>
            </span>
          </div>

          {!hasFixes ? (
            <div className="flex items-center gap-3 rounded-lg bg-green-500/10 border border-green-700 p-4">
              <CheckCircle className="h-6 w-6 text-green-400" />
              <div>
                <p className="text-green-400 font-medium">
                  All finished-contest totals match trade history
                </p>
                <p className="text-xs text-gray-400">
                  Every completed participant&apos;s realized P&amp;L and win/loss
                  counts already equal the sum of their trades.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-cyan-500/10 border border-cyan-700 p-4">
                <AlertTriangle className="h-6 w-6 text-cyan-400" />
                <p className="text-cyan-200 text-sm">
                  These stored totals differ from the actual trades. Press{" "}
                  <span className="font-medium">Recompute</span> to rewrite them
                  from trade history.
                </p>
              </div>

              <ScrollArea className="max-h-[340px]">
                <table className="w-full text-xs">
                  <thead className="text-gray-500">
                    <tr className="text-left">
                      <th className="py-1 pr-2">participant</th>
                      <th className="py-1 pr-2">type</th>
                      <th className="py-1 pr-2">realized P&amp;L</th>
                      <th className="py-1 pr-2">wins</th>
                      <th className="py-1 pr-2">losses</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300 font-mono">
                    {result.sample?.map((f) => (
                      <tr key={f.id} className="border-t border-gray-800">
                        <td className="py-1 pr-2">{f.username}</td>
                        <td className="py-1 pr-2">{f.contestType.slice(0, 4)}</td>
                        <td className="py-1 pr-2">
                          <span className="text-red-400">{f.before.realizedPnl}</span>
                          <span className="text-gray-600"> → </span>
                          <span className="text-green-400">{f.after.realizedPnl}</span>
                        </td>
                        <td className="py-1 pr-2">
                          <span className="text-red-400">{f.before.winningTrades}</span>
                          <span className="text-gray-600">→</span>
                          <span className="text-green-400">{f.after.winningTrades}</span>
                        </td>
                        <td className="py-1 pr-2">
                          <span className="text-red-400">{f.before.losingTrades}</span>
                          <span className="text-gray-600">→</span>
                          <span className="text-green-400">{f.after.losingTrades}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
              {result.fixCount &&
              result.sample &&
              result.fixCount > result.sample.length ? (
                <p className="text-xs text-gray-500">
                  Showing first {result.sample.length} of {result.fixCount}.
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
