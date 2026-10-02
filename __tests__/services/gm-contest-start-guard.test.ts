import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  gameMasterScheduleError,
  START_IN_PAST_TOLERANCE_MS,
} from "@/lib/services/gamemaster/contest-start-guard";

/**
 * Owner, 2 Oct 2026: a Game Master must not be able to create a contest that starts before
 * the current server time, and public/private plus the play mode belong in the provider
 * wizard's own Creation Progress steps rather than a strip above it.
 */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const NOW = new Date("2026-10-02T12:00:00Z");
const at = (iso: string) => new Date(iso);

describe("gameMasterScheduleError", () => {
  it("accepts a future start with a later end", () => {
    expect(gameMasterScheduleError(at("2026-10-02T13:00:00Z"), at("2026-10-02T14:00:00Z"), NOW)).toBeNull();
  });

  it("refuses a start before the server time, naming the reason", () => {
    expect(
      gameMasterScheduleError(at("2026-10-01T13:00:00Z"), at("2026-10-03T14:00:00Z"), NOW),
    ).toMatch(/already passed/);
  });

  it("allows only the server's tolerance, and the form none", () => {
    const slightlyPast = at("2026-10-02T11:59:30Z");
    const end = at("2026-10-02T14:00:00Z");
    expect(gameMasterScheduleError(slightlyPast, end, NOW)).toMatch(/already passed/);
    expect(gameMasterScheduleError(slightlyPast, end, NOW, START_IN_PAST_TOLERANCE_MS)).toBeNull();
    const wellPast = at("2026-10-02T11:58:00Z");
    expect(gameMasterScheduleError(wellPast, end, NOW, START_IN_PAST_TOLERANCE_MS)).toMatch(
      /already passed/,
    );
  });

  it("refuses an end at or before the start", () => {
    const start = at("2026-10-02T13:00:00Z");
    expect(gameMasterScheduleError(start, start, NOW)).toMatch(/end must be after/i);
    expect(gameMasterScheduleError(start, at("2026-10-02T12:30:00Z"), NOW)).toMatch(
      /end must be after/i,
    );
  });

  it("refuses an unparseable or missing date rather than treating it as fine", () => {
    for (const bad of [null, undefined, new Date("not a date")]) {
      expect(gameMasterScheduleError(bad, at("2026-10-02T14:00:00Z"), NOW)).toMatch(/valid/);
      expect(gameMasterScheduleError(at("2026-10-02T13:00:00Z"), bad, NOW)).toMatch(/valid/);
    }
  });
});

describe("every Game Master writer asks the guard", () => {
  it("the guard and the provider create service are byte-identical in both apps", () => {
    for (const file of ["contest-start-guard.ts", "create-provider-competition.ts"]) {
      expect(read(`apps/admin/lib/services/gamemaster/${file}`), file).toBe(
        read(`lib/services/gamemaster/${file}`),
      );
    }
  });

  it("the provider create service refuses before writing", () => {
    const source = code("lib/services/gamemaster/create-provider-competition.ts");
    const guard = source.search(
      /gameMasterScheduleError\(\s*startTime,\s*endTime,\s*new Date\(\),\s*START_IN_PAST_TOLERANCE_MS,?\s*\)/,
    );
    const write = source.indexOf("createAndPublishProviderContest(", source.indexOf("export"));
    expect(guard).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(write);
    // A call whose answer is ignored refuses nothing.
    expect(source.slice(guard, write)).toMatch(/if \(scheduleError\) return \{ ok: false, error: scheduleError \}/);
  });

  it.each([
    "app/api/gamemaster/competitions/route.ts",
    "apps/admin/app/api/gamemaster/competitions/route.ts",
  ])("%s refuses a past trading start before inserting", (file) => {
    const source = code(file);
    const tradingStart = source.indexOf("Missing required fields");
    const guard = source.indexOf("gameMasterScheduleError(", tradingStart);
    expect(tradingStart).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(tradingStart);
    expect(source.slice(guard, guard + 300)).toMatch(/START_IN_PAST_TOLERANCE_MS/);
    expect(guard).toBeLessThan(source.indexOf("insertOne(", tradingStart));
  });

  it("the wizard's schedule step uses the guard with no tolerance", () => {
    const form = code("components/gamemaster/ProviderContestCreateForm.tsx");
    const match = form.match(/gameMasterScheduleError\(([\s\S]*?)\);/);
    expect(match?.[1] ?? "").toMatch(/new Date\(\),?\s*$/);
  });

  it("the calendar greys out past days on both halves", () => {
    const utc = code("components/gamemaster/UtcScheduleFields.tsx");
    expect(utc).toMatch(/min=\{minDate\}/);
    expect(utc.match(/minDate=\{todayUtc\}/g) ?? []).toHaveLength(2);
    expect(utc).toMatch(/startInPast \?/);
  });
});

describe("Access & Mode is a step of the provider wizard", () => {
  const form = code("components/gamemaster/ProviderContestCreateForm.tsx");
  const gate = code("components/gamemaster/CreateCompetitionGate.tsx");
  const step = code("components/gamemaster/AccessAndModeStep.tsx");
  const settings = code("components/gamemaster/provider-contest-wizard-steps.tsx");

  it("is listed in the Creation Progress steps, second", () => {
    expect(form).toMatch(/number: 2, title: "Access & Mode"/);
    expect(form).toMatch(/number: 6, title: "Launch"/);
    expect(form).toMatch(/<AccessAndModeStep/);
  });

  it("holds the visibility choice and the play mode; Game Settings no longer does", () => {
    expect(step).toMatch(/VISIBILITY_OPTION_COPY/);
    expect(step).toMatch(/How players join/);
    expect(step).toMatch(/PLAY_MODE_COPY/);
    const gameSettings = settings.slice(
      settings.indexOf("export function GameSettingsStep"),
      settings.indexOf("export function ScheduleStep"),
    );
    expect(gameSettings.length).toBeGreaterThan(50);
    expect(gameSettings).not.toMatch(/How players join|onPlayMode|canPickMode/);
  });

  it("offers exactly the server's creatable list and never re-derives the rule", () => {
    expect(step).not.toMatch(/checkVisibilityAllowed|allowedVisibility|gmPrivateContestsEnabled/);
    expect(form).toMatch(/visibilityOptions\.includes\(visibility\)/);
  });

  it("the provider path no longer renders the strip above the wizard; trading still does", () => {
    const provider = gate.slice(gate.indexOf('selection?.type === "provider"'));
    const trading = gate.slice(
      gate.indexOf('selection?.type === "trading"'),
      gate.indexOf('selection?.type === "provider"'),
    );
    expect(provider).not.toMatch(/\{visibilityPicker\}/);
    expect(provider).toMatch(/visibilityOptions=\{visibilityOptions\}/);
    expect(provider).toMatch(/onVisibilityChange=\{setVisibility\}/);
    expect(trading).toMatch(/\{visibilityPicker\}/);
  });

  it("Launch re-validates every earlier step, including Access & Mode", () => {
    expect(form).toMatch(/for \(let n = 1; n < LAST_STEP; n\+\+\)/);
    expect(form).toMatch(/const LAST_STEP = STEPS\.length/);
  });
});
