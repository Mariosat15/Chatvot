import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

/**
 * The play shape: does everybody play at one appointed moment, or whenever they like?
 *
 * WHAT THIS SUITE IS GUARDING, because the interesting failures here are all silent.
 *
 * Everything built for provider contests so far assumed independent play with staggered
 * starts, which is what a puzzle wants and what a race cannot survive. The owner's
 * requirement is that a second shape arrive without a `switch` on game code anywhere - so the
 * declaration lives on the catalogue ROW, is resolved once in `play-shape.ts`, and every
 * consequence is derived from that one object.
 *
 * Three things about that are worth pinning rather than trusting:
 *
 *   1. THE DECLARATION MUST BE WHAT DECIDES, not `family`. A race is `independent` - every
 *      runner runs their own track - so a resolver that leaned on `family` would put every
 *      race in the same bucket as a puzzle and pass a test suite whose only scheduled fixture
 *      was `head_to_head`. There is therefore a deliberate `independent` + `scheduled` case
 *      below: the one shape where the declaration is the ONLY thing that can produce the
 *      answer, because `family` says otherwise.
 *
 *   2. THE RULES ARE FORCED AT WRITE TIME, not read time. `roundFitsInWindow`,
 *      `RoundPreflight`'s `tooLateToStart` and `fullRoundCutoffMs` all read the STORED policy
 *      already, so storing the right value means not one of them needs to learn about play
 *      modes. That is only true if the two write paths actually do it, which is why the
 *      create and edit tests here are behavioural against a real database rather than
 *      structural: a stored field is the seam, and a structural test cannot see a seam.
 *
 *   3. THE WITHHELD CONTROLS AND THE FORCED VALUES MUST AGREE. A wizard offering "best of
 *      three" on a contest the server is about to store as one attempt is worse than either
 *      being wrong on its own, because the operator has no way to tell which one is lying.
 */

const ROOT = process.cwd();

function readCode(relativePath: string): string {
  // Comments stripped before matching. A structural test that reads prose fails in both
  // directions: it flags a correct file for explaining the anti-pattern, and it passes a
  // broken one whose only mention of the right thing is in a comment.
  return readFileSync(join(ROOT, relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

const {
  resolvePlayMode,
  playShapeRules,
  resolvePlayShape,
  PLAY_MODES,
} = await import("@/lib/services/games/play-shape");

const { resolveContestEntryDeadline } = await import(
  "@/lib/services/games/entry-deadline"
);

const Competition = (
  await import("../../database/models/trading/competition.model")
).default;
const GameProvider = (
  await import("../../database/models/games/game-provider.model")
).default;
const ProviderGame = (
  await import("../../database/models/games/provider-game.model")
).default;
const { WhiteLabel } = await import("../../database/models/whitelabel.model");
const { MOCK_PROVIDER_KEY } = await import(
  "@/lib/services/game-providers/adapters/mock.adapter"
);
const { createProviderContest, listContestableTitles } = await import(
  "../../apps/admin/lib/services/game-providers/provider-contest.service"
);
const { editProviderContest } = await import(
  "../../apps/admin/lib/services/game-providers/provider-contest-edit.service"
);

// =======================================================================================
// resolvePlayMode - which source decides
// =======================================================================================

describe("resolvePlayMode", () => {
  it("treats an absent declaration as anytime, so every title synced before the field is unchanged", () => {
    expect(resolvePlayMode(undefined)).toBe("anytime");
    expect(resolvePlayMode(null)).toBe("anytime");
    expect(resolvePlayMode({})).toBe("anytime");
    expect(resolvePlayMode({ playMode: null })).toBe("anytime");
  });

  it("reads a declared scheduled title as scheduled", () => {
    expect(resolvePlayMode({ playMode: "scheduled" })).toBe("scheduled");
  });

  it("THE LOAD-BEARING CASE: an independent title declaring scheduled IS scheduled", () => {
    // A race is `independent` - every runner runs their own track and records their own
    // time - and is still simultaneous. So this is the one combination where the
    // declaration is the only thing that can produce the right answer, and a resolver that
    // secretly leaned on `family` would return "anytime" here while passing every other
    // test in this block.
    //
    // Stated the other way round, which is why the fixture is written like this: if this
    // suite's only scheduled title were `head_to_head`, the forcing below would satisfy
    // every assertion and the declaration could be ignored entirely.
    expect(resolvePlayMode({ family: "independent", playMode: "scheduled" })).toBe(
      "scheduled",
    );
  });

  it("FORCES head_to_head to scheduled, overriding a declaration that cannot be true", () => {
    // Two people cannot play each other at different times, so `head_to_head` + `anytime`
    // is a combination a provider has got wrong rather than one to honour. Correcting it
    // here is what stops the wizard offering a staggered chess match.
    expect(resolvePlayMode({ family: "head_to_head" })).toBe("scheduled");
    expect(resolvePlayMode({ family: "head_to_head", playMode: "anytime" })).toBe(
      "scheduled",
    );
  });

  it("falls back to anytime on a value it does not recognise, rather than throwing", () => {
    // The opposite of this codebase's usual fail-closed instinct, and deliberately. A race
    // wrongly run as `anytime` is a staggered contest whose scores are still comparable and
    // still payable, because `supportsContentSeed` guarantees the same content. A puzzle
    // wrongly run as `scheduled` shuts entry at the start and turns away paying players.
    expect(resolvePlayMode({ playMode: "synchronous" })).toBe("anytime");
    expect(resolvePlayMode({ playMode: "" })).toBe("anytime");
  });

  it("offers exactly two modes, so a third cannot be added without the rules being written", () => {
    // A tripwire rather than a fact worth asserting on its own. `playShapeRules` is a
    // two-way branch, so a third mode silently resolves to the `anytime` rules - a shape
    // that appears supported and behaves like something else.
    expect([...PLAY_MODES].sort()).toEqual(["anytime", "scheduled"]);
  });
});

// =======================================================================================
// playShapeRules - the consequences
// =======================================================================================

describe("playShapeRules", () => {
  it("leaves an anytime contest with every control the operator had before", () => {
    const rules = playShapeRules("anytime");

    expect(rules.entryClosesAtStart).toBe(false);
    expect(rules.requiresSingleAttempt).toBe(false);
    expect(rules.offersRoundStartPolicy).toBe(true);
    // Nothing forced. An `anytime` contest is exactly what shipped before this change, and
    // a forced value here would silently rewrite every existing operator's choice.
    expect(rules.forcedRoundStartPolicy).toBeUndefined();
    expect(rules.forcedAttemptsPolicy).toBeUndefined();
  });

  it("closes entry at the start of a scheduled contest, and grants one attempt", () => {
    const rules = playShapeRules("scheduled");

    expect(rules.entryClosesAtStart).toBe(true);
    expect(rules.requiresSingleAttempt).toBe(true);
    expect(rules.forcedAttemptsPolicy).toBe("single");
    expect(rules.offersRoundStartPolicy).toBe(false);
    // Reads backwards and is right: entry has already closed at the gun, so the only person
    // this reaches is somebody who entered in time and pressed Play late. `resolveExpiry`
    // clamps their round to the window end, so they get a shortened run - visibly worse
    // than turning up on time, which in a race is the honest outcome. Refusing them instead
    // buys nothing and loses an entry fee they have already paid.
    expect(rules.forcedRoundStartPolicy).toBe("until_window_closes");
  });

  it("explains a withheld control and says nothing when the control is offered", () => {
    // Both halves. A withheld control that says nothing teaches an operator the setting
    // does not exist; a reason attached to a control that IS shown is a sentence nobody can
    // act on, sitting next to a working select.
    expect(playShapeRules("scheduled").copy.roundStartWithheld).toBeTruthy();
    expect(playShapeRules("anytime").copy.roundStartWithheld).toBeUndefined();
  });

  it("gives the two date controls different words, because they describe different things", () => {
    const anytime = playShapeRules("anytime").copy;
    const scheduled = playShapeRules("scheduled").copy;

    expect(scheduled.startLabel).not.toBe(anytime.startLabel);
    expect(scheduled.endLabel).not.toBe(anytime.endLabel);
    // The scheduled hint must say entry closes here, because that is the rule
    // `entryClosesAtStart` enforces and the sentence is the only place an operator meets it.
    expect(scheduled.startHint.toLowerCase()).toContain("entry closes");
    // And the anytime hint must NOT, which is the half that was a live defect: the wizard
    // said "Registration closes at this moment" for a month after `12` s2.10 moved entry to
    // the last playable moment, because the sentence lived in the component and the rule
    // lived in `entry-deadline.ts`.
    expect(anytime.startHint.toLowerCase()).not.toContain("registration closes");
  });

  it("resolvePlayShape is the resolver and the rules in one step", () => {
    expect(resolvePlayShape({ playMode: "scheduled" })).toEqual(
      playShapeRules("scheduled"),
    );
    expect(resolvePlayShape({ family: "head_to_head" })).toEqual(
      playShapeRules("scheduled"),
    );
    expect(resolvePlayShape(null)).toEqual(playShapeRules("anytime"));
  });
});

// =======================================================================================
// The entry deadline
// =======================================================================================

const MINUTE = 60 * 1000;

describe("resolveContestEntryDeadline under a scheduled contest", () => {
  const start = new Date("2026-10-01T12:00:00.000Z");
  const end = new Date("2026-10-01T13:00:00.000Z");

  it("closes entry at the START, not one attempt before the end", () => {
    // The fixture is chosen so the two branches CANNOT agree: a one-hour window with a
    // five-minute attempt puts the reserving answer at 12:55 and the gun at 12:00. Sized
    // the other way - a window exactly one attempt long - both branches return the start
    // and the test would pass with the new rule deleted.
    const scheduled = resolveContestEntryDeadline({
      playWindowEnd: end,
      attemptSeconds: 300,
      roundStartPolicy: "reserve_full_round",
      startTime: start,
      entryClosesAtStart: true,
    });
    const anytime = resolveContestEntryDeadline({
      playWindowEnd: end,
      attemptSeconds: 300,
      roundStartPolicy: "reserve_full_round",
      startTime: start,
    });

    expect(scheduled.toISOString()).toBe(start.toISOString());
    expect(anytime.getTime()).toBe(end.getTime() - 5 * MINUTE);
    expect(scheduled.getTime()).not.toBe(anytime.getTime());
  });

  it("ignores the policy and the attempt length entirely", () => {
    // `until_window_closes` normally means "no reservation, entry to the last second", and
    // a scheduled contest is STORED with that policy. So if the flag were checked after the
    // policy rather than before it, every scheduled contest would keep entry open for its
    // whole duration - which is the exact defect the shape exists to prevent.
    for (const policy of ["reserve_full_round", "until_window_closes"] as const) {
      for (const attemptSeconds of [undefined, 1, 3600]) {
        expect(
          resolveContestEntryDeadline({
            playWindowEnd: end,
            attemptSeconds,
            roundStartPolicy: policy,
            startTime: start,
            entryClosesAtStart: true,
          }).toISOString(),
        ).toBe(start.toISOString());
      }
    }
  });

  it("leaves every existing caller alone when the flag is absent or false", () => {
    // Additive means additive. An omitted flag must behave exactly as it did before the
    // field existed, or this change quietly closes entry early on every contest already
    // running.
    const absent = resolveContestEntryDeadline({
      playWindowEnd: end,
      attemptSeconds: 300,
      roundStartPolicy: "until_window_closes",
      startTime: start,
    });
    const explicitFalse = resolveContestEntryDeadline({
      playWindowEnd: end,
      attemptSeconds: 300,
      roundStartPolicy: "until_window_closes",
      startTime: start,
      entryClosesAtStart: false,
    });

    expect(absent.getTime()).toBe(end.getTime());
    expect(explicitFalse.getTime()).toBe(end.getTime());
  });
});

// =======================================================================================
// The write paths - behavioural, against a real database
// =======================================================================================

const COLLECTIONS = ["competitions", "game_provider", "provider_game", "whitelabels"];
const HOUR = 60 * 60 * 1000;

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

/**
 * A provider and one title, whose shape the caller chooses.
 *
 * EVERY FIELD THE SCHEMA DEMANDS, not just the ones a test reads. Mongoose validates the
 * document rather than the subset under test, and a fixture trimmed to what matters is how
 * a whole suite once failed on one missing `slug`.
 */
async function seedCatalogue(
  title: { playMode?: string; family?: string; gameCode?: string } = {},
) {
  const gameCode = title.gameCode ?? "mock-trivia";

  await GameProvider.create({
    providerKey: MOCK_PROVIDER_KEY,
    displayName: "Mock Provider",
    baseUrl: "https://mock.example.com",
    enabled: true,
  });
  await ProviderGame.create({
    providerKey: MOCK_PROVIDER_KEY,
    gameCode,
    gameKey: `provider:${MOCK_PROVIDER_KEY}:${gameCode}`,
    displayName: "Mock Trivia",
    family: title.family ?? "independent",
    ...(title.playMode ? { playMode: title.playMode } : {}),
    scoreDirection: "higher_is_better",
    scoreType: "integer",
    maxDurationSeconds: 300,
    supportsCompetition: true,
    supportsOneVsOne: true,
    // Reason: the model defaults this to false, so omitting it is correctly refused by the
    // pre-flight's fairness gate - the gate working, not a broken fixture.
    supportsContentSeed: true,
    chartvoltEnabled: true,
    providerStatus: "active",
    configSchema: {
      type: "object",
      properties: {
        rounds: { type: "integer", minimum: 1, maximum: 20, default: 5 },
      },
      required: ["rounds"],
    },
    lastSuccessfulRoundAt: new Date(),
  });
  await WhiteLabel.create({ externalGamesEnabled: true });

  return gameCode;
}

function createInput(gameCode: string, overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + 2 * HOUR);
  const end = new Date(Date.now() + 6 * HOUR);

  return {
    providerKey: MOCK_PROVIDER_KEY,
    gameCode,
    name: "Shape Test",
    description: "A contest used to check the play shape reaches the database.",
    settings: { rounds: 5 },
    startTime: start,
    endTime: end,
    playWindowStart: start,
    playWindowEnd: end,
    resultGracePeriodSeconds: 900,
    // The operator asks for three attempts and a reserving policy. A scheduled title must
    // override BOTH, so the fixture deliberately disagrees with the forced values.
    attemptsPolicy: "best_of_n" as const,
    attemptsAllowed: 3,
    roundStartPolicy: "reserve_full_round" as const,
    unresolvedRoundPolicy: "score_zero" as const,
    unscoredContestPolicy: "refund_entry_fees" as const,
    entryFee: 10,
    minParticipants: 2,
    maxParticipants: 50,
    platformFeePercentage: 10,
    prizeDistribution: [
      { rank: 1, percentage: 50 },
      { rank: 2, percentage: 30 },
      { rank: 3, percentage: 20 },
    ],
    createdBy: "507f1f77bcf86cd799439011",
    perRoundCostAcknowledged: true,
    ...overrides,
  };
}

/**
 * The fields these tests read back off a stored contest.
 *
 * Named once and pinned against the real schema by the test below, because an explicitly typed
 * `.lean<{...}>()` is checked against the hand-written generic and NOT against the model - so a
 * field the schema does not declare reads as real, compiles clean, and returns `undefined` for
 * ever. That is how the `scoreDirection` read behind R33 survived two typechecks.
 */
interface StoredContestFields {
  startTime: Date;
  playWindowEnd?: Date;
  registrationDeadline?: Date;
  attemptsPolicy?: string;
  attemptsAllowed?: number;
  roundStartPolicy?: string;
}

const STORED_CONTEST_FIELDS: (keyof StoredContestFields)[] = [
  "startTime",
  "playWindowEnd",
  "registrationDeadline",
  "attemptsPolicy",
  "attemptsAllowed",
  "roundStartPolicy",
];

function readContest(filter: Record<string, unknown>) {
  return Competition.findOne(filter).lean<StoredContestFields | null>();
}

describe("createProviderContest stores the shape's rules", () => {
  it("reads back only fields the Competition schema declares", () => {
    const declared = Object.keys(Competition.schema.paths);
    for (const field of STORED_CONTEST_FIELDS) {
      expect(declared).toContain(field);
    }
  });

  it("leaves an anytime contest exactly as the operator asked", async () => {
    // The control. Without it, a forced value applied to EVERY contest would satisfy the
    // scheduled test below and destroy the operator's choice everywhere else - and this is
    // the case that covers the whole live catalogue.
    const gameCode = await seedCatalogue({ playMode: "anytime" });
    const result = await createProviderContest(createInput(gameCode));
    expect(result.success).toBe(true);

    const stored = await readContest({ name: "Shape Test" });
    expect(stored?.attemptsPolicy).toBe("best_of_n");
    expect(stored?.attemptsAllowed).toBe(3);
    expect(stored?.roundStartPolicy).toBe("reserve_full_round");
    // Entry to the last playable moment: the window end less one attempt.
    expect(stored?.registrationDeadline?.getTime()).toBe(
      stored!.playWindowEnd!.getTime() - 300 * 1000,
    );
  });

  it("OVERRIDES the operator on a scheduled title, and stores all three consequences", async () => {
    const gameCode = await seedCatalogue({
      // `independent` on purpose: the declaration must be what decides, so a create service
      // that read `family` would treat this as a puzzle and store the operator's answers.
      family: "independent",
      playMode: "scheduled",
    });
    const result = await createProviderContest(createInput(gameCode));
    expect(result.success).toBe(true);

    const stored = await readContest({ name: "Shape Test" });
    expect(stored?.attemptsPolicy).toBe("single");
    // An allowance is meaningless once the policy is single, and a stale 3 left behind
    // would render as "3 attempts" on a contest that grants one.
    expect(stored?.attemptsAllowed).toBeUndefined();
    expect(stored?.roundStartPolicy).toBe("until_window_closes");
    // Entry at the gun. Asserted against `startTime` rather than a computed instant,
    // because that is the fact an operator and a player both read.
    expect(stored?.registrationDeadline?.getTime()).toBe(stored!.startTime.getTime());
    // And NOT the permissive answer that policy would otherwise produce - the ordering trap
    // in `resolveContestEntryDeadline`, where checking the flag after the policy leaves
    // entry open for the contest's whole duration.
    expect(stored?.registrationDeadline?.getTime()).not.toBe(
      stored!.playWindowEnd!.getTime(),
    );
  });

  it("treats a head_to_head title as scheduled even though it declares nothing", async () => {
    const gameCode = await seedCatalogue({ family: "head_to_head" });
    const result = await createProviderContest(createInput(gameCode));
    expect(result.success).toBe(true);

    const stored = await readContest({ name: "Shape Test" });
    expect(stored?.attemptsPolicy).toBe("single");
    expect(stored?.registrationDeadline?.getTime()).toBe(stored!.startTime.getTime());
  });
});

describe("editProviderContest keeps the shape's rules", () => {
  async function seedScheduledContest() {
    const gameCode = await seedCatalogue({ playMode: "scheduled" });
    const created = await createProviderContest(createInput(gameCode));
    expect(created.success).toBe(true);
    const contest = await Competition.findOne({ name: "Shape Test" });
    return { contest: contest!, gameCode };
  }

  it("re-forces the rules on an edit that never mentions them", async () => {
    // The case that matters, and the reason the forcing is not inside the `input` branch.
    // An operator fixing a typo sends `name` alone; if the shape were only applied when the
    // relevant control arrived, a contest whose title has SINCE become scheduled would keep
    // a policy the shape forbids until somebody happened to touch that control.
    const { contest } = await seedScheduledContest();

    // Put the contest into the state a pre-shape draft would be in.
    await Competition.updateOne(
      { _id: contest._id },
      {
        $set: {
          attemptsPolicy: "best_of_n",
          attemptsAllowed: 3,
          roundStartPolicy: "reserve_full_round",
          registrationDeadline: contest.playWindowEnd,
        },
      },
    );

    const result = await editProviderContest(String(contest._id), {
      name: "Renamed, nothing else",
    });
    expect(result.success).toBe(true);

    const stored = await readContest({ _id: contest._id });
    expect(stored?.attemptsPolicy).toBe("single");
    expect(stored?.attemptsAllowed).toBeUndefined();
    expect(stored?.roundStartPolicy).toBe("until_window_closes");
    expect(stored?.registrationDeadline?.getTime()).toBe(stored!.startTime.getTime());
  });

  it("refuses to let an operator opt a scheduled contest back out", async () => {
    const { contest } = await seedScheduledContest();

    const result = await editProviderContest(String(contest._id), {
      attemptsPolicy: "best_of_n",
      attemptsAllowed: 5,
      roundStartPolicy: "reserve_full_round",
    });
    expect(result.success).toBe(true);

    const stored = await readContest({ _id: contest._id });
    expect(stored?.attemptsPolicy).toBe("single");
    expect(stored?.roundStartPolicy).toBe("until_window_closes");
  });

  it("still honours the operator on an anytime contest", async () => {
    // The control for the two above. A forced value applied unconditionally would pass both
    // and take every existing operator's choice away.
    const gameCode = await seedCatalogue({ playMode: "anytime" });
    const created = await createProviderContest(createInput(gameCode));
    expect(created.success).toBe(true);
    const contest = await Competition.findOne({ name: "Shape Test" });

    const result = await editProviderContest(String(contest!._id), {
      attemptsPolicy: "sum_of_n",
      attemptsAllowed: 4,
      roundStartPolicy: "until_window_closes",
    });
    expect(result.success).toBe(true);

    const stored = await readContest({ _id: contest!._id });
    expect(stored?.attemptsPolicy).toBe("sum_of_n");
    expect(stored?.attemptsAllowed).toBe(4);
    expect(stored?.roundStartPolicy).toBe("until_window_closes");
  });
});

// =======================================================================================
// The wizard is handed the RESOLVED shape
// =======================================================================================

describe("listContestableTitles", () => {
  it("reports the resolved shape, not the raw declaration", async () => {
    // A `head_to_head` title declaring nothing is scheduled. Handing the wizard the raw
    // field would have it offer schedule controls the create service is about to override -
    // a control that appears to work and does nothing, which is the shape this codebase
    // keeps finding after a provider with no adapter and a `rankingMethod` a provider game
    // ignores.
    const gameCode = await seedCatalogue({ family: "head_to_head" });
    const titles = await listContestableTitles();

    const title = titles.find((t) => t.gameCode === gameCode);
    expect(title).toBeDefined();
    expect(title?.playMode).toBe("scheduled");
  });

  it("reports anytime for the ordinary case", async () => {
    const gameCode = await seedCatalogue({ playMode: "anytime" });
    const titles = await listContestableTitles();
    expect(titles.find((t) => t.gameCode === gameCode)?.playMode).toBe("anytime");
  });
});

// =======================================================================================
// Nothing switches on a game code - the owner's one hard requirement
// =======================================================================================

describe("the play shape is declared, never inferred from a game's identity", () => {
  const SHAPE_AWARE_FILES = [
    "lib/services/games/play-shape.ts",
    "apps/admin/components/admin/games/wizard/StepSchedule.tsx",
    "apps/admin/components/admin/games/wizard/StepPrizes.tsx",
  ];

  it("names no game code, provider key or game key anywhere it decides a shape", () => {
    // The single failure mode of the no-developer-needed claim. Any `switch` on game type,
    // `if (gameCode === ...)` or hard-coded title list is a place the next game silently
    // gets the wrong shape while the code runs and the screen renders.
    for (const file of SHAPE_AWARE_FILES) {
      const src = readCode(file);
      // A test examining nothing passes everything asked of it.
      expect(src.length).toBeGreaterThan(200);
      expect(src).not.toMatch(/gameCode\s*===/);
      expect(src).not.toMatch(/gameKey\s*===/);
      expect(src).not.toMatch(/providerKey\s*===/);
      expect(src).not.toContain("circuit-sprint");
    }
  });

  it("keeps the admin copy byte-identical to the main one", () => {
    // `check:mirrors` compares MODELS, so it has no opinion about this file - and the shape
    // is resolved by writers in apps/admin and read by screens in the main app, which is
    // precisely the arrangement that produced `referenceId`, `failedReason`, `challengeId`
    // and the Game Master `||`. Two copies drifting here would mean a contest created under
    // one set of rules and played under another, with both apps reporting success.
    //
    // Read raw rather than through `readCode`, which strips comments: a comment that has
    // stopped being true in one copy is exactly the drift worth catching.
    const main = readFileSync(join(ROOT, "lib/services/games/play-shape.ts"), "utf8");
    const admin = readFileSync(
      join(ROOT, "apps/admin/lib/services/games/play-shape.ts"),
      "utf8",
    );
    expect(admin).toBe(main);
  });

  it("has one resolver, so the wizard and the services cannot disagree", () => {
    // The negative half is the load-bearing one. Importing the resolver is trivially
    // satisfied by a file that imports it and then decides for itself - which is exactly
    // what `RoundPreflight` did before the entry-deadline extraction.
    for (const file of [
      "apps/admin/lib/services/game-providers/provider-contest.service.ts",
      "apps/admin/lib/services/game-providers/provider-contest-edit.service.ts",
    ]) {
      const src = readCode(file);
      expect(src).toMatch(/resolvePlayShape\s*\(/);
      // No second opinion about what a mode implies.
      expect(src).not.toMatch(/===\s*"scheduled"/);
      expect(src).not.toMatch(/playMode\s*===/);
    }
  });

  it("withholds the controls from the same rule that forces the values", () => {
    // Two screens and one rule. A wizard that hid the controls on its own condition would
    // drift from the services the first time either changed.
    const schedule = readCode(
      "apps/admin/components/admin/games/wizard/StepSchedule.tsx",
    );
    const prizes = readCode("apps/admin/components/admin/games/wizard/StepPrizes.tsx");

    expect(schedule).toMatch(/shape\.offersRoundStartPolicy/);
    expect(prizes).toMatch(/shape\.requiresSingleAttempt/);
    // And each says why rather than merely hiding, which is the difference between a
    // withheld control and a missing feature.
    expect(schedule).toMatch(/roundStartWithheld/);
    expect(prizes.toLowerCase()).toContain("same moment");
  });
});
