import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildTopPlayCards,
  resolvePlayCardBestScore,
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
  it("uses a dedicated PNG for ranks 1..20 with no text overlay", () => {
    for (let n = 1; n <= OVERVIEW_RANK_TOP_N; n++) {
      const badge = resolveOverviewRankBadge(n);
      expect(badge.inTopN).toBe(true);
      expect(badge.overlay).toBeNull();
      expect(badge.src).toBe(`/assets/neon/overview/ranks/${n}.png`);
      expect(badge.rank).toBe(n);
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

  it("shows best score from stored field, totalPoints fallback, or round max", () => {
    expect(
      resolvePlayCardBestScore({
        gameKey: "provider:x:g",
        bestScore: 900,
        totalPoints: 50,
      }),
    ).toBe(900);
    // Reason: UserGameStats.bestScore was often left at 0 while contests still ran.
    expect(
      resolvePlayCardBestScore({
        gameKey: "provider:x:g",
        bestScore: 0,
        totalPoints: 1224,
      }),
    ).toBe(1224);
    expect(
      resolvePlayCardBestScore(
        { gameKey: "provider:x:g", bestScore: 0, totalPoints: 0 },
        440,
      ),
    ).toBe(440);
    expect(
      resolvePlayCardBestScore({
        gameKey: "trading",
        isTrading: true,
        bestScore: 0,
        totalPoints: 88,
      }),
    ).toBe(88);
    expect(
      resolvePlayCardBestScore({
        gameKey: "provider:x:g",
        bestScore: 0,
        totalPoints: 0,
      }),
    ).toBeNull();
  });

  it("merges round bests into play cards so the UI is not stuck on a dash", () => {
    const cards = buildTopPlayCards(
      standing([
        {
          gameKey: "provider:chartvolt:circuit-sprint",
          label: "Sprint",
          isTrading: false,
          contestsEntered: 14,
          contestsCompleted: 14,
          wins: 1,
          podiums: 2,
          totalPoints: 0,
          seasonPoints: 0,
          rating: 0,
          bestRank: 2,
          bestScore: 0,
          currentStreak: 0,
          bestStreak: 0,
        },
      ]),
      catalogue,
      4,
      new Map([["provider:chartvolt:circuit-sprint", 1280]]),
    );
    expect(cards[0]?.bestScore).toBe(1280);
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

  it("overview client tiles never import the Mongo-backed standing service", () => {
    // Reason (R58): even `import type` from overview-standing.service pulls
    // mongoose into the browser graph under Turbopack when a sibling value
    // import exists — OverviewPlayByGame imported OVERVIEW_PLAY_CARD_LIMIT.
    const dir = join(ROOT, "components/dashboard/overview");
    const files = [
      "OverviewPlayByGame.tsx",
      "OverviewStreaks.tsx",
      "OverviewActivity.tsx",
      "OverviewProgress.tsx",
      "OverviewHero.tsx",
      "OverviewKpiRow.tsx",
      "OverviewBackdrop.tsx",
    ];
    for (const name of files) {
      const code = readFileSync(join(dir, name), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(code).not.toMatch(/overview-standing\.service/);
    }
    // Cap must live in the model-free types module.
    expect(
      readFileSync(join(ROOT, "lib/services/games/overview-types.ts"), "utf8"),
    ).toMatch(/OVERVIEW_PLAY_CARD_LIMIT\s*=\s*4/);
  });

  it("overview Header is nav-only — logo, level, bell and profile live elsewhere", () => {
    const header = readFileSync(
      join(ROOT, "components/Header.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(header).toMatch(/NavItems/);
    expect(header).not.toMatch(/UserDropdown/);
    expect(header).not.toMatch(/NotificationDropdown/);
    expect(header).not.toMatch(/\/api\/user\/level/);
    expect(header).not.toMatch(/appLogo/);
  });

  it("Overview tab mounts the mountain backdrop with faded washes", () => {
    const layout = readFileSync(
      join(ROOT, "components/dashboard/DashboardLayout.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const backdrop = readFileSync(
      join(ROOT, "components/dashboard/overview/OverviewBackdrop.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(layout).toMatch(/OverviewBackdrop/);
    expect(backdrop).toMatch(/OVERVIEW_BACKDROP/);
    expect(backdrop).toMatch(/bg-gradient-to-b/);
    expect(backdrop).toMatch(/bg-gradient-to-r/);
  });

  it("KPI row uses the horizontal spark layout and never invents week deltas", () => {
    const kpi = readFileSync(
      join(ROOT, "components/dashboard/overview/OverviewKpiRow.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(kpi).toMatch(/SparkArea/);
    expect(kpi).toMatch(/w-\[48%\]/);
    expect(kpi).not.toMatch(/vs last week/i);
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
