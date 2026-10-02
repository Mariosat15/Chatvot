import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import { payFundedEntry } from "@/lib/services/contest-entry/free-private-entry";
import {
  DEFAULT_FREE_PRIVATE_ENTRY_RULE,
  freePrivateEntryRefusal,
  resolveFreePrivateEntryRule,
} from "@/lib/utils/free-private-entry-rule";

/**
 * Owner, 2 Oct 2026: a player with no credits could join a Game Master-funded competition,
 * because the seat costs them nothing. The admin now chooses "open to anyone" or "minimum
 * balance", and the entry guard enforces it without ever debiting the player.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("the rule", () => {
  it("defaults to requiring at least 1 credit when nothing is stored", () => {
    expect(resolveFreePrivateEntryRule(undefined)).toEqual(DEFAULT_FREE_PRIVATE_ENTRY_RULE);
    expect(resolveFreePrivateEntryRule({})).toEqual({ policy: "min_balance", minBalance: 1 });
  });

  it("opens only on a stored 'open', never on a misspelt or legacy value", () => {
    expect(resolveFreePrivateEntryRule({ freePrivateEntryPolicy: "open" }).policy).toBe("open");
    for (const v of ["OPEN", "", null, true, "anyone"]) {
      expect(resolveFreePrivateEntryRule({ freePrivateEntryPolicy: v }).policy).toBe("min_balance");
    }
  });

  it("keeps a stored 0 and falls back on NaN, negative or non-number minimums", () => {
    expect(resolveFreePrivateEntryRule({ freePrivateMinEntryBalance: 0 }).minBalance).toBe(0);
    expect(resolveFreePrivateEntryRule({ freePrivateMinEntryBalance: 25 }).minBalance).toBe(25);
    for (const v of [Number.NaN, -1, "25", Infinity]) {
      expect(resolveFreePrivateEntryRule({ freePrivateMinEntryBalance: v }).minBalance).toBe(1);
    }
  });

  it("refuses below the minimum and admits at or above it", () => {
    const rule = { policy: "min_balance" as const, minBalance: 10 };
    expect(freePrivateEntryRefusal(rule, 9.99)).toMatch(/at least 10 credits/);
    expect(freePrivateEntryRefusal(rule, Number.NaN)).toMatch(/at least 10 credits/);
    expect(freePrivateEntryRefusal(rule, 10)).toBeNull();
    expect(freePrivateEntryRefusal({ policy: "open", minBalance: 10 }, 0)).toBeNull();
  });

  it("is byte-identical in both apps", () => {
    expect(read("apps/admin/lib/utils/free-private-entry-rule.ts")).toBe(
      read("lib/utils/free-private-entry-rule.ts"),
    );
  });
});

const GM = "64b0000000000000000000a1";
const PLAYER = "64b0000000000000000000b1";

function fundedContest() {
  return {
    _id: new mongoose.Types.ObjectId(),
    name: "Funded Cup",
    entryFee: 10,
    visibility: "gm_private",
    gameMasterId: GM,
    fundingMode: "gm_funded",
    freePrivate: { reserveTotal: 40 },
  };
}

async function attempt(balance: number) {
  await CreditWallet.collection.insertOne({ userId: PLAYER, creditBalance: balance });
  const session = await mongoose.startSession();
  try {
    let out: Awaited<ReturnType<typeof payFundedEntry>> = null;
    await session.withTransaction(async () => {
      out = await payFundedEntry(fundedContest(), { userId: PLAYER, email: "p@example.com", username: "p", emailVerified: true },
        session);
    });
    return out as Awaited<ReturnType<typeof payFundedEntry>>;
  } finally {
    await session.endSession();
  }
}

describe("the entry guard", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections([
      WhiteLabel.collection.name,
      CreditWallet.collection.name,
      "wallettransactions",
      "competitions",
    ]);
  }, 120_000);
  afterAll(async () => stopTestMongo());
  afterEach(async () => clearTestMongo());

  it("refuses an empty wallet under the default rule and writes nothing", async () => {
    const r = await attempt(0);
    expect(r?.code).toBe("free_private_min_balance");
    expect(await mongoose.connection.db!.collection("wallettransactions").countDocuments()).toBe(0);
    expect(await CreditWallet.collection.findOne({ userId: PLAYER })).toMatchObject({ creditBalance: 0 });
  });

  it("refuses below an admin-set minimum", async () => {
    await WhiteLabel.collection.insertOne({
      freePrivateEntryPolicy: "min_balance",
      freePrivateMinEntryBalance: 50,
    });
    const r = await attempt(49);
    expect(r?.code).toBe("free_private_min_balance");
    expect(r?.error).toMatch(/at least 50 credits/);
  });

  it("lets a player at the minimum past this guard", async () => {
    await WhiteLabel.collection.insertOne({ freePrivateMinEntryBalance: 50 });
    const r = await attempt(50);
    expect(r?.code).not.toBe("free_private_min_balance");
  });

  it("lets an empty wallet past this guard when the admin chose 'open'", async () => {
    await WhiteLabel.collection.insertOne({ freePrivateEntryPolicy: "open" });
    const r = await attempt(0);
    expect(r?.code).not.toBe("free_private_min_balance");
  });
});

describe("the admin route and screen", () => {
  const route = read("apps/admin/app/api/gamemasters/program-settings/route.ts");
  const screen = read("apps/admin/components/admin/gamemaster/FreePrivateEntryRuleControl.tsx");

  it("the route resolves the stored rule through the shared resolver", () => {
    expect(route).toMatch(/resolveFreePrivateEntryRule\(/);
  });

  it("the screen shows the rule the server read back, not the value typed", () => {
    expect(screen).toMatch(/apply\(body\.freePrivateEntry\)/);
    expect(screen).toMatch(/describeFreePrivateEntryRule\(rule\)/);
  });

  it("is mounted on the Game Master management screen", () => {
    expect(read("apps/admin/components/admin/GameMasterManagementSection.tsx")).toMatch(
      /<FreePrivateEntryRuleControl \/>/,
    );
  });
});
