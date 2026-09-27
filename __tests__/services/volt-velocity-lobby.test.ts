import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import {
  DEFAULT_LOBBY_SECONDS,
  MAX_LOBBY_SECONDS,
  MIN_LOBBY_SECONDS,
  isInLobby,
  isValidLobbySeconds,
  lobbyOpensAt,
  playModeHasLobby,
  resolveLobbySeconds,
} from "@/lib/services/games/play-shape";
import { contestRoundConfig } from "@/lib/services/games/contest-config";
import { runPreflight, type PreflightInput } from "@/lib/services/games/contest-preflight";
import { parseLobbySecondsInput } from "../../apps/admin/lib/services/game-providers/game-play-style.service";

/**
 * VV4 (`23` s8.4): a scheduled race opens a lobby before the gun, tells the provider when the
 * gun is, and never sells more seats than one race room holds.
 */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const START = new Date("2026-10-01T12:00:00Z");

describe("the lobby window", () => {
  it("exists only for a contest STORED as scheduled", () => {
    expect(playModeHasLobby("scheduled")).toBe(true);
    for (const mode of ["anytime", undefined, null, ""]) {
      expect(playModeHasLobby(mode as string | undefined)).toBe(false);
      expect(lobbyOpensAt({ playMode: mode, playWindowStart: START })).toBeNull();
    }
  });

  it("opens the configured length before the start, defaulting to ten minutes", () => {
    expect(lobbyOpensAt({ playMode: "scheduled", playWindowStart: START })?.toISOString()).toBe(
      "2026-10-01T11:50:00.000Z",
    );
    expect(
      lobbyOpensAt({ playMode: "scheduled", playWindowStart: START, lobbySeconds: 120 })
        ?.toISOString(),
    ).toBe("2026-10-01T11:58:00.000Z");
  });

  it("reads an out-of-range or non-numeric stored length as the default, never as open for ever", () => {
    for (const bad of [0, 59, 1801, 90.5, Number.NaN, "600", null]) {
      expect(resolveLobbySeconds(bad)).toBe(DEFAULT_LOBBY_SECONDS);
    }
    expect(isValidLobbySeconds(MIN_LOBBY_SECONDS)).toBe(true);
    expect(isValidLobbySeconds(MAX_LOBBY_SECONDS)).toBe(true);
  });

  it("is open from the lobby opening until the start, and not after", () => {
    const contest = { playMode: "scheduled", playWindowStart: START, lobbySeconds: 300 };
    expect(isInLobby(contest, new Date("2026-10-01T11:54:59Z"))).toBe(false);
    expect(isInLobby(contest, new Date("2026-10-01T11:55:00Z"))).toBe(true);
    expect(isInLobby(contest, new Date("2026-10-01T11:59:59Z"))).toBe(true);
    expect(isInLobby(contest, START)).toBe(false);
  });
});

describe("the round is told when the gun is", () => {
  const base = {
    gameConfig: { providerKey: "chartvolt-games", gameCode: "volt-velocity" },
    playWindowStart: START,
    playWindowEnd: new Date("2026-10-01T12:10:00Z"),
    attemptsPolicy: "single",
    contentSeed: "seed",
  };

  it("carries scheduledStartAt on a scheduled contest", () => {
    const result = contestRoundConfig({ ...base, playMode: "scheduled" } as never);
    expect(result.ok && result.config.scheduledStartAt?.toISOString()).toBe(START.toISOString());
  });

  it("carries nothing on an anytime contest, so a time trial is not held at a start line", () => {
    const result = contestRoundConfig({ ...base, playMode: "anytime" } as never);
    expect(result.ok && "scheduledStartAt" in result.config).toBe(false);
  });

  it("measures expiry from the later of now and the start, so an early arrival loses no time", () => {
    const code = read("lib/services/games/round.service.ts");
    expect(code).toMatch(
      /Math\.max\(now\.getTime\(\),\s*config\.scheduledStartAt\?\.getTime\(\)\s*\?\?\s*0\)/,
    );
  });

  it("is sent to the provider in both adapter copies", () => {
    for (const p of [
      "lib/services/game-providers/adapters/chartvolt-games.adapter.ts",
      "apps/admin/lib/services/game-providers/adapters/chartvolt-games.adapter.ts",
    ]) {
      expect(read(p)).toMatch(/scheduledStartAt:\s*request\.scheduledStartAt\.toISOString\(\)/);
    }
  });
});

describe("the launch service admits the lobby", () => {
  it("lets an upcoming contest through once the lobby is open, through the one shared helper", () => {
    const code = read("lib/services/games/round-launch.service.ts");
    expect(code).toMatch(/lobbyOpensAt\(\{/);
    expect(code).toMatch(/!PLAYABLE_STATUSES\.has\(contest\.status\)\s*&&\s*!lobbyAdmits/);
    expect(code).not.toMatch(/===\s*"scheduled"/);
  });
});

function preflight(overrides: Partial<PreflightInput> = {}): PreflightInput {
  return {
    format: "competition",
    minParticipants: 2,
    maxParticipants: 16,
    title: {
      displayName: "Volt Velocity",
      providerStatus: "active",
      supportsCompetition: true,
      supportsOneVsOne: true,
      supportsContentSeed: true,
      maxDurationSeconds: 300,
      maxPlayers: 16,
    },
    provider: { enabled: true, adapterInstalled: true },
    chartvoltEnabled: true,
    externalGamesEnabled: true,
    schemaFields: [],
    settings: {},
    playWindowStart: new Date("2026-10-05T10:00:00Z"),
    playWindowEnd: new Date("2026-10-05T18:00:00Z"),
    resultGracePeriodSeconds: 900,
    attemptsPolicy: "single",
    unresolvedRoundPolicy: "score_zero",
    perRoundCostAcknowledged: true,
    lastSandboxRoundAt: new Date("2026-10-04T11:00:00Z"),
    now: new Date("2026-10-04T12:00:00Z"),
    ...overrides,
  };
}

describe("a contest never sells more seats than one race room holds", () => {
  it("passes a contest at exactly the room size", () => {
    expect(runPreflight(preflight()).ok).toBe(true);
  });

  it("refuses a seventeenth seat, naming both numbers", () => {
    const result = runPreflight(preflight({ maxParticipants: 17 }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/at most 16.*allows 17/);
  });

  it("refuses a contest with no maximum, because unlimited is more than sixteen", () => {
    for (const max of [undefined, 0, -1]) {
      expect(runPreflight(preflight({ maxParticipants: max })).ok, String(max)).toBe(false);
    }
  });

  it("refuses a minimum the room cannot reach", () => {
    const result = runPreflight(preflight({ minParticipants: 17, maxParticipants: 16 }));
    expect(result.errors.join(" ")).toMatch(/minimum of 17/);
  });

  it("counts a challenge as two, whatever maximum the caller sent", () => {
    const result = runPreflight(
      preflight({
        format: "challenge",
        maxParticipants: 99,
        title: { ...preflight().title, maxPlayers: 2 },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("applies no cap to a title that declares none", () => {
    const title = { ...preflight().title };
    delete title.maxPlayers;
    expect(runPreflight(preflight({ title, maxParticipants: 500 })).ok).toBe(true);
  });
});

describe("the operator's lobby length", () => {
  it("accepts a whole number of seconds in range, and null to clear", () => {
    expect(parseLobbySecondsInput(300)).toEqual({ ok: true, seconds: 300 });
    expect(parseLobbySecondsInput(null)).toEqual({ ok: true, seconds: null });
  });

  it("refuses anything outside 1 to 30 minutes, naming the range", () => {
    for (const bad of [30, 1801, 90.5, "300", Number.NaN, undefined]) {
      const result = parseLobbySecondsInput(bad);
      expect(result.ok, String(bad)).toBe(false);
    }
  });

  it("is one decision per request on the play-style route, with its own audit line", () => {
    const code = read(
      "apps/admin/app/api/games/providers/[providerKey]/games/play-style/route.ts",
    );
    expect(code).toMatch(/"lobbySeconds" in body/);
    expect(code).toMatch(/decisions\s*>\s*1/);
    expect(code).toMatch(/setGameLobbySeconds\(/);
  });

  it("is barred from the title-and-logo editor, as are the provider's seat limit", () => {
    const code = read("apps/admin/lib/admin/game-content-fields.ts");
    expect(code).toMatch(/\["lobbySeconds",/);
    expect(code).toMatch(/\["maxPlayers",/);
  });
});
