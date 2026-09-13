"use client";

import { useState, useEffect, useCallback } from "react";
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
  AlertCircle,
  Loader2,
  RefreshCw,
  Clock,
  Calendar,
  FlaskConical,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react";

interface TestSuite {
  name: string;
  path: string;
  relativePath: string;
}

interface TestResult {
  name: string;
  suite: string;
  status: "passed" | "failed" | "skipped";
  duration: number;
  error?: string;
}

interface TestRun {
  _id: string;
  status: "pending" | "running" | "passed" | "failed" | "error";
  trigger: "manual" | "scheduled" | "ci";
  startedAt: string;
  completedAt?: string;
  duration?: number;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  testResults?: TestResult[];
  errorMessage?: string;
  triggeredBy?: string;
  suites?: string[];
}

interface TestSchedule {
  _id: string;
  frequency: "manual" | "weekly" | "monthly";
  dayOfWeek: number;
  dayOfMonth: number;
  timeOfDay: string;
  timezone: string;
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  suites?: string[];
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function UnitTestsTab() {
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [schedule, setSchedule] = useState<TestSchedule | null>(null);
  const [activeRun, setActiveRun] = useState<TestRun | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const fetchSuites = useCallback(async () => {
    try {
      const res = await fetch("/api/tests/suites");
      const data = await res.json();
      if (data.success) setSuites(data.suites || []);
    } catch {
      // Suites not available
    }
  }, []);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/tests/runs?limit=20");
      const data = await res.json();
      if (data.success) {
        setRuns(data.runs || []);
        const running = (data.runs || []).find((r: TestRun) => r.status === "running");
        if (running) {
          setIsRunning(true);
          setActiveRun(running);
        }
      }
    } catch {
      // Runs not available
    }
  }, []);

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch("/api/tests/schedule");
      const data = await res.json();
      if (data.success) setSchedule(data.schedule);
    } catch {
      // Schedule not available
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchSuites(), fetchRuns(), fetchSchedule()]).finally(() =>
      setLoading(false),
    );
  }, [fetchSuites, fetchRuns, fetchSchedule]);

  // Poll for running test status
  useEffect(() => {
    if (!isRunning || !activeRun) return undefined;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tests/runs/${activeRun._id}`);
        const data = await res.json();
        if (data.success && data.run) {
          if (data.run.status !== "running") {
            setIsRunning(false);
            setActiveRun(null);
            fetchRuns();
            if (data.run.status === "passed") {
              toast.success(`Tests passed! ${data.run.passed}/${data.run.totalTests}`);
            } else if (data.run.status === "failed") {
              toast.error(`Tests failed: ${data.run.failed} failures`);
            } else {
              toast.error("Test run encountered an error");
            }
          }
        }
      } catch {
        // Poll error, will retry
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isRunning, activeRun, fetchRuns]);

  const startTestRun = async () => {
    try {
      setIsRunning(true);
      const res = await fetch("/api/tests/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggeredBy: "admin" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Test run started");
        setActiveRun({ _id: data.runId, status: "running" } as TestRun);
        fetchRuns();
      } else {
        toast.error(data.error || "Failed to start tests");
        setIsRunning(false);
      }
    } catch {
      toast.error("Failed to start test run");
      setIsRunning(false);
    }
  };

  const deleteRun = async (runId: string) => {
    try {
      const res = await fetch(`/api/tests/runs/${runId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Test run deleted");
        fetchRuns();
      }
    } catch {
      toast.error("Failed to delete run");
    }
  };

  const toggleRunDetails = async (runId: string) => {
    if (expandedRun === runId) {
      setExpandedRun(null);
      return;
    }
    try {
      const res = await fetch(`/api/tests/runs/${runId}`);
      const data = await res.json();
      if (data.success && data.run) {
        setRuns((prev) =>
          prev.map((r) => (r._id === runId ? { ...r, testResults: data.run.testResults } : r)),
        );
        setExpandedRun(runId);
      }
    } catch {
      toast.error("Failed to load test details");
    }
  };

  const saveSchedule = async (updates: Partial<TestSchedule>) => {
    setSavingSchedule(true);
    try {
      const res = await fetch("/api/tests/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...schedule, ...updates }),
      });
      const data = await res.json();
      if (data.success) {
        setSchedule(data.schedule);
        toast.success("Schedule saved");
      } else {
        toast.error(data.error || "Failed to save schedule");
      }
    } catch {
      toast.error("Failed to save schedule");
    } finally {
      setSavingSchedule(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const latestRun = runs[0];

  return (
    <div className="space-y-6">
      {/* Run Tests Section */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-blue-400" />
                Unit Tests
              </CardTitle>
              <CardDescription className="text-gray-400">
                {suites.length} test suite{suites.length !== 1 ? "s" : ""} available
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  fetchRuns();
                  fetchSuites();
                }}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button
                onClick={startTestRun}
                disabled={isRunning}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run All Tests
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Test Suites Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {suites.map((suite) => (
              <div
                key={suite.relativePath}
                className="bg-gray-900/50 border border-gray-700 rounded-lg p-3"
              >
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-gray-400" />
                  <span className="text-white font-medium text-sm">{suite.name}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 font-mono">{suite.relativePath}</p>
              </div>
            ))}
            {suites.length === 0 && (
              <p className="text-gray-500 text-sm col-span-3">
                No test files found in __tests__/ directory
              </p>
            )}
          </div>

          {/* Latest Run Summary */}
          {latestRun && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusIcon status={latestRun.status} />
                  <div>
                    <span className="text-white font-medium text-sm">Last run</span>
                    <p className="text-xs text-gray-400">
                      {new Date(latestRun.startedAt).toLocaleString()}
                      {latestRun.duration && ` (${(latestRun.duration / 1000).toFixed(1)}s)`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {latestRun.passed > 0 && (
                    <Badge variant="outline" className="border-green-700 text-green-400">
                      {latestRun.passed} passed
                    </Badge>
                  )}
                  {latestRun.failed > 0 && (
                    <Badge variant="outline" className="border-red-700 text-red-400">
                      {latestRun.failed} failed
                    </Badge>
                  )}
                  {latestRun.skipped > 0 && (
                    <Badge variant="outline" className="border-yellow-700 text-yellow-400">
                      {latestRun.skipped} skipped
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Section */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-400" />
            Test Schedule
          </CardTitle>
          <CardDescription className="text-gray-400">
            Configure automatic test execution
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schedule && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-300 w-24">Frequency</label>
                <select
                  value={schedule.frequency}
                  onChange={(e) =>
                    saveSchedule({ frequency: e.target.value as TestSchedule["frequency"] })
                  }
                  className="bg-gray-900 border border-gray-600 text-white rounded px-3 py-1.5 text-sm"
                >
                  <option value="manual">Manual Only</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {schedule.frequency === "weekly" && (
                <div className="flex items-center gap-4">
                  <label className="text-sm text-gray-300 w-24">Day</label>
                  <select
                    value={schedule.dayOfWeek}
                    onChange={(e) => saveSchedule({ dayOfWeek: parseInt(e.target.value) })}
                    className="bg-gray-900 border border-gray-600 text-white rounded px-3 py-1.5 text-sm"
                  >
                    {DAY_NAMES.map((day, i) => (
                      <option key={day} value={i}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {schedule.frequency === "monthly" && (
                <div className="flex items-center gap-4">
                  <label className="text-sm text-gray-300 w-24">Day of Month</label>
                  <select
                    value={schedule.dayOfMonth}
                    onChange={(e) => saveSchedule({ dayOfMonth: parseInt(e.target.value) })}
                    className="bg-gray-900 border border-gray-600 text-white rounded px-3 py-1.5 text-sm"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {schedule.frequency !== "manual" && (
                <>
                  <div className="flex items-center gap-4">
                    <label className="text-sm text-gray-300 w-24">Time (UTC)</label>
                    <input
                      type="time"
                      value={schedule.timeOfDay}
                      onChange={(e) => saveSchedule({ timeOfDay: e.target.value })}
                      className="bg-gray-900 border border-gray-600 text-white rounded px-3 py-1.5 text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="text-sm text-gray-300 w-24">Active</label>
                    <button
                      onClick={() => saveSchedule({ isActive: !schedule.isActive })}
                      disabled={savingSchedule}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        schedule.isActive ? "bg-blue-600" : "bg-gray-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          schedule.isActive ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {schedule.nextRunAt && (
                    <div className="flex items-center gap-2 text-sm text-gray-400 mt-2">
                      <Clock className="h-4 w-4" />
                      Next run: {new Date(schedule.nextRunAt).toLocaleString()}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Section */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-400" />
            Test History
          </CardTitle>
          <CardDescription className="text-gray-400">
            {runs.length} recent test run{runs.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-2">
              {runs.map((run) => (
                <div key={run._id} className="border border-gray-700 rounded-lg overflow-hidden">
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-900/50 transition-colors"
                    onClick={() => toggleRunDetails(run._id)}
                  >
                    <div className="flex items-center gap-3">
                      {expandedRun === run._id ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                      <StatusIcon status={run.status} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">
                            {new Date(run.startedAt).toLocaleDateString()}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {new Date(run.startedAt).toLocaleTimeString()}
                          </span>
                          <Badge variant="outline" className="border-gray-600 text-gray-400 text-xs">
                            {run.trigger}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {run.totalTests > 0 && (
                            <span className="text-xs text-gray-400">
                              {run.passed}/{run.totalTests} passed
                            </span>
                          )}
                          {run.duration != null && (
                            <span className="text-xs text-gray-500">
                              {(run.duration / 1000).toFixed(1)}s
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRun(run._id);
                      }}
                      className="text-gray-500 hover:text-red-400 h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Expanded details */}
                  {expandedRun === run._id && run.testResults && (
                    <div className="border-t border-gray-700 px-4 py-3 bg-gray-900/30">
                      {run.testResults.length > 0 ? (
                        <div className="space-y-1.5">
                          {run.testResults.map((test, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <StatusIcon status={test.status} size="sm" />
                              <div className="flex-1 min-w-0">
                                <span className="text-gray-300">{test.name}</span>
                                <span className="text-gray-600 text-xs ml-2">
                                  ({test.duration}ms)
                                </span>
                                {test.error && (
                                  <pre className="text-red-400 text-xs mt-1 whitespace-pre-wrap font-mono bg-red-950/20 p-2 rounded">
                                    {test.error.slice(0, 500)}
                                  </pre>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">
                          {run.errorMessage || "No test results available"}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {runs.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-8">
                  No test runs yet. Click &quot;Run All Tests&quot; to start.
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusIcon({
  status,
  size = "md",
}: {
  status: string;
  size?: "sm" | "md";
}) {
  const cls = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  switch (status) {
    case "passed":
      return <CheckCircle className={`${cls} text-green-400`} />;
    case "failed":
      return <XCircle className={`${cls} text-red-400`} />;
    case "running":
      return <Loader2 className={`${cls} text-blue-400 animate-spin`} />;
    case "skipped":
      return <AlertCircle className={`${cls} text-yellow-400`} />;
    case "error":
      return <AlertCircle className={`${cls} text-red-400`} />;
    default:
      return <Clock className={`${cls} text-gray-400`} />;
  }
}
