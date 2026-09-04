import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * X1: the game module registry.
 *
 * The registry is what lets the contest engine run a contest without knowing what the
 * game is. Three of its behaviours decide money, and each is pinned below.
 *
 *   1. AN UNKNOWN GAME TYPE MUST NOT FALL BACK TO TRADING. This is the single most
 *      dangerous line that could be written in this file. Settling a provider contest
 *      with trading code reads every participant's score as zero, ties the whole field
 *      at rank 1, and splits the pool equally between people who did not win it - with
 *      no error, no empty state and no log line. A fallback would look like defensive
 *      programming and would be the opposite.
 *
 *   2. AN ABSENT LABEL DOES MEAN TRADING. Invariant 5. The model defaults cover writes
 *      through Mongoose, but not documents written before X1, and not the Game Master
 *      route which inserts with the raw driver and bypasses defaults entirely (R7).
 *      Absent and unknown are different facts and must resolve differently.
 *
 *   3. assertGameEnabled MUST NEVER THROW. Next.js strips thrown error messages in
 *      production builds, so a throw reaches the player as "An error occurred in Server
 *      Components render" rather than a reason anybody can act on.
 */

const findOneMock = vi.fn();

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/database/models/whitelabel.model", () => ({
  WhiteLabel: {
    findOne: () => ({
      select: () => ({
        lean: findOneMock,
      }),
    }),
  },
}));

const {
  getGameModule,
  listGameModules,
  resolveGameType,
  getEnabledGameTypes,
  assertGameEnabled,
  TRADING_GAME_TYPE,
} = await import("@/lib/games");

beforeEach(() => {
  findOneMock.mockReset();
  findOneMock.mockResolvedValue({ enabledGameTypes: ["trading"] });
});

describe("resolving a module by game type", () => {
  it("resolves trading", () => {
    expect(getGameModule(TRADING_GAME_TYPE)?.label).toBe("Trading");
  });

  it("returns undefined for an unknown game type rather than falling back to trading", () => {
    expect(
      getGameModule("provider:acme:trivia-blitz"),
      "an unknown game type resolved to a module - if that module is trading, a provider contest will be settled by trading code and pay the wrong players silently",
    ).toBeUndefined();
  });

  it("registers exactly the modules that exist today", () => {
    // Reason: this is a tripwire, not a specification. The provider module arrives in X4
    // and this test should then be updated deliberately - which is the point, because
    // registering a module is the moment a whole game becomes reachable.
    expect(listGameModules().map((m) => m.type)).toEqual(["trading"]);
  });
});

describe("an absent game label means trading, an unknown one does not", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["empty string", ""],
    ["whitespace", "   "],
  ])("resolves %s to trading", (_label, value) => {
    expect(
      resolveGameType(value),
      "a contest with no game label must read as trading - invariant 5 covers pre-X1 documents and the Game Master raw-driver insert",
    ).toBe(TRADING_GAME_TYPE);
  });

  it("does not overwrite a real game type", () => {
    expect(resolveGameType("provider")).toBe("provider");
  });
});

describe("getEnabledGameTypes", () => {
  it("returns what the operator configured", async () => {
    findOneMock.mockResolvedValue({ enabledGameTypes: ["trading", "provider"] });
    expect(await getEnabledGameTypes()).toEqual(["trading", "provider"]);
  });

  it("treats an empty array as unconfigured rather than as everything disabled", async () => {
    // Reason: a misconfiguration that silently switches off every contest is worse than
    // one that leaves the platform in its pre-games state.
    findOneMock.mockResolvedValue({ enabledGameTypes: [] });
    expect(await getEnabledGameTypes()).toEqual(["trading"]);
  });

  it("falls back to trading when there are no settings at all", async () => {
    findOneMock.mockResolvedValue(null);
    expect(await getEnabledGameTypes()).toEqual(["trading"]);
  });

  it("falls back to trading when the settings read fails", async () => {
    // Reason: a settings outage must not take contests down with it.
    findOneMock.mockRejectedValue(new Error("connection lost"));
    expect(await getEnabledGameTypes()).toEqual(["trading"]);
  });
});

describe("assertGameEnabled returns a result and never throws", () => {
  it("allows an enabled game", async () => {
    const result = await assertGameEnabled("trading");

    expect(result.enabled).toBe(true);
    if (result.enabled) {
      expect(result.gameModule.type).toBe("trading");
    }
  });

  it("treats a missing label as trading", async () => {
    const result = await assertGameEnabled(undefined);
    expect(result.enabled).toBe(true);
  });

  it("refuses an unknown game type with a reason, and does not throw", async () => {
    const result = await assertGameEnabled("roulette");

    expect(result.enabled).toBe(false);
    if (!result.enabled) {
      expect(result.reason).toContain("roulette");
    }
  });

  it("refuses a known game that the operator has switched off", async () => {
    findOneMock.mockResolvedValue({ enabledGameTypes: ["provider"] });

    const result = await assertGameEnabled("trading");

    expect(result.enabled).toBe(false);
    if (!result.enabled) {
      expect(result.reason).toContain("Trading");
    }
  });

  it("does not throw even when the settings read fails", async () => {
    findOneMock.mockRejectedValue(new Error("connection lost"));

    await expect(assertGameEnabled("trading")).resolves.toMatchObject({
      enabled: true,
    });
  });
});

describe("the trading module declares capabilities instead of the engine special-casing it", () => {
  it("needs prices and market hours, and does not require synchronous play", () => {
    const trading = getGameModule(TRADING_GAME_TYPE);

    expect(trading?.capabilities.needsPriceFeed).toBe(true);
    // Reason: the market-hours gate is currently unconditional. Scoping it to this flag
    // is what stops it blocking a provider contest at the weekend.
    expect(trading?.capabilities.needsMarketHours).toBe(true);
    // Trading is an independent-play game: each trader plays their own account and all
    // are ranked together. That is about gameplay, not contest size.
    expect(trading?.capabilities.requiresSyncPlay).toBe(false);
    expect(trading?.capabilities.supportsChallenges).toBe(true);
  });
});
