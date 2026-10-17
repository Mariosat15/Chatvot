import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { startTestMongo, stopTestMongo, clearTestMongo } from "../helpers/mongo-test-server";

// Reason: the harness owns the connection; the real helper would dial the configured URI.
vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose,
  default: async () => mongoose,
}));

import {
  ASSIGNABLE_ROLES,
  PLAYER_TYPES,
  isPlayerType,
  isStaffRole,
  playerTypeForSignupInterest,
  promotedPlayerType,
} from "@/lib/utils/player-type";
import { recordPlayerActivity } from "@/lib/services/player-type.service";

/**
 * Player type (owner, 5 Oct 2026): chosen at registration as trader, gamer or
 * both; upgraded to both automatically by the other kind of activity; Game
 * Master derived from the subscription and never written by activity.
 */

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("player-type rules", () => {
  it("maps every registration answer to a player type and refuses anything else", () => {
    expect(playerTypeForSignupInterest("trading")).toBe("trader");
    expect(playerTypeForSignupInterest("games")).toBe("gamer");
    expect(playerTypeForSignupInterest("both")).toBe("both");
    expect(playerTypeForSignupInterest("")).toBeUndefined();
    expect(playerTypeForSignupInterest(undefined)).toBeUndefined();
    expect(playerTypeForSignupInterest("constructor")).toBeUndefined();
    expect(playerTypeForSignupInterest("__proto__")).toBeUndefined();
  });

  it("promotes only the opposite single type", () => {
    expect(promotedPlayerType("trader", "games")).toBe("both");
    expect(promotedPlayerType(undefined, "games")).toBe("both");
    expect(promotedPlayerType("", "games")).toBe("both");
    expect(promotedPlayerType("gamer", "trading")).toBe("both");

    expect(promotedPlayerType("trader", "trading")).toBeUndefined();
    expect(promotedPlayerType(undefined, "trading")).toBeUndefined();
    expect(promotedPlayerType("gamer", "games")).toBeUndefined();
    for (const untouched of ["both", "gamemaster", "admin", "backoffice", "affiliate"]) {
      expect(promotedPlayerType(untouched, "games")).toBeUndefined();
      expect(promotedPlayerType(untouched, "trading")).toBeUndefined();
    }
  });

  it("classifies roles", () => {
    expect(PLAYER_TYPES).toEqual(["trader", "gamer", "both"]);
    expect(isPlayerType("gamer")).toBe(true);
    expect(isPlayerType("gamemaster")).toBe(false);
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("both")).toBe(false);
    expect(ASSIGNABLE_ROLES).not.toContain("affiliate");
  });

  it("admin copy is byte-identical", () => {
    expect(read("apps/admin/lib/utils/player-type.ts")).toBe(read("lib/utils/player-type.ts"));
  });
});

describe("wiring", () => {
  it("registration refuses a missing player type before creating the account", () => {
    const action = code("lib/actions/auth.actions.ts");
    const refusal = action.indexOf("PLAYER_TYPE_REQUIRED");
    const signUp = action.indexOf("auth.api.signUpEmail");
    expect(refusal).toBeGreaterThan(-1);
    expect(signUp).toBeGreaterThan(refusal);
    expect(action).not.toMatch(/const role = "trader"/);
  });

  it("a trade records activity only after the order commits, without awaiting it", () => {
    const orders = code("lib/actions/trading/order.actions.ts");
    const call = orders.indexOf('void recordPlayerActivity(session.user.id, "trading")');
    expect(call).toBeGreaterThan(-1);
    expect(orders.lastIndexOf("commitTransaction()", call)).toBeGreaterThan(-1);
  });

  it("a round records activity only after it is saved, without awaiting it", () => {
    const rounds = code("lib/services/games/round.service.ts");
    const call = rounds.indexOf('void recordPlayerActivity(input.userId, "games")');
    expect(call).toBeGreaterThan(-1);
    expect(rounds.lastIndexOf("await round.save()", call)).toBeGreaterThan(-1);
  });

  it("admin user editor offers gamer and both, and no longer offers affiliate", () => {
    for (const file of [
      "apps/admin/components/admin/UserFullDetailPanel.tsx",
      "apps/admin/components/admin/UsersSection.tsx",
    ]) {
      // Reason: raw source; the regex comment stripper mangles these JSX files
      // (a `/*` inside a class string or URL), and the list holds no comments.
      const src = read(file);
      const start = src.indexOf("const USER_ROLES");
      expect(start).toBeGreaterThan(-1);
      const rest = src.slice(start);
      const end = rest.search(/\]\s*(as const)?\s*;/);
      expect(end).toBeGreaterThan(0);
      const block = rest.slice(0, end);
      expect(block.length).toBeGreaterThan(50);
      expect(block).toMatch(/value:\s*"gamer"/);
      expect(block).toMatch(/value:\s*"both"/);
      expect(block).not.toMatch(/value:\s*"affiliate"/);
    }
    const edit = code("apps/admin/app/api/users/edit/route.ts");
    expect(edit).toMatch(/\.\.\.ASSIGNABLE_ROLES/);
    expect(edit).not.toMatch(/"affiliate"/);
  });

  it("the player list feeding leaderboards keeps gamers and both", () => {
    for (const file of ["lib/utils/user-lookup.ts", "apps/admin/lib/utils/user-lookup.ts"]) {
      const src = code(file);
      expect(src).toMatch(/!isPlayerType\(role\)/);
      expect(src).not.toMatch(/role !== "trader"/);
    }
  });
});

describe("recordPlayerActivity against a real database", () => {
  const users = () => mongoose.connection.db!.collection("user");

  beforeAll(async () => {
    await startTestMongo();
  });
  afterAll(async () => {
    await stopTestMongo();
  });
  beforeEach(async () => {
    await clearTestMongo();
  });

  async function roleAfter(seed: Record<string, unknown>, activity: "trading" | "games") {
    const _id = new ObjectId();
    await users().insertOne({ _id, email: `${_id.toHexString()}@x.test`, ...seed });
    await recordPlayerActivity(_id.toHexString(), activity);
    return (await users().findOne({ _id }))?.role;
  }

  it("upgrades a trader who plays and a gamer who trades", async () => {
    expect(await roleAfter({ role: "trader" }, "games")).toBe("both");
    expect(await roleAfter({}, "games")).toBe("both");
    expect(await roleAfter({ role: "gamer" }, "trading")).toBe("both");
  });

  it("leaves everyone else alone", async () => {
    expect(await roleAfter({ role: "trader" }, "trading")).toBe("trader");
    expect(await roleAfter({ role: "gamer" }, "games")).toBe("gamer");
    expect(await roleAfter({ role: "gamemaster" }, "games")).toBe("gamemaster");
    expect(await roleAfter({ role: "admin" }, "trading")).toBe("admin");
  });

  it("never throws for an unknown user", async () => {
    await expect(recordPlayerActivity(new ObjectId().toHexString(), "games")).resolves.toBeUndefined();
    await expect(recordPlayerActivity("", "games")).resolves.toBeUndefined();
  });
});
