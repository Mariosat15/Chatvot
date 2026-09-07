import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import mongoose from "mongoose";
import { readFileSync } from "fs";
import { join } from "path";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

/**
 * R26: a competition finalized through the ADMIN app paid no Game Master anything.
 *
 * The main app's `finalizeCompetition` calls `settleFeesAndGameMasters`; the admin app's
 * copy had its own inline platform-fee block and no referral stage at all. Both are reached
 * in production - `apps/admin/lib/inngest/functions.ts` runs `checkAndFinalizeCompetitions`
 * on an every-minute cron, exactly as the main app does - so which app pays a Game Master
 * depended on which cron happened to claim the contest. The money stayed with the platform
 * with no ledger row explaining it, which is why the register rates this ALREADY OCCURRED
 * rather than predicted.
 *
 * WHY THIS FILE IS PARITY RATHER THAN A LIST OF ASSERTIONS. R26's acceptance criterion is
 * "pays Game Master earnings identically to the main app", and a half-fix satisfies any
 * fixed number of assertions about earnings while still booking the wrong platform fee -
 * the commission is carved OUT of the fee, so paying a referrer without reducing what the
 * platform records leaves the ledger claiming income nobody kept. Seeding one fixture,
 * running each app's finalize over it, and comparing every money row is the only shape that
 * cannot be satisfied halfway.
 *
 * WHAT IMPORTING AN ADMIN ACTION IN THIS SUITE DOES AND DOES NOT PROVE, stated because the
 * convention elsewhere is to read admin files as text. Vitest resolves `@/` to the repo
 * root, so the admin action under test runs against the MAIN app's models and services.
 * That was sound for R26 and it is worth being exact about why: R26's defect was in the
 * action file's own control flow, which is what this exercises, and the dependencies it
 * reached were byte-identical (`fees.service.ts`, `types.ts`, `game-master-fees/`, verified
 * with `git diff --no-index`, plus `check:mirrors` on the models).
 *
 * THAT JUSTIFICATION USED TO CLAIM EVERY DEPENDENCY IS BYTE-IDENTICAL, AND IT IS NOT.
 * Corrected rather than quietly reworded, because the sentence was believed for two days and
 * it is the reason a probe was expected to work. `competition-ranking.service.ts` is a
 * DIVERGENT duplicate - 77 lines apart, the admin copy carrying its own logging - and
 * `check:mirrors` compares models, so nothing guards it. The provider settlement path reaches
 * it in both apps. The consequence for this file is precise and easy to over-read: a runtime
 * assertion here cannot see the admin copy of that service at all, so the eligibility rule is
 * pinned by the structural describe block at the foot of this file instead.
 */

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

/**
 * Both finalize paths fire notifications and badge evaluation WITHOUT awaiting them.
 *
 * Reason they are stubbed rather than left to fail harmlessly: an unawaited write outlives
 * the test that started it, so it lands after `clearTestMongo` and into the NEXT test's
 * fixture. That is a cross-test leak whose only symptom is an occasional inexplicable
 * failure, and it is worse in a parity suite than anywhere else - the two snapshots being
 * compared are taken from the same collections these writes touch.
 *
 * Every export both paths reach for is stubbed, including the ones only ONE of them uses
 * (`sendNotification`, `awardActivityXP`). Reason: a missing export on a `vi.mock` throws, the
 * production code catches it and logs, and the suite stays green - so the notification and XP
 * stage of the main app simply would not run. Harmless for the money being compared, but it
 * makes the two paths differ in a way this suite exists to rule out, and it fills the output
 * with errors that look like defects. A partial mock is a silently skipped branch.
 */
vi.mock("@/lib/services/notification.service", () => ({
  notificationService: {
    notifyCompetitionWon: async () => {},
    notifyPodiumFinish: async () => {},
    notifyPrizeReceived: async () => {},
    notifyCompetitionEnded: async () => {},
    notifyCompetitionWinner: async () => {},
    notifyCompetitionCancelled: async () => {},
  },
  sendNotification: async () => {},
}));

vi.mock("@/lib/services/badge-evaluation.service", () => ({
  evaluateUserBadges: async () => ({ newBadges: [] }),
}));

vi.mock("@/lib/services/xp-level.service", () => ({
  awardCompetitionXP: async () => {},
  addXP: async () => {},
  awardActivityXP: async () => {},
}));

/**
 * Registered eagerly so `ensureCollections` can settle their indexes.
 *
 * Reason, and it is a step deeper than the usual catalog problem: both finalize paths import
 * these two models DYNAMICALLY, part-way through the transaction. A model's indexes are built
 * the first time it is used, an index build is a catalog change, and a catalog change inside a
 * transaction fails - here as `Unable to acquire IX lock on test.tradehistories within 5ms`,
 * which reads exactly like lock contention in the code under test. `settleIndexes()` can only
 * wait for models that are REGISTERED when it runs, so a dynamically imported one slips past
 * it. Importing them here puts them in `mongoose.models` first.
 */
import "@/database/models/trading/trade-history.model";
import "@/database/models/trading/trading-order.model";

const { finalizeCompetition: finalizeInMainApp } = await import(
  "@/lib/actions/trading/competition-end.actions"
);

/**
 * Resolved through a variable, deliberately, and this is the one piece of machinery in the file.
 *
 * A literal `import("../../apps/admin/...")` pulls the admin action into the MAIN app's `tsc`
 * program, where its `@/lib/services/notification.service` resolves to the root copy - whose
 * method signatures genuinely differ from the admin app's. The result is four argument-count
 * errors reported against code that is correct in the app it actually ships in: an artifact of
 * this test's module resolution, not a defect, and not something to "fix" by changing either
 * notification service. TypeScript does not follow a dynamic import whose specifier is not a
 * literal, so the file stays out of the main program while the runtime import is unchanged.
 */
const ADMIN_FINALIZE_MODULE =
  "../../apps/admin/lib/actions/trading/competition-end.actions";

const { finalizeCompetition: finalizeInAdminApp } = (await import(
  /* @vite-ignore */ ADMIN_FINALIZE_MODULE
)) as { finalizeCompetition: (competitionId: string) => Promise<unknown> };

const ENTRY_FEE = 100;
const PLATFORM_FEE_PERCENT = 20;
const START_BALANCE = 1_000;
const STARTING_CAPITAL = 10_000;
const GM_RATE = 10;

const GM_ID = "6500000000000000000000a1";

/** Ranked by pnl. Only the first is referred, so a per-player split cannot hide a total. */
const PLAYERS = [
  { id: "6500000000000000000000b1", name: "Winner", pnl: 3_000, referred: true },
  { id: "6500000000000000000000b2", name: "Runner Up", pnl: 1_500, referred: false },
  { id: "6500000000000000000000b3", name: "Third", pnl: -500, referred: false },
];

const REFERRED = PLAYERS.filter((p) => p.referred);

/**
 * A finished competition, ready to finalize.
 *
 * Closed trades are seeded alongside (see `seedClosedTrades`) so that real prizes are paid.
 * That matters here rather than being thoroughness: the gross platform fee is
 * `prizePool - totalDistributed` when anyone was paid and `prizePool * fraction` when nobody
 * was, and the referral commission is capped against whichever of the two it turns out to be.
 * A fixture that pays no prizes exercises only the second, so it would leave the branch that
 * runs on almost every real contest untested while looking complete.
 */
async function seedFinishedCompetition(): Promise<string> {
  const id = new mongoose.Types.ObjectId();
  const db = mongoose.connection.db;

  await db?.collection("competitions").insertOne({
    _id: id,
    name: "Finished Competition",
    slug: `finished-competition-${id.toString()}`,
    // Reason: finalization SAVES the competition document, so the fixture has to satisfy the
    // whole schema even though these fields play no part in a payout. The raw driver skips
    // validation on the way in but not on the way out.
    description: "Seeded by admin-finalize-gamemaster-parity.test.ts",
    createdBy: "6500000000000000000000ff",
    registrationDeadline: new Date(Date.now() - 3 * 60 * 60 * 1000),
    status: "active",
    gameType: "trading",
    gameKey: "trading",
    entryFee: ENTRY_FEE,
    prizePool: PLAYERS.length * ENTRY_FEE,
    currentParticipants: PLAYERS.length,
    minParticipants: 2,
    maxParticipants: 100,
    startingCapital: STARTING_CAPITAL,
    platformFeePercentage: PLATFORM_FEE_PERCENT,
    prizeDistribution: [
      { rank: 1, percentage: 60 },
      { rank: 2, percentage: 40 },
    ],
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 60 * 1000),
    createdAt: new Date(),
  });

  await db?.collection("competitionparticipants").insertMany(
    PLAYERS.map((p, index) => ({
      competitionId: id.toString(),
      userId: p.id,
      username: p.name,
      email: `${p.name.replace(/\s+/g, "").toLowerCase()}@example.test`,
      startingCapital: STARTING_CAPITAL,
      currentCapital: STARTING_CAPITAL + p.pnl,
      pnl: p.pnl,
      pnlPercentage: (p.pnl / STARTING_CAPITAL) * 100,
      totalTrades: 10,
      winningTrades: 6,
      losingTrades: 4,
      status: "active",
      enteredAt: new Date(Date.now() - 90 * 60 * 1000 + index * 1000),
    })),
  );

  await db?.collection("creditwallets").insertMany(
    [...PLAYERS.map((p) => p.id), GM_ID].map((userId) => ({
      userId,
      creditBalance: START_BALANCE,
      totalDeposited: START_BALANCE,
      totalWonFromCompetitions: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );

  await seedClosedTrades(id.toString());

  return id.toString();
}

/**
 * One closed trade each, so finalization produces a real ranking and pays real prizes.
 *
 * Reason it is needed at all: both apps recompute every participant's pnl from closed
 * positions reconciled against `TradeHistory`, ignoring whatever the participant document
 * says. A position alone is not enough - the realized amount is read from the matching
 * history row by `positionId` - which is why the two are built as pairs here rather than
 * from two independent loops that could drift apart.
 *
 * USD-quoted symbols only. A cross pair makes finalization fetch conversion rates over the
 * network, which has no place in a test.
 */
async function seedClosedTrades(competitionId: string): Promise<void> {
  const db = mongoose.connection.db;

  const openedAt = new Date(Date.now() - 80 * 60 * 1000);
  const closedAt = new Date(Date.now() - 10 * 60 * 1000);

  const trades = PLAYERS.map((player) => {
    const positionId = new mongoose.Types.ObjectId();
    const common = {
      competitionId,
      userId: player.id,
      symbol: "EUR/USD",
      side: "buy",
      quantity: 1_000,
      entryPrice: 1.1,
      exitPrice: 1.1 + player.pnl / 100_000,
      openedAt,
      closedAt,
    };
    return {
      position: { _id: positionId, status: "closed", leverage: 1, ...common },
      history: {
        positionId: positionId.toString(),
        realizedPnl: player.pnl,
        ...common,
      },
    };
  });

  await db
    ?.collection("tradingpositions")
    .insertMany(trades.map((t) => t.position));
  await db
    ?.collection("tradehistories")
    .insertMany(trades.map((t) => t.history));
}

/**
 * A Game Master who referred the winner, with an active subscription at a configured rate.
 *
 * The rate lives on the current package AND on the cached limits, both at `GM_RATE`, because
 * this file is not testing which of the two is read - R31's suite does that, and does it with
 * the two deliberately disagreeing.
 */
async function seedGameMaster(status: "active" | "cancelled"): Promise<void> {
  const db = mongoose.connection.db;
  const packageId = new mongoose.Types.ObjectId();

  await db?.collection("marketplaceitems").insertOne({
    _id: packageId,
    name: "Referral Tier",
    itemType: "game_master_package",
    gameMasterConfig: {
      referralFeePercentage: GM_RATE,
      maxCompetitionsPerDay: 5,
      canCreateCompetitions: true,
    },
    createdAt: new Date(),
  });

  await db?.collection("gamemastersubscriptions").insertOne({
    userId: GM_ID,
    userEmail: "gm@example.test",
    userName: "Game Master",
    status,
    isPaused: false,
    packageId: packageId.toString(),
    limits: {
      maxCompetitionsPerDay: 5,
      maxUsersPerCompetition: 50,
      referralFeePercentage: GM_RATE,
      canCreateCompetitions: true,
      canEarnFromChallenges: false,
    },
    totalEarnings: 0,
    pendingEarnings: 0,
    createdAt: new Date(),
  });

  await db?.collection("userreferrals").insertMany(
    REFERRED.map((p) => ({
      userId: p.id,
      gameMasterId: GM_ID,
      userName: p.name,
      userEmail: `${p.name.replace(/\s+/g, "").toLowerCase()}@example.test`,
      isActive: true,
      createdAt: new Date(),
    })),
  );
}

/** Every money fact a settlement produces, in one comparable shape. */
async function moneySnapshot(competitionId: string) {
  const db = mongoose.connection.db;

  const earnings =
    (await db
      ?.collection("gamemasterearnings")
      .find({ sourceId: competitionId })
      .toArray()) ?? [];

  const retained =
    (await db
      ?.collection("platformtransactions")
      .find({ transactionType: "retained_gm_fee" })
      .toArray()) ?? [];

  const platformFees =
    (await db
      ?.collection("platformtransactions")
      .find({ transactionType: "platform_fee" })
      .toArray()) ?? [];

  // Counted because it is the other half of the fee decision: when nobody is paid, the
  // remainder becomes an unclaimed pool rather than platform income, and a path that books it
  // as income instead would leave `platformFeeTotal` looking plausible.
  const unclaimed =
    (await db
      ?.collection("platformtransactions")
      .find({ transactionType: "unclaimed_pool" })
      .toArray()) ?? [];

  const gmWallet = await db?.collection("creditwallets").findOne({ userId: GM_ID });

  const gmLedger =
    (await db
      ?.collection("wallettransactions")
      .find({ userId: GM_ID, transactionType: "gamemaster_earning" })
      .toArray()) ?? [];

  const subscription = await db
    ?.collection("gamemastersubscriptions")
    .findOne({ userId: GM_ID });

  // Reason for the plain string: `WalletTransaction.competitionId` is declared `String`, so
  // Mongoose casts the ObjectId both writers pass. Querying with an ObjectId through the raw
  // driver - which does no casting - matches nothing and reports zero prizes paid, on a
  // settlement that paid them correctly. Caught here only because the platform fee arithmetic
  // did not agree with "no winners".
  const prizesPaid =
    (await db
      ?.collection("wallettransactions")
      .find({ competitionId, transactionType: "competition_win" })
      .toArray()) ?? [];

  return {
    earningRows: earnings.length,
    earningTotal: round(earnings.reduce((s, r) => s + ((r.netEarning as number) ?? 0), 0)),
    retainedRows: retained.length,
    retainedTotal: round(retained.reduce((s, r) => s + ((r.amount as number) ?? 0), 0)),
    platformFeeRows: platformFees.length,
    platformFeeTotal: round(platformFees.reduce((s, r) => s + ((r.amount as number) ?? 0), 0)),
    unclaimedRows: unclaimed.length,
    unclaimedTotal: round(unclaimed.reduce((s, r) => s + ((r.amount as number) ?? 0), 0)),
    gmBalance: round(((gmWallet?.creditBalance as number) ?? 0) - START_BALANCE),
    gmLedgerRows: gmLedger.length,
    gmLedgerTotal: round(gmLedger.reduce((s, r) => s + ((r.amount as number) ?? 0), 0)),
    subscriptionTotalEarnings: round((subscription?.totalEarnings as number) ?? 0),
    subscriptionPendingEarnings: round((subscription?.pendingEarnings as number) ?? 0),
    prizeRows: prizesPaid.length,
    prizeTotal: round(prizesPaid.reduce((s, r) => s + ((r.amount as number) ?? 0), 0)),
  };
}

/** Floating-point noise is not a difference between two settlement paths. */
function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

type Finalizer = (competitionId: string) => Promise<unknown>;

async function settleWith(
  finalize: Finalizer,
  gmStatus: "active" | "cancelled" = "active",
) {
  // Reason: a parity test runs this twice, and the two runs must not see each other. Without
  // the clear the second seed collides on `creditwallets.userId` - and had that index not
  // existed it would have been worse than a crash, because the second run would have
  // inherited the first app's ledger rows and both snapshots would have "agreed".
  await clearTestMongo();

  const competitionId = await seedFinishedCompetition();
  await seedGameMaster(gmStatus);

  const result = (await finalize(competitionId)) as {
    success?: boolean;
    error?: string;
    message?: string;
  };

  // A settlement that refused would make every money assertion below trivially equal.
  expect(result?.success, `finalize refused: ${result?.error ?? result?.message}`).toBe(
    true,
  );

  return moneySnapshot(competitionId);
}

describe("R26 - the admin app must pay Game Masters exactly as the main app does", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections([
      "competitions",
      "competitionparticipants",
      "creditwallets",
      "wallettransactions",
      "tradingpositions",
      "tradehistories",
      "platformtransactions",
      "gamemasterearnings",
      "gamemastersubscriptions",
      "userreferrals",
      "marketplaceitems",
      "notifications",
    ]);
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  it("pays the referring Game Master when the admin app settles the contest", async () => {
    // The defect in one assertion. Before the fix every one of these is zero: the admin
    // action had no referral stage, so the commission simply stayed with the platform.
    const admin = await settleWith(finalizeInAdminApp);

    expect(admin.earningRows).toBe(REFERRED.length);
    expect(admin.earningTotal).toBe(REFERRED.length * ENTRY_FEE * (GM_RATE / 100));
    expect(admin.gmLedgerRows).toBe(1);
    expect(admin.gmBalance).toBe(REFERRED.length * ENTRY_FEE * (GM_RATE / 100));
  });

  it("books the platform fee NET of the commission, not gross", async () => {
    // Asserted separately from the earnings above because it is the half a partial fix
    // forgets. The admin block recorded `prizePool - totalDistributed` and stopped, so
    // adding a referral payment without changing it would credit the Game Master AND leave
    // the platform's ledger claiming it kept the same amount as before - the same money
    // counted twice, in two different books.
    const admin = await settleWith(finalizeInAdminApp);
    const main = await settleWith(finalizeInMainApp);

    expect(admin.platformFeeTotal).toBe(main.platformFeeTotal);
    expect(admin.platformFeeTotal).toBeLessThan(
      round(PLAYERS.length * ENTRY_FEE * (PLATFORM_FEE_PERCENT / 100)),
    );
  });

  it("produces byte-for-byte the same money as the main app, every row", async () => {
    // The acceptance criterion itself. Comparing whole snapshots rather than named fields is
    // deliberate: a figure nobody thought to assert is the only way to notice one that is
    // wrong, which is how the admin credential-rotation bug surfaced.
    const admin = await settleWith(finalizeInAdminApp);
    const main = await settleWith(finalizeInMainApp);

    expect(admin).toEqual(main);
  });

  it("records a retained fee when the Game Master's subscription is not active", async () => {
    // The other outcome of the referral stage, and the one with no wallet movement at all.
    // A settlement that only learned to PAY would leave an inactive Game Master's share
    // silently absorbed - which is the original defect again, one branch along.
    const admin = await settleWith(finalizeInAdminApp, "cancelled");
    const main = await settleWith(finalizeInMainApp, "cancelled");

    expect(admin.retainedRows).toBe(REFERRED.length);
    expect(admin.gmBalance).toBe(0);
    expect(admin).toEqual(main);
  });

  it("pays a Game Master once when the admin app finalizes twice", async () => {
    // A retried cron delivery must not pay a referrer twice, and the admin path has neither an
    // optimistic lock nor a retry wrapper - the X1 finding that the finalize functions are not
    // four copies of one function - so it is worth pinning here specifically.
    //
    // WHAT PROTECTS IT IS THE STATUS GUARD, and the first version of this comment said
    // otherwise. It credited the `existingEarning` check inside `distributeGameMasterFees`,
    // which sounds right and is unreachable here: the second call refuses at
    // `status !== "active"` and never reaches the referral stage at all. Removing that
    // duplicate check leaves this test green, which is how the wrong claim was caught. So the
    // duplicate check is NOT covered by this suite - it guards a transaction retried within one
    // finalize attempt, which needs a mocked write conflict to reach, and that is left undone
    // rather than quietly implied.
    const competitionId = await seedFinishedCompetition();
    await seedGameMaster("active");

    await finalizeInAdminApp(competitionId);
    const afterFirst = await moneySnapshot(competitionId);

    await finalizeInAdminApp(competitionId);
    const afterSecond = await moneySnapshot(competitionId);

    expect(afterFirst.earningRows).toBe(REFERRED.length);
    expect(afterSecond).toEqual(afterFirst);
  });
});

/**
 * R42, the sibling defect found in the same pair of files a day later.
 *
 * R26 was a missing referral stage on the admin cron. This is the same shape one layer out
 * and worse: the admin action had no PROVIDER DISPATCH at all, so `routeToTradingSettlement`
 * - which answers only "may trading settle this" - refused every provider contest and left
 * it `active`. Nobody was paid anything, not merely the Game Master.
 *
 * The reason it is a coin flip rather than a consistent failure is that BOTH apps register
 * `checkAndFinalizeCompetitions` on an every-minute cron, so a provider contest settled
 * correctly or not at all depending on which process claimed it first.
 *
 * Note what this suite could NOT have caught before, because it is the reusable part: every
 * test above seeds a trading contest, so a provider-shaped one was never handed to either
 * finalizer. `check:mirrors` was equally silent, and for a reason worth stating - both
 * `provider-finalize.ts` and `provider-settlement.service.ts` were already mirrored into
 * `apps/admin` and imported by nothing. The two copies agreed; only the call site was absent.
 */
describe("R42 - the admin app must settle a provider contest, not refuse it", () => {
  const PROVIDER_GAME_KEY = "mock:mock-puzzle";

  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections([
      "competitions",
      "competitionparticipants",
      "creditwallets",
      "wallettransactions",
      "platformtransactions",
      "gamemasterearnings",
      "gamemastersubscriptions",
      "userreferrals",
      "marketplaceitems",
      "notifications",
      "provider_game",
      "game_round",
    ]);
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  /**
   * Seeded through the raw driver on purpose, matching `provider-settlement.test.ts`, and the
   * collection name is explicit: these schemas set `provider_game` rather than the pluralised
   * default, and writing to a guessed name has exactly the same symptom as writing a wrong value.
   */
  async function seedProviderContest(
    /**
     * How many of the trailing players never produced a score at all.
     *
     * A COUNT RATHER THAN A FLAG, because the two interesting cases are different: one
     * unscored player among scorers tests that their prize rank is redistributed, and
     * *every* player unscored tests that nobody is paid. A boolean would only express the
     * first, which is the one that looks like the whole story.
     */
    unscoredTrailingPlayers = 0,
  ): Promise<string> {
    const db = mongoose.connection.db;
    const competitionId = new mongoose.Types.ObjectId();

    await db?.collection("competitions").insertOne({
      _id: competitionId,
      name: "Provider Contest",
      slug: `provider-contest-${competitionId.toString()}`,
      description: "Seeded for the admin dispatch test",
      gameType: "provider",
      gameKey: PROVIDER_GAME_KEY,
      providerGame: { providerKey: "mock", gameCode: "mock-puzzle" },
      attemptsPolicy: "single",
      unresolvedRoundPolicy: "score_zero",
      entryFee: ENTRY_FEE,
      prizePool: PLAYERS.length * ENTRY_FEE,
      platformFeePercentage: PLATFORM_FEE_PERCENT,
      status: "active",
      createdBy: GM_ID,
      startTime: new Date(Date.now() - 7_200_000),
      endTime: new Date(Date.now() - 60_000),
      registrationDeadline: new Date(Date.now() - 7_500_000),
      maxParticipants: 100,
      minParticipants: 2,
      currentParticipants: PLAYERS.length,
      // `rank`, not `position` - and the first draft used the latter. Worth the note because
      // the raw driver accepts either happily and the failure surfaces two stages later, as a
      // Mongoose validation error when settlement SAVES the document, by which point the log
      // already shows a plausible-looking unclaimed pool and a platform fee.
      prizeDistribution: [
        { rank: 1, percentage: 60 },
        { rank: 2, percentage: 30 },
        { rank: 3, percentage: 10 },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db?.collection("provider_game").insertOne({
      providerKey: "mock",
      gameCode: "mock-puzzle",
      gameKey: PROVIDER_GAME_KEY,
      name: "Mock Puzzle",
      scoreDirection: "higher_is_better",
      providerStatus: "active",
      chartvoltEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    /*
      `competitionId` AS A STRING, and the first draft passed the ObjectId.

      `CompetitionParticipant.competitionId` is declared `String`, so Mongoose casts the
      ObjectId this test holds down to a string when settlement queries - and the raw driver
      does no casting at all, so the seeded rows stayed ObjectIds and matched nothing.

      What makes it worth a comment is the symptom. Settlement did not crash: it logged
      `Found 0 participants`, booked the entire pool as an unclaimed pool, recorded a platform
      fee, marked the contest `completed` and returned success. Only `prizeRows` disagreed. The
      status assertion in the test above passes either way, which is the argument for asserting
      the money separately rather than trusting a terminal status.

      Scores descend so a real ranking is distinguishable from everybody tying on zero.
    */
    const firstUnscoredIndex = PLAYERS.length - unscoredTrailingPlayers;

    await db?.collection("competitionparticipants").insertMany(
      PLAYERS.map((p, index) => {
        const seat = {
          competitionId: competitionId.toString(),
          userId: p.id,
          username: p.name,
          email: `${p.id}@example.test`,
          gameKey: PROVIDER_GAME_KEY,
          status: "active",
          enteredAt: new Date(Date.now() - 5_400_000 + index * 1000),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        /*
          THE FIELD IS OMITTED, NEVER SET TO ZERO OR NULL, and that is the fixture's whole
          job. A player who never launched a round has no `score` path on the document at
          all, which is a different fact from a stored zero - the player who attempted the
          game and scored nothing. Seeding a zero here would make the test pass against a
          truthiness check (`if (!score)`), which refuses the player who did play.
        */
        return index >= firstUnscoredIndex
          ? seat
          : { ...seat, score: (PLAYERS.length - index) * 100 };
      }),
    );

    await db?.collection("creditwallets").insertMany(
      PLAYERS.map((p) => ({
        userId: p.id,
        creditBalance: START_BALANCE,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );

    return competitionId.toString();
  }

  it("settles a provider contest instead of refusing it", async () => {
    // The defect in one assertion. Before the fix this returns `success: false` with the
    // trading-gate error and the contest is still `active`, which is the whole bug: an
    // operator sees a finished contest that never pays out and no error anywhere they look.
    const competitionId = await seedProviderContest();

    const result = (await finalizeInAdminApp(competitionId)) as {
      success?: boolean;
      error?: string;
    };

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const after = await mongoose.connection.db
      ?.collection("competitions")
      .findOne({ _id: new mongoose.Types.ObjectId(competitionId) });

    expect(after?.status).toBe("completed");
  });

  it("pays the provider contest's winner, and pays the same as the main app", async () => {
    // Asserted separately from the status above because it is the half a partial fix forgets:
    // dispatching to the provider path and then failing inside it would leave the contest
    // `completed` with nobody paid, and the status assertion alone cannot see that.
    //
    // The parity half is the point of the file - the two apps must agree - and it is what
    // stops this being pinned to whatever the admin path happens to do today.
    const adminContest = await seedProviderContest();
    await finalizeInAdminApp(adminContest);
    const adminMoney = await moneySnapshot(adminContest);

    await clearTestMongo();

    const mainContest = await seedProviderContest();
    await finalizeInMainApp(mainContest);
    const mainMoney = await moneySnapshot(mainContest);

    expect(adminMoney.prizeRows).toBeGreaterThan(0);
    expect(adminMoney).toEqual(mainMoney);
  });

  it("still refuses a game neither app can settle, and leaves the contest untouched", async () => {
    // The fail-closed half. An unknown label must not fall through to the trading path now
    // that a second branch exists beside it, and the refusal must write NOTHING - the reason
    // the dispatch sits before the session rather than after the lock, since a refusal past
    // the lock strands the contest in `finalizing` with nobody able to claim it again.
    const competitionId = await seedProviderContest();
    await mongoose.connection.db
      ?.collection("competitions")
      .updateOne(
        { _id: new mongoose.Types.ObjectId(competitionId) },
        { $set: { gameType: "chess" } },
      );

    const before = await mongoose.connection.db
      ?.collection("competitions")
      .findOne({ _id: new mongoose.Types.ObjectId(competitionId) });

    const result = (await finalizeInAdminApp(competitionId)) as {
      success?: boolean;
      error?: string;
    };

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();

    const after = await mongoose.connection.db
      ?.collection("competitions")
      .findOne({ _id: new mongoose.Types.ObjectId(competitionId) });

    expect(after?.status).toBe("active");
    // Reason: asserting `updatedAt` never moved is what distinguishes "refused before the
    // session" from "refused after taking the lock". The end status is identical either way.
    expect(after?.updatedAt).toEqual(before?.updatedAt);
  });

  /**
   * NO RESULT, NO PRIZE - proven at the settlement seam and in BOTH apps.
   *
   * `__tests__/services/provider-prize-eligibility.test.ts` pins the rule on the pure ranking
   * functions, which is where it is easiest to read. These two tests exist because that is
   * structurally silent about whether real settlement reaches the rule at all - the same
   * lesson as the score seam, where every suite seeded the value under test. **When a value
   * crosses a seam, one test must start on the far side of it.**
   *
   * And they live in the parity file rather than beside the pure tests because
   * `competition-ranking.service.ts` is a **divergent duplicate**: the two copies differ in
   * comments and `console.log` lines, `check:mirrors` compares models so it has never had an
   * opinion about them, and both apps run `checkAndFinalizeCompetitions` on an every-minute
   * cron. An eligibility rule applied to one copy only means **whether a player who never
   * played is paid depends on which process won the race**, which is R26 and R42 exactly.
   */
  it("pays nothing to a player who never scored, and redistributes their rank", async () => {
    const competitionId = await seedProviderContest(1);

    const result = (await finalizeInAdminApp(competitionId)) as {
      success?: boolean;
    };
    expect(result.success).toBe(true);

    const db = mongoose.connection.db;
    const unscored = PLAYERS[PLAYERS.length - 1];

    const unscoredWallet = await db
      ?.collection("creditwallets")
      .findOne({ userId: unscored.id });

    // The defect in one assertion: before the fix this player took rank 3's 10% of the pot
    // for a contest they never started, and nothing anywhere recorded that as odd.
    expect(unscoredWallet?.creditBalance).toBe(START_BALANCE);

    /*
      AND THE POT WAS STILL PAID OUT IN FULL, which is the half that a fix stopping at
      "do not pay them" would get wrong. Rank 3 is unclaimed, so its 10% is redistributed
      among the players who did place - the owner's own description of the rule. Asserted as
      the total rather than per player so the test does not restate the arithmetic the
      distribution function owns.
    */
    const scoredWallets = await db
      ?.collection("creditwallets")
      .find({ userId: { $in: PLAYERS.slice(0, -1).map((p) => p.id) } })
      .toArray();

    const paidOut = (scoredWallets ?? []).reduce(
      (sum, w) => sum + (w.creditBalance - START_BALANCE),
      0,
    );
    const pool = PLAYERS.length * ENTRY_FEE;
    expect(paidOut).toBeCloseTo(pool * (1 - PLATFORM_FEE_PERCENT / 100), 2);

    // The reason reaches the player, because `finalLeaderboard` is what every results screen
    // reads. A disqualification with no explanation on a contest somebody paid to enter is
    // the support ticket the field exists to answer.
    const contest = await db
      ?.collection("competitions")
      .findOne({ _id: new mongoose.Types.ObjectId(competitionId) });
    const row = (
      contest?.finalLeaderboard as
        | { userId: string; disqualificationReason?: string }[]
        | undefined
    )?.find((entry) => entry.userId === unscored.id);
    expect(row?.disqualificationReason).toMatch(/no score/i);
  });

  it("pays nobody when nobody scored, and both apps agree", async () => {
    /*
      "If no winner meaning no score for anyone all loose." Before the fix every entrant tied
      at rank 1 on a fallback zero and **split the entire pot between them**, having played
      nothing - the opposite of nobody winning, and it read on screen as a prize-distribution
      bug rather than as an eligibility one.

      The money then goes to the fee stage's existing `all_disqualified` unclaimed pool, net
      of the platform fee, exactly as a trading contest with no qualified winner does.
      **Whether it should instead be refunded is an owner decision this change did not take**,
      and the test asserts what the platform does rather than what it should do.
    */
    const adminContest = await seedProviderContest(PLAYERS.length);
    const adminResult = (await finalizeInAdminApp(adminContest)) as {
      success?: boolean;
    };
    expect(adminResult.success).toBe(true);

    const adminMoney = await moneySnapshot(adminContest);
    expect(adminMoney.prizeRows).toBe(0);

    await clearTestMongo();

    const mainContest = await seedProviderContest(PLAYERS.length);
    await finalizeInMainApp(mainContest);
    const mainMoney = await moneySnapshot(mainContest);

    /*
      THIS COMPARISON DOES NOT PROVE THE ADMIN COPY OF THE RANKING ENGINE LEARNED THE RULE,
      and the comment here claimed it did until a probe disproved it. Both finalizers resolve
      `@/lib/services/competition-ranking.service` through vitest's alias to the ROOT copy, so
      blanking the gate in `apps/admin/lib/services/competition-ranking.service.ts` leaves this
      whole suite green. What the comparison proves is that the two finalizers agree given one
      ranking engine - worth having, and not the same claim. The structural test below is what
      holds the other half.
    */
    expect(adminMoney).toEqual(mainMoney);
  });
});

/**
 * The two copies of the ranking engine, compared as TEXT because nothing else can.
 *
 * WHY THIS IS NOT A RUNTIME TEST, which is the first thing to try and it cannot work. Vitest
 * aliases `@` to the repository root, so every admin file under test imports the root copy of
 * this service - deliberately, because that is what makes admin actions testable at all. The
 * consequence is that no runtime assertion in this file can distinguish the two copies, and a
 * probe blanking the admin gate is green in every suite. That is a limitation of the harness,
 * so the guard has to read the source.
 *
 * WHY THE PAIR NEEDS A GUARD AT ALL, when `check:mirrors` exists: it compares **models**. This
 * service is a divergent duplicate - 77 lines apart, because the admin copy carries its own
 * logging - so it can never be byte-compared either, and nothing in the repository has ever
 * had an opinion about it. It is reached by BOTH apps' every-minute finalize cron, which is
 * exactly the shape of R26 and R42, making this the third finding in this one file pair. The
 * failure mode is not an error: a rule present in one copy only means the payout depends on
 * which cron claimed the contest first.
 *
 * The correction that came with it: this suite's header used to justify itself on the grounds
 * that "the two copies of every dependency this touches are byte-identical". That was true of
 * `fees.service.ts` and `lib/games/` and it was never true of this one.
 */
describe("the eligibility gate exists in both copies of the ranking engine", () => {
  const RANKING_COPIES = [
    "lib/services/competition-ranking.service.ts",
    "apps/admin/lib/services/competition-ranking.service.ts",
  ];

  /*
    Comments are stripped before matching, because both copies explain this gate in a long
    paragraph directly above it, and a structural test that reads prose fails in both
    directions - it passes a file whose only surviving mention is the explanation, and flags a
    correct file for discussing the anti-pattern.
 
    HONESTLY: the strip changes no answer TODAY, and saying so beats implying it is what holds
    the property. Neither paragraph currently writes the call out, so `hasResult` appears
    exactly once in each file either way - checked, not assumed. It is kept because the
    paragraph is precisely the kind of prose somebody extends with the literal call while
    explaining it, at which point the count assertion below silently starts reading two.
  */
  const sourceWithoutComments = (relativePath: string): string =>
    readFileSync(join(process.cwd(), relativePath), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");

  it.each(RANKING_COPIES)("%s asks the module for a result", (relativePath) => {
    const source = sourceWithoutComments(relativePath);

    /*
      The OPERATOR is asserted, not the operand. `toContain("hasResult")` stays true when the
      call is replaced by a hand-rolled `participant.score !== undefined`, because the name
      survives in the import line - which is how three assertions were defeated in one file
      during the round inspector.
    */
    const gate = /if\s*\(\s*isCompleted\s*&&\s*!\s*gameModule\.hasResult\(\s*participant\s*\)\s*\)/;
    expect(source).toMatch(gate);

    /*
      And the branch has to REFUSE. Position within the construct, never a fixed-character
      scan back from the refusal: a window of N characters begins mid-identifier and reports a
      guard missing that is present.
    */
    const gateAt = source.search(gate);
    const branch = source.slice(gateAt, gateAt + 200);
    expect(branch.length).toBeGreaterThan(100);
    expect(branch).toMatch(/qualified:\s*false/);
    expect(branch).toMatch(/reason:\s*"No score recorded"/);
  });

  it.each(RANKING_COPIES)(
    "%s scopes the gate to a completed contest",
    (relativePath) => {
      /*
        Counted rather than merely matched. `isCompleted` appears several times in both files
        for the trading checks, so the interesting failure is a SECOND unscoped call to
        `hasResult` added beside the scoped one - which any single positive match is happy
        with, and which would disqualify every player mid-round on the live leaderboard.
      */
      const source = sourceWithoutComments(relativePath);
      const calls = source.match(/gameModule\.hasResult\(/g) ?? [];

      expect(calls).toHaveLength(1);
    },
  );
});
