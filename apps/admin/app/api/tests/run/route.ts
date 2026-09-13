import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import TestRun from "@/database/models/test-run.model";
import { exec } from "child_process";
import path from "path";

/**
 * POST /api/tests/run
 * Trigger a test run. Spawns vitest in the monorepo root and stores results.
 * Body: { suites?: string[], triggeredBy?: string }
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json().catch(() => ({}));
    const { suites, triggeredBy } = body as {
      suites?: string[];
      triggeredBy?: string;
    };

    // Check for already-running test
    const running = await TestRun.findOne({ status: "running" });
    if (running) {
      return NextResponse.json(
        { success: false, error: "A test run is already in progress" },
        { status: 409 },
      );
    }

    const run = await TestRun.create({
      status: "running",
      trigger: triggeredBy ? "manual" : "scheduled",
      startedAt: new Date(),
      triggeredBy,
      suites: suites || [],
    });

    // Reason: Resolve to the monorepo root where vitest.config.ts lives.
    const rootDir = path.resolve(process.cwd(), "..", "..");

    let command = "npx vitest run --reporter=json";
    if (suites && suites.length > 0) {
      const suitePaths = suites.map((s) => `__tests__/**/${s}*`).join(" ");
      command = `npx vitest run --reporter=json ${suitePaths}`;
    }

    executeTests(run._id.toString(), command, rootDir);

    return NextResponse.json({
      success: true,
      runId: run._id,
      message: "Test run started",
    });
  } catch (error) {
    console.error("Error starting test run:", error);
    return NextResponse.json(
      { success: false, error: "Failed to start test run" },
      { status: 500 },
    );
  }
}

/**
 * Run vitest in background and update the TestRun document when done.
 * Runs asynchronously — the API returns immediately with the run ID.
 */
async function executeTests(
  runId: string,
  command: string,
  cwd: string,
): Promise<void> {
  const { connectToDatabase: ensureDb } = await import("@/database/mongoose");
  const TestRunModel = (await import("@/database/models/test-run.model")).default;

  exec(command, { cwd, timeout: 120_000, env: { ...process.env, NODE_ENV: "test" } }, async (error, stdout, stderr) => {
    try {
      await ensureDb();

      const completedAt = new Date();
      const run = await TestRunModel.findById(runId);
      if (!run) return;

      const startTime = run.startedAt?.getTime() || Date.now();
      const duration = completedAt.getTime() - startTime;

      let parsed: VitestJsonOutput | null = null;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        // vitest may output non-JSON lines before the JSON blob
        const jsonStart = stdout.indexOf("{");
        if (jsonStart >= 0) {
          try {
            parsed = JSON.parse(stdout.slice(jsonStart));
          } catch {
            // Could not parse
          }
        }
      }

      if (parsed && parsed.testResults) {
        const testResults = parsed.testResults.flatMap((file) =>
          (file.assertionResults || []).map((t) => ({
            name: t.fullName || t.title || "unknown",
            suite: file.name?.split("/").pop()?.replace(/\.(test|spec)\.\w+$/, "") || "unknown",
            status: t.status === "passed" ? "passed" as const : t.status === "failed" ? "failed" as const : "skipped" as const,
            duration: t.duration || 0,
            error: t.failureMessages?.join("\n"),
          })),
        );

        const passed = testResults.filter((t) => t.status === "passed").length;
        const failed = testResults.filter((t) => t.status === "failed").length;
        const skipped = testResults.filter((t) => t.status === "skipped").length;

        run.status = failed > 0 ? "failed" : "passed";
        run.testResults = testResults;
        run.totalTests = testResults.length;
        run.passed = passed;
        run.failed = failed;
        run.skipped = skipped;
      } else if (error) {
        run.status = "error";
        run.errorMessage = error.message || stderr || "Test execution failed";
      } else {
        run.status = "passed";
        run.totalTests = 0;
      }

      run.completedAt = completedAt;
      run.duration = duration;
      run.rawOutput = stdout.slice(0, 50_000);
      await run.save();
    } catch (saveError) {
      console.error("Error saving test results:", saveError);
    }
  });
}

interface VitestJsonOutput {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  testResults: {
    name?: string;
    assertionResults: {
      fullName?: string;
      title?: string;
      status: string;
      duration?: number;
      failureMessages?: string[];
    }[];
  }[];
}
