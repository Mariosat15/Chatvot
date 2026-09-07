import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  resolveCreationLimits,
  checkGameMasterCanCreate,
  checkRouteCanCreateGameType,
  clampMinParticipants,
  MIN_CONTEST_PARTICIPANTS,
  ROUTE_CREATABLE_GAME_TYPES,
} from "@/lib/services/gamemaster/game-permissions";
import {
  DEFAULT_ALLOWED_GAME_TYPES,
  buildSubscriptionLimits,
} from "@/lib/services/gamemaster/subscription-limits";
import {
  validateLimitsUpdate,
  validateOverrideUpdate,
} from "../../apps/admin/lib/admin/gamemaster-limits-update";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** Strip comments before matching, so a file that DISCUSSES an anti-pattern is not flagged
 *  and a file whose only mention of the right thing is in prose does not pass. */
function code(path: string): string {
  return read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("resolveCreationLimits precedence", () => {
  it("an explicit admin deny beats a package that grants creation", () => {
    const limits = resolveCreationLimits({
      packageConfig: { canCreateCompetitions: true },
      override: "disabled",
    });

    expect(limits.canCreateCompetitions).toBe(false);
    expect(limits.creationDecidedBy).toBe("admin_override");
  });

  it("an explicit admin grant beats a package that withdraws creation", () => {
    const limits = resolveCreationLimits({
      packageConfig: { canCreateCompetitions: false },
      override: "enabled",
    });

    expect(limits.canCreateCompetitions).toBe(true);
    expect(limits.creationDecidedBy).toBe("admin_override");
  });

  it("the CURRENT package beats the subscription's cached limits", () => {
    // Reason this matters: the cached copy is written at purchase time, so a package edited
    // afterwards must win or an operator's change silently applies to nobody who already
    // owns it.
    const limits = resolveCreationLimits({
      limits: { canCreateCompetitions: true, maxCompetitionsPerDay: 99 },
      packageConfig: { canCreateCompetitions: false, maxCompetitionsPerDay: 3 },
    });

    expect(limits.canCreateCompetitions).toBe(false);
    expect(limits.maxCompetitionsPerDay).toBe(3);
    expect(limits.creationDecidedBy).toBe("current_package");
  });

  it("falls back to cached limits when the package is gone, and says so", () => {
    const limits = resolveCreationLimits({
      limits: { canCreateCompetitions: false, maxCompetitionsPerDay: 7 },
      packageConfig: null,
    });

    expect(limits.canCreateCompetitions).toBe(false);
    expect(limits.maxCompetitionsPerDay).toBe(7);
    expect(limits.creationDecidedBy).toBe("cached_limits");
  });

  it("reports `default` when nothing anywhere has an opinion", () => {
    // `default` is a different fact from "a package granted it", and it is the one an
    // operator should check before assuming a grant exists.
    const limits = resolveCreationLimits({});

    expect(limits.canCreateCompetitions).toBe(true);
    expect(limits.creationDecidedBy).toBe("default");
  });

  it("treats an absent flag as allowed but an explicit false as withdrawn", () => {
    expect(
      resolveCreationLimits({ packageConfig: { maxCompetitionsPerDay: 5 } })
        .canCreateCompetitions,
    ).toBe(true);
    expect(
      resolveCreationLimits({ packageConfig: { canCreateCompetitions: false } })
        .canCreateCompetitions,
    ).toBe(false);
  });

  it("applies overrideLimits only while the override is enabled", () => {
    const active = resolveCreationLimits({
      packageConfig: { maxCompetitionsPerDay: 3 },
      override: "enabled",
      overrideLimits: { maxCompetitionsPerDay: 25 },
    });
    expect(active.maxCompetitionsPerDay).toBe(25);

    // Reason: a stale cap left behind by a cleared override must not keep applying.
    const cleared = resolveCreationLimits({
      packageConfig: { maxCompetitionsPerDay: 3 },
      override: null,
      overrideLimits: { maxCompetitionsPerDay: 25 },
    });
    expect(cleared.maxCompetitionsPerDay).toBe(3);
  });

  it("keeps a configured 0% referral fee at 0 rather than falling through to 5", () => {
    // R31: `||` was the defect here and `Number.isFinite` is the fix, because these values
    // arrive from parseFloat on an admin form so NaN is one keystroke away.
    expect(
      resolveCreationLimits({ packageConfig: { referralFeePercentage: 0 } })
        .referralFeePercentage,
    ).toBe(0);
    expect(
      resolveCreationLimits({ limits: { referralFeePercentage: 0 } })
        .referralFeePercentage,
    ).toBe(0);
  });

  it("does not resurrect the cached rate when the LIVE package has none", () => {
    // This is the R31 read-side rule stated as a test, and my first version of it asserted
    // the opposite. When a package exists it is authoritative, so an absent or NaN rate on
    // it means "nothing configured" and the platform default applies. Falling back to
    // `subscription.limits` here would pay a rate captured at purchase time in preference
    // to the current package - which is the defect, not the fix.
    expect(
      resolveCreationLimits({
        packageConfig: { referralFeePercentage: Number.NaN },
        limits: { referralFeePercentage: 12 },
      }).referralFeePercentage,
    ).toBe(5);

    // The cache is consulted only when the package is genuinely gone.
    expect(
      resolveCreationLimits({
        packageConfig: null,
        limits: { referralFeePercentage: 12 },
      }).referralFeePercentage,
    ).toBe(12);
  });
});

describe("allowedGameTypes", () => {
  it("defaults to trading only, so widening is an explicit edit", () => {
    expect([...DEFAULT_ALLOWED_GAME_TYPES]).toEqual(["trading"]);
    expect([...resolveCreationLimits({}).allowedGameTypes]).toEqual(["trading"]);
  });

  it("treats an EMPTY stored array as the default, not as 'no games'", () => {
    // Reason: an empty array is what a bad edit or a partial migration leaves behind, and
    // reading it as "no games at all" locks every Game Master out of the thing they pay for.
    // Fail-closed here means falling back to trading, not refusing everything.
    expect([
      ...resolveCreationLimits({ limits: { allowedGameTypes: [] } })
        .allowedGameTypes,
    ]).toEqual(["trading"]);
  });

  it("an admin override does NOT widen which games may be created", () => {
    // The economic constraint in chapter 19 s5 is that a Game Master may not create
    // provider contests until the revenue share is computed on NET platform fee. An
    // operator enabling creation for one person has not decided anything about provider
    // pricing, so the override must not smuggle that through a switch labelled
    // "competition creation".
    const limits = resolveCreationLimits({
      override: "enabled",
      packageConfig: { allowedGameTypes: ["trading"] },
    });

    expect([...limits.allowedGameTypes]).toEqual(["trading"]);
  });

  it("refuses a game type the Game Master has not been granted", () => {
    const verdict = checkGameMasterCanCreate({
      limits: resolveCreationLimits({}),
      requestedGameType: "provider",
      competitionsCreatedToday: 0,
    });

    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe("game_not_permitted");
  });

  it("permits a granted game type", () => {
    const verdict = checkGameMasterCanCreate({
      limits: resolveCreationLimits({
        packageConfig: { allowedGameTypes: ["trading", "provider"] },
      }),
      requestedGameType: "provider",
      competitionsCreatedToday: 0,
    });

    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.gameType).toBe("provider");
  });

  it("buildSubscriptionLimits carries allowedGameTypes onto the cached copy", () => {
    const limits = buildSubscriptionLimits({
      maxCompetitionsPerDay: 4,
      maxUsersPerCompetition: 50,
      referralFeePercentage: 0,
      canCreateCompetitions: true,
      allowedGameTypes: ["trading", "provider"],
    });

    expect(limits.allowedGameTypes).toEqual(["trading", "provider"]);
    // R31 again, on the WRITE side: buying a 0% package must store 0%.
    expect(limits.referralFeePercentage).toBe(0);
  });
});

describe("the refusal message names the right cause", () => {
  it("blames the administrator when an override denied it, not the package", () => {
    // Reason: "your package does not allow competition creation" is unactionable when the
    // real cause is an explicit per-Game-Master deny, and it sends the Game Master to buy
    // an upgrade that cannot help.
    const verdict = checkGameMasterCanCreate({
      limits: resolveCreationLimits({
        packageConfig: { canCreateCompetitions: true },
        override: "disabled",
      }),
      requestedGameType: "trading",
      competitionsCreatedToday: 0,
    });

    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.message).toMatch(/administrator/i);
      expect(verdict.message).not.toMatch(/package/i);
    }
  });

  it("blames the package when the package denied it", () => {
    const verdict = checkGameMasterCanCreate({
      limits: resolveCreationLimits({
        packageConfig: { canCreateCompetitions: false },
      }),
      requestedGameType: "trading",
      competitionsCreatedToday: 0,
    });

    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.message).toMatch(/package/i);
  });
});

describe("daily limit", () => {
  it("refuses at the cap and permits below it", () => {
    const limits = resolveCreationLimits({
      packageConfig: { maxCompetitionsPerDay: 2 },
    });

    expect(
      checkGameMasterCanCreate({
        limits,
        requestedGameType: "trading",
        competitionsCreatedToday: 1,
      }).ok,
    ).toBe(true);

    const atCap = checkGameMasterCanCreate({
      limits,
      requestedGameType: "trading",
      competitionsCreatedToday: 2,
    });
    expect(atCap.ok).toBe(false);
    if (!atCap.ok) expect(atCap.reason).toBe("daily_limit_reached");
  });
});

describe("route capability", () => {
  it("refuses a game type the route cannot actually build", () => {
    // Reason this is separate from the permission check: if `allowedGameTypes` is widened
    // to "provider" before the route can build a provider contest, the route would stamp a
    // trading label on a contest the operator asked to be a game contest - a mislabelled
    // contest, and `gameKey` is immutable so it cannot be corrected in place.
    expect([...ROUTE_CREATABLE_GAME_TYPES]).toEqual(["trading"]);

    const refusal = checkRouteCanCreateGameType("provider");
    expect(refusal.ok).toBe(false);
    if (!refusal.ok) {
      // Names the missing capability rather than blaming the Game Master's permissions -
      // the two refusals have to be distinguishable or an operator who has just granted
      // `provider` cannot tell that granting it was necessary but not sufficient.
      expect(refusal.message).toMatch(/not available yet/i);
      expect(refusal.reason).toBe("game_not_supported_here");
    }

    expect(checkRouteCanCreateGameType("trading").ok).toBe(true);
  });
});

describe("minParticipants floor", () => {
  it("raises 1 and absent to 2, because no paid format is single-player", () => {
    expect(MIN_CONTEST_PARTICIPANTS).toBe(2);
    expect(clampMinParticipants(1)).toBe(2);
    expect(clampMinParticipants(0)).toBe(2);
    expect(clampMinParticipants(undefined)).toBe(2);
    expect(clampMinParticipants(Number.NaN)).toBe(2);
    expect(clampMinParticipants("1")).toBe(2);
  });

  it("leaves a legitimate higher value alone", () => {
    expect(clampMinParticipants(5)).toBe(5);
    expect(clampMinParticipants("8")).toBe(8);
  });
});

describe("update_limits is an allow-list, not a spread", () => {
  const stored = {
    maxCompetitionsPerDay: 3,
    maxUsersPerCompetition: 50,
    referralFeePercentage: 5,
    canCreateCompetitions: true,
    allowedGameTypes: ["trading"],
  };

  it("refuses an unknown field by NAME rather than dropping it", () => {
    // Reason refusing beats dropping: a dropped field means the edit appears to save while
    // doing nothing, and the operator concludes they misclicked.
    const result = validateLimitsUpdate(stored, { totalEarnings: 999999 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("totalEarnings");
  });

  it("refuses a prototype-chain key", () => {
    // A `Set` has no prototype chain, so the allow-list check is total. An object lookup
    // would admit "constructor" as truthy and fail later somewhere unrelated.
    for (const key of ["constructor", "__proto__", "toString"]) {
      const result = validateLimitsUpdate(stored, { [key]: 1 });
      expect(result.ok).toBe(false);
    }
  });

  it("refuses NaN on a numeric cap", () => {
    const result = validateLimitsUpdate(stored, {
      maxCompetitionsPerDay: Number.NaN,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a referral fee of exactly 0", () => {
    // R31: 0 is a legitimate configured rate and must survive validation.
    const result = validateLimitsUpdate(stored, { referralFeePercentage: 0 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.limits.referralFeePercentage).toBe(0);
  });

  it("refuses a participant cap below 2", () => {
    const result = validateLimitsUpdate(stored, { maxUsersPerCompetition: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/2/);
  });

  it("refuses an unknown game type", () => {
    const result = validateLimitsUpdate(stored, {
      allowedGameTypes: ["roulette"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("roulette");
  });

  it("accepts a known game type and preserves untouched fields", () => {
    const result = validateLimitsUpdate(stored, {
      allowedGameTypes: ["trading", "provider"],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.limits.allowedGameTypes).toEqual(["trading", "provider"]);
      // The merge must not lose the caps the operator did not touch.
      expect(result.limits.maxCompetitionsPerDay).toBe(3);
      expect(result.limits.referralFeePercentage).toBe(5);
    }
  });

  it("refuses an empty allowedGameTypes rather than storing a lockout", () => {
    const result = validateLimitsUpdate(stored, { allowedGameTypes: [] });
    expect(result.ok).toBe(false);
  });
});

describe("toggleCompetitionCreation", () => {
  it("accepts the three states and refuses anything else", () => {
    expect(validateOverrideUpdate({ override: "enabled" }).ok).toBe(true);
    expect(validateOverrideUpdate({ override: "disabled" }).ok).toBe(true);
    expect(validateOverrideUpdate({ override: null }).ok).toBe(true);

    expect(validateOverrideUpdate({ override: "ENABLED" }).ok).toBe(false);
    expect(validateOverrideUpdate({ override: true }).ok).toBe(false);
    expect(validateOverrideUpdate({}).ok).toBe(false);
  });

  it("discards overrideLimits when the override is not enabled", () => {
    const cleared = validateOverrideUpdate({
      override: null,
      overrideLimits: { maxCompetitionsPerDay: 40 },
    });

    expect(cleared.ok).toBe(true);
    // Reason: written as `{}` rather than left alone, so clearing an override and setting it
    // again later does not silently restore caps set weeks ago that nobody can see.
    if (cleared.ok) expect(cleared.overrideLimits).toEqual({});
  });

  it("refuses a participant override below 2", () => {
    const result = validateOverrideUpdate({
      override: "enabled",
      overrideLimits: { maxUsersPerCompetition: 1 },
    });
    expect(result.ok).toBe(false);
  });

  it("refuses an unknown override limit by name", () => {
    const result = validateOverrideUpdate({
      override: "enabled",
      overrideLimits: { referralFeePercentage: 90 },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("referralFeePercentage");
  });
});

describe("both creation routes decide with the shared gate", () => {
  const MAIN = "app/api/gamemaster/competitions/route.ts";
  const ADMIN = "apps/admin/app/api/gamemaster/competitions/route.ts";

  it.each([MAIN, ADMIN])("%s calls checkGameMasterCanCreate", (path) => {
    // Assert the CALL with its argument, not the identifier - an import alone keeps a bare
    // `toContain` green when the call has been replaced by a hand-rolled check.
    expect(code(path)).toMatch(/checkGameMasterCanCreate\s*\(\s*\{/);
  });

  it.each([MAIN, ADMIN])("%s resolves limits through the shared function", (path) => {
    expect(code(path)).toMatch(/resolveCreationLimits\s*\(\s*\{/);
  });

  it.each([MAIN, ADMIN])("%s checks the route can build the game type", (path) => {
    expect(code(path)).toMatch(/checkRouteCanCreateGameType\s*\(/);
  });

  it.each([MAIN, ADMIN])(
    "%s labels the contest with the game type the VERDICT approved",
    (path) => {
      // Reason this is asserted rather than assumed: labelling from the raw request while
      // checking permission against a resolved value lets the two disagree, and `gameKey`
      // is immutable so a mislabelled contest cannot be corrected in place.
      expect(code(path)).toMatch(/contestGameLabel\s*\(\s*verdict\.gameType/);
    },
  );

  it.each([MAIN, ADMIN])("%s enforces the participant floor", (path) => {
    const source = code(path);
    expect(
      /clampMinParticipants\s*\(/.test(source) ||
        /MIN_CONTEST_PARTICIPANTS/.test(source),
    ).toBe(true);
    // And no hand-written floor of 1 or bare `|| 2` left beside it.
    expect(source).not.toMatch(/minParticipants:\s*1\b/);
  });
});

describe("the admin gamemasters routes are authorized", () => {
  const files = [
    "apps/admin/app/api/gamemasters/route.ts",
    "apps/admin/app/api/gamemasters/[id]/route.ts",
    "apps/admin/app/api/gamemasters/sync-referrals/route.ts",
  ];

  it.each(files)("%s guards every exported handler", (path) => {
    // Reason this COUNTS rather than checking for a mention: a file whose GET is guarded
    // and whose PATCH is not passes any mention-based check while leaving the mutation
    // open. `sync-referrals` had two handlers and NO guard until 7 September 2026, and it
    // was found this way rather than by reading the routes.
    const source = code(path);
    const handlers = source.match(
      /export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)\b/g,
    );
    const guards = source.match(/requireSectionAccess\s*\(/g);

    expect(handlers?.length ?? 0).toBeGreaterThan(0);
    expect(guards?.length ?? 0).toBe(handlers?.length ?? 0);
  });

  it.each(files)("%s does not authenticate with a bare token check", (path) => {
    // `verifyAdminToken` is token validity, not section access: an employee granted one
    // unrelated section passes it. Sixth instance of that class in this programme.
    expect(code(path)).not.toMatch(/verifyAdminToken/);
  });
});

describe("the PATCH route does not mass-assign limits", () => {
  const ROUTE = "apps/admin/app/api/gamemasters/[id]/route.ts";

  it("routes update_limits through the validator", () => {
    // Added because a probe restoring the blind spread came back GREEN: this claim had no
    // test at all, and the probe had been aimed at the badge test, which the mutation left
    // satisfied. Third cause of a green probe after "weak test" and "wrong claim" - a
    // probe aimed at the wrong test is indistinguishable from a test that does not work.
    expect(code(ROUTE)).toMatch(/validateLimitsUpdate\s*\(\s*subscription\.limits/);
  });

  it("does not spread the caller's body onto the stored limits", () => {
    // The NEGATIVE half is load-bearing: calling the validator and then spreading anyway
    // passes the assertion above while leaving the hole open. And the hole mattered
    // because this route updates with the raw driver, so no Mongoose validation runs and
    // the schema's own bounds never applied on this path.
    const source = code(ROUTE);
    expect(source).not.toMatch(/\.\.\.subscription\.limits/);
    expect(source).not.toMatch(/limits:\s*\{[^}]*\.\.\.limits/);
  });

  it("implements toggleCompetitionCreation rather than answering 'Invalid action'", () => {
    const source = code(ROUTE);
    expect(source).toMatch(/case\s+"toggleCompetitionCreation"/);
    expect(source).toMatch(/validateOverrideUpdate\s*\(/);
    // Both fields written, so a cleared override cannot leave stale caps behind.
    expect(source).toMatch(/competitionCreationOverride:\s*validated\.override/);
    expect(source).toMatch(/overrideLimits:\s*validated\.overrideLimits/);
  });
});

describe("the creation badge reports a decision rather than making one", () => {
  const CONTROL =
    "apps/admin/components/admin/gamemaster/CompetitionCreationControl.tsx";
  const ROUTE = "apps/admin/app/api/gamemasters/[id]/route.ts";

  it("the route resolves the badge's answer with the same function as the gate", () => {
    // The badge used to read the cached `canCreateCompetitions` and say "Based on the
    // package settings", so an administrator's explicit deny rendered as a green
    // "Comps: ON" while every create attempt was refused.
    expect(code(ROUTE)).toMatch(/resolveCreationLimits\s*\(\s*\{/);
    expect(code(ROUTE)).toMatch(/competitionCreationOverride/);
  });

  it("the control does NOT re-derive precedence in the browser", () => {
    // The negative assertion is the load-bearing half: importing the resolved value is
    // trivially satisfied by a component that then works the answer out again itself, which
    // is a second copy of a precedence rule.
    const source = code(CONTROL);
    expect(source).not.toMatch(/resolveCreationLimits/);
    expect(source).not.toMatch(/packageConfig/);
    expect(source).toMatch(/creationDecidedBy/);
  });

  it("offers both override directions, not one toggle", () => {
    // An override that AGREES with the package is legitimate and useful, because it
    // survives the package being edited later. A single toggle can only express "the
    // opposite of what applies now", so it cannot set that.
    const source = code(CONTROL);
    expect(source).toMatch(/"enabled"/);
    expect(source).toMatch(/"disabled"/);
    expect(source).toMatch(/send\(\s*"clear"\s*,\s*null\s*\)/);
  });

  it("shows the granted games beside the switch", () => {
    // Creation being allowed and creation being POSSIBLE are different facts: a Game
    // Master with creation ON and only trading granted still cannot create a game contest.
    expect(code(CONTROL)).toMatch(/allowedGameTypes/);
  });
});

describe("the gate is mirrored and stays model-free", () => {
  const MAIN = "lib/services/gamemaster/game-permissions.ts";
  const ADMIN = "apps/admin/lib/services/gamemaster/game-permissions.ts";

  it("both copies exist and agree", () => {
    // `check:mirrors` compares MODELS, so it has no opinion about this file. Two copies of
    // a permission rule that disagree would make what a Game Master may create depend on
    // which app answered - the "one rule, two copies" shape behind several defects here.
    expect(read(ADMIN).replace(/\r\n/g, "\n")).toBe(
      read(MAIN).replace(/\r\n/g, "\n"),
    );
  });

  it.each([MAIN, ADMIN])("%s imports no model", (path) => {
    // It has to be importable from a raw-driver route and from a client-adjacent context,
    // and invariant 2 bans model imports from this layer.
    const source = code(path);
    expect(source).not.toMatch(/from\s+["']@?\/?.*database\/models/);
    expect(source).not.toMatch(/mongoose/i);
  });
});
