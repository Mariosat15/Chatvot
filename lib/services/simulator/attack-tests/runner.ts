/**
 * Attack suite runner.
 *
 * Invoked from the admin kickoff route *after* admin auth succeeds. Runs each
 * scenario sequentially, streams logs into the persisted AttackRun document,
 * and always attempts cleanup in a `finally` block — even on crash.
 *
 * The runner itself never touches wallets, users, or transactions directly.
 * It calls the attack API endpoints over HTTP so the real defense layer is
 * exercised end-to-end.
 */

// Reason: use relative imports instead of the @/ alias so this module resolves
// correctly when bundled by both the main app (root-level @/) and the admin
// app (apps/admin/-level @/).
import AttackRun from "../../../../database/models/simulator/attack-run.model";
import type {
  IAttackRun,
  IAttackRunLog,
  IAttackScenarioResult,
} from "../../../../database/models/simulator/attack-run.model";
import { connectToDatabase } from "../../../../database/mongoose";
import {
  ALL_SCENARIOS,
  type AttackScenarioContext,
} from "./scenarios";

const LOG_FLUSH_INTERVAL_MS = 750;
const MAX_STORED_LOGS = 500;

export interface RunAttackSuiteOptions {
  runId: string;
  baseUrl: string;
  attackSecret: string;
}

export interface RunAttackSuiteResult {
  runId: string;
  status: IAttackRun["status"];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

/**
 * Create a fresh attack run document. Used by the admin kickoff route so it
 * can return the runId immediately and stream progress asynchronously.
 */
export async function createAttackRun(initiatedBy?: {
  adminId: string;
  email: string;
  name?: string;
}): Promise<IAttackRun> {
  await connectToDatabase();
  const run = await AttackRun.create({
    status: "pending",
    progress: {
      phase: "Initializing",
      currentStep: 0,
      totalSteps: ALL_SCENARIOS.length,
      percentage: 0,
      message: "Waiting to start attack suite...",
    },
    scenarios: [],
    logs: [],
    testUserIds: [],
    testIps: [],
    initiatedBy,
    cleanedUp: false,
  });
  return run;
}

/**
 * Fire and forget (caller should not await). Runs all scenarios, persists
 * results, performs cleanup. Swallows and logs errors.
 */
export async function runAttackSuite(
  opts: RunAttackSuiteOptions,
): Promise<RunAttackSuiteResult> {
  await connectToDatabase();

  const run = await AttackRun.findById(opts.runId);
  if (!run) {
    throw new Error(`AttackRun ${opts.runId} not found`);
  }

  const testUserIds = new Set<string>();
  const testIps = new Set<string>();
  const transactionIds = new Set<string>();

  // Buffered log writer — we only flush to Mongo every ~750ms to avoid a write
  // per log line during bursty scenarios.
  let pendingLogs: IAttackRunLog[] = [];
  let lastFlushAt = 0;
  const flushLogs = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFlushAt < LOG_FLUSH_INTERVAL_MS) return;
    if (pendingLogs.length === 0) return;
    const batch = pendingLogs;
    pendingLogs = [];
    lastFlushAt = now;
    try {
      await AttackRun.updateOne(
        { _id: opts.runId },
        {
          $push: {
            logs: {
              $each: batch,
              $slice: -MAX_STORED_LOGS,
            },
          },
        },
      );
    } catch (err) {
      console.error("AttackRun log flush failed:", err);
    }
  };

  const log: AttackScenarioContext["log"] = async (level, message, scenarioId) => {
    const entry: IAttackRunLog = {
      timestamp: new Date(),
      level,
      scenarioId,
      message,
    };
    pendingLogs.push(entry);
    // Console mirror for server-side visibility during dev
    const prefix = `[attack-run ${opts.runId}]`;
    if (level === "error") console.error(prefix, message);
    else if (level === "warn") console.warn(prefix, message);
    else console.log(prefix, message);
    await flushLogs(false);
  };

  const ctx: AttackScenarioContext = {
    baseUrl: opts.baseUrl,
    attackSecret: opts.attackSecret,
    log,
    registerTestUser: (id) => testUserIds.add(id),
    registerTestIp: (ip) => testIps.add(ip),
    registerTransaction: (tx) => transactionIds.add(tx),
  };

  run.status = "running";
  run.startTime = new Date();
  run.progress.phase = "Running attack scenarios";
  run.progress.totalSteps = ALL_SCENARIOS.length;
  run.progress.currentStep = 0;
  run.progress.percentage = 0;
  run.progress.message = "Executing scenarios sequentially...";
  await run.save();

  const scenarioResults: IAttackScenarioResult[] = [];

  try {
    await log("info", `Starting attack suite (${ALL_SCENARIOS.length} scenarios)`);

    for (let i = 0; i < ALL_SCENARIOS.length; i++) {
      // eslint-disable-next-line security/detect-object-injection -- i is a loop counter bounded by ALL_SCENARIOS.length
      const scenario = ALL_SCENARIOS[i];
      const stepNumber = i + 1;

      run.progress.currentStep = stepNumber;
      run.progress.percentage = Math.round(
        ((stepNumber - 1) / ALL_SCENARIOS.length) * 100,
      );
      run.progress.message = `Running scenario ${stepNumber}/${ALL_SCENARIOS.length}`;
      await run.save();

      await log("info", `→ Scenario ${stepNumber}/${ALL_SCENARIOS.length}`);

      let result: IAttackScenarioResult;
      try {
        result = await scenario(ctx);
      } catch (err) {
        await log(
          "error",
          `Scenario ${stepNumber} threw: ${err instanceof Error ? err.message : String(err)}`,
        );
        result = {
          id: `scenario_${stepNumber}_crashed`,
          name: `Scenario ${stepNumber}`,
          description: "Scenario threw unexpectedly",
          status: "failed",
          assertions: [],
          verdict: "FAIL (scenario crashed)",
          errorMessage: err instanceof Error ? err.message : String(err),
          startTime: new Date(),
          endTime: new Date(),
          durationMs: 0,
        };
      }

      scenarioResults.push(result);
      await log(
        result.status === "passed" ? "info" : result.status === "skipped" ? "warn" : "error",
        `← ${result.name}: ${result.verdict ?? result.status}`,
        result.id,
      );

      run.scenarios = scenarioResults;
      await run.save();
    }

    run.progress.currentStep = ALL_SCENARIOS.length;
    run.progress.percentage = 100;
    run.progress.phase = "Finalizing";
    run.progress.message = "Scenarios complete. Cleaning up test data...";
    await run.save();
  } catch (err) {
    await log(
      "error",
      `Fatal error during attack suite: ${err instanceof Error ? err.message : String(err)}`,
    );
    run.status = "failed";
  } finally {
    // Always attempt cleanup — otherwise a crashed run leaves test users and
    // Redis keys lying around. The cleanup endpoint is idempotent.
    try {
      run.testUserIds = Array.from(testUserIds);
      run.testIps = Array.from(testIps);
      await run.save();

      await log("info", "Running cleanup for test users, transactions, and Redis keys");

      const cleanupRes = await fetch(
        `${opts.baseUrl}/api/simulator/attack/cleanup`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-simulator-attack-secret": opts.attackSecret,
            "x-forwarded-for": "127.0.0.1",
          },
          body: JSON.stringify({
            userIds: Array.from(testUserIds),
            ips: Array.from(testIps),
            transactionIds: Array.from(transactionIds),
          }),
        },
      );
      const cleanupBody = await cleanupRes.text();
      await log(
        cleanupRes.ok ? "info" : "warn",
        `Cleanup response (${cleanupRes.status}): ${cleanupBody.slice(0, 200)}`,
      );
      run.cleanedUp = cleanupRes.ok;
      run.cleanedUpAt = new Date();
    } catch (cleanupErr) {
      await log(
        "error",
        `Cleanup failed: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`,
      );
    }

    await flushLogs(true);
  }

  // Compute summary
  const passed = scenarioResults.filter((s) => s.status === "passed").length;
  const failed = scenarioResults.filter((s) => s.status === "failed").length;
  const skipped = scenarioResults.filter((s) => s.status === "skipped").length;
  const total = scenarioResults.length;

  run.summary = { total, passed, failed, skipped };
  run.endTime = new Date();
  run.durationMs =
    run.endTime.getTime() - (run.startTime?.getTime() ?? run.endTime.getTime());
  if (run.status !== "failed") {
    run.status = failed > 0 ? "completed" : "completed"; // always completed unless fatal
  }
  await run.save();

  await flushLogs(true);

  return {
    runId: opts.runId,
    status: run.status,
    summary: { total, passed, failed, skipped },
  };
}
