import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ChartVolt_Game_Competition_Lobby_Mobile_Cursor_Guide (15 Oct 2026), rebuilt the same day
 * after the owner found the first pass "too busy, no flow, needs consistency with other
 * pages". Desktop three-column shell stays; the phone tree now reads in the same order as
 * the trading phone lobby and shares its hero, tiles, card shell and tabs.
 */
function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const phone = read("components/games/lobby/mobile/MobileGameCompetitionLobby.tsx");
const run = read("components/games/lobby/mobile/MobileGameLobbyRunCard.tsx");
const metrics = read("components/games/lobby/mobile/MobileGameLobbyMetrics.tsx");
const rounds = read("components/games/lobby/mobile/MobileGameLobbyRounds.tsx");
const lobby = read("components/games/ProviderContestLobby.tsx");
const tradingPhone = read("components/competitions/lobby/mobile/MobileCompetitionLobby.tsx");
const desktopShell = read("components/games/lobby/GameCompetitionArenaShell.tsx");

describe("game competition lobby mobile (owner guide)", () => {
  it("keeps desktop on the three-column shell and phone on its own tree", () => {
    expect(lobby).toContain("<GameCompetitionArenaShell");
    expect(lobby).toContain("<MobileGameCompetitionLobby");
    expect(lobby).toContain('className="min-[769px]:hidden min-w-0"');
    expect(lobby).toContain('className="hidden min-[769px]:block"');
    expect(phone).not.toContain("xl:grid-cols-[");
    expect(phone).not.toContain("GameCompetitionArenaShell");
    expect(desktopShell).toContain("xl:grid-cols-[");
  });

  it("reads like the trading phone lobby: hero → tiles → one action card → tabs", () => {
    const heroAt = phone.indexOf("<MobileLobbyHero");
    const metricsAt = phone.indexOf("<MobileGameLobbyMetrics");
    const runAt = phone.indexOf("<MobileGameLobbyRunCard");
    const tabsAt = phone.indexOf("<MobileLobbyPages");
    expect(heroAt).toBeGreaterThan(-1);
    expect(metricsAt).toBeGreaterThan(heroAt);
    expect(runAt).toBeGreaterThan(metricsAt);
    expect(tabsAt).toBeGreaterThan(runAt);
    // Same order in the trading tree.
    expect(tradingPhone.indexOf("<MobileLobbyMetrics")).toBeGreaterThan(
      tradingPhone.indexOf("<MobileLobbyHero"),
    );
  });

  it("shares the trading hero and tile instead of game-only forks", () => {
    expect(phone).toContain('kind="game"');
    expect(metrics).toContain("MobileLobbyTile");
    expect(metrics).not.toMatch(/function Tile\(/);
    expect(existsSync(join(process.cwd(), "components/games/lobby/mobile/MobileGameLobbyHero.tsx"))).toBe(false);
    expect(existsSync(join(process.cwd(), "components/games/lobby/mobile/MobileGameLobbyStatus.tsx"))).toBe(false);
    expect(phone).not.toMatch(/circuit-sprint|circuitSprint/i);
  });

  it("matches the trading page's spacing and background", () => {
    for (const token of ["max-w-[430px]", "gap-3.5", "px-4 pt-4", "rgba(1,7,20,.35)"]) {
      expect(phone).toContain(token);
      expect(tradingPhone).toContain(token);
    }
    expect(phone).toContain("env(safe-area-inset-bottom)");
  });

  it("has exactly one clock, in the fourth tile", () => {
    expect(metrics.match(/<InlineCountdown/g)?.length).toBe(1);
    expect(run).not.toContain("InlineCountdown");
    expect(phone).not.toContain("InlineCountdown");
    expect(metrics).toContain("DATA_ICON.prizePool");
  });

  it("sizes the tile countdown down so '12d 5h 30m 12s' fits a 360px half-width tile", () => {
    const tradingMetrics = read("components/competitions/lobby/mobile/MobileLobbyMetrics.tsx");
    for (const file of [metrics, tradingMetrics]) {
      const at = file.indexOf("<InlineCountdown");
      const tag = file.slice(at, file.indexOf("/>", at));
      expect(at).toBeGreaterThan(-1);
      expect(tag).toContain("whitespace-nowrap");
      expect(tag).toContain("text-[12px]");
    }
  });

  it("round time appears once, in the action card, not as a tile", () => {
    expect(metrics).not.toContain("Round time");
    expect(run).toContain('label="Round time"');
  });

  it("one action card: Your entry before joining, Your run after, values beside labels", () => {
    expect(run).toContain('title="Your entry"');
    expect(run).toContain('title="Your run"');
    expect(run).toContain("LobbyLiveYourScoreValue");
    expect(run).toContain("justify-between");
    // No second 2×2 grid of boxed stats.
    expect(run).not.toContain("grid-cols-2");
    expect(lobby).toContain('layout="mobile"');
    expect(lobby).toContain("entryControl: mobileEntryControl");
  });

  it("draws only tabs that have content, prizes last like trading", () => {
    for (const id of ["overview", "leaderboard", "rounds", "tips", "prizes"]) {
      expect(phone).toContain(`id: "${id}"`);
    }
    expect(phone).not.toContain("No tips for this game yet");
    expect(phone).not.toContain("No prize distribution");
    expect(phone).toMatch(/run\.isUserIn\s*\?/);
    expect(phone.indexOf('id: "prizes"')).toBeGreaterThan(phone.indexOf('id: "tips"'));
    expect(rounds).toContain("Your rounds");
  });
});
