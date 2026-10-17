import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkVisibilityAllowed,
  parseAllowedVisibilityInput,
} from "@/lib/services/gamemaster/visibility-permission";

/**
 * Gamemaster Program v2, step 5 (`External game plans/24` s10): which visibility a Game
 * Master's package allows them to CREATE, and that every writer and screen asks one rule.
 */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const base = { hasPackage: true, privateContestsEnabled: true };

describe("checkVisibilityAllowed", () => {
  it("a blank request means public, and public is the default grant", () => {
    for (const requested of [undefined, null, "", "  "]) {
      const v = checkVisibilityAllowed({ ...base, requested, hasPackage: false });
      expect(v).toMatchObject({ ok: true, visibility: "public", decidedBy: "default" });
    }
  });

  it("refuses an unknown requested value rather than guessing either way", () => {
    for (const requested of ["private", "friends_only", 1, ["gm_private"]]) {
      const v = checkVisibilityAllowed({ ...base, requested, packageAllowed: ["public", "gm_private"] });
      expect(v.ok).toBe(false);
      expect(v.reason).toBe("visibility_unknown");
    }
  });

  it("refuses private while the platform switch is off, even on a permitting package", () => {
    const v = checkVisibilityAllowed({
      ...base,
      requested: "gm_private",
      packageAllowed: ["public", "gm_private"],
      privateContestsEnabled: false,
    });
    expect(v).toMatchObject({ ok: false, reason: "private_contests_disabled" });
  });

  it("the switch gates private only - public still creates with it off", () => {
    const v = checkVisibilityAllowed({ ...base, requested: "public", privateContestsEnabled: false });
    expect(v.ok).toBe(true);
  });

  it("refuses private on a package that does not grant it", () => {
    const v = checkVisibilityAllowed({ ...base, requested: "gm_private", packageAllowed: ["public"] });
    expect(v).toMatchObject({ ok: false, reason: "visibility_not_permitted", decidedBy: "current_package" });
  });

  it("the CURRENT package beats the cached limits, in both directions", () => {
    // Reason: the two sources must disagree or the test cannot tell which one was read.
    expect(
      checkVisibilityAllowed({
        ...base, requested: "gm_private", packageAllowed: ["public"], cachedAllowed: ["public", "gm_private"],
      }).ok,
    ).toBe(false);
    expect(
      checkVisibilityAllowed({
        ...base, requested: "gm_private", packageAllowed: ["public", "gm_private"], cachedAllowed: ["public"],
      }).ok,
    ).toBe(true);
  });

  it("a deleted package falls back to the cached limits", () => {
    const v = checkVisibilityAllowed({
      ...base, hasPackage: false, requested: "gm_private", cachedAllowed: ["public", "gm_private"],
    });
    expect(v).toMatchObject({ ok: true, decidedBy: "cached_limits", visibility: "gm_private" });
  });

  it("no source at all means public only", () => {
    const v = checkVisibilityAllowed({ ...base, hasPackage: false, requested: "gm_private" });
    expect(v).toMatchObject({ ok: false, reason: "visibility_not_permitted", decidedBy: "default" });
  });
});

describe("parseAllowedVisibilityInput (the package editor)", () => {
  it("refuses an empty or non-array list", () => {
    for (const value of [[], undefined, "public", null]) {
      expect(parseAllowedVisibilityInput(value).ok).toBe(false);
    }
  });
  it("refuses an unknown value", () => {
    expect(parseAllowedVisibilityInput(["public", "friends_only"]).ok).toBe(false);
  });
  it("normalises order so a re-save is not a change", () => {
    expect(parseAllowedVisibilityInput(["gm_private", "public"])).toEqual({
      ok: true,
      value: ["public", "gm_private"],
    });
  });
});

describe("both creation routes ask the rule and stamp its answer", () => {
  const routes = [
    ["app/api/gamemaster/competitions/route.ts", "createGameMasterProviderCompetition({"],
    ["apps/admin/app/api/gamemaster/competitions/route.ts", "createGameMasterProviderCompetition({"],
  ] as const;

  it.each(routes)("%s gates before the provider branch and before the insert", (file, providerCall) => {
    const source = code(file);
    const gate = source.indexOf("const visibilityVerdict = checkVisibilityAllowed(");
    const refusal = source.indexOf("if (!visibilityVerdict.ok)");
    const provider = source.indexOf(providerCall);
    // Reason: the trading insert moved into insertGameMasterCompetition (Free Private, 2 Oct
    // 2026) so the reserve can share its transaction; the gate must still precede it.
    const insert = source.indexOf("insertGameMasterCompetition(db");
    expect(gate).toBeGreaterThan(-1);
    expect(refusal).toBeGreaterThan(gate);
    expect(provider).toBeGreaterThan(refusal);
    expect(insert).toBeGreaterThan(refusal);
  });

  it.each(routes)("%s reads the requested value from the body, never a default", (file) => {
    expect(code(file)).toMatch(/checkVisibilityAllowed\(\{\s*requested:\s*body\.visibility,/);
  });

  it.each(routes)("%s stamps the verdict on BOTH the provider call and the trading insert", (file) => {
    const source = code(file);
    const matches = source.match(/visibility:\s*visibilityVerdict\.visibility/g) ?? [];
    // Reason: a third use feeds the Free Private funding gate (2 Oct 2026), which must
    // refuse a funded contest that is not private. The two stamps are still asserted.
    expect(matches).toHaveLength(3);
    const funding = source.indexOf("checkRouteFunding({");
    expect(funding).toBeGreaterThan(-1);
    expect(source.slice(funding, funding + 200)).toMatch(/visibility:\s*visibilityVerdict\.visibility/);
  });

  it("the shared provider writer stores what it is handed", () => {
    for (const file of [
      "lib/services/gamemaster/create-provider-competition.ts",
      "apps/admin/lib/services/gamemaster/create-provider-competition.ts",
    ]) {
      expect(code(file)).toMatch(/visibility,/);
    }
    expect(code("lib/services/game-providers/provider-contest.service.ts")).toMatch(
      /visibility:\s*input\.visibility\s*\?\?\s*"public"/,
    );
  });
});

describe("the form offers exactly what the POST accepts", () => {
  it.each([
    "app/api/gamemaster/creation-options/route.ts",
    "app/api/gamemaster/competitions/route.ts",
  ])("%s computes creatableVisibilities through the gate", (file) => {
    expect(code(file)).toMatch(
      /creatableVisibilities\s*=\s*COMPETITION_VISIBILITIES\.filter\(\s*\(requested\)\s*=>\s*checkVisibilityAllowed\(/,
    );
  });

  it("the gate hands the chosen visibility to BOTH create forms", () => {
    const matches = code("components/gamemaster/CreateCompetitionGate.tsx").match(
      /visibility=\{visibility\}/g,
    ) ?? [];
    expect(matches).toHaveLength(2);
  });

  it.each([
    "components/gamemaster/ProviderContestCreateForm.tsx",
    "app/(root)/gamemaster/create-competition/page-content.tsx",
  ])("%s sends visibility in its POST body", (file) => {
    expect(code(file)).toMatch(/JSON\.stringify\(\{[\s\S]*?\bvisibility,/);
  });

  it("the picker hides itself when public is the only option and never re-derives the rule", () => {
    const source = code("components/gamemaster/ContestVisibilityPicker.tsx");
    expect(source).toMatch(/options\.length === 1 && options\[0\] === "public"/);
    expect(source).not.toMatch(/checkVisibilityAllowed|allowedVisibility|gmPrivateContestsEnabled/);
    expect(source).toMatch(/new Map/);
  });
});

describe("the admin package editor and the program switch", () => {
  const marketplace = code("apps/admin/app/api/marketplace/route.ts");

  it("validates the visibility list before the write, on both create and update", () => {
    const parses = marketplace.match(/parseAllowedVisibilityInput\(/g) ?? [];
    expect(parses).toHaveLength(2);
    expect(marketplace.indexOf("parseAllowedVisibilityInput(updates.")).toBeLessThan(
      marketplace.indexOf("MarketplaceItem.findByIdAndUpdate("),
    );
  });

  it("syncs the cached limits and names the change in the audit entry", () => {
    expect(marketplace).toMatch(/limitsUpdate\["limits\.allowedVisibility"\]\s*=\s*gmConfig\.allowedVisibility/);
    expect(marketplace).toMatch(/allowedVisibility:\s*visibilityChange/);
  });

  it("the program settings allow-list names the private switch", () => {
    expect(code("apps/admin/app/api/gamemasters/program-settings/route.ts")).toMatch(
      /new Set\(\[\s*"gmJoinEnabled",\s*"gmPrivateContestsEnabled",\s*"gmFreePrivateContestsEnabled",\s*\]\)/,
    );
  });
});

describe("mirrored non-model files are byte-identical", () => {
  it.each([
    "lib/services/gamemaster/visibility-permission.ts",
    "lib/services/gamemaster/gm-program-flags.ts",
  ])("%s matches its admin copy", (file) => {
    expect(read(`apps/admin/${file}`)).toBe(read(file));
  });
});
