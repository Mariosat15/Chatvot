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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

const DEFAULTS = {
  olderThanDays: 90,
  deleteOldestCompetitions: 30,
  deleteOldestChallenges: 30,
};

export default function DataCleanupSection() {
  const [olderThanDays, setOlderThanDays] = useState(DEFAULTS.olderThanDays);
  const [deleteCompetitions, setDeleteCompetitions] = useState(
    DEFAULTS.deleteOldestCompetitions
  );
  const [deleteChallenges, setDeleteChallenges] = useState(
    DEFAULTS.deleteOldestChallenges
  );
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<{
    competitionsDeleted: number;
    challengesDeleted: number;
  } | null>(null);

  const runCleanup = async () => {
    setRunning(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/admin/cleanup/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          olderThanDays,
          deleteOldestCompetitions: deleteCompetitions,
          deleteOldestChallenges: deleteChallenges,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Cleanup failed");
        return;
      }
      setLastResult({
        competitionsDeleted: data.competitionsDeleted ?? 0,
        challengesDeleted: data.challengesDeleted ?? 0,
      });
      toast.success(data.message || "Cleanup completed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cleanup failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trash2 className="h-7 w-7 text-amber-400" />
          Data Cleanup
        </h2>
        <p className="text-gray-400 mt-1">
          Delete old completed/cancelled competitions and challenges to keep the
          database lean. Example: every 3 months delete the 30 oldest (older than 90 days).
        </p>
      </div>

      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Run cleanup</CardTitle>
          <CardDescription className="text-gray-400">
            Only completed/cancelled items older than the specified days are
            considered. The &quot;oldest&quot; are deleted first (by end date).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-gray-300">Older than (days)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={olderThanDays}
                onChange={(e) =>
                  setOlderThanDays(Math.max(1, Math.min(365, Number(e.target.value) || 90)))
                }
                className="mt-1 bg-gray-900 border-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">
                e.g. 90 = 3 months
              </p>
            </div>
            <div>
              <Label className="text-gray-300">Delete oldest competitions</Label>
              <Input
                type="number"
                min={0}
                max={500}
                value={deleteCompetitions}
                onChange={(e) =>
                  setDeleteCompetitions(
                    Math.max(0, Math.min(500, Number(e.target.value) || 0))
                  )
                }
                className="mt-1 bg-gray-900 border-gray-600"
              />
            </div>
            <div>
              <Label className="text-gray-300">Delete oldest challenges</Label>
              <Input
                type="number"
                min={0}
                max={500}
                value={deleteChallenges}
                onChange={(e) =>
                  setDeleteChallenges(
                    Math.max(0, Math.min(500, Number(e.target.value) || 0))
                  )
                }
                className="mt-1 bg-gray-900 border-gray-600"
              />
            </div>
          </div>

          {lastResult && (
            <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-sm text-green-200">
              Last run: {lastResult.competitionsDeleted} competitions and{" "}
              {lastResult.challengesDeleted} challenges deleted.
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200/90">
              This permanently deletes competitions, challenges, and their
              participant records. Run manually when you want to clean up; there
              is no automatic schedule.
            </p>
          </div>

          <Button
            onClick={runCleanup}
            disabled={running}
            className="bg-amber-600 hover:bg-amber-500 text-white"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Run cleanup now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
