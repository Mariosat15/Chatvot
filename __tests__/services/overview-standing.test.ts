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
    // Once the player has history, unplayed catalogue titles must not appear.
    expect(cards.every((c) => c.gameKey !== "provider:chartvolt:never-played")).toBe(
      true,
    );
  });

  it("falls back to catalogue rank when the player has not played yet", () => {
    const rankedCatalogue: BrowsableGame[] = [
      cat({
        slug: "volt-stack",
        gameKey: "provider:chartvolt:volt-stack",
        displayName: "Volt Stack",
        kind: "provider",
        gameCode: "volt-stack",
        sortOrder: 30,
        isFeatured: false,
      }),
      cat({
        slug: "circuit-sprint",
        gameKey: "provider:chartvolt:circuit-sprint",
        displayName: "Circuit Sprint",
        kind: "provider",
        gameCode: "circuit-sprint",
        sortOrder: 10,
        isFeatured: true,
        tagline: "Connect the paths, beat the clock!",
        bannerUrl: "/uploads/sprint.webp",
      }),
      cat({
        slug: "trading",
        gameKey: "trading",
        displayName: "Trading",
        kind: "trading",
        sortOrder: 20,
        isFeatured: false,
      }),
      cat({
        slug: "never-played",
        gameKey: "provider:chartvolt:never-played",
        displayName: "Never Played",
        kind: "provider",
        gameCode: "never-played",
        sortOrder: 40,
        isFeatured: false,
      }),
      cat({
        slug: "extra",
        gameKey: "provider:chartvolt:extra",
        displayName: "Extra",
        kind: "provider",
        gameCode: "extra",
        sortOrder: 50,
        isFeatured: false,
      }),
    ];

    const cards = buildTopPlayCards(standing([]), rankedCatalogue);

    expect(cards).toHaveLength(OVERVIEW_PLAY_CARD_LIMIT);
    // Featured first, then ascending sortOrder.
    expect(cards.map((c) => c.gameKey)).toEqual([
      "provider:chartvolt:circuit-sprint",
      "trading",
      "provider:chartvolt:volt-stack",
      "provider:chartvolt:never-played",
    ]);
    expect(cards.every((c) => c.contestsEntered === 0)).toBe(true);
    expect(cards.every((c) => c.bestScore === null)).toBe(true);
    expect(cards[0]?.tagline).toBe("Connect the paths, beat the clock!");
  });

  it("empty catalogue and no play yields an empty strip", () => {
    expect(buildTopPlayCards(standing([]), [])).toEqual([]);
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
    // Reason: owner 3 Oct 2026 — section header is the fire plate, not Lucide.
    expect(ui).toMatch(/OVERVIEW_ICON_ART\.fire/);
    expect(ui).not.toMatch(/\bFlame\b/);
    expect(ui).toMatch(/OVERVIEW_STREAK_ART\.bestStreak/);
    expect(ui).toMatch(/mix-blend-screen/);

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
      // Reason: re-pointed 29 Sep 2026 - desktop Overview markup now lives in DesktopDashboard.
      join(ROOT, "components/dashboard/desktop/DesktopDashboard.tsx"),
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

  it("KPI row matches the premium glass target — week row present, no lightning symbol", () => {
    const kpi = readFileSync(
      join(ROOT, "components/dashboard/overview/OverviewKpiRow.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(kpi).toMatch(/SparkArea/);
    expect(kpi).toMatch(/vs last week/);
    expect(kpi).toMatch(/WeekDelta/);
    // Reason: credit symbol stays on overview amounts — owner asked it restored
    // after a brief bare experiment (29 Sep 2026).
    expect(kpi).not.toMatch(/bare:\s*true/);
    // Reason: live poll renames the values — assert the formatVolts call sites, not the props.
    expect(kpi).toMatch(/formatVolts\(liveCredits\)/);
    expect(kpi).toMatch(/formatVolts\(livePrizes\)/);
    expect(kpi).toMatch(/linear-gradient\(110deg/);
    expect(kpi).toMatch(/fill/);
    expect(kpi).toMatch(/object-contain/);
    expect(kpi).toMatch(/h-14 w-14/);
    expect(kpi).toMatch(/scale-\[1\.08\]/);
    expect(kpi).not.toMatch(/h-12 w-12/);
    expect(kpi).not.toMatch(/scale-\[1\.35\]/);
    expect(kpi).not.toMatch(/w-\[48%\]/);
  });

  it("View All Missions links to profile journey tab and shows three missions in 2+1 with milestone tiles", () => {
    const progress = readFileSync(
      join(ROOT, "components/dashboard/overview/OverviewProgress.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const types = readFileSync(
      join(ROOT, "lib/services/games/overview-types.ts"),
      "utf8",
    );
    const standing = readFileSync(
      join(ROOT, "lib/services/games/overview-standing.service.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const layout = readFileSync(
      // Reason: re-pointed 29 Sep 2026 - desktop Overview markup now lives in DesktopDashboard.
      join(ROOT, "components/dashboard/desktop/DesktopDashboard.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const activity = readFileSync(
      join(ROOT, "components/dashboard/overview/OverviewActivity.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(progress).toMatch(/\/profile\?tab=journey/);
    expect(progress).not.toMatch(/href=["']\/journey["']/);
    expect(types).toMatch(/OVERVIEW_MISSION_LIMIT\s*=\s*3/);
    expect(standing).toMatch(/OVERVIEW_MISSION_LIMIT/);
    expect(standing).toMatch(/journeyMapName/);
    expect(standing).toMatch(/journeyMilestonesDone/);
    expect(standing).toMatch(/calculateMilestoneProgress/);
    // Reason: owner reference uses a star/lock tile strip, not the amber ring.
    expect(progress).toMatch(/MilestoneTiles/);
    expect(progress).not.toMatch(/MilestoneRing/);
    expect(progress).toMatch(/MILESTONE_TILE_CAP/);
    expect(progress).toMatch(/Active Missions/);
    expect(progress).toMatch(/View Leaderboard/);
    // Reason: the owner replaced the solid cyan crown pill with the supplied
    // neon button art (29 Sep 2026); it looms and presses like Matching Cards.
    expect(progress).toMatch(/OVERVIEW_COMPETE_ART\.viewLeaderboard/);
    expect(progress).not.toMatch(/OVERVIEW_COMPETE_ART\.crown/);
    // Reason: loom/press must match Matching Cards — brightness + scale, not scale alone.
    expect(progress).toMatch(
      /cursor-pointer[^"]*hover:brightness-125[^"]*hover:scale-110[^"]*active:scale-95[^"]*active:brightness-90[^"]*"\s*aria-label="View Leaderboard"/,
    );
    expect(progress).toMatch(/sm:col-span-2/);
    expect(progress).toMatch(/missions\.map/);
    expect(progress).toMatch(/Math\.round\(progressPercent\)/);
    expect(progress).toMatch(/OVERVIEW_ICON_ART/);
    // Reason: Player Progress header is the games plate (owner 3 Oct 2026).
    expect(progress).toMatch(/OVERVIEW_ICON_ART\.games/);
    expect(progress).toMatch(/object-cover/);
    // Reason: metric progress can hit 100% while badge gates remain — the card
    // must name Required badge under "% complete" or it looks finished.
    expect(progress).toMatch(/Required badge/);
    expect(progress).toMatch(/requiredBadges/);
    // Reason: Recent badges left the Progress panel — reference has milestone tiles only.
    expect(progress).not.toMatch(/Recent badges/);
    expect(progress).not.toMatch(/OVERVIEW_RECENT_BADGE_LIMIT/);
    expect(types).toMatch(/requiredBadges:\s*string\[\]/);
    expect(types).toMatch(/OVERVIEW_RECENT_BADGE_LIMIT\s*=\s*6/);
    expect(types).toMatch(/OVERVIEW_COMPETE_MATCH_LIMIT\s*=\s*3/);
    expect(standing).toMatch(/requiredBadgeIds/);
    expect(standing).toMatch(/resolveBadgeDisplayName/);
    expect(standing).toMatch(/getBadgesFromDB/);
    expect(layout).toMatch(/journeyMilestonesDone/);
    expect(layout).toMatch(/journeyMilestonesTotal/);
    expect(layout).toMatch(/OverviewCompete/);
    expect(layout).not.toMatch(/OVERVIEW_RECENT_BADGE_LIMIT/);
    expect(activity).toMatch(/OVERVIEW_ICON_ART\.activity/);
    expect(activity).toMatch(/object-contain/);
    expect(activity).toMatch(/trophyGlass/);
    expect(activity).not.toMatch(/Clock3/);
    // Reason: header tile is transparent — no black/sky fill behind the calendar.
    expect(activity).not.toMatch(/overflow-hidden rounded-lg border border-sky-400/);
  });

  it("Compete strip fetches ranked matches and links Match Cards", () => {
    const compete = readFileSync(
      join(ROOT, "components/dashboard/overview/OverviewCompete.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const client = readFileSync(
      join(ROOT, "components/leaderboard/LeaderboardClient.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const assets = readFileSync(
      join(ROOT, "lib/services/games/overview-assets.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(compete).toMatch(/\/api\/matchmaking\?action=ranked/);
    expect(compete).toMatch(/OVERVIEW_COMPETE_MATCH_LIMIT/);
    expect(compete).toMatch(/ChallengeCreateDialog/);
    expect(compete).toMatch(/\/leaderboard\?board=trading&view=cards/);
    expect(compete).toMatch(/Matching Cards/);
    expect(compete).toMatch(/OVERVIEW_COMPETE_ART/);
    expect(compete).toMatch(/btn-challenge|challenge|Challenge/);
    // Reason: Matching Cards + Challenge must loom on hover, press in, and show a hand.
    expect(compete).toMatch(/cursor-pointer/);
    // Reason: flipped 29 Sep 2026 - owner supplied neon button art for both
    // footer actions. CSS pills are gone; art brightens on hover and shrinks on press.
    expect(compete).not.toMatch(/const ACTION_BUTTON =/);
    expect(compete).toMatch(
      /const ART_ACTION =\s*"[^"]*cursor-pointer[^"]*hover:brightness-125[^"]*active:scale-\[0\.96\]/,
    );
    const actionRow = compete.indexOf('className="mt-auto grid grid-cols-2 gap-2"');
    expect(actionRow).toBeGreaterThan(-1);
    const cardFooter = compete.slice(actionRow, compete.indexOf("</article>", actionRow));
    expect(cardFooter.indexOf("setChallengeTarget(")).toBeGreaterThan(-1);
    expect(cardFooter.indexOf("href={MATCHING_CARDS_HREF}")).toBeGreaterThan(
      cardFooter.indexOf("setChallengeTarget("),
    );
    expect(cardFooter).toMatch(/OVERVIEW_COMPETE_ART\.challenge/);
    expect(cardFooter).toMatch(/OVERVIEW_COMPETE_ART\.matchingCards/);
    expect((cardFooter.match(/\$\{ART_ACTION\}/g) ?? []).length).toBe(2);
    // Reason: header Matching Cards survives only for the empty state.
    expect(compete).toMatch(
      /matches\.length === 0 && !loading && \([\s\S]*?MATCHING_CARDS_HREF/,
    );
    // Reason: Compete strip must show the same four tiles as Matching Cards, and
    // names must open ProfileCard like the leaderboard (not only a challenge dialog).
    expect(compete).toMatch(/overallScore/);
    expect(compete).toMatch(/Competitions/);
    expect(compete).toMatch(/won · entered/);
    expect(compete).toMatch(/competitionsWon/);
    expect(compete).toMatch(/competitionsEntered/);
    expect(compete).toMatch(/challengesWon/);
    expect(compete).toMatch(/challengesEntered/);
    expect(compete).toMatch(/>\s*1v1\s*</);
    expect(compete).toMatch(/ProfileCard/);
    expect(compete).toMatch(/setProfileTarget/);
    expect(compete).toMatch(/hover:underline/);
    // Reason: Level is UserLevel.currentLevel (profileLevel), never the Master/Beginner skill-band.
    expect(compete).toMatch(/profileLevel/);
    expect(compete).toMatch(/Lv\.\s*\{m\.profileLevel\}/);
    expect(compete).not.toMatch(/formatLevel\(m\.level\)/);
    // Reason: "won · entered" must match the COMPETITIONS / 1v1 label size, not
    // smaller. Raised from text-[9px] to text-[11px] on 29 Sep 2026 so the tile
    // text fills its box (owner); the equal-size claim is unchanged.
    const wonEntered = [...compete.matchAll(/won · entered[\s\S]{0,80}/g)];
    expect(wonEntered.length).toBeGreaterThanOrEqual(2);
    for (const hit of wonEntered) {
      const before = compete.slice(Math.max(0, hit.index! - 120), hit.index!);
      expect(before).toMatch(/text-\[11px\]/);
      expect(before).not.toMatch(/text-\[(8|9)px\]/);
    }
    expect(assets).toMatch(/OVERVIEW_COMPETE_ART/);
    expect(assets).toMatch(/btn-matching-cards\.png/);
    expect(assets).toMatch(/btn-challenge\.png/);
    expect(assets).toMatch(/icon-swords\.png/);
    expect(client).toMatch(/get\("view"\)\s*===\s*"cards"/);
    expect(client).toMatch(/initialViewMode/);
    const cards = readFileSync(
      join(ROOT, "components/leaderboard/MatchmakingCards.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    // Reason: Matching Cards must surface Score, Level, Competitions and 1v1
    // with entered + won — not Win/P&L as the primary four tiles.
    expect(cards).toMatch(/overallScore/);
    expect(cards).toMatch(/Competitions/);
    expect(cards).toMatch(/won · entered/);
    expect(cards).toMatch(/competitionsWon/);
    expect(cards).toMatch(/competitionsEntered/);
    expect(cards).toMatch(/challengesWon/);
    expect(cards).toMatch(/challengesEntered/);
    expect(cards).toMatch(/>\s*1v1\s*</);
    expect(cards).toMatch(/profileLevel/);
    expect(cards).not.toMatch(/P\.Factor/);
    expect(cards).not.toMatch(/uppercase">Win</);
  });

  it("Global Rank uses ranks art, not level plates", () => {
    const badge = readFileSync(
      join(ROOT, "lib/utils/overview-rank-badge.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const assets = readFileSync(
      join(ROOT, "lib/services/games/overview-assets.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(badge).toMatch(/\/assets\/neon\/overview\/ranks\//);
    expect(badge).not.toMatch(/\/assets\/neon\/overview\/levels\//);
    expect(assets).toMatch(/OVERVIEW_ICON_ART/);
    expect(assets).toMatch(/icon-progress\.png/);
    expect(assets).toMatch(/icon-target\.png/);
    expect(assets).toMatch(/icon-activity-calendar\.png/);
    // Reason: owner 3 Oct 2026 — KPI / streaks / Suggested headers remapped.
    expect(assets).toMatch(/icon-wallet\.jpg/);
    expect(assets).toMatch(/icon-chart-2\.png/);
    expect(assets).toMatch(/icon-chart\.jpg/);
    expect(assets).toMatch(/icon-trophy-neon\.jpg/);
    expect(assets).toMatch(/icon-games\.jpg/);
    expect(assets).toMatch(/icon-fire\.jpg/);
    expect(assets).toMatch(/icon-calendar-neon\.png/);
    expect(assets).toMatch(/icon-star\.jpg/);
    expect(assets).toMatch(/credits:\s*OVERVIEW_ICON_ART\.wallet/);
    expect(assets).toMatch(/winRate:\s*OVERVIEW_ICON_ART\.chart2/);
    expect(assets).toMatch(/roi:\s*OVERVIEW_ICON_ART\.chart/);
    expect(assets).toMatch(/prizes:\s*OVERVIEW_ICON_ART\.trophyNeon/);
  });

  it("Overview KPI and Compete poll light live endpoints, not full dashboard", () => {
    const kpi = readFileSync(
      join(ROOT, "components/dashboard/overview/OverviewKpiRow.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const compete = readFileSync(
      join(ROOT, "components/dashboard/overview/OverviewCompete.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const tracker = readFileSync(
      join(ROOT, "components/GlobalPresenceTracker.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(kpi).toMatch(/\/api\/dashboard\/overview-live/);
    expect(kpi).not.toMatch(/getComprehensiveDashboardData/);
    expect(compete).toMatch(/\/api\/user\/presence\?userIds=/);
    expect(tracker).toMatch(/releasePresenceTab/);
    expect(tracker).toMatch(/pagehide/);
  });

  it("Progress and Activity stretch to equal height", () => {
    const layout = readFileSync(
      // Reason: re-pointed 29 Sep 2026 - desktop Overview markup now lives in DesktopDashboard.
      join(ROOT, "components/dashboard/desktop/DesktopDashboard.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(layout).toMatch(/items-stretch/);
    expect(layout).toMatch(/journeyMapName/);
  });

  it("Welcome hero uses a compact ChartVolt banner strip", () => {
    const hero = readFileSync(
      join(ROOT, "components/dashboard/overview/OverviewHero.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const assets = readFileSync(
      join(ROOT, "lib/services/games/overview-assets.ts"),
      "utf8",
    );
    expect(hero).toMatch(/OVERVIEW_HERO_BANNER/);
    expect(hero).toMatch(/object-cover/);
    expect(hero).toMatch(/h-\[120px\]/);
    expect(hero).toMatch(/sm:h-\[136px\]/);
    expect(hero).toMatch(/lg:h-\[148px\]/);
    expect(hero).not.toMatch(/aspect-\[1024\/341\]/);
    expect(assets).toMatch(/hero-banner-elements\.jpg/);
    expect(assets).not.toMatch(/hero-banner-chartvolt\.png/);
  });

  it("Suggested for you art uses a fixed 16/8.5 cover ratio (Image 2)", () => {
    // Reason: owner Image 2 — aspect-[16/8.5] + object-cover on the hero only.
    // Cover must stay clean (no Upcoming / fee pills). h-20 strip remains forbidden.
    const suggestions = readFileSync(
      join(ROOT, "components/dashboard/GameSuggestionsCard.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(suggestions).toMatch(/aspect-\[16\/8\.5\]/);
    const artStart = suggestions.indexOf("aspect-[16/8.5]");
    expect(artStart).toBeGreaterThan(-1);
    // Reason: slice hero to the badge row — cover must not carry status pills.
    const artBlock = suggestions.slice(
      artStart,
      suggestions.indexOf("badgeGmFunded", artStart),
    );
    expect(artBlock.length).toBeGreaterThan(40);
    expect(artBlock).toMatch(/object-cover/);
    expect(artBlock).not.toMatch(/Upcoming/);
    expect(artBlock).not.toMatch(/Live/);
    expect(artBlock).not.toMatch(/entryFee/);
    expect(suggestions).not.toMatch(/h-20/);
    expect(suggestions).not.toMatch(/h-auto w-full/);
  });

  it("Suggested for you matches Image 2: clean cover, badges, full prize strip, Join plate", () => {
    // Reason: owner 3 Oct 2026 — Image 2 is the target. Full prize banner as
    // background (not a 42% framed crop); Join plate already says Join (never
    // overlay that word — that was the JJoin glitch); GM Funded from fundingMode.
    const suggestions = readFileSync(
      join(ROOT, "components/dashboard/GameSuggestionsCard.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const assets = readFileSync(
      join(ROOT, "lib/services/games/overview-assets.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const service = readFileSync(
      join(ROOT, "lib/services/games/game-suggestions.service.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(assets).toMatch(/SUGGESTED_PRIZE_ART/);
    expect(assets).toMatch(/SUGGESTED_UI_ART/);
    expect(assets).toMatch(/prize-trophy\.jpg/);
    expect(assets).toMatch(/prize-cubes\.png/);
    expect(assets).toMatch(/icon-clock\.jpg/);
    expect(assets).toMatch(/btn-join\.jpg/);
    expect(assets).toMatch(/SUGGESTED_PRIZE_ART[\s\S]*icon:/);
    expect(suggestions).toMatch(/suggestedPrizeArt/);
    expect(suggestions).toMatch(/SUGGESTED_UI_ART\.clock/);
    expect(suggestions).toMatch(/SUGGESTED_UI_ART\.users/);
    expect(suggestions).toMatch(/mix-blend-screen/);
    expect(suggestions).toMatch(/Starts in/);
    expect(suggestions).toMatch(/OVERVIEW_ICON_ART\.star/);
    expect(suggestions).toMatch(/SUGGESTED_PRIZE_ART\.icon/);
    expect(suggestions).not.toMatch(/\bSparkles\b/);
    // Join plate carries the label — never overlay "Join" + ArrowRight (JJoin).
    const joinIdx = suggestions.indexOf("SUGGESTED_UI_ART.join");
    expect(joinIdx).toBeGreaterThan(-1);
    const joinCta = suggestions.slice(
      suggestions.lastIndexOf("<span", joinIdx),
      suggestions.indexOf("</span>", suggestions.indexOf("sr-only", joinIdx)) + 7,
    );
    expect(joinCta).toMatch(/SUGGESTED_UI_ART\.join/);
    expect(joinCta).toMatch(/sr-only/);
    expect(joinCta).not.toMatch(/ArrowRight/);
    expect(joinCta).not.toMatch(/inline-flex items-center gap-1\.5/);
    // Curated play plates on Suggested (not stale catalogue banners).
    expect(service).toMatch(/overviewPlayCardArt/);
    expect(service).not.toMatch(/resolvePlayArt/);
    // GM Funded badge from real fundingMode — must not be omitted from the tree.
    expect(suggestions).toMatch(/fundingMode === "gm_funded"/);
    expect(suggestions).toMatch(/SUGGESTED_UI_ART\.badgeGmFunded/);
    expect(suggestions).toMatch(/SUGGESTED_UI_ART\.badgePrivate/);
    expect(suggestions).toMatch(/SUGGESTED_UI_ART\.badgePublic/);
    expect(suggestions).toMatch(/h-8 w-auto/);
    // Prize strip: full banner fill, not a 42% absolute crop in a framed box.
    expect(suggestions).toMatch(/h-\[88px\]/);
    expect(suggestions).not.toMatch(/w-\[42%\]/);
    expect(suggestions).not.toMatch(/absolute inset-y-0 right-0/);
    expect(suggestions).toMatch(/object-cover object-right/);
    expect(suggestions).toMatch(/isGmFunded\s*\?/);
    expect(suggestions).toMatch(/text-\[26px\]/);
    expect(suggestions).toMatch(/text-\[19px\]/);
    expect(suggestions).toMatch(/text-\[12px\].*uppercase/);
    expect(suggestions).toMatch(/h-\[50px\]/);
    // Starts-in row: clock plate sits beside the label; neither wears pill chrome.
    const callIdx = suggestions.lastIndexOf("startLabel(c.startTime");
    expect(callIdx).toBeGreaterThan(-1);
    const metaStart = suggestions.lastIndexOf("justify-between", callIdx);
    const usersIdx = suggestions.indexOf("SUGGESTED_UI_ART.users", callIdx);
    expect(metaStart).toBeGreaterThan(-1);
    expect(usersIdx).toBeGreaterThan(callIdx);
    const metaRow = suggestions.slice(metaStart, usersIdx + 40);
    expect(metaRow).toMatch(/SUGGESTED_UI_ART\.clock/);
    expect(metaRow).toMatch(/SUGGESTED_UI_ART\.users/);
    expect(metaRow).toMatch(/startLabel\(c\.startTime/);
    const labelSpan = suggestions.slice(
      suggestions.lastIndexOf("<span", callIdx),
      suggestions.indexOf("</span>", callIdx) + 7,
    );
    expect(labelSpan).toMatch(/startLabel\(c\.startTime/);
    expect(labelSpan).not.toMatch(/rounded-full/);
    expect(labelSpan).not.toMatch(/bg-/);
    expect(suggestions).toMatch(/xl:grid-cols-4/);
  });

  it("Play by Game caption distinguishes discovery from most-played", () => {
    const ui = readFileSync(
      join(ROOT, "components/dashboard/overview/OverviewPlayByGame.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(ui).toMatch(/hasPlayHistory/);
    expect(ui).toMatch(/Featured games to get started/);
    expect(ui).toMatch(/most played/);
    // Empty CTA is only for an empty catalogue — not the zero-play discovery path.
    expect(ui).toMatch(/No games available yet/);
  });

  it("Account Status collapses to a header bar — badges and support only when expanded", () => {
    const code = readFileSync(
      join(ROOT, "components/dashboard/AccountStatusCard.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    // Collapsed chrome is one full-width toggle button.
    expect(code).toMatch(/aria-expanded=\{expanded\}/);
    expect(code).toMatch(/py-2\.5/);
    // Reason: support footer must not render beside the collapsed bar.
    expect(code).not.toMatch(/!expanded\s*&&/);
    // Badges + support live inside the expanded panel (position, not a comment).
    const expandIdx = code.indexOf("expanded &&");
    const investigationBadge = code.indexOf("Investigation");
    const supportIdx = code.lastIndexOf("contact support");
    expect(expandIdx).toBeGreaterThan(-1);
    expect(investigationBadge).toBeGreaterThan(expandIdx);
    expect(supportIdx).toBeGreaterThan(expandIdx);
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
