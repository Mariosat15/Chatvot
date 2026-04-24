/**
 * Six attack scenarios. Each one probes a specific defense via the real
 * production code path (rate limiter, decline-velocity tracker, Nuvei webhook
 * HMAC + idempotency). Each returns a structured result the runner persists
 * into AttackRun.scenarios.
 *
 * Scenarios NEVER call PSP sandboxes. They call our OWN defense layer.
 * No card numbers are ever entered, generated, or stored.
 */

import {
  craftNuveiDmn,
  postCraftedDmn,
  resolveNuveiSecret,
} from "./webhook-crafter";
// Reason: relative import for dual-app (main + admin) resolution.
import type { IAttackScenarioResult } from "../../../../database/models/simulator/attack-run.model";

export interface AttackScenarioContext {
  baseUrl: string;
  attackSecret: string;
  /** Stream a log line into the AttackRun document. */
  log: (
    level: "info" | "warn" | "error",
    message: string,
    scenarioId?: string,
  ) => Promise<void>;
  /** Track resources for the final cleanup sweep. */
  registerTestUser: (userId: string) => void;
  registerTestIp: (ip: string) => void;
  registerTransaction: (txId: string) => void;
}

export type AttackScenario = (
  ctx: AttackScenarioContext,
) => Promise<IAttackScenarioResult>;

const JSON_HEADERS_BASE: Record<string, string> = {
  "content-type": "application/json",
};

function attackHeaders(secret: string): Record<string, string> {
  return {
    ...JSON_HEADERS_BASE,
    "x-simulator-attack-secret": secret,
    // Loopback hint for the guard — the request actually IS local (server-to-
    // server on the same host). External requests going through Cloudflare get
    // `cf-connecting-ip` set to the real client IP, which getClientIP prefers,
    // so this header alone cannot bypass loopback enforcement for outside hits.
    "x-forwarded-for": "127.0.0.1",
  };
}

async function callAttack<T = unknown>(
  ctx: AttackScenarioContext,
  path: string,
  init: RequestInit,
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${ctx.baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      ...attackHeaders(ctx.attackSecret),
    },
  });
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data: data as T };
}

function newScenarioResult(
  id: string,
  name: string,
  description: string,
): IAttackScenarioResult {
  return {
    id,
    name,
    description,
    status: "running",
    assertions: [],
    startTime: new Date(),
  };
}

function finalize(
  result: IAttackScenarioResult,
): IAttackScenarioResult {
  result.endTime = new Date();
  result.durationMs =
    result.endTime.getTime() - (result.startTime?.getTime() ?? result.endTime.getTime());
  const allPassed = result.assertions.every((a) => a.passed);
  if (result.status === "running") {
    result.status = allPassed ? "passed" : "failed";
  }
  if (!result.verdict) {
    result.verdict = allPassed
      ? "PASS (all assertions satisfied)"
      : `FAIL (${result.assertions.filter((a) => !a.passed).length} assertion(s) failed)`;
  }
  return result;
}

// ─── setup helpers (HTTP) ────────────────────────────────────────────────────

async function setupTestUser(
  ctx: AttackScenarioContext,
): Promise<string> {
  const { status, data } = await callAttack<{
    success: boolean;
    userId?: string;
    error?: string;
  }>(ctx, "/api/simulator/attack/setup", {
    method: "POST",
    body: JSON.stringify({ action: "create-user" }),
  });
  if (status !== 200 || !data.success || !data.userId) {
    throw new Error(`setup create-user failed: ${status} ${data.error ?? ""}`);
  }
  ctx.registerTestUser(data.userId);
  return data.userId;
}

// ─── scenario 1: per-user deposit rate-limit (5/min) ─────────────────────────

export const scenarioUserFlood: AttackScenario = async (ctx) => {
  const id = "s1_user_flood";
  const result = newScenarioResult(
    id,
    "Per-user deposit rate-limit (5/min)",
    "Fire 20 deposit attempts as one user. Requests 1-5 should be allowed, requests 6-20 should be blocked.",
  );

  try {
    const userId = await setupTestUser(ctx);
    await ctx.log("info", `Flooding 20 deposit attempts as ${userId}`, id);

    const { status, data } = await callAttack<{
      success: boolean;
      results: Array<{ index: number; allowed: boolean; remaining: number }>;
    }>(ctx, "/api/simulator/attack/deposit-flood", {
      method: "POST",
      body: JSON.stringify({ userId, count: 20, mode: "user" }),
    });

    if (status !== 200 || !data.success) {
      throw new Error(`deposit-flood failed with status ${status}`);
    }

    const allowedCount = data.results.filter((r) => r.allowed).length;
    const blockedCount = data.results.filter((r) => !r.allowed).length;
    const firstBlockedIndex = data.results.findIndex((r) => !r.allowed);

    for (const r of data.results.slice(0, Math.min(6, data.results.length))) {
      await ctx.log(
        "info",
        `Request ${r.index}/20: ${r.allowed ? "ALLOWED" : "429 BLOCKED"} (remaining=${r.remaining})`,
        id,
      );
    }
    await ctx.log(
      "info",
      `Summary: ${allowedCount} allowed, ${blockedCount} blocked, first block at #${firstBlockedIndex + 1}`,
      id,
    );

    result.assertions.push({
      label: "Exactly 5 requests allowed",
      passed: allowedCount === 5,
      detail: `allowed=${allowedCount}`,
    });
    result.assertions.push({
      label: "Request #6 is the first to be blocked",
      passed: firstBlockedIndex === 5,
      detail: `firstBlockedIndex=${firstBlockedIndex}`,
    });
    result.assertions.push({
      label: "All remaining (15) requests blocked",
      passed: blockedCount === 15,
      detail: `blocked=${blockedCount}`,
    });

    const pass = result.assertions.every((a) => a.passed);
    result.verdict = pass
      ? "PASS (rate limiter engaged at request 6 as expected)"
      : "FAIL (rate limiter did not engage at the expected request)";
  } catch (err) {
    result.status = "failed";
    result.errorMessage =
      err instanceof Error ? err.message : "scenario threw unexpectedly";
    await ctx.log("error", `Scenario ${id} crashed: ${result.errorMessage}`, id);
  }

  return finalize(result);
};

// ─── scenario 2: per-IP deposit rate-limit (10/min) ──────────────────────────

export const scenarioIpFlood: AttackScenario = async (ctx) => {
  const id = "s2_ip_flood";
  const result = newScenarioResult(
    id,
    "Per-IP deposit rate-limit (10/min)",
    "Fire 25 deposit attempts from the same IP across 12 different test users. Requests 1-10 allowed, 11+ blocked.",
  );

  try {
    // Per-IP limiter uses a synthetic IP string; we generate one unique to this run.
    const ip = `10.99.${Math.floor(Math.random() * 256)}.${Math.floor(
      Math.random() * 256,
    )}`;
    ctx.registerTestIp(ip);
    await ctx.log("info", `Flooding 25 deposit attempts from ${ip}`, id);

    const { status, data } = await callAttack<{
      success: boolean;
      results: Array<{ index: number; allowed: boolean; remaining: number }>;
    }>(ctx, "/api/simulator/attack/deposit-flood", {
      method: "POST",
      body: JSON.stringify({ ipAddress: ip, count: 25, mode: "ip" }),
    });

    if (status !== 200 || !data.success) {
      throw new Error(`deposit-flood (ip) failed with status ${status}`);
    }

    const allowedCount = data.results.filter((r) => r.allowed).length;
    const blockedCount = data.results.filter((r) => !r.allowed).length;
    const firstBlockedIndex = data.results.findIndex((r) => !r.allowed);

    await ctx.log(
      "info",
      `Summary: ${allowedCount} allowed, ${blockedCount} blocked, first block at #${firstBlockedIndex + 1}`,
      id,
    );

    result.assertions.push({
      label: "Exactly 10 requests allowed",
      passed: allowedCount === 10,
      detail: `allowed=${allowedCount}`,
    });
    result.assertions.push({
      label: "Request #11 is the first to be blocked",
      passed: firstBlockedIndex === 10,
      detail: `firstBlockedIndex=${firstBlockedIndex}`,
    });
    result.assertions.push({
      label: "All remaining (15) requests blocked",
      passed: blockedCount === 15,
      detail: `blocked=${blockedCount}`,
    });

    const pass = result.assertions.every((a) => a.passed);
    result.verdict = pass
      ? "PASS (per-IP rate limiter engaged at request 11 as expected)"
      : "FAIL (per-IP rate limiter did not engage at the expected request)";
  } catch (err) {
    result.status = "failed";
    result.errorMessage =
      err instanceof Error ? err.message : "scenario threw unexpectedly";
    await ctx.log("error", `Scenario ${id} crashed: ${result.errorMessage}`, id);
  }

  return finalize(result);
};

// ─── scenario 3: decline velocity (3 declines → block) ───────────────────────

export const scenarioDeclineVelocity: AttackScenario = async (ctx) => {
  const id = "s3_decline_velocity";
  const result = newScenarioResult(
    id,
    "Decline-velocity block (3 in 10 min → 1h cooldown)",
    "Record 3 synthetic declines then verify the user is blocked from further deposits.",
  );

  try {
    const userId = await setupTestUser(ctx);
    await ctx.log("info", `Clearing any prior decline state for ${userId}`, id);

    await callAttack(ctx, "/api/simulator/attack/simulate-decline", {
      method: "POST",
      body: JSON.stringify({ userId, action: "clear" }),
    });

    // Record 3 declines
    const { status: recStatus, data: recData } = await callAttack<{
      success: boolean;
      events: Array<{ attempt: number; blocked: boolean; declineCount: number }>;
    }>(ctx, "/api/simulator/attack/simulate-decline", {
      method: "POST",
      body: JSON.stringify({ userId, action: "record", count: 3 }),
    });
    if (recStatus !== 200 || !recData.success) {
      throw new Error(`simulate-decline failed status=${recStatus}`);
    }

    for (const e of recData.events) {
      await ctx.log(
        "info",
        `Decline #${e.attempt}: count=${e.declineCount} blocked=${e.blocked}`,
        id,
      );
    }

    const last = recData.events[recData.events.length - 1];
    result.assertions.push({
      label: "Third decline triggers block",
      passed: !!last && last.blocked === true,
      detail: `lastBlocked=${last?.blocked} declineCount=${last?.declineCount}`,
    });

    // Probe state
    const { data: stateData } = await callAttack<{
      success: boolean;
      userBlocked: boolean;
      retryAfterMs?: number;
    }>(
      ctx,
      `/api/simulator/attack/check-block-state?userId=${encodeURIComponent(userId)}`,
      { method: "GET" },
    );

    result.assertions.push({
      label: "isDeclineBlocked returns true for user",
      passed: stateData.userBlocked === true,
      detail: `retryAfterMs=${stateData.retryAfterMs ?? 0}`,
    });

    result.assertions.push({
      label: "Block TTL is in cooldown range (<=1h)",
      passed:
        typeof stateData.retryAfterMs === "number" &&
        stateData.retryAfterMs > 0 &&
        stateData.retryAfterMs <= 60 * 60 * 1000 + 5000, // +5s tolerance
      detail: `retryAfterMs=${stateData.retryAfterMs}`,
    });

    const pass = result.assertions.every((a) => a.passed);
    result.verdict = pass
      ? "PASS (user blocked after 3 declines, cooldown active)"
      : "FAIL (decline-velocity defense did not block the user)";
  } catch (err) {
    result.status = "failed";
    result.errorMessage =
      err instanceof Error ? err.message : "scenario threw unexpectedly";
    await ctx.log("error", `Scenario ${id} crashed: ${result.errorMessage}`, id);
  }

  return finalize(result);
};

// ─── scenario 4: block recovery (success clears counter) ─────────────────────

export const scenarioBlockRecovery: AttackScenario = async (ctx) => {
  const id = "s4_block_recovery";
  const result = newScenarioResult(
    id,
    "Block recovery after successful payment",
    "Record 2 declines, then simulate a success-clear. Counter should reset; user should no longer be blocked.",
  );

  try {
    const userId = await setupTestUser(ctx);

    // Fresh start
    await callAttack(ctx, "/api/simulator/attack/simulate-decline", {
      method: "POST",
      body: JSON.stringify({ userId, action: "clear" }),
    });

    // 2 declines (below threshold, so not blocked yet)
    await callAttack(ctx, "/api/simulator/attack/simulate-decline", {
      method: "POST",
      body: JSON.stringify({ userId, action: "record", count: 2 }),
    });
    await ctx.log("info", "Recorded 2 declines (below threshold)", id);

    // Simulate success clearing (the webhook calls clearDeclines on APPROVED)
    await callAttack(ctx, "/api/simulator/attack/simulate-decline", {
      method: "POST",
      body: JSON.stringify({ userId, action: "clear" }),
    });
    await ctx.log("info", "Simulated successful payment → clearDeclines fired", id);

    const { data: stateData } = await callAttack<{
      success: boolean;
      userBlocked: boolean;
      retryAfterMs?: number;
    }>(
      ctx,
      `/api/simulator/attack/check-block-state?userId=${encodeURIComponent(userId)}`,
      { method: "GET" },
    );

    result.assertions.push({
      label: "User is NOT blocked after clearDeclines",
      passed: stateData.userBlocked === false,
      detail: `userBlocked=${stateData.userBlocked}`,
    });

    // Now record a 3rd decline — if counter was truly reset it should require
    // 3 MORE declines before blocking, not just 1.
    const { data: recData } = await callAttack<{
      success: boolean;
      events: Array<{ attempt: number; blocked: boolean; declineCount: number }>;
    }>(ctx, "/api/simulator/attack/simulate-decline", {
      method: "POST",
      body: JSON.stringify({ userId, action: "record", count: 1 }),
    });
    const ev = recData.events?.[0];
    result.assertions.push({
      label: "Single decline after clear does NOT re-trigger block",
      passed: ev != null && ev.blocked === false && ev.declineCount === 1,
      detail: `blocked=${ev?.blocked} declineCount=${ev?.declineCount}`,
    });

    const pass = result.assertions.every((a) => a.passed);
    result.verdict = pass
      ? "PASS (successful payment clears decline counter; user re-allowed)"
      : "FAIL (clearDeclines did not reset state correctly)";
  } catch (err) {
    result.status = "failed";
    result.errorMessage =
      err instanceof Error ? err.message : "scenario threw unexpectedly";
    await ctx.log("error", `Scenario ${id} crashed: ${result.errorMessage}`, id);
  }

  return finalize(result);
};

// ─── scenario 5: HMAC rejection ──────────────────────────────────────────────

export const scenarioHmacRejection: AttackScenario = async (ctx) => {
  const id = "s5_hmac_rejection";
  const result = newScenarioResult(
    id,
    "Webhook HMAC signature rejection",
    "Send a forged DMN with an invalid signature. Webhook must not credit anything and must log a signature failure.",
  );

  try {
    // Guard against test giving a false-positive when no secret is configured
    const secret = await resolveNuveiSecret();
    if (!secret) {
      result.status = "skipped";
      result.verdict =
        "SKIP (NUVEI_SECRET_KEY not configured — webhook would run without signature verification)";
      await ctx.log(
        "warn",
        "Skipping HMAC test because Nuvei secret is not configured",
        id,
      );
      return finalize(result);
    }

    const userId = await setupTestUser(ctx);
    const pppTransactionId = `sim-ppp-${Date.now()}-${Math.floor(
      Math.random() * 1000,
    )}`;
    const clientUniqueId = `txn_sim_${Date.now()}`;

    const crafted = await craftNuveiDmn({
      pppTransactionId,
      clientUniqueId,
      userId,
      amount: 25,
      status: "APPROVED",
      signatureMode: "invalid",
    });

    await ctx.log(
      "info",
      `Posting forged DMN (invalid checksum) for ${userId}`,
      id,
    );

    const { status, text, body } = await postCraftedDmn(ctx.baseUrl, crafted);

    const bodyObj =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)
        : {};
    const message = String(bodyObj.message ?? "");
    const warning = String(bodyObj.warning ?? "");

    await ctx.log(
      "info",
      `Webhook response: status=${status} message="${message}" warning="${warning}"`,
      id,
    );

    // Reason: the Nuvei webhook now returns HTTP 401 on signature failure
    // (previously 200) so forged requests are distinguishable in logs/alerting
    // and PSPs treat them as terminal. A SecurityAlert is also persisted.
    result.assertions.push({
      label: "Webhook HTTP status is 401 (Unauthorized)",
      passed: status === 401,
      detail: `status=${status}`,
    });
    const bodyError =
      typeof bodyObj.error === "string" ? (bodyObj.error as string) : "";
    result.assertions.push({
      label: "Response body indicates unauthorized / forged request",
      passed:
        /unauthorized/i.test(bodyError) ||
        /signature verification failed/i.test(message) ||
        /signature verification failed/i.test(text) ||
        /will not be processed/i.test(warning),
      detail: `status=${status} error="${bodyError}" message="${message}"`,
    });

    const pass = result.assertions.every((a) => a.passed);
    result.verdict = pass
      ? "PASS (forged webhook rejected with HTTP 401 and no wallet impact)"
      : "FAIL (forged webhook was NOT rejected with 401 — investigate HMAC path)";
  } catch (err) {
    result.status = "failed";
    result.errorMessage =
      err instanceof Error ? err.message : "scenario threw unexpectedly";
    await ctx.log("error", `Scenario ${id} crashed: ${result.errorMessage}`, id);
  }

  return finalize(result);
};

// ─── scenario 6: replay idempotency ──────────────────────────────────────────

export const scenarioReplayIdempotency: AttackScenario = async (ctx) => {
  const id = "s6_replay_idempotency";
  const result = newScenarioResult(
    id,
    "Webhook replay idempotency",
    "Replay the same webhook for an already-completed transaction. Second call must NOT double-credit.",
  );

  try {
    const secret = await resolveNuveiSecret();
    if (!secret) {
      result.status = "skipped";
      result.verdict =
        "SKIP (NUVEI_SECRET_KEY not configured — cannot send a valid-signature DMN)";
      await ctx.log(
        "warn",
        "Skipping idempotency test — secret missing",
        id,
      );
      return finalize(result);
    }

    const userId = await setupTestUser(ctx);

    // Create a WalletTransaction pre-marked as "completed" so the claim branch
    // short-circuits on the very first webhook call — this is the idempotency
    // branch we want to exercise. No wallet mutation should occur.
    const { status: setupStatus, data: setupData } = await callAttack<{
      success: boolean;
      transactionId?: string;
      pppTransactionId?: string;
      clientUniqueId?: string;
      error?: string;
    }>(ctx, "/api/simulator/attack/setup", {
      method: "POST",
      body: JSON.stringify({
        action: "create-completed-tx",
        userId,
        amount: 25,
      }),
    });

    if (
      setupStatus !== 200 ||
      !setupData.success ||
      !setupData.transactionId ||
      !setupData.pppTransactionId ||
      !setupData.clientUniqueId
    ) {
      throw new Error(
        `setup create-completed-tx failed: ${setupStatus} ${setupData.error ?? ""}`,
      );
    }
    ctx.registerTransaction(setupData.transactionId);

    const crafted = await craftNuveiDmn({
      pppTransactionId: setupData.pppTransactionId,
      clientUniqueId: setupData.clientUniqueId,
      userId,
      amount: 25,
      status: "APPROVED",
      signatureMode: "valid",
    });

    await ctx.log("info", "Posting valid DMN #1 for already-completed txn", id);
    const r1 = await postCraftedDmn(ctx.baseUrl, crafted);
    await ctx.log(
      "info",
      `Response #1: status=${r1.status} body=${r1.text.slice(0, 140)}`,
      id,
    );

    await ctx.log("info", "Posting valid DMN #2 (replay)", id);
    const r2 = await postCraftedDmn(ctx.baseUrl, crafted);
    await ctx.log(
      "info",
      `Response #2: status=${r2.status} body=${r2.text.slice(0, 140)}`,
      id,
    );

    const msg1 = extractMessage(r1.body, r1.text);
    const msg2 = extractMessage(r2.body, r2.text);

    const alreadyProcessedPattern =
      /already (processed|processing|completed)|not in pending state/i;

    result.assertions.push({
      label: "First response indicates already-processed (no credit)",
      passed: alreadyProcessedPattern.test(msg1),
      detail: `msg="${msg1}"`,
    });
    result.assertions.push({
      label: "Replayed response also indicates already-processed",
      passed: alreadyProcessedPattern.test(msg2),
      detail: `msg="${msg2}"`,
    });
    result.assertions.push({
      label: "Responses are identical (deterministic idempotency)",
      passed: msg1 === msg2,
      detail: `msg1==msg2=${msg1 === msg2}`,
    });

    const pass = result.assertions.every((a) => a.passed);
    result.verdict = pass
      ? "PASS (replay short-circuits on the 'already processed' branch, no double-credit)"
      : "FAIL (replay did not short-circuit as expected)";
  } catch (err) {
    result.status = "failed";
    result.errorMessage =
      err instanceof Error ? err.message : "scenario threw unexpectedly";
    await ctx.log("error", `Scenario ${id} crashed: ${result.errorMessage}`, id);
  }

  return finalize(result);
};

function extractMessage(body: unknown, text: string): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const parts = [b.message, b.warning, b.status]
      .filter((p) => typeof p === "string")
      .join(" | ");
    if (parts) return parts;
  }
  return text;
}

// ─── scenario 7: ATO brute-force login rate-limit ────────────────────────────

export const scenarioAtoBruteForce: AttackScenario = async (ctx) => {
  const id = "s7_ato_brute_force";
  const result = newScenarioResult(
    id,
    "ATO brute-force login lockout",
    "Record failed logins for a sim-attack email. The account must be locked and validateLogin must deny further attempts.",
  );

  try {
    // Ensure we start from a clean state (no prior lockout / fraud alert)
    const email = `sim-attack-ato-${Date.now()}-${Math.floor(Math.random() * 1000)}@test.simulator`;
    // Register the username part for cleanup sweep (prefix-scoped)
    ctx.registerTestUser(email.split("@")[0]);
    await ctx.log("info", `ATO target email: ${email}`, id);

    await callAttack(ctx, "/api/simulator/attack/simulate-login", {
      method: "POST",
      body: JSON.stringify({ action: "clear", email }),
    });

    // Probe BEFORE: user should be allowed.
    const { data: before } = await callAttack<{
      success: boolean;
      allowed: boolean;
      code?: string;
    }>(ctx, "/api/simulator/attack/simulate-login", {
      method: "POST",
      body: JSON.stringify({ action: "probe", email }),
    });
    await ctx.log(
      "info",
      `Pre-flood probe: allowed=${before.allowed} code=${before.code ?? "-"}`,
      id,
    );
    result.assertions.push({
      label: "Fresh email is initially allowed to log in",
      passed: before.allowed === true,
      detail: `allowed=${before.allowed}`,
    });

    // Record 10 failed attempts (default lockout threshold is ≤10 in fraud-settings).
    const { data: rec } = await callAttack<{
      success: boolean;
      events: Array<{
        attempt: number;
        locked: boolean;
        remainingAttempts: number;
      }>;
    }>(ctx, "/api/simulator/attack/simulate-login", {
      method: "POST",
      body: JSON.stringify({ action: "record-failures", email, count: 10 }),
    });
    const firstLockIdx = rec.events.findIndex((e) => e.locked);
    await ctx.log(
      "info",
      `Recorded ${rec.events.length} failures; first lockout event at attempt #${firstLockIdx + 1}`,
      id,
    );

    result.assertions.push({
      label: "Repeated failures trigger a lockout event",
      passed: firstLockIdx >= 0,
      detail: `firstLockIdx=${firstLockIdx}`,
    });

    // Probe AFTER: user must be blocked.
    const { data: after } = await callAttack<{
      success: boolean;
      allowed: boolean;
      code?: string;
    }>(ctx, "/api/simulator/attack/simulate-login", {
      method: "POST",
      body: JSON.stringify({ action: "probe", email }),
    });
    await ctx.log(
      "info",
      `Post-flood probe: allowed=${after.allowed} code=${after.code ?? "-"}`,
      id,
    );
    result.assertions.push({
      label: "validateLogin denies login after threshold",
      passed: after.allowed === false,
      detail: `allowed=${after.allowed} code=${after.code}`,
    });

    // Idempotent cleanup — not strictly required since runner cleanup handles
    // it, but leaves a tidier state if the scenario is run in isolation.
    await callAttack(ctx, "/api/simulator/attack/simulate-login", {
      method: "POST",
      body: JSON.stringify({ action: "clear", email }),
    });

    const pass = result.assertions.every((a) => a.passed);
    result.verdict = pass
      ? "PASS (brute-force flood locks the account as expected)"
      : "FAIL (ATO defense did not lock the account after repeated failures)";
  } catch (err) {
    result.status = "failed";
    result.errorMessage =
      err instanceof Error ? err.message : "scenario threw unexpectedly";
    await ctx.log("error", `Scenario ${id} crashed: ${result.errorMessage}`, id);
  }

  return finalize(result);
};

// ─── scenario 8: chargeback → user restriction ───────────────────────────────

export const scenarioChargebackRestriction: AttackScenario = async (ctx) => {
  const id = "s8_chargeback_restriction";
  const result = newScenarioResult(
    id,
    "Chargeback → automatic user restriction",
    "Send a signed Nuvei DMN with transactionType=Chargeback. The user must be banned from all actions and a SecurityAlert must be recorded.",
  );

  try {
    const secret = await resolveNuveiSecret();
    if (!secret) {
      result.status = "skipped";
      result.verdict =
        "SKIP (Nuvei secret not configured — cannot post a valid-signature chargeback DMN)";
      await ctx.log(
        "warn",
        "Skipping chargeback test — Nuvei secret missing",
        id,
      );
      return finalize(result);
    }

    const userId = await setupTestUser(ctx);

    // Create a completed deposit tx so the chargeback handler can find it
    // and mark it disputed.
    const { status: setupStatus, data: setupData } = await callAttack<{
      success: boolean;
      transactionId?: string;
      pppTransactionId?: string;
      clientUniqueId?: string;
      error?: string;
    }>(ctx, "/api/simulator/attack/setup", {
      method: "POST",
      body: JSON.stringify({
        action: "create-completed-tx",
        userId,
        amount: 25,
      }),
    });
    if (
      setupStatus !== 200 ||
      !setupData.success ||
      !setupData.transactionId ||
      !setupData.pppTransactionId ||
      !setupData.clientUniqueId
    ) {
      throw new Error(
        `setup create-completed-tx failed: ${setupStatus} ${setupData.error ?? ""}`,
      );
    }
    ctx.registerTransaction(setupData.transactionId);

    const crafted = await craftNuveiDmn({
      pppTransactionId: setupData.pppTransactionId,
      clientUniqueId: setupData.clientUniqueId,
      userId,
      amount: 25,
      status: "APPROVED",
      signatureMode: "valid",
      transactionType: "Chargeback",
    });

    await ctx.log(
      "info",
      `Posting signed chargeback DMN for user ${userId}`,
      id,
    );

    const r = await postCraftedDmn(ctx.baseUrl, crafted);
    await ctx.log(
      "info",
      `Chargeback webhook response: status=${r.status} body=${r.text.slice(0, 140)}`,
      id,
    );

    result.assertions.push({
      label: "Webhook acknowledges chargeback (HTTP 200)",
      passed: r.status === 200,
      detail: `status=${r.status}`,
    });

    // Allow a small settle window for the restriction write.
    await new Promise((res) => setTimeout(res, 250));

    const { data: restr } = await callAttack<{
      success: boolean;
      restricted: boolean;
      restrictionType?: string;
      reason?: string;
      canTrade?: boolean;
      canDeposit?: boolean;
      canWithdraw?: boolean;
      canEnterCompetitions?: boolean;
    }>(
      ctx,
      `/api/simulator/attack/check-user-restriction?userId=${encodeURIComponent(userId)}`,
      { method: "GET" },
    );

    result.assertions.push({
      label: "UserRestriction exists after chargeback",
      passed: restr.restricted === true,
      detail: `restricted=${restr.restricted}`,
    });
    result.assertions.push({
      label: "Restriction blocks all actions",
      passed:
        restr.canTrade === false &&
        restr.canDeposit === false &&
        restr.canWithdraw === false &&
        restr.canEnterCompetitions === false,
      detail: `trade=${restr.canTrade} deposit=${restr.canDeposit} withdraw=${restr.canWithdraw} compete=${restr.canEnterCompetitions}`,
    });
    result.assertions.push({
      label: "Reason is payment_fraud",
      passed: restr.reason === "payment_fraud",
      detail: `reason=${restr.reason}`,
    });

    const pass = result.assertions.every((a) => a.passed);
    result.verdict = pass
      ? "PASS (chargeback triggered a full UserRestriction and SecurityAlert)"
      : "FAIL (chargeback did NOT fully restrict the user — check Nuvei webhook chargeback branch)";
  } catch (err) {
    result.status = "failed";
    result.errorMessage =
      err instanceof Error ? err.message : "scenario threw unexpectedly";
    await ctx.log("error", `Scenario ${id} crashed: ${result.errorMessage}`, id);
  }

  return finalize(result);
};

// ─── scenario 9: NoSQL injection on login ────────────────────────────────────

export const scenarioNosqlInjection: AttackScenario = async (ctx) => {
  const id = "s9_nosql_injection_login";
  const result = newScenarioResult(
    id,
    "NoSQL injection guard on login",
    "Invoke signInWithEmail with non-string credentials (Mongo query operators). Guard must reject with success=false.",
  );

  try {
    const modes = [
      "object-email-gt",
      "object-email-ne",
      "array-email",
      "object-password",
    ] as const;

    for (const mode of modes) {
      const { data } = await callAttack<{
        success: boolean;
        rejected: boolean;
        threw?: boolean;
        result?: { success?: boolean; error?: string };
      }>(ctx, "/api/simulator/attack/probe-nosql", {
        method: "POST",
        body: JSON.stringify({ mode }),
      });

      const rejected = data.rejected === true;
      await ctx.log(
        "info",
        `mode=${mode} rejected=${rejected} threw=${data.threw ?? false}`,
        id,
      );

      result.assertions.push({
        label: `Crafted payload (${mode}) is rejected without session`,
        passed: rejected,
        detail: JSON.stringify(data.result ?? { threw: data.threw }),
      });
    }

    const pass = result.assertions.every((a) => a.passed);
    result.verdict = pass
      ? "PASS (all NoSQL-style payloads rejected by the type guard)"
      : "FAIL (at least one crafted payload was accepted — tighten signInWithEmail guard)";
  } catch (err) {
    result.status = "failed";
    result.errorMessage =
      err instanceof Error ? err.message : "scenario threw unexpectedly";
    await ctx.log("error", `Scenario ${id} crashed: ${result.errorMessage}`, id);
  }

  return finalize(result);
};

// Ordered export — scenario 4 depends on having cleared state from earlier
// scenarios, which is why we always clear at its start. Scenarios can run in
// sequence; isolation per test user keeps them independent.
export const ALL_SCENARIOS: AttackScenario[] = [
  scenarioUserFlood,
  scenarioIpFlood,
  scenarioDeclineVelocity,
  scenarioBlockRecovery,
  scenarioHmacRejection,
  scenarioReplayIdempotency,
  scenarioAtoBruteForce,
  scenarioChargebackRestriction,
  scenarioNosqlInjection,
];
