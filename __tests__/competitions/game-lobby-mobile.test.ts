import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ChartVolt_Game_Competition_Lobby_Mobile_Cursor_Guide (15 Oct 2026).
 * Desktop three-column shell stays; phone is a dedicated vertical tree.
 */
function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const phone = read(
  "components/games/lobby/mobile/MobileGameCompetitionLobby.tsx",
);
const hero = read("components/games/lobby/mobile/MobileGameLobbyHero.tsx");
const run = read("components/games/lobby/mobile/MobileGameLobbyRunCard.tsx");
const metrics = read("components/games/lobby/mobile/MobileGameLobbyMetrics.tsx");
const status = read("components/games/lobby/mobile/MobileGameLobbyStatus.tsx");
const rounds = read("components/games/lobby/mobile/MobileGameLobbyRounds.tsx");
const lobby = read("components/games/ProviderContestLobby.tsx");
const desktopShell = read(
  "components/games/lobby/GameCompetitionArenaShell.tsx",
);

describe("game competition lobby mobile (owner guide)", () => {
  it("keeps desktop on the three-column shell and phone on its own tree", () => {
    expect(lobby).toContain("<GameCompetitionArenaShell");
    expect(lobby).toContain("<MobileGameCompetitionLobby");
    expect(lobby).toContain('className="min-[769px]:hidden min-w-0"');
    expect(lobby).toContain('className="hidden min-[769px]:block"');
    // Phone must not import the desktop column grid.
    expect(phone).not.toContain("xl:grid-cols-[");
    expect(phone).not.toContain("GameCompetitionArenaShell");
    expect(desktopShell).toContain("xl:grid-cols-[");
  });

  it("orders hero → status → Your Run → essentials → tab pages", () => {
    const heroAt = phone.indexOf("<MobileGameLobbyHero");
    const statusAt = phone.indexOf("<MobileGameLobbyStatus");
    const runAt = phone.indexOf("<MobileGameLobbyRunCard");
    const metricsAt = phone.indexOf("<MobileGameLobbyMetrics");
    const tabsAt = phone.indexOf("<MobileLobbyPages");
    expect(heroAt).toBeGreaterThan(-1);
    expect(statusAt).toBeGreaterThan(heroAt);
    expect(runAt).toBeGreaterThan(statusAt);
    expect(metricsAt).toBeGreaterThan(runAt);
    expect(tabsAt).toBeGreaterThan(metricsAt);
  });

  it("uses cover hero art and does not hardcode Circuit Sprint", () => {
    expect(hero).toContain("object-cover");
    expect(hero).toContain("min-h-[220px]");
    expect(hero).not.toMatch(/circuit\s*sprint/i);
    expect(phone).not.toMatch(/circuit-sprint|circuitSprint/);
    expect(run).not.toMatch(/circuit-sprint/);
    expect(metrics).not.toMatch(/circuit-sprint/);
  });

  it("puts one countdown on the status strip, not on essentials", () => {
    expect(status).toContain("InlineCountdown");
    expect(metrics).not.toContain("InlineCountdown");
    expect(metrics).toContain("Round time");
    expect(metrics).toContain("DATA_ICON.prizePool");
  });

  it("Your Run is the primary card with shared entry control", () => {
    expect(run).toContain("Your run");
    expect(run).toContain("LobbyLiveYourScoreValue");
    expect(run).toContain("entryControl");
    expect(lobby).toContain("entryControl");
  });

  it("tab pages cover overview, leaderboard, prizes, rounds, tips", () => {
    for (const id of ["overview", "leaderboard", "prizes", "rounds", "tips"]) {
      expect(phone).toContain(`id: "${id}"`);
    }
    expect(rounds).toContain("Your rounds");
    expect(phone).toContain("<MobileGameLobbyRounds");
  });

  it("caps the phone column and pads safe areas", () => {
    expect(phone).toContain("max-w-[430px]");
    expect(phone).toContain("env(safe-area-inset-bottom)");
  });
});
