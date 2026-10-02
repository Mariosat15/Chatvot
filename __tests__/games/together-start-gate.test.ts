/**
 * A "together" game has one start for everybody - and, since 28 Sep 2026, a late player may
 * still join it while it runs.
 *
 * HISTORY, kept because it is why the rule is stated once. The owner's first report (28 Sep
 * 2026): pressing Play on a race competition after the gun gave "Round cancelled - does not
 * count" with a PLAY ANOTHER ROUND button, and pressing that did the same thing again. The fix
 * then was a refusal before any round existed (`startHasPassed` in the launch service).
 *
 * THE OWNER REVERSED THE RULE THE SAME DAY: "if a user is late he still can join the race and
 * play". So the launch service no longer refuses after the start. What survives:
 *  - `startHasPassed` is still the one definition, now read only to decide what screens SAY;
 *  - a race that can no longer be joined is refused by the GAME, `createRound` deletes the
 *    pending round (no attempt spent), and the player is told plainly rather than "try again";
 *  - the result panel still offers no second round after the start, because there is one race.
 * The tests below were flipped rather than deleted, so the loop the first fix closed stays
 * visible as the reason the late-join path ends in a permanent sentence.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  playModePlayerRule,
  startHasPassed,
  LATE_ENTRY_NOTICE,
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
  it("says a together-game starts for everyone at once, needs two ready, and allows lateness", () => {
    const rule = playModePlayerRule("scheduled", "competition");
    expect(rule.label).toMatch(/together/i);
    expect(rule.detail).toMatch(/before the start/i);
    expect(rule.detail).toMatch(/2 players are ready/i);
    expect(rule.detail).toMatch(/still join late/i);
  });

  it("says an anytime game can be played before the end", () => {
    const rule = playModePlayerRule("anytime", "competition");
    expect(rule.label).toMatch(/whenever/i);
    expect(rule.detail).toMatch(/anytime/i);
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
      .concat(LATE_ENTRY_NOTICE)
      .join(" ");
    expect(all).not.toMatch(/\b(race|raced|lap|board|puzzle|trade|volt|circuit|ship|launch)\b/i);
  });
});

describe("a late player is let in, and the game decides whether the race can still be joined", () => {
  const launch = read("lib/services/games/round-launch.service.ts");
  const round = read("lib/services/games/round.service.ts");

  it("the launch service no longer refuses after the start", () => {
    expect(launch).not.toMatch(/startHasPassed/);
    expect(launch).not.toMatch(/start_has_passed/);
  });

  it("the route has no start_has_passed refusal left to map", () => {
    expect(read("app/api/competitions/[id]/rounds/route.ts")).not.toMatch(/start_has_passed/);
  });

  it("a game refusal on a together-start round is a permanent sentence, never 'try again'", () => {
    const at = round.indexOf('created.code === "INVALID_REQUEST"');
    expect(at).toBeGreaterThan(-1);
    expect(round.slice(at - 80, at)).toMatch(/input\.config\.scheduledStartAt/);
    const block = round.slice(at, round.indexOf("};", at));
    expect(block).toMatch(/can no longer be joined/);
    expect(block).toMatch(/attempt was not used/);
    expect(block).not.toMatch(/try again/i);
    // The rollback must come first, or the refusal burns the attempt it promises was not used.
    expect(round.indexOf("GameRound.deleteOne({ _id: round._id })")).toBeLessThan(at);
  });

  it("every round of a together-start contest lives until the play window closes", () => {
    const at = round.indexOf("function resolveExpiry(");
    const body = round.slice(at, round.indexOf("\n}", at));
    expect(body.length).toBeGreaterThan(80);
    expect(body).toMatch(
      /if \(config\.scheduledStartAt\) return new Date\(config\.playWindowEnd\.getTime\(\)\);/,
    );
  });
});

describe("the player screens agree with the server", () => {
  const preflight = read("components/games/RoundPreflight.tsx");

  it("the pre-flight keeps Play available after the start and says the player is late", () => {
    expect(preflight).toMatch(/format === "competition" &&\s*\n?\s*playsTogether/);
    const blocked = preflight.slice(
      preflight.indexOf("const blocked ="),
      preflight.indexOf("const blockedReason"),
    );
    expect(blocked.length).toBeGreaterThan(40);
    expect(blocked).not.toMatch(/startPassed/);
    expect(preflight).toMatch(/startPassed && !blocked && \(/);
    expect(preflight).toMatch(/\{LATE_ENTRY_NOTICE\}/);
    expect(preflight).toMatch(/startPassed\s*\n?\s*\? "Join late"/);
  });

  it("the challenge host says it is a challenge, so it gets no gun gate", () => {
    expect(read("components/games/ChallengeRoundHost.tsx")).toMatch(/format="challenge"/);
  });

  it("the result panel does not offer another round after the start - there is one race", () => {
    const code = read("components/games/RoundResultPanel.tsx");
    expect(code).toMatch(/canPlayAgain\s*=\s*[^;]*!startPassed/);
  });

  it("the notice is the one shared string, not a second copy", () => {
    expect(LATE_ENTRY_NOTICE.length).toBeGreaterThan(40);
    expect(preflight).not.toContain(LATE_ENTRY_NOTICE.slice(0, 40));
  });
});
