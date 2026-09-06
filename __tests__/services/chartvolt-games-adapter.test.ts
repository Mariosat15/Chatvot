import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import crypto from "crypto";

import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
} from "../helpers/mongo-test-server";
import { WhiteLabel } from "../../database/models/whitelabel.model";
import { ChartVoltGamesAdapter } from "../../lib/services/game-providers/adapters/chartvolt-games.adapter";
import {
  getProviderAdapter,
  listRegisteredProviderKeys,
} from "../../lib/services/game-providers/registry";
import { syncProviderCatalogue } from "../../lib/services/game-providers/catalogue.service";
import ProviderGame from "../../database/models/games/provider-game.model";

/**
 * X4a: the ChartVolt Games adapter.
 *
 * WHAT THIS SUITE IS ACTUALLY FOR, AND WHAT IT CANNOT DO
 * -----------------------------------------------------
 * It tests the adapter against a stubbed `fetch`, so it proves the adapter's half of the
 * protocol: what it sends, how it signs it, and what it makes of every shape of answer. It does
 * NOT prove the two sides agree - a stub returns whatever it is told to, and a fixture that
 * supplies the value under test has tested the consumer rather than the producer. Agreement is
 * the end-to-end rehearsal against the running service, and that is a separate step.
 *
 * The one exception, and the highest-value assertion here, is the signature test. It recomputes
 * the HMAC from the STORED secret using the same construction the service's inbound guard uses,
 * so it does check a fact about both sides rather than only about this file.
 */

const PROVIDER_KEY = "chartvolt-games";
const BASE_URL = "http://127.0.0.1:4010";
const API_KEY = "cv-games-key";
const API_SECRET = "cv-games-secret";

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

let captured: CapturedRequest[] = [];
let respondWith: () => { status: number; body: string };

/**
 * Stubs `fetch` and records exactly what was sent.
 *
 * Recording the body as the STRING that was passed, never a re-parsed object, is deliberate: the
 * signature is over those bytes, and a test that compares parsed objects cannot see the mistake
 * this integration is most likely to make - signing one serialisation and sending another.
 */
function stubFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      captured.push({
        url: String(url),
        method: init.method ?? "GET",
        headers: (init.headers ?? {}) as Record<string, string>,
        body: typeof init.body === "string" ? init.body : "",
      });
      const { status, body } = respondWith();
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => body,
      } as Response;
    }),
  );
}

function ok(body: unknown): void {
  respondWith = () => ({ status: 200, body: JSON.stringify(body) });
}

function fail(status: number, body: unknown = {}): void {
  respondWith = () => ({ status, body: JSON.stringify(body) });
}

function catalogueEntry(overrides: Record<string, unknown> = {}) {
  return {
    gameCode: "circuit-sprint",
    displayName: "Circuit Sprint",
    description: "Trace the wires.",
    thumbnailUrl: `${BASE_URL}/assets/circuit-sprint/thumbnail.svg`,
    category: "puzzle",
    family: "independent",
    supportsCompetition: true,
    supportsOneVsOne: true,
    supportsPractice: true,
    supportsContentSeed: true,
    scoreDirection: "higher_is_better",
    scoreType: "integer",
    scoreRange: { min: 0, max: 60_000 },
    typicalDurationSeconds: 120,
    maxDurationSeconds: 300,
    configSchema: { type: "object", properties: {} },
    status: "active",
    ...overrides,
  };
}

function resultBody(overrides: Record<string, unknown> = {}) {
  return {
    eventId: "evt_1",
    eventType: "round.completed",
    occurredAt: "2026-09-06T10:00:00.000Z",
    roundId: "round-1",
    providerRoundId: "cvg_round-1",
    playerId: "player-1",
    gameCode: "circuit-sprint",
    status: "completed",
    score: 4200,
    scoreBreakdown: { boardsSolved: 7 },
    startedAt: "2026-09-06T09:58:00.000Z",
    completedAt: "2026-09-06T10:00:00.000Z",
    durationMs: 120_000,
    replayUrl: `${BASE_URL}/replay/cvg_round-1?t=abc`,
    integrity: { suspicious: false, flags: [] },
    ...overrides,
  };
}

/**
 * Seeds a fully configured provider.
 *
 * NO OPTIONAL OVERRIDES, AND THAT IS THE FIX FOR A TEST BUG WORTH RECORDING. The first version
 * took `{ apiSecret }` with a default, and the refusal test called it with `apiSecret: undefined`
 * to mean "omit the secret". A DEFAULT PARAMETER FIRES ON `undefined`, so the helper cheerfully
 * seeded the real secret, the call went through to the stub, and the test failed with a
 * completely unrelated message about the catalogue shape.
 *
 * The general form, which this codebase has already met at the schema layer: an absent value and
 * an explicitly-undefined one are indistinguishable through anything that defaults, so a test
 * that needs a field genuinely missing must build the document itself.
 */
async function seedSettings(): Promise<void> {
  await WhiteLabel.create({
    gameProviders: [{ providerKey: PROVIDER_KEY, enabled: true, baseUrl: BASE_URL }],
    gameProviderCredentials: [
      {
        providerKey: PROVIDER_KEY,
        environment: "sandbox",
        apiKey: API_KEY,
        apiSecret: API_SECRET,
      },
    ],
  });
}

function newRoundRequest() {
  return {
    roundId: "round-1",
    gameCode: "circuit-sprint",
    mode: "ranked" as const,
    player: { playerId: "player-1", displayName: "Player One", locale: "en" },
    config: { boardSize: 6 },
    contentSeed: "seed-abc",
    expiresAt: new Date("2026-09-06T12:00:00.000Z"),
    resultCallbackUrl: "https://chartvolt.test/api/games/providers/chartvolt-games/events",
    returnUrl: "https://chartvolt.test/competitions/1/play",
  };
}

let adapter: ChartVoltGamesAdapter;

beforeAll(async () => {
  await startTestMongo();
});

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
  captured = [];
  respondWith = () => ({ status: 200, body: "{}" });
  adapter = new ChartVoltGamesAdapter();
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("registration", () => {
  it("is registered under its own key in both the map and the lookup", () => {
    expect(listRegisteredProviderKeys()).toContain(PROVIDER_KEY);
    expect(getProviderAdapter(PROVIDER_KEY)?.providerKey).toBe(PROVIDER_KEY);
  });

  it("declares no match support, because there is no match endpoint", () => {
    /*
     * Both titles declare `supportsOneVsOne: true` while the provider declares
     * `supportsMatches: false`, and asserting them together is the point: a reviewer seeing one
     * of them alone would read it as a bug. A 1v1 here is two independent rounds compared, which
     * the platform runs itself; a "match" is a shared object the provider hosts, and there is no
     * endpoint to create one. Declaring it true would let the admin panel offer a format the
     * provider refuses at play time.
     */
    expect(adapter.capabilities()).toEqual({
      supportsVoid: true,
      supportsMatches: false,
      supportsPractice: true,
      supportsSeeding: true,
    });
  });
});

describe("configuration refusals", () => {
  it("names the base URL and the credentials separately", async () => {
    /*
     * Two messages, not one, and the reason is which screen an operator opens. A base URL is
     * edited on the provider card and a secret in the credentials dialog, and those are
     * different permissions - so "the provider is not configured" sends people to the wrong
     * place half the time.
     */
    await WhiteLabel.create({
      gameProviders: [{ providerKey: PROVIDER_KEY, enabled: true }],
      gameProviderCredentials: [],
    });
    const noUrl = await adapter.listGames();
    expect(noUrl).toMatchObject({ success: false });
    expect(noUrl.success ? "" : noUrl.error).toMatch(/base URL/i);

    await clearTestMongo();
    // Built here rather than through a helper with an override, because the field must be
    // genuinely absent - see the note on `seedSettings`.
    await WhiteLabel.create({
      gameProviders: [{ providerKey: PROVIDER_KEY, enabled: true, baseUrl: BASE_URL }],
      gameProviderCredentials: [
        { providerKey: PROVIDER_KEY, environment: "sandbox", apiKey: API_KEY },
      ],
    });
    const noSecret = await adapter.listGames();
    expect(noSecret).toMatchObject({ success: false });
    expect(noSecret.success ? "" : noSecret.error).toMatch(/credentials/i);
  });

  it("does not call the provider at all when unconfigured", async () => {
    const result = await adapter.createRound(newRoundRequest());
    expect(result.success).toBe(false);
    // A request with no credentials would arrive at the provider as an unauthenticated call and
    // be logged there as a possible attack, which is a false alarm we can avoid entirely.
    expect(captured).toHaveLength(0);
  });

  it("refuses a missing configuration as NOT retryable", async () => {
    const result = await adapter.listGames();
    expect(result.success).toBe(false);
    // Retrying cannot fix a setting nobody has typed. Marking it retryable would put the
    // reconciliation net into a backoff loop against a fault only a human can clear.
    expect(result.success ? undefined : result.retryable).toBe(false);
  });
});

describe("the signed request", () => {
  beforeEach(async () => {
    await seedSettings();
  });

  it("signs the exact bytes it sends, verifiably with the stored secret", async () => {
    ok({ roundId: "round-1", providerRoundId: "cvg_round-1", launchUrl: `${BASE_URL}/play/x` });
    await adapter.createRound(newRoundRequest());

    expect(captured).toHaveLength(1);
    const sent = captured[0];

    /*
     * THE ASSERTION THAT MATTERS MOST IN THIS FILE.
     *
     * It recomputes the HMAC from the body string that was actually passed to `fetch`, using the
     * secret as it was stored. If the adapter ever serialises twice - signing one string and
     * sending another - this is the only test here that notices, and the production symptom
     * would be every single call rejected as forged.
     */
    const expected = crypto
      .createHmac("sha256", API_SECRET)
      .update(sent.body, "utf8")
      .digest("hex");
    expect(sent.headers["X-Signature"]).toBe(`sha256=${expected}`);
    expect(sent.headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(Number(sent.headers["X-Timestamp"])).toBeCloseTo(Date.now() / 1000, -1);
  });

  it("never puts the secret in a header or the body", async () => {
    ok({ roundId: "round-1", providerRoundId: "cvg_round-1", launchUrl: `${BASE_URL}/play/x` });
    await adapter.createRound(newRoundRequest());

    const sent = captured[0];
    // The secret proves possession by signing; sending it would make every intermediary that
    // logs a header a place the credential leaks.
    expect(JSON.stringify(sent.headers)).not.toContain(API_SECRET);
    expect(sent.body).not.toContain(API_SECRET);
  });

  it("signs a GET over an empty string and sends no body", async () => {
    ok({ games: [catalogueEntry()] });
    await adapter.listGames();

    const sent = captured[0];
    expect(sent.method).toBe("GET");
    expect(sent.body).toBe("");
    // Signed over exactly nothing - not "undefined", not "{}". The provider verifies against the
    // bytes it received, and there were none.
    const expected = crypto.createHmac("sha256", API_SECRET).update("", "utf8").digest("hex");
    expect(sent.headers["X-Signature"]).toBe(`sha256=${expected}`);
  });

  it("sends the round request in the shape the specification names", async () => {
    ok({ roundId: "round-1", providerRoundId: "cvg_round-1", launchUrl: `${BASE_URL}/play/x` });
    await adapter.createRound(newRoundRequest());

    const body = JSON.parse(captured[0].body);
    expect(body).toMatchObject({
      roundId: "round-1",
      gameCode: "circuit-sprint",
      mode: "ranked",
      player: { playerId: "player-1" },
      contentSeed: "seed-abc",
      // ISO 8601 with a timezone. A Date serialised any other way is a parse failure on the
      // provider's side that reads as a malformed request.
      expiresAt: "2026-09-06T12:00:00.000Z",
    });
    /*
     * THE EXACT KEY SETS, not a subset check, and the difference matters here more than usual.
     *
     * A provider must never receive an email, a real name, a user id or anything wallet-shaped -
     * the pseudonymous `playerId` is the entire point of the player block. A `toMatchObject`
     * assertion cannot see a field that should not be there, and a field nobody asked about is
     * the only way to notice one nobody expected. That is how the admin credential-rotation bug
     * was found.
     *
     * The first version of this assertion filtered the expected list by the received object,
     * which made it very nearly a tautology - it would have passed for almost any payload.
     */
    expect(Object.keys(body).sort()).toEqual([
      "config",
      "contentSeed",
      "expiresAt",
      "gameCode",
      "mode",
      "player",
      "resultCallbackUrl",
      "returnUrl",
      "roundId",
    ]);
    // `country` is absent from the request, and `JSON.stringify` drops undefined - so a change
    // that started sending `country: null` instead would turn this red.
    expect(Object.keys(body.player).sort()).toEqual([
      "displayName",
      "locale",
      "playerId",
    ]);
  });

  it("percent-encodes a round id into the path", async () => {
    ok(resultBody({ roundId: "a/b?c" }));
    await adapter.fetchRound("a/b?c");
    // Unencoded, "a/b?c" would address a different endpoint entirely and the query string would
    // be read as parameters - a request that succeeds against the wrong resource.
    expect(captured[0].url).toBe(`${BASE_URL}/v1/rounds/a%2Fb%3Fc`);
  });
});

describe("error mapping", () => {
  beforeEach(async () => {
    await seedSettings();
  });

  it("treats the provider's own retryable flag as authoritative", async () => {
    // Chapter 01 section 6a. A 500 would otherwise be retryable by status; the provider saying
    // otherwise wins, because they know whether the fault is transient and we are guessing.
    fail(500, { error: { code: "PERMANENT", message: "Do not retry.", retryable: false } });
    const result = await adapter.listGames();
    expect(result).toMatchObject({ success: false, retryable: false, code: "PERMANENT" });
  });

  it.each([
    [401, false],
    [403, false],
    [404, false],
    [409, false],
    [422, false],
    [429, true],
    [500, true],
    [503, true],
  ])("maps HTTP %i to retryable=%s when the provider says nothing", async (status, retryable) => {
    fail(status, {});
    const result = await adapter.fetchRound("round-1");
    expect(result.success ? undefined : result.retryable).toBe(retryable);
  });

  it("treats an unenumerated 4xx as NOT retryable", async () => {
    // Fail-closed for this particular question: retrying a request already refused on its merits
    // turns our bug into an outage on somebody else's service.
    fail(418, {});
    const result = await adapter.fetchRound("round-1");
    expect(result.success ? undefined : result.retryable).toBe(false);
  });

  it("survives a non-JSON error body and still carries the retry decision", async () => {
    respondWith = () => ({ status: 502, body: "<html>Bad Gateway</html>" });
    const result = await adapter.fetchRound("round-1");
    expect(result).toMatchObject({ success: false, retryable: true });
    expect(result.success ? "" : result.error).toMatch(/502/);
  });

  it("reports an unreachable provider as retryable rather than throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    // Never throws, for the reason in `contract.ts`: a throw reaches a player as "An error
    // occurred in Server Components render", and a provider WILL be unreachable sometimes.
    const result = await adapter.listGames();
    expect(result).toMatchObject({ success: false, retryable: true });
  });
});

describe("the catalogue", () => {
  beforeEach(async () => {
    await seedSettings();
  });

  it("normalises a title and keeps the config schema intact", async () => {
    ok({ games: [catalogueEntry()] });
    const result = await adapter.listGames();
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      gameCode: "circuit-sprint",
      family: "independent",
      scoreDirection: "higher_is_better",
      scoreType: "integer",
      status: "active",
      scoreRange: { min: 0, max: 60_000 },
    });
    // The admin contest form is generated from this, so a schema mangled in transit is a form
    // that cannot express the settings the provider will accept.
    expect(result.data[0].configSchema).toEqual({ type: "object", properties: {} });
  });

  it("skips an unusable title without losing the usable ones", async () => {
    // A catalogue is a list. One bad row must not cost the others, or the sync reports a total
    // failure and leaves the whole cache stale because of a single title.
    ok({
      games: [
        catalogueEntry(),
        catalogueEntry({ gameCode: "broken", scoreDirection: "sideways" }),
      ],
    });
    const result = await adapter.listGames();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.map((g) => g.gameCode)).toEqual(["circuit-sprint"]);
  });

  it("fails rather than succeeding empty when EVERY title is unusable", async () => {
    /*
     * The distinction the sync depends on. An empty catalogue is a valid answer meaning "we list
     * nothing"; every row being unusable is a fault. Reporting the second as an empty success
     * would make the sync list every title we already have as missing from the provider.
     */
    ok({ games: [catalogueEntry({ family: "nonsense" })] });
    const result = await adapter.listGames();
    expect(result).toMatchObject({ success: false, code: "MALFORMED_CATALOGUE" });
  });

  it("accepts a genuinely empty catalogue as a success", async () => {
    ok({ games: [] });
    await expect(adapter.listGames()).resolves.toMatchObject({ success: true });
  });

  it("refuses a response with no games array", async () => {
    ok({ titles: [catalogueEntry()] });
    await expect(adapter.listGames()).resolves.toMatchObject({
      success: false,
      code: "MALFORMED_CATALOGUE",
    });
  });

  it("treats an unrecognised status as maintenance, not active", async () => {
    // Fail closed. Being wrong downward costs an operator one click; being wrong upward puts an
    // untested game in front of paying players.
    ok({ games: [catalogueEntry({ status: "beta" })] });
    const result = await adapter.listGames();
    expect(result.success && result.data[0].status).toBe("maintenance");
  });

  it("reads a capability flag strictly, so a string does not enable it", async () => {
    /*
     * `supportsContentSeed` decides whether a title may take entry fees at all, because without
     * identical content a contest is not a fair comparison. The string "false" is truthy, and
     * some JSON generators and every form encoding produce it.
     */
    ok({ games: [catalogueEntry({ supportsContentSeed: "false" })] });
    const result = await adapter.listGames();
    expect(result.success && result.data[0].supportsContentSeed).toBe(false);
  });

  it("syncs end to end into provider_game with our switch still off", async () => {
    ok({
      games: [
        catalogueEntry(),
        catalogueEntry({
          gameCode: "circuit-perfect",
          displayName: "Circuit Perfect",
          scoreDirection: "lower_is_better",
          scoreType: "duration_ms",
        }),
      ],
    });

    const sync = await syncProviderCatalogue(adapter);
    expect(sync).toMatchObject({ success: true, received: 2, created: 2 });

    const rows = await ProviderGame.find({ providerKey: PROVIDER_KEY })
      .sort({ gameCode: 1 })
      .lean();
    expect(rows.map((r) => r.gameKey)).toEqual([
      "provider:chartvolt-games:circuit-perfect",
      "provider:chartvolt-games:circuit-sprint",
    ]);
    // A sync must never put a title in front of players by itself. `chartvoltEnabled` is OUR
    // switch and stays false until an operator has tested the game.
    expect(rows.every((r) => r.chartvoltEnabled === false)).toBe(true);
    // The lower-is-better sibling is the reason there are two titles: a catalogue of only
    // upward-ranked games lets a sign error pass every test, and that error pays the worst
    // player first.
    expect(rows[0].scoreDirection).toBe("lower_is_better");
  });
});

describe("reading a result", () => {
  beforeEach(async () => {
    await seedSettings();
  });

  it("normalises a completed round", async () => {
    ok(resultBody());
    const result = await adapter.fetchRound("round-1");
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toMatchObject({
      roundId: "round-1",
      providerRoundId: "cvg_round-1",
      status: "completed",
      rawScore: 4200,
      scoreDirection: "higher_is_better",
      durationMs: 120_000,
    });
    expect(result.data.completedAt).toBeInstanceOf(Date);
    expect(result.data.occurredAt).toBeInstanceOf(Date);
  });

  it("refuses a round still in progress with a distinguishable code", async () => {
    /*
     * `NormalisedRoundResult.status` is typed to the four TERMINAL states, because it describes a
     * finished round. Coercing `in_progress` to `abandoned` or `expired` would hand
     * reconciliation a terminal state for a round the player is still playing - which would
     * settle a contest against a score that was still being earned.
     */
    ok(resultBody({ status: "in_progress", score: undefined }));
    const result = await adapter.fetchRound("round-1");
    expect(result).toMatchObject({
      success: false,
      code: "ROUND_PENDING",
      retryable: true,
    });
  });

  it.each(["completed", "abandoned", "expired", "voided"])(
    "accepts the terminal status %s",
    async (status) => {
      ok(resultBody({ status }));
      await expect(adapter.fetchRound("round-1")).resolves.toMatchObject({ success: true });
    },
  );

  it("reads the direction from the game code, both ways", async () => {
    ok(resultBody({ gameCode: "circuit-perfect", score: 41_000 }));
    const perfect = await adapter.fetchRound("round-1");
    expect(perfect.success && perfect.data.scoreDirection).toBe("lower_is_better");

    ok(resultBody({ gameCode: "circuit-sprint" }));
    const sprint = await adapter.fetchRound("round-1");
    expect(sprint.success && sprint.data.scoreDirection).toBe("higher_is_better");
  });

  it("defaults an unknown game code upward, matching settlement exactly", async () => {
    /*
     * Not laziness, and the alternative is worse. Settlement's `resolveContestScoreDirection`
     * defaults an unresolvable title to higher-is-better; if this defaulted differently the two
     * components would disagree, and a result that looks plausible but cannot be explained to a
     * player is worse than one that is uniformly and visibly wrong.
     */
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    ok(resultBody({ gameCode: "some-future-game" }));
    const result = await adapter.fetchRound("round-1");
    expect(result.success && result.data.scoreDirection).toBe("higher_is_better");
    // Loud, because for a first-party provider it means the service shipped a game the platform
    // was never updated for.
    expect(warn).toHaveBeenCalled();
  });

  it("keeps the breakdown but never lets it near ranking", async () => {
    ok(resultBody());
    const result = await adapter.fetchRound("round-1");
    expect(result.success && result.data.breakdown).toEqual({ boardsSolved: 7 });
    // Display only, chapter 01 section 5.4. `rawScore` is the only field that may influence a
    // ranking, and it is not read from the breakdown.
    expect(result.success && result.data.rawScore).toBe(4200);
  });

  it("ignores an unparseable date rather than storing an Invalid Date", async () => {
    // An Invalid Date is truthy, survives assignment onto a Mongoose Date path, and fails far
    // from here with a CastError - or stores and formats as "Invalid Date" on a screen.
    ok(resultBody({ completedAt: "not a date" }));
    const result = await adapter.fetchRound("round-1");
    expect(result.success && result.data.completedAt).toBeUndefined();
  });

  it("does not let the provider repoint our round id", async () => {
    ok({
      roundId: "round-1",
      providerRoundId: "cvg_round-1",
      launchUrl: `${BASE_URL}/play/x`,
    });
    const created = await adapter.createRound({ ...newRoundRequest(), roundId: "ours" });
    // Echoed from the REQUEST, not the response. A provider echoing the wrong id would otherwise
    // repoint our round record at a different round.
    expect(created.success && created.data.roundId).toBe("ours");
  });

  it("refuses a created round with no launch URL, and does not invite a retry", async () => {
    ok({ roundId: "round-1", providerRoundId: "cvg_round-1" });
    const created = await adapter.createRound(newRoundRequest());
    expect(created).toMatchObject({ success: false, code: "MALFORMED_ROUND" });
    // NOT retryable: the round probably exists on their side, so a retry is a second create for
    // a round we already cannot launch. A human is needed, and `fetchRound` can recover it.
    expect(created.success ? undefined : created.retryable).toBe(false);
  });

  it("reads the same payload identically through the callback and the fetch", async () => {
    /*
     * ONE PARSER, PROVEN RATHER THAN ASSERTED IN A COMMENT.
     *
     * If these two ever diverge, reconciliation - whose entire job is to answer "did we miss a
     * result" - can report a different score from the callback it is checking for, and there is
     * no way to tell which is the bug. This codebase has had that failure four times, and
     * `check:mirrors` saw none of them because it compares models.
     */
    const payload = resultBody();
    ok(payload);
    const fetched = await adapter.fetchRound("round-1");
    const parsed = adapter.parseCallback(JSON.stringify(payload));

    expect(fetched.success).toBe(true);
    expect(parsed.success).toBe(true);
    if (!fetched.success || !parsed.success) return;
    expect(parsed.data).toEqual(fetched.data);
  });

  it("rejects a callback body that is not JSON, and one that is not an object", async () => {
    expect(adapter.parseCallback("not json")).toMatchObject({ success: false });
    expect(adapter.parseCallback("[]")).toMatchObject({ success: false });
    expect(adapter.parseCallback('"a string"')).toMatchObject({ success: false });
  });

  it("rejects a result with no roundId and one with no status", async () => {
    const noRound = adapter.parseCallback(JSON.stringify(resultBody({ roundId: undefined })));
    expect(noRound).toMatchObject({ success: false });
    const noStatus = adapter.parseCallback(JSON.stringify(resultBody({ status: undefined })));
    expect(noStatus).toMatchObject({ success: false });
  });
});

describe("the adapter's callback check (gate 5b)", () => {
  const validHeaders = () => ({
    authorization: "Bearer cv-callback-token",
    "x-timestamp": Math.floor(Date.now() / 1000).toString(),
    "x-signature": `sha256=${"a".repeat(64)}`,
  });

  it("accepts a well-formed callback", () => {
    expect(adapter.verifyCallback('{"roundId":"r"}', validHeaders())).toEqual({ valid: true });
  });

  it("is not a formality - it refuses every missing or malformed header", () => {
    /*
     * The ingestion service is explicit that an adapter returning `{ valid: true }` without
     * checking anything is "a review failure, not a shortcut". This one cannot recompute the
     * HMAC - `verifyCallback` is SYNCHRONOUS and the secret is behind `select: false` in the
     * database - so it checks everything that is possible without a secret, and each refusal
     * names a different cause, because a missing header and a wrong signature send an operator
     * to different places.
     */
    const cases: [string, Record<string, string>, RegExp][] = [
      ["no authorization", { ...validHeaders(), authorization: "" }, /authorization/i],
      ["no signature", { ...validHeaders(), "x-signature": "" }, /x-signature header/i],
      [
        "truncated signature",
        { ...validHeaders(), "x-signature": "sha256=abc" },
        /64 hex/i,
      ],
      [
        "bare hex with no prefix",
        { ...validHeaders(), "x-signature": "a".repeat(64) },
        /64 hex/i,
      ],
      ["no timestamp", { ...validHeaders(), "x-timestamp": "" }, /timestamp/i],
      [
        "stale timestamp",
        {
          ...validHeaders(),
          "x-timestamp": Math.floor((Date.now() - 6 * 60 * 1000) / 1000).toString(),
        },
        /window/i,
      ],
      [
        "timestamp far in the future",
        {
          ...validHeaders(),
          "x-timestamp": Math.floor((Date.now() + 6 * 60 * 1000) / 1000).toString(),
        },
        /window/i,
      ],
    ];

    for (const [label, headers, expected] of cases) {
      const verdict = adapter.verifyCallback('{"roundId":"r"}', headers);
      expect(verdict.valid, `${label} was accepted`).toBe(false);
      expect(verdict.reason ?? "", label).toMatch(expected);
    }
  });

  it("reads headers case-insensitively", () => {
    // HTTP header names are case-insensitive and runtimes hand them over differently. A check
    // that only matched lower-case would reject every callback from a runtime that does not.
    const headers = {
      Authorization: "Bearer t",
      "X-Timestamp": Math.floor(Date.now() / 1000).toString(),
      "X-Signature": `sha256=${"A".repeat(64)}`,
    };
    expect(adapter.verifyCallback('{"roundId":"r"}', headers)).toEqual({ valid: true });
  });

  it("refuses an empty body", () => {
    // An empty body cannot carry a result, and signing nothing is a valid HMAC - so without this
    // an empty POST with correct-looking headers reaches the parser.
    expect(adapter.verifyCallback("", validHeaders()).valid).toBe(false);
  });
});
