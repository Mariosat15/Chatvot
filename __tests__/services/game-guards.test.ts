import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { contestGameLabel, gameNeedsMarketHours } from "@/lib/games";

/**
 * X1 step 6: the three guards that stop the engine quietly assuming trading.
 *
 * Each one protects a failure that reports success while doing the wrong thing, which is
 * the recurring shape of every defect this programme has found:
 *
 *   R7  - a contest written by the raw MongoDB driver gets no Mongoose defaults, so it
 *         carries no game label. Nothing breaks today, because an absent label reads as
 *         trading (invariant 5). It breaks the day something GROUPS by `gameKey` and the
 *         row silently drops out of a total - long after the commit that caused it, and
 *         unfixable in place, because `gameKey` is immutable once written.
 *
 *   Inv 1 - the engine deep-importing a game folder. The import works, the tests pass,
 *         and the next game silently fails to appear wherever the shortcut was taken.
 *
 *   Ch11 s7 - the market-hours gate applied unconditionally. A provider contest is
 *         refused every weekend for a reason that has nothing to do with it.
 */

function sourceOf(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

/** Every writer that inserts a contest with the raw driver, bypassing Mongoose defaults. */
const RAW_CONTEST_WRITERS = [
  "app/api/gamemaster/competitions/route.ts",
  "apps/admin/app/api/gamemaster/competitions/route.ts",
  "apps/admin/app/api/admin/trading-tests/run/route.ts",
  "apps/admin/app/api/admin/end-logic-tests/run/route.ts",
];

describe("R7: every raw-driver contest insert stamps the game label", () => {
  it.each(RAW_CONTEST_WRITERS)("%s spreads contestGameLabel()", (file) => {
    const source = sourceOf(file);
    expect(source).toMatch(/\.\.\.contestGameLabel\(\)/);
  });

  it.each(RAW_CONTEST_WRITERS)("%s imports it rather than inlining literals", (file) => {
    const source = sourceOf(file);
    expect(source).toMatch(/import \{[^}]*contestGameLabel[^}]*\} from/);
  });

  it("stamps every raw insertOne into competitions or challenges", () => {
    // Reason: counts the label against the INSERTS rather than trusting the file list
    // above to stay complete. A new raw writer added to one of these files turns this
    // red; a list-only test would stay green and the new contest would be unlabelled.
    for (const file of RAW_CONTEST_WRITERS) {
      const source = sourceOf(file);
      const inserts = source.match(
        /\.collection\(\s*["'](?:competitions|challenges)["']\s*\)\s*\.insertOne|(?:competitions|challenges)Collection\.insertOne/g,
      );
      const labels = source.match(/\.\.\.contestGameLabel\(\)/g);
      expect(labels?.length ?? 0).toBe(inserts?.length ?? 0);
    }
  });
});

describe("contestGameLabel fills both fields, never one", () => {
  it("defaults to trading for both", () => {
    expect(contestGameLabel()).toEqual({
      gameType: "trading",
      gameKey: "trading",
    });
  });

  it("mirrors gameType into gameKey when no key is given", () => {
    // Reason: setting gameType and forgetting gameKey is invisible - the contest settles,
    // every current query matches it, and it only disappears once something groups by key.
    expect(contestGameLabel("provider")).toEqual({
      gameType: "provider",
      gameKey: "provider",
    });
  });

  it("keeps a distinct key, which is how one module backs many catalogue entries", () => {
    expect(contestGameLabel("provider", "chess-blitz")).toEqual({
      gameType: "provider",
      gameKey: "chess-blitz",
    });
  });

  it.each([
    ["empty string", ""],
    ["whitespace", "   "],
    ["null", null],
    ["undefined", undefined],
  ])("treats a %s game type as trading, never as an empty label", (_label, value) => {
    expect(contestGameLabel(value)).toEqual({
      gameType: "trading",
      gameKey: "trading",
    });
  });

  it("treats a blank key as absent rather than storing whitespace", () => {
    expect(contestGameLabel("provider", "   ").gameKey).toBe("provider");
  });
});

describe("invariant 1 is enforced by config, not by good intentions", () => {
  const eslintConfig = sourceOf("eslint.config.mjs");

  it("configures no-restricted-imports", () => {
    expect(eslintConfig).toMatch(/"no-restricted-imports":\s*\["error"/);
  });

  it("blocks game folders by default rather than listing them", () => {
    // Reason: the pattern must be a wildcard. Naming "trading" would mean every future
    // game is unprotected until someone remembers to add it here - and forgetting is
    // silent, which is the whole failure mode the rule exists to prevent.
    expect(eslintConfig).toMatch(/"\*\*\/games\/\*"/);
    expect(eslintConfig).toMatch(/"\*\*\/games\/\*\/\*\*"/);
    expect(eslintConfig).not.toMatch(/"\*\*\/games\/trading/);
  });

  it("allows the public surface back through", () => {
    for (const allowed of ["index", "registry", "types", "settlement"]) {
      expect(eslintConfig).toContain(`"!**/games/${allowed}"`);
    }
  });

  it("exempts the games layer itself, which is where modules are wired", () => {
    expect(eslintConfig).toMatch(/files:\s*\["lib\/games\/\*\*",\s*"apps\/admin\/lib\/games\/\*\*"\]/);
  });

  it("enforces invariant 2 one level below, on the module folders only", () => {
    // Reason: the scope is the whole trick. `lib/games/*/**` matches a module folder but
    // not the layer's own public files - `lib/games/index.ts` legitimately reads
    // WhiteLabel for getEnabledGameTypes and must keep being allowed to. A rule written
    // as `lib/games/**` would ban that and look correct doing it.
    expect(eslintConfig).toMatch(/files:\s*\["lib\/games\/\*\/\*\*",\s*"apps\/admin\/lib\/games\/\*\/\*\*"\]/);
    expect(eslintConfig).toContain('"**/database/models/**"');
    expect(eslintConfig).toContain("Invariant 2:");
  });

  it("invariant 2 sits after the invariant 1 exemption, or it never applies", () => {
    // Reason: flat config is last-one-wins per rule, and the exemption above switches
    // no-restricted-imports OFF for all of lib/games/**. Ordered the other way the
    // invariant 2 block is silently dead - the config still parses and still reads right.
    const exemption = eslintConfig.indexOf('files: ["lib/games/**", "apps/admin/lib/games/**"]');
    const invariant2 = eslintConfig.indexOf('files: ["lib/games/*/**", "apps/admin/lib/games/*/**"]');
    expect(exemption).toBeGreaterThan(-1);
    expect(invariant2).toBeGreaterThan(exemption);
  });

  it("no game module imports a contest model", () => {
    for (const file of [
      "lib/games/trading/index.ts",
      "lib/games/trading/config.ts",
      "lib/games/trading/scoring.ts",
      "apps/admin/lib/games/trading/index.ts",
      "apps/admin/lib/games/trading/config.ts",
      "apps/admin/lib/games/trading/scoring.ts",
    ]) {
      expect(sourceOf(file)).not.toMatch(/from\s+["'][^"']*database\/(models|mongoose)/);
    }
  });

  it("no engine file deep-imports a game folder", () => {
    // A cheap second net. ESLint is the real guard, but this fails in the test run too,
    // so a contributor who has not wired up the editor plugin still finds out.
    const offenders: string[] = [];
    for (const file of [
      "lib/services/competition-ranking.service.ts",
      "apps/admin/lib/services/competition-ranking.service.ts",
      "lib/actions/trading/competition-end.actions.ts",
      "lib/actions/trading/challenge-finalize.actions.ts",
      "apps/admin/lib/actions/trading/competition-end.actions.ts",
      "apps/admin/lib/actions/trading/challenge-finalize.actions.ts",
    ]) {
      if (/from\s+["'][^"']*games\/trading/.test(sourceOf(file))) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("the market-hours gate is scoped to the game, and fails closed", () => {
  it("applies to trading", () => {
    expect(gameNeedsMarketHours("trading")).toBe(true);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["empty string", ""],
  ])("applies when the label is %s, because that means trading", (_l, value) => {
    expect(gameNeedsMarketHours(value)).toBe(true);
  });

  it("applies to an UNKNOWN game type", () => {
    // Reason: fails closed on purpose. The two mistakes are not symmetric - wrongly
    // applying the gate refuses a contest visibly and someone complains; wrongly skipping
    // it lets real money trade against a closed market on stale prices.
    expect(gameNeedsMarketHours("not-a-registered-game")).toBe(true);
  });

  it("reads the flag off the module rather than hard-coding a game list", async () => {
    const { getGameModuleOrTrading } = await import("@/lib/games");
    const trading = getGameModuleOrTrading("trading");
    expect(trading?.capabilities.needsMarketHours).toBe(true);
    // The gate must agree with the module, not with a literal beside it.
    expect(gameNeedsMarketHours("trading")).toBe(
      trading?.capabilities.needsMarketHours,
    );
  });
});

describe("the cross-game gates ask the capability before refusing", () => {
  it.each([
    ["challenge create", "app/api/challenges/route.ts"],
    ["challenge accept", "app/api/challenges/[id]/accept/route.ts"],
  ])("%s gates its market check on gameNeedsMarketHours", (_name, file) => {
    const source = sourceOf(file);
    expect(source).toMatch(/if\s*\([^)]*gameNeedsMarketHours\(/);
  });

  it("admin competition create has NO market-hours refusal at all", () => {
    // Reason: owner decision, 4 Sep 2026. Creating a competition is scheduling one, not
    // playing it - refusing an operator who sets up Monday's contest on a Sunday was a
    // live usability defect, and it extends the 1 Sep decision that joining outside
    // market hours is allowed and only trading itself is gated.
    //
    // This asserts ABSENCE rather than a capability check, because scoping the gate to
    // the game would have left it refusing trading competitions at the weekend - correct
    // for games, still wrong for operators. The helper was deleted with it: a dead guard
    // makes reintroducing the defect look like using an existing API, the same reasoning
    // that deleted `shouldBlockEntry` in prerequisite B.
    const source = sourceOf("apps/admin/lib/actions/trading/competition.actions.ts");
    expect(source).not.toMatch(/Cannot create competition: Forex market/);
    expect(source).not.toMatch(/assertForexMarketOpenForCreate/);
  });

  it("but keeps the market-HOLIDAY warning, which informs rather than refuses", () => {
    const source = sourceOf("apps/admin/lib/actions/trading/competition.actions.ts");
    expect(source).toMatch(/market holiday/i);
  });

  it("the two apps now agree on competition creation", () => {
    // Reason: the main app never had this check. The asymmetry was accidental, and a
    // reviewer finding it in one app could reasonably "restore" it to the other.
    for (const file of [
      "lib/actions/trading/competition.actions.ts",
      "apps/admin/lib/actions/trading/competition.actions.ts",
    ]) {
      expect(sourceOf(file)).not.toMatch(/Cannot create competition: Forex market/);
    }
  });

  it("challenge accept reads the game off the stored challenge, not a default", () => {
    // Reason: on accept the contest already exists, so its own label is the only correct
    // source. Falling back to a default here would apply trading's gate to a provider
    // challenge, which is the exact bug this step removes.
    const source = sourceOf("app/api/challenges/[id]/accept/route.ts");
    expect(source).toMatch(/gameNeedsMarketHours\(\s*challenge\.gameType\s*\)/);
  });

  it("challenge accept gates AFTER loading the challenge and BEFORE the wallet read", () => {
    // Reason: it must come after the lookup to know the game at all, and before any
    // wallet read so a refusal cannot leave one of the two debits applied - the ordering
    // rule established for checkAccountStanding in sub-defect 1b.
    const source = sourceOf("app/api/challenges/[id]/accept/route.ts");
    const load = source.indexOf("Challenge.findById(id)");
    const gate = source.indexOf("gameNeedsMarketHours(challenge.gameType)");
    const wallet = source.indexOf("CreditWallet.findOne");
    expect(load).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(load);
    expect(wallet).toBeGreaterThan(gate);
  });

  it("the create path does not take the game type from caller input", () => {
    // Reason: a client-supplied game type would be a way to skip the market gate on a
    // trading challenge by claiming to be a different game.
    const source = sourceOf("app/api/challenges/route.ts");
    expect(source).not.toMatch(/gameNeedsMarketHours\(\s*(?:body|req|data)\./);
    expect(source).toMatch(/gameNeedsMarketHours\(gameLabel\.gameType\)/);
  });
});
