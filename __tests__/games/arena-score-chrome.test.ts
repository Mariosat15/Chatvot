/**
 * Arena / championship Score-vs-PnL chrome (13 s5.1c leftover).
 *
 * Server already sorts provider contests on score. These tests pin the broadcast
 * clients so they cannot quietly paint livePnl green/red for every game again.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  describeBroadcastMetric,
  isProviderBroadcast,
} from "@/lib/utils/broadcast-metric";
import { ranked } from "@/components/arena/helpers";
import type { Participant } from "@/components/arena/types";

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function blankParticipant(partial: Partial<Participant>): Participant {
  return {
    userId: "u",
    username: "n",
    profileImage: null,
    liveEquity: 10000,
    livePnl: 0,
    liveRoi: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    currentCapital: 10000,
    availableCapital: 10000,
    usedMargin: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    averageWin: 0,
    averageLoss: 0,
    largestWin: 0,
    largestLoss: 0,
    maxDrawdownPercentage: 0,
    currentOpenPositions: 0,
    status: "active",
    isDisqualified: false,
    openPositions: [],
    ...partial,
  };
}

describe("broadcast-metric helper", () => {
  it("labels provider rows Score with neutral cyan, never green/red from PnL", () => {
    const m = describeBroadcastMetric({
      gameType: "provider",
      score: 900,
      livePnl: -500,
    });
    expect(m.label).toBe("Score");
    expect(m.value).toBe("900");
    expect(m.tone).toBe("neutral");
    expect(m.color).toBe("#22d3ee");
  });

  it("renders a dash for an absent provider score (R50 read-side)", () => {
    const m = describeBroadcastMetric({
      gameType: "provider",
      score: undefined,
      livePnl: 0,
    });
    expect(m.value).toBe("–");
    expect(m.tone).toBe("neutral");
  });

  it("keeps trading PnL green/red", () => {
    const up = describeBroadcastMetric({
      gameType: "trading",
      livePnl: 120,
    });
    expect(up.label).toBe("P&L");
    expect(up.tone).toBe("positive");
    const down = describeBroadcastMetric({
      gameType: undefined,
      livePnl: -40,
    });
    expect(down.tone).toBe("negative");
  });

  it("isProviderBroadcast is label-only", () => {
    expect(isProviderBroadcast("provider")).toBe(true);
    expect(isProviderBroadcast("trading")).toBe(false);
    expect(isProviderBroadcast(undefined)).toBe(false);
  });
});

describe("arena ranked() respects API order for provider contests", () => {
  it("sorts provider seats by rank, not liveEquity", () => {
    const ps = [
      blankParticipant({ userId: "a", liveEquity: 50000, rank: 2, score: 100 }),
      blankParticipant({ userId: "b", liveEquity: 1000, rank: 1, score: 900 }),
    ];
    const sorted = ranked(ps, "provider");
    expect(sorted.map((p) => p.userId)).toEqual(["b", "a"]);
  });

  it("still sorts trading by liveEquity descending", () => {
    const ps = [
      blankParticipant({ userId: "a", liveEquity: 9000 }),
      blankParticipant({ userId: "b", liveEquity: 12000 }),
    ];
    const sorted = ranked(ps, "trading");
    expect(sorted.map((p) => p.userId)).toEqual(["b", "a"]);
  });
});

describe("arena page threads score and gameType from the API", () => {
  it("mapEvent copies score, rank, gameType and gameKey", () => {
    const src = stripComments(read("app/arena/page.tsx"));
    expect(src).toMatch(/gameType:\s*typeof ev\.gameType/);
    expect(src).toMatch(/gameKey:\s*typeof ev\.gameKey/);
    expect(src).toMatch(/typeof p\.score === ['"]number['"]/);
    expect(src).toMatch(/rank:\s*typeof p\.rank/);
  });

  it("passes gameType into TraderCard and ranked()", () => {
    const src = stripComments(read("app/arena/page.tsx"));
    expect(src).toMatch(/ranked\(selected\.participants,\s*selected\.gameType\)/);
    expect(src).toMatch(/gameType=\{selected\.gameType\}/);
  });
});

describe("Leaderboard Score chrome", () => {
  it("uses describeBroadcastMetric and SCORE column for provider", () => {
    const src = stripComments(read("components/arena/Leaderboard.tsx"));
    expect(src).toContain("describeBroadcastMetric");
    expect(src).toContain("isProviderBroadcast");
    expect(src).toMatch(/provider \? ['"]SCORE['"] : ['"]EQUITY['"]/);
  });
});

describe("TraderChampionshipClient Score-vs-PnL", () => {
  it("imports the shared helper and no longer borders avatars on bare livePnl", () => {
    const src = stripComments(
      read("components/championship/TraderChampionshipClient.tsx"),
    );
    expect(src).toContain("describeBroadcastMetric");
    expect(src).toContain("isProviderBroadcast");
    // Reason: the defect was `(p.livePnl || 0) >= 0 ? "#10b981" : "#ef4444"`.
    expect(src).not.toMatch(
      /\(p\.livePnl\s*\|\|\s*0\)\s*>=\s*0\s*\?\s*["']#10b981["']/,
    );
  });

  it("sorts provider seats on score, not pnl", () => {
    const src = stripComments(
      read("components/championship/TraderChampionshipClient.tsx"),
    );
    expect(src).toMatch(/sortKey:\s*number/);
    expect(src).toMatch(/provider[\s\S]{0,120}score/);
  });
});

describe("shared helper is model-free (R58)", () => {
  it("broadcast-metric.ts never imports mongoose or a model", () => {
    const src = stripComments(read("lib/utils/broadcast-metric.ts"));
    expect(src).not.toMatch(/mongoose|database\/models/);
  });
});
