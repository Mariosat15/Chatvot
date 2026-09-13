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
  resolveSupportedPlayModes,
  isPlayModeSupported,
  resolveContestPlayMode,
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
// Task 11 - a title that supports MORE THAN ONE shape
//
// The decision this reverses: `play-shape.ts` said the shape must never come from caller
// input, on the grounds that a race wrongly run as staggered keeps entry open after the gun.
// That reasoning is intact and the rule is now enforced one step earlier - the operator picks
// from a set the TITLE declares, and an unsupported pick is refused before anything is
// written. What follows pins both halves: the widening, and the refusal that makes it safe.
// =======================================================================================

describe("resolveSupportedPlayModes", () => {
  it("always contains the title's own resolved style", () => {
    // THE UNION, which is the rule most likely to be read as a bug and simplified away. A set
    // excluding the title's own style would make its declared style unselectable - two
    // controls on one screen contradicting each other - and would strand every contest
    // ALREADY created on this title on a shape the platform now calls unsupported.
    expect(resolveSupportedPlayModes({ playMode: "scheduled" })).toEqual(["scheduled"]);
    expect(
      resolveSupportedPlayModes({ playMode: "scheduled", supportedPlayModes: ["anytime"] }),
    ).toEqual(["anytime", "scheduled"]);
  });

  it("returns one entry for a title that has declared no set", () => {
    // The whole live catalogue. A one-entry list and "this title has no choice" are the same
    // thing deliberately, so no screen needs a second case for the pre-task-11 world.
    expect(resolveSupportedPlayModes({})).toEqual(["anytime"]);
    expect(resolveSupportedPlayModes(null)).toEqual(["anytime"]);
    expect(resolveSupportedPlayModes({ supportedPlayModes: [] })).toEqual(["anytime"]);
  });

  it("orders by PLAY_MODES, so two rows cannot present the pair the other way round", () => {
    // Stored order is whatever the operator's checkboxes produced. Two titles offering the
    // same pair of choices in different orders is a screen an operator cannot learn.
    expect(
      resolveSupportedPlayModes({ supportedPlayModes: ["scheduled", "anytime"] }),
    ).toEqual(PLAY_MODES);
    expect(
      resolveSupportedPlayModes({ supportedPlayModes: ["anytime", "scheduled"] }),
    ).toEqual(PLAY_MODES);
  });

  it("ignores an unrecognised or blank entry rather than throwing on a screen", () => {
    // These arrive from a database, so the resolver has to survive a row written by a version
    // of the platform that knew a third mode. `""` matters on its own: it is a shape a bad
    // write leaves behind, and `storedMode` must not read it as a decision.
    expect(
      resolveSupportedPlayModes({
        playMode: "anytime",
        supportedPlayModes: ["scheduled", "sideways", "", null],
      }),
    ).toEqual(PLAY_MODES);
  });

  it("gives a head_to_head title scheduled and nothing else, whatever it declares", () => {
    // It beats the operator here for the same reason it beats them in `resolvePlayMode`: two
    // people cannot play each other at different times, so an async form of a chess match is
    // not a shape anybody may enable.
    expect(
      resolveSupportedPlayModes({
        family: "head_to_head",
        supportedPlayModes: ["anytime", "scheduled"],
      }),
    ).toEqual(["scheduled"]);
  });
});

describe("isPlayModeSupported", () => {
  it("admits a declared shape and refuses one the title never offered", () => {
    const title = { playMode: "anytime", supportedPlayModes: ["scheduled"] };
    expect(isPlayModeSupported(title, "anytime")).toBe(true);
    expect(isPlayModeSupported(title, "scheduled")).toBe(true);
    expect(isPlayModeSupported({ playMode: "anytime" }, "scheduled")).toBe(false);
  });

  it("refuses an absent, blank or unrecognised request rather than defaulting it", () => {
    // FAILS CLOSED, which is the opposite of `resolvePlayMode`'s fallback and deliberately so.
    // A resolver's job is to produce an answer for a partially-loaded row; a gate's job is to
    // refuse what it cannot vouch for. Reading `undefined` as the default here would mean a
    // malformed request quietly creating a contest as whatever the title happened to be.
    const title = { playMode: "anytime", supportedPlayModes: ["scheduled"] };
    expect(isPlayModeSupported(title, undefined)).toBe(false);
    expect(isPlayModeSupported(title, null)).toBe(false);
    expect(isPlayModeSupported(title, "")).toBe(false);
    expect(isPlayModeSupported(title, "sideways")).toBe(false);
  });

  it("refuses anytime on a head_to_head title", () => {
    expect(
      isPlayModeSupported(
        { family: "head_to_head", supportedPlayModes: ["anytime", "scheduled"] },
        "anytime",
      ),
    ).toBe(false);
  });
});

describe("resolveContestPlayMode - the contest's shape, not its title's", () => {
  it("prefers the contest's stored value over the title's default", () => {
    // THE WHOLE POINT OF THE FIELD. Once a title supports two shapes its own answer is a
    // default, so a reader that consults the title is answering a different question from the
    // one it was asked.
    expect(
      resolveContestPlayMode("scheduled", { playMode: "anytime", supportedPlayModes: ["scheduled"] }),
    ).toBe("scheduled");
    expect(
      resolveContestPlayMode("anytime", { playMode: "scheduled", supportedPlayModes: ["anytime"] }),
    ).toBe("anytime");
  });

  it("falls back to the title for a contest created before the field existed", () => {
    // Correct rather than defensive: every such contest was created when its title had
    // exactly one shape, so the title's answer IS what it was created as.
    expect(resolveContestPlayMode(undefined, { playMode: "scheduled" })).toBe("scheduled");
    expect(resolveContestPlayMode(null, { playMode: "scheduled" })).toBe("scheduled");
    expect(resolveContestPlayMode("", { playMode: "scheduled" })).toBe("scheduled");
  });

  it("does NOT re-check the pick against the title's current set", () => {
    // Deliberate, and it looks like a hole until you consider the alternative. Validation is
    // `isPlayModeSupported`, called once before anything is written. If this re-litigated it,
    // an operator narrowing a title's supported set would retroactively change the shape of
    // contests already running under it - so people who paid to enter a staggered contest
    // would find it had become a synchronised one because of an edit to the catalogue.
    expect(
      resolveContestPlayMode("scheduled", { playMode: "anytime" }),
    ).toBe("scheduled");
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
  title: {
    playMode?: string;
    family?: string;
    gameCode?: string;
    /** Task 11's set. Absent by default, so every pre-task-11 case is unchanged. */
    supportedPlayModes?: string[];
  } = {},
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
    // Absent unless asked for, deliberately. `supportedPlayModes` has no schema default for
    // the reason recorded on the model, so a fixture that always set it would make every
    // pre-task-11 assertion below run against a title that had opted in.
    ...(title.supportedPlayModes
      ? { supportedPlayModes: title.supportedPlayModes }
      : {}),
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
  /** Task 11. The seam the whole feature rests on, so it is read back rather than inferred. */
  playMode?: string;
}

const STORED_CONTEST_FIELDS: (keyof StoredContestFields)[] = [
  "startTime",
  "playWindowEnd",
  "registrationDeadline",
  "attemptsPolicy",
  "attemptsAllowed",
  "roundStartPolicy",
  "playMode",
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

  it("reports the resolved SUPPORTED SET, so the picker cannot offer a refused shape", async () => {
    // Task 11. The picker is built from this list, and the create service refuses anything
    // outside it - so a raw value here means a select whose options produce a 400 that reads
    // to an operator like a permissions problem.
    const gameCode = await seedCatalogue({
      playMode: "anytime",
      supportedPlayModes: ["scheduled"],
    });
    const titles = await listContestableTitles();
    const title = titles.find((t) => t.gameCode === gameCode);

    // Both, in `PLAY_MODES` order, because the resolver unions the title's own style in.
    expect(title?.supportedPlayModes).toEqual(["anytime", "scheduled"]);
    // And the pre-selection is still the title's own answer.
    expect(title?.playMode).toBe("anytime");
  });

  it("reports one supported shape for the whole live catalogue", async () => {
    // The state every real title is in today. The wizard withholds the picker on
    // `length < 2`, so this is what keeps the screen unchanged until a title opts in.
    const gameCode = await seedCatalogue({ playMode: "anytime" });
    const titles = await listContestableTitles();
    expect(titles.find((t) => t.gameCode === gameCode)?.supportedPlayModes).toEqual([
      "anytime",
    ]);
  });

  it("reports scheduled alone for a head_to_head title however its set reads", async () => {
    const gameCode = await seedCatalogue({
      family: "head_to_head",
      supportedPlayModes: ["anytime", "scheduled"],
    });
    const titles = await listContestableTitles();
    expect(titles.find((t) => t.gameCode === gameCode)?.supportedPlayModes).toEqual([
      "scheduled",
    ]);
  });
});

// =======================================================================================
// Task 11, behavioural: the operator's per-contest choice, end to end
//
// Against a real database rather than structurally, for the reason in the file header - the
// STORED field is the seam, and no structural test can see a seam.
// =======================================================================================

describe("createProviderContest with an operator-chosen shape", () => {
  it("stores the chosen shape and forces that shape's rules", async () => {
    const gameCode = await seedCatalogue({
      playMode: "anytime",
      supportedPlayModes: ["scheduled"],
    });

    // The fixture asks for three attempts and a reserving policy, both of which `scheduled`
    // must override - so a create that stored the mode and forgot the rules fails here.
    const result = await createProviderContest(
      createInput(gameCode, { playMode: "scheduled" }),
    );
    expect(result.success).toBe(true);

    const stored = await readContest({ name: "Shape Test" });
    expect(stored?.playMode).toBe("scheduled");
    expect(stored?.attemptsPolicy).toBe("single");
    expect(stored?.attemptsAllowed).toBeUndefined();
    expect(stored?.roundStartPolicy).toBe("until_window_closes");
    expect(stored?.registrationDeadline?.getTime()).toBe(stored!.startTime.getTime());
  });

  it("refuses a shape the title does not support, and NAMES what it does support", async () => {
    // The refusal is what makes the widening safe, and naming the alternatives is not
    // politeness: an operator told only that their choice is unsupported has to go and read
    // another screen to find out what to pick.
    const gameCode = await seedCatalogue({ playMode: "anytime" });

    const result = await createProviderContest(
      createInput(gameCode, { playMode: "scheduled" }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("Join any time");

    // AND NOTHING WAS WRITTEN. The refusal sits before the create and before the slug is
    // reserved, so a rejected request must leave no draft behind.
    expect(await Competition.countDocuments({ name: "Shape Test" })).toBe(0);
  });

  it("refuses an unrecognised shape rather than falling back to the title's", async () => {
    const gameCode = await seedCatalogue({ playMode: "anytime" });
    const result = await createProviderContest(
      createInput(gameCode, { playMode: "sideways" }),
    );
    expect(result.success).toBe(false);
    expect(await Competition.countDocuments({ name: "Shape Test" })).toBe(0);
  });

  it("still stores a shape when the caller sends none", async () => {
    // EVERY CALLER WRITTEN BEFORE TASK 11, and the wizard for a single-shape title. An
    // absent choice means "whatever this title is" and must not be refused - but the field
    // is still written, because falling back to the title at read time is exactly what the
    // edit path used to do and is the defect this whole change exists to close.
    const gameCode = await seedCatalogue({ playMode: "scheduled" });
    const result = await createProviderContest(createInput(gameCode));
    expect(result.success).toBe(true);

    const stored = await readContest({ name: "Shape Test" });
    expect(stored?.playMode).toBe("scheduled");
  });

  it("refuses anytime on a head_to_head title even when its set names it", async () => {
    const gameCode = await seedCatalogue({
      family: "head_to_head",
      supportedPlayModes: ["anytime", "scheduled"],
    });
    const result = await createProviderContest(
      createInput(gameCode, { playMode: "anytime" }),
    );
    expect(result.success).toBe(false);
    expect(await Competition.countDocuments({ name: "Shape Test" })).toBe(0);
  });
});

describe("editProviderContest reads the CONTEST's shape, never the title's", () => {
  it("does not rewrite a staggered contest's rules when the title also supports scheduled", async () => {
    // THE DEFECT THIS FIELD EXISTS FOR, and it is the one test in this file that would have
    // failed silently before task 11. The edit service resolved the shape from the TITLE, so
    // a title supporting both shapes with `scheduled` as its own style would have an ordinary
    // rename re-force a staggered contest to one attempt, `until_window_closes`, and entry
    // closing at the start - under people who had already paid to enter, with no error and
    // nothing in a log.
    const gameCode = await seedCatalogue({
      playMode: "scheduled",
      supportedPlayModes: ["anytime"],
    });
    const created = await createProviderContest(
      createInput(gameCode, { playMode: "anytime" }),
    );
    expect(created.success).toBe(true);

    const contest = await Competition.findOne({ name: "Shape Test" });
    const before = await readContest({ _id: contest!._id });
    expect(before?.playMode).toBe("anytime");
    expect(before?.attemptsPolicy).toBe("best_of_n");

    const result = await editProviderContest(String(contest!._id), {
      name: "Renamed, nothing else",
    });
    expect(result.success).toBe(true);

    const after = await readContest({ _id: contest!._id });
    expect(after?.playMode).toBe("anytime");
    expect(after?.attemptsPolicy).toBe("best_of_n");
    expect(after?.attemptsAllowed).toBe(3);
    expect(after?.roundStartPolicy).toBe("reserve_full_round");
    // And entry still closes at the last playable moment rather than at the gun.
    expect(after?.registrationDeadline?.getTime()).not.toBe(after!.startTime.getTime());
  });

  it("still forces the rules of a contest created AS scheduled", async () => {
    // The control for the test above. Reading the contest's own value unconditionally would
    // pass that one and take the forcing away from every scheduled contest - so this asserts
    // the forcing still happens when the stored shape is the constrained one.
    const gameCode = await seedCatalogue({
      playMode: "anytime",
      supportedPlayModes: ["scheduled"],
    });
    const created = await createProviderContest(
      createInput(gameCode, { playMode: "scheduled" }),
    );
    expect(created.success).toBe(true);
    const contest = await Competition.findOne({ name: "Shape Test" });

    const result = await editProviderContest(String(contest!._id), {
      attemptsPolicy: "best_of_n",
      attemptsAllowed: 5,
      roundStartPolicy: "reserve_full_round",
    });
    expect(result.success).toBe(true);

    const stored = await readContest({ _id: contest!._id });
    expect(stored?.attemptsPolicy).toBe("single");
    expect(stored?.roundStartPolicy).toBe("until_window_closes");
  });

  it("cannot be moved to the other shape by an edit", async () => {
    // FROZEN, and this is the assertion that keeps it so. `playMode` is absent from
    // `EditProviderContestInput`, absent from `toEditRequestBody` and named in
    // `NEVER_EDITABLE_FIELDS`, so an edit carrying it changes nothing. It decides when entry
    // closes and how many attempts a paying entrant gets; a contest that should be the other
    // shape is a new contest.
    const gameCode = await seedCatalogue({
      playMode: "anytime",
      supportedPlayModes: ["scheduled"],
    });
    const created = await createProviderContest(
      createInput(gameCode, { playMode: "anytime" }),
    );
    expect(created.success).toBe(true);
    const contest = await Competition.findOne({ name: "Shape Test" });

    await editProviderContest(String(contest!._id), {
      name: "Renamed",
      // Deliberately outside the input type - a caller reaching the route directly.
      ...({ playMode: "scheduled" } as Record<string, unknown>),
    });

    const stored = await readContest({ _id: contest!._id });
    expect(stored?.playMode).toBe("anytime");
    expect(stored?.attemptsPolicy).toBe("best_of_n");
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
    // FLIPPED ON 9 SEPTEMBER 2026, NOT REWRITTEN. This asserted `resolvePlayShape(` in both
    // services, which was right while a title had exactly one shape: the title's answer WAS
    // the contest's. Task 11 makes them different questions, so both services now go through
    // `resolveContestPlayMode`, which prefers the contest's stored value and falls back to
    // the title. The old spelling passing here is now the defect - see the edit test below,
    // where it silently rewrites a paying entrant's rules - so it is asserted absent.
    //
    // The negative half is the load-bearing one. Importing the resolver is trivially
    // satisfied by a file that imports it and then decides for itself - which is exactly
    // what `RoundPreflight` did before the entry-deadline extraction.
    for (const file of [
      "apps/admin/lib/services/game-providers/provider-contest.service.ts",
      "apps/admin/lib/services/game-providers/provider-contest-edit.service.ts",
    ]) {
      const src = readCode(file);
      expect(src).toMatch(/resolveContestPlayMode\s*\(/);
      expect(src).not.toMatch(/resolvePlayShape\s*\(/);
      // No second opinion about what a mode implies. `playMode ===` is exempted only where
      // the create service compares the OPERATOR's request against the supported set, which
      // it does through `isPlayModeSupported` rather than by hand - so the ban still holds.
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
    //
    // FLIPPED BY TASK 12, NOT DELETED, and the flip is the interesting part. This used to
    // read `expect(prizes.toLowerCase()).toContain("same moment")` - the sentence itself,
    // written out in `StepPrizes.tsx`. That was correct while one screen withheld the
    // control. The moment the editor had to withhold it too, a literal here would have been
    // one of two copies of the same operator-facing explanation, and the assertion would
    // have actively held the duplication in place: moving the sentence to `play-shape.ts`
    // turned this red. The claim it was making - each withheld control says why - is
    // unchanged, so the assertion moves to the shared field rather than the words.
    expect(schedule).toMatch(/roundStartWithheld/);
    expect(prizes).toMatch(/attemptsWithheld/);
  });
});
