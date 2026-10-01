/**
 * Game Master competition defaults: the admin sets a value for each competition option and
 * says whether a Game Master may change it.
 *
 * Three properties are pinned here:
 * 1. A LOCKED option always carries the admin's value, whatever the Game Master sent.
 * 2. An OPEN option is validated and refused when wrong - never clamped.
 * 3. The Game Master's forms hide every locked option they render (display only - the server
 *    enforces property 1 whatever the form sends).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  COMPETITION_DEFAULT_OPTIONS,
  optionsForGame,
} from "@/lib/services/gamemaster/competition-defaults";
import {
  applyGameMasterCompetitionDefaults,
  gameMasterDefaultsView,
  resolveCompetitionDefaults,
  validateCompetitionDefaultsInput,
} from "@/lib/services/gamemaster/competition-defaults-apply";
import {
  NO_GAME_MASTER_DEFAULTS,
  readGameMasterDefaults,
} from "@/components/gamemaster/competition-defaults-lookup";

const ROOT = resolve(__dirname, "..", "..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const shipped = () => resolveCompetitionDefaults([]);
const withEntry = (key: string, value: unknown, gmMayChange: boolean) =>
  shipped().map((entry) => (entry.key === key ? { key, value, gmMayChange } : entry));

describe("the shared files are mirrored byte for byte", () => {
  it.each([
    "competition-defaults.ts",
    "competition-defaults-apply.ts",
    "competition-defaults.service.ts",
  ])("%s", (file) => {
    // Reason: check:mirrors compares models only. A drifted admin copy would let the admin
    // save a default the player app's create route then refuses.
    expect(read(`apps/admin/lib/services/gamemaster/${file}`)).toBe(
      read(`lib/services/gamemaster/${file}`),
    );
  });
});

describe("resolveCompetitionDefaults", () => {
  it("an unconfigured option is open and carries the shipped default", () => {
    const resolved = shipped();
    expect(resolved).toHaveLength(COMPETITION_DEFAULT_OPTIONS.length);
    for (const entry of resolved) {
      expect(entry.gmMayChange).toBe(true);
    }
    expect(resolved.find((entry) => entry.key === "entryFee")?.value).toBe(10);
  });

  it("an invalid stored value falls back to the shipped default but keeps the lock", () => {
    const resolved = resolveCompetitionDefaults([
      { key: "entryFee", value: -5, gmMayChange: false },
    ]);
    const fee = resolved.find((entry) => entry.key === "entryFee");
    expect(fee).toEqual({ key: "entryFee", value: 10, gmMayChange: false });
  });

  it("a retired key is ignored rather than refused", () => {
    expect(() =>
      resolveCompetitionDefaults([{ key: "noLongerExists", value: 1, gmMayChange: false }]),
    ).not.toThrow();
  });
});

describe("validateCompetitionDefaultsInput (the admin save)", () => {
  it("refuses an unknown option, a missing lock flag and an out-of-range value", () => {
    const result = validateCompetitionDefaultsInput([
      { key: "constructor", value: 1, gmMayChange: true },
      { key: "entryFee", value: 10 },
      { key: "leverage", value: 9999, gmMayChange: false },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0]).toMatch(/Unknown option/);
  });

  it("refuses a prize split that does not total 100% or skips a place", () => {
    const short = validateCompetitionDefaultsInput([
      {
        key: "prizeDistribution",
        value: [{ rank: 1, percentage: 60 }, { rank: 2, percentage: 30 }],
        gmMayChange: false,
      },
    ]);
    const gap = validateCompetitionDefaultsInput([
      {
        key: "prizeDistribution",
        value: [{ rank: 1, percentage: 70 }, { rank: 3, percentage: 30 }],
        gmMayChange: false,
      },
    ]);
    expect(short.ok).toBe(false);
    expect(gap.ok).toBe(false);
  });
});

describe("applyGameMasterCompetitionDefaults (the create routes)", () => {
  it("a LOCKED option is overwritten with the admin's value whatever was sent", () => {
    const result = applyGameMasterCompetitionDefaults(
      { entryFee: 999, leverage: 1 },
      withEntry("entryFee", 25, false),
      "trading",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.entryFee).toBe(25);
    expect(result.body.leverage).toBe(1);
  });

  it("a locked nested option is written at its path", () => {
    const result = applyGameMasterCompetitionDefaults(
      { rules: { rankingMethod: "win_rate" } },
      withEntry("rankingMethod", "pnl", false),
      "trading",
    );
    expect(result.ok && result.body.rules).toMatchObject({ rankingMethod: "pnl" });
  });

  it("an OPEN option that is missing is filled with the admin's value", () => {
    const result = applyGameMasterCompetitionDefaults(
      {},
      withEntry("maxParticipants", 80, true),
      "trading",
    );
    expect(result.ok && result.body.maxParticipants).toBe(80);
  });

  it("an OPEN option with a wrong value is refused naming it, never clamped", () => {
    const result = applyGameMasterCompetitionDefaults({ leverage: 9999 }, shipped(), "trading");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toMatch(/Leverage/i);
  });

  it("refuses a minimum above the maximum", () => {
    const result = applyGameMasterCompetitionDefaults(
      { minParticipants: 40, maxParticipants: 10 },
      shipped(),
      "trading",
    );
    expect(result.ok).toBe(false);
  });

  it("applies only the options of the requested game", () => {
    const result = applyGameMasterCompetitionDefaults({}, shipped(), "provider");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).not.toHaveProperty("leverage");
    expect(result.body.unscoredContestPolicy).toBe("unclaimed_pool");
    expect(result.body.tieRule).toBe("fastest_wins");
  });

  it("never edits the request in place", () => {
    const body = { entryFee: 999 };
    applyGameMasterCompetitionDefaults(body, withEntry("entryFee", 25, false), "trading");
    expect(body.entryFee).toBe(999);
  });

  it("the form's view for a game carries exactly that game's options", () => {
    const keys = gameMasterDefaultsView(shipped(), "provider").map((entry) => entry.key);
    expect(keys).toEqual(optionsForGame("provider").map((option) => option.key));
  });
});

describe("readGameMasterDefaults (the form's lookup)", () => {
  it("reports a locked option and its value", () => {
    const lookup = readGameMasterDefaults(withEntry("entryFee", 25, false));
    expect(lookup.isLocked("entryFee")).toBe(true);
    expect(lookup.valueOf("entryFee", 1)).toBe(25);
    expect(lookup.isLocked("leverage")).toBe(false);
  });

  it("an invalid value reads as the shipped default, as the server does", () => {
    const lookup = readGameMasterDefaults([
      { key: "entryFee", value: "lots", gmMayChange: false },
    ]);
    expect(lookup.valueOf("entryFee", 1)).toBe(10);
  });

  it("a malformed response locks nothing and uses the form's own fallback", () => {
    for (const raw of [null, undefined, "x", { entryFee: 5 }]) {
      const lookup = readGameMasterDefaults(raw);
      expect(lookup.isLocked("entryFee")).toBe(false);
      expect(lookup.valueOf("entryFee", 7)).toBe(7);
    }
    expect(NO_GAME_MASTER_DEFAULTS.isLocked("entryFee")).toBe(false);
  });

  it("a prototype key is not a configured option", () => {
    const lookup = readGameMasterDefaults([
      { key: "constructor", value: 1, gmMayChange: false },
      { key: "__proto__", value: 1, gmMayChange: false },
    ]);
    expect(lookup.isLocked("constructor")).toBe(false);
    expect(lookup.valueOf("__proto__", "fallback")).toBe("fallback");
  });

  it("hands out a copy, so a form editing it cannot change the next read", () => {
    const lookup = readGameMasterDefaults(shipped());
    const prizes = lookup.valueOf<{ percentage: number }[]>("prizeDistribution", []);
    prizes[0].percentage = 1;
    expect(lookup.valueOf<{ percentage: number }[]>("prizeDistribution", [])[0].percentage).not.toBe(1);
  });
});

describe("the server applies the defaults before it reads the body", () => {
  it.each([
    "app/api/gamemaster/competitions/route.ts",
    "apps/admin/app/api/gamemaster/competitions/route.ts",
  ])("%s", (file) => {
    const code = stripComments(read(file));
    const applied = code.indexOf("applyGameMasterCompetitionDefaults(");
    const firstRead = code.search(/const\s*\{\s*name\s*,/);
    expect(applied).toBeGreaterThan(-1);
    expect(firstRead).toBeGreaterThan(-1);
    expect(applied).toBeLessThan(firstRead);
  });

  it("creation-options sends both games' defaults to the forms", () => {
    const code = stripComments(read("app/api/gamemaster/creation-options/route.ts"));
    expect(code).toMatch(/gameMasterDefaultsView\(\s*competitionDefaults\s*,\s*"trading"\s*\)/);
    expect(code).toMatch(/gameMasterDefaultsView\(\s*competitionDefaults\s*,\s*"provider"\s*\)/);
  });
});

describe("the Game Master forms hide locked options", () => {
  it("the trading form gates every option it renders", () => {
    const code = stripComments(read("app/(root)/gamemaster/create-competition/page-content.tsx"));
    for (const key of [
      "entryFee",
      "startingCapital",
      "minParticipants",
      "maxParticipants",
      "assetClasses",
      "riskLimitsEnabled",
      "maxDrawdownPercent",
      "dailyLossLimitPercent",
      "prizeDistribution",
      "rankingMethod",
      "tieBreaker1",
      "minimumTrades",
      "disqualifyOnLiquidation",
      "difficultyMode",
      "difficultyLevel",
      "levelRequirementEnabled",
      "minLevel",
    ]) {
      expect(code, key).toContain(`locked("${key}")`);
    }
    expect(code).toMatch(/\{!leverageLocked && \(/);
  });

  it("the game form gates every option it renders", () => {
    const steps = stripComments(read("components/gamemaster/provider-contest-wizard-steps.tsx"));
    for (const key of ["entryFee", "maxParticipants", "tieRule"]) {
      expect(steps, key).toContain(`{!defaults.isLocked("${key}") && (`);
    }
    expect(steps).toMatch(/defaults\.isLocked\("prizeDistribution"\)/);
    const rounds = stripComments(read("components/gamemaster/ProviderRoundControls.tsx"));
    expect(rounds).toMatch(/\{!rules\.attemptsPolicyLocked && \(/);
    expect(rounds).toMatch(/!rules\.attemptsAllowedLocked/);
  });

  it("the game form sends the admin's policies rather than hard-coded ones", () => {
    // Reason: the form used to send "score_zero" and "unclaimed_pool" as literals, which an
    // admin change of default would never reach.
    const form = stripComments(read("components/gamemaster/ProviderContestCreateForm.tsx"));
    expect(form).toMatch(/valueOf<UnresolvedRoundPolicy>\(\s*"unresolvedRoundPolicy"/);
    expect(form).toMatch(/valueOf<UnscoredContestPolicy>\(\s*"unscoredContestPolicy"/);
    expect(form).not.toMatch(/unresolvedRoundPolicy:\s*"/);
    expect(form).not.toMatch(/unscoredContestPolicy:\s*"/);
  });
});

describe("the admin finds the defaults under Competitions -> Settings", () => {
  const dashboard = read("apps/admin/components/admin/AdminDashboard.tsx");
  const section = read("apps/admin/components/admin/competitions/CompetitionsAdminSection.tsx");

  it("has no sidebar entry of its own any more", () => {
    expect(dashboard).not.toContain('id: "gm-competition-defaults"');
  });

  it("the Competitions item renders the tabbed page, gated on the defaults grant", () => {
    expect(dashboard).toMatch(
      /case "competitions":\s*return \(\s*<CompetitionsAdminSection[\s\S]{0,120}canEditSettings=\{hasAccess\("gm-competition-defaults"\)\}/,
    );
  });

  it("each tab is shown only with its own grant", () => {
    expect(section).toContain('(requested === "settings" && canEditSettings)');
    expect(section).toContain('(requested === "list" && canViewList)');
    expect(section).toContain("<GameMasterCompetitionDefaultsSection />");
  });
});