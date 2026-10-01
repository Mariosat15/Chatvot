/**
 * The Game Master contest wizard offers the same round rules as the admin wizard (28 Sep 2026).
 *
 * Owner report: the GM wizard "must share the same settings for games ... the race must have
 * the button and functions that fix the times and also the type of game". It hard-coded one
 * attempt, a 900-second grace and no timing check, so a race too short for one run could be
 * created from the GM screen and a 20-minute game was refused by the pre-flight on a grace
 * period nobody could see.
 *
 * The rules now come from one shared, model-free module (`round-fit.ts`) and one forcing table
 * (`playShapeRules`), so the two wizards cannot tell two creators different things.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  deriveResultGraceSeconds,
  describeRoundFit,
  endTimeThatFits,
} from "../../lib/services/games/round-fit";
import { RESULT_GRACE_MARGIN_SECONDS } from "../../lib/services/games/contest-preflight";
import type { ConfigField } from "../../lib/services/games/config-schema";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
function code(path: string): string {
  return read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const FORM = "components/gamemaster/ProviderContestCreateForm.tsx";
const STEPS = "components/gamemaster/provider-contest-wizard-steps.tsx";
const RULES = "components/gamemaster/use-provider-contest-rules.ts";
const CONTROLS = "components/gamemaster/ProviderRoundControls.tsx";
const SETTINGS = "components/challenges/ChallengeSettingsFields.tsx";

describe("round-fit.ts is one rule shared by both apps", () => {
  it("the admin mirror is byte-identical", () => {
    expect(read("apps/admin/lib/services/games/round-fit.ts").replace(/\r\n/g, "\n")).toBe(
      read("lib/services/games/round-fit.ts").replace(/\r\n/g, "\n"),
    );
  });

  it("the GM schedule fields re-export the shared converter rather than keeping a copy", () => {
    const utc = code("components/gamemaster/UtcScheduleFields.tsx");
    expect(utc).toMatch(/export \{ utcDraftToIso \} from "@\/lib\/services\/games\/round-fit"/);
    expect(utc).not.toMatch(/export function utcDraftToIso/);
  });

  it("stays model-free (R58): only relative imports of sibling pure modules", () => {
    const src = code("lib/services/games/round-fit.ts");
    const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    for (const spec of imports) expect(spec.startsWith("./")).toBe(true);
    expect(src).not.toMatch(/mongoose|database\/models/);
  });
});

describe("the fit arithmetic behaves the same for any game", () => {
  const clock: ConfigField[] = [
    { name: "raceSeconds", type: "integer", label: "Race", format: "duration-seconds" } as ConfigField,
  ];

  it("flags a contest shorter than one attempt, and the fix lands past it", () => {
    const fit = describeRoundFit({
      startTime: "2026-10-01T12:00",
      endTime: "2026-10-01T12:05",
      schemaFields: clock,
      settings: { raceSeconds: 600 },
    });
    expect(fit?.windowTooShort).toBe(true);
    const fixed = endTimeThatFits("2026-10-01T12:00", 600);
    expect(fixed).toBe("2026-10-01T12:11");
    const after = describeRoundFit({
      startTime: "2026-10-01T12:00",
      endTime: fixed!,
      schemaFields: clock,
      settings: { raceSeconds: 600 },
    });
    expect(after?.windowTooShort).toBe(false);
  });

  it("the grace only ever raises the floor, to cover the playing time", () => {
    expect(deriveResultGraceSeconds(900, undefined)).toBe(900);
    expect(deriveResultGraceSeconds(900, 60)).toBe(900);
    expect(deriveResultGraceSeconds(900, 1200)).toBe(1200 + RESULT_GRACE_MARGIN_SECONDS);
  });
});

describe("the GM wizard offers the admin wizard's round rules", () => {
  it("the POST sends the rules object, never hard-coded attempts or a literal grace", () => {
    const form = code(FORM);
    const body = form.match(/JSON\.stringify\(\{([\s\S]*?)\}\)/)?.[1] ?? "";
    expect(body.length).toBeGreaterThan(0);
    expect(body).toMatch(/\.\.\.rules\.requestFields/);
    expect(body).not.toMatch(/attemptsPolicy:\s*["']single["']/);
    expect(body).not.toMatch(/resultGracePeriodSeconds:\s*\d/);
  });

  it("the grace is derived from the playing time through the shared helper", () => {
    const rules = code(RULES);
    expect(rules).toMatch(/deriveResultGraceSeconds\(\s*GM_RESULT_GRACE_FLOOR_SECONDS,\s*attemptSeconds/);
    expect(rules).toMatch(/resultGracePeriodSeconds,/);
  });

  it("choosing a play style applies the shape's forced values, as the admin wizard does", () => {
    const rules = code(RULES);
    const select = rules.slice(rules.indexOf("function selectPlayMode"), rules.indexOf("function setAttemptsPolicy"));
    expect(select.length).toBeGreaterThan(0);
    expect(select).toMatch(/forcedAttemptsPolicy \?\? "single"/);
    expect(select).toMatch(/forcedRoundStartPolicy \?\?/);
    expect(select).toMatch(/clampGmRoundStartPolicy/);
    expect(code(FORM)).toMatch(/onPlayMode=\{rules\.selectPlayMode\}/);
  });

  it("passes the title's supportedPlayModes into the rules hook so admin settings gate the dropdown", () => {
    const form = code(FORM);
    expect(form).toMatch(/supportedPlayModes:\s*title\.supportedPlayModes/);
    expect(code(RULES)).toMatch(/gmAllowedRoundStartPolicies\(input\.supportedPlayModes\)/);
  });

  it("the last-attempt dropdown is built from allowedRoundStartPolicies, never the full list", () => {
    const controls = code(CONTROLS);
    expect(controls).toMatch(/rules\.allowedRoundStartPolicies\.map/);
    expect(controls).not.toMatch(/ROUND_START_POLICIES\.map/);
    expect(controls).toMatch(/allowedRoundStartPolicies\.length <= 1/);
  });

  it("a refusing fit blocks the schedule step, and only where the server refuses", () => {
    const rules = code(RULES);
    expect(rules).toMatch(
      /fit\?\.windowTooShort && \(fit\.reservesFullRound \|\| playMode === "scheduled"\)/,
    );
    const form = code(FORM);
    const step3 = form.slice(form.indexOf("if (n === 3)"), form.indexOf("if (n === 4"));
    expect(step3.length).toBeGreaterThan(0);
    expect(step3).toMatch(/rules\.scheduleError\(\)/);
  });

  it("the schedule step renders the fit note with the one-click fix and the policy fields", () => {
    const steps = code(STEPS);
    expect(steps).toMatch(/<ProviderRoundFitNote[^>]*onFitContest=\{onEnd\}/);
    expect(steps).toMatch(/<ProviderRoundPolicyFields/);
    expect(steps).toMatch(/startLabel=\{rules\.shape\.copy\.startLabel\}/);
    expect(steps).toMatch(/endHint=\{rules\.shape\.copy\.endHint\}/);
    const controls = code(CONTROLS);
    expect(controls).toMatch(/endTimeThatFits\(startTime, fit\.reservedSeconds\)/);
    expect(controls).toMatch(/long enough \(\{reserved\} \+ 1 min\)/);
  });

  it("controls the shape forces are withheld with the shape's own reason", () => {
    const controls = code(CONTROLS);
    expect(controls).toMatch(/shape\.requiresSingleAttempt \?[\s\S]*?shape\.copy\.attemptsWithheld/);
    expect(controls).toMatch(/shape\.offersRoundStartPolicy \?[\s\S]*?shape\.copy\.roundStartWithheld/);
  });

  it("no game is named anywhere in the new controls", () => {
    for (const path of [RULES, CONTROLS, STEPS, FORM]) {
      expect(code(path)).not.toMatch(/circuit-|volt-|gameCode\s*===|providerKey\s*===/);
    }
  });
});

describe("a competition does not honour challenge-only pinned values", () => {
  it("the settings component skips challengeValue outside a challenge", () => {
    const src = code(SETTINGS);
    expect(src).toMatch(/const honoursChallengeValues = context === "challenge"/);
    expect(src).toMatch(/honoursChallengeValues && field\.challengeValue !== undefined/);
    expect(src).toMatch(/context = "challenge"/);
  });

  it("the GM game settings step passes the competition context", () => {
    expect(code(STEPS)).toMatch(/<ChallengeSettingsFields[\s\S]*?context="competition"/);
  });
});
