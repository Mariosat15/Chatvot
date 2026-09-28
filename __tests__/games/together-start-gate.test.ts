/**
 * A "together" game has one start for everybody, and after it there is nothing to join.
 *
 * THE OWNER'S REPORT (28 Sep 2026): pressing Play on a race competition after the gun gave
 * "Round cancelled - does not count" with a PLAY ANOTHER ROUND button, and pressing that did the
 * same thing again. The race server had rightly refused ("Entry to this race has closed"), the
 * round was voided, the attempt handed back, and the screen offered a fresh round that could only
 * meet the same refusal - a loop, with a real provider call on every lap.
 *
 * The fix is one rule stated once (`startHasPassed` in `play-shape.ts`) and read by three places:
 * the launch service refuses BEFORE a round is created, the pre-flight withholds Play, and the
 * result panel stops offering another round. A challenge has no gun, so the gate is
 * competition-only; the "shorter round" warning is suppressed for both.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  playModePlayerRule,
  startHasPassed,
  START_HAS_PASSED_MESSAGE,
} from "@/lib/services/games/play-shape";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

describe("startHasPassed", () => {
  const start = new Date("2026-09-28T06:00:00Z");

  it("is true for a scheduled contest at or after its start", () => {
    expect(startHasPassed({ playMode: "scheduled", playWindowStart: start }, start)).toBe(true);
    expect(
      startHasPassed(
        { playMode: "scheduled", playWindowStart: start },
        new Date(start.getTime() + 60_000),
      ),
    ).toBe(true);
  });

  it("is false before the start - the lobby is where a player waits", () => {
    expect(
      startHasPassed(
        { playMode: "scheduled", playWindowStart: start },
        new Date(start.getTime() - 1),
      ),
    ).toBe(false);
  });

  it("never fires for an anytime contest, whose players start whenever they like", () => {
    const late = new Date(start.getTime() + 3_600_000);
    expect(startHasPassed({ playMode: "anytime", playWindowStart: start }, late)).toBe(false);
    // Absent is the anytime default, never a guess at scheduled.
    expect(startHasPassed({ playWindowStart: start }, late)).toBe(false);
  });

  it("applies no gate when there is no start to compare against", () => {
    expect(startHasPassed({ playMode: "scheduled", playWindowStart: null }, start)).toBe(false);
    expect(startHasPassed({ playMode: "scheduled" }, start)).toBe(false);
  });
});

describe("playModePlayerRule names the rule and never the game", () => {
  it("says a together-game starts for everyone at once", () => {
    const rule = playModePlayerRule("scheduled", "competition");
    expect(rule.label).toMatch(/together/i);
    expect(rule.detail).toMatch(/before the start/i);
  });

  it("says an anytime game can be played before the end", () => {
    const rule = playModePlayerRule("anytime", "competition");
    expect(rule.label).toMatch(/any time/i);
    expect(rule.detail).toMatch(/competition ends/i);
    expect(playModePlayerRule("anytime", "challenge").detail).toMatch(/challenge ends/i);
  });

  it("does not promise a challenge a gun it does not have", () => {
    expect(playModePlayerRule("scheduled", "challenge").detail).not.toMatch(/lobby/i);
  });

  it("contains no game-specific words", () => {
    const all = (["anytime", "scheduled"] as const)
      .flatMap((m) => (["competition", "challenge"] as const).map((f) => playModePlayerRule(m, f)))
      .map((r) => `${r.label} ${r.detail}`)
      .join(" ");
    expect(all).not.toMatch(/\b(race|lap|board|puzzle|trade|volt|circuit)\b/i);
  });
});

describe("the launch service refuses after the start, before any round exists", () => {
  const code = read("lib/services/games/round-launch.service.ts");

  it("asks the shared rule and refuses with its own code", () => {
    expect(code).toMatch(/startHasPassed\(contest, new Date\(\)\)/);
    expect(code).toMatch(/refuse\("start_has_passed", START_HAS_PASSED_MESSAGE\)/);
  });

  it("lets a player already inside a live round resume", () => {
    const at = code.indexOf("startHasPassed(contest");
    const block = code.slice(at, code.indexOf('refuse("start_has_passed"', at));
    expect(block.length).toBeGreaterThan(20);
    expect(block).toMatch(/LIVE_ROUND_STATUSES/);
  });

  it("refuses before the round is created, so no attempt and no provider call is spent", () => {
    const gate = code.indexOf('refuse("start_has_passed"');
    const create = code.indexOf("createRound(");
    expect(gate).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(create);
  });

  it("maps to 409 on the route, not a generic failure", () => {
    const route = read("app/api/competitions/[id]/rounds/route.ts");
    expect(route).toMatch(/case "start_has_passed":/);
  });
});

describe("the player screens agree with the server", () => {
  it("the pre-flight withholds Play once the start has passed, competitions only", () => {
    const code = read("components/games/RoundPreflight.tsx");
    expect(code).toMatch(/format === "competition" &&\s*\n?\s*playsTogether/);
    expect(code).toMatch(/START_HAS_PASSED_MESSAGE/);
    const blocked = code.slice(code.indexOf("const blocked ="), code.indexOf("const blockedReason"));
    expect(blocked.length).toBeGreaterThan(40);
    expect(blocked).toMatch(/startPassed/);
  });

  it("the challenge host says it is a challenge, so it gets no gun gate", () => {
    expect(read("components/games/ChallengeRoundHost.tsx")).toMatch(/format="challenge"/);
  });

  it("the result panel does not offer another round after the start", () => {
    const code = read("components/games/RoundResultPanel.tsx");
    expect(code).toMatch(/canPlayAgain\s*=\s*[^;]*!startPassed/);
  });

  it("the message is the one shared string, not a second copy", () => {
    expect(START_HAS_PASSED_MESSAGE.length).toBeGreaterThan(40);
    expect(read("components/games/RoundPreflight.tsx")).not.toContain(
      START_HAS_PASSED_MESSAGE.slice(0, 40),
    );
  });
});
