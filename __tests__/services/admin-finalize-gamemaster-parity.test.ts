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
 * That is sound here and it is worth being exact about why: the two copies of every
 * dependency this touches are byte-identical (`fees.service.ts`, `types.ts`,
 * `game-master-fees/`, verified with `git diff --no-index`, and `check:mirrors` guards the
 * models), and the defect was never in a dependency - it was in the action file's own
 * control flow, which is precisely what this exercises. It cannot catch drift INSIDE a
 * dependency, so it is not a substitute for `check:mirrors`.
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
