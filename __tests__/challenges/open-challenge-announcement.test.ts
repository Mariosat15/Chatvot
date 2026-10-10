import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  clearTestMongo,
  ensureCollections,
  startTestMongo,
  stopTestMongo,
} from "../helpers/mongo-test-server";

/**
 * Telling everybody else that a seat is open (X10).
 *
 * The owner's report was that creating an open challenge notified nobody. It did not,
 * and the reason is a comment in the create route that was true about the half it
 * described: "there is nobody to tell", said of the *recipient*, and read as though it
 * settled the whole question. An open challenge is the one challenge event with no
 * addressee, so the absence of a recipient is exactly why it needs an audience rather
 * than a reason to skip it - and the feature shipped reachable, correct and
 * undiscovered.
 *
 * Two halves to this suite, and the behavioural one carries the risk. This is the only
 * notification on the platform addressed to the whole player base, so the failure modes
 * are not "a player is not told" but "a player who switched it off is told anyway", and
 * "somebody a block exists against reappears in your bell". Neither raises an error.
 *
 * The structural half exists because a fan-out that computes the right audience and
 * then does not consult it reports success exactly as loudly as one that does.
 */

const ROOT = process.cwd();

const SERVICE = "lib/services/challenges/open-challenge-announcement.ts";
const CREATE_ROUTE = "app/api/challenges/route.ts";
const TEMPLATES = "database/models/notification-template.model.ts";
const PREFERENCES = "database/models/user-notification-preferences.model.ts";

/**
 * Reads a file with comments removed.
 *
 * Reason: every module here explains its own anti-patterns in prose - the service
 * spends a paragraph on why the precedence rules are imported rather than restated,
 * the route on why the announcement is not awaited. A test that reads prose fails on a
 * correct file for discussing the mistake, and passes a broken one whose only mention
 * of the right helper is in a comment.
 */
function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const pushed: string[] = [];

vi.mock("@/lib/services/notifications/notification-push", () => ({
  deliverPush: (notification: { userId: string }) => {
    pushed.push(notification.userId);
  },
}));

const CHALLENGER = "aaaaaaaaaaaaaaaaaaaaaaa1";
const WILLING = "aaaaaaaaaaaaaaaaaaaaaaa2";
const OTHER = "aaaaaaaaaaaaaaaaaaaaaaa3";

async function seedPresence(userIds: string[]): Promise<void> {
  const { default: UserPresence } = await import(
    "@/database/models/user-presence.model"
  );
  await UserPresence.insertMany(
    userIds.map((userId) => ({
      userId,
      username: userId,
      status: "online",
      acceptingChallenges: true,
    })),
  );
}

function announcement(overrides: Record<string, unknown> = {}) {
  return {
    challengeId: "ffffffffffffffffffffffff",
    challengerId: CHALLENGER,
    challengerName: "Ada",
    gameKey: "trading",
    gameName: "Trading",
    entryFee: 50,
    winnerPrize: 90,
    ...overrides,
  };
}

describe("announcing an open challenge", () => {
  describe("who hears about it", () => {
    beforeAll(async () => {
      const uri = await startTestMongo();
      // Reason: the service calls `connectToDatabase()`, which reads MONGODB_URI and
      // throws when it is unset.
      process.env.MONGODB_URI = uri;
      await ensureCollections([
        "notifications",
        "notificationtemplates",
        "usernotificationpreferences",
        "userpresences",
        "blocked_users",
        "user_game_preference",
      ]);
    }, 120_000);

    afterAll(async () => {
      await stopTestMongo();
    });

    beforeEach(async () => {
      await clearTestMongo();
      pushed.length = 0;
      // Reason: `clearTestMongo()` empties the template collection too, and the seed
      // service holds a per-process `hasSeeded` flag, so only the first test in the
      // file can exercise the service's own retry. Every other test needs the template
      // present or it is measuring a missing row rather than the audience rules.
      const { default: NotificationTemplate } = await import(
        "@/database/models/notification-template.model"
      );
      await NotificationTemplate.seedDefaults();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function announce(overrides: Record<string, unknown> = {}) {
      const { announceOpenChallenge } = await import(
        "@/lib/services/challenges/open-challenge-announcement"
      );
      return announceOpenChallenge(announcement(overrides) as never);
    }

    async function recipients(): Promise<string[]> {
      const { default: Notification } = await import(
        "@/database/models/notification.model"
      );
      const rows = await Notification.find({
        templateId: "challenge_open_posted",
      }).lean<{ userId: string }[]>();
      return rows.map((row) => row.userId).sort();
    }

    it("seeds its own template rather than announcing nothing", async () => {
      // Reason: seeding is `$setOnInsert`, so a template added to the defaults reaches
      // an existing database only when something runs the seed. Without the retry every
      // deployment older than this template announces nothing and reports success -
      // which is the exact failure that left an open seat silent in the first place.
      const { default: NotificationTemplate } = await import(
        "@/database/models/notification-template.model"
      );
      await NotificationTemplate.deleteMany({});
      // Reason: the seed service short-circuits on a module-level `hasSeeded`, so the
      // retry is only observable against a fresh module registry.
      vi.resetModules();
      await seedPresence([CHALLENGER, WILLING]);

      const sent = await announce();

      expect(sent).toBe(1);
      expect(await recipients()).toEqual([WILLING]);
    });

    it("does not tell the creator about their own challenge", async () => {
      await seedPresence([CHALLENGER, WILLING]);

      await announce();

      expect(await recipients()).not.toContain(CHALLENGER);
    });

    it("respects a block in either direction", async () => {
      // Reason: an announcement is a message from one player to another however it is
      // delivered. A blocked player's name reappearing in somebody's bell is the block
      // not working, and it is the direction nobody checks - the block was created
      // against a *challenge*, and this is not one.
      const { default: BlockedUser } = await import(
        "@/database/models/messaging/blocked-user.model"
      );
      await seedPresence([CHALLENGER, WILLING, OTHER]);
      await BlockedUser.create({
        blockerUserId: WILLING,
        blockerUserName: "W",
        blockedUserId: CHALLENGER,
        blockedUserName: "Ada",
      });
      await BlockedUser.create({
        blockerUserId: CHALLENGER,
        blockerUserName: "Ada",
        blockedUserId: OTHER,
        blockedUserName: "O",
      });

      await announce();

      expect(await recipients()).toEqual([]);
    });

    it("respects a per-game opt-out, and only for that game", async () => {
      // Reason: the create route deliberately does NOT read willingness for an open
      // challenge - there is nobody to ask. The audience question is the opposite way
      // round and the same declaration answers it exactly.
      const { default: UserGamePreference } = await import(
        "@/database/models/games/user-game-preference.model"
      );
      await seedPresence([CHALLENGER, WILLING]);
      await UserGamePreference.create({
        userId: WILLING,
        gameKey: "trading",
        willingToBeChallenged: false,
      });

      expect(await announce()).toBe(0);

      await announce({ gameKey: "provider:cv:sprint" });

      expect(await recipients()).toEqual([WILLING]);
    });

    it("skips a player who turned notifications off entirely", async () => {
      const { default: Preferences } = await import(
        "@/database/models/user-notification-preferences.model"
      );
      await seedPresence([CHALLENGER, WILLING]);
      await Preferences.create({
        userId: WILLING,
        notificationsEnabled: false,
      });

      expect(await announce()).toBe(0);
      expect(pushed).toEqual([]);
    });

    it("skips a player who turned the challenge category off", async () => {
      const { default: Preferences } = await import(
        "@/database/models/user-notification-preferences.model"
      );
      await seedPresence([CHALLENGER, WILLING]);
      await Preferences.create({
        userId: WILLING,
        categoryPreferences: { challenge: false },
      });

      expect(await announce()).toBe(0);
    });

    it("skips a player who turned this one notification off", async () => {
      // The switch the owner asked for: everything else about challenges still arrives.
      const { default: Preferences } = await import(
        "@/database/models/user-notification-preferences.model"
      );
      await seedPresence([CHALLENGER, WILLING]);
      await Preferences.create({
        userId: WILLING,
        disabledNotifications: ["challenge_open_posted"],
      });

      expect(await announce()).toBe(0);
    });

    it("stores the row but withholds the popup during quiet hours", async () => {
      /*
        Reason: this is the whole point of delivery being three answers rather than one.
        Quiet hours hold the interruption, never the record - a player who reads the bell
        in the morning must still find the seat, or "do not buzz me" has silently become
        "do not tell me".
      */
      const { default: Preferences } = await import(
        "@/database/models/user-notification-preferences.model"
      );
      await seedPresence([CHALLENGER, WILLING]);
      await Preferences.create({
        userId: WILLING,
        quietHoursEnabled: true,
        quietHoursStart: "00:00",
        quietHoursEnd: "23:59",
      });

      expect(await announce()).toBe(1);
      expect(await recipients()).toEqual([WILLING]);
      expect(pushed).toEqual([]);
    });

    it("pushes to a player with no preferences document at all", async () => {
      // An absent document is not a decision. Every player has one until they open the
      // settings screen, so the opposite reading is a platform-wide silence.
      await seedPresence([CHALLENGER, WILLING]);

      await announce();

      expect(pushed).toEqual([WILLING]);
    });
  });

  describe("the create route", () => {
    const route = read(CREATE_ROUTE);

    it("announces an open challenge", () => {
      expect(route).toMatch(/announceOpenChallenge\(\s*\{/);
    });

    it("announces only when the challenge is open", () => {
      /*
        Reason: the directed path already notifies the one person it concerns. Announcing
        a directed challenge to the whole player base tells everybody about a game they
        cannot join, and names two players who did not ask to be listed.
      */
      const at = route.indexOf("announceOpenChallenge");
      expect(at).toBeGreaterThan(-1);
      const before = route.slice(Math.max(0, at - 600), at);
      expect(before).toMatch(/isInSimulatorMode\s*&&\s*isOpenChallenge/);
    });

    it("does not await it", () => {
      // Reason: two wallets are committed by this point. A slow or failing fan-out must
      // not turn a created challenge into an error response.
      const at = route.indexOf("announceOpenChallenge");
      const before = route.slice(Math.max(0, at - 400), at);
      expect(before).toContain("void import(");
      expect(route.slice(at - 400, at)).not.toMatch(/await\s+announceOpen/);
    });
  });

  describe("the template", () => {
    const templates = read(TEMPLATES);
    const at = templates.indexOf('templateId: "challenge_open_posted"');
    const entry = templates.slice(at, at + 1400);

    it("exists in the defaults", () => {
      expect(at).toBeGreaterThan(-1);
      expect(entry.length).toBeGreaterThan(200);
    });

    it("is in the challenge category, so the existing switch covers it", () => {
      // Reason: the settings screen renders whatever templates the database holds,
      // grouped by category. A new category would mean a switch nobody has ever seen
      // defaulting to on, which is how a platform-wide announcement becomes unopposable.
      expect(entry).toMatch(/category:\s*"challenge"/);
    });

    it("sends no email", () => {
      /*
        THE ONE CHALLENGE TEMPLATE WITH EMAIL OFF, and the only one that could mail the
        whole player base. Five open challenges is five platform-wide mailings, which is
        a deliverability problem as much as an annoyance - and the mail it costs us is
        the receipts people do want.
      */
      expect(entry).toMatch(/email:\s*false/);
    });

    it("links to the challenge, not the list", () => {
      expect(entry).toMatch(/actionUrl:\s*"\/challenges\/\{\{challengeId\}\}"/);
    });
  });

  describe("the fan-out", () => {
    const service = read(SERVICE);

    it("imports the precedence rules rather than restating them", () => {
      /*
        The load-bearing assertion. A bulk sender is the natural place to reimplement
        "may this player be notified", because the per-user helper takes a userId and
        does its own read. Two copies of that rule is the shape behind `referenceId`,
        `failedReason`, `challengeId` and the Game Master `||` - and here the drift reads
        to a player as a switch they set being ignored.
      */
      expect(service).toMatch(/resolveDeliveryFrom\(/);
    });

    it("does not decide any of it for itself", () => {
      // The negative half: importing the resolver is trivially satisfied by a file that
      // imports it and then tests the fields anyway.
      expect(service).not.toMatch(/notificationsEnabled\s*===/);
      expect(service).not.toMatch(/disabledNotifications\?\./);
      expect(service).not.toMatch(/quietHours/);
    });

    it("reads preferences in one query, projected to what the rules need", () => {
      // Reason: a `findOne` per recipient is what makes a platform-wide fan-out slow
      // enough that somebody later moves it off the request and forgets the preferences.
      expect(service).toMatch(/DELIVERY_PREFERENCE_FIELDS/);
      expect(service).toMatch(/userId:\s*\{\s*\$in:\s*audience\s*\}/);
    });

    it("indexes preferences by user in a Map", () => {
      // Reason: the key is a stored user id. An object lookup walks the prototype chain,
      // and `{}["constructor"]` is truthy, so a crafted id would be handed something
      // that is not a preferences document at all. Fifth instance of this trap.
      expect(service).toMatch(/new Map<string, DeliveryPreferenceFacts>\(\)/);
    });

    it("caps one announcement", () => {
      // Reason: the only notification whose batch grows with the size of the platform.
      expect(service).toMatch(/MAX_ANNOUNCEMENT_RECIPIENTS/);
      expect(service).toMatch(/\.limit\(MAX_ANNOUNCEMENT_RECIPIENTS\)/);
    });
  });

  describe("the shared resolver", () => {
    const preferences = read(PREFERENCES);

    it("exposes the rules as a function over facts, not over a userId", () => {
      // Reason: a resolver that can only take a userId forces a read per recipient, so
      // the bulk path either duplicates the rules or skips them. The pure function is
      // what makes importing them cheaper than restating them.
      expect(preferences).toMatch(/export function resolveDeliveryFrom\(/);
    });

    it("still answers the single-send path through the same function", () => {
      // The per-user static must delegate, or there are two copies again with the
      // popular path being the one that stays right.
      const at = preferences.indexOf("statics.resolveDelivery =");
      expect(at).toBeGreaterThan(-1);
      const body = preferences.slice(at, at + 900);
      expect(body).toMatch(/return resolveDeliveryFrom\(/);
    });
  });
});
