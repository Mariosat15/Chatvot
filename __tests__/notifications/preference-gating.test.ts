import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import UserNotificationPreferences from "@/database/models/user-notification-preferences.model";
import {
  clearTestMongo,
  ensureCollections,
  startTestMongo,
  stopTestMongo,
} from "../helpers/mongo-test-server";

/**
 * Letting a player switch things off, and knowing which switch governs what.
 *
 * The owner asked for two things: the ability to turn off specific notifications and
 * popups, and the ability to turn off email. The first mostly existed. The second did
 * not exist at all in the place it mattered - `lib/nodemailer/` composes deposit,
 * withdrawal, refund and invoice mail directly from an address, never touching the
 * notification pipeline, so no preference on any screen could reach it.
 *
 * Three claims are behavioural because there is a wrong answer available:
 *
 *   - quiet hours must suppress the interruption and KEEP the row. The old code
 *     returned false outright, so a claimed open seat during quiet hours was lost
 *     permanently with nothing on any screen to explain the gap.
 *   - a receipt is not a notice. Turning off competition alerts must not stop deposit
 *     confirmations, and vice versa, or a player cannot tell which switch did what.
 *   - account and security mail is unconditional. It is how somebody proves the address
 *     is theirs, so a switch that could stop it is a lockout waiting to happen.
 *
 * The rest is structural, because a sender that never asks reports success exactly as
 * loudly as one that asks and is told yes.
 */

const ROOT = process.cwd();

const MAILER = "lib/nodemailer/index.ts";
const ADMIN_MAILER = "apps/admin/lib/nodemailer/index.ts";
const PREFS = "lib/services/email-preferences.ts";
const SERVICE = "lib/services/notification.service.ts";
const DELIVERY = "lib/services/notifications/delivery.ts";
const BRIDGE = "lib/services/email-notification-bridge.ts";
const MODEL = "database/models/user-notification-preferences.model.ts";
const ADMIN_MODEL =
  "apps/admin/database/models/user-notification-preferences.model.ts";
const SETTINGS = "components/notifications/NotificationSettings.tsx";
const ROUTE = "app/api/notifications/preferences/route.ts";

/**
 * Reads a file with comments removed.
 *
 * Reason: every module here explains the anti-patterns in prose - the model says why
 * transactional mail is deliberately not gated on `emailNotificationsEnabled`, the
 * mailer says why it asks before composing. A test that reads prose fails on a correct
 * file for discussing the mistake, and passes a broken one whose only mention of the
 * right helper is in a comment.
 */
function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** The four money emails composed straight from an address, bypassing every template. */
const TRANSACTIONAL_SENDERS = [
  "sendInvoiceEmail",
  "sendDepositCompletedEmail",
  "sendRefundCompletedEmail",
  "sendWithdrawalCompletedEmail",
];

const USER = "507f1f77bcf86cd799439011";

describe("notification and email preferences", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections(["usernotificationpreferences"]);
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
  });

  describe("resolveDelivery decides all three destinations at once", () => {
    it("delivers everything to a player who has never opened the settings screen", async () => {
      // Reason: fails open. The overwhelming majority of accounts have no document, and
      // silently withholding a prize notification is unreportable - the player never
      // learns that the thing they were not told about happened.
      const delivery = await UserNotificationPreferences.resolveDelivery(
        USER,
        "competition",
      );

      expect(delivery).toEqual({ store: true, push: true, email: true });
    });

    it("stops all three when the master switch is off", async () => {
      await UserNotificationPreferences.create({
        userId: USER,
        notificationsEnabled: false,
      });

      const delivery = await UserNotificationPreferences.resolveDelivery(
        USER,
        "competition",
      );

      expect(delivery).toEqual({ store: false, push: false, email: false });
    });

    it("stops a category the player switched off", async () => {
      await UserNotificationPreferences.create({
        userId: USER,
        categoryPreferences: { competition: false, challenge: true },
      });

      expect(
        await UserNotificationPreferences.resolveDelivery(USER, "competition"),
      ).toEqual({ store: false, push: false, email: false });
      expect(
        (await UserNotificationPreferences.resolveDelivery(USER, "challenge"))
          .store,
      ).toBe(true);
    });

    it("stops a single template the player switched off, leaving its siblings", async () => {
      await UserNotificationPreferences.create({
        userId: USER,
        disabledNotifications: ["challenge_seat_taken"],
      });

      expect(
        (
          await UserNotificationPreferences.resolveDelivery(
            USER,
            "challenge",
            "challenge_seat_taken",
          )
        ).store,
      ).toBe(false);
      expect(
        (
          await UserNotificationPreferences.resolveDelivery(
            USER,
            "challenge",
            "challenge_accepted",
          )
        ).store,
      ).toBe(true);
    });

    it("delivers security whatever the category and template switches say", async () => {
      await UserNotificationPreferences.create({
        userId: USER,
        categoryPreferences: { security: false },
        disabledNotifications: ["suspicious_login"],
      });

      const delivery = await UserNotificationPreferences.resolveDelivery(
        USER,
        "security",
        "suspicious_login",
      );

      expect(delivery.store).toBe(true);
    });

    it("KEEPS the row during quiet hours and only withholds the interruption", async () => {
      /*
        The load-bearing test of this slice.

        Written the old way - a single boolean for the whole decision - quiet hours threw
        the stored notification away too, so a player woke to no record that their open
        seat had been claimed. "Do not buzz me at 3am" and "do not tell me at all" are two
        requests.

        The window is computed from the suite's own clock rather than hard-coded, because
        a fixed span is inside quiet hours for only part of the day and the test would
        pass or fail depending on when it ran.
      */
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const at = (offsetMinutes: number) => {
        const t = new Date(now.getTime() + offsetMinutes * 60_000);
        return `${pad(t.getHours())}:${pad(t.getMinutes())}`;
      };

      await UserNotificationPreferences.create({
        userId: USER,
        quietHoursEnabled: true,
        quietHoursStart: at(-60),
        quietHoursEnd: at(60),
      });

      const delivery = await UserNotificationPreferences.resolveDelivery(
        USER,
        "challenge",
        "challenge_seat_taken",
      );

      expect(delivery.store).toBe(true);
      expect(delivery.push).toBe(false);
    });

    it("isNotificationEnabled answers the store flag and nothing else", async () => {
      // Reason: pre-existing callers keep their exact meaning. One deliberate change -
      // it now answers true during quiet hours, because the row is written.
      await UserNotificationPreferences.create({
        userId: USER,
        emailNotificationsEnabled: false,
      });

      expect(
        await UserNotificationPreferences.isNotificationEnabled(
          USER,
          "competition",
        ),
      ).toBe(true);
      expect(
        (await UserNotificationPreferences.resolveDelivery(USER, "competition"))
          .email,
      ).toBe(false);
    });
  });

  describe("mayReceiveEmailGroup separates a receipt from a notice", () => {
    it("sends account and security mail without reading anything", async () => {
      await UserNotificationPreferences.create({
        userId: USER,
        notificationsEnabled: false,
        emailNotificationsEnabled: false,
        transactionalEmailsEnabled: false,
      });

      expect(
        await UserNotificationPreferences.mayReceiveEmailGroup(USER, "account"),
      ).toBe(true);
    });

    it("keeps sending receipts to a player who turned notification email off", async () => {
      // Reason: the two switches answer two questions. Folding them together means
      // turning off competition alerts silently stops deposit confirmations, and no
      // screen can explain which switch did it.
      await UserNotificationPreferences.create({
        userId: USER,
        emailNotificationsEnabled: false,
      });

      expect(
        await UserNotificationPreferences.mayReceiveEmailGroup(
          USER,
          "transactional",
        ),
      ).toBe(true);
      expect(
        await UserNotificationPreferences.mayReceiveEmailGroup(
          USER,
          "notification",
        ),
      ).toBe(false);
    });

    it("keeps sending notification email to a player who turned receipts off", async () => {
      await UserNotificationPreferences.create({
        userId: USER,
        transactionalEmailsEnabled: false,
      });

      expect(
        await UserNotificationPreferences.mayReceiveEmailGroup(
          USER,
          "transactional",
        ),
      ).toBe(false);
      expect(
        await UserNotificationPreferences.mayReceiveEmailGroup(
          USER,
          "notification",
        ),
      ).toBe(true);
    });

    it("defaults an existing document with no stored flag to receiving receipts", async () => {
      /*
        Every preferences document written before today has no such field, and it must
        read as "yes" - the opposite stops the deposit confirmations of everybody who has
        ever opened this screen, silently, on deploy.

        WHICH MECHANISM ANSWERS THIS IS NOT THE OBVIOUS ONE, and a probe proved it: the
        `!== false` in the model is NOT what saves an absent field. Mongoose applies the
        schema default when it HYDRATES, so by the time the static reads the document the
        value is already `true` - the probe rewriting that comparison to `=== true` left
        this test green. The protection is the schema default, so that is what this test
        names. The comparison is tested separately below, on the shape it genuinely
        answers.
      */
      await UserNotificationPreferences.collection.insertOne({
        userId: USER,
        notificationsEnabled: true,
      });

      expect(
        await UserNotificationPreferences.mayReceiveEmailGroup(
          USER,
          "transactional",
        ),
      ).toBe(true);

      expect(
        UserNotificationPreferences.schema.path("transactionalEmailsEnabled")
          .options.default,
      ).toBe(true);
    });

    it("reads a stored null as receiving receipts", async () => {
      /*
        The shape the `!== false` comparison actually answers, and the reason it is not
        written `=== true`.

        Mongoose fills a default for `undefined` only, so a stored `null` survives
        hydration untouched - and `null` is exactly what a bad edit, a half-run migration
        or a form submitting an empty control leaves behind. Missing has three shapes and
        the default covers one of them.
      */
      await UserNotificationPreferences.collection.insertOne({
        userId: USER,
        notificationsEnabled: true,
        transactionalEmailsEnabled: null,
      });

      expect(
        await UserNotificationPreferences.mayReceiveEmailGroup(
          USER,
          "transactional",
        ),
      ).toBe(true);
    });

    it("sends to a player with no document at all", async () => {
      expect(
        await UserNotificationPreferences.mayReceiveEmailGroup(
          USER,
          "transactional",
        ),
      ).toBe(true);
    });
  });

  describe("every sender asks before sending", () => {
    it.each(TRANSACTIONAL_SENDERS)(
      "%s asks mayEmailAddress before composing, in both apps",
      (sender) => {
        for (const path of [MAILER, ADMIN_MAILER]) {
          const code = read(path);
          const start = code.indexOf(`export const ${sender}`);
          expect(start, `${sender} not found in ${path}`).toBeGreaterThan(-1);

          // Reason: slice to the next export rather than a fixed character count. A
          // fixed window begins mid-identifier and has already reported a guard
          // missing that was present.
          const next = code.indexOf("\nexport const ", start + 1);
          const body = code.slice(start, next === -1 ? code.length : next);
          expect(body.length).toBeGreaterThan(100);

          expect(body).toMatch(/mayEmailAddress\([^)]*"transactional"/);
        }
      },
    );

    it("names the group at the call site rather than defaulting to one", () => {
      // Reason: `account` is a value rather than an absent case so a caller who has to
      // name the group cannot forget to ask. A default would make the grep for who
      // bypasses the switches return every sender that simply never called it.
      const code = read(PREFS);
      expect(code).toMatch(/group:\s*EmailGroup/);
      expect(code).not.toMatch(/group:\s*EmailGroup\s*=/);
    });

    it("fails open when the address cannot be resolved to an account", () => {
      // Reason: an unknown address is usually a legitimate one we have not matched -
      // a changed email, an admin-side send. Refusing there withholds a receipt for
      // money that has already moved.
      const code = read(PREFS);
      expect(code).toMatch(/if\s*\(!userId\)\s*return true/);
      expect(code).toMatch(/catch[\s\S]{0,300}return true/);
    });

    it("notificationService.send resolves delivery before writing anything", () => {
      const code = read(SERVICE);
      const resolve = code.indexOf("resolveDelivery(");
      const create = code.indexOf("Notification.create(");

      expect(resolve).toBeGreaterThan(-1);
      expect(create).toBeGreaterThan(-1);
      expect(resolve).toBeLessThan(create);
    });

    it("the push is the flag that quiet hours can withhold, not the store", () => {
      // Reason: the whole point of splitting the decision into three. A delivery layer
      // that ignores `push` is green against every model test above while a player is
      // still buzzed at 3am.
      const code = read(DELIVERY);
      expect(code).toMatch(/channels\.push\s*!==\s*false/);
    });

    it("the email bridge delegates rather than carrying its own precedence", () => {
      /*
        It used to have its own copy and the two disagreed - the bridge ignored quiet
        hours, the model treated them as a full stop. One rule, two copies, the shape
        behind referenceId, failedReason, challengeId and the Game Master `||`, none of
        which check:mirrors can see.
      */
      const code = read(BRIDGE);
      expect(code).toMatch(/resolveDelivery\(/);
      expect(code).not.toMatch(/quietHours/);
    });
  });

  describe("the settings screen", () => {
    /**
     * The markup above the master conditional, which is the only part of the screen a
     * player with notifications switched off can see.
     *
     * Reason: a bare file-wide match cannot answer any question here, and two probes
     * proved it. `transactionalEmailsEnabled` appears in the `Preferences` interface at
     * the top of the file, so a position check finds the DECLARATION and passes however
     * the control is nested; and `Always On` appears a second time on the security
     * category row, so a whole-file match is satisfied by a badge inside the very block
     * being tested for. Slice, then assert within the slice.
     */
    function alwaysVisible(): string {
      const code = read(SETTINGS);
      const end = code.indexOf("preferences.notificationsEnabled && (");
      expect(end).toBeGreaterThan(-1);

      const start = code.indexOf("return (");
      expect(start).toBeGreaterThan(-1);
      expect(start).toBeLessThan(end);

      const slice = code.slice(start, end);
      // Reason: a slice that found nothing passes everything asked of it.
      expect(slice.length).toBeGreaterThan(200);
      return slice;
    }

    it("puts the receipts switch OUTSIDE the master notifications conditional", () => {
      /*
        The load-bearing structural guard.

        Every other control here is correctly hidden when notifications are off. Hiding
        this one means the switch for "stop emailing me my deposit confirmations" is
        reachable only while notifications are ON - so the player who has turned
        everything off cannot find the one email they are still getting. Same shape as
        R65's guard, where wrapping the whole info box would have taken the
        non-refundable warning off every game contest.

        Asserted on the WRITE rather than on the name: a rendered control that saves the
        field is the thing that has to be reachable, and the name alone is satisfied by
        the interface declaration.
      */
      expect(alwaysVisible()).toMatch(
        /updatePreferences\(\{\s*transactionalEmailsEnabled/,
      );
    });

    it("says the account group cannot be switched off rather than omitting it", () => {
      // Reason: a group that is simply absent reads as an oversight, and a player who
      // wants "no email at all" goes looking for a control that does not exist. Saying
      // it is always on answers the question.
      const slice = alwaysVisible();
      expect(slice).toMatch(/Account &amp; security/);
      expect(slice).toMatch(/Always On/);
    });

    it("reads an absent stored flag as on", () => {
      // Reason: pre-existing documents have no such field, and `checked={undefined}`
      // renders an uncontrolled switch that looks off.
      expect(alwaysVisible()).toMatch(
        /checked=\{preferences\.transactionalEmailsEnabled\s*!==\s*false\}/,
      );
    });

    it("is writable through the preferences route", () => {
      const code = read(ROUTE);
      expect(code).toMatch(
        /typeof transactionalEmailsEnabled === "boolean"[\s\S]{0,160}updates\.transactionalEmailsEnabled/,
      );
    });
  });

  it("both copies of the preferences model agree byte for byte", () => {
    // Reason: check:mirrors compares field paths and enum values. It cannot see a
    // static method, and both apps send email.
    expect(readFileSync(join(ROOT, ADMIN_MODEL), "utf8")).toBe(
      readFileSync(join(ROOT, MODEL), "utf8"),
    );
  });

  it("both copies of the email-preferences service agree byte for byte", () => {
    expect(
      readFileSync(join(ROOT, "apps/admin/lib/services/email-preferences.ts"), "utf8"),
    ).toBe(readFileSync(join(ROOT, PREFS), "utf8"));
  });
});
