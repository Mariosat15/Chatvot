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
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Wallet,
  Trophy,
  Users,
} from "lucide-react";
import AccountInspectorCard from "./AccountInspectorCard";

// ---- Duplicate-deposit scan types (match /api/simulator/scan-duplicate-deposits)
interface DuplicateGroup {
  key: string;
  count: number;
  userIds: string[];
  totalCredits: number;
  txIds: string[];
}
interface FieldResult {
  field: string;
  duplicateGroups: DuplicateGroup[];
}
interface DupScanResult {
  success: boolean;
  collection?: string;
  clean?: boolean;
  totalDuplicateGroups?: number;
  fields?: FieldResult[];
  checkedAt?: string;
  error?: string;
}

// ---- Win/loss consistency types (match /api/simulator/verify-win-loss)
interface WinLossDivergence {
  userId: string;
  username: string;
  email: string;
  compWon_compStatus: number;
  compWon_partStatus: number;
  podium_compStatus: number;
  podium_partStatus: number;
  challWon_isWinner: number;
  challWon_completedIsWinner: number;
  challWon_winnerId: number;
  partRealizedPnl: number;
  thRealizedPnl: number;
  partWinning: number;
  thWinners: number;
  partLosing: number;
  thLosers: number;
  opens: number;
  closedTrades: number;
  openPositions: number;
  flags: {
    compWinDiff: boolean;
    podiumDiff: boolean;
    challWinDiff: boolean;
    realizedPnlDiff: boolean;
    winnersDiff: boolean;
    losersDiff: boolean;
  };
}
interface AnomalyBucket {
  count: number;
  sample: Array<Record<string, unknown>>;
}
interface WinLossResult {
  success: boolean;
  clean?: boolean;
  totals?: {
    users: number;
    active: number;
    competitions: number;
    challenges: number;
    divergences: number;
  };
  divergences?: WinLossDivergence[];
  divergencesTruncated?: boolean;
  anomalies?: {
    rank1_partNotCompleted: AnomalyBucket;
    isWinner_challNotCompleted: AnomalyBucket;
    winnerId_vs_isWinner_mismatch: AnomalyBucket;
    compCompleted_multipleRank1: AnomalyBucket;
  };
  checkedAt?: string;
  error?: string;
}

export default function DataIntegrityTab() {
  const [dupLoading, setDupLoading] = useState(false);
  const [dupResult, setDupResult] = useState<DupScanResult | null>(null);
  const [wlLoading, setWlLoading] = useState(false);
  const [wlResult, setWlResult] = useState<WinLossResult | null>(null);

  const runDupScan = async () => {
    setDupLoading(true);
    try {
      const res = await fetch("/api/simulator/scan-duplicate-deposits");
      const data: DupScanResult = await res.json();
      if (data.success) {
        setDupResult(data);
        if (data.clean) {
          toast.success("No duplicate deposits found — ledger is clean.");
        } else {
          toast.warning(
            `${data.totalDuplicateGroups} duplicate deposit group(s) found`,
          );
        }
      } else {
        toast.error(data.error || "Scan failed");
      }
    } catch (error) {
      toast.error("Scan failed");
      console.error(error);
    } finally {
      setDupLoading(false);
    }
  };

  const runWinLoss = async () => {
    setWlLoading(true);
    try {
      const res = await fetch("/api/simulator/verify-win-loss");
      const data: WinLossResult = await res.json();
      if (data.success) {
        setWlResult(data);
        if (data.clean) {
          toast.success("Win/loss numbers are consistent across all surfaces.");
        } else {
          toast.warning(
            `${data.totals?.divergences ?? 0} user(s) with divergent numbers`,
          );
        }
      } else {
        toast.error(data.error || "Verification failed");
      }
    } catch (error) {
      toast.error("Verification failed");
      console.error(error);
    } finally {
      setWlLoading(false);
    }
  };

  const anomalyList = wlResult?.anomalies
    ? [
        {
          label: "Rank-1 in completed competition but participant not completed",
          bucket: wlResult.anomalies.rank1_partNotCompleted,
        },
        {
          label: "isWinner=true but challenge not completed",
          bucket: wlResult.anomalies.isWinner_challNotCompleted,
        },
        {
          label: "Completed challenge winnerId vs isWinner mismatch",
          bucket: wlResult.anomalies.winnerId_vs_isWinner_mismatch,
        },
        {
          label: "Completed competitions with multiple rank-1 (ties)",
          bucket: wlResult.anomalies.compCompleted_multipleRank1,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Intro */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="pt-4 pb-4 text-sm text-muted-foreground">
          Read-only integrity checks. They never modify data — they only compare
          the live records against what they should be and report mismatches.
        </CardContent>
      </Card>

      {/* ---- Duplicate Deposit Scan ---- */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Wallet className="h-5 w-5 text-green-400" />
                Duplicate Deposit Scan
              </CardTitle>
              <CardDescription className="text-gray-400">
                Checks whether any single payment credited a wallet more than
                once (a double-credit). A clean result means it is safe to add
                the optional unique index.
              </CardDescription>
            </div>
            <Button
              onClick={runDupScan}
              disabled={dupLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {dupLoading ? (
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
          </div>
        </CardHeader>
        {dupResult && (
          <CardContent>
            {dupResult.clean ? (
              <div className="flex items-center gap-3 rounded-lg bg-green-500/10 border border-green-700 p-4">
                <CheckCircle className="h-6 w-6 text-green-400" />
                <div>
                  <p className="text-green-400 font-medium">
                    No duplicate deposits found
                  </p>
                  <p className="text-xs text-gray-400">
                    Collection: {dupResult.collection} · Checked{" "}
                    {dupResult.checkedAt
                      ? new Date(dupResult.checkedAt).toLocaleString()
                      : ""}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg bg-red-500/10 border border-red-700 p-4">
                  <AlertTriangle className="h-6 w-6 text-red-400" />
                  <p className="text-red-400 font-medium">
                    {dupResult.totalDuplicateGroups} duplicate group(s) found —
                    investigate before adding a unique index.
                  </p>
                </div>
                {dupResult.fields
                  ?.filter((f) => f.duplicateGroups.length > 0)
                  .map((f) => (
                    <div
                      key={f.field}
                      className="border border-gray-700 rounded-lg p-3"
                    >
                      <p className="text-sm text-white font-medium mb-2">
                        Field: <code>{f.field}</code>
                      </p>
                      <div className="space-y-2">
                        {f.duplicateGroups.map((g) => (
                          <div
                            key={g.key}
                            className="bg-gray-900/50 rounded p-2 text-xs"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className="border-red-700 text-red-400"
                              >
                                ×{g.count}
                              </Badge>
                              <code className="text-gray-300">{g.key}</code>
                              <span className="text-gray-500">
                                credits={g.totalCredits}
                              </span>
                            </div>
                            <p className="text-gray-500 mt-1">
                              users: {g.userIds.join(", ")}
                            </p>
                            <p className="text-gray-600 break-all">
                              txIds: {g.txIds.join(", ")}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ---- Win/Loss Consistency ---- */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-400" />
                Win / Loss Consistency
              </CardTitle>
              <CardDescription className="text-gray-400">
                Recomputes each user&apos;s wins, podiums and{" "}
                <span className="text-gray-300">realized</span> P&amp;L / trade
                counts from the raw data and flags genuine mismatches. Compares
                like-for-like (realized-to-realized), so open positions and
                unrealized P&amp;L don&apos;t cause false alarms.
              </CardDescription>
            </div>
            <Button
              onClick={runWinLoss}
              disabled={wlLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {wlLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Verification
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        {wlResult && (
          <CardContent className="space-y-4">
            {/* Totals */}
            {wlResult.totals && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Stat label="Users" value={wlResult.totals.users} icon={<Users className="h-4 w-4 text-blue-400" />} />
                <Stat label="Active" value={wlResult.totals.active} icon={<Users className="h-4 w-4 text-green-400" />} />
                <Stat label="Competitions" value={wlResult.totals.competitions} icon={<Trophy className="h-4 w-4 text-amber-400" />} />
                <Stat label="Challenges" value={wlResult.totals.challenges} icon={<Trophy className="h-4 w-4 text-purple-400" />} />
                <Stat
                  label="Divergences"
                  value={wlResult.totals.divergences}
                  icon={
                    wlResult.totals.divergences > 0 ? (
                      <XCircle className="h-4 w-4 text-red-400" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    )
                  }
                />
              </div>
            )}

            {wlResult.clean ? (
              <div className="flex items-center gap-3 rounded-lg bg-green-500/10 border border-green-700 p-4">
                <CheckCircle className="h-6 w-6 text-green-400" />
                <p className="text-green-400 font-medium">
                  Every surface produces identical win/loss/participation numbers.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-red-400 font-medium">
                  Divergent users
                  {wlResult.divergencesTruncated ? " (showing first 50)" : ""}:
                </p>
                <ScrollArea className="max-h-[320px]">
                  <div className="space-y-2">
                    {wlResult.divergences?.map((d) => (
                      <div
                        key={d.userId}
                        className="bg-gray-900/50 border border-gray-700 rounded p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-white font-medium">
                            {d.username || d.email || d.userId}
                          </p>
                          {d.openPositions > 0 && (
                            <Badge
                              variant="outline"
                              className="border-blue-700 text-blue-400"
                            >
                              {d.openPositions} open position
                              {d.openPositions === 1 ? "" : "s"}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {d.flags.compWinDiff && (
                            <Badge variant="outline" className="border-red-700 text-red-400">
                              comp win {d.compWon_compStatus}≠{d.compWon_partStatus}
                            </Badge>
                          )}
                          {d.flags.podiumDiff && (
                            <Badge variant="outline" className="border-red-700 text-red-400">
                              podium {d.podium_compStatus}≠{d.podium_partStatus}
                            </Badge>
                          )}
                          {d.flags.challWinDiff && (
                            <Badge variant="outline" className="border-red-700 text-red-400">
                              chall win {d.challWon_isWinner}/{d.challWon_completedIsWinner}/{d.challWon_winnerId}
                            </Badge>
                          )}
                          {d.flags.realizedPnlDiff && (
                            <Badge variant="outline" className="border-red-700 text-red-400">
                              realized PnL {d.partRealizedPnl}≠{d.thRealizedPnl}
                            </Badge>
                          )}
                          {d.flags.winnersDiff && (
                            <Badge variant="outline" className="border-red-700 text-red-400">
                              wins {d.partWinning}≠{d.thWinners}
                            </Badge>
                          )}
                          {d.flags.losersDiff && (
                            <Badge variant="outline" className="border-red-700 text-red-400">
                              losses {d.partLosing}≠{d.thLosers}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Raw-data anomalies */}
            {anomalyList.length > 0 && (
              <div className="border-t border-gray-700 pt-3 space-y-2">
                <p className="text-sm text-gray-300 font-medium">
                  Raw-data anomalies
                </p>
                {anomalyList.map((a) => (
                  <div
                    key={a.label}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-gray-400">{a.label}</span>
                    <Badge
                      variant="outline"
                      className={
                        a.bucket.count > 0
                          ? "border-yellow-700 text-yellow-400"
                          : "border-green-700 text-green-400"
                      }
                    >
                      {a.bucket.count}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ---- Account Inspector ---- */}
      <AccountInspectorCard />
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="text-xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}
