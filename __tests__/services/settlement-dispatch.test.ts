import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { routeToTradingSettlement } from "@/lib/games/settlement";

/**
 * X1 seam 3: the game dispatch inside finalization.
 *
 * Chapter 11 section 2 calls this the highest-risk change in the programme (risk R3), and
 * the failure mode is the reason: a provider contest settled by trading code reads every
 * score as zero, ties the whole field at rank 1, and pays prizes to players who did not
 * win - with no error and no log line. **Silently.**
 *
 * The entry points were re-measured on 4 Sep 2026 and there are TEN in the main app, not
 * the five the plan listed. One of them is a page component. So the dispatch is not at the
 * call sites; it is inside the four finalize functions, two per app, which makes every
 * caller correct by construction including the ones nobody has written yet.
 *
 * Two kinds of test below, and both are needed:
 *   - the router's own behaviour, which is pure and cheap to pin exhaustively;
 *   - a STRUCTURAL check that all four functions actually call it. That is the invariant
 *     that matters, because the catastrophic case is not a wrong answer from the router,
 *     it is one finalize path that never asks.
 */

const FINALIZE_FILES = [
  "lib/actions/trading/competition-end.actions.ts",
  "lib/actions/trading/challenge-finalize.actions.ts",
  "apps/admin/lib/actions/trading/competition-end.actions.ts",
  "apps/admin/lib/actions/trading/challenge-finalize.actions.ts",
];

function sourceOf(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("a trading contest settles through the trading path", () => {
  it("allows an explicit trading label", () => {
    expect(routeToTradingSettlement("trading", "competition x").ok).toBe(true);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["empty string", ""],
  ])("allows %s, because an absent label means trading", (_name, value) => {
    // Reason: invariant 5. Contests written before X1 carry no label, and the Game Master
    // route inserts with the raw MongoDB driver, bypassing the schema default (R7).
    // Refusing these would stop every historical competition from ever finalizing.
    expect(routeToTradingSettlement(value, "competition x").ok).toBe(true);
  });
});

describe("a non-trading contest is refused, not mis-settled", () => {
  it("refuses an unknown game type and says why", () => {
    const route = routeToTradingSettlement("roulette", "competition x");

    expect(route.ok).toBe(false);
    if (!route.ok) {
      expect(route.reason).toBe("unknown_game");
      expect(route.error).toContain("roulette");
      // The message must say what it refused to do, not just that it failed.
      expect(route.error).toContain("competition x");
    }
  });

  it("distinguishes an unregistered game from a registered non-trading one", () => {
    // Reason: the two demand different responses. `unknown_game` means the data or the
    // registry is wrong and somebody must look. `no_settle_path` is the NORMAL state for
    // a provider contest until X5 exists, and must not be read as corruption.
    const unknown = routeToTradingSettlement("roulette", "c");
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.reason).toBe("unknown_game");

    // "provider" has no module registered until X4, so today it is also unknown. When the
    // provider module lands, this must flip to no_settle_path - and that change is the
    // signal that X4 actually registered it.
    const provider = routeToTradingSettlement("provider", "c");
    expect(provider.ok).toBe(false);
  });

  it("returns a result object and never throws", () => {
    // Reason: Next.js strips thrown error messages in production builds, so a throw would
    // reach the operator as "An error occurred in Server Components render".
    expect(() => routeToTradingSettlement("roulette", "c")).not.toThrow();
  });

  it("does not consult whether the game is enabled", () => {
    // Reason: a contest players PAID to enter must finish and pay out even if an operator
    // disables the game while it is running. Chapter 18 s6: let running contests finish,
    // or cancel with full refunds - never strand a paid entry. If this function ever
    // needs a database, that rule has been broken.
    const source = sourceOf("lib/games/settlement.ts");
    expect(source).not.toContain("getEnabledGameTypes");
    expect(source).not.toContain("assertGameEnabled");
    expect(source).not.toMatch(/from "\.\/index"/);
  });
});

describe("every finalize function asks before settling", () => {
  it.each(FINALIZE_FILES)("%s dispatches on the game label", (file) => {
    const source = sourceOf(file);

    // Reason: matches a CALL, not a mention. Probing this by deleting the gate while
    // leaving the import in place showed that asserting on the bare name passes with no
    // gate present at all - the import alone satisfied it.
    expect(
      source,
      `${file} never calls the settlement router, so it will settle a provider contest as trading and pay the wrong players silently`,
    ).toMatch(/routeToTradingSettlement\(/);
  });

  it.each(FINALIZE_FILES)(
    "%s gates BEFORE it starts closing positions",
    (file) => {
      const source = sourceOf(file);
      const gateAt = source.indexOf("routeToTradingSettlement(");
      const settleAt = source.search(
        /Clos(e|ing) all open positions|STEP 1: Close/i,
      );

      expect(gateAt, `${file} has no gate at all`).toBeGreaterThan(-1);

      // Reason: order is the point. A gate placed after the position-closing block would
      // refuse the contest having already mutated it, which is worse than not gating -
      // the contest is then half-settled and the refusal looks like a transient failure.
      if (settleAt > -1) {
        expect(
          gateAt,
          `${file} closes positions before checking which game it is`,
        ).toBeLessThan(settleAt);
      }
    },
  );

  it("releases the optimistic lock when it refuses", () => {
    // Reason: three of the four paths claim the contest by setting status to
    // "finalizing" before this check can run in the private attempt function. Refusing
    // without restoring "active" strands the contest permanently - no later attempt can
    // claim it, and it never pays out at all. That is a worse outcome than the bug being
    // guarded against.
    for (const file of FINALIZE_FILES) {
      const source = sourceOf(file);
      if (!source.includes("lockResult")) continue;

      const refusalBlock = source.slice(
        source.indexOf("const settlementRoute = routeToTradingSettlement("),
      );
      expect(
        refusalBlock.slice(0, 900),
        `${file} refuses after taking the lock without setting status back to "active"`,
      ).toContain('status: "active"');
    }
  });
});

describe("the two apps stay in step", () => {
  it("lib/games is byte-identical in both apps", () => {
    // Reason: check:mirrors covers database models only, so nothing else would notice
    // these two copies diverging - and they both settle money.
    for (const file of [
      "games/settlement.ts",
      "games/registry.ts",
      "games/types.ts",
      "games/index.ts",
      "games/trading/index.ts",
      "games/trading/config.ts",
      "games/trading/scoring.ts",
    ]) {
      expect(
        sourceOf(`apps/admin/lib/${file}`),
        `apps/admin/lib/${file} has drifted from lib/${file}`,
      ).toBe(sourceOf(`lib/${file}`));
    }
  });

  it("both ranking services dispatch through the registry", () => {
    for (const file of [
      "lib/services/competition-ranking.service.ts",
      "apps/admin/lib/services/competition-ranking.service.ts",
    ]) {
      const source = sourceOf(file);

      expect(source, `${file} does not use the registry`).toContain(
        "getGameModuleOrTrading",
      );
      // Invariant 1: the engine must never import a specific game folder.
      expect(
        source,
        `${file} imports a game folder directly, which stops that game being replaceable`,
      ).not.toMatch(/from "@\/lib\/games\/trading/);
    }
  });
});
