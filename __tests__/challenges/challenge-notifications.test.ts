import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  popupHref,
  type PushedNotification,
} from "@/components/notifications/NotificationPopupCard";
import {
  DEFAULT_OPEN_CHALLENGE_EXPIRY_MINUTES,
  resolveAcceptDeadline,
  resolveAcceptDeadlineMinutes,
} from "@/lib/services/challenges/accept-deadline";
import { readChallengeCode } from "../helpers/challenge-create-screen";

/**
 * Telling a player what just happened to their challenge.
 *
 * The owner's report was that a claimed open seat produced "no email, no in-app alert, no
 * badge" and that the same silence applies to the rest of the lifecycle - created, accepted,
 * cancelled, declined, expired, settled. Two thirds of that was true and the third was not:
 * in-app rows were being written all along. What was missing is that nothing pushed them, the
 * `channels.email` flag on every template was declared and read by nothing, and there was no
 * banner for anything except an incoming invitation.
 *
 * Almost every guard here is structural, because nothing was computed wrongly - a notification
 * that is stored and never pushed renders perfectly on the page a player eventually opens, and
 * a template whose `actionUrl` is absent produces a banner that looks correct until it is
 * clicked. The exceptions are the two rules with a wrong answer available: where a card with no
 * stored `actionUrl` sends the player, and how long an open challenge waits.
 */

const ROOT = process.cwd();

const TEMPLATES = "database/models/notification-template.model.ts";
const ADMIN_TEMPLATES = "apps/admin/database/models/notification-template.model.ts";
const SERVICE = "lib/services/notification.service.ts";
const ADMIN_SERVICE = "apps/admin/lib/services/notification.service.ts";
const PUSH = "lib/services/notifications/notification-push.ts";
const ADMIN_PUSH = "apps/admin/lib/services/notifications/notification-push.ts";
const DELIVERY = "lib/services/notifications/delivery.ts";
const DEADLINE = "lib/services/challenges/accept-deadline.ts";
const ADMIN_DEADLINE = "apps/admin/lib/services/challenges/accept-deadline.ts";
const POPUP = "components/challenges/ChallengePopup.tsx";
const CARD = "components/notifications/NotificationPopupCard.tsx";
const BELL = "components/notifications/NotificationDropdown.tsx";
const WS_SERVER = "websocket-server/index.ts";
const ACCEPT_ROUTE = "app/api/challenges/[id]/accept/route.ts";
const CREATE_ROUTE = "app/api/challenges/route.ts";
const EXPIRY_NOTIFY = "lib/services/challenges/expiry-notifications.ts";

const read = (path: string) => readChallengeCode(path);
const raw = (path: string) => readFileSync(join(ROOT, path), "utf8");

/**
 * Every state a challenge can reach, and the template that reports it.
 *
 * Reason: the list is here rather than derived from the model so that a state losing its
 * template is a red test. Derived from the file, a deleted template takes its own assertion
 * with it and the suite stays green while a player is told nothing.
 */
const LIFECYCLE_TEMPLATES = [
  "challenge_received",
  "challenge_accepted",
  "challenge_seat_taken",
  "challenge_cancelled",
  "challenge_started",
  "challenge_declined",
  "challenge_expired",
  "challenge_open_expired",
  "challenge_won",
  "challenge_lost",
  "challenge_tie",
  "challenge_disqualified",
] as const;

/** The literal block a templateId's definition occupies in the seeded defaults. */
function templateBlock(code: string, templateId: string): string {
  const from = code.indexOf(`templateId: "${templateId}"`);
  expect(from, `${templateId} is not in the seeded defaults`).toBeGreaterThan(-1);
  const to = code.indexOf("templateId:", from + 1);
  return to === -1 ? code.slice(from) : code.slice(from, to);
}

describe("every lifecycle state has a template", () => {
  const code = read(TEMPLATES);

  it.each(LIFECYCLE_TEMPLATES)("%s is seeded", (templateId) => {
    expect(code).toContain(`templateId: "${templateId}"`);
  });

  it.each(LIFECYCLE_TEMPLATES)("%s is filed under challenge", (templateId) => {
    // Reason: the banner filter is a category and not a list of ids, so a template
    // filed under anything else is stored, pushed, counted by the bell and silently
    // never shown as a popup - which is the exact symptom that was reported.
    expect(templateBlock(code, templateId)).toContain('category: "challenge"');
  });

  it.each(LIFECYCLE_TEMPLATES)("%s is clickable", (templateId) => {
    // The owner's requirement: "all must have the proper clicks to send to specific
    // places". A template with no actionUrl falls back to a category default, which is
    // right for an old row in a live database and wrong as a design - the fallback
    // cannot know that a settled challenge belongs on its own results page.
    const block = templateBlock(code, templateId);
    expect(block).toMatch(/actionUrl: "\//);
    expect(block).toMatch(/actionText: "/);
  });

  it("has a writer for each one", () => {
    // Reason: a template nobody sends is the declared-written-dead shape. `accept`
    // chooses between two of them on one line, so the scan is over source rather than
    // a per-file expectation.
    const sources = [
      read(CREATE_ROUTE),
      read(ACCEPT_ROUTE),
      read("app/api/challenges/[id]/decline/route.ts"),
      read("apps/admin/app/api/challenges/route.ts"),
      read(EXPIRY_NOTIFY),
      read("lib/actions/trading/challenge-finalize.actions.ts"),
      read("lib/services/settlement/provider-challenge-finalize.ts"),
    ].join("\n");

    for (const templateId of LIFECYCLE_TEMPLATES) {
      expect(sources, `nothing sends ${templateId}`).toContain(`"${templateId}"`);
    }
  });
});

describe("one push seam, not one per event", () => {
  it("pushes from send rather than from each call site", () => {
    const code = read(SERVICE);
    expect(code).toMatch(/deliverNotification\(\s*\{\s*\.\.\.notification\.toObject\(\)/);
  });

  it("honours the channels.email flag the templates already carried", () => {
    // Reason: `channels` has been on NotificationTemplate since it was written and was
    // read by nothing, so an operator toggling email changed no behaviour at all.
    expect(read(SERVICE)).toMatch(/email:\s*template\.channels\?\.email === true/);
  });

  it("seeds on demand so a newly added template is not dropped", () => {
    // Reason: seeding is `$setOnInsert` and nothing on the send path ran it, so
    // `challenge_seat_taken` would have returned no template and been discarded in
    // silence - the reported defect surviving its own fix.
    expect(read(SERVICE)).toMatch(/await checkAndSeedTemplates\(\)/);
  });

  it("carries the click target on the push", () => {
    // Without this the banner is an announcement nobody can act on, and the bell and
    // the popup disagree about where one event lands.
    const code = read(PUSH);
    expect(code).toContain("actionUrl: notification.actionUrl");
    expect(code).toContain("actionText: notification.actionText");
  });

  it("does not make a route wait on the socket server", () => {
    const code = read(PUSH);
    expect(code).toMatch(/void pushNotification\(notification\)\.catch/);
    expect(code).toMatch(/AbortSignal\.timeout\(/);
  });

  it("keeps the socket server generic", () => {
    // One case for every template. Reason: the WebSocket server deploys separately, so
    // a per-event case means a new notification type is live in the app and dead on the
    // wire until somebody remembers a second repository.
    const code = read(WS_SERVER);
    expect(code).toContain('case "user-notification":');
    expect(code).not.toMatch(/case "challenge_(accepted|cancelled|seat_taken)"/);
  });

  it("pushes admin-caused notifications too", () => {
    // Reason: an operator cancelling a challenge writes through the admin service. Its
    // own copy had no push, so that notification was stored and never delivered.
    expect(read(ADMIN_SERVICE)).toContain("deliverPush(");
  });

  it("keeps the pushable module free of anything the admin app lacks", () => {
    // The email half needs `user-lookup` and the email bridge, neither of which exists
    // in `apps/admin`. Splitting the two is what makes the push mirrorable at all.
    const code = read(PUSH);
    expect(code).not.toContain("email-notification-bridge");
    expect(code).not.toContain("user-lookup");
    expect(read(DELIVERY)).toContain("email-notification-bridge");
  });
});

describe("the mirrors", () => {
  // `check:mirrors` compares models, so it says nothing about either service file.
  it.each([
    [PUSH, ADMIN_PUSH],
    [DEADLINE, ADMIN_DEADLINE],
  ])("%s is byte-identical to its admin copy", (main, admin) => {
    expect(raw(admin)).toBe(raw(main));
  });

  it.each(LIFECYCLE_TEMPLATES)(
    "%s is seeded identically in both apps",
    (templateId) => {
      expect(templateBlock(read(ADMIN_TEMPLATES), templateId)).toBe(
        templateBlock(read(TEMPLATES), templateId),
      );
    },
  );
});

describe("the banner", () => {
  it("admits a category rather than a list of templates", () => {
    // Reason: the whole point of pushing from one seam is that a template added later
    // needs no client change. A list of template ids puts that decision back in the
    // browser, where it is forgotten silently.
    const code = read(POPUP);
    expect(code).toMatch(/POPUP_CATEGORIES\.has\(n\.category\)/);
    expect(code).not.toMatch(/n\.templateId === "challenge_/);
  });

  it("suppresses only the invitation, which has its own card", () => {
    const code = read(POPUP);
    expect(code).toMatch(/SUPPRESSED_TEMPLATE_IDS = new Set\(\["challenge_received"\]\)/);
  });

  it("does not pop up the continuous trading events", () => {
    // `position_closed` and `order_filled` fire all round. Reason: showing everything
    // buries the cards a player has to act on, which is worse than showing none.
    expect(read(POPUP)).toMatch(/POPUP_CATEGORIES = new Set\(\["challenge"\]\)/);
  });

  it("sends the click through the same helper the bell's fallback lives in", () => {
    // The load-bearing half is the absence: a banner that computes its own destination
    // is a second answer to "where does this event live", and the two diverge on the
    // one template somebody forgets to update.
    const code = read(POPUP);
    expect(code).toContain("const href = popupHref(notification)");
    expect(code).not.toMatch(/router\.push\(`\/challenges\/\$\{(notification|event)\./);
  });

  it("relays to the bell instead of opening a second socket", () => {
    // Reason: `useWebSocket` creates a connection per call, so a listener in the bell
    // would double every client's socket count for one badge.
    expect(read(POPUP)).toContain("broadcastNotificationPush(n)");
    expect(read(BELL)).toContain("NOTIFICATION_PUSH_EVENT, handlePush");
    expect(read(BELL)).not.toContain("useWebSocket");
  });

  it("relays before the popup filter", () => {
    // So the badge updates for every category while only some become banners.
    const code = read(POPUP);
    const relay = code.indexOf("broadcastNotificationPush(n)");
    const filter = code.indexOf("POPUP_CATEGORIES.has(n.category)");
    expect(relay).toBeGreaterThan(-1);
    expect(filter).toBeGreaterThan(relay);
  });

  it("keeps the card ignorant of what a challenge is", () => {
    // The wording, icon, colour and destination are the notification's own, so a new
    // template needs no branch here.
    const code = read(CARD);
    expect(code).not.toMatch(/challenge_[a-z_]+/);
  });
});

describe("where a card with no stored actionUrl goes", () => {
  const card = (over: Partial<PushedNotification>): PushedNotification => ({
    _id: "n1",
    title: "t",
    message: "m",
    ...over,
  });

  it("prefers the notification's own target", () => {
    expect(popupHref(card({ actionUrl: "/challenges/abc", category: "challenge" }))).toBe(
      "/challenges/abc",
    );
  });

  it("falls back per category, because seeding cannot reach an existing row", () => {
    // Reason: `$setOnInsert` means adding an actionUrl to a default that already exists
    // in a live database never reaches it. Without this those cards are unclickable,
    // which is indistinguishable from a broken popup.
    expect(popupHref(card({ category: "challenge" }))).toBe("/challenges");
    expect(popupHref(card({ category: "competition" }))).toBe("/competitions");
  });

  it("never lands nowhere", () => {
    expect(popupHref(card({}))).toBe("/notifications");
    expect(popupHref(card({ category: "something-nobody-added" }))).toBe("/notifications");
  });

  it("is not fooled by an inherited key", () => {
    // A category comes off a stored document, so the lookup must be total.
    expect(popupHref(card({ category: "__proto__" }))).toBe("/notifications");
    expect(popupHref(card({ category: "toString" }))).toBe("/notifications");
  });
});

describe("how long an open challenge waits", () => {
  it("uses its own setting, not the one chosen for a named friend", () => {
    // The two are different questions: how long to hold a seat for one specific person
    // who has been told about it, and how long to leave a public notice up.
    expect(
      resolveAcceptDeadlineMinutes(
        { acceptDeadlineMinutes: 30, openChallengeExpiryMinutes: 720 },
        true,
      ),
    ).toBe(720);
    expect(
      resolveAcceptDeadlineMinutes(
        { acceptDeadlineMinutes: 30, openChallengeExpiryMinutes: 720 },
        false,
      ),
    ).toBe(30);
  });

  it("falls back to its own default and never to the directed one", () => {
    // Reason: an unset value is what every existing platform holds, so inheriting
    // `acceptDeadlineMinutes` here is exactly the behaviour being replaced - the
    // change would be invisible on every deployment that has not been reconfigured.
    expect(resolveAcceptDeadlineMinutes({ acceptDeadlineMinutes: 30 }, true)).toBe(
      DEFAULT_OPEN_CHALLENGE_EXPIRY_MINUTES,
    );
    expect(DEFAULT_OPEN_CHALLENGE_EXPIRY_MINUTES).not.toBe(30);
  });

  it("treats a non-positive or absent stored value as unset", () => {
    // These arrive from parseFloat on an admin form, so a zero or a NaN is one
    // keystroke away and would make every open challenge expire on creation.
    for (const bad of [0, -5, Number.NaN, null, undefined]) {
      expect(
        resolveAcceptDeadlineMinutes({ openChallengeExpiryMinutes: bad as never }, true),
      ).toBe(DEFAULT_OPEN_CHALLENGE_EXPIRY_MINUTES);
    }
  });

  it("returns a deadline measured from the given moment", () => {
    const from = new Date("2026-09-14T12:00:00.000Z");
    expect(
      resolveAcceptDeadline({ openChallengeExpiryMinutes: 60 }, true, from).toISOString(),
    ).toBe("2026-09-14T13:00:00.000Z");
  });

  it("is resolved once, by the shared helper, at every writer", () => {
    // Reason: two copies of this arithmetic let a challenge be created under one rule
    // and expired under the other, and a probe aimed at either stays green.
    for (const path of [CREATE_ROUTE, "app/api/simulator/challenges/route.ts"]) {
      const code = read(path);
      expect(code).toContain("resolveAcceptDeadline(");
      expect(code).not.toMatch(/acceptDeadlineMinutes\s*\*\s*60/);
    }
  });
});

describe("telling the creator nobody came", () => {
  it("uses wording written for an open seat", () => {
    // Reason: `challenge_expired` says the named opponent "did not respond in time",
    // which is a false statement about a challenge nobody was invited to - and seeding
    // is `$setOnInsert`, so rewording it would not reach a live database anyway.
    const code = read(EXPIRY_NOTIFY);
    expect(code).toContain("challenge_open_expired");
    expect(code).toContain("challenge_expired");
    expect(code).toMatch(/openToAnyone/);
  });

  it("is shared by all three writers rather than copied", () => {
    // The main app's action, the worker job and the admin action all expire challenges.
    const writers = [
      "lib/actions/trading/challenge-finalize.actions.ts",
      "worker/jobs/challenge-finalize.job.ts",
      "apps/admin/lib/actions/trading/challenge-finalize.actions.ts",
    ];
    for (const path of writers) {
      expect(read(path), `${path} does not notify`).toContain(
        "notifyChallengesExpired",
      );
    }
  });
});
