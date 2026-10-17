import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";
import Chargeback from "@/database/models/chargeback.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import {
  completeChargeback,
  ClawbackRefusedError,
} from "@/lib/services/security/chargeback-case.writers";

/**
 * R84: a chargeback clawback that the wallet cannot cover is REFUSED, not clamped.
 *
 * The defect: `completeChargeback` wrote a `chargeback_clawback` row for the full
 * negative amount and then stored `Math.max(0, balanceAfter)` on the wallet. The
 * ledger and the balance therefore disagreed by the shortfall, for ever - and
 * reconciliation cannot repair it, because its `balance_mismatch` fix refuses to
 * reduce a player's balance (R81). The canonical rule, `evaluateClawback`, has
 * always said refuse; it simply had no caller.
 *
 * Both halves matter and are asserted separately: the money must not move, and the
 * case must not close, because a closed case with no clawback reads as settled.
 */

const ADMIN = { id: "admin-1", name: "Admin One", email: "a@chartvolt" };

async function seedCase(userId: string) {
  const c = await Chargeback.create({
    userId,
    provider: "atlas",
    amount: 100,
    currency: "EUR",
    status: "initiated",
  });
  return c;
}

describe("chargeback clawback refuses rather than clamping (R84)", () => {
  beforeAll(async () => {
    const uri = await startTestMongo();
    // Reason: the writer calls `connectToDatabase()`, which reads MONGODB_URI and
    // throws when it is unset - and in a test run an unset value is the lucky
    // outcome, the unlucky one being a suite that talks to a real database.
    process.env.MONGODB_URI = uri;
    await ensureCollections([
      "chargebacks",
      "creditwallets",
      "wallettransactions",
      "auditlogs",
    ]);
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  it("refuses a clawback the wallet cannot cover, moving no money and leaving the case open", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    await CreditWallet.create({ userId, creditBalance: 20 });
    const c = await seedCase(userId);

    await expect(
      completeChargeback(String(c._id), ADMIN, { userWallet: { amount: 100 } }),
    ).rejects.toThrow(ClawbackRefusedError);

    const wallet = await CreditWallet.findOne({ userId });
    expect(wallet?.creditBalance).toBe(20);
    expect(wallet?.totalRefunded || 0).toBe(0);

    // No ledger row at all - the old code wrote one for -100 beside a balance of 0.
    const rows = await WalletTransaction.find({ userId });
    expect(rows).toHaveLength(0);

    const after = await Chargeback.findById(c._id);
    expect(after?.status).toBe("initiated");
    expect(after?.clawback.userWallet.applied).toBe(false);
  });

  it("records the refused attempt on the case so it is not only an error toast", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    await CreditWallet.create({ userId, creditBalance: 5 });
    const c = await seedCase(userId);

    await expect(
      completeChargeback(String(c._id), ADMIN, { userWallet: { amount: 60 } }),
    ).rejects.toThrow(/already spent|loss|fraud/i);

    const after = await Chargeback.findById(c._id);
    const refusals = (after?.timeline || []).filter(
      (t: { action: string; notes?: string }) =>
        t.action === "clawback_refused",
    );
    expect(refusals).toHaveLength(1);
    expect(refusals[0].notes).toContain("60");
  });

  it("applies a clawback the wallet can cover, with balance and ledger agreeing exactly", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    await CreditWallet.create({ userId, creditBalance: 250 });
    const c = await seedCase(userId);

    await completeChargeback(String(c._id), ADMIN, {
      userWallet: { amount: 100 },
    });

    const wallet = await CreditWallet.findOne({ userId });
    expect(wallet?.creditBalance).toBe(150);

    const rows = await WalletTransaction.find({ userId });
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(-100);
    // The row's own arithmetic must land on the stored balance, which is the
    // pair the old clamp broke.
    expect(rows[0].balanceBefore).toBe(250);
    expect(rows[0].balanceAfter).toBe(150);
    expect(rows[0].balanceAfter).toBe(wallet?.creditBalance);

    const after = await Chargeback.findById(c._id);
    expect(after?.status).toBe("lost");
    expect(after?.clawback.userWallet.applied).toBe(true);
  });

  it("clamping the whole balance to zero is impossible: the exact balance is allowed, a credit more is not", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    await CreditWallet.create({ userId, creditBalance: 40 });

    const exact = await seedCase(userId);
    await completeChargeback(String(exact._id), ADMIN, {
      userWallet: { amount: 40 },
    });
    expect((await CreditWallet.findOne({ userId }))?.creditBalance).toBe(0);

    await CreditWallet.updateOne({ userId }, { $set: { creditBalance: 40 } });
    const over = await seedCase(userId);
    await expect(
      completeChargeback(String(over._id), ADMIN, {
        userWallet: { amount: 40.01 },
      }),
    ).rejects.toThrow(ClawbackRefusedError);
    expect((await CreditWallet.findOne({ userId }))?.creditBalance).toBe(40);
  });
});

/**
 * Structural half: neither writer may grow its own reading of the rule again.
 * The decision lives in `evaluateClawback` and nowhere else - it was extracted
 * out of the Atlas route, called by nothing, and the chargeback writer then
 * answered the same question differently. That is the "one rule, two copies"
 * shape, and here the two copies disagreed about whether a player keeps credits
 * they were already paid back for.
 */
function readCode(relative: string): string {
  const raw = readFileSync(join(process.cwd(), relative), "utf8");
  return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const CLAWBACK_WRITERS = [
  "lib/services/security/chargeback-case.writers.ts",
  "apps/admin/app/api/atlas/refund/clawback/route.ts",
];

describe("one reading of the clawback rule", () => {
  it.each(CLAWBACK_WRITERS)("%s decides through evaluateClawback", (file) => {
    const code = readCode(file);
    // The call with its argument, not the bare identifier - an import is not a use.
    expect(code).toMatch(/evaluateClawback\(\s*\{/);
  });

  it.each(CLAWBACK_WRITERS)("%s never clamps a balance at zero", (file) => {
    const code = readCode(file);
    expect(code).not.toMatch(/Math\.max\(\s*0\s*,/);
  });

  it("the chargeback writer refuses instead of writing a row it cannot cover", () => {
    const code = readCode("lib/services/security/chargeback-case.writers.ts");
    const decisionAt = code.indexOf("evaluateClawback({");
    const rowAt = code.indexOf("WalletTransaction.create");
    expect(decisionAt).toBeGreaterThan(-1);
    expect(rowAt).toBeGreaterThan(-1);
    // Position, not presence: the refusal has to precede the ledger write, or
    // the row is already stored when the guard fires.
    expect(decisionAt).toBeLessThan(rowAt);
    const between = code.slice(decisionAt, rowAt);
    expect(between).toMatch(/throw new ClawbackRefusedError/);
  });
});
