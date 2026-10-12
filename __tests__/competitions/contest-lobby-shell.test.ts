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

describe("both lobbies share the overview shell", () => {
  const gameLobby = readCode("components/games/ProviderContestLobby.tsx");
  const tradingPage = readCode("app/(root)/competitions/[id]/page.tsx");
  const tradingHero = readCode(
    "components/trading/lobby/TradingLobbyHero.tsx",
  );

  it("mounts ContestOverviewPanel and ContestHowItWorks on the game lobby", () => {
    expect(gameLobby).toContain('<ContestOverviewPanel');
    expect(gameLobby).toContain('kind="game"');
    expect(gameLobby).toContain("<ContestHowItWorks");
  });

  it("mounts ContestOverviewPanel and ContestHowItWorks on the trading lobby", () => {
    expect(tradingPage).toContain("<ContestOverviewPanel");
    expect(tradingPage).toContain('kind="trading"');
    expect(tradingPage).toContain("<ContestHowItWorks");
  });

  it("dresses both heroes with Menuitems Volt icons", () => {
    expect(gameLobby).toContain("COMPETITION_ICON.volts");
    expect(tradingHero).toContain("COMPETITION_ICON.volts");
    expect(gameLobby).toContain("COMPETITION_ICON.wallet");
    expect(tradingHero).toContain("COMPETITION_ICON.wallet");
  });

  it("entry uses Menuitems join artwork, not a yellow CSS pill alone", () => {
    const entry = readCode("components/trading/CompetitionEntryButton.tsx");
    expect(entry).toContain("LobbyJoinArtworkButton");
    expect(entry).toContain('variant={isUpcoming ? "reserve" : "join"}');
  });
});
