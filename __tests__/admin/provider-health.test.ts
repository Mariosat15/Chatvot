/**
 * X6's fifth and last admin destination - provider health (chapter 12 section 4).
 *
 * BEHAVIOURAL tests, because every rule worth pinning here is a rule about what the verdict
 * is given a particular history of rounds and deliveries. None of them can be checked by
 * reading the code.
 *
 * WHICH COPY OF EACH MODEL THIS FILE SEEDS IS NOT A FREE CHOICE. The service lives in
 * `apps/admin`, but vitest maps `@` to the REPO ROOT, so its `@/database/...` imports
 * resolve to the MAIN app's models rather than the admin copies beside it. This file
 * therefore seeds the main copies - the ones the service actually reads. Seeding the admin
 * copies puts fixtures on a Mongoose instance the service never touches, and every
 * assertion then fails on an empty collection, which reads exactly like a logic bug.
 *
 * Only ONE copy of each model is imported, because both register under the same name via
 * `models.X || model(...)` and importing both silently returns whichever registered first.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import mongoose, { Types } from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

const GameProvider = (
  await import("../../database/models/games/game-provider.model")
).default;
const ProviderGame = (
  await import("../../database/models/games/provider-game.model")
).default;
const GameRound = (await import("../../database/models/games/game-round.model"))
  .default;
const ProviderEvent = (
  await import("../../database/models/games/provider-event.model")
).default;
const { WhiteLabel } = await import("../../database/models/whitelabel.model");
const { getProviderHealth } = await import(
  "../../apps/admin/lib/services/games/provider-health.service"
);
const { MOCK_PROVIDER_KEY } = await import(
  "../../lib/services/game-providers/adapters/mock.adapter"
);

const GAME_CODE = "mock-trivia";
const GAME_KEY = `provider:${MOCK_PROVIDER_KEY}:${GAME_CODE}`;

const COLLECTIONS = [
  "game_provider",
  "provider_game",
  "game_round",
  "provider_event",
  "whitelabels",
];

beforeAll(async () => {
  const uri = await startTestMongo();
  await mongoose.connect(uri);
  await ensureCollections(COLLECTIONS);
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
  await ensureCollections(COLLECTIONS);
});

/** A provider with nothing stopping it running, so a verdict measures traffic and not config. */
async function seedRunnableProvider() {
  await GameProvider.create({
    providerKey: MOCK_PROVIDER_KEY,
    displayName: "Mock Provider",
    baseUrl: "https://mock.example.com",
    enabled: true,
  });
  await WhiteLabel.create({
    externalGamesEnabled: true,
    gameProviderCredentials: [
      {
        providerKey: MOCK_PROVIDER_KEY,
        environment: "sandbox",
        callbackToken: "token",
        callbackSecret: "secret",
      },
    ],
  });
  await ProviderGame.create({
    providerKey: MOCK_PROVIDER_KEY,
    gameCode: GAME_CODE,
    gameKey: GAME_KEY,
    displayName: "Mock Trivia",
    family: "independent",
    supportsCompetition: true,
    scoreDirection: "higher_is_better",
    scoreType: "integer",
    providerStatus: "active",
    chartvoltEnabled: true,
  });
}

let roundCounter = 0;
async function seedRound(
  status: string,
  overrides: Record<string, unknown> = {},
) {
  roundCounter += 1;
  return GameRound.create({
    roundId: `cv_rnd_health_${roundCounter}`,
    providerKey: MOCK_PROVIDER_KEY,
    gameCode: GAME_CODE,
    gameKey: GAME_KEY,
    userId: new Types.ObjectId().toString(),
    contestType: "competition",
    contestId: new Types.ObjectId(),
    attemptNumber: 1,
    mode: "ranked",
    status,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  });
}

let eventCounter = 0;
async function seedEvent(processingResult: string) {
  eventCounter += 1;
  return ProviderEvent.create({
    eventId: `evt_health_${eventCounter}`,
    providerKey: MOCK_PROVIDER_KEY,
    rawBody: "{}",
    processingResult,
    receivedAt: new Date(),
  });
}

describe("the verdict is derived, never read from the stored field", () => {
  /**
   * THE DEFECT THIS DESIGN AVOIDS. `game_provider.healthStatus` is declared and nothing has
   * ever written to it, and it DEFAULTS TO "down". A panel that rendered the stored field
   * would report a provider that had just scored a round as permanently down - a screen that
   * appears to work, reports something precise, and is wrong.
   */
  it("reports a provider healthy while its stored healthStatus still says down", async () => {
    await seedRunnableProvider();

    const stored = await GameProvider.findOne({
      providerKey: MOCK_PROVIDER_KEY,
    }).lean<{ healthStatus?: string } | null>();
    // Asserted rather than assumed: if the default ever changed, the rest of this test
    // would still pass while no longer proving anything.
    expect(stored?.healthStatus).toBe("down");

    await seedRound("completed", { resultReceivedAt: new Date(), rawScore: 10 });
    await seedEvent("scored");

    const [row] = await getProviderHealth();
    expect(row.verdict).toBe("healthy");
  });
});

describe("no traffic is its own verdict, not a guess", () => {
  /**
   * A provider with no rounds is neither healthy nor down - there is nothing to judge by.
   * Green would be a guess presented as a measurement and an operator would stop checking;
   * red would send them looking for an outage that is not happening.
   */
  it("says so rather than reporting healthy or down", async () => {
    await seedRunnableProvider();

    const [row] = await getProviderHealth();
    expect(row.verdict).toBe("no_traffic");
    expect(row.summary).toMatch(/nothing to judge/i);
  });

  it("treats rounds that are all still in play as no evidence either", async () => {
    await seedRunnableProvider();
    await seedRound("launched");
    await seedRound("pending");

    const [row] = await getProviderHealth();
    // Reason: a player mid-round is not a failure, and it is not a success yet. Counting
    // live rounds as traffic and then finding no completions would report "down" on a
    // provider that is working perfectly and simply has not finished.
    expect(row.verdict).toBe("no_traffic");
    expect(row.rounds.live).toBe(2);
  });
});

describe("a provider that cannot run is not the same as one that is broken", () => {
  /**
   * The two need different actions - one is a switch, the other is an outage - so they are
   * different verdicts rather than two shades of red. And each blocker names the missing
   * thing, because a control that cannot work must say WHICH switch or credential is absent
   * or an operator has nothing to do next.
   */
  it("reports not_configured and names the missing callback credentials", async () => {
    await GameProvider.create({
      providerKey: MOCK_PROVIDER_KEY,
      displayName: "Mock Provider",
      baseUrl: "https://mock.example.com",
      enabled: true,
    });
    await WhiteLabel.create({
      externalGamesEnabled: true,
      gameProviderCredentials: [],
    });

    const [row] = await getProviderHealth();
    expect(row.verdict).toBe("not_configured");
    expect(row.blockers.join(" ")).toMatch(/callback token or secret is missing/i);
  });

  it("names the master switch separately from the provider switch", async () => {
    await GameProvider.create({
      providerKey: MOCK_PROVIDER_KEY,
      displayName: "Mock Provider",
      baseUrl: "https://mock.example.com",
      enabled: false,
    });
    await WhiteLabel.create({ externalGamesEnabled: false });

    const [row] = await getProviderHealth();
    // Reason both must appear: an operator who turns the provider on and still sees nothing
    // work has been told only half the truth, and the master switch is the half that is
    // easy to forget because it lives on a different screen.
    expect(row.blockers.length).toBeGreaterThanOrEqual(2);
    expect(row.blockers.join(" ")).toMatch(/switched off platform-wide/i);
    expect(row.blockers.join(" ")).toMatch(/provider is disabled/i);
  });

  it("configuration outranks traffic, so a switch is never reported as an outage", async () => {
    await GameProvider.create({
      providerKey: MOCK_PROVIDER_KEY,
      displayName: "Mock Provider",
      baseUrl: "https://mock.example.com",
      enabled: false,
    });
    await WhiteLabel.create({ externalGamesEnabled: false });
    await seedRound("unresolved");
    await seedRound("unresolved");

    const [row] = await getProviderHealth();
    expect(row.verdict).toBe("not_configured");
  });
});

describe("signature failures are never averaged into a general error count", () => {
  /**
   * A signature failure is either a wrong secret or an attack, and the two are
   * indistinguishable in the log. Folded into "errors" it disappears, and the wrong-secret
   * case is invisible from the player's side too - their rounds simply never finish.
   */
  it("reports down when every delivery failed verification", async () => {
    await seedRunnableProvider();
    await seedRound("launched");
    await seedEvent("signature_invalid");
    await seedEvent("signature_invalid");

    const [row] = await getProviderHealth();
    expect(row.verdict).toBe("down");
    expect(row.events.signatureInvalid).toBe(2);
    expect(row.summary).toMatch(/signature/i);
  });

  it("degrades a provider that is mostly working but rejecting some deliveries", async () => {
    await seedRunnableProvider();
    await seedRound("completed", { resultReceivedAt: new Date(), rawScore: 5 });
    await seedEvent("scored");
    await seedEvent("signature_invalid");

    const [row] = await getProviderHealth();
    // Reason not "healthy": a half-applied rotation looks exactly like this, and it is the
    // state in which the next secret change silently breaks everything.
    expect(row.verdict).toBe("degraded");
  });

  it("does not count a duplicate delivery as a failure", async () => {
    await seedRunnableProvider();
    await seedRound("completed", { resultReceivedAt: new Date(), rawScore: 5 });
    await seedEvent("scored");
    await seedEvent("duplicate_ignored");

    const [row] = await getProviderHealth();
    // A retried delivery is a provider being careful. Counting it as an error makes a
    // well-behaved integration look sick.
    expect(row.events.otherFailures).toBe(0);
    expect(row.verdict).toBe("healthy");
  });
});

describe("unresolved rounds are judged as a share, not as a count", () => {
  /**
   * One unresolved round out of two is a broken integration; one out of four hundred is a
   * network. A flat count calls the first healthy and the second broken.
   */
  it("degrades when a meaningful share never reported", async () => {
    await seedRunnableProvider();
    await seedRound("completed", { resultReceivedAt: new Date(), rawScore: 1 });
    await seedRound("unresolved");

    const [row] = await getProviderHealth();
    expect(row.verdict).toBe("degraded");
    expect(row.summary).toMatch(/never reported/i);
  });

  it("stays healthy when a single failure sits among many successes", async () => {
    await seedRunnableProvider();
    for (let i = 0; i < 30; i += 1) {
      await seedRound("completed", {
        resultReceivedAt: new Date(),
        rawScore: i,
      });
    }
    await seedRound("unresolved");

    const [row] = await getProviderHealth();
    expect(row.verdict).toBe("healthy");
  });

  it("reports down when rounds finished and none produced a score", async () => {
    await seedRunnableProvider();
    await seedRound("unresolved");
    await seedRound("expired");

    const [row] = await getProviderHealth();
    expect(row.verdict).toBe("down");
  });
});

describe("the facts beside the verdict", () => {
  it("finds the last round that scored even when it is outside the window", async () => {
    await seedRunnableProvider();
    const longAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const round = await seedRound("completed", {
      resultReceivedAt: longAgo,
      rawScore: 7,
    });

    // Reason `createdAt` is forced through the raw collection: Mongoose timestamps overwrite
    // it on insert, so a round seeded with an old `resultReceivedAt` alone is still INSIDE
    // the 24-hour window by `createdAt`. The first version of this test left it at now, and
    // a probe that added the window filter to this query stayed green - the fixture could
    // not distinguish the two branches at all. That is a third cause of a green probe,
    // alongside a weak test and a wrong claim, and it is the one that looks most like
    // neither.
    await GameRound.collection.updateOne(
      { roundId: round.roundId },
      { $set: { createdAt: longAgo } },
    );

    const [row] = await getProviderHealth();
    // Reason it is NOT windowed: "when did this last work" is the question an operator asks
    // precisely when the window is empty, and a windowed answer returns null exactly then.
    expect(row.lastSuccessfulRoundAt).not.toBeNull();
    expect(new Date(row.lastSuccessfulRoundAt!).getTime()).toBe(
      longAgo.getTime(),
    );
  });

  it("counts rounds only inside the window", async () => {
    await seedRunnableProvider();
    const round = await seedRound("completed", {
      resultReceivedAt: new Date(),
      rawScore: 7,
    });
    // Reason `createdAt` is forced rather than passed to create(): Mongoose timestamps
    // overwrite it on insert, so a fixture that only sets it on the way in is silently
    // stamped with now and the window assertion passes for the wrong reason.
    await GameRound.collection.updateOne(
      { roundId: round.roundId },
      { $set: { createdAt: new Date(Date.now() - 40 * 60 * 60 * 1000) } },
    );

    const [row] = await getProviderHealth();
    expect(row.rounds.total).toBe(0);
    // And the historical success is still reported, from the un-windowed query.
    expect(row.lastSuccessfulRoundAt).not.toBeNull();
  });

  it("reports the title counts an operator needs to act", async () => {
    await seedRunnableProvider();
    await ProviderGame.create({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: "second-title",
      gameKey: `provider:${MOCK_PROVIDER_KEY}:second-title`,
      displayName: "Second",
      family: "independent",
      supportsCompetition: true,
      scoreDirection: "lower_is_better",
      scoreType: "duration_ms",
      providerStatus: "active",
      chartvoltEnabled: false,
    });

    const [row] = await getProviderHealth();
    expect(row.titleCount).toBe(2);
    expect(row.enabledTitleCount).toBe(1);
  });

  it("returns nothing at all when no provider is registered", async () => {
    // Reason: an empty array and a row saying "down" are different facts, and the screen's
    // empty state tells an operator to register one - which is the correct next action.
    expect(await getProviderHealth()).toEqual([]);
  });
});

/**
 * STRUCTURAL, because each rule below is an ABSENCE. A test that calls the route would pass
 * just as happily on the day someone removes the guard or renders the stored field.
 *
 * Comments are stripped first: these files explain the anti-patterns they avoid in prose, so
 * a test that reads prose flags a correct file for discussing the mistake and passes a
 * broken one whose only mention of the right thing is in a comment.
 */
describe("structural guards", () => {
  const ROOT = join(__dirname, "..", "..");

  function readCode(relativePath: string): string {
    return readFileSync(join(ROOT, relativePath), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  const ROUTE = "apps/admin/app/api/games/provider-health/route.ts";
  const PANEL = "apps/admin/components/admin/games/ProviderHealthSection.tsx";
  const SERVICE = "apps/admin/lib/services/games/provider-health.service.ts";
  const PROVIDER_DTO =
    "apps/admin/lib/services/game-providers/provider-admin.service.ts";

  it("guards the route by section, not merely by being an admin", () => {
    const code = readCode(ROUTE);
    // `requireAdminAuth` asks only whether the caller is an admin at all, so an employee
    // granted one unrelated section passes it. Fifth instance of that mistake here.
    expect(code).toMatch(/guardSection\(\s*["']provider-health["']\s*\)/);
    expect(code).not.toMatch(/requireAdminAuth/);
  });

  it("counts guards against exported handlers", () => {
    // Reason: a file whose GET is guarded and whose POST is not passes the assertion above
    // while leaving the mutation wide open.
    const code = readCode(ROUTE);
    const handlers = code.match(/export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)\b/g) ?? [];
    const guards = code.match(/guardSection\(/g) ?? [];
    expect(handlers.length).toBeGreaterThan(0);
    expect(guards.length).toBe(handlers.length);
  });

  it("neither the service nor the panel reads the stored health field", () => {
    // THE DEFECT THIS PINS: `healthStatus` defaults to "down" and has no writer, so any
    // read of it renders a working provider as permanently down.
    expect(readCode(SERVICE)).not.toMatch(/\.healthStatus/);
    expect(readCode(PANEL)).not.toMatch(/\.healthStatus|lastHealthCheckAt/);
  });

  it("keeps the unwritten fields off the provider list wire as well", () => {
    // Reason for pinning the other service too: leaving them in the DTO is a one-line
    // invitation to render them, the same reasoning that deletes a dead helper rather than
    // leaving it beside the defect it caused.
    const code = readCode(PROVIDER_DTO);
    expect(code).not.toMatch(/healthStatus:\s*provider\.healthStatus/);
    expect(code).not.toMatch(/lastHealthCheckAt:\s*provider\.lastHealthCheckAt/);
  });

  it("is wired into the admin navigation and the render switch", () => {
    // Reason this is asserted at all: before writing that a capability exists, grep for its
    // caller. A section with a service, a route and a component but no menu entry is
    // reachable by API and by test, and not by clicking.
    const dashboard = readCode("apps/admin/components/admin/AdminDashboard.tsx");
    expect(dashboard).toMatch(/id:\s*["']provider-health["']/);
    expect(dashboard).toMatch(
      /case\s+["']provider-health["']:\s*return\s*<ProviderHealthSection/,
    );
  });

  it("does not duplicate the round inspector's job", () => {
    // Reason: two screens that both list and resolve rounds give an operator two places to
    // act and no reason to prefer either. This one answers "which provider should I look
    // at" and takes no action at all, which is also why it is a separate, read-only grant.
    const panel = readCode(PANEL);
    expect(panel).not.toMatch(/\/api\/games\/rounds/);
    expect(panel).not.toMatch(/resolveRound|ResolveRoundDialog/);
  });

  it("the section id is a real RBAC grant", () => {
    // Reason: `ADMIN_SECTIONS` is a Mongoose enum on `allowedSections`, so a menu id that
    // is not in it can never be granted to anyone - the tab would exist and be unreachable.
    const model = readCode("apps/admin/database/models/admin-employee.model.ts");
    expect(model).toMatch(/["']provider-health["']/);
  });
});
