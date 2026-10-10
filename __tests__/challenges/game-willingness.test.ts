import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import UserGamePreference from "@/database/models/games/user-game-preference.model";
import {
  gameWillingnessRefusal,
  indexWillingness,
  isWillingToBeChallengedAt,
  WILLING_TO_BE_CHALLENGED_BY_DEFAULT,
} from "@/lib/services/games/challenge-willingness";
import {
  getChallengeAvailability,
  getWillingnessByGameKey,
  listChallengeableGameKeys,
  setGameWillingness,
} from "@/lib/services/games/challenge-availability.service";
import {
  clearTestMongo,
  ensureCollections,
  startTestMongo,
  stopTestMongo,
} from "../helpers/mongo-test-server";

/**
 * Per-game challenge willingness (X10).
 *
 * The owner's instruction was that a player should be able to say which games
 * they are happy to be challenged at. Two things were true before this:
 *
 *   - `UserPresence.acceptingChallenges` already existed, was already enforced
 *     by the create route, and had NO UI ANYWHERE - so the master switch was a
 *     setting no player could reach. It defaults to `true`, which is why nobody
 *     had noticed.
 *   - there was no per-game equivalent at all.
 *
 * The behavioural half of this suite exists because the default is the only
 * thing standing between shipping this and refusing every challenge on the
 * platform: every player has zero rows, so "absent means unwilling" is a total
 * outage that throws nothing, logs nothing and passes every structural test.
 *
 * The structural half exists because a route that computes the right answer and
 * then does not consult it reports success exactly as loudly as one that does.
 */

const ROOT = process.cwd();

const RULES = "lib/services/games/challenge-willingness.ts";
const SERVICE = "lib/services/games/challenge-availability.service.ts";
const CREATE_ROUTE = "app/api/challenges/route.ts";
const PRESENCE_ROUTE = "app/api/user/presence/route.ts";
const SECTION = "components/profile/ChallengeAvailabilitySection.tsx";
const PICKER = "components/challenges/create/OpponentPicker.tsx";

/**
 * Reads a file with comments removed.
 *
 * Reason: every module here explains its own anti-patterns in prose - the rules
 * module spends a paragraph on why an absent row means willing, the create route
 * on why the two switches are asked in that order. A test that reads prose fails
 * on a correct file for discussing the mistake, and passes a broken one whose
 * only mention of the right helper is in a comment.
 */
function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("per-game challenge willingness", () => {
  describe("the default, which is the whole exposure", () => {
    it("an absent declaration means WILLING", () => {
      const none = indexWillingness([]);
      expect(isWillingToBeChallengedAt(none, "trading")).toBe(true);
      expect(isWillingToBeChallengedAt(none, "provider:x:y")).toBe(true);
      expect(WILLING_TO_BE_CHALLENGED_BY_DEFAULT).toBe(true);
    });

    it("a stored false means NOT willing, and only for that game", () => {
      const declared = indexWillingness([
        { gameKey: "provider:chartvolt:circuit-sprint", willingToBeChallenged: false },
      ]);
      expect(
        isWillingToBeChallengedAt(
          declared,
          "provider:chartvolt:circuit-sprint",
        ),
      ).toBe(false);
      expect(isWillingToBeChallengedAt(declared, "trading")).toBe(true);
    });

    it("the schema default and the shared constant are one fact", () => {
      // Reason: two definitions with nothing else making them agree. A schema
      // default of `false` beside a constant of `true` means a row written by
      // the upsert disagrees with what every screen shows before it saves.
      const path = UserGamePreference.schema.path(
        "willingToBeChallenged",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as any;
      expect(path.defaultValue).toBe(WILLING_TO_BE_CHALLENGED_BY_DEFAULT);
    });

    it("a gameKey named after an Object member cannot poison the lookup", () => {
      // Reason: `gameKey` is a stored string, and an object lookup walks the
      // prototype chain - `ACTIONS["__proto__"]` returns a TRUTHY
      // `Object.prototype` that survives a `!row` test. A Map has no prototype
      // chain, so the lookup is total. Fourth instance of this trap.
      const declared = indexWillingness([
        { gameKey: "trading", willingToBeChallenged: false },
      ]);
      expect(isWillingToBeChallengedAt(declared, "__proto__")).toBe(true);
      expect(isWillingToBeChallengedAt(declared, "toString")).toBe(true);
      expect(isWillingToBeChallengedAt(declared, "constructor")).toBe(true);
    });

    it("an empty or whitespace gameKey is dropped rather than stored as a key", () => {
      const declared = indexWillingness([
        { gameKey: "   ", willingToBeChallenged: false },
        { gameKey: "", willingToBeChallenged: false },
      ]);
      expect(declared.size).toBe(0);
    });
  });

  describe("the refusal, which has to send the challenger somewhere useful", () => {
    it("names the game", () => {
      expect(gameWillingnessRefusal("Circuit Sprint")).toContain(
        "Circuit Sprint",
      );
    });

    it("is not the master switch's message", () => {
      // Reason: "User is not accepting challenges" means give up; this one means
      // try a different game. One shared string makes the finer setting
      // indistinguishable from the master one.
      expect(gameWillingnessRefusal("Trading")).not.toBe(
        "User is not accepting challenges",
      );
    });

    it("still says something when no label is available", () => {
      expect(gameWillingnessRefusal("").length).toBeGreaterThan(0);
      expect(gameWillingnessRefusal("   ")).not.toContain("undefined");
    });
  });

  describe("stored declarations", () => {
    beforeAll(async () => {
      const uri = await startTestMongo();
      // Reason: the service calls `connectToDatabase()`, which reads
      // MONGODB_URI and throws when it is unset - and in a test run an unset
      // value is the lucky outcome, the unlucky one being production.
      process.env.MONGODB_URI = uri;
      await ensureCollections(["user_game_preference", "userpresences"]);
    }, 120_000);

    afterAll(async () => {
      await stopTestMongo();
    });

    beforeEach(async () => {
      await clearTestMongo();
    });

    it("trading is always offered, and is first", async () => {
      // Reason: trading has no catalogue row, so a list built from
      // `listChallengeableTitles` alone silently offers no way to opt out of
      // the one game every player can already be challenged at.
      const games = await listChallengeableGameKeys();
      expect(games[0]?.gameKey).toBe("trading");
      expect(games[0]?.label).toBe("Trading");
    });

    it("an opt-out round-trips", async () => {
      const result = await setGameWillingness("u1", "trading", false);
      expect(result.success).toBe(true);

      const stored = await getWillingnessByGameKey("u1");
      expect(isWillingToBeChallengedAt(stored, "trading")).toBe(false);
    });

    it("a second declaration updates rather than duplicating", async () => {
      await setGameWillingness("u1", "trading", false);
      await setGameWillingness("u1", "trading", true);

      const rows = await UserGamePreference.find({ userId: "u1" }).lean();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.willingToBeChallenged).toBe(true);
    });

    it("one player's declaration does not reach another", async () => {
      await setGameWillingness("u1", "trading", false);
      const other = await getWillingnessByGameKey("u2");
      expect(isWillingToBeChallengedAt(other, "trading")).toBe(true);
    });

    it("an unrecognised gameKey is REFUSED and nothing is stored", async () => {
      // Reason: `gameKey` is the immutable join key for every historical stat,
      // so a row under a key nothing resolves is a setting the player can see,
      // toggle and never have honoured - indistinguishable from a retired game.
      const result = await setGameWillingness("u1", "provider:nope:nope", false);
      expect(result.success).toBe(false);
      await expect(UserGamePreference.countDocuments({})).resolves.toBe(0);
    });

    it("an empty gameKey is refused and nothing is stored", async () => {
      const result = await setGameWillingness("u1", "   ", false);
      expect(result.success).toBe(false);
      await expect(UserGamePreference.countDocuments({})).resolves.toBe(0);
    });

    it("a player with no presence row reads as accepting challenges", async () => {
      // Reason: never having been online is not a statement about challenges.
      const availability = await getChallengeAvailability("u1");
      expect(availability.acceptingChallenges).toBe(true);
      expect(
        availability.games.find((game) => game.gameKey === "trading")?.willing,
      ).toBe(true);
    });

    it("the screen's view reflects a stored opt-out", async () => {
      await setGameWillingness("u1", "trading", false);
      const availability = await getChallengeAvailability("u1");
      expect(
        availability.games.find((game) => game.gameKey === "trading")?.willing,
      ).toBe(false);
    });
  });

  describe("the create route consults it", () => {
    it("calls the shared predicate rather than comparing a field itself", () => {
      // Reason: a hand-rolled `=== false` in the route is a second reading of
      // the default, and the two would disagree the day either changed.
      const source = read(CREATE_ROUTE);
      expect(source).toMatch(
        /isWillingToBeChallengedAt\(\s*challengedWillingness\s*,\s*gameLabel\.gameKey\s*,?\s*\)/,
      );
      expect(source).toMatch(/gameWillingnessRefusal\(/);
    });

    it("asks the MASTER switch first", () => {
      // Reason: a player who has switched challenges off entirely has said
      // nothing about games, so telling the challenger to try a different one
      // would be false. Position, not presence - both checks exist either way.
      const source = read(CREATE_ROUTE);
      const master = source.indexOf("User is not accepting challenges");
      const perGame = source.indexOf("gameWillingnessRefusal(");
      expect(master).toBeGreaterThan(-1);
      expect(perGame).toBeGreaterThan(-1);
      expect(master).toBeLessThan(perGame);
    });

    it("withholds the read for an open challenge", () => {
      // Reason: there is nobody to ask. Queried with `undefined` it would match
      // rows belonging to nobody, and an unconditional refusal would turn every
      // open challenge into a 400.
      const source = read(CREATE_ROUTE);
      const fetchAt = source.indexOf("getWillingnessByGameKey(challengedId)");
      expect(fetchAt).toBeGreaterThan(-1);

      // Reason: anchored on the NEAREST preceding `isOpenChallenge` and then
      // required to be THIS ternary, identified by its own empty-map true arm.
      // A backwards scan for a bare `isOpenChallenge ?` is green on an
      // unconditional read, because the three sibling opponent reads a few lines
      // above are themselves guarded by that identifier - a slice taken
      // backwards finds whatever is closest, not what you meant.
      const guardAt = source.lastIndexOf("isOpenChallenge", fetchAt);
      expect(guardAt).toBeGreaterThan(-1);
      const between = source.slice(guardAt, fetchAt);
      expect(between).toMatch(
        /\?\s*Promise\.resolve\(new Map<string, boolean>\(\)\)\s*:/,
      );
    });

    it("the per-game refusal sits inside the opponent block", () => {
      // Reason: outside it, an open challenge is refused on the CREATOR's own
      // declarations - so opting out of a game would stop you offering it.
      const source = read(CREATE_ROUTE);
      const blockAt = source.indexOf("if (!isOpenChallenge) {");
      expect(blockAt).toBeGreaterThan(-1);
      const perGame = source.indexOf("gameWillingnessRefusal(");
      expect(perGame).toBeGreaterThan(blockAt);
    });
  });

  describe("the screen, and the switch it must not write twice", () => {
    it("takes the default from the shared constant", () => {
      // Reason: asserts the USE and not the name. The identifier survives on the
      // import line, so a bare match is green against a hard-coded `true` - the
      // "an import is not a use" trap, which has now cost a false pass on
      // `canTransitionRound`, `MIN_REASON_LENGTH` and the credit-value resolver.
      // The literal matters here because this is what a player reads BEFORE the
      // fetch lands, so a second copy of the default disagrees with the server
      // for as long as the request takes.
      const source = read(SECTION);
      const declAt = source.indexOf("setAcceptingChallenges] = useState(");
      expect(declAt).toBeGreaterThan(-1);
      const decl = source.slice(declAt, declAt + 120);
      expect(decl).toMatch(/useState\(\s*WILLING_TO_BE_CHALLENGED_BY_DEFAULT/);
    });

    it("writes the master switch through the route that owns it", () => {
      // Reason: a second writer of one field is the "one rule, two copies"
      // shape in its smallest form. And it must be PUT, not PATCH: PATCH on
      // that route is the presence HEARTBEAT, so using it would make changing a
      // setting indistinguishable from playing.
      const source = read(SECTION);
      const callAt = source.indexOf('fetch("/api/user/presence"');
      expect(callAt).toBeGreaterThan(-1);
      const call = source.slice(callAt, callAt + 200);
      expect(call).toMatch(/method:\s*"PUT"/);
      expect(call).not.toMatch(/method:\s*"PATCH"/);
    });

    it("does not write acceptingChallenges through its own route", () => {
      const availabilityRoute = read("app/api/user/challenge-availability/route.ts");
      expect(availabilityRoute).not.toMatch(/\$set[\s\S]{0,120}acceptingChallenges/);
    });
  });

  describe("the master switch could not be saved by a new player", () => {
    it("the presence toggle upserts", () => {
      // Reason: it used to 404 on a missing document, so the player most likely
      // to be setting this before they start playing was the one it refused -
      // and the create route reads an absent row as "accepting", so the refusal
      // left them reachable while the screen said it had saved.
      const source = read(PRESENCE_ROUTE);
      const putAt = source.indexOf("export async function PUT");
      expect(putAt).toBeGreaterThan(-1);
      const put = source.slice(putAt);
      expect(put.length).toBeGreaterThan(200);
      expect(put).toMatch(/upsert:\s*true/);
      expect(put).not.toMatch(/Presence not found/);
    });

    it("the presence toggle refuses a non-boolean", () => {
      // Reason: `$set: { acceptingChallenges: undefined }` is a no-op that
      // still reports success, and switching OFF is the point of the route.
      const source = read(PRESENCE_ROUTE);
      const putAt = source.indexOf("export async function PUT");
      const put = source.slice(putAt);
      expect(put).toMatch(
        /typeof\s+acceptingChallenges\s*!==\s*"boolean"/,
      );
    });
  });

  describe("the opponent list still does not filter on willingness", () => {
    it("names no willingness helper", () => {
      // Reason: `13` s4.1aa decided this deliberately - the create route
      // refuses and NAMES the reason, where a list that quietly omits people is
      // indistinguishable from the person not existing. This is a tripwire
      // against "improving" the picker by hiding them.
      const source = read(PICKER);
      expect(source).not.toMatch(/willingToBeChallenged/);
      expect(source).not.toMatch(/isWillingToBeChallengedAt/);
    });
  });

  describe("nothing is declared before anything writes it", () => {
    it("carries no interestLevel, inferredAt or skillBand", () => {
      // Reason: chapter `20`'s table lists all three, and nothing infers
      // interest or matches on a per-game skill band yet - that is X11.5. A
      // field stored, transported and read by nothing is the shape behind
      // `requiresSyncPlay`, `isPaused`, `lastSuccessfulRoundAt`, `family` and
      // `playModeOverride`.
      const paths = Object.keys(UserGamePreference.schema.paths);
      expect(paths).not.toContain("interestLevel");
      expect(paths).not.toContain("inferredAt");
      expect(paths).not.toContain("skillBand");
    });

    it("keeps declaredAt separate from updatedAt", () => {
      const paths = Object.keys(UserGamePreference.schema.paths);
      expect(paths).toContain("declaredAt");
      expect(paths).toContain("updatedAt");
    });

    it("the rules module reaches no model", () => {
      // Reason: R58 - a `"use client"` file may not name a driver-reaching
      // module in a value-import position, and the settings screen imports
      // this. The admin app's build went down over exactly this.
      const source = read(RULES);
      expect(source).not.toMatch(/from\s+"[^"]*database\/models/);
      expect(source).not.toMatch(/from\s+"mongoose"/);
      expect(source).not.toMatch(/from\s+"mongodb"/);
    });

    it("the service does the I/O and does not restate the default", () => {
      // Reason: one rule, one place. The service may FETCH rows; the answer
      // comes from the shared predicate.
      const source = read(SERVICE);
      expect(source).toMatch(/WILLING_TO_BE_CHALLENGED_BY_DEFAULT/);
      expect(source).toMatch(/indexWillingness\(/);
    });
  });
});
