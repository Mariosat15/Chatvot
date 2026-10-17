/**
 * The waiting limit on an "everyone plays at once" contest (owner rule, 28 September 2026).
 *
 * A together-start contest waits for two ready players, but not for ever: once its limit
 * passes with play never begun, the platform cancels it and refunds every entry fee in full.
 * These tests pin the three things that must not drift - the decision, where the sweep runs,
 * and that the two apps agree - without a database, because the refund itself is the existing
 * `cancelCompetitionAndRefund`, which has its own suite.
 */
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_START_WAIT_SECONDS,
  MAX_START_WAIT_SECONDS,
  MIN_START_WAIT_SECONDS,
  isValidStartWaitSeconds,
  playNeverStarted,
  resolveStartWaitSeconds,
  startWaitCancelReason,
  startWaitDeadline,
} from "@/lib/services/games/start-wait";
import { emptyDraft, toRequestBody } from "@/apps/admin/components/admin/games/contest-draft";

const root = path.resolve(__dirname, "../..");
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("the waiting limit itself", () => {
  it("is 5 minutes by default, and 1 to 15 minutes when an operator sets it", () => {
    expect(DEFAULT_START_WAIT_SECONDS).toBe(300);
    expect(MIN_START_WAIT_SECONDS).toBe(60);
    expect(MAX_START_WAIT_SECONDS).toBe(900);
  });

  it("reads an unusable stored value as the default, never as zero", () => {
    // Reason: a zero limit cancels every contest on opening; NaN never cancels anything.
    for (const bad of [undefined, null, 0, -60, 30, 901, Number.NaN, 300.5, "300"]) {
      expect(resolveStartWaitSeconds(bad)).toBe(300);
      expect(isValidStartWaitSeconds(bad)).toBe(false);
    }
    expect(resolveStartWaitSeconds(600)).toBe(600);
  });

  it("gives a deadline to a scheduled contest only", () => {
    const start = new Date("2026-09-28T12:00:00Z");
    expect(
      startWaitDeadline({ playMode: "scheduled", playWindowStart: start, startWaitSeconds: 120 })
        ?.toISOString(),
    ).toBe("2026-09-28T12:02:00.000Z");
    expect(startWaitDeadline({ playMode: "scheduled", playWindowStart: start })?.toISOString())
      .toBe("2026-09-28T12:05:00.000Z");
    expect(startWaitDeadline({ playMode: "anytime", playWindowStart: start })).toBeNull();
    expect(startWaitDeadline({ playWindowStart: start })).toBeNull();
    expect(startWaitDeadline({ playMode: "scheduled", playWindowStart: null })).toBeNull();
  });

  it("states the refund in the reason every player reads", () => {
    expect(startWaitCancelReason(300)).toContain("within 5 minutes of the start");
    expect(startWaitCancelReason(60)).toContain("within 1 minute of the start");
    expect(startWaitCancelReason(300)).toContain("refunded in full");
  });
});

describe("whether play never started", () => {
  const u1 = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const u2 = "bbbbbbbbbbbbbbbbbbbbbbbb";

  it("cancels when nobody opened the game, or only one player is waiting", () => {
    expect(playNeverStarted([])).toBe(true);
    expect(playNeverStarted([{ userId: u1, status: "launched" }])).toBe(true);
    // One player with two live rounds is still one player.
    expect(
      playNeverStarted([
        { userId: u1, status: "launched" },
        { userId: u1, status: "pending" },
      ]),
    ).toBe(true);
  });

  it("cancels when the game itself gave up and voided the rounds", () => {
    // A voided round stores rawScore 0 deliberately; that is not evidence of play.
    expect(
      playNeverStarted([
        { userId: u1, status: "voided", rawScore: 0 },
        { userId: u2, status: "voided", rawScore: 0 },
      ]),
    ).toBe(true);
    expect(playNeverStarted([{ userId: u1, status: "abandoned", rawScore: null }])).toBe(true);
  });

  it("waits while two players hold live rounds, because play may be under way", () => {
    expect(
      playNeverStarted([
        { userId: u1, status: "launched" },
        { userId: u2, status: "launched" },
      ]),
    ).toBe(false);
  });

  it("never refunds a contest that produced a result, even a poor one", () => {
    expect(playNeverStarted([{ userId: u1, status: "completed", rawScore: 0 }])).toBe(false);
    expect(playNeverStarted([{ userId: u1, status: "expired", rawScore: 12 }])).toBe(false);
    expect(playNeverStarted([{ userId: u1, status: "unresolved" }])).toBe(false);
  });
});

describe("the two apps agree", () => {
  const mirrored = [
    "lib/services/games/start-wait.ts",
    "lib/services/games/together-start-cancel.service.ts",
    "lib/services/games/round-types.ts",
    "lib/services/games/contest-config.ts",
    "lib/services/game-providers/contract.ts",
    "lib/services/game-providers/adapters/chartvolt-games.adapter.ts",
    "lib/services/game-providers/provider-contest.service.ts",
  ];

  it.each(mirrored)("%s is byte-identical in apps/admin", (relative) => {
    expect(read(`apps/admin/${relative}`)).toBe(read(relative));
  });

  it.each(["lib/inngest/functions.ts", "apps/admin/lib/inngest/functions.ts"])(
    "%s runs the sweep BEFORE finalization",
    (relative) => {
      // Reason: finalized first, an unplayed contest settles as unscored and keeps the
      // platform fee instead of being refunded in full.
      const source = read(relative);
      const sweep = source.indexOf("await cancelUnstartedTogetherContests()");
      const finalize = source.indexOf("await checkAndFinalizeCompetitions()");
      expect(sweep).toBeGreaterThan(-1);
      expect(finalize).toBeGreaterThan(-1);
      expect(sweep).toBeLessThan(finalize);
    },
  );

  it("refunds through the one full-refund writer and never pre-sets the status (R43)", () => {
    const source = read("lib/services/games/together-start-cancel.service.ts");
    expect(source).toMatch(/cancelCompetitionAndRefund\(String\(contest\._id\), reason\)/);
    expect(source).not.toMatch(/status:\s*"cancelled"/);
    expect(source).not.toMatch(/updateOne|findOneAndUpdate|updateMany/);
  });
});

describe("the contest is created with the limit", () => {
  it("the wizard sends the limit on a scheduled contest only, in seconds", () => {
    const scheduled = toRequestBody({ ...emptyDraft, playMode: "scheduled", startWaitMinutes: 7 });
    expect(scheduled.startWaitSeconds).toBe(420);
    const anytime = toRequestBody({ ...emptyDraft, playMode: "anytime", startWaitMinutes: 7 });
    expect(anytime).not.toHaveProperty("startWaitSeconds");
  });

  it("the create service refuses a bad limit and stamps the resolved one", () => {
    const source = read("lib/services/game-providers/provider-contest.service.ts");
    expect(source).toMatch(/!isValidStartWaitSeconds\(input\.startWaitSeconds\)/);
    expect(source).toMatch(/startWaitSeconds:\s*resolveStartWaitSeconds\(input\.startWaitSeconds\)/);
  });

  it("the game is told the same limit on every round of a scheduled contest", () => {
    const service = read("lib/services/games/round.service.ts");
    expect(service.match(/startWaitSeconds: input\.config\.startWaitSeconds,/g)).toHaveLength(2);
    const config = read("lib/services/games/contest-config.ts");
    expect(config).toMatch(/startWaitSeconds:\s*resolveStartWaitSeconds\(contest\.startWaitSeconds\)/);
  });
});
