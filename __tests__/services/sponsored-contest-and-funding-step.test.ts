import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSponsoredContest,
  sponsorDisplayName,
  sponsoredContestCopy,
} from "@/lib/utils/sponsored-contest-copy";
import {
  accessFundingStepError,
  effectiveFundingMode,
} from "@/lib/utils/access-funding-step";

/**
 * Owner, 2 Oct 2026: a Game Master-funded contest must say "Sponsored competition by <GM>"
 * and that it is free on every card, and Normal / Funded must be a step that both Game
 * Master wizards refuse to pass until it is picked.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("sponsored contest copy", () => {
  it("only gm_funded is sponsored", () => {
    expect(isSponsoredContest("gm_funded")).toBe(true);
    expect(isSponsoredContest("player_paid")).toBe(false);
    expect(isSponsoredContest(undefined)).toBe(false);
    expect(isSponsoredContest(null)).toBe(false);
  });

  it("names the Game Master and says the entry is free", () => {
    const copy = sponsoredContestCopy("Alice");
    expect(copy.headline).toBe("Sponsored competition by Alice");
    expect(copy.detail).toMatch(/Free to enter/);
    expect(copy.detail).toMatch(/Alice pays every seat/);
    expect(copy.entryLabel).toBe("FREE");
  });

  it("never prints an empty sponsor", () => {
    expect(sponsorDisplayName("  ")).toBe("your Game Master");
    expect(sponsorDisplayName(undefined)).toBe("your Game Master");
  });
});

describe("every contest surface shows the sponsored banner", () => {
  it.each([
    "components/trading/CompetitionCard.tsx",
    "components/game-page/GamePageContests.tsx",
    "components/games/catalogue/GameContestList.tsx",
    "components/trading/CompetitionEntryButton.tsx",
  ])("%s renders SponsoredContestBanner", (file) => {
    expect(code(file)).toMatch(/<SponsoredContestBanner/);
  });

  it("the card treats a sponsored contest as affordable and labels the fee FREE", () => {
    const card = code("components/trading/CompetitionCard.tsx");
    expect(card).toMatch(/canAfford\s*=\s*isSponsored\s*\|\|/);
    expect(card.match(/isSponsored\s*\?\s*"FREE"/g)?.length ?? 0).toBe(3);
  });

  it("the catalogue read carries the sponsor name only for gm_funded", () => {
    const svc = code("lib/services/games/player-catalogue.service.ts");
    expect(svc).toMatch(/c\.fundingMode === "gm_funded"\s*\?\s*\{\s*sponsoredBy:/);
    expect(svc).toMatch(/gameMasterName fundingMode/);
  });
});

describe("the Access & Funding step gate", () => {
  const base = { visibilityOptionCount: 2, visibility: "gm_private", fundingOffered: true };

  it("refuses until who-can-join is picked", () => {
    expect(
      accessFundingStepError({ ...base, visibility: undefined, fundingMode: "player_paid" }),
    ).toMatch(/who can join/);
  });

  it("refuses until who-pays is picked when funding is offered", () => {
    expect(accessFundingStepError({ ...base, fundingMode: undefined })).toMatch(
      /Normal or Funded by you/,
    );
  });

  it("does not ask about funding when it is not offered", () => {
    expect(
      accessFundingStepError({ ...base, fundingOffered: false, fundingMode: undefined }),
    ).toBeNull();
  });

  it("refuses with a support message when nothing is creatable", () => {
    expect(
      accessFundingStepError({ ...base, visibilityOptionCount: 0, fundingMode: "gm_funded" }),
    ).toMatch(/contact support/);
  });

  it("passes once both are picked", () => {
    expect(accessFundingStepError({ ...base, fundingMode: "gm_funded" })).toBeNull();
  });

  it("an unoffered or unpicked funding always posts player_paid", () => {
    expect(effectiveFundingMode(false, "gm_funded")).toBe("player_paid");
    expect(effectiveFundingMode(true, undefined)).toBe("player_paid");
    expect(effectiveFundingMode(true, "gm_funded")).toBe("gm_funded");
  });
});

describe("both wizards carry Access & Funding as a step", () => {
  const trading = code("app/(root)/gamemaster/create-competition/page-content.tsx");
  const provider = code("components/gamemaster/ProviderContestCreateForm.tsx");

  it("the trading wizard lists it third, between Financial and Schedule, and launches at 8", () => {
    expect(trading).toMatch(/number: 2,\s*title: "Financial"/);
    expect(trading).toMatch(/number: 3,\s*title: "Access & Funding"/);
    expect(trading).toMatch(/number: 4,\s*title: "Schedule"/);
    expect(trading).toMatch(/number: 8,\s*title: "Launch"/);
    expect(trading).toMatch(/currentStep < 8 \?/);
  });

  it("the trading wizard renders the step and refuses Next without a pick", () => {
    expect(trading).toMatch(/currentStep === 3 && \(\s*<TradingAccessFundingStep/);
    const next = trading.slice(trading.indexOf("if (currentStep === 3) {"));
    expect(next.length).toBeGreaterThan(50);
    expect(next.slice(0, 200)).toMatch(/accessFundingError\(\)/);
    expect(code("components/gamemaster/TradingAccessFundingStep.tsx")).toMatch(
      /<AccessFundingFields/,
    );
  });

  it("the trading wizard re-checks the step on launch and posts the effective funding", () => {
    const all = trading.slice(trading.indexOf("const validateAllSteps"));
    expect(all.slice(0, 2500)).toMatch(/accessFundingError\(\)/);
    expect(trading).toMatch(/fundingMode: effectiveFunding,/);
    expect(trading).not.toMatch(/fundingMode = "player_paid"/);
  });

  it("the provider wizard validates the step with the same helper and posts the effective funding", () => {
    expect(provider).toMatch(/accessFundingStepError\(/);
    expect(provider).toMatch(/fundingMode: effectiveFundingMode\(fundingOffered, fundingMode\)/);
    expect(provider).not.toMatch(/fundingMode = "player_paid"/);
  });

  it("the gate never pre-selects a funding mode", () => {
    const gate = code("components/gamemaster/CreateCompetitionGate.tsx");
    expect(gate).toMatch(/useState<FundingMode \| undefined>\(undefined\)/);
  });
});
