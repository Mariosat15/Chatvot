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
  });

  it("marks cancelled cards with a ribbon label (not a giant watermark)", () => {
    const p = buildCompetitionPresentation(
      base({ status: "cancelled", cancellationReason: "refunded" }),
      {
        isRegistered: false,
        userBalance: 100,
        registrationClosed: true,
      },
    );
    expect(p.status === "cancelled" || p.status === "refunded").toBe(true);
    expect(p.showCancelledRibbon).toBe(true);
    expect(p.cancelledRibbonLabel).toMatch(/CANCELLED/i);
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

  it("omits assets for a provider puzzle with no assetClasses", () => {
    const p = buildCompetitionPresentation(
      base({
        name: "Circuit Sprint: Legendary Connect-A-Thon",
        gameType: "provider",
        gameKey: "provider:chartvolt:circuit-sprint",
        assetClasses: [],
        gameSettings: { mode: "Time Trial", track: "Neon City" },
      }),
      {
        isRegistered: false,
        userBalance: 50,
        registrationClosed: false,
      },
    );
    expect(p.gameId).toBe("circuitSprint");
    expect(p.primaryMetrics.some((m) => m.key === "assets")).toBe(false);
  });
});
