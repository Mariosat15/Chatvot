"use client";

import { useState } from "react";
import { Wrench, Play, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TaskResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

interface MaintenanceTask {
  id: string;
  label: string;
  description: string;
  endpoint: string;
  method: "POST";
}

const TASKS: MaintenanceTask[] = [
  {
    id: "backfill-ranks",
    label: "Backfill Competition Ranks",
    description:
      "Writes final ranks to all CompetitionParticipant records from completed competitions. Fixes win/podium stats that show as zero. Safe to run multiple times.",
    endpoint: "/api/admin/backfill-ranks",
    method: "POST",
  },
];

export default function DataMaintenanceSection() {
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TaskResult>>({});

  const runTask = async (task: MaintenanceTask) => {
    setRunning(task.id);
    try {
      const res = await fetch(task.endpoint, { method: task.method });
      const data = await res.json();

      const result: TaskResult = {
        success: data.success ?? res.ok,
        message: data.message || (res.ok ? "Completed" : "Failed"),
        details: data.details,
      };

      setResults((prev) => ({ ...prev, [task.id]: result }));

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setResults((prev) => ({
        ...prev,
        [task.id]: { success: false, message: msg },
      }));
      toast.error(msg);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-lime-500/10">
          <Wrench className="h-5 w-5 text-lime-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">
            Data Maintenance
          </h2>
          <p className="text-sm text-gray-400">
            One-time data fixes and backfill operations
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {TASKS.map((task) => {
          const result = results[task.id];
          const isRunning = running === task.id;

          return (
            <div
              key={task.id}
              className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white">{task.label}</h3>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {task.description}
                  </p>
                </div>
                <button
                  onClick={() => runTask(task)}
                  disabled={isRunning}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-lime-500/15 text-lime-400 border border-lime-500/30 hover:bg-lime-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex-shrink-0"
                >
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {isRunning ? "Running..." : "Run"}
                </button>
              </div>

              {result && (
                <div
                  className={`mt-3 rounded-lg p-3 text-sm ${
                    result.success
                      ? "bg-green-500/10 border border-green-500/20"
                      : "bg-red-500/10 border border-red-500/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                    )}
                    <span
                      className={
                        result.success ? "text-green-300" : "text-red-300"
                      }
                    >
                      {result.message}
                    </span>
                  </div>
                  {result.details && (
                    <pre className="mt-2 text-xs text-gray-400 overflow-x-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
