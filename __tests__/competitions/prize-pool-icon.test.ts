import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_ICON } from "@/lib/constants/data-icons";

/**
 * Owner, 15 Oct 2026: every prize-pool icon on every page, phone and desktop,
 * is the uploaded goldTrophy. One icon per piece of data, like the entry fee.
 */
const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

const SITES = [
  "components/games/lobby/GameLobbySummary.tsx",
  "components/competitions/lobby/mobile/MobileLobbyMetrics.tsx",
  "components/competitions/detail/mobile/MobileTradingStats.tsx",
  "components/trading/lobby/TradingLobbySummary.tsx",
  "lib/competitions/build-competition-presentation.ts",
  "components/competitions/arena/ArenaKpiCards.tsx",
  "components/games/arena/ArenaContestPanelView.tsx",
  "components/trading/GameLiveRankingPanel.tsx",
  "components/trading/GameModeTradingPage.tsx",
];
const COMPONENT_SITES = [
  "components/trading/CompetitionCard.tsx",
  "components/trading/CompetitionInfoHeader.tsx",
  "components/trading/LiveRankingPanel.tsx",
  "components/challenges/create/ChallengePrizeSummary.tsx",
  "components/dashboard/ContestsSidebar.tsx",
];

describe("prize pool icon is the goldTrophy everywhere", () => {
  it("the asset exists", () => {
    expect(existsSync(join(root, "public", DATA_ICON.prizePool))).toBe(true);
  });

  it.each(SITES)("%s reads DATA_ICON.prizePool", (file) => {
    expect(read(file)).toContain("DATA_ICON.prizePool");
  });

  it.each(COMPONENT_SITES)("%s renders PrizePoolIcon", (file) => {
    expect(read(file)).toContain("<PrizePoolIcon");
  });

  it("the arena prize tile no longer uses the generic trophy", () => {
    expect(read("components/games/arena/ArenaContestPanelView.tsx")).not.toContain(
      'NEON_ICON("trophy-gold")',
    );
    expect(read("lib/competitions/build-competition-presentation.ts")).not.toContain(
      '["prizePool", COMPETITION_ICON.trophyGold]',
    );
  });
});
