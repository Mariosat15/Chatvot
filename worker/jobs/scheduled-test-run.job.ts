import { connectToDatabase } from "../config/database";
import { exec } from "child_process";
import path from "path";

interface TestRunResult {
  ran: boolean;
  runId?: string;
  status?: string;
  passed?: number;
  failed?: number;
  totalTests?: number;
  error?: string;
}

/**
 * Check if a scheduled test run is due and execute it.
 * Called periodically by Agenda (every 5 minutes).
 * Only runs tests when the schedule's nextRunAt has passed.
 */
export async function runScheduledTests(): Promise<TestRunResult> {
  await connectToDatabase();

  const TestSchedule = (await import("../../database/models/test-schedule.model")).default;
  const TestRun = (await import("../../database/models/test-run.model")).default;

  const schedule = await TestSchedule.findOne({ isActive: true });
  if (!schedule || schedule.frequency === "manual") {
    return { ran: false };
  }

  if (!schedule.nextRunAt || new Date(schedule.nextRunAt) > new Date()) {
    return { ran: false };
  }

  // Check if a test is already running
  const running = await TestRun.findOne({ status: "running" });
  if (running) {
    return { ran: false, error: "Test already running" };
  }

  console.log("🧪 [SCHEDULED TEST] Starting scheduled test run...");

  const run = await TestRun.create({
    status: "running",
    trigger: "scheduled",
    startedAt: new Date(),
    scheduleId: schedule._id.toString(),
    suites: schedule.suites || [],
  });

  // Reason: The monorepo root is two levels up from the worker directory.
  const rootDir = path.resolve(__dirname, "..", "..");
  const command = "npx vitest run --reporter=json";

  return new Promise<TestRunResult>((resolve) => {
    exec(command, { cwd: rootDir, timeout: 120_000, env: { ...process.env, NODE_ENV: "test" } }, async (error, stdout) => {
      try {
        await connectToDatabase();

        const completedAt = new Date();
        const duration = completedAt.getTime() - run.startedAt.getTime();

        let parsed: any = null;
        try {
          parsed = JSON.parse(stdout);
        } catch {
          const jsonStart = stdout.indexOf("{");
          if (jsonStart >= 0) {
            try { parsed = JSON.parse(stdout.slice(jsonStart)); } catch { /* noop */ }
          }
        }

        if (parsed?.testResults) {
          const testResults = parsed.testResults.flatMap((file: any) =>
            (file.assertionResults || []).map((t: any) => ({
              name: t.fullName || t.title || "unknown",
              suite: file.name?.split("/").pop()?.replace(/\.(test|spec)\.\w+$/, "") || "unknown",
              status: t.status === "passed" ? "passed" : t.status === "failed" ? "failed" : "skipped",
              duration: t.duration || 0,
              error: t.failureMessages?.join("\n"),
            })),
          );

          const passed = testResults.filter((t: any) => t.status === "passed").length;
          const failed = testResults.filter((t: any) => t.status === "failed").length;
          const skipped = testResults.filter((t: any) => t.status === "skipped").length;

          run.status = failed > 0 ? "failed" : "passed";
          run.testResults = testResults;
          run.totalTests = testResults.length;
          run.passed = passed;
          run.failed = failed;
          run.skipped = skipped;
        } else if (error) {
          run.status = "error";
          run.errorMessage = error.message || "Test execution failed";
        } else {
          run.status = "passed";
          run.totalTests = 0;
        }

        run.completedAt = completedAt;
        run.duration = duration;
        run.rawOutput = stdout.slice(0, 50_000);
        await run.save();

        // Update schedule timestamps and compute next run
        schedule.lastRunAt = new Date();
        schedule.nextRunAt = computeNextRun(schedule);
        await schedule.save();

        console.log(`🧪 [SCHEDULED TEST] Completed: ${run.status} (${run.passed}/${run.totalTests} passed)`);

        resolve({
          ran: true,
          runId: run._id.toString(),
          status: run.status,
          passed: run.passed,
          failed: run.failed,
          totalTests: run.totalTests,
        });
      } catch (saveErr) {
        console.error("🧪 [SCHEDULED TEST] Error saving results:", saveErr);
        resolve({ ran: true, error: String(saveErr) });
      }
    });
  });
}

function computeNextRun(config: {
  frequency?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay?: string;
}): Date {
  const now = new Date();
  const [hours, minutes] = (config.timeOfDay || "00:00").split(":").map(Number);
  const next = new Date(now);
  next.setUTCHours(hours, minutes, 0, 0);

  if (config.frequency === "weekly") {
    const targetDay = config.dayOfWeek ?? 0;
    const currentDay = next.getUTCDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    next.setUTCDate(next.getUTCDate() + daysUntil);
  } else if (config.frequency === "monthly") {
    const targetDay = config.dayOfMonth ?? 1;
    next.setUTCMonth(next.getUTCMonth() + 1);
    next.setUTCDate(targetDay);
  }

  return next;
}
