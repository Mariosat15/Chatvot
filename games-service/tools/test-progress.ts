/**
 * Mid-round progress tests. Run with `npx tsx tools/test-progress.ts`.
 *
 * WHAT THIS COVERS. Telling the platform what a player has done so far, after each solved
 * board, so a contest board can say more than "playing now". Our half of the owner's report on
 * 11 September 2026.
 *
 * THE TWO TESTS THAT MATTER MOST, because both failures are silent:
 *
 *   * NO SCORE IS SENT. `scoreRound` computes one alongside the breakdown and it is discarded.
 *     A score arriving anywhere other than the one result callback is the second scoring door
 *     chapter 02 section 10 forbids - and it would be accepted by nothing and noticed by
 *     nobody until a number on a live board disagreed with a payout.
 *
 *   * NOTHING HERE CAN THROW OR HANG. The caller starts this between a player solving a board
 *     and being handed the next one, in a round they PAID for, so a rejected promise is an
 *     unhandled rejection behind their game and an unbounded wait is a visible stall.
 *
 * And one that reads as a detail and is not: reusing `scoreRound` rather than counting boards
 * separately is what makes the live line and the final line agree. A board saying five solved
 * beside a result saying four is worse than a board saying nothing.
 */

import assert from "node:assert/strict";

import { resetConfigForTests } from "../src/config";
import { progressBreakdownFor, sendProgress } from "../src/callback/progress";
import type { RoundDoc } from "../src/store/round.model";

/*
 * The signing credentials, and nothing else. No database is opened here on purpose: every
 * assertion below is about what leaves this process, so the round is a plain object rather
 * than a saved document and the whole file runs in milliseconds.
 */
process.env.GAMES_MONGODB_URI = "mongodb://127.0.0.1:27017/unused";
process.env.GAMES_DB_NAME = "chartvolt_games_test";
process.env.GAMES_API_KEY = "test-api-key";
process.env.GAMES_API_SECRET = "test-api-secret";
process.env.GAMES_CALLBACK_TOKEN = "test-callback-token";
process.env.GAMES_CALLBACK_SECRET = "test-callback-secret";
resetConfigForTests();

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  ok    ${name}`);
    })
    .catch((error: unknown) => {
      failed++;
      console.log(`  FAIL  ${name}`);
      console.log(`        ${(error as Error).message.split("\n")[0]}`);
    });
}

const T0 = new Date("2026-09-11T12:00:00.000Z");

/** A round of `circuit-sprint` with `solved` boards finished and one still open. */
function round(overrides: Partial<RoundDoc> = {}, solved = 2): RoundDoc {
  const boards = [];
  for (let i = 0; i <= solved; i++) {
    boards.push({
      index: i,
      issuedAt: new Date(T0.getTime() + i * 10_000),
      solvedAt: i < solved ? new Date(T0.getTime() + i * 10_000 + 8_000) : undefined,
      attempts: 1,
    });
  }

  return {
    roundId: "r-1",
    providerRoundId: "gs-1",
    gameCode: "circuit-sprint",
    mode: "ranked",
    playerId: "p-1",
    config: { kind: "sprint", durationSeconds: 120, gridSize: "medium" },
    requestedConfig: {},
    configCorrections: [],
    presentationSeed: "seed",
    fingerprint: "fp",
    expiresAt: new Date(T0.getTime() + 120_000),
    launchToken: "t",
    launchUrlExpiresAt: new Date(T0.getTime() + 60_000),
    resultCallbackUrl: "https://platform.example/api/games/providers/x/events",
    progressCallbackUrl: "https://platform.example/api/games/providers/x/progress",
    status: "launched",
    boards,
    ...overrides,
  } as RoundDoc;
}

type Captured = { url: string; init: RequestInit } | null;

/** Replaces `fetch` for one call and hands back what it was given. */
async function withFetch(
  responder: () => Promise<Response> | Response,
  run: () => Promise<unknown>,
): Promise<Captured> {
  const original = globalThis.fetch;
  let captured: Captured = null;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    captured = { url: String(url), init };
    return responder();
  }) as unknown as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
  return captured;
}

async function main(): Promise<void> {
  console.log("\nWhat a progress report contains\n");

  await test("the figures come from the same function the result uses", () => {
    const breakdown = progressBreakdownFor(round());
    assert.ok(breakdown, "expected a breakdown for a round with solved boards");
    // `scoreRound`'s sprint shape, not a hand-rolled count.
    assert.equal(breakdown.boardsCompleted, 2);
    assert.ok("speedBonus" in breakdown, "expected the title's own breakdown keys");
  });

  await test("nothing solved yet is not progress", () => {
    // An all-zero breakdown is the state every round is in before anybody has done anything,
    // and reporting it puts a line of zeroes under a player who has just pressed Play.
    assert.equal(progressBreakdownFor(round({}, 0)), null);
  });

  await test("an unknown game reports nothing rather than guessing", () => {
    assert.equal(progressBreakdownFor(round({ gameCode: "not-a-game" })), null);
  });

  console.log("\nWhen a report is sent at all\n");

  await test("not when the platform asked for none", async () => {
    const sent = await withFetch(
      () => new Response("{}", { status: 200 }),
      () => sendProgress(round({ progressCallbackUrl: undefined })),
    );
    assert.equal(sent, null, "expected no request at all");
  });

  await test("not for a practice round", async () => {
    // Practice has no contest board to appear on, and the platform stores no round for it.
    const sent = await withFetch(
      () => new Response("{}", { status: 200 }),
      () => sendProgress(round({ mode: "practice" })),
    );
    assert.equal(sent, null);
  });

  await test("sent to the URL the platform supplied", async () => {
    const sent = await withFetch(
      () => new Response("{}", { status: 200 }),
      () => sendProgress(round()),
    );
    assert.ok(sent);
    assert.equal(sent.url, "https://platform.example/api/games/providers/x/progress");
    assert.equal(sent.init.method, "POST");
  });

  console.log("\nWhat crosses the seam\n");

  await test("carries no score, and the whole body is asserted", async () => {
    const sent = await withFetch(
      () => new Response("{}", { status: 200 }),
      () => sendProgress(round()),
    );
    assert.ok(sent);
    const body = JSON.parse(String(sent.init.body)) as Record<string, unknown>;

    // THE WHOLE OBJECT, not the three fields we care about. A field nobody asserted is the
    // only way to notice one nobody expected - which is how the admin credential-rotation bug
    // surfaced - and here the field that must not appear is precisely an unexpected one.
    assert.deepEqual(Object.keys(body).sort(), [
      "breakdown",
      "providerRoundId",
      "roundId",
    ]);
    assert.equal(body.score, undefined);
    assert.equal(body.rawScore, undefined);
  });

  await test("signed exactly as a result is", async () => {
    const sent = await withFetch(
      () => new Response("{}", { status: 200 }),
      () => sendProgress(round()),
    );
    assert.ok(sent);
    const headers = sent.init.headers as Record<string, string>;
    assert.ok(headers.Authorization?.startsWith("Bearer "));
    assert.match(headers["X-Signature"] ?? "", /^sha256=[0-9a-f]{64}$/);
    assert.match(headers["X-Timestamp"] ?? "", /^\d+$/);
  });

  console.log("\nIt never disturbs the player\n");

  await test("a refusal is a warning, not a throw", async () => {
    const result = await sendProgress(round());
    // No stubbed fetch here on purpose: the real one against an unroutable host fails, which
    // is the case that must not reach the caller.
    assert.equal(result.sent, false);
  });

  await test("a non-2xx is reported back rather than raised", async () => {
    let outcome: { sent: boolean; reason?: string } | null = null;
    await withFetch(
      () => new Response("no", { status: 401 }),
      async () => {
        outcome = await sendProgress(round());
      },
    );
    assert.deepEqual(outcome, { sent: false, reason: "HTTP 401" });
  });

  await test("a thrown fetch is caught", async () => {
    let outcome: { sent: boolean; reason?: string } | null = null;
    await withFetch(
      () => {
        throw new Error("socket hang up");
      },
      async () => {
        outcome = await sendProgress(round());
      },
    );
    assert.deepEqual(outcome, { sent: false, reason: "unreachable" });
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

void main();
