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

    // X5 registered the provider module, so this flipped from unknown_game to
    // no_settle_path exactly as the earlier version of this test predicted it would. That
    // flip IS the assertion that the module is registered - it cannot pass by accident,
    // because the only way to reach no_settle_path is for the registry to return a module
    // whose type is not trading.
    //
    // The refusal itself is still correct and must stay. A provider contest must never run
    // down the trading settlement path; it gets its own, and until that exists refusing is
    // the safe answer. Do not "fix" this to ok: true.
    const provider = routeToTradingSettlement("provider", "c");
    expect(provider.ok).toBe(false);
    if (!provider.ok) {
      expect(provider.reason).toBe("no_settle_path");
      expect(provider.error).toContain("Provider game");
    }
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
    /*
      Reason: a path that claims the contest by setting status to "finalizing" and then
      refuses without restoring "active" strands it permanently - no later attempt can
      claim it, and it never pays out at all. That is a worse outcome than the bug being
      guarded against.

      TWO SPELLINGS ARE ACCEPTED, and widening this on 9 September 2026 was deliberate
      rather than a concession. The assertion used to demand the literal `status:
      "active"` inside the refusal block, which is one correct implementation - the main
      app's inline `findOneAndUpdate` - and it failed on the other: the admin app releases
      through a named `releaseFinalizationLock` helper, because it has to release from
      three places including the outer catch, and three inline copies of a lock release is
      the "one rule, three copies" shape. A structural test that permits only the
      implementation that existed when it was written stops being a guard and becomes a
      freeze on the file's shape.

      THE HELPER SPELLING IS NOT THE WEAKER ONE, because the second assertion below
      demands more of it than this one can demand of an inline write.
    */
    for (const file of FINALIZE_FILES) {
      const source = sourceOf(file);
      if (!source.includes("lockResult")) continue;

      const refusalBlock = source
        .slice(
          source.indexOf("const settlementRoute = routeToTradingSettlement("),
        )
        .slice(0, 900);

      const releasesInline = refusalBlock.includes('status: "active"');
      // Matches the CALL with its argument, not the bare name: the name alone appears in
      // the function's own declaration and in comments about it.
      const releasesViaHelper = /releaseFinalizationLock\(\s*competitionId/.test(
        refusalBlock,
      );

      expect(
        releasesInline || releasesViaHelper,
        `${file} refuses after taking the lock without handing it back - neither an inline 'status: "active"' write nor a releaseFinalizationLock(competitionId) call appears in the refusal block, so the contest is stranded at "finalizing" and nobody is ever paid`,
      ).toBe(true);
    }
  });

  it("filters a lock release on the claimed status, so it cannot demote a settled contest", () => {
    /*
      The filter is the safety and it is invisible from the call site. An unconditional
      write back to "active" is correct on the refusal paths and CATASTROPHIC on a throw
      arriving after the transaction has committed: it would move a `completed` contest
      back to `active`, and the next cron pass would finalize and pay it a second time -
      a lock release turning into the exact double payment the lock exists to prevent.

      Asserted on the release WRITE rather than on the presence of a helper, so it covers
      both spellings accepted above.
    */
    for (const file of FINALIZE_FILES) {
      const source = sourceOf(file);
      if (!source.includes("lockResult")) continue;

      const releaseWrites = [
        ...source.matchAll(/\{\s*\$set:\s*\{\s*status:\s*"active"/g),
      ];
      if (releaseWrites.length === 0) continue;

      for (const write of releaseWrites) {
        // The filter is the argument BEFORE the update, so look back from the write to
        // the start of the call. Bounded by the call's own opening rather than by a
        // character count, which is how an earlier guard in this repository came to
        // start mid-identifier and report a present guard as missing.
        const callStart = source.lastIndexOf("findOneAndUpdate(", write.index);
        expect(
          callStart,
          `${file} writes status back to "active" outside a findOneAndUpdate, so it cannot be conditional on the contest still being claimed`,
        ).toBeGreaterThan(-1);

        expect(
          source.slice(callStart, write.index),
          `${file} releases the lock WITHOUT filtering on status: "finalizing" - a throw arriving after the commit would demote a completed contest back to active and it would be finalized and paid twice`,
        ).toContain('status: "finalizing"');
      }
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
