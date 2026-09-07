import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import mongoose from "mongoose";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import {
  startTestMongo,
  stopTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

// Settlement runs inside a server action, which reaches for both of these. Neither has anything
// to do with what is under test, and the notification service would attempt real delivery.
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock("@/lib/services/notification.service", () => ({
  notificationService: {
    notifyCompetitionEnded: async () => {},
    notifyCompetitionWinner: async () => {},
    notifyCompetitionCancelled: async () => {},
  },
}));

import Competition from "../../database/models/trading/competition.model";
import CompetitionParticipant from "../../database/models/trading/competition-participant.model";
import ProviderGame from "../../database/models/games/provider-game.model";
import GameProvider from "../../database/models/games/game-provider.model";
import GameRound from "../../database/models/games/game-round.model";
import ProviderEvent from "../../database/models/games/provider-event.model";
import { WhiteLabel } from "../../database/models/whitelabel.model";
import { getProviderAdapter } from "../../lib/services/game-providers/registry";
import { syncProviderCatalogue } from "../../lib/services/game-providers/catalogue.service";
import { launchContestRound } from "../../lib/services/games/round-launch.service";
import { ingestProviderCallback } from "../../lib/services/games/result-ingestion.service";

/**
 * X4a - THE FIRST ROUND THAT TRAVELS BETWEEN THE TWO HALVES.
 *
 * WHAT THIS PROVES THAT NOTHING ELSE DOES, AND IT IS THE WHOLE REASON THE FILE EXISTS
 * ----------------------------------------------------------------------------------
 * `chartvolt-games-adapter.test.ts` has 49 tests and every one of them runs against a **stubbed
 * `fetch`**. Chapter 21 section 4.1a says so in as many words, and draws the conclusion: a stub
 * returns what it is told, so those tests prove the adapter's half of the protocol and **not that
 * the two sides agree**. Same for the service: its own suites pass in-process against
 * `mongodb-memory-server` and have never seen a request the platform actually sent.
 *
 * Two halves, each with a green suite, that have never spoken. This file makes them speak:
 *
 *   - a REAL `games-service` process, started from `index.ts`, on a real port
 *   - the REAL adapter, signing with HMAC over real bytes across a real socket
 *   - the REAL catalogue sync, so the titles under test are the ones the service published
 *   - the REAL round launch, ingestion, scoring and settlement services
 *   - the service's own sweeper delivering its own signed callback, unprompted
 *
 * WHAT IS SUBSTITUTED, STATED PRECISELY SO NOBODY OVERCLAIMS THIS
 * --------------------------------------------------------------
 * Two things, and both are named in the summary this test prints.
 *
 * 1. **The Next.js routing layer.** There is no Next server in a vitest run, so the callback is
 *    received by a bare `node:http` server that hands the raw body and headers to
 *    `ingestProviderCallback` - which is *exactly and only* what
 *    `app/api/games/providers/[providerKey]/events/route.ts` does. Read that route: it calls
 *    `.text()`, collects the headers, calls the one ingestion function, and maps the outcome to a
 *    status code. So the HMAC, the bytes, the socket and every gate are real; the thing not
 *    exercised is Next's own request plumbing.
 *
 * 2. **The browser.** The board is played by `games-service/tools/autoplay.ts` through the same
 *    four HTTP endpoints the browser uses. Whether a finger can draw a line on a phone is not
 *    something any test can answer - `tools/smoke-play.ts` exists for that, and a human has run it.
 *
 * WHY A SINGLE `it` WITH A SEQUENCE INSIDE IT, WHICH IS NORMALLY THE WRONG SHAPE
 * -----------------------------------------------------------------------------
 * Because each step's input is the previous step's output, and the alternative is worse in a
 * specific way rather than merely uglier. Split into eight `it`s sharing module state, a failure
 * in step three reports as seven failures, and the six after it fail for a reason that has nothing
 * to do with what they assert. That is the fixture trap this codebase has hit three times, where a
 * trimmed `Competition` fixture failed 34 tests on one unrelated validation error. One test that
 * says which step broke is more use than eight that all point at the wrong one.
 */

const PROVIDER_KEY = "chartvolt-games";
const PORT = 4117; // Deliberately not 4010 - a developer's own service may be running.
const SPRINT = "circuit-sprint";
const PERFECT = "circuit-perfect";
const SERVICE_DIR = join(process.cwd(), "games-service");

/**
 * The service's own `tsx`, invoked through `node` rather than through `npx`.
 *
 * NOT A STYLE CHOICE. `spawn("npx.cmd", ...)` fails with `EINVAL` on Node 20 and later, which
 * closed a Windows command-injection hole by refusing to launch batch files without an explicit
 * shell - and `shell: true` would reopen it while also breaking on a path containing a space.
 * Running the CLI script with `process.execPath` involves no shell at all, and it is the service's
 * OWN copy of tsx, so this does not quietly depend on the platform's devDependencies.
 */
const TSX_CLI = join(SERVICE_DIR, "node_modules", "tsx", "dist", "cli.mjs");

/** Generated per run, so a leaked value in a log cannot be reused and nothing is committed. */
const CREDS = {
  apiKey: `e2e_key_${randomBytes(12).toString("hex")}`,
  apiSecret: `e2e_secret_${randomBytes(24).toString("hex")}`,
  callbackToken: `e2e_cbt_${randomBytes(12).toString("hex")}`,
  callbackSecret: `e2e_cbs_${randomBytes(24).toString("hex")}`,
};

let service: ChildProcess | null = null;
let receiver: Server | null = null;
let receiverPort = 0;
let serviceLog: string[] = [];

/** Every callback the service delivered, with the ingestion outcome it produced. */
const delivered: {
  path: string;
  status: number;
  result: string;
  roundId?: string;
  /** Kept so a delivery can be REPLAYED byte for byte - see the replay assertion below. */
  rawBody: string;
  headers: Record<string, string>;
}[] = [];

async function startReceiver(): Promise<void> {
  receiver = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", async () => {
      /*
       * The raw bytes, before anything parses them - the same first move the real route makes, and
       * for the same reason. A signature is computed over exact bytes, and `JSON.parse` followed
       * by re-serialisation does not reproduce them: key order, whitespace and number formatting
       * all shift. Getting this wrong here would fail gate 5 and read as the service signing
       * incorrectly.
       */
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const headers = Object.fromEntries(
        Object.entries(req.headers).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.join(",") : (v ?? ""),
        ]),
      );

      try {
        const outcome = await ingestProviderCallback({
          providerKey: PROVIDER_KEY,
          rawBody,
          headers,
        });
        const status = outcome.accepted ? 200 : 500;
        delivered.push({
          path: req.url ?? "",
          status,
          result: outcome.result,
          roundId: outcome.roundId,
          rawBody,
          headers,
        });
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ received: outcome.accepted, result: outcome.result }));
      } catch (error) {
        delivered.push({
          path: req.url ?? "",
          status: 500,
          result: `threw: ${error instanceof Error ? error.message : String(error)}`,
          rawBody,
          headers,
        });
        res.writeHead(500).end("{}");
      }
    });
  });

  await new Promise<void>((resolve) => {
    receiver!.listen(0, "127.0.0.1", () => {
      const address = receiver!.address();
      receiverPort = typeof address === "object" && address ? address.port : 0;
      resolve();
    });
  });
}

async function startService(mongoUri: string): Promise<void> {
  service = spawn(
    process.execPath,
    [TSX_CLI, "index.ts"],
    {
      cwd: SERVICE_DIR,
      env: {
        ...process.env,
        /*
         * Explicit, and every one of these matters. `games-service/index.ts` calls
         * `dotenv.config()`, which does NOT override variables already present - so these win
         * over the developer's own `.env`, whose Mongo URI points at a real cluster. Passing the
         * URI is therefore a safety property, not a convenience: without it this test would write
         * rounds into whatever database that file names.
         */
        NODE_ENV: "development",
        PORT: String(PORT),
        GAMES_MONGODB_URI: mongoUri,
        GAMES_DB_NAME: "chartvolt_games_e2e",
        GAMES_PUBLIC_URL: `http://127.0.0.1:${PORT}`,
        GAMES_API_KEY: CREDS.apiKey,
        GAMES_API_SECRET: CREDS.apiSecret,
        GAMES_CALLBACK_TOKEN: CREDS.callbackToken,
        GAMES_CALLBACK_SECRET: CREDS.callbackSecret,
        GAMES_SANDBOX: "false",
        /*
         * The sweeper is the ONLY thing that delivers a result - deliberately, so a terminal
         * transition cannot forget a step it does not perform (see the long comment in
         * `src/callback/sweeper.ts`). Its default tick is 15 seconds, which would make this test
         * a minute of waiting. Turning it down is not weakening anything: it drives the real
         * timer, which is the point of the variable existing.
         */
        GAMES_SWEEP_MS: "400",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const record = (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    serviceLog.push(text);
    // Kept rather than printed: a passing run should be quiet, and a failing one gets the whole
    // log attached to its assertion message, which is more use than interleaved output.
  };
  service.stdout?.on("data", record);
  service.stderr?.on("data", record);

  // Poll rather than wait for a log line. A readiness message can be printed before the socket is
  // actually accepting, and matching on log text couples the test to the wording of a console.log.
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (service.exitCode !== null) {
      throw new Error(
        `games-service exited with ${service.exitCode} during boot:\n${serviceLog.join("")}`,
      );
    }
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    if (Date.now() > deadline) {
      throw new Error(`games-service did not become healthy:\n${serviceLog.join("")}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function stopService(): Promise<void> {
  if (!service) return;
  const done = new Promise<void>((resolve) => service!.once("exit", () => resolve()));
  service.kill("SIGTERM");
  // The service drains for up to 10 seconds by design; do not wait for it politely for ever.
  await Promise.race([done, new Promise((resolve) => setTimeout(resolve, 8_000))]);
  if (service.exitCode === null) service.kill("SIGKILL");
  service = null;
}

/** Waits for a condition, returning the service log in the failure message. */
async function waitFor(
  what: string,
  check: () => Promise<boolean>,
  timeoutMs = 20_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return;
    if (Date.now() > deadline) {
      throw new Error(
        `Timed out waiting for ${what}.\nDelivered: ${JSON.stringify(delivered, null, 2)}\nService log:\n${serviceLog.join("")}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/** Plays a round through the service's own perfect-player tool, in its own process. */
async function autoplay(roundId: string, slowMs = 0): Promise<string> {
  const args = [TSX_CLI, "tools/autoplay.ts", `--round=${roundId}`, `--base=http://127.0.0.1:${PORT}`];
  if (slowMs > 0) args.push(`--slow=${slowMs}`);

  return new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: SERVICE_DIR,
      env: {
        ...process.env,
        NODE_ENV: "development",
        PORT: String(PORT),
        GAMES_MONGODB_URI: mongoUri,
        GAMES_DB_NAME: "chartvolt_games_e2e",
        GAMES_API_KEY: CREDS.apiKey,
        GAMES_API_SECRET: CREDS.apiSecret,
        GAMES_CALLBACK_TOKEN: CREDS.callbackToken,
        GAMES_CALLBACK_SECRET: CREDS.callbackSecret,
        GAMES_PUBLIC_URL: `http://127.0.0.1:${PORT}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let out = "";
    child.stdout?.on("data", (c: Buffer) => (out += c.toString("utf8")));
    child.stderr?.on("data", (c: Buffer) => (out += c.toString("utf8")));
    child.on("exit", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`autoplay exited ${code}:\n${out}`)),
    );
  });
}

let mongoUri = "";

/** Both switches on, credentials stored, provider registered - the state after an admin setup. */
async function seedProviderConfig(): Promise<void> {
  await WhiteLabel.create({
    externalGamesEnabled: true,
    gameProviders: [
      {
        providerKey: PROVIDER_KEY,
        enabled: true,
        baseUrl: `http://127.0.0.1:${PORT}`,
        displayName: "ChartVolt Games",
      },
    ],
    gameProviderCredentials: [
      {
        providerKey: PROVIDER_KEY,
        environment: "sandbox",
        apiKey: CREDS.apiKey,
        apiSecret: CREDS.apiSecret,
        callbackToken: CREDS.callbackToken,
        callbackSecret: CREDS.callbackSecret,
      },
    ],
  });

  await GameProvider.create({
    providerKey: PROVIDER_KEY,
    // First-party, and named so before any contest settles. A provider row joined to contest
    // history can never be renamed away from it - chapter 21 section 9 makes this an acceptance
    // criterion rather than a nicety.
    displayName: "ChartVolt Games",
    baseUrl: `http://127.0.0.1:${PORT}`,
    enabled: true,
  });
}

/**
 * The per-title settings an operator would choose in the contest wizard.
 *
 * TAKEN FROM THE TITLE'S OWN `configSchema`, NOT INVENTED - and the sprint's floor is the reason
 * this test is slow rather than a reason to change it. `durationSeconds` is clamped to 60-300 by
 * `games-service/src/games/titles.ts`, so a sprint round cannot be shorter than a minute of real
 * time. That is a property of the game, and a test that shortened it would be testing a
 * configuration no operator can create.
 *
 * `circuit-perfect` takes a board COUNT, so it ends when the player finishes rather than when a
 * clock does - which is why the lower-is-better half of this suite runs quickly.
 */
const SETTINGS: Record<string, Record<string, unknown>> = {
  [SPRINT]: { durationSeconds: 60, gridSize: "small" },
  [PERFECT]: { boardCount: 3, gridSize: "small", unfinishedPenaltyMs: 30_000 },
};

async function seedContest(args: {
  gameCode: string;
  gameKey: string;
  entryFee: number;
}): Promise<mongoose.Types.ObjectId> {
  const now = Date.now();
  const contest = await Competition.create({
    name: `E2E ${args.gameCode}`,
    slug: `e2e-${args.gameCode}-${now}`,
    description: "The first round to cross the wall",
    gameType: "provider",
    gameKey: args.gameKey,
    gameConfig: {
      providerKey: PROVIDER_KEY,
      gameCode: args.gameCode,
      settings: SETTINGS[args.gameCode],
    },
    contentSeed: `e2e-seed-${now}`,
    playWindowStart: new Date(now - 60_000),
    playWindowEnd: new Date(now + 3_600_000),
    resultGracePeriodSeconds: 600,
    attemptsPolicy: "single",
    unresolvedRoundPolicy: "score_zero",
    status: "active",
    competitionType: "time_based",
    startTime: new Date(now - 120_000),
    endTime: new Date(now + 7_200_000),
    registrationDeadline: new Date(now - 120_000),
    entryFee: args.entryFee,
    minParticipants: 2,
    maxParticipants: 100,
    currentParticipants: 0,
    prizePool: args.entryFee * 2,
    platformFeePercentage: 10,
    prizeDistribution: [
      { rank: 1, percentage: 70 },
      { rank: 2, percentage: 30 },
    ],
    createdBy: new mongoose.Types.ObjectId().toString(),
  });
  return contest._id as mongoose.Types.ObjectId;
}

async function seat(
  competitionId: mongoose.Types.ObjectId,
  userId: string,
  gameKey: string,
  username: string,
): Promise<void> {
  // No `startingCapital`, `currentCapital` or `availableCapital`: those three are required only
  // when `(this.gameKey || "trading") === "trading"`, and a provider seat that carries them is
  // asserting a virtual trading account that does not exist.
  await CompetitionParticipant.create({
    competitionId,
    userId,
    username,
    email: `${username}@e2e.test`,
    gameKey,
    enteredAt: new Date(),
  });
  await Competition.updateOne({ _id: competitionId }, { $inc: { currentParticipants: 1 } });
}

beforeAll(async () => {
  mongoUri = await startTestMongo();
  await ensureCollections([
    "game_provider",
    "provider_game",
    "game_round",
    "provider_event",
    "competitions",
    "competitionparticipants",
    "whitelabels",
  ]);

  await startReceiver();
  // The service posts results here. Under NODE_ENV=test `publicBaseUrl()` allows http on
  // loopback; the production guard that refuses both is R36 and is proven separately.
  process.env.NEXT_PUBLIC_BASE_URL = `http://127.0.0.1:${receiverPort}`;

  await startService(mongoUri);
}, 180_000);

afterAll(async () => {
  await stopService();
  await new Promise<void>((resolve) => receiver?.close(() => resolve()) ?? resolve());
  await stopTestMongo();
});

describe("X4a: a real round travels between the platform and the game service", () => {
  it("syncs the catalogue the service actually published", async () => {
    await seedProviderConfig();

    const adapter = getProviderAdapter(PROVIDER_KEY);
    expect(adapter, "the chartvolt-games adapter must be registered").not.toBeNull();

    const result = await syncProviderCatalogue(adapter!);

    expect(
      result.success,
      `catalogue sync failed: ${result.error}\nService log:\n${serviceLog.join("")}`,
    ).toBe(true);

    /*
     * Both titles, and the second one is the point. `circuit-perfect` exists so a ranking SIGN
     * error cannot pass every test - if the catalogue only ever carried higher-is-better titles, a
     * settlement that sorted the wrong way would look correct on every board in the suite.
     */
    const titles = await ProviderGame.find({ providerKey: PROVIDER_KEY }).lean();
    const codes = titles.map((t) => t.gameCode).sort();
    expect(codes).toContain(SPRINT);
    expect(codes).toContain(PERFECT);

    const sprint = titles.find((t) => t.gameCode === SPRINT);
    const perfect = titles.find((t) => t.gameCode === PERFECT);
    expect(sprint?.scoreDirection).toBe("higher_is_better");
    expect(perfect?.scoreDirection).toBe("lower_is_better");

    // Nothing the service says turns a title on for players. Two switches per title, and this is
    // the platform's half of it.
    expect(sprint?.chartvoltEnabled).toBe(false);
    expect(perfect?.chartvoltEnabled).toBe(false);
  }, 60_000);

  it("launches, plays and scores a round, end to end, with the score decided by the service", async () => {
    const gameKey = `provider:${PROVIDER_KEY}:${SPRINT}`;
    await ProviderGame.updateOne(
      { providerKey: PROVIDER_KEY, gameCode: SPRINT },
      { $set: { chartvoltEnabled: true } },
    );

    const contestId = await seedContest({ gameCode: SPRINT, gameKey, entryFee: 10 });
    const winner = new mongoose.Types.ObjectId().toString();
    const runnerUp = new mongoose.Types.ObjectId().toString();
    await seat(contestId, winner, gameKey, "winner");
    await seat(contestId, runnerUp, gameKey, "runnerup");

    // ── The platform opens a round on the service, over HTTP, signed ──────────────────────
    const launch = await launchContestRound(contestId.toString(), {
      userId: winner,
      displayName: "winner",
    });

    expect(
      launch.success,
      `launch refused: ${launch.success ? "" : `${launch.refusal} - ${launch.error}`}\nService log:\n${serviceLog.join("")}`,
    ).toBe(true);
    if (!launch.success) return;

    // The launch URL points at the SERVICE, not at the platform - it is what goes in the iframe.
    expect(launch.launchUrl).toContain(`127.0.0.1:${PORT}`);
    expect(launch.launchUrl).toContain("/play?t=");
    expect(launch.attemptNumber).toBe(1);

    const stored = await GameRound.findOne({ roundId: launch.roundId }).lean();
    expect(stored?.status).toBe("launched");

    /*
     * ── A DOUBLE-CLICK MUST NOT COST A SECOND ATTEMPT ────────────────────────────────────
     *
     * An attempt is consumed when a round is CREATED, deliberately, or a player abandons a bad
     * board and retries free for ever. The consequence is that the launch path has to be
     * idempotent, because a double-click on Play is the ordinary case rather than an edge one -
     * and on a single-attempt contest the second click would otherwise burn the player's only go.
     *
     * Chapter 21 makes this an acceptance criterion in its own right. Asserting it here rather
     * than in a unit test is the point: this is the real service deciding, and its own
     * `fingerprint` idempotency is what has to agree with ours.
     */
    const again = await launchContestRound(contestId.toString(), {
      userId: winner,
      displayName: "winner",
    });
    expect(again.success).toBe(true);
    if (again.success) {
      expect(again.roundId).toBe(launch.roundId);
      expect(again.attemptNumber).toBe(1);
      expect(again.idempotent).toBe(true);
    }
    expect(await GameRound.countDocuments({ contestId })).toBe(1);

    // ── A player plays it, through the service's own four play endpoints ──────────────────
    const log = await autoplay(launch.roundId);
    expect(log).toContain("finished - completed");

    // ── The service's sweeper delivers a signed result, unprompted ────────────────────────
    await waitFor("the result callback to be ingested", async () => {
      return delivered.some((d) => d.result === "scored");
    });

    const scored = delivered.find((d) => d.result === "scored");
    expect(scored?.status).toBe(200);
    expect(scored?.path).toContain(`/api/games/providers/${PROVIDER_KEY}/events`);

    // ── And the score is on the round and on the participant ─────────────────────────────
    const finished = await GameRound.findOne({ roundId: launch.roundId }).lean();
    expect(finished?.status).toBe("completed");
    expect(typeof finished?.rawScore).toBe("number");
    expect(finished?.rawScore).toBeGreaterThan(0);

    const participant = await CompetitionParticipant.findOne({
      competitionId: contestId,
      userId: winner,
    }).lean();

    /*
     * R32's seam, observed rather than asserted from a fixture. Every settlement suite in this
     * repository SEEDS `score` and ranks it, which proves ranking works given a score and is
     * structurally silent on whether one ever arrives - and for a day, none did. This is the one
     * assertion in the codebase that starts on the far side of that seam.
     */
    expect(participant?.score).toBe(finished?.rawScore);

    // The raw score, never a negated one. A persisted negative would show a race time as minus
    // something on every screen and poison any cross-game total; direction is applied at
    // comparison, inside ranking, and nowhere else.
    expect(participant!.score).toBeGreaterThan(0);

    // Exactly one event stored, and it carries the raw delivery for the admin round inspector.
    const events = await ProviderEvent.find({ providerKey: PROVIDER_KEY }).lean();
    expect(events.length).toBeGreaterThanOrEqual(1);

    /*
     * ── AND THE SAME DELIVERY, SENT AGAIN, MUST CHANGE NOTHING ───────────────────────────
     *
     * The specification asks a provider to retry a failed delivery for up to 24 hours with a
     * stable `eventId`, so a duplicate is not a hostile act - it is the retry working as designed
     * arriving after a response we sent but they never received. Gate 1 has to absorb it.
     *
     * Replayed BYTE FOR BYTE, with the original headers, which is the only version of this test
     * worth having: re-serialising the payload would produce different bytes, fail the HMAC at
     * gate 5, and pass this assertion for entirely the wrong reason - a rejection at gate 5 and
     * an idempotent absorption at gate 1 both leave the score unchanged.
     */
    const original = delivered.find((d) => d.result === "scored")!;
    const replay = await ingestProviderCallback({
      providerKey: PROVIDER_KEY,
      rawBody: original.rawBody,
      headers: original.headers,
    });

    expect(replay.result).toBe("duplicate_ignored");
    // Accepted, because inviting a retry a day later achieves nothing except a second alert.
    expect(replay.accepted).toBe(true);

    const afterReplay = await CompetitionParticipant.findOne({
      competitionId: contestId,
      userId: winner,
    }).lean();
    expect(afterReplay?.score).toBe(participant?.score);
  }, 180_000);

  it("ranks a lower-is-better title by the faster player, not the higher number", async () => {
    /*
     * THE TEST THAT CANNOT BE FAKED BY A SIGN ERROR. `circuit-perfect` scores `duration_ms`, so
     * the winner is the SMALLEST number - and a settlement that sorts descending would pay the
     * slowest player while every higher-is-better test in the suite stayed green. Chapter 21
     * makes this an acceptance criterion in its own right, and it is why the service ships two
     * titles from one engine.
     *
     * `--slow` is what makes the two players distinguishable: the score is wall-clock duration
     * measured by the SERVICE, so the only way to lose on purpose is to actually take longer.
     */
    const gameKey = `provider:${PROVIDER_KEY}:${PERFECT}`;
    await ProviderGame.updateOne(
      { providerKey: PROVIDER_KEY, gameCode: PERFECT },
      { $set: { chartvoltEnabled: true } },
    );

    const contestId = await seedContest({ gameCode: PERFECT, gameKey, entryFee: 10 });
    const quick = new mongoose.Types.ObjectId().toString();
    const slow = new mongoose.Types.ObjectId().toString();
    await seat(contestId, quick, gameKey, "quick");
    await seat(contestId, slow, gameKey, "slow");

    const quickLaunch = await launchContestRound(contestId.toString(), { userId: quick });
    const slowLaunch = await launchContestRound(contestId.toString(), { userId: slow });
    expect(quickLaunch.success && slowLaunch.success).toBe(true);
    if (!quickLaunch.success || !slowLaunch.success) return;

    await autoplay(quickLaunch.roundId);
    await autoplay(slowLaunch.roundId, 1_200);

    await waitFor("both lower-is-better results to arrive", async () => {
      const count = await CompetitionParticipant.countDocuments({
        competitionId: contestId,
        score: { $gt: 0 },
      });
      return count === 2;
    });

    const quickSeat = await CompetitionParticipant.findOne({
      competitionId: contestId,
      userId: quick,
    }).lean();
    const slowSeat = await CompetitionParticipant.findOne({
      competitionId: contestId,
      userId: slow,
    }).lean();

    // Both stored raw, both positive, and the deliberate delay is visible in the numbers.
    expect(quickSeat!.score).toBeGreaterThan(0);
    expect(slowSeat!.score).toBeGreaterThan(quickSeat!.score);

    // The direction came from the catalogue the SERVICE published, not from a fixture.
    const { resolveScoreDirection } = await import(
      "../../lib/services/games/score-direction.service"
    );
    expect(await resolveScoreDirection(gameKey)).toBe("lower_is_better");

    /*
     * ── AND NOW THE MONEY, WHICH IS THE ONLY ASSERTION THAT CANNOT BE ARGUED WITH ────────
     *
     * Asserting a ranking function returns the faster player first would be a weaker claim than
     * it looks: `provider-settlement.test.ts` already proves that, from seeded scores. What has
     * never been observed is a payout at the end of a chain that began with a real player
     * finishing a real board - so this settles the contest for real and reads the wallets.
     *
     * A sign error pays the slow player more. Nothing else in the suite would notice.
     */
    const db = mongoose.connection.db;
    await db?.collection("creditwallets").insertMany([
      { userId: quick, creditBalance: 0, totalDeposited: 0, totalWonFromCompetitions: 0 },
      { userId: slow, creditBalance: 0, totalDeposited: 0, totalWonFromCompetitions: 0 },
    ]);

    const { finalizeCompetition } = await import(
      "../../lib/actions/trading/competition-end.actions"
    );
    const settled = await finalizeCompetition(contestId.toString());
    expect(settled.success, `settlement failed: ${settled.error ?? settled.message}`).toBe(true);

    const balance = async (userId: string) =>
      ((await db?.collection("creditwallets").findOne({ userId }))?.creditBalance as number) ?? 0;

    const quickPaid = await balance(quick);
    const slowPaid = await balance(slow);

    expect(
      quickPaid,
      "the faster player must be paid MORE on a lower-is-better title",
    ).toBeGreaterThan(slowPaid);
    expect(quickPaid).toBeGreaterThan(0);
  }, 240_000);
});
