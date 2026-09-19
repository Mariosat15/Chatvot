/**
 * GettingStartedCard — game-aware first-run checklist (chapter 20 section 5).
 *
 * Definition of done: the card contains no trading-only step when tradingEnabled
 * is false. A games-only player's first play (a round) completes the play step
 * without ever placing a trade.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildGettingStartedSteps,
  hasCompletedFirstPlay,
} from "@/lib/utils/getting-started-steps";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const baseFacts = {
  hasFundedWallet: false,
  hasJoinedCompetition: false,
  hasPlacedTrade: false,
  hasPlayedGame: false,
  hasCompletedMilestone: false,
  hasChallengedUser: false,
};

describe("GettingStarted game-aware steps (20 s5)", () => {
  it("omits trade/position wording when trading is off", () => {
    const steps = buildGettingStartedSteps({
      ...baseFacts,
      tradingEnabled: false,
    });
    const play = steps.find((s) => s.id === "play");
    expect(play).toBeDefined();
    expect(play!.title).toBe("Play Your First Contest");
    expect(play!.description.toLowerCase()).not.toMatch(/trade|position|trader/);
    // Reason: no step id "trade" may survive — that is the old trading-only step.
    expect(steps.some((s) => s.id === "trade")).toBe(false);
    const joined = steps.map((s) => `${s.title} ${s.description}`).join(" ");
    expect(joined.toLowerCase()).not.toMatch(/\btrader\b/);
    expect(joined.toLowerCase()).not.toMatch(/place your first trade/);
  });

  it("mentions a position only when trading is on, and still offers a game round", () => {
    const steps = buildGettingStartedSteps({
      ...baseFacts,
      tradingEnabled: true,
    });
    const play = steps.find((s) => s.id === "play")!;
    expect(play.description).toMatch(/position/i);
    expect(play.description).toMatch(/game round/i);
    expect(play.title).not.toMatch(/trade/i);
  });

  it("completes the play step from a game round without any trade", () => {
    expect(
      hasCompletedFirstPlay({ hasPlacedTrade: false, hasPlayedGame: true }),
    ).toBe(true);
    expect(
      hasCompletedFirstPlay({ hasPlacedTrade: true, hasPlayedGame: false }),
    ).toBe(true);
    expect(
      hasCompletedFirstPlay({ hasPlacedTrade: false, hasPlayedGame: false }),
    ).toBe(false);

    const steps = buildGettingStartedSteps({
      ...baseFacts,
      tradingEnabled: false,
      hasPlayedGame: true,
    });
    expect(steps.find((s) => s.id === "play")!.completed).toBe(true);
  });

  it("uses the shared builder — the card must not hard-code step titles", () => {
    // Reason: importing the builder then restating "Place Your First Trade" beside
    // it is the one-rule-two-copies shape. Negative assertion is load-bearing.
    const card = stripComments(
      read("components/dashboard/GettingStartedCard.tsx"),
    );
    expect(card).toMatch(/buildGettingStartedSteps/);
    expect(card).not.toMatch(/Place Your First Trade/);
    expect(card).not.toMatch(/pro trader/i);
    expect(card).not.toMatch(/hasPlacedTrade=\{/);
  });

  it("dashboard wires tradingEnabled and hasPlayedGame into the card", () => {
    const layout = stripComments(
      read("components/dashboard/DashboardLayout.tsx"),
    );
    expect(layout).toMatch(/tradingEnabled=\{tradingEnabled\}/);
    expect(layout).toMatch(/hasPlayedGame=\{hasPlayedGame\}/);
    expect(layout).toMatch(/rounds\.started/);
    expect(layout).toMatch(/rounds\.scored/);

    const action = stripComments(
      read("lib/actions/comprehensive-dashboard.actions.ts"),
    );
    expect(action).toMatch(/getEnabledGameTypes/);
    expect(action).toMatch(/tradingEnabled/);
    // Reason: R29 — enabled set gates creation/discovery, never a stats read. The
    // performance fetch must stay a plain userId call with no enabled filter.
    expect(action).toMatch(/getPlayerGamePerformance\(userId\)/);
    expect(action).not.toMatch(
      /getPlayerGamePerformance\([^)]*enabledGameTypes/,
    );
  });
});
