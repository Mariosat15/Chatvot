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
  const tradingSummary = readCode(
    "components/trading/lobby/TradingLobbySummary.tsx",
  );
  const tradingTabs = readCode(
    "components/competitions/detail/TradingDetailTabs.tsx",
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
    expect(tradingPage).toContain("<CompetitionDetailShell");
  });

  it("puts summary StatCards outside the hero on both kinds", () => {
    expect(gameLobby).toContain('size="lg"');
    expect(gameLobby).toContain("<StatCard");
    expect(tradingSummary).toContain('size="lg"');
    expect(tradingSummary).toContain("<StatCard");
    // Hero file must not own the KPI strip (that was the thin-row layout).
    const tradingHero = readCode(
      "components/trading/lobby/TradingLobbyHero.tsx",
    );
    expect(tradingHero).not.toContain("<StatCard");
  });

  it("game main is Overview → How it works → Leaderboard", () => {
    expect(gameLobby).toContain('<ContestOverviewPanel');
    expect(gameLobby).toContain('kind="game"');
    expect(gameLobby).toContain("<ContestHowItWorks");
    expect(gameLobby).toContain("<LobbyLiveLeaderboard");
    expect(gameLobby).toContain("<CompetitionRulesFairPlay");
    expect(gameLobby).toContain("<GameEventDetails");
  });

  it("trading main is Leaderboard first, then detail tabs with How it works", () => {
    expect(tradingPage).toContain("<TradingDetailTabs");
    expect(tradingPage).toContain("<CompetitionLeaderboard");
    const boardIdx = tradingPage.indexOf("<CompetitionLeaderboard");
    const tabsIdx = tradingPage.indexOf("<TradingDetailTabs");
    expect(boardIdx).toBeGreaterThan(-1);
    expect(tabsIdx).toBeGreaterThan(boardIdx);
    expect(tradingTabs).toContain('kind="trading"');
    expect(tradingTabs).toContain("<ContestHowItWorks");
    expect(tradingTabs).toContain("embedded");
  });

  it("dresses KPI tiles with Menuitems Volt icons", () => {
    expect(gameLobby).toContain("COMPETITION_ICON.volts");
    expect(tradingSummary).toContain("COMPETITION_ICON.volts");
    expect(gameLobby).toContain("COMPETITION_ICON.wallet");
    expect(tradingSummary).toContain("COMPETITION_ICON.wallet");
  });

  it("entry uses Menuitems join artwork, not a yellow CSS pill alone", () => {
    const entry = readCode("components/trading/CompetitionEntryButton.tsx");
    expect(entry).toContain("LobbyJoinArtworkButton");
    expect(entry).toContain('variant={isUpcoming ? "reserve" : "join"}');
  });
});
