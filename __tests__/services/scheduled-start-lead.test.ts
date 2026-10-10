import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MIN_SCHEDULED_START_LEAD_SECONDS,
  scheduledStartTooSoon,
} from "@/lib/services/games/scheduled-start";

/**
 * A TOGETHER-START RACE MUST GO LIVE BEFORE ITS OWN START.
 *
 * Reason this file exists: the owner created a scheduled Volt Velocity competition, two players
 * joined, and the first press of Play said "Already started". Nothing was wrong at play time -
 * `startHasPassed` refuses a new round after the gun by design, and only a player already in the
 * lobby races. The fault was upstream: create, publish and edit never compared the start with the
 * clock, so a contest could go live with its gun already behind it and be unplayable by anyone.
 */

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const NOW = new Date("2026-09-28T09:40:00.000Z");
const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

describe("scheduledStartTooSoon", () => {
  it("refuses a scheduled contest whose start has already passed", () => {
    const message = scheduledStartTooSoon({ playMode: "scheduled", playWindowStart: at(-60) }, NOW);
    expect(message).toMatch(/has already passed/);
  });

  it("refuses a scheduled contest starting inside the lead", () => {
    const message = scheduledStartTooSoon({ playMode: "scheduled", playWindowStart: at(30) }, NOW);
    expect(message).toMatch(/is too soon/);
  });

  it("admits a start exactly at the lead, and later", () => {
    const lead = MIN_SCHEDULED_START_LEAD_SECONDS;
    expect(scheduledStartTooSoon({ playMode: "scheduled", playWindowStart: at(lead) }, NOW)).toBeNull();
    expect(scheduledStartTooSoon({ playMode: "scheduled", playWindowStart: at(3600) }, NOW)).toBeNull();
  });

  it("never refuses a play-any-time or unlabelled contest, which has no gun", () => {
    for (const playMode of ["anytime", undefined, null, ""]) {
      expect(scheduledStartTooSoon({ playMode, playWindowStart: at(-3600) }, NOW)).toBeNull();
    }
  });

  it("says nothing about a contest with no start rather than guessing one", () => {
    expect(scheduledStartTooSoon({ playMode: "scheduled", playWindowStart: null }, NOW)).toBeNull();
  });

  it("gives the operator a minimum long enough to join and open the lobby", () => {
    expect(MIN_SCHEDULED_START_LEAD_SECONDS).toBeGreaterThanOrEqual(60);
  });
});

describe("every writer that can put a scheduled contest live asks the rule first", () => {
  it("the two copies of the rule are byte-identical", () => {
    expect(read("apps/admin/lib/services/games/scheduled-start.ts")).toBe(
      read("lib/services/games/scheduled-start.ts"),
    );
  });

  it.each([
    "lib/services/game-providers/provider-contest.service.ts",
    "apps/admin/lib/services/game-providers/provider-contest.service.ts",
  ])("create refuses before writing the contest: %s", (path) => {
    const src = read(path);
    const check = src.indexOf("scheduledStartTooSoon(");
    const refusal = src.indexOf("if (tooSoon) return { success: false, error: tooSoon }");
    const write = src.indexOf("Competition.create(");
    expect(check).toBeGreaterThan(-1);
    expect(refusal).toBeGreaterThan(check);
    expect(write).toBeGreaterThan(refusal);
  });

  it.each([
    "lib/services/game-providers/provider-contest-publish.service.ts",
    "apps/admin/lib/services/game-providers/provider-contest-publish.service.ts",
  ])("publish refuses before claiming the contest: %s", (path) => {
    const src = read(path);
    const check = src.indexOf("scheduledStartTooSoon(");
    const refusal = src.indexOf("return { success: false, error: tooSoon }");
    const claim = src.indexOf("Competition.findOneAndUpdate(");
    expect(check).toBeGreaterThan(-1);
    expect(refusal).toBeGreaterThan(check);
    expect(claim).toBeGreaterThan(refusal);
    // The contest's OWN shape, never the title's default - a title supporting both shapes
    // would otherwise judge a staggered contest by the race rule.
    expect(src.slice(check, refusal)).toContain("resolveContestPlayMode(contest.playMode, title)");
  });

  it("edit refuses a moved start, and only a moved start, before applying anything", () => {
    const src = read("apps/admin/lib/services/game-providers/provider-contest-edit.service.ts");
    const guard = src.indexOf(
      "if (input.startTime !== undefined || input.playWindowStart !== undefined)",
    );
    const check = src.indexOf("scheduledStartTooSoon(");
    const apply = src.indexOf("applyEdit(competition");
    expect(guard).toBeGreaterThan(-1);
    expect(check).toBeGreaterThan(guard);
    expect(apply).toBeGreaterThan(check);
  });

  it("the wizard shows the same sentence before the operator presses Create", () => {
    const src = read("apps/admin/components/admin/games/wizard/StepSchedule.tsx");
    expect(src).toContain("scheduledStartTooSoon(");
    expect(src).toContain("{startTooSoon}");
  });
});
