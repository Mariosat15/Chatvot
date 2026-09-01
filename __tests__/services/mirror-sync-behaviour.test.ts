import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
} from "../helpers/mongo-test-server";

/**
 * Stage 0, Defect 2: proves the mirror sync fixed real behaviour.
 *
 * This file exists to shrink the owner's manual checklist. Each test writes a field that
 * one of the two apps previously could not persist, then reads it back through the raw
 * driver to confirm it actually landed. That is precisely what drift broke: the write
 * reported success and the field was silently discarded.
 *
 * What these tests do and do not cover, stated plainly so the checklist is honest:
 *
 * - They DO prove the schema now accepts and stores the field, which is the defect.
 * - They do NOT prove the admin UI is wired to the field. A form that never sends the
 *   value would still look broken. That part still needs a human, but it is a much
 *   smaller check than "is this field silently vanishing?".
 *
 * Two traps for anyone extending this file, both of which produce a passing test that
 * proves nothing:
 *
 * 1. Import each model from only ONE of the two apps. Both copies register under the same
 *    Mongoose model name via `models.X || model("X", ...)`, so importing the main copy
 *    first makes a later import of the admin copy silently return the main one - and the
 *    test then examines the wrong schema while looking correct.
 *
 * 2. `apps/admin` has its own `node_modules/mongoose`, so the admin models run on a
 *    SEPARATE Mongoose instance which the test's `mongoose.connect` does not touch. The
 *    symptom is `Operation "x.insertOne()" buffering timed out after 10000ms`, which reads
 *    like a slow database rather than an unconnected one. `connectAdminMongoose` below
 *    connects that instance to the same server, reached through `Model.base` rather than a
 *    guessed path.
 */

// Admin-side copies: these are the schemas that were missing fields.
const AdminHeroSettings = (
  await import("../../apps/admin/database/models/hero-settings.model")
).default;
// Named export, unlike the others - it has no default.
const { WhiteLabel: AdminWhiteLabel } = await import(
  "../../apps/admin/database/models/whitelabel.model"
);
const AdminCompetition = (
  await import("../../apps/admin/database/models/trading/competition.model")
).default;
const AdminWalletTransaction = (
  await import(
    "../../apps/admin/database/models/trading/wallet-transaction.model"
  )
).default;
const AdminNotificationPreferences = (
  await import(
    "../../apps/admin/database/models/user-notification-preferences.model"
  )
).default;

// Main-app copies: these are the schemas that were missing fields.
const WithdrawalRequest = (
  await import("@/database/models/withdrawal-request.model")
).default;
const PlatformFinancials = (
  await import("@/database/models/platform-financials.model")
).default;

async function raw(collection: string, filter: Record<string, unknown>) {
  return mongoose.connection.db?.collection(collection).findOne(filter);
}

/**
 * The fields these schemas require, which are beside the point of every test here.
 *
 * Reason: kept as one constant per model so a test body shows only the field under
 * examination. A reader should be able to see what is being proven without picking it out
 * of a dozen lines of mandatory scaffolding.
 */
const VALID_WITHDRAWAL = {
  userId: "6500000000000000000000a1",
  userEmail: "player@example.com",
  amountCredits: 250,
  amountEUR: 250,
  exchangeRate: 1,
  platformFee: 5,
  platformFeeCredits: 5,
  netAmountEUR: 245,
  payoutMethod: "bank_transfer",
  walletBalanceBefore: 500,
  walletBalanceAfter: 250,
};

const VALID_COMPETITION = {
  description: "Seeded by mirror-sync-behaviour.test.ts",
  slug: "gm-weekly-cup",
  entryFee: 10,
  startingCapital: 10_000,
  minParticipants: 2,
  maxParticipants: 100,
  currentParticipants: 0,
  startTime: new Date(Date.now() + 3_600_000),
  endTime: new Date(Date.now() + 7_200_000),
  registrationDeadline: new Date(Date.now() + 1_800_000),
  status: "upcoming",
  createdBy: "6500000000000000000000b2",
};

/**
 * Connects the admin app's own Mongoose instance to the same test server.
 *
 * Reason: reached via `Model.base`, which IS the instance the admin models registered
 * themselves on. Importing "apps/admin/node_modules/mongoose" by path would work today and
 * break the moment npm hoists the dependency.
 */
async function connectAdminMongoose(uri: string): Promise<void> {
  const adminMongoose = AdminHeroSettings.base;
  if (adminMongoose === mongoose) return; // hoisted; nothing to do
  if (adminMongoose.connection.readyState === 0) {
    await adminMongoose.connect(uri, { serverSelectionTimeoutMS: 30_000 });
  }
}

describe("Defect 2 - the synced fields now actually persist", () => {
  beforeAll(async () => {
    const uri = await startTestMongo();
    await connectAdminMongoose(uri);
  }, 120_000);

  afterAll(async () => {
    const adminMongoose = AdminHeroSettings.base;
    if (
      adminMongoose !== mongoose &&
      adminMongoose.connection.readyState !== 0
    ) {
      await adminMongoose.disconnect();
    }
    await stopTestMongo();
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  describe("checklist: force a withdrawal to fail", () => {
    it("records the failure time and the processor's reason", async () => {
      // Reason: the Nuvei withdrawal route writes all three of these on its failure
      // paths. The main app's schema declared none of them, and failedReason was in
      // neither copy - so every failed withdrawal in production was stored with no time
      // and no reason, which is exactly the information support needs.
      const failedAt = new Date("2026-09-01T09:15:00.000Z");

      await WithdrawalRequest.create({
        ...VALID_WITHDRAWAL,
        status: "failed",
        failedAt,
        failedReason: "Issuer declined: insufficient funds at receiving bank",
        withdrawalMethod: "bank_transfer",
      });

      const row = await raw("withdrawalrequests", { status: "failed" });

      expect(row?.failedAt).toEqual(failedAt);
      expect(row?.failedReason).toBe(
        "Issuer declined: insufficient funds at receiving bank",
      );
      expect(row?.withdrawalMethod).toBe("bank_transfer");
    });
  });

  describe("checklist: edit a previously unwritable landing-page section", () => {
    it("persists trust badges, which the admin schema could not store", async () => {
      // Reason: 42 fields were missing from the admin copy of hero-settings, and the
      // admin app is the *only* editor for that content. Saving returned success and
      // changed nothing, so six landing-page sections were uneditable.
      await AdminHeroSettings.create({
        trustBadgesTitle: "Trusted by traders worldwide",
        trustBadges: [
          { label: "PCI DSS", icon: "shield" },
          { label: "GDPR", icon: "lock" },
        ],
      });

      const row = await raw("herosettings", {
        trustBadgesTitle: "Trusted by traders worldwide",
      });

      expect(row?.trustBadgesTitle).toBe("Trusted by traders worldwide");
      expect(row?.trustBadges).toHaveLength(2);
      expect((row?.trustBadges as { label: string }[])[0]?.label).toBe(
        "PCI DSS",
      );
    });

    it("survives a read-modify-write cycle, which is what the admin form does", async () => {
      // Reason: a create() proves the schema accepts the field. It does not prove the
      // admin form's actual pattern - load the document, change one thing, save it -
      // preserves the rest. That is the operation an editor performs, so it is the one
      // worth pinning.
      await AdminHeroSettings.create({
        trustBadgesTitle: "Original title",
        trustBadges: [{ label: "PCI DSS", icon: "shield" }],
      });

      const doc = await AdminHeroSettings.findOne({
        trustBadgesTitle: "Original title",
      });
      expect(doc).toBeTruthy();
      (doc as unknown as { trustBadgesTitle: string }).trustBadgesTitle =
        "Updated title";
      await doc?.save();

      const row = await raw("herosettings", { trustBadgesTitle: "Updated title" });
      expect(row?.trustBadgesTitle).toBe("Updated title");
      expect(row?.trustBadges).toHaveLength(1);
    });
  });

  describe("hero and branding image recovery after a redeploy", () => {
    /**
     * Writes a branding file the way apps/admin/app/api/hero-settings/upload/route.ts
     * does at lines 97-106: load or construct the document, read brandingFiles or start a
     * new Map, set the key, assign it back, save.
     *
     * Reason: mirroring the real write matters here. A create() with a plain object
     * succeeds and would have hidden the defect the second test below records.
     */
    async function writeBrandingFile(key: string) {
      const doc = new AdminWhiteLabel();
      const files =
        (doc as unknown as { brandingFiles?: Map<string, unknown> })
          .brandingFiles ?? new Map<string, unknown>();
      files.set(key, {
        data: "data:image/png;base64,iVBORw0KGgo=",
        contentType: "image/png",
        updatedAt: new Date("2026-09-01T00:00:00.000Z"),
      });
      (doc as unknown as { brandingFiles: Map<string, unknown> }).brandingFiles =
        files;
      await doc.save();
      return doc;
    }

    it("now declares and stores the field the recovery path reads", async () => {
      // Reason: whitelabel.brandingFiles holds a base64 copy of every uploaded image so
      // it can be restored after a redeploy wipes the filesystem. The admin schema did
      // not declare it, and four routes read `settings?.brandingFiles?.get(...)`, which
      // was permanently undefined - so recovery never ran.
      const doc = await writeBrandingFile("hero-banner-png");

      const reread = await AdminWhiteLabel.findById(doc._id);
      const stored = (
        reread as unknown as { brandingFiles?: Map<string, unknown> }
      )?.brandingFiles;

      expect(stored).toBeDefined();
      expect(stored?.has("hero-banner-png")).toBe(true);
    });

    it("STILL FAILS for a real filename, because Mongoose maps reject keys containing a dot", async () => {
      // Reason: this test records a defect, not a fix. Syncing the schema was necessary
      // and is not sufficient.
      //
      // The upload route builds `${type}-${timestamp}-${random}.${ext}` and uses it as the
      // Map key, so the key ALWAYS contains a dot, and Mongoose rejects it. The four
      // readers look the file up by that same dotted name, so the key format cannot simply
      // be changed on the write side alone.
      //
      // The sync changed the failure mode rather than removing it. Before: brandingFiles
      // was undeclared, so `(settings as any).brandingFiles` gave undefined, the route fell
      // back to a plain JS Map which accepts any key, and the assignment to an undeclared
      // path was silently discarded. After: the field is declared with `default: new Map()`,
      // so the route now gets a MongooseMap, which validates the key and throws.
      //
      // Either way the backup has never been written once. Line 108 of the upload route
      // catches this and logs a warning, and the response still reports success because
      // the file did reach the disk - so nothing surfaces until a redeploy, by which point
      // the image is gone and there is no copy to restore.
      //
      // One consequence worth stating: there is no data to migrate when this is fixed,
      // because no brandingFiles entry has ever been stored.
      await expect(writeBrandingFile("hero-1756713600-a1b2c3.png")).rejects.toThrow(
        /do not support keys that contain "\."/,
      );
    });
  });

  describe("checklist: a Game-Master-created competition shows its Game Master", () => {
    it("persists the game master id and cached name", async () => {
      await AdminCompetition.create({
        ...VALID_COMPETITION,
        name: "GM Weekly Cup",
        gameMasterId: "6500000000000000000000b2",
        gameMasterName: "Alex the Host",
      });

      const row = await raw("competitions", { name: "GM Weekly Cup" });

      expect(row?.gameMasterId).toBe("6500000000000000000000b2");
      expect(row?.gameMasterName).toBe("Alex the Host");
    });
  });

  describe("checklist: a card deposit shows its payment provider", () => {
    it("persists the provider and the provider's own transaction id", async () => {
      await AdminWalletTransaction.create({
        userId: "6500000000000000000000a1",
        transactionType: "deposit",
        amount: 100,
        balanceBefore: 0,
        balanceAfter: 100,
        status: "completed",
        description: "Card deposit",
        provider: "nuvei",
        providerTransactionId: "nuvei_txn_9f3c1a",
      });

      const row = await raw("wallettransactions", { amount: 100 });

      expect(row?.provider).toBe("nuvei");
      expect(row?.providerTransactionId).toBe("nuvei_txn_9f3c1a");
    });
  });

  describe("checklist: muting challenge, social and messaging notifications", () => {
    it("persists all three categories the admin schema was missing", async () => {
      await AdminNotificationPreferences.create({
        userId: "6500000000000000000000a1",
        categoryPreferences: {
          challenge: false,
          social: false,
          messaging: false,
        },
      });

      const row = await raw("usernotificationpreferences", {
        userId: "6500000000000000000000a1",
      });
      const prefs = row?.categoryPreferences as Record<string, boolean>;

      // Reason: `false` is the value that matters. A missing field reads as undefined,
      // and `undefined !== false`, so the admin app treated a muted category as enabled
      // and sent the notification anyway.
      expect(prefs?.challenge).toBe(false);
      expect(prefs?.social).toBe(false);
      expect(prefs?.messaging).toBe(false);
    });
  });

  describe("checklist: admin balance addition and custom expense", () => {
    it("accepts both transaction types the main app's enum was missing", async () => {
      // Reason: this is the drift case that REJECTS the write rather than silently
      // dropping a field. A missing enum value fails validation on the whole document,
      // so the record is lost outright rather than stored incomplete.
      await PlatformFinancials.create({
        transactionType: "admin_balance_add",
        amount: 5_000,
        amountEUR: 5_000,
        description: "Q3 operating float",
        balanceAddDetails: {
          source: "Bank transfer",
          reference: "TRF-2026-Q3-0091",
        },
      });

      await PlatformFinancials.create({
        transactionType: "custom_expense",
        amount: -899,
        amountEUR: -899,
        description: "Annual monitoring subscription",
        expenseDetails: {
          category: "software",
          vendor: "Monitoring Co",
          invoiceNumber: "INV-88213",
        },
      });

      // Note the collection name: this model registers as "PlatformTransaction", so the
      // collection is platformtransactions, not platformfinancials after the file name.
      const add = await raw("platformtransactions", {
        transactionType: "admin_balance_add",
      });
      const expense = await raw("platformtransactions", {
        transactionType: "custom_expense",
      });

      expect(add?.amount).toBe(5_000);
      expect(
        (add?.balanceAddDetails as { source?: string })?.source,
      ).toBe("Bank transfer");

      expect(expense?.amount).toBe(-899);
      expect(
        (expense?.expenseDetails as { category?: string })?.category,
      ).toBe("software");
    });

    it("still rejects a transaction type that is in neither copy", async () => {
      // Reason: guards the fix. The enum values were added to make two schemas agree,
      // not to make the field permissive. If validation stopped biting, a typo would
      // corrupt every financial total that groups by this field.
      await expect(
        PlatformFinancials.create({
          transactionType: "admin_balance_addition" as never,
          amount: 1,
          amountEUR: 1,
          description: "Typo in the transaction type",
        }),
      ).rejects.toThrow(/validation failed/i);
    });
  });
});
