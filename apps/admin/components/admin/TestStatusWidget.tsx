"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FlaskConical,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  Loader2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface LatestRun {
  _id: string;
  status: "pending" | "running" | "passed" | "failed" | "error";
  startedAt: string;
  completedAt?: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration?: number;
  trigger: string;
}

interface Schedule {
  frequency: string;
  nextRunAt?: string;
  isActive: boolean;
}

interface TestStatusWidgetProps {
  onNavigate?: (section: string) => void;
}

export default function TestStatusWidget({ onNavigate }: TestStatusWidgetProps) {
  const [latestRun, setLatestRun] = useState<LatestRun | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [runsRes, schedRes] = await Promise.all([
        fetch("/api/tests/runs?limit=1"),
        fetch("/api/tests/schedule"),
      ]);
      const [runsData, schedData] = await Promise.all([
        runsRes.json(),
        schedRes.json(),
      ]);
      if (runsData.success && runsData.runs?.[0]) {
        setLatestRun(runsData.runs[0]);
        setIsRunning(runsData.runs[0].status === "running");
      }
      if (schedData.success) setSchedule(schedData.schedule);
    } catch {
      // Widget is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRunTests = async () => {
    try {
      setIsRunning(true);
      const res = await fetch("/api/tests/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggeredBy: "admin-dashboard" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Test run started");
        setTimeout(fetchData, 5000);
      } else {
        toast.error(data.error || "Failed to start tests");
        setIsRunning(false);
      }
    } catch {
      toast.error("Failed to start test run");
      setIsRunning(false);
    }
  };

  const statusColor = !latestRun
    ? "text-gray-400"
    : latestRun.status === "passed"
      ? "text-green-400"
      : latestRun.status === "failed"
        ? "text-red-400"
        : latestRun.status === "running"
          ? "text-blue-400"
          : "text-yellow-400";

  const StatusIcon = !latestRun
    ? AlertCircle
    : latestRun.status === "passed"
      ? CheckCircle
      : latestRun.status === "failed"
        ? XCircle
        : latestRun.status === "running"
          ? Loader2
          : AlertCircle;

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-blue-400" />
            Unit Tests
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRunTests}
            disabled={isRunning}
            className="h-7 px-2 text-xs"
          >
            {isRunning ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="flex justify-center py-3">
            <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
          </div>
        ) : latestRun ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <StatusIcon
                className={`h-5 w-5 ${statusColor} ${latestRun.status === "running" ? "animate-spin" : ""}`}
              />
              <span className={`text-sm font-medium ${statusColor}`}>
                {latestRun.status === "passed"
                  ? "All Tests Passed"
                  : latestRun.status === "failed"
                    ? `${latestRun.failed} Test${latestRun.failed !== 1 ? "s" : ""} Failed`
                    : latestRun.status === "running"
                      ? "Running..."
                      : latestRun.status === "error"
                        ? "Error"
                        : "Pending"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {latestRun.totalTests > 0 && (
                <span>
                  {latestRun.passed}/{latestRun.totalTests} passed
                </span>
              )}
              {latestRun.duration != null && (
                <span>({(latestRun.duration / 1000).toFixed(1)}s)</span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {new Date(latestRun.startedAt).toLocaleDateString()}{" "}
              {new Date(latestRun.startedAt).toLocaleTimeString()}
            </p>
            {schedule?.isActive && schedule.nextRunAt && (
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                <Clock className="h-3 w-3" />
                Next: {new Date(schedule.nextRunAt).toLocaleDateString()}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-xs text-gray-500">No test runs yet</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRunTests}
              disabled={isRunning}
              className="mt-1 text-xs text-blue-400 hover:text-blue-300"
            >
              Run first test
            </Button>
          </div>
        )}
        <Button
          variant="link"
          size="sm"
          className="text-xs text-gray-500 hover:text-gray-300 p-0 h-auto mt-2"
          onClick={() => onNavigate?.("performance-simulator")}
        >
          View all tests →
        </Button>
      </CardContent>
    </Card>
  );
}
