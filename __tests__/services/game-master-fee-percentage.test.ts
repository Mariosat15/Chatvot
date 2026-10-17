import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
} from "../helpers/mongo-test-server";
import {
  buildSubscriptionLimits,
  DEFAULT_GM_LIMITS,
} from "@/lib/services/gamemaster/subscription-limits";
import { calculateGameMasterFees } from "@/lib/services/settlement/game-master-fees";

/**
 * R31: a Game Master package configured at 0% referral fee.
 *
 * WHAT THE RISK REGISTER GOT WRONG, AND WHY IT MATTERS THAT IT DID. R31 said a 0% package
 * "is paid 5% instead". Read against the code that is too strong: `resolveFeePercentage`
 * checks the current package with `!== undefined`, so a package that exists and says 0
 * correctly yields 0. The `||` sites are the two FALLBACKS - the cached
 * `subscription.limits`, used when the package has been deleted or when the subscription
 * carries no `packageId`.
 *
 * The register was right that it is a bug and wrong about which path, which is exactly the
 * reason to check a risk against the code before fixing it: a fix aimed at the sentence
 * rather than the defect would have changed the one branch that was already correct.
 *
 * AND THE PART NOTHING HAD RECORDED, which is worse than the tracked one: five routes copy
 * a package's config onto the subscription with `config.referralFeePercentage || 5`, so
 * buying a 0% package STORES 5%. The cached fallback is therefore wrong from the moment the
 * subscription is created, and the challenge path - which resolves with `??` and is
 * otherwise correct - reads that stored 5 and pays it. The bug reaches the challenge path
 * through the data rather than through the code.
 */

describe("buildSubscriptionLimits - the one writer of a subscription's cached limits", () => {
  it("stores a 0% referral fee as 0, not as the 5% default", () => {
    // The defect, in one assertion. `config.referralFeePercentage || 5` returns 5 here.
    const limits = buildSubscriptionLimits({ referralFeePercentage: 0 });

    expect(limits.referralFeePercentage).toBe(0);
  });

  it("uses the default only when the package declares no rate at all", () => {
    // Reason both halves are asserted together: a fix that turns `||` into `??` has to keep
    // the absent case working, and a test for one without the other collapses the two facts
    // into a single assertion that either could satisfy.
    expect(buildSubscriptionLimits({}).referralFeePercentage).toBe(
      DEFAULT_GM_LIMITS.referralFeePercentage,
    );
    expect(
      buildSubscriptionLimits({ referralFeePercentage: undefined })
        .referralFeePercentage,
    ).toBe(DEFAULT_GM_LIMITS.referralFeePercentage);
  });

  it("refuses NaN, which is what `??` alone would have let through", () => {
    // These values arrive from `parseFloat` on an admin form, so `NaN` is one keystroke
    // away. Stored on a required Number path it is a percentage that turns every
    // multiplication downstream into `NaN` - and nothing in the payout checks.
    const limits = buildSubscriptionLimits({
      referralFeePercentage: Number.NaN,
      maxCompetitionsPerDay: Number.NaN,
    });

    expect(limits.referralFeePercentage).toBe(5);
    expect(limits.maxCompetitionsPerDay).toBe(1);
  });

  it("keeps 0 for the other numeric limits too", () => {
    // Reason: the same `||` sat on all three in every copy. A package granting 0
    // competitions per day is a legitimate read-only tier, and `|| 1` silently grants one.
    const limits = buildSubscriptionLimits({
      maxCompetitionsPerDay: 0,
      maxUsersPerCompetition: 0,
    });

    expect(limits.maxCompetitionsPerDay).toBe(0);
    expect(limits.maxUsersPerCompetition).toBe(0);
  });

  it("treats the two boolean flags with opposite defaults, matching the schema", () => {
    const absent = buildSubscriptionLimits({});
    expect(absent.canCreateCompetitions).toBe(true);
    expect(absent.canEarnFromChallenges).toBe(false);

    const explicit = buildSubscriptionLimits({
      canCreateCompetitions: false,
      canEarnFromChallenges: true,
    });
    expect(explicit.canCreateCompetitions).toBe(false);
    expect(explicit.canEarnFromChallenges).toBe(true);
  });

  it("leaves the challenge rate absent rather than copying the competition rate", () => {
    // Reason: both money paths already fall back from the challenge rate to the competition
    // rate when it is absent. Filling it in here would freeze today's competition rate into
    // the challenge rate, so a later admin change to the package would stop reaching it -
    // and the subscription would look correctly configured.
    const limits = buildSubscriptionLimits({ referralFeePercentage: 7.5 });

    expect(limits.challengeReferralFeePercentage).toBeUndefined();
    expect("challengeReferralFeePercentage" in limits).toBe(false);
  });

  it("keeps an explicit 0% challenge rate, which is a different fact from an absent one", () => {
    // A package that grants challenge earnings at 0% is saying something; an absent value
    // says "use the competition rate". Collapsing them pays the competition rate to a Game
    // Master whose package deliberately pays nothing on challenges.
    const limits = buildSubscriptionLimits({
      referralFeePercentage: 7.5,
      challengeReferralFeePercentage: 0,
    });

    expect(limits.challengeReferralFeePercentage).toBe(0);
  });

  it("survives a null or undefined config without inventing a subscription", () => {
    expect(buildSubscriptionLimits(null).referralFeePercentage).toBe(5);
    expect(buildSubscriptionLimits(undefined).canCreateCompetitions).toBe(true);
  });
});

/**
 * The same question asked of the code that actually decides the money.
 *
 * `calculateGameMasterFees` is called with the raw driver rather than through a full
 * settlement, because the percentage is the only thing under test and a finalize would drag
 * in ranking, wallets and the platform-fee cap - every one of them a way for this test to
 * fail for a reason that has nothing to do with the percentage.
 */
describe("resolveFeePercentage - the fee a settlement actually applies", () => {
  const GM_ID = "6500000000000000000000c1";
  const PLAYER_ID = "6500000000000000000000c2";
  const ENTRY_FEE = 100;

  beforeAll(async () => {
    await startTestMongo();
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  async function seedReferredPlayer(): Promise<void> {
    await mongoose.connection.db?.collection("userreferrals").insertOne({
      userId: PLAYER_ID,
      gameMasterId: GM_ID,
      userName: "Referred Player",
      userEmail: "player@example.com",
      isActive: true,
      createdAt: new Date(),
    });
  }

  async function seedSubscription(options: {
    packageId?: string;
    cachedRate?: number;
  }): Promise<void> {
    await mongoose.connection.db
      ?.collection("gamemastersubscriptions")
      .insertOne({
        userId: GM_ID,
        userEmail: "gm@example.com",
        userName: "Game Master",
        status: "active",
        isPaused: false,
        ...(options.packageId ? { packageId: options.packageId } : {}),
        limits: {
          maxCompetitionsPerDay: 5,
          maxUsersPerCompetition: 50,
          referralFeePercentage: options.cachedRate,
          canCreateCompetitions: true,
          canEarnFromChallenges: false,
        },
        createdAt: new Date(),
      });
  }

  async function seedPackage(rate: number | undefined): Promise<string> {
    const id = new mongoose.Types.ObjectId();
    await mongoose.connection.db?.collection("marketplaceitems").insertOne({
      _id: id,
      name: "Zero Tier",
      itemType: "game_master_package",
      gameMasterConfig: {
        ...(rate === undefined ? {} : { referralFeePercentage: rate }),
        maxCompetitionsPerDay: 5,
        canCreateCompetitions: true,
      },
      createdAt: new Date(),
    });
    return id.toString();
  }

  async function earningsFor(): Promise<number> {
    const db = mongoose.connection.db;
    if (!db) throw new Error("no db");

    const result = await calculateGameMasterFees({
      db: db as never,
      participants: [{ userId: PLAYER_ID }],
      entryFee: ENTRY_FEE,
    });

    return result.totalGmEarnings;
  }

  it("pays 0 when the CURRENT package says 0, even though the cache says 5", async () => {
    // Pinned rather than assumed. R31 claimed this was the broken case; it is not, because
    // the package branch tests `!== undefined`. Recording it stops a later "fix" aimed at
    // the risk register's wording from changing the one branch that worked.
    //
    // THE CACHED RATE IS DELIBERATELY 5, NOT 0, and the first version of this test had it as
    // 0 - which made the test unable to fail. Dropping the `!== undefined` check falls
    // through to the cached rate, so with both set to 0 the wrong branch produced the right
    // answer and the probe stayed green. The two sources have to disagree for the assertion
    // to say which one was read.
    await seedReferredPlayer();
    const packageId = await seedPackage(0);
    await seedSubscription({ packageId, cachedRate: 5 });

    expect(await earningsFor()).toBe(0);
  });

  it("pays 0 when the subscription carries no packageId and its cached rate is 0", async () => {
    // THE DEFECT. `limits.referralFeePercentage || 5` returns 5, so the platform pays 5%
    // commission on a package that grants none - and it is charged against the entry fees of
    // players who were promised a different split.
    await seedReferredPlayer();
    await seedSubscription({ cachedRate: 0 });

    expect(await earningsFor()).toBe(0);
  });

  it("pays 0 when the package has been deleted and the cached rate is 0", async () => {
    // The reason the cache exists at all: a package can be removed while Game Masters are
    // still subscribed. The fallback has to be correct, not merely present.
    await seedReferredPlayer();
    await seedSubscription({
      packageId: new mongoose.Types.ObjectId().toString(),
      cachedRate: 0,
    });

    expect(await earningsFor()).toBe(0);
  });

  it("pays 0 when the package exists but declares no rate and the cache says 0", async () => {
    // The third `||`, on the branch where the package document is found but carries no
    // `referralFeePercentage` at all.
    await seedReferredPlayer();
    const packageId = await seedPackage(undefined);
    await seedSubscription({ packageId, cachedRate: 0 });

    expect(await earningsFor()).toBe(0);
  });

  it("still falls back to 5% when no rate is configured anywhere", async () => {
    // The other half of the same change, and it must be asserted beside the 0 cases or a
    // fix that simply returned 0 for everything would pass every test above.
    await seedReferredPlayer();
    await seedSubscription({ cachedRate: undefined });

    expect(await earningsFor()).toBe(ENTRY_FEE * 0.05);
  });

  it("still honours an ordinary configured rate from the current package", async () => {
    await seedReferredPlayer();
    const packageId = await seedPackage(7.5);
    await seedSubscription({ packageId, cachedRate: 5 });

    expect(await earningsFor()).toBe(ENTRY_FEE * 0.075);
  });
});
