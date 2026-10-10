"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Play,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  SkipForward,
  Trash2,
} from "lucide-react";
import AttackSuiteConfigCard from "./AttackSuiteConfigCard";

/**
 * Admin UI for the Card-Testing Attack Suite.
 *
 * Polls GET /api/simulator/attack-tests every 1500ms while a run is active to
 * stream progress, scenarios, and logs. Never sends card details; this UI is
 * purely a start-button + timeline of results.
 */

interface AttackAssertion {
  label: string;
  passed: boolean;
  detail?: string;
}

interface AttackScenario {
  id: string;
  name: string;
  description: string;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  verdict?: string;
  assertions: AttackAssertion[];
  durationMs?: number;
  errorMessage?: string;
}

interface AttackLog {
  timestamp: string;
  level: "info" | "warn" | "error";
  scenarioId?: string;
  message: string;
}

interface AttackRunDoc {
  _id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  progress: {
    phase: string;
    currentStep: number;
    totalSteps: number;
    percentage: number;
    message: string;
  };
  scenarios: AttackScenario[];
  logs: AttackLog[];
  summary?: { total: number; passed: number; failed: number; skipped: number };
  cleanedUp: boolean;
}

interface AttackRunListItem {
  _id: string;
  status: AttackRunDoc["status"];
  createdAt: string;
  summary?: AttackRunDoc["summary"];
}

interface StatusResponse {
  success: boolean;
  enabled?: boolean;
  secretConfigured?: boolean;
  runs?: AttackRunListItem[];
}

export default function AttackSuitePanel() {
  const [isStarting, setIsStarting] = useState(false);
  const [currentRun, setCurrentRun] = useState<AttackRunDoc | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [secretConfigured, setSecretConfigured] = useState<boolean | null>(null);
  const [recentRuns, setRecentRuns] = useState<AttackRunListItem[]>([]);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRun = useCallback(async (runId: string) => {
    try {
      const res = await fetch(
        `/api/simulator/attack-tests?runId=${encodeURIComponent(runId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { success: boolean; run?: AttackRunDoc };
      if (data.run) setCurrentRun(data.run);
    } catch (err) {
      console.error("AttackSuite run fetch failed:", err);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/simulator/attack-tests", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as StatusResponse;
      setEnabled(data.enabled ?? false);
      setSecretConfigured(data.secretConfigured ?? false);
      setRecentRuns(data.runs ?? []);

      const inFlight = (data.runs ?? []).find(
        (r) => r.status === "running" || r.status === "pending",
      );
      if (inFlight && !currentRun) {
        // Adopt the in-flight run so we start polling it
        await fetchRun(inFlight._id);
      }
    } catch (err) {
      console.error("AttackSuite status fetch failed:", err);
    }
  }, [currentRun, fetchRun]);

  // Initial status load
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll while a run is active
  useEffect(() => {
    if (!currentRun) return;
    if (
      currentRun.status === "completed" ||
      currentRun.status === "failed" ||
      currentRun.status === "cancelled"
    ) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      fetchRun(currentRun._id);
    }, 1500);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [currentRun, fetchRun]);

  const startSuite = async () => {
    setIsStarting(true);
    try {
      const res = await fetch("/api/simulator/attack-tests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to start attack suite");
        return;
      }
      toast.success("Attack suite started");
      await fetchRun(data.runId);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start attack suite",
      );
    } finally {
      setIsStarting(false);
    }
  };

  const cleanupAll = async () => {
    if (!confirm("Wipe all sim-attack-* test data and Redis decline keys?")) {
      return;
    }
    try {
      const res = await fetch("/api/simulator/attack-tests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cleanup-all" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Cleanup failed");
        return;
      }
      toast.success("Cleanup complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cleanup failed");
    }
  };

  const isRunning =
    !!currentRun &&
    (currentRun.status === "running" || currentRun.status === "pending");

  return (
    <div className="space-y-4">
      <AttackSuiteConfigCard
        mutationsLocked={isRunning}
        onChange={(cfg) => {
          setEnabled(cfg.enabled);
          setSecretConfigured(cfg.secretSet);
        }}
      />

      <Card className="bg-gray-900/60 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            Card-Testing Attack Suite
          </CardTitle>
          <CardDescription className="text-gray-400">
            Fires synthetic attacks against our own payment-defense layer to
            prove that rate-limiters, decline-velocity block, webhook HMAC, and
            replay idempotency all still reject card-testing patterns. No card
            numbers are ever entered, generated, or stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {enabled === false && secretConfigured !== null && (
            <div className="rounded border border-amber-700 bg-amber-900/20 p-3 text-amber-200 text-sm">
              The Attack Suite is currently disabled. Use the{" "}
              <strong>Configuration</strong> card above to enable it and
              generate a secret.
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              onClick={startSuite}
              disabled={
                isStarting ||
                isRunning ||
                enabled === false ||
                secretConfigured === false
              }
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isStarting || isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isRunning ? "Running..." : "Starting..."}
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Attack Suite
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={cleanupAll}
              disabled={isRunning}
              className="text-gray-300 border-gray-600 hover:bg-gray-800"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Wipe Test Data
            </Button>
          </div>

          {currentRun && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-300">
                <span>{currentRun.progress.phase}</span>
                <span>
                  {currentRun.progress.currentStep}/
                  {currentRun.progress.totalSteps}
                </span>
              </div>
              <Progress
                value={currentRun.progress.percentage}
                className="h-2"
              />
              <div className="text-xs text-gray-500">
                {currentRun.progress.message}
              </div>

              {currentRun.summary && (
                <div className="flex gap-2 flex-wrap pt-2">
                  <Badge className="bg-emerald-900 text-emerald-200 border-emerald-700">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {currentRun.summary.passed} passed
                  </Badge>
                  <Badge className="bg-red-900 text-red-200 border-red-700">
                    <XCircle className="h-3 w-3 mr-1" />
                    {currentRun.summary.failed} failed
                  </Badge>
                  <Badge className="bg-gray-800 text-gray-300 border-gray-700">
                    <SkipForward className="h-3 w-3 mr-1" />
                    {currentRun.summary.skipped} skipped
                  </Badge>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {currentRun && currentRun.scenarios.length > 0 && (
        <Card className="bg-gray-900/60 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Scenarios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {currentRun.scenarios.map((s) => (
              <div
                key={s.id}
                className="rounded border border-gray-700 bg-gray-800/40 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-100 truncate">
                      {s.name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {s.description}
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                {s.verdict && (
                  <div
                    className={
                      "text-xs mt-2 " +
                      (s.status === "passed"
                        ? "text-emerald-300"
                        : s.status === "failed"
                          ? "text-red-300"
                          : "text-gray-400")
                    }
                  >
                    {s.verdict}
                  </div>
                )}
                {s.assertions.length > 0 && (
                  <ul className="mt-2 text-xs space-y-1">
                    {s.assertions.map((a, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-gray-300"
                      >
                        {a.passed ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
                        )}
                        <span>
                          <span
                            className={
                              a.passed ? "text-gray-300" : "text-red-300"
                            }
                          >
                            {a.label}
                          </span>
                          {a.detail && (
                            <span className="text-gray-500"> — {a.detail}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {s.errorMessage && (
                  <div className="text-xs text-red-400 mt-2">
                    {s.errorMessage}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {currentRun && currentRun.logs.length > 0 && (
        <Card className="bg-gray-900/60 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Live Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64 bg-black/40 rounded border border-gray-700 p-2 font-mono text-xs">
              {currentRun.logs.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.level === "error"
                      ? "text-red-300"
                      : l.level === "warn"
                        ? "text-amber-300"
                        : "text-gray-300"
                  }
                >
                  <span className="text-gray-500">
                    {new Date(l.timestamp).toLocaleTimeString()}
                  </span>{" "}
                  {l.message}
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {recentRuns.length > 0 && !currentRun && (
        <Card className="bg-gray-900/60 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Recent Runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentRuns.slice(0, 5).map((r) => (
              <button
                key={r._id}
                onClick={() => fetchRun(r._id)}
                className="w-full text-left rounded border border-gray-700 bg-gray-800/40 p-3 hover:bg-gray-800/70 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <div className="text-gray-200">
                    {new Date(r.createdAt).toLocaleString()}
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                {r.summary && (
                  <div className="text-xs text-gray-400 mt-1">
                    {r.summary.passed}/{r.summary.total} passed
                    {r.summary.failed > 0 && (
                      <span className="text-red-400">
                        {" "}
                        · {r.summary.failed} failed
                      </span>
                    )}
                    {r.summary.skipped > 0 && (
                      <span className="text-gray-500">
                        {" "}
                        · {r.summary.skipped} skipped
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "pending" | "running" | "passed" | "failed" | "skipped" | "completed" | "cancelled";
}) {
  const map: Record<string, string> = {
    pending: "bg-gray-700 text-gray-200 border-gray-600",
    running: "bg-blue-900 text-blue-200 border-blue-700",
    passed: "bg-emerald-900 text-emerald-200 border-emerald-700",
    completed: "bg-emerald-900 text-emerald-200 border-emerald-700",
    failed: "bg-red-900 text-red-200 border-red-700",
    skipped: "bg-gray-800 text-gray-400 border-gray-700",
    cancelled: "bg-amber-900 text-amber-200 border-amber-700",
  };
  // eslint-disable-next-line security/detect-object-injection -- status is typed to a fixed union of literals
  const cls = map[status] || map.pending;
  return (
    <Badge className={cls}>
      {status.toUpperCase()}
    </Badge>
  );
}
