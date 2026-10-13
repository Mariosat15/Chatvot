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
    expect(mobileTrading).toContain("<MobileLobbyTabs");
    // Battle Plan is stacked inside the Overview tab body, not beside About.
    const mobileTabs = readCode(
      "components/competitions/lobby/mobile/MobileLobbyTabs.tsx",
    );
    expect(mobileTabs).toContain("<MobileLobbyOverview");
    expect(mobileTabs).toContain("<MobileLobbyBattlePlan");
    expect(mobileStats).toContain('size="lg"');
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
