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
import { requestedPlayMode } from "@/lib/services/game-providers/provider-contest.service";

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

describe("the play style default (owner, 2 Oct 2026)", () => {
  const BOTH_STYLES = { playMode: "anytime", supportedPlayModes: ["anytime", "scheduled"] };
  const ANYTIME_ONLY = { playMode: "anytime" };

  it("is a games-only choice between the two styles", () => {
    const option = optionsForGame("provider").find((o) => o.key === "playMode");
    expect(option?.kind).toBe("choice");
    expect(option?.kind === "choice" && option.choices.map((c) => c.value)).toEqual([
      "anytime",
      "scheduled",
    ]);
    expect(optionsForGame("trading").some((o) => o.key === "playMode")).toBe(false);
  });

  it("reports which options carry the admin's value rather than the Game Master's", () => {
    const filled = applyGameMasterCompetitionDefaults({}, shipped(), "provider");
    expect(filled.ok && filled.adminFilled).toContain("playMode");
    const chosen = applyGameMasterCompetitionDefaults(
      { playMode: "scheduled" },
      shipped(),
      "provider",
    );
    expect(chosen.ok && chosen.adminFilled).not.toContain("playMode");
    const locked = applyGameMasterCompetitionDefaults(
      { playMode: "anytime" },
      withEntry("playMode", "scheduled", false),
      "provider",
    );
    expect(locked.ok && locked.body.playMode).toBe("scheduled");
    expect(locked.ok && locked.adminFilled).toContain("playMode");
  });

  it("an admin preference a game cannot use falls back to the game's own style", () => {
    expect(
      requestedPlayMode({ playMode: "scheduled", playModeIsPreference: true }, ANYTIME_ONLY),
    ).toBeUndefined();
    expect(
      requestedPlayMode({ playMode: "scheduled", playModeIsPreference: true }, BOTH_STYLES),
    ).toBe("scheduled");
    // A real choice is passed through so the create service can refuse it with a reason.
    expect(requestedPlayMode({ playMode: "scheduled" }, ANYTIME_ONLY)).toBe("scheduled");
  });

  it("the Game Master routes pass the admin-filled list to the create service", () => {
    for (const route of [
      "app/api/gamemaster/competitions/route.ts",
      "apps/admin/app/api/gamemaster/competitions/route.ts",
    ]) {
      expect(stripComments(read(route)), route).toContain(
        "adminFilled: withDefaults.adminFilled",
      );
    }
    const service = stripComments(read("lib/services/gamemaster/create-provider-competition.ts"));
    expect(service).toMatch(/playModeIsPreference:\s*args\.adminFilled\?\.includes\("playMode"\)/);
  });

  it("the game form hides the picker when the admin locks the style", () => {
    const form = stripComments(read("components/gamemaster/ProviderContestCreateForm.tsx"));
    expect(form).toMatch(/canPickMode = title\.supportedPlayModes\.length > 1 && !playModeLocked/);
    expect(form).toMatch(/playModeLocked = defaults\.isLocked\("playMode"\)/);
  });
});

// Reason: these lived under Competitions -> Settings until 2 Oct 2026, when the owner asked
// for every Game Master setting on one screen. Flipped rather than deleted: the grant rule
// (the defaults tab only with `gm-competition-defaults`, because its route refuses without
// it) is unchanged and only the location moved.
describe("the admin finds the defaults under Manage Game Masters -> Settings", () => {
  const dashboard = read("apps/admin/components/admin/AdminDashboard.tsx");
  const competitions = read("apps/admin/components/admin/competitions/CompetitionsAdminSection.tsx");
  const program = read("apps/admin/components/admin/GameMasterProgramSection.tsx");
  const panel = read("apps/admin/components/admin/gamemaster/GmSettingsPanel.tsx");

  it("has no sidebar entry of its own any more", () => {
    expect(dashboard).not.toContain('id: "gm-competition-defaults"');
  });

  it("Competitions no longer carries the defaults", () => {
    expect(competitions).not.toContain("GameMasterCompetitionDefaultsSection");
  });

  it("Manage Game Masters gets the defaults grant and a Settings tab", () => {
    expect(dashboard).toMatch(
      /<GameMasterProgramSection[\s\S]{0,300}canEditDefaults=\{hasAccess\("gm-competition-defaults"\)\}/,
    );
    expect(program).toContain('{ id: "settings", label: "Settings" }');
    expect(program).toContain("<GmSettingsPanel canEditDefaults={canEditDefaults} />");
  });

  it("the defaults render only with their own grant, below the programme switches", () => {
    expect(panel).toMatch(/canEditDefaults \? \(\s*<GameMasterCompetitionDefaultsSection \/>/);
    const switches = panel.indexOf("<GmProgramSwitches />");
    const defaults = panel.indexOf("<GameMasterCompetitionDefaultsSection />");
    expect(switches).toBeGreaterThan(-1);
    expect(defaults).toBeGreaterThan(switches);
  });

  it("the old deep link still opens the defaults", () => {
    expect(dashboard).toMatch(
      /case "gm-competition-defaults":\s*return <GameMasterCompetitionDefaultsSection/,
    );
  });
});