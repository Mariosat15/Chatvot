/**
 * Play surface and result delivery tests. Run with `npx tsx tools/test-play.ts`.
 *
 * THE THREE PROPERTIES THIS FILE EXISTS FOR
 * ----------------------------------------
 * 1. The client cannot influence its own score. Nothing here submits a score, a time or a board -
 *    the client sends paths and the server decides everything else. A provider that trusted the
 *    browser would pass every functional test in this file and still be unusable for prize money.
 *
 * 2. Every round reaches a terminal state and the result actually arrives. Section 13 calls a round
 *    that stops reporting "the worst thing that can happen in this integration", and section 8 asks
 *    for retries over 24 hours with a stable `eventId`. Both are pinned by driving a real callback
 *    receiver that verifies the signature the way the platform does.
 *
 * 3. Every player in one contest faces identical content, while no two see it presented the same
 *    way. Section 12 requires the first and explicitly wants the second, and they pull in opposite
 *    directions - which is exactly why both need a test.
 */

import assert from "node:assert/strict";

import { generateForPlayer } from "../src/engine/generate";
import type { Cell } from "../src/engine/puzzle";
import { shapeFor, type GridSize } from "../src/games/titles";
import {
  callApi,
  callPlay,
  clearRounds,
  received,
  receiverBehaviour,
  startService,
  stopService,
  summary,
  test,
  tokenFromLaunchUrl,
  waitFor,
} from "./api-harness";

interface ClientBoard {
  index: number;
  width: number;
  height: number;
  pairs: { id: number; a: Cell; b: Cell }[];
}

interface PlayStateBody {
  roundId: string;
  status: string;
  board?: ClientBoard;
  boardsSolved: number;
  boardTarget?: number;
  endsAt?: string;
  finished?: { status: string; boardsSolved: number };
}

const FUTURE = () => new Date(Date.now() + 60 * 60_000).toISOString();

let seedCounter = 0;

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    roundId: `cv_rnd_${Math.random().toString(36).slice(2, 12)}`,
    gameCode: "circuit-sprint",
    mode: "ranked",
    player: { playerId: `cv_p_${Math.random().toString(36).slice(2, 8)}` },
    config: { durationSeconds: 120, gridSize: "medium" },
    contentSeed: `cv_ctst_${++seedCounter}`,
    expiresAt: FUTURE(),
    resultCallbackUrl: "",
    ...overrides,
  };
}

/**
 * The solution to a board, computed the way the server would.
 *
 * This reads the generator's own solution, which is legitimate for a test and would not be for the
 * verifier: `verify.ts` deliberately checks a submission against the RULES rather than against this
 * list, because a puzzle can have several valid coverings and comparing against one of them would
 * reject the others. That independence is proven in `test-engine.ts`; here the solution is only a
 * convenient way to play correctly.
 */
async function solutionFor(
  roundId: string,
  boardIndex: number,
): Promise<{ pairId: number; cells: Cell[] }[]> {
  const { Round } = await import("../src/store/round.model");
  const round = await Round.findOne({ roundId });
  if (!round) throw new Error(`no round ${roundId}`);

  const config = round.config as { gridSize: GridSize };
  const generated = generateForPlayer(
    round.contentSeed ?? round.providerRoundId,
    round.presentationSeed,
    boardIndex,
    shapeFor(config.gridSize),
  );

  return generated.pairs.map((pair, index) => ({
    pairId: pair.id,
    // `index` is the map callback's own counter, one per pair, and the solution has one path per
    // pair by construction.
    // eslint-disable-next-line security/detect-object-injection
    cells: generated.solution[index],
  }));
}

/** A symmetry-invariant fingerprint of a board's content. */
function contentFingerprint(board: ClientBoard): string {
  const distances = board.pairs
    .map(({ a, b }) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]))
    .sort((x, y) => x - y);
  const dims = [board.width, board.height].sort((x, y) => x - y);
  return `${dims.join("x")}|${board.pairs.length}|${distances.join(",")}`;
}

async function openRound(overrides: Record<string, unknown> = {}) {
  const { callbackUrl } = await import("./api-harness");
  const body = createBody({ resultCallbackUrl: callbackUrl, ...overrides });
  const created = await callApi<{ launchUrl: string }>("/v1/rounds", { method: "POST", body });
  if (created.status !== 201) throw new Error(`create failed ${created.status}: ${created.raw}`);
  return { roundId: body.roundId, token: tokenFromLaunchUrl(created.body.launchUrl) };
}

async function main(): Promise<number> {
  await startService({ sandbox: true });

  console.log("");
  console.log("The play session");

  await test("an invalid launch token is a 401, never a 404", async () => {
    // A 404 would confirm that a token was well-formed but unknown, which turns the endpoint into an
    // oracle for guessing tokens.
    const response = await callPlay("/play/api/session", { t: "a".repeat(48) });
    assert.equal(response.status, 401);
  });

  await test("starting a round returns a board and starts the clock", async () => {
    await clearRounds();
    const { roundId, token } = await openRound();

    const state = await callPlay<PlayStateBody>("/play/api/session", { t: token });
    assert.equal(state.status, 200);
    assert.equal(state.body.status, "in_progress");
    assert.equal(state.body.board?.index, 0);
    assert.ok((state.body.board?.pairs.length ?? 0) >= 3);
    assert.ok(state.body.endsAt, "no clock was reported");

    const { Round } = await import("../src/store/round.model");
    const stored = await Round.findOne({ roundId });
    assert.ok(stored?.startedAt, "startedAt was not recorded server-side");
  });

  await test("the board payload carries no solution and no seed", async () => {
    await clearRounds();
    const { token } = await openRound({ contentSeed: "SEEDCANARY" });
    const state = await callPlay("/play/api/session", { t: token });
    assert.doesNotMatch(state.raw, /solution/i);
    assert.doesNotMatch(state.raw, /SEEDCANARY/);
    assert.doesNotMatch(state.raw, /presentationSeed/i);
  });

  await test("reading the state does NOT start the round", async () => {
    // A GET must never have a side effect that costs the player something. A browser issues one for
    // reasons that have nothing to do with intent - prefetch on hover, a crawler, a refresh - so a
    // clock started from a GET is a paid attempt spent while the player was still reading the rules.
    await clearRounds();
    const { roundId, token } = await openRound();

    const state = await callPlay<PlayStateBody>(`/play/api/state?t=${token}`, undefined, "GET");
    assert.equal(state.status, 200);
    assert.equal(state.body.status, "created");

    const { Round } = await import("../src/store/round.model");
    const stored = await Round.findOne({ roundId });
    assert.equal(stored?.startedAt, undefined, "a GET started the clock");
    assert.equal(stored?.status, "created");
  });

  await test("resuming returns the same board rather than a new one", async () => {
    // A dropped mobile connection must not cost a board. The clock belongs to the round, not the
    // session, so resuming does not restart it either.
    await clearRounds();
    const { token } = await openRound();
    const first = await callPlay<PlayStateBody>("/play/api/session", { t: token });
    const again = await callPlay<PlayStateBody>("/play/api/session", { t: token });

    assert.equal(again.body.board?.index, first.body.board?.index);
    assert.deepEqual(again.body.board?.pairs, first.body.board?.pairs);
    assert.equal(again.body.endsAt, first.body.endsAt, "the clock restarted on resume");
  });

  console.log("");
  console.log("Submitting a board");

  await test("a correct solution is accepted and the next board is issued", async () => {
    await clearRounds();
    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });

    const paths = await solutionFor(roundId, 0);
    const response = await callPlay<{ accepted: boolean; state: PlayStateBody }>(
      "/play/api/submit",
      { t: token, boardIndex: 0, paths },
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.accepted, true);
    assert.equal(response.body.state.boardsSolved, 1);
    assert.equal(response.body.state.board?.index, 1, "no next board was issued");
  });

  await test("a wrong solution is refused by name, at HTTP 200", async () => {
    // A refusal is information for the player, not an error in the request. Returning 4xx would make
    // ordinary gameplay indistinguishable from a malformed call in every monitor the service has.
    await clearRounds();
    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });

    const paths = await solutionFor(roundId, 0);
    // Drop the last cell of the first path: the endpoints no longer match.
    const broken = paths.map((path, index) =>
      index === 0 ? { ...path, cells: path.cells.slice(0, -1) } : path,
    );

    const response = await callPlay<{ accepted: boolean; refusal: string; message: string }>(
      "/play/api/submit",
      { t: token, boardIndex: 0, paths: broken },
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.accepted, false);
    assert.ok(
      ["endpoints_do_not_match", "incomplete_coverage"].includes(response.body.refusal),
      `unexpected refusal '${response.body.refusal}'`,
    );
    assert.ok(response.body.message.length > 10, "no explanation for the player");
  });

  await test("a submission for a board that was never issued is refused", async () => {
    await clearRounds();
    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });

    const paths = await solutionFor(roundId, 4);
    const response = await callPlay("/play/api/submit", { t: token, boardIndex: 4, paths });
    assert.equal(response.status, 400);
  });

  await test("a board cannot be solved twice", async () => {
    // Each board is worth points once. Accepting a resubmission would let a player farm one board.
    await clearRounds();
    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });
    const paths = await solutionFor(roundId, 0);
    await callPlay("/play/api/submit", { t: token, boardIndex: 0, paths });

    const again = await callPlay("/play/api/submit", { t: token, boardIndex: 0, paths });
    assert.equal(again.status, 400);
  });

  await test("a score sent by the client is ignored entirely", async () => {
    // Section 7: "we will ignore any score arriving from the browser". Proven behaviourally rather
    // than by reading the code, because the interesting failure is a field somebody adds later.
    await clearRounds();
    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });
    const paths = await solutionFor(roundId, 0);

    await callPlay("/play/api/submit", {
      t: token,
      boardIndex: 0,
      paths,
      score: 999_999,
      rawScore: 999_999,
      durationMs: 1,
      solvedAt: new Date(0).toISOString(),
    });

    await callPlay("/play/api/leave", { t: token });

    const { Round } = await import("../src/store/round.model");
    const stored = await Round.findOne({ roundId });
    assert.ok((stored?.score ?? 0) < 999_999, `client score was honoured: ${stored?.score}`);
    assert.ok((stored?.score ?? 0) >= 1000, "a solved board scored nothing");
  });

  console.log("");
  console.log("Identical content, varied presentation (section 12)");

  await test("two players on one contentSeed face the same content", async () => {
    await clearRounds();
    const seed = "cv_ctst_fairness";
    const fingerprints: string[] = [];

    for (let player = 0; player < 4; player++) {
      const { token } = await openRound({
        contentSeed: seed,
        player: { playerId: `cv_p_fair_${player}` },
      });
      const state = await callPlay<PlayStateBody>("/play/api/session", { t: token });
      fingerprints.push(contentFingerprint(state.body.board!));
    }

    assert.equal(
      new Set(fingerprints).size,
      1,
      `content differed between players: ${fingerprints.join(" / ")}`,
    );
  });

  await test("a different contentSeed produces different content", async () => {
    await clearRounds();
    const fingerprints = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const { token } = await openRound({ contentSeed: `cv_ctst_vary_${i}` });
      const state = await callPlay<PlayStateBody>("/play/api/session", { t: token });
      fingerprints.add(contentFingerprint(state.body.board!));
    }
    // Not "all six differ": two unrelated boards can coincidentally share a distance multiset, and a
    // test that forbids that would fail on a correct generator. More than one is the real claim.
    assert.ok(fingerprints.size > 1, "every seed produced identical content");
  });

  await test("the same content is presented differently to different players", async () => {
    // The anti-collusion property, and the one that pulls against the test above. Section 12 asks for
    // it directly: shuffling per player "stops players simply telling each other that the answer is
    // B while keeping the challenge identical".
    await clearRounds();
    const seed = "cv_ctst_presentation";
    const presentations = new Set<string>();

    for (let player = 0; player < 8; player++) {
      const { token } = await openRound({
        contentSeed: seed,
        player: { playerId: `cv_p_pres_${player}` },
      });
      const state = await callPlay<PlayStateBody>("/play/api/session", { t: token });
      presentations.add(JSON.stringify(state.body.board!.pairs));
    }

    assert.ok(
      presentations.size > 1,
      "every player saw the identical orientation - the presentation transform is not applied",
    );
  });

  console.log("");
  console.log("Reaching a terminal state and reporting it (sections 8 and 13)");

  await test("finishing every board completes the round and delivers a result", async () => {
    await clearRounds();
    const { roundId, token } = await openRound({
      gameCode: "circuit-perfect",
      config: { boardCount: 3, gridSize: "small", unfinishedPenaltyMs: 120_000 },
    });

    await callPlay("/play/api/session", { t: token });
    for (let index = 0; index < 3; index++) {
      const paths = await solutionFor(roundId, index);
      const response = await callPlay<{ accepted: boolean }>("/play/api/submit", {
        t: token,
        boardIndex: index,
        paths,
      });
      assert.equal(response.body.accepted, true, `board ${index} was refused`);
    }

    await waitFor(() => received.length === 1, "the result callback");

    const event = received[0];
    assert.equal(event.signatureValid, true, "the callback signature did not verify");
    assert.equal(event.headers["x-timestamp"] !== undefined, true);
    assert.match(String(event.headers.authorization), /^Bearer /);
    assert.equal(event.body.status, "completed");
    assert.equal(event.body.eventType, "round.completed");
    assert.equal(event.body.roundId, roundId);
    assert.equal(typeof event.body.score, "number");
    assert.equal(typeof event.body.durationMs, "number");
    assert.ok(event.body.startedAt && event.body.completedAt, "timestamps missing");
    assert.ok(String(event.body.replayUrl).startsWith("http"));
  });

  await test("the delivered payload never contains the content seed", async () => {
    await clearRounds();
    const { roundId, token } = await openRound({ contentSeed: "SEEDCANARY3" });
    await callPlay("/play/api/session", { t: token });
    await callPlay("/play/api/leave", { t: token });
    await waitFor(() => received.length === 1, "the callback");
    assert.doesNotMatch(received[0].rawBody, /SEEDCANARY3/);
    assert.equal(received[0].body.roundId, roundId);
  });

  await test("leaving reports abandoned WITH the boards already solved", async () => {
    // Section 13: "please send a partial score if you can compute one - a dropped mobile signal
    // should not cost someone a paid entry".
    await clearRounds();
    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });
    const paths = await solutionFor(roundId, 0);
    await callPlay("/play/api/submit", { t: token, boardIndex: 0, paths });

    await callPlay("/play/api/leave", { t: token });
    await waitFor(() => received.length === 1, "the callback");

    assert.equal(received[0].body.status, "abandoned");
    assert.equal(received[0].body.eventType, "round.abandoned");
    assert.ok((received[0].body.score as number) >= 1000, "the solved board was not counted");
  });

  await test("a retried delivery reuses the same eventId", async () => {
    // Section 11: "unique per message and stable across your retries. This is how we avoid counting
    // one score twice." A regenerated id would make every retry a new score to the platform.
    await clearRounds();
    receiverBehaviour.failTimes = 2;

    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });
    await callPlay("/play/api/leave", { t: token });

    await waitFor(() => received.length >= 1, "the first attempt");

    const { attemptDelivery } = await import("../src/callback/deliver");
    await attemptDelivery(roundId);
    await attemptDelivery(roundId);

    assert.ok(received.length >= 3, `expected at least 3 attempts, saw ${received.length}`);
    const ids = new Set(received.map((event) => event.body.eventId));
    assert.equal(ids.size, 1, `eventId changed between retries: ${[...ids].join(", ")}`);
    for (const event of received) {
      assert.equal(event.signatureValid, true, "a retry was signed incorrectly");
    }
  });

  await test("a failed delivery schedules a later attempt rather than giving up", async () => {
    await clearRounds();
    receiverBehaviour.status = 500;

    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });
    await callPlay("/play/api/leave", { t: token });
    await waitFor(() => received.length >= 1, "the first attempt");

    const { Round } = await import("../src/store/round.model");
    await waitFor(async () => {
      const stored = await Round.findOne({ roundId });
      return Boolean(stored?.delivery.nextAttemptAt);
    }, "a scheduled retry");

    const stored = await Round.findOne({ roundId });
    assert.equal(stored?.delivery.acknowledgedAt, undefined, "a 500 was treated as acknowledged");
    assert.equal(stored?.delivery.gaveUpAt, undefined, "gave up on the first failure");
    assert.ok(stored!.delivery.nextAttemptAt!.getTime() > Date.now(), "retry scheduled in the past");
    assert.match(String(stored?.delivery.lastError), /500/);
  });

  await test("the retry backoff is capped inside the 24-hour window", async () => {
    // The failure this pins is silent. Doubling for ever looks like the careful choice and switches
    // the retry off: within a 24-hour window an uncapped delay eventually exceeds the window, so the
    // last hours contain no attempts at all while the delivery still counts as pending.
    const { delayFor } = await import("../src/callback/deliver");
    const window = 24 * 60 * 60_000;

    for (const attempt of [10, 20, 50, 200]) {
      assert.ok(
        delayFor(attempt) <= 4 * 60 * 60_000,
        `attempt ${attempt} waits ${delayFor(attempt)}ms, past the four-hour cap`,
      );
    }

    // And the schedule must actually land several attempts inside the window rather than one.
    let elapsed = 0;
    let attempts = 0;
    while (elapsed <= window && attempts < 1000) {
      elapsed += delayFor(attempts);
      attempts++;
    }
    assert.ok(attempts >= 10, `only ${attempts} attempts fit inside 24 hours`);
  });

  await test("a suppressed callback leaves a fetchable result and an unfinished delivery", async () => {
    // The sandbox control exists so the platform can prove its own recovery path works when a
    // message never arrives. Marking the delivery complete would be a different scenario - a provider
    // that had nothing to say - so it stays pending on purpose.
    await clearRounds();
    const { roundId, token } = await openRound();
    await callApi(`/sandbox/rounds/${roundId}/arm`, {
      method: "POST",
      body: { suppressCallback: true },
    });

    await callPlay("/play/api/session", { t: token });
    await callPlay("/play/api/leave", { t: token });

    const fetched = await callApi<{ status: string; score: number }>(`/v1/rounds/${roundId}`);
    assert.equal(fetched.body.status, "abandoned");
    assert.equal(typeof fetched.body.score, "number");

    // Several sweeper ticks, so the delivery has genuinely been ATTEMPTED and refused.
    //
    // Without this wait the test asserted nothing: it read the delivery record before any tick had
    // touched it, so "still pending" was true because nothing had run yet rather than because
    // suppression left it pending. A probe that marked a suppressed delivery acknowledged stayed
    // green. This is the general trap in a test with a background timer - the state you are
    // asserting about is the state before the code under test ran.
    await new Promise((resolve) => setTimeout(resolve, 600));

    assert.equal(received.length, 0, "a suppressed callback was delivered anyway");

    const { Round } = await import("../src/store/round.model");
    const stored = await Round.findOne({ roundId });
    assert.equal(stored?.delivery.acknowledgedAt, undefined);
    assert.ok(stored?.delivery.eventId, "no eventId was minted for the suppressed result");
  });

  await test("releasing a suppressed callback delivers the same eventId", async () => {
    await clearRounds();
    const { roundId, token } = await openRound();
    await callApi(`/sandbox/rounds/${roundId}/arm`, {
      method: "POST",
      body: { suppressCallback: true },
    });
    await callPlay("/play/api/session", { t: token });
    await callPlay("/play/api/leave", { t: token });

    const { Round } = await import("../src/store/round.model");
    const before = await Round.findOne({ roundId });

    await callApi(`/sandbox/rounds/${roundId}/deliver`, { method: "POST", body: {} });
    await waitFor(() => received.length === 1, "the released callback");

    assert.equal(received[0].body.eventId, before?.delivery.eventId);
    assert.equal(received[0].signatureValid, true);
  });

  await test("a practice round is never delivered", async () => {
    await clearRounds();
    const { roundId, token } = await openRound({ mode: "practice", contentSeed: undefined });
    await callPlay("/play/api/session", { t: token });
    await callPlay("/play/api/leave", { t: token });

    // Long enough for several sweeper ticks, so this proves the sweeper skips it rather than proving
    // the sweeper had not run yet.
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.equal(received.length, 0, "a practice result was reported");

    // But it is still fetchable in full, so nothing is hidden from the platform.
    const fetched = await callApi<{ status: string }>(`/v1/rounds/${roundId}`);
    assert.equal(fetched.body.status, "abandoned");
  });

  await test("a round can only reach a terminal state once", async () => {
    // Three things can end a round - the player finishing, the player leaving, the sweeper noticing a
    // deadline - and two can arrive at the same instant. A second terminal write would mint a second
    // eventId and report a second score.
    await clearRounds();
    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });

    const { finishRound } = await import("../src/rounds/lifecycle");
    const outcomes = await Promise.all([
      finishRound(roundId, { status: "completed" }),
      finishRound(roundId, { status: "expired" }),
      finishRound(roundId, { status: "abandoned" }),
    ]);

    const transitions = outcomes.filter((outcome) => outcome?.transitioned).length;
    assert.equal(transitions, 1, `${transitions} writers claimed the same round`);
  });

  await test("the running sweeper closes a round nobody came back to", async () => {
    // The whole reason a timer exists: a player who closes the tab tells us nothing, and there is no
    // request left to run any code in. Driven by the real interval rather than a direct call to
    // `sweepOnce`, because the overlap guard and the scheduling only exist on the timer's path.
    await clearRounds();
    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });

    const { Round } = await import("../src/store/round.model");
    await Round.updateOne({ roundId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    await waitFor(() => received.length === 1, "the callback from the sweeper");
    assert.equal(received[0].body.status, "expired");
    assert.equal(received[0].body.eventType, "round.expired");

    // And it must not be reported again on every subsequent tick. An acknowledged delivery is done.
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.equal(received.length, 1, `the result was delivered ${received.length} times`);
  });

  await test("a finished gameplay clock completes rather than expires", async () => {
    // A different deadline from `expiresAt`, and a different terminal state. Conflating the two would
    // report a player who played to the end of the timer as having expired - which reads to the
    // player as being cut off rather than as having finished.
    await clearRounds();
    const { roundId, token } = await openRound({
      config: { durationSeconds: 60, gridSize: "small" },
    });
    await callPlay("/play/api/session", { t: token });

    const { Round } = await import("../src/store/round.model");
    await Round.updateOne({ roundId }, { $set: { startedAt: new Date(Date.now() - 120_000) } });

    await waitFor(() => received.length === 1, "the callback");
    assert.equal(received[0].body.status, "completed");
  });

  await test("play is refused once the round is terminal", async () => {
    await clearRounds();
    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });
    await callPlay("/play/api/leave", { t: token });

    const paths = await solutionFor(roundId, 0);
    const response = await callPlay<{ accepted: boolean; state: PlayStateBody }>(
      "/play/api/submit",
      { t: token, boardIndex: 0, paths },
    );
    assert.equal(response.body.accepted, false);
    assert.equal(response.body.state.status, "abandoned");
  });

  console.log("");
  console.log("Sandbox controls (section 15)");

  await test("forcing a score overrides the computed one and says so", async () => {
    // A forced result that could not be told apart from an earned one would make every test built on
    // this control untrustworthy, so the breakdown keeps reporting what really happened.
    await clearRounds();
    const { roundId } = await openRound();
    const response = await callApi<{
      result: { score: number; scoreBreakdown: Record<string, unknown> };
    }>(`/sandbox/rounds/${roundId}/finish`, {
      method: "POST",
      body: { status: "completed", score: 4242 },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.result.score, 4242);
    assert.equal(response.body.result.scoreBreakdown.sandboxForcedScore, 4242);
    assert.ok(
      "sandboxComputedScore" in response.body.result.scoreBreakdown,
      "the real computed score was not recorded beside the forced one",
    );

    await waitFor(() => received.length === 1, "the callback");
    assert.equal(received[0].body.score, 4242);
  });

  await test("a forced score of zero is honoured, not discarded", async () => {
    // Zero is one of the most useful values to test ranking with, and a truthiness check would drop
    // it silently.
    await clearRounds();
    const { roundId } = await openRound();
    const response = await callApi<{ result: { score: number } }>(
      `/sandbox/rounds/${roundId}/finish`,
      { method: "POST", body: { status: "completed", score: 0 } },
    );
    assert.equal(response.body.result.score, 0);
  });

  await test("every terminal state can be forced", async () => {
    for (const status of ["completed", "abandoned", "expired", "voided"]) {
      await clearRounds();
      const { roundId } = await openRound();
      const response = await callApi<{ result: { status: string; eventType: string } }>(
        `/sandbox/rounds/${roundId}/finish`,
        { method: "POST", body: { status } },
      );
      assert.equal(response.body.result.status, status, `could not force '${status}'`);
      assert.equal(response.body.result.eventType, `round.${status}`);
    }
  });

  await test("a forced status the specification does not define is refused", async () => {
    await clearRounds();
    const { roundId } = await openRound();
    const response = await callApi(`/sandbox/rounds/${roundId}/finish`, {
      method: "POST",
      body: { status: "in_progress" },
    });
    assert.equal(response.status, 400);
  });

  await test("sandbox routes still require platform credentials", async () => {
    await clearRounds();
    const { roundId } = await openRound();
    const response = await callApi(`/sandbox/rounds/${roundId}/finish`, {
      method: "POST",
      body: { status: "completed" },
      secret: "wrong",
    });
    assert.equal(response.status, 401);
  });

  await stopService();
  return summary("Play and delivery tests");
}

main()
  .then((failed) => process.exit(failed > 0 ? 1 : 0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
