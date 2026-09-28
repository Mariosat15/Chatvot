import { describe, it, expect } from "vitest";
import {
  parseConfigSchema,
  resolveAttemptSeconds,
  type ConfigField,
} from "@/lib/services/games/config-schema";
import { runPreflight } from "@/lib/services/games/contest-preflight";
import type { PreflightInput } from "@/lib/services/games/contest-preflight";
import { endTimeThatFits } from "@/apps/admin/components/admin/games/contest-draft";

/**
 * The `duration-units` play clock, and the refusal it makes possible.
 *
 * WHY. A race title (Volt Velocity) sets laps, not seconds, so it declared no play clock and
 * the platform reserved its 10-lap ceiling (1005 s) for every contest. An operator creating a
 * five-minute, three-lap race was told the playing time was 1005 seconds and that a cut-short
 * attempt was "fine if a partial run still scores" - wrong on both counts, because the race
 * lasts 305 s and a cut-short race scores nothing. The unit format lets the title say "one
 * lap is 100 s, plus a 5 s countdown", and a scheduled contest shorter than that is refused.
 */

const LAPS_SCHEMA = {
  type: "object",
  properties: {
    laps: {
      type: "integer",
      minimum: 1,
      maximum: 10,
      default: 3,
      format: "duration-units",
      secondsPerUnit: 100,
      secondsExtra: 5,
    },
  },
};

function lapsFields(): ConfigField[] {
  const parsed = parseConfigSchema(LAPS_SCHEMA);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.fields;
}

describe("duration-units - parsing", () => {
  it("accepts a unit clock and keeps its multiplier", () => {
    const [laps] = lapsFields();
    expect(laps).toMatchObject({
      format: "duration-units",
      secondsPerUnit: 100,
      secondsExtra: 5,
    });
  });

  it("refuses a unit clock with no positive secondsPerUnit", () => {
    for (const secondsPerUnit of [undefined, 0, -5, "100"]) {
      const result = parseConfigSchema({
        type: "object",
        properties: {
          laps: { type: "integer", format: "duration-units", secondsPerUnit },
        },
      });
      expect(result.ok).toBe(false);
    }
  });

  it("refuses a negative secondsExtra", () => {
    const result = parseConfigSchema({
      type: "object",
      properties: {
        laps: {
          type: "integer",
          format: "duration-units",
          secondsPerUnit: 100,
          secondsExtra: -1,
        },
      },
    });
    expect(result.ok).toBe(false);
  });

  it("refuses the unit keywords without the format", () => {
    // Otherwise a provider who forgot the format would believe the platform was using the
    // multiplier while it silently reserved the ceiling.
    const result = parseConfigSchema({
      type: "object",
      properties: { laps: { type: "integer", secondsPerUnit: 100 } },
    });
    expect(result.ok).toBe(false);
  });

  it("allows only ONE play clock across both formats", () => {
    const result = parseConfigSchema({
      type: "object",
      properties: {
        seconds: { type: "integer", format: "duration-seconds" },
        laps: { type: "integer", format: "duration-units", secondsPerUnit: 100 },
      },
    });
    expect(result.ok).toBe(false);
  });
});

describe("duration-units - how long one attempt is", () => {
  it("multiplies the chosen value and adds the extra", () => {
    expect(resolveAttemptSeconds(lapsFields(), { laps: 3 }, 1005)).toBe(305);
    expect(resolveAttemptSeconds(lapsFields(), { laps: 1 }, 1005)).toBe(105);
  });

  it("uses the declared default when the operator chose nothing", () => {
    expect(resolveAttemptSeconds(lapsFields(), {}, 1005)).toBe(305);
  });

  it("clamps to the declared range, so a bad value cannot shrink the reservation", () => {
    expect(resolveAttemptSeconds(lapsFields(), { laps: 50 }, 1005)).toBe(1005);
  });

  it("falls back to the ceiling for an unusable value (over-reserves, fails closed)", () => {
    expect(resolveAttemptSeconds(lapsFields(), { laps: 0 }, 1005)).toBe(1005);
    expect(resolveAttemptSeconds(lapsFields(), { laps: "abc" }, 1005)).toBe(1005);
  });
});

function preflightInput(overrides: Partial<PreflightInput> = {}): PreflightInput {
  const start = new Date("2026-09-05T10:00:00Z");
  return {
    format: "competition",
    minParticipants: 2,
    title: {
      displayName: "Race",
      providerStatus: "active",
      supportsCompetition: true,
      supportsOneVsOne: true,
      supportsContentSeed: true,
      maxDurationSeconds: 1005,
    },
    provider: { enabled: true, adapterInstalled: true },
    chartvoltEnabled: true,
    externalGamesEnabled: true,
    schemaFields: lapsFields(),
    settings: { laps: 3 },
    playWindowStart: start,
    // Five minutes: shorter than a 305-second race.
    playWindowEnd: new Date(start.getTime() + 300_000),
    resultGracePeriodSeconds: 1500,
    attemptsPolicy: "single",
    unresolvedRoundPolicy: "score_zero",
    roundStartPolicy: "until_window_closes",
    perRoundCostAcknowledged: true,
    lastSandboxRoundAt: new Date("2026-09-04T11:00:00Z"),
    now: new Date("2026-09-04T12:00:00Z"),
    ...overrides,
  };
}

describe("runPreflight - a contest shorter than one attempt", () => {
  it("REFUSES a scheduled contest, because nobody could finish", () => {
    const result = runPreflight(preflightInput({ playMode: "scheduled" }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/nobody could finish/);
  });

  it("only warns when players start any time (a partial run may count)", () => {
    const result = runPreflight(preflightInput({ playMode: "anytime" }));
    expect(result.ok).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/longer than the contest/);
  });

  it("treats an absent play mode as anytime", () => {
    expect(runPreflight(preflightInput()).ok).toBe(true);
  });

  it("passes a scheduled contest long enough for the race", () => {
    const start = new Date("2026-09-05T10:00:00Z");
    const result = runPreflight(
      preflightInput({
        playMode: "scheduled",
        playWindowEnd: new Date(start.getTime() + 600_000),
      }),
    );
    expect(result.errors).toEqual([]);
  });
});

describe("endTimeThatFits - the one-click fix", () => {
  it("adds the attempt plus a minute and rounds UP to the minute", () => {
    // 305 s + 60 s = 6 min 5 s, rounded up to 7 minutes after the start.
    expect(endTimeThatFits("2026-09-05T10:00", 305)).toBe("2026-09-05T10:07");
  });

  it("gives nothing for an unusable start or length", () => {
    expect(endTimeThatFits("", 305)).toBeUndefined();
    expect(endTimeThatFits("2026-09-05T10:00", 0)).toBeUndefined();
  });
});
