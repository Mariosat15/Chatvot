import { describe, expect, it } from "vitest";
import { resolveGameDefinition } from "@/lib/competitions/game-definitions";
import { getCompetitionCTA } from "@/lib/competitions/competition-cta";
import { buildCompetitionPresentation } from "@/lib/competitions/build-competition-presentation";
import type { CompetitionListItem } from "@/lib/competitions/types";

function base(overrides: Partial<CompetitionListItem> = {}): CompetitionListItem {
  return {
    _id: "507f1f77bcf86cd799439011",
    name: "Profit & Glory Trading Cup",
    description: "Prove your trading skills in a live market showdown.",
    status: "active",
    entryFeeCredits: 10,
    prizePoolCredits: 20000,
    currentParticipants: 24,
    maxParticipants: 100,
    startTime: new Date(Date.now() - 3600_000).toISOString(),
    endTime: new Date(Date.now() + 86400_000).toISOString(),
    assetClasses: ["forex", "crypto", "stocks", "indices"],
    leverage: { max: 10 },
    gameType: "trading",
    ...overrides,
  };
}

describe("resolveGameDefinition", () => {
  it("defaults absent labels to trading", () => {
    expect(resolveGameDefinition({}).id).toBe("trading");
  });

  it("detects circuit sprint from name/key", () => {
    expect(
      resolveGameDefinition({
        gameType: "provider",
        gameKey: "provider:chartvolt:circuit-sprint",
        name: "Circuit Sprint Cup",
      }).id,
    ).toBe("circuitSprint");
  });
});

describe("getCompetitionCTA", () => {
  it("offers Join Competition for an eligible public live contest", () => {
    const cta = getCompetitionCTA({
      competition: base(),
      isRegistered: false,
      userBalance: 100,
      registrationClosed: false,
    });
    expect(cta.label).toMatch(/JOIN COMPETITION/i);
    expect(cta.disabled).toBe(false);
    expect(cta.variant).toBe("join");
  });

  it("offers Reserve Spot for upcoming", () => {
    const cta = getCompetitionCTA({
      competition: base({ status: "upcoming" }),
      isRegistered: false,
      userBalance: 100,
      registrationClosed: false,
    });
    expect(cta.variant).toBe("reserve");
  });

  it("routes private non-members to Join GM via the lobby", () => {
    const cta = getCompetitionCTA({
      competition: base({
        privateAccess: "joinable",
        privateGameMasterName: "Martou1993",
        isPrivate: true,
      }),
      isRegistered: false,
      userBalance: 100,
      registrationClosed: false,
    });
    expect(cta.variant).toBe("join_gm");
    expect(cta.href).toContain("/competitions/");
    expect(cta.label.toLowerCase()).toContain("join gm");
  });

  it("shows View Results for completed contests", () => {
    const cta = getCompetitionCTA({
      competition: base({ status: "completed" }),
      isRegistered: true,
      userBalance: 100,
      registrationClosed: true,
    });
    expect(cta.variant).toBe("results");
    expect(cta.href).toContain("/results");
  });

  it("uses Already In when the player is seated on an upcoming contest", () => {
    const cta = getCompetitionCTA({
      competition: base({ status: "upcoming" }),
      isRegistered: true,
      userBalance: 100,
      registrationClosed: false,
    });
    expect(cta.variant).toBe("already_in");
    expect(cta.label).toMatch(/already in/i);
  });
});

describe("buildCompetitionPresentation", () => {
  it("builds trading primary metrics without empty placeholders", () => {
    const p = buildCompetitionPresentation(base(), {
      isRegistered: false,
      userBalance: 100,
      registrationClosed: false,
      creditSymbol: "⚡",
      difficultyLabel: "Intermediate",
    });
    expect(p.gameName).toBe("Trading");
    expect(p.primaryMetrics.length).toBeGreaterThanOrEqual(3);
    expect(p.primaryMetrics.every((m) => m.value && m.value !== "-")).toBe(
      true,
    );
    expect(p.statusLabel).toBe("LIVE NOW");
    expect(p.tags).toEqual([{ label: "Admin", tone: "creator" }]);
  });

  it("marks a cancelled row for the card's ribbon-only status treatment", () => {
    const p = buildCompetitionPresentation(
      base({ status: "cancelled", cancellationReason: "refunded" }),
      {
        isRegistered: false,
        userBalance: 100,
        registrationClosed: true,
      },
    );
    expect(p.status === "cancelled" || p.status === "refunded").toBe(true);
    expect(p.statusLabel).toMatch(/REFUNDED|CANCELLED/i);
    expect(p).not.toHaveProperty("showCancelledRibbon");
    expect(p).not.toHaveProperty("cancelledRibbonLabel");
  });

  it("resolves Games/Dashboard play-card artwork for trading", () => {
    const p = buildCompetitionPresentation(base(), {
      isRegistered: false,
      userBalance: 100,
      registrationClosed: false,
    });
    expect(p.gameArtwork).toContain("/assets/neon/overview/play-trading");
    expect(p.artworkObjectPosition).toBeTruthy();
  });

  it("uses Circuit Sprint fields and never trading difficulty", () => {
    const p = buildCompetitionPresentation(
      base({
        name: "Circuit Sprint: Legendary Connect-A-Thon",
        gameType: "provider",
        gameKey: "provider:chartvolt:circuit-sprint",
        assetClasses: [],
        gameSettings: { mode: "Time Trial", gridSize: "medium" },
        attemptsPolicy: "best_of_n",
        attemptsAllowed: 3,
      }),
      {
        isRegistered: false,
        userBalance: 50,
        registrationClosed: false,
        difficultyLabel: "Apprentice Trader",
      },
    );
    expect(p.gameId).toBe("circuitSprint");
    expect(p.primaryMetrics.map((m) => m.key)).toEqual([
      "prizePool",
      "players",
      "duration",
      "boardSize",
    ]);
    expect(p.secondaryMetrics.map((m) => m.key)).toEqual([
      "entryFee",
      "mode",
      "rounds",
    ]);
    expect([...p.primaryMetrics, ...p.secondaryMetrics].some((m) => m.key === "difficulty"))
      .toBe(false);
  });

  it("uses Volt Velocity laps and track fields", () => {
    const p = buildCompetitionPresentation(
      base({
        name: "Volt Velocity Invitational",
        gameType: "provider",
        gameKey: "provider:chartvolt:volt-velocity",
        assetClasses: [],
        playMode: "scheduled",
        gameSettings: { trackId: "skyline", laps: 5 },
      }),
      {
        isRegistered: false,
        userBalance: 50,
        registrationClosed: false,
        difficultyLabel: "Expert",
      },
    );
    expect(p.gameId).toBe("voltVelocity");
    expect(p.secondaryMetrics.map((m) => [m.key, m.value])).toEqual([
      ["entryFee", "10 ⚡"],
      ["laps", "5"],
      ["track", "Skyline"],
    ]);
    expect([...p.primaryMetrics, ...p.secondaryMetrics].some((m) => m.key === "difficulty"))
      .toBe(false);
  });

  it("uses Volt Stack scoring instead of trading difficulty", () => {
    const p = buildCompetitionPresentation(
      base({
        name: "Volt Stack: Battle for Glory!",
        gameType: "provider",
        gameKey: "provider:chartvolt:volt-stack",
        assetClasses: [],
        gameSettings: { mode: "Endless" },
        attemptsPolicy: "best_of_n",
        attemptsAllowed: 5,
      }),
      {
        isRegistered: false,
        userBalance: 50,
        registrationClosed: false,
        difficultyLabel: "Skilled Trader",
      },
    );
    expect(p.primaryMetrics.map((m) => m.key)).toEqual([
      "prizePool",
      "players",
      "duration",
      "scoring",
    ]);
    expect(p.secondaryMetrics.map((m) => m.key)).toEqual([
      "entryFee",
      "mode",
      "rounds",
    ]);
  });
});
