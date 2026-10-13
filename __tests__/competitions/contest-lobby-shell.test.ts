import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  contestModeLabel,
  contestNotInDetail,
  contestNotInTitle,
  contestPlayersLabel,
} from "@/components/competitions/lobby/contest-lobby-copy";

function readCode(relativePath: string): string {
  const source = readFileSync(join(process.cwd(), relativePath), "utf8");
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("contest lobby copy is kind-scoped, never game-coded", () => {
  it("labels players and traders differently", () => {
    expect(contestPlayersLabel("game")).toMatch(/player/i);
    expect(contestPlayersLabel("trading")).toMatch(/trader/i);
  });

  it("names the mode without inventing a title", () => {
    expect(contestModeLabel("game")).toBe("Competition");
    expect(contestModeLabel("trading")).toBe("Trading");
  });

  it("keeps the not-in card playful on both kinds", () => {
    expect(contestNotInTitle("game")).toMatch(/not/i);
    expect(contestNotInDetail("trading")).toMatch(/jump in|compete/i);
  });

  it("never enumerates a game code in the copy module", () => {
    const code = readCode(
      "components/competitions/lobby/contest-lobby-copy.ts",
    );
    expect(code).not.toMatch(/circuit-sprint|gameCode|providerKey/);
  });
});

describe("competition detail shell (Cursor Spec hierarchy)", () => {
  const shell = readCode(
    "components/competitions/detail/CompetitionDetailShell.tsx",
  );
  const gameLobby = readCode("components/games/ProviderContestLobby.tsx");
  const tradingPage = readCode("app/(root)/competitions/[id]/page.tsx");
  const desktopTrading = readCode(
    "components/competitions/detail/DesktopTradingLobby.tsx",
  );
  const mobileTrading = readCode(
    "components/competitions/lobby/mobile/MobileCompetitionLobby.tsx",
  );
  const tradingSummary = readCode(
    "components/trading/lobby/TradingLobbySummary.tsx",
  );
  const mobileStats = readCode(
    "components/competitions/lobby/mobile/MobileLobbyMetrics.tsx",
  );
  const tradingTabs = readCode(
    "components/competitions/detail/TradingDetailTabs.tsx",
  );
  const tradingOverview = readCode(
    "components/competitions/detail/TradingOverview.tsx",
  );

  it("defines one max-width shell with a 2fr / 0.9fr main+sidebar grid", () => {
    expect(shell).toContain("max-w-[1600px]");
    expect(shell).toMatch(
      /lg:grid-cols-\[minmax\(0,2fr\)_minmax\(340px,0\.9fr\)\]/,
    );
    expect(shell).toContain("summary");
    expect(shell).toContain("sidebar");
  });

  it("paints the competitions hub's arena backdrop behind both lobbies", () => {
    // One constant, shared with `CompetitionsArena`, so the detail page cannot drift to a
    // second background file. The backdrop wrapper must OPEN before the max-width container,
    // or the image is clipped to 1600px and the page edges stay bare.
    expect(shell).toContain(
      'import { COMPETITIONS_ARENA_BG } from "@/lib/competitions/game-definitions"',
    );
    const bgAt = shell.indexOf("url(${COMPETITIONS_ARENA_BG})");
    const containerAt = shell.indexOf("max-w-[1600px]");
    expect(bgAt).toBeGreaterThan(-1);
    expect(bgAt).toBeLessThan(containerAt);
  });

  it("mounts both lobbies on CompetitionDetailShell", () => {
    expect(gameLobby).toContain("<CompetitionDetailShell");
    // Flipped 13 Oct 2026 (Complobyymobile): phone tree is MobileCompetitionLobby under
    // lobby/mobile/; breakpoint is 769px (min-[769px]), not Tailwind `md`.
    expect(desktopTrading).toContain("<CompetitionDetailShell");
    expect(tradingPage).toContain("<DesktopTradingLobby");
    expect(tradingPage).toContain("<MobileCompetitionLobby");
    expect(tradingPage).toContain('className="min-[769px]:hidden min-w-0"');
    expect(tradingPage).toContain('className="hidden min-[769px]:block"');
  });

  it("phone trading lobby is a dedicated tree, not a squeezed desktop shell", () => {
    expect(mobileTrading).not.toContain("CompetitionDetailShell");
    expect(mobileTrading).not.toContain("lg:grid-cols-[minmax(0,2fr)");
    expect(mobileTrading).toContain("max-w-[430px]");
    expect(mobileTrading).toContain("env(safe-area-inset-bottom)");
    // Flipped 13 Oct 2026 (mobile fix guide), not deleted: the swipe tab strip was wider
    // than the phone and hid every block but one, so the page became one vertical flow with
    // jump chips. Flipped AGAIN 13 Oct 2026 (third pass), on the owner's correction: the
    // chips wrapped out of line and left every block stacked below, so the menu is now ONE
    // row of compact tabs (MobileLobbyPages) where each tab is a small page. The original
    // objection still holds - the old swipe strip must not return.
    expect(mobileTrading).not.toContain("<MobileLobbyTabs");
    expect(mobileTrading).not.toContain("MobileLobbyChips");
    expect(mobileTrading).toContain("<MobileLobbyPages");
    // Reason (flipped 13 Oct 2026, owner): "About this competition" was removed from the phone,
    // so the Overview page is the Battle plan alone at full width - no half-width split.
    const overviewPage = mobileTrading.slice(
      mobileTrading.indexOf('id: "overview"'),
      mobileTrading.indexOf('id: "leaderboard"'),
    );
    expect(overviewPage.length).toBeGreaterThan(0);
    expect(overviewPage).not.toContain("grid-cols-2");
    expect(overviewPage).not.toContain("<MobileLobbyOverview");
    expect(mobileTrading).not.toContain("MobileLobbyOverview");
    expect(overviewPage).toContain("<MobileLobbyBattlePlan");
    // Difficulty, Trading rules and Risk share ONE page.
    const rulesPage = mobileTrading.slice(
      mobileTrading.indexOf('id: "rules"'),
      mobileTrading.indexOf('id: "prizes"'),
    );
    expect(rulesPage.length).toBeGreaterThan(0);
    expect(rulesPage).toContain("<MobileLobbyDifficulty");
    expect(rulesPage).toContain("ruleSections.map");
    expect(mobileTrading).not.toContain('label: "Battle Plan"');
    expect(mobileTrading).not.toContain('label: "Difficulty"');
    // The run panel is the phone layout of the shared dashboard, never the desktop one
    // (230px trophy, five-across tiles - the clipped "image 2", 13 Oct 2026).
    expect(mobileTrading).toContain('layout="mobile"');
    const runPanel = readCode(
      "components/trading/competition-dashboard/MobileRunPanel.tsx",
    );
    expect(runPanel).not.toContain("grid-cols-5");
    expect(runPanel).not.toMatch(/text-(4xl|5xl)/);
    expect(runPanel).not.toContain("hover:scale-");
    // The phone leaderboard must not wrap the 760px desktop table (the cut-off).
    const mobileBoard = readCode(
      "components/competitions/lobby/mobile/MobileLobbyLeaderboard.tsx",
    );
    expect(mobileBoard).not.toContain("CompetitionLeaderboard");
    expect(mobileBoard).toContain("isLeaderboardEntryDisqualified");
    // The entry card is the shared button, arranged for the phone.
    const mobileEntry = readCode(
      "components/competitions/lobby/mobile/MobileLobbyEntryPanel.tsx",
    );
    expect(mobileEntry).toContain('layout="mobile"');
    // Flipped 13 Oct 2026, not deleted: the KPI row is a real equal 2x2 grid of tiles,
    // not the desktop StatCard at `lg`.
    expect(mobileStats).toContain("grid-cols-2");
    expect(mobileStats).not.toContain('size="lg"');
    expect(mobileStats).not.toContain('size="showcase"');
    expect(mobileStats).toContain("COMPETITION_ICON.entryFee");
    expect(mobileStats).toContain("COMPETITION_ICON.volts");
    // Reason: fundingMode check must stay local — free-private-entry imports mongoose (R58).
    expect(mobileStats).not.toContain("free-private-entry");
    expect(mobileStats).toContain('fundingMode === "gm_funded"');
  });

  it("puts summary StatCards outside the hero on both kinds", () => {
    expect(gameLobby).toContain('size="lg"');
    expect(gameLobby).toContain("<StatCard");
    // Flipped 12 Oct 2026, not deleted: the trading KPI row moved from `lg` to the larger
    // `showcase` cards on the owner's reference; the game lobby keeps `lg`.
    expect(tradingSummary).toContain('size="showcase"');
    expect(tradingSummary).toContain("<StatCard");
    // Hero file must not own the KPI strip (that was the thin-row layout).
    const tradingHero = readCode(
      "components/trading/lobby/TradingLobbyHero.tsx",
    );
    expect(tradingHero).not.toContain("<StatCard");
  });

  it("game main is Overview → How it works → Leaderboard", () => {
    expect(gameLobby).toContain("<ContestOverviewPanel");
    expect(gameLobby).toContain('kind="game"');
    expect(gameLobby).toContain("<ContestHowItWorks");
    expect(gameLobby).toContain("<LobbyLiveLeaderboard");
    expect(gameLobby).toContain("<CompetitionRulesFairPlay");
    expect(gameLobby).toContain("<GameEventDetails");
  });

  it("trading main is detail tabs first, then the Leaderboard", () => {
    // Reason: this was "Leaderboard first, then tabs" until 12 Oct 2026, when the owner asked
    // for the tabs to move to the top of the main column ("move the section on the top").
    // Flipped rather than deleted so the earlier order stays on record.
    // Amended later 12 Oct: desktop composition lives in DesktopTradingLobby.
    expect(desktopTrading).toContain("<TradingDetailTabs");
    expect(desktopTrading).toContain("<CompetitionLeaderboard");
    const boardIdx = desktopTrading.indexOf("<CompetitionLeaderboard");
    const tabsIdx = desktopTrading.indexOf("<TradingDetailTabs");
    expect(tabsIdx).toBeGreaterThan(-1);
    expect(boardIdx).toBeGreaterThan(tabsIdx);
  });

  it("merges the trading Overview into one card instead of tiles plus a timeline", () => {
    // Reason: until 12 Oct 2026 the Overview rendered feature tiles beside an embedded
    // `<ContestHowItWorks kind="trading">` timeline, and both said the same things. The owner
    // asked for one card ("make this section all as one"), so the timeline must not come back.
    // Flipped rather than deleted so the earlier layout stays on record.
    expect(tradingTabs).not.toContain("<ContestHowItWorks");
    // Amended the same day: the owner's next reference brought back tiles beside a "Battle
    // plan", drawn by `TradingOverview` from one builder - still not the shared timeline.
    expect(tradingTabs).toContain(
      "<TradingOverview about={about} overview={overview} />",
    );
    expect(tradingOverview).not.toContain("<ContestHowItWorks");
    expect(tradingOverview).toContain("overview.features.map(");
    expect(tradingOverview).toContain("overview.steps.map(");
  });

  it("fills the tab panel instead of pushing rule cards to the left", () => {
    // Reason: a `max-w-3xl` wrapper left a third of the panel empty on wide screens (owner,
    // 12 Oct 2026). The odd-child span-2 was for a third Disqualification card; that card
    // moved into Trading Rules the same day, so the grid is a clean two-up and the span is gone.
    const accordions = readCode(
      "components/trading/lobby/trading-lobby-accordions.tsx",
    );
    expect(accordions).not.toContain("max-w-3xl");
    expect(accordions).not.toContain(
      "xl:[&>*:last-child:nth-child(odd)]:col-span-2",
    );
    expect(accordions).toContain('xl:grid-cols-2">');
    expect(accordions).not.toContain('title="Disqualification"');
  });

  it("drags the tab bar instead of showing a scrollbar", () => {
    expect(tradingTabs).toContain("[scrollbar-width:none]");
    expect(tradingTabs).toContain("[&::-webkit-scrollbar]:hidden");
    expect(tradingTabs).toContain("onPointerMove");
    // A drag must not also click the tab it ended on.
    expect(tradingTabs).toContain("onClickCapture");
  });

  it("writes the Overview from the contest's own facts", () => {
    expect(tradingOverview).toContain("overview.steps.map(");
    // Flipped 12 Oct 2026: built once on the page and handed to both trees as props
    // (both md trees stay mounted — building inside each would double every rule card).
    expect(tradingPage.match(/buildTradingOverviewCopy\(/g)?.length).toBe(1);
    expect(tradingPage).toMatch(/overview=\{lobbyOverview\}/);
    expect(desktopTrading).toMatch(/overview=\{overview\}/);
    expect(mobileTrading).toMatch(/overview=\{overview\}/);
    expect(desktopTrading).not.toContain("buildTradingOverviewCopy(");
    expect(mobileTrading).not.toContain("buildTradingOverviewCopy(");
  });

  it("headlines the dashboard with the figure the contest ranks on", () => {
    const dashboard = readCode("components/trading/CompetitionDashboard.tsx");
    expect(dashboard).toContain("rankedFigure(rankingMethod, stats)");
    expect(desktopTrading).toContain(
      "rankingMethod={competition.rankingMethod}",
    );
    expect(desktopTrading).toContain('id="competition-leaderboard"');
    expect(mobileTrading).toContain(
      "rankingMethod={competition.rankingMethod}",
    );
  });

  it("dresses KPI tiles with Menuitems Volt icons", () => {
    expect(gameLobby).toContain("COMPETITION_ICON.volts");
    expect(tradingSummary).toContain("COMPETITION_ICON.volts");
    expect(gameLobby).toContain("COMPETITION_ICON.wallet");
    // Flipped 12 Oct 2026: Entry fee uses owner wallet-up art; Simulated funds keep wallet.
    expect(tradingSummary).toContain("COMPETITION_ICON.entryFee");
    expect(tradingSummary).not.toContain("COMPETITION_ICON.wallet");
    // Overview Forex tile: candlestick art, not the shared volts / bar look.
    const overviewCopy = readCode(
      "components/competitions/lobby/trading-overview-copy.ts",
    );
    expect(overviewCopy).toContain("COMPETITION_ICON.candles");
  });

  it("entry uses Menuitems join artwork, not a yellow CSS pill alone", () => {
    const entry = readCode("components/trading/CompetitionEntryButton.tsx");
    expect(entry).toContain("LobbyJoinArtworkButton");
    expect(entry).toContain('variant={isUpcoming ? "reserve" : "join"}');
  });
});

describe("phone run panel and tab row refinements (owner, 13 Oct 2026)", () => {
  it("drops the title and schedule rows, renames Positions, and hides Starting Soon on mobile only", () => {
    const dashboard = readCode("components/trading/CompetitionDashboard.tsx");
    const mobile = dashboard.slice(dashboard.indexOf('if (layout === "mobile")'));
    expect(mobile.length).toBeGreaterThan(0);
    expect(mobile).toMatch(/row\.key !== "competition" && row\.key !== "when"/);
    expect(mobile).toMatch(/tile\.key === "open" \? \{ \.\.\.tile, label: "Positions" \}/);
    expect(mobile).toMatch(/competitionStatus === "upcoming" \? null : <StatusPill/);
    // Desktop keeps its own labels.
    expect(dashboard).toContain('"Open positions"');
  });

  it("labels the second run view Score, and the header no longer truncates", () => {
    const panel = readCode("components/trading/competition-dashboard/MobileRunPanel.tsx");
    expect(panel).toContain('label="Score"');
    expect(panel).not.toContain('label="Score breakdown"');
    const header = panel.slice(panel.indexOf("<h2"), panel.indexOf("</h2>"));
    expect(header.length).toBeGreaterThan(0);
    expect(header).not.toContain("truncate");
  });

  it("puts a scroll arrow at each end of the tab row", () => {
    const pages = readCode("components/competitions/lobby/mobile/MobileLobbyPages.tsx");
    expect(pages).toContain('<ScrollArrow direction="left"');
    expect(pages).toContain('<ScrollArrow direction="right"');
    expect(pages.indexOf('direction="left"')).toBeLessThan(pages.indexOf('role="tablist"'));
    expect(pages.indexOf('role="tablist"')).toBeLessThan(pages.indexOf('direction="right"'));
  });

  it("orders the prize podium 2nd, 1st, 3rd from the shared projection", () => {
    const rewards = readCode("components/competitions/lobby/mobile/MobileLobbyRewards.tsx");
    expect(rewards).toContain("PODIUM_ORDER = [2, 1, 3]");
    expect(rewards).toContain("projectPrizeDistribution(competition)");
    expect(rewards).toContain("items-end");
  });
});
