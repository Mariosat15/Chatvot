import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildTopPlayCards,
  OVERVIEW_PLAY_CARD_LIMIT,
} from "@/lib/services/games/overview-standing.service";
import {
  allOverviewAssets,
  overviewPlayCardArt,
} from "@/lib/services/games/overview-assets";
import {
  resolveOverviewRankBadge,
  OVERVIEW_RANK_TOP_N,
} from "@/lib/utils/overview-rank-badge";
import type { PlayerGameProfile } from "@/lib/services/games/player-game-stats.service";
import type { BrowsableGame } from "@/lib/services/games/player-catalogue.service";
import { readFileSync } from "node:fs";

const ROOT = process.cwd();

function standing(perGame: PlayerGameProfile["perGame"]): PlayerGameProfile {
  return {
    overall: null,
    perGame,
    startsFromCaption: "test",
  };
}

function cat(partial: Partial<BrowsableGame> & Pick<BrowsableGame, "slug" | "gameKey" | "displayName" | "kind">): BrowsableGame {
  return {
    isFeatured: false,
    comingSoon: false,
    sortOrder: 0,
    ...partial,
  };
}

describe("resolveOverviewRankBadge", () => {
  it("overlays ranks 1..20 on the shell", () => {
    for (let n = 1; n <= OVERVIEW_RANK_TOP_N; n++) {
      const badge = resolveOverviewRankBadge(n);
      expect(badge.inTopN).toBe(true);
      expect(badge.overlay).toBe(`#${n}`);
      expect(badge.src).toContain("rank-badge-shell");
    }
  });

  it("uses the dash for 21+, 0, and missing", () => {
    for (const n of [0, 21, 100, null, undefined, NaN]) {
      const badge = resolveOverviewRankBadge(n as number);
      expect(badge.inTopN).toBe(false);
      expect(badge.overlay).toBeNull();
      expect(badge.src).toContain("rank-badge-dash");
    }
  });
});

describe("buildTopPlayCards", () => {
  const catalogue: BrowsableGame[] = [
    cat({
      slug: "trading",
      gameKey: "trading",
      displayName: "Trading",
      kind: "trading",
      tagline: "Master real market conditions.",
      bannerUrl: "/uploads/trading-banner.webp",
    }),
    cat({
      slug: "circuit-sprint",
      gameKey: "provider:chartvolt:circuit-sprint",
      displayName: "Circuit Sprint",
      kind: "provider",
      gameCode: "circuit-sprint",
      tagline: "Fast decisions.",
      thumbnailUrl: "/uploads/sprint-thumb.webp",
    }),
    cat({
      slug: "volt-stack",
      gameKey: "provider:chartvolt:volt-stack",
      displayName: "Volt Stack",
      kind: "provider",
      gameCode: "volt-stack",
      // no art — falls back to neon plate
    }),
    cat({
      slug: "never-played",
      gameKey: "provider:chartvolt:never-played",
      displayName: "Never Played",
      kind: "provider",
      gameCode: "never-played",
      bannerUrl: "/uploads/never.webp",
    }),
  ];

  it("returns only played games, capped, ranked by contestsEntered", () => {
    const cards = buildTopPlayCards(
      standing([
        {
          gameKey: "provider:chartvolt:volt-stack",
          label: "Volt Stack",
          isTrading: false,
          contestsEntered: 2,
          contestsCompleted: 2,
          wins: 0,
          podiums: 0,
          totalPoints: 10,
          seasonPoints: 0,
          rating: 0,
          bestRank: 4,
          bestScore: 400,
          currentStreak: 0,
          bestStreak: 0,
        },
        {
          gameKey: "trading",
          label: "Trading",
          isTrading: true,
          contestsEntered: 9,
          contestsCompleted: 8,
          wins: 2,
          podiums: 1,
          totalPoints: 1224,
          seasonPoints: 0,
          rating: 0,
          bestRank: 1,
          bestScore: 0,
          currentStreak: 0,
          bestStreak: 0,
        },
        {
          gameKey: "provider:chartvolt:circuit-sprint",
          label: "Circuit Sprint",
          isTrading: false,
          contestsEntered: 5,
          contestsCompleted: 5,
          wins: 1,
          podiums: 1,
          totalPoints: 50,
          seasonPoints: 0,
          rating: 0,
          bestRank: 2,
          bestScore: 900,
          currentStreak: 0,
          bestStreak: 0,
        },
      ]),
      catalogue,
    );

    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.gameKey)).toEqual([
      "trading",
      "provider:chartvolt:circuit-sprint",
      "provider:chartvolt:volt-stack",
    ]);
    expect(cards.length).toBeLessThanOrEqual(OVERVIEW_PLAY_CARD_LIMIT);
    // Unplayed catalogue title must not appear.
    expect(cards.every((c) => c.gameKey !== "provider:chartvolt:never-played")).toBe(
      true,
    );
  });

  it("uses catalogue banner then thumbnail then neon fallback", () => {
    const cards = buildTopPlayCards(
      standing([
        {
          gameKey: "trading",
          label: "Trading",
          isTrading: true,
          contestsEntered: 1,
          contestsCompleted: 1,
          wins: 0,
          podiums: 0,
          totalPoints: 10,
          seasonPoints: 0,
          rating: 0,
          bestRank: 0,
          bestScore: 0,
          currentStreak: 0,
          bestStreak: 0,
        },
        {
          gameKey: "provider:chartvolt:circuit-sprint",
          label: "Sprint",
          isTrading: false,
          contestsEntered: 1,
          contestsCompleted: 1,
          wins: 0,
          podiums: 0,
          totalPoints: 0,
          seasonPoints: 0,
          rating: 0,
          bestRank: 0,
          bestScore: 12,
          currentStreak: 0,
          bestStreak: 0,
        },
        {
          gameKey: "provider:chartvolt:volt-stack",
          label: "Stack",
          isTrading: false,
          contestsEntered: 1,
          contestsCompleted: 1,
          wins: 0,
          podiums: 0,
          totalPoints: 0,
          seasonPoints: 0,
          rating: 0,
          bestRank: 0,
          bestScore: 9,
          currentStreak: 0,
          bestStreak: 0,
        },
      ]),
      catalogue,
    );

    expect(cards.find((c) => c.isTrading)?.artSrc).toBe(
      "/uploads/trading-banner.webp",
    );
    expect(
      cards.find((c) => c.gameKey.includes("circuit-sprint"))?.artSrc,
    ).toBe("/uploads/sprint-thumb.webp");
    expect(cards.find((c) => c.gameKey.includes("volt-stack"))?.artSrc).toBe(
      overviewPlayCardArt("volt-stack", false),
    );
  });

  it("caps at OVERVIEW_PLAY_CARD_LIMIT", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      gameKey: `provider:chartvolt:g${i}`,
      label: `G${i}`,
      isTrading: false,
      contestsEntered: 10 - i,
      contestsCompleted: 1,
      wins: 0,
      podiums: 0,
      totalPoints: 0,
      seasonPoints: 0,
      rating: 0,
      bestRank: 0,
      bestScore: 1,
      currentStreak: 0,
      bestStreak: 0,
    }));
    const cards = buildTopPlayCards(standing(many), []);
    expect(cards).toHaveLength(OVERVIEW_PLAY_CARD_LIMIT);
  });

  it("overview standing service never calls getEnabledGameTypes", () => {
    const code = readFileSync(
      join(ROOT, "lib/services/games/overview-standing.service.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/getEnabledGameTypes/);
  });
});

describe("Overview streaks chrome", () => {
  it("uses contest-shaped labels from _overall — never trading-day wording", () => {
    const ui = readFileSync(
      join(ROOT, "components/dashboard/overview/OverviewStreaks.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const service = readFileSync(
      join(ROOT, "lib/services/games/overview-standing.service.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    expect(ui).toMatch(/Podium streak/);
    expect(ui).toMatch(/Best streak/);
    expect(ui).toMatch(/Contest wins/);
    expect(ui).toMatch(/Contests played/);
    expect(ui).toMatch(/Top 3 finishes/);
    expect(ui).toMatch(/Weeks active/);
    expect(ui).not.toMatch(/Profitable Days/);
    expect(ui).not.toMatch(/Trading Days/);
    expect(ui).not.toMatch(/Win Streak/);
    expect(ui).not.toMatch(/Loss Streak/);

    // Reason: streaks must come from overall UserGameStats fields, never from
    // the trading trade-streak calculator on comprehensive-dashboard.
    expect(service).toMatch(/bestStreak:\s*overall\?\.bestStreak/);
    expect(service).toMatch(/contestWins:\s*wins/);
    expect(service).toMatch(/podiumStreak:\s*overall\?\.currentStreak/);
    expect(service).not.toMatch(/consecutiveProfitableDays/);
    expect(service).not.toMatch(/tradingDaysThisMonth/);
    expect(service).not.toMatch(/calculateStreaks/);
  });
});

describe("overview assets on disk", () => {
  it("every registered overview asset file exists", () => {
    for (const src of allOverviewAssets()) {
      const rel = src.replace(/^\//, "");
      expect(existsSync(join(ROOT, "public", rel))).toBe(true);
    }
  });
});
