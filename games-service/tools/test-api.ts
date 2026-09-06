/**
 * HTTP API tests. Run with `npx tsx tools/test-api.ts`.
 *
 * WHAT THESE ARE FOR, AND IT IS NOT THE HAPPY PATH
 * -----------------------------------------------
 * A round that is created, played and reported correctly is the case a manual click-through finds
 * in ten seconds. What a manual test never finds is the double-tap that creates two rounds, the
 * `409` that should have been a `200`, the round that goes silent because nobody was watching, and
 * the HTML error page that arrives during an incident. Those are the cases the specification spends
 * most of its length on, and they are what is pinned here.
 *
 * One property is worth naming because it is easy to lose: every assertion about a score reaches it
 * through the ingestion path the platform would use, never by reading a value the test itself
 * seeded. A fixture that supplies the number under test has proven the consumer works and says
 * nothing at all about the producer - which is precisely how the platform shipped a provider
 * settlement path with no code writing `participant.score`.
 */

import assert from "node:assert/strict";

import {
  API_SECRET,
  callApi,
  clearRounds,
  startService,
  stopService,
  summary,
  test,
  tokenFromLaunchUrl,
} from "./api-harness";

const FUTURE = () => new Date(Date.now() + 60 * 60_000).toISOString();

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    roundId: `cv_rnd_${Math.random().toString(36).slice(2, 12)}`,
    gameCode: "circuit-sprint",
    mode: "ranked",
    player: { playerId: "cv_p_test", displayName: "Tester", locale: "en", country: "GR" },
    config: { durationSeconds: 120, gridSize: "medium" },
    contentSeed: "cv_ctst_000001",
    expiresAt: FUTURE(),
    resultCallbackUrl: "",
    returnUrl: "https://chartvolt.test/contests/1",
    ...overrides,
  };
}

async function main(): Promise<number> {
  await startService({ sandbox: true });
  const { callbackUrl } = await import("./api-harness");

  console.log("");
  console.log("Authentication (section 10)");

  await test("rejects a call with no credentials at all", async () => {
    const response = await fetch(`${(await import("./api-harness")).baseUrl}/v1/games`);
    assert.equal(response.status, 401);
    const body = (await response.json()) as { error?: { code?: string } };
    // JSON, not HTML - section 14 requires it and an unauthenticated call is the most likely
    // request to hit a framework default.
    assert.equal(body.error?.code, "UNAUTHENTICATED");
  });

  await test("rejects an unknown API key", async () => {
    const response = await callApi("/v1/games", { apiKey: "wrong_key_but_right_length_aaaa" });
    assert.equal(response.status, 401);
  });

  await test("rejects a signature made with the wrong secret", async () => {
    const response = await callApi("/v1/games", { secret: "not_the_secret" });
    assert.equal(response.status, 401);
    assert.equal((response.body as { error: { code: string } }).error.code, "SIGNATURE_INVALID");
  });

  await test("rejects a missing signature", async () => {
    const response = await callApi("/v1/games", { omitSignature: true });
    assert.equal(response.status, 401);
  });

  await test("rejects a timestamp older than five minutes", async () => {
    const response = await callApi("/v1/games", {
      timestamp: Math.floor(Date.now() / 1000) - 400,
    });
    assert.equal(response.status, 401);
    assert.equal((response.body as { error: { code: string } }).error.code, "TIMESTAMP_REJECTED");
  });

  await test("rejects a timestamp from the future, not only a stale one", async () => {
    // A one-sided check leaves an unbounded replay window to anyone willing to send a large
    // number, which is the easier of the two headers to forge.
    const response = await callApi("/v1/games", {
      timestamp: Math.floor(Date.now() / 1000) + 4000,
    });
    assert.equal(response.status, 401);
  });

  await test("accepts a correctly signed call", async () => {
    const response = await callApi("/v1/games");
    assert.equal(response.status, 200);
  });

  console.log("");
  console.log("Catalogue (section 6)");

  await test("publishes both titles with every required field", async () => {
    const response = await callApi<{ games: Record<string, unknown>[] }>("/v1/games");
    const games = response.body.games;
    assert.equal(games.length, 2);

    const required = [
      "gameCode",
      "displayName",
      "tagline",
      "description",
      "rulesSummary",
      "howToPlay",
      "thumbnailUrl",
      "bannerUrl",
      "family",
      "supportsCompetition",
      "supportsOneVsOne",
      "supportsPractice",
      "supportsContentSeed",
      "scoreDirection",
      "scoreType",
      "scoreRange",
      "maxDurationSeconds",
      "configSchema",
      "locales",
      "platforms",
      "status",
    ];
    for (const game of games) {
      for (const field of required) {
        // Read into a local first, so the disable sits on the line that actually indexes. A
        // directive on the `assert.ok(` line above covers that line only, and the sink is on the
        // next one - the warning survives and the directive is reported as unused, which is the
        // clearest possible signal and still easy to miss.
        // eslint-disable-next-line security/detect-object-injection
        const value = game[field];
        assert.ok(
          value !== undefined && value !== null,
          `${String(game.gameCode)} is missing '${field}'`,
        );
      }
    }
  });

  await test("the two titles rank in opposite directions", async () => {
    // The reason both titles exist. Section 6's warning is that a wrong `scoreDirection` means the
    // platform "ranks the entire field backwards and pays the worst player first", and a provider
    // offering only one direction never exercises the other side of that.
    const response = await callApi<{ games: { gameCode: string; scoreDirection: string }[] }>(
      "/v1/games",
    );
    const byCode = new Map(response.body.games.map((g) => [g.gameCode, g.scoreDirection]));
    assert.equal(byCode.get("circuit-sprint"), "higher_is_better");
    assert.equal(byCode.get("circuit-perfect"), "lower_is_better");
  });

  await test("every advertised artwork URL actually resolves", async () => {
    // A catalogue that advertises images which 404 is a provider bug that presents as a broken
    // platform page, and the platform caches it.
    const response = await callApi<{
      games: { thumbnailUrl: string; bannerUrl: string; iconUrl: string }[];
    }>("/v1/games");

    for (const game of response.body.games) {
      for (const url of [game.thumbnailUrl, game.bannerUrl, game.iconUrl]) {
        const asset = await fetch(url);
        assert.equal(asset.status, 200, `${url} returned ${asset.status}`);
        assert.match(asset.headers.get("content-type") ?? "", /svg/);
      }
    }
  });

  await test("an unknown asset is a JSON 404, not an HTML one", async () => {
    const { baseUrl } = await import("./api-harness");
    const response = await fetch(`${baseUrl}/assets/circuit-sprint/../../etc/passwd`);
    assert.ok(response.status >= 400);
    assert.doesNotMatch(await response.text(), /<html/i);
  });

  await test("an asset name from the prototype chain is refused", async () => {
    // Both `in` and object indexing walk the prototype chain, so `__proto__` and `toString` resolve
    // to truthy values that are not renderers. "Safe by accident" is not safe.
    const { baseUrl } = await import("./api-harness");
    for (const name of ["__proto__", "toString", "constructor"]) {
      const response = await fetch(`${baseUrl}/assets/circuit-sprint/${name}`);
      assert.equal(response.status, 404, `${name} was not refused`);
    }
  });

  console.log("");
  console.log("Creating a round (sections 7 and 11)");

  await test("creates a round and returns a launch URL", async () => {
    await clearRounds();
    const response = await callApi<{
      roundId: string;
      providerRoundId: string;
      launchUrl: string;
      launchUrlExpiresAt: string;
      status: string;
    }>("/v1/rounds", { method: "POST", body: createBody({ resultCallbackUrl: callbackUrl }) });

    assert.equal(response.status, 201);
    assert.ok(response.body.providerRoundId.startsWith("cvg_r_"));
    assert.match(response.body.launchUrl, /\/play\?t=/);
    assert.ok(new Date(response.body.launchUrlExpiresAt).getTime() > Date.now());
    assert.equal(response.body.status, "created");
  });

  await test("the launch URL does not leak the content seed", async () => {
    // Section 12: the seed is "never exposed to the player, in the page, the URL or any
    // client-visible response". A launch URL that carried it would let a player generate every
    // board in the contest before starting.
    await clearRounds();
    const body = createBody({ resultCallbackUrl: callbackUrl, contentSeed: "SEEDLEAKCANARY" });
    const response = await callApi<{ launchUrl: string }>("/v1/rounds", {
      method: "POST",
      body,
    });
    assert.doesNotMatch(response.body.launchUrl, /SEEDLEAKCANARY/);
    assert.doesNotMatch(response.raw, /SEEDLEAKCANARY/);
  });

  await test("the same roundId returns the same round and the same launch URL", async () => {
    // The double-tapped Play button. Section 11: "a player double-tapping Play must not consume two
    // paid attempts."
    await clearRounds();
    const body = createBody({ resultCallbackUrl: callbackUrl });
    const first = await callApi<{ providerRoundId: string; launchUrl: string }>("/v1/rounds", {
      method: "POST",
      body,
    });
    const second = await callApi<{ providerRoundId: string; launchUrl: string }>("/v1/rounds", {
      method: "POST",
      body,
    });

    assert.equal(second.body.providerRoundId, first.body.providerRoundId);
    assert.equal(second.body.launchUrl, first.body.launchUrl);

    const { Round } = await import("../src/store/round.model");
    assert.equal(await Round.countDocuments({}), 1, "a second round was created");
  });

  await test("simultaneous creates still produce one round", async () => {
    /*
     * A request that misses the pre-flight check still inserts, so the unique index rejects it, and
     * that loser must not surface as a 500 - handling the duplicate only in the pre-flight check
     * leaves exactly the hole the pre-flight check was added for.
     *
     * TEN, NOT TWO, AND THE REASON IS THE HONEST PART.
     * This was written with two requests and a comment asserting that "both miss the pre-flight
     * check". That is a claim about timing, not a fact: over HTTP one request can finish its read
     * and its insert before the other has read, in which case the duplicate-key branch never runs
     * and the test passes on the pre-flight path instead. It passes either way, because the two
     * mechanisms return the same answer - which is precisely why the gap was invisible. It showed up
     * as a PROBE that went red on one run and green on the next.
     *
     * Ten overlapping requests makes at least one collision effectively certain without making the
     * assertion depend on it. What is asserted is the property itself and not the mechanism: every
     * caller gets one round, and one round exists.
     */
    await clearRounds();
    const body = createBody({ resultCallbackUrl: callbackUrl });

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        callApi<{ providerRoundId: string }>("/v1/rounds", { method: "POST", body }),
      ),
    );

    for (const response of responses) {
      assert.ok(response.status < 400, `a concurrent create returned ${response.status}`);
      assert.equal(response.body.providerRoundId, responses[0].body.providerRoundId);
    }

    const { Round } = await import("../src/store/round.model");
    assert.equal(await Round.countDocuments({}), 1);
  });

  await test("the same roundId with different config is a 409", async () => {
    await clearRounds();
    const body = createBody({ resultCallbackUrl: callbackUrl });
    await callApi("/v1/rounds", { method: "POST", body });

    const collision = await callApi<{ error: { code: string; retryable: boolean } }>("/v1/rounds", {
      method: "POST",
      body: { ...body, config: { durationSeconds: 300, gridSize: "large" } },
    });

    assert.equal(collision.status, 409);
    assert.equal(collision.body.error.code, "ROUND_CONFLICT");
    // Retrying an identifier collision produces a second identical collision.
    assert.equal(collision.body.error.retryable, false);
  });

  await test("omitting a config value equal to its default is NOT a collision", async () => {
    // The fingerprint is taken after defaults are applied. Two requests describing the same round
    // in different words must not be refused as an identifier collision.
    await clearRounds();
    const body = createBody({ resultCallbackUrl: callbackUrl });
    await callApi("/v1/rounds", { method: "POST", body });

    const again = await callApi("/v1/rounds", {
      method: "POST",
      body: { ...body, config: { gridSize: "medium" } },
    });
    assert.ok(again.status < 400, `expected success, got ${again.status}: ${again.raw}`);
  });

  await test("a changed expiresAt is NOT a collision", async () => {
    // Excluded from the fingerprint deliberately: a retry whose timestamp was recomputed a second
    // later would otherwise be refused, failing a paid round for no reason.
    await clearRounds();
    const body = createBody({ resultCallbackUrl: callbackUrl });
    await callApi("/v1/rounds", { method: "POST", body });
    const again = await callApi("/v1/rounds", {
      method: "POST",
      body: { ...body, expiresAt: new Date(Date.now() + 90 * 60_000).toISOString() },
    });
    assert.ok(again.status < 400, `expected success, got ${again.status}`);
  });

  await test("a different player on the same roundId IS a collision", async () => {
    // The case the rule exists for. Accepting it silently would let one player play another's round.
    await clearRounds();
    const body = createBody({ resultCallbackUrl: callbackUrl });
    await callApi("/v1/rounds", { method: "POST", body });
    const collision = await callApi("/v1/rounds", {
      method: "POST",
      body: { ...body, player: { playerId: "cv_p_someone_else" } },
    });
    assert.equal(collision.status, 409);
  });

  await test("refuses a ranked round with no contentSeed", async () => {
    // Fails closed on the fairness guarantee. A permissive provider would generate its own content
    // and produce a paid contest in which players faced different puzzles - with no error, no log
    // line and no visible symptom.
    const response = await callApi<{ error: { code: string } }>("/v1/rounds", {
      method: "POST",
      body: createBody({ resultCallbackUrl: callbackUrl, contentSeed: undefined }),
    });
    assert.equal(response.status, 400);
    assert.match(response.raw, /contentSeed/);
  });

  await test("allows a practice round with no contentSeed", async () => {
    const response = await callApi("/v1/rounds", {
      method: "POST",
      body: createBody({
        resultCallbackUrl: callbackUrl,
        mode: "practice",
        contentSeed: undefined,
      }),
    });
    assert.ok(response.status < 400, `expected success, got ${response.status}: ${response.raw}`);
  });

  await test("refuses an expiresAt in the past", async () => {
    // Section 11 says a failed creation does not consume the attempt, so refusing returns it -
    // where accepting and immediately reporting `expired` would burn a paid attempt on a round
    // nobody could ever have played.
    const response = await callApi("/v1/rounds", {
      method: "POST",
      body: createBody({
        resultCallbackUrl: callbackUrl,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    });
    assert.equal(response.status, 400);
  });

  await test("refuses an unknown gameCode with a 404", async () => {
    const response = await callApi<{ error: { code: string } }>("/v1/rounds", {
      method: "POST",
      body: createBody({ resultCallbackUrl: callbackUrl, gameCode: "circuit-nonexistent" }),
    });
    assert.equal(response.status, 404);
    assert.equal(response.body.error.code, "UNKNOWN_GAME");
  });

  await test("refuses a non-URL callback address", async () => {
    const response = await callApi("/v1/rounds", {
      method: "POST",
      body: createBody({ resultCallbackUrl: "not-a-url" }),
    });
    assert.equal(response.status, 400);
  });

  await test("clamps an out-of-range config rather than refusing the round", async () => {
    // The platform validates config against our own schema before sending it, so a bad value
    // arriving means the two sides disagree. Refusing a paid round mid-contest is worse than
    // playing a 300-second board when 400 was asked for - but the disagreement is still recorded.
    await clearRounds();
    const body = createBody({
      resultCallbackUrl: callbackUrl,
      config: { durationSeconds: 9999, gridSize: "gigantic" },
    });
    const response = await callApi("/v1/rounds", { method: "POST", body });
    assert.equal(response.status, 201);

    const { Round } = await import("../src/store/round.model");
    const stored = await Round.findOne({ roundId: body.roundId });
    assert.equal((stored?.config as { durationSeconds: number }).durationSeconds, 300);
    assert.deepEqual([...(stored?.configCorrections ?? [])].sort(), [
      "durationSeconds",
      "gridSize",
    ]);
  });

  console.log("");
  console.log("Fetching a round (section 9)");

  await test("returns the same shape as a callback body", async () => {
    await clearRounds();
    const body = createBody({ resultCallbackUrl: callbackUrl });
    await callApi("/v1/rounds", { method: "POST", body });

    const fetched = await callApi<Record<string, unknown>>(`/v1/rounds/${body.roundId}`);
    assert.equal(fetched.status, 200);
    for (const field of [
      "roundId",
      "providerRoundId",
      "playerId",
      "gameCode",
      "status",
      "replayUrl",
      "integrity",
      "occurredAt",
    ]) {
      assert.ok(field in fetched.body, `fetch response is missing '${field}'`);
    }
  });

  await test("a round nobody has played reports no score", async () => {
    // Reporting zero would be a real number for a real ranking. On Circuit Perfect, a zero is a
    // winning time.
    await clearRounds();
    const body = createBody({ resultCallbackUrl: callbackUrl });
    await callApi("/v1/rounds", { method: "POST", body });

    const fetched = await callApi<Record<string, unknown>>(`/v1/rounds/${body.roundId}`);
    assert.equal(fetched.body.status, "created");
    assert.ok(!("score" in fetched.body), "a non-terminal round reported a score");
    assert.ok(!("eventId" in fetched.body), "a round that was never reported quoted an eventId");
  });

  await test("the fetch response never contains the content seed", async () => {
    await clearRounds();
    const body = createBody({ resultCallbackUrl: callbackUrl, contentSeed: "SEEDLEAKCANARY2" });
    await callApi("/v1/rounds", { method: "POST", body });
    const fetched = await callApi(`/v1/rounds/${body.roundId}`);
    assert.doesNotMatch(fetched.raw, /SEEDLEAKCANARY2/);
  });

  await test("an unknown roundId is a 404", async () => {
    const response = await callApi<{ error: { code: string } }>("/v1/rounds/cv_rnd_nope");
    assert.equal(response.status, 404);
    assert.equal(response.body.error.code, "UNKNOWN_ROUND");
  });

  await test("fetching an overdue round expires it on the spot", async () => {
    // The platform polls this precisely when it is close to settling, which is the one moment a
    // round whose deadline has passed but whose sweeper tick has not landed would be reported as
    // still running - a true statement about our database and a false one about the round.
    await clearRounds();
    const body = createBody({ resultCallbackUrl: callbackUrl });
    await callApi("/v1/rounds", { method: "POST", body });

    const { Round } = await import("../src/store/round.model");
    await Round.updateOne(
      { roundId: body.roundId },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    const fetched = await callApi<{ status: string; score: number; eventType: string }>(
      `/v1/rounds/${body.roundId}`,
    );
    assert.equal(fetched.body.status, "expired");
    assert.equal(fetched.body.eventType, "round.expired");
    assert.equal(typeof fetched.body.score, "number");
  });

  await test("an expired Circuit Perfect round reports the WORST time, not zero", async () => {
    // The mistake that would pay the wrong player. For a lower-is-better title a zero is the best
    // possible score, so a player who never loaded the game would win every contest.
    await clearRounds();
    const body = createBody({
      resultCallbackUrl: callbackUrl,
      gameCode: "circuit-perfect",
      config: { boardCount: 5, gridSize: "medium", unfinishedPenaltyMs: 120_000 },
    });
    await callApi("/v1/rounds", { method: "POST", body });

    const { Round } = await import("../src/store/round.model");
    await Round.updateOne(
      { roundId: body.roundId },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    const fetched = await callApi<{ status: string; score: number }>(
      `/v1/rounds/${body.roundId}`,
    );
    assert.equal(fetched.body.status, "expired");
    // Five unfinished boards at a two-minute penalty each.
    assert.ok(
      fetched.body.score >= 5 * 120_000,
      `expected a worst-case time, got ${fetched.body.score}`,
    );
  });

  await test("the replay URL is not guessable from the round id alone", async () => {
    await clearRounds();
    const body = createBody({ resultCallbackUrl: callbackUrl });
    const created = await callApi<{ providerRoundId: string }>("/v1/rounds", {
      method: "POST",
      body,
    });
    const fetched = await callApi<{ replayUrl: string }>(`/v1/rounds/${body.roundId}`);
    const token = new URL(fetched.body.replayUrl).searchParams.get("t") ?? "";
    assert.equal(token.length, 32);
    assert.notEqual(token, created.body.providerRoundId);
    // A substring check rather than a constructed RegExp: the secret is arbitrary text, so
    // compiling it as a pattern is both flagged by the linter and wrong the day it contains a
    // regex metacharacter.
    assert.ok(!token.includes(API_SECRET), "the replay token contains the signing secret");
  });

  console.log("");
  console.log("Voiding a round (section 5)");

  await test("voids a live round, records no score, and returns the attempt", async () => {
    await clearRounds();
    const body = createBody({ resultCallbackUrl: callbackUrl });
    await callApi("/v1/rounds", { method: "POST", body });

    const voided = await callApi<{ status: string; score?: number }>(
      `/v1/rounds/${body.roundId}/void`,
      { method: "POST", body: { reason: "Contest cancelled." } },
    );
    assert.equal(voided.status, 200);
    assert.equal(voided.body.status, "voided");
    // Section 13: a voided round is "not scored". A zero would read as a legitimately bad
    // performance on one title and as a win on the other.
    assert.ok(!("score" in voided.body), "a voided round carried a score");
  });

  await test("voiding twice is idempotent success", async () => {
    await clearRounds();
    const body = createBody({ resultCallbackUrl: callbackUrl });
    await callApi("/v1/rounds", { method: "POST", body });
    await callApi(`/v1/rounds/${body.roundId}/void`, { method: "POST", body: {} });
    const again = await callApi(`/v1/rounds/${body.roundId}/void`, { method: "POST", body: {} });
    assert.equal(again.status, 200);
  });

  await test("refuses to void a round that already has a result", async () => {
    await clearRounds();
    const body = createBody({ resultCallbackUrl: callbackUrl });
    const created = await callApi<{ launchUrl: string }>("/v1/rounds", { method: "POST", body });
    const token = tokenFromLaunchUrl(created.body.launchUrl);

    const { callPlay } = await import("./api-harness");
    await callPlay("/play/api/session", { t: token });
    await callPlay("/play/api/leave", { t: token });

    const voided = await callApi<{ error: { code: string } }>(`/v1/rounds/${body.roundId}/void`, {
      method: "POST",
      body: {},
    });
    assert.equal(voided.status, 409);
  });

  console.log("");
  console.log("Errors are always JSON (section 14)");

  await test("an unknown path is a JSON 404", async () => {
    const { baseUrl } = await import("./api-harness");
    const response = await fetch(`${baseUrl}/v1/nothing-here`);
    const text = await response.text();
    assert.equal(response.status, 401, "auth runs before routing under /v1");
    assert.doesNotMatch(text, /<html/i);

    const outside = await fetch(`${baseUrl}/definitely-not-a-route`);
    assert.equal(outside.status, 404);
    const body = (await outside.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "NOT_FOUND");
  });

  await test("a malformed JSON body is a JSON 400", async () => {
    const { baseUrl } = await import("./api-harness");
    const crypto = await import("crypto");
    const raw = "{ this is not json";
    const response = await fetch(`${baseUrl}/v1/rounds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${(await import("./api-harness")).API_KEY}`,
        "X-Timestamp": Math.floor(Date.now() / 1000).toString(),
        "X-Signature": `sha256=${crypto
          .createHmac("sha256", API_SECRET)
          .update(raw, "utf8")
          .digest("hex")}`,
      },
      body: raw,
    });
    assert.equal(response.status, 400);
    const body = (await response.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "INVALID_REQUEST");
    assert.doesNotMatch(JSON.stringify(body), /<html/i);
  });

  await test("every error body carries the retryable flag", async () => {
    // Section 14 singles this out: "that single boolean is often the difference between recovering a
    // player's round and wrongly consuming their paid attempt".
    const cases = [
      await callApi("/v1/rounds/cv_rnd_nope"),
      await callApi("/v1/rounds", { method: "POST", body: { roundId: "" } }),
      await callApi("/v1/games", { secret: "wrong" }),
    ];
    for (const response of cases) {
      const body = response.body as { error?: { retryable?: unknown } };
      assert.equal(
        typeof body.error?.retryable,
        "boolean",
        `missing retryable on ${response.status}`,
      );
    }
  });

  console.log("");
  console.log("Health");

  await test("health needs no credentials and discloses nothing about rounds", async () => {
    const { baseUrl } = await import("./api-harness");
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.ok, true);
    assert.ok(!("rounds" in body) && !("players" in body));
  });

  await stopService();
  return summary("API tests");
}

main()
  .then((failed) => process.exit(failed > 0 ? 1 : 0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
