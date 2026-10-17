import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkFundingAllowed,
  computeFreePrivateReserve,
  isGmFundedContest,
  resolveCanCreateFreePrivate,
  type CheckFundingInput,
} from "@/lib/services/gamemaster/free-private-competition";
import {
  decideFreePrivateTermsAcceptance,
  FREE_PRIVATE_TERMS_SLUG,
} from "@/lib/services/gamemaster/free-private-terms-rules";
import { refuseFundedReserveEdit } from "../../apps/admin/lib/admin/free-private-edit-guard";
import { actionsForSubject, type IncidentSubjectFacts } from "../../apps/admin/lib/admin/incident-actions";

/**
 * Free Private (Game Master funded) competitions - the pure rules, the mirrors and the
 * structural guarantees on the cancel paths. The money movements themselves are proven
 * against a real MongoDB in `free-private-money.test.ts`.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

describe("computeFreePrivateReserve", () => {
  it("is entry fee times every place", () => {
    expect(computeFreePrivateReserve(10, 8)).toBe(80);
    expect(computeFreePrivateReserve(0.1, 3)).toBe(0.3);
  });

  it.each([
    [0, 8],
    [-5, 8],
    [Number.NaN, 8],
    ["10", 8],
    [10, 1],
    [10, 2.5],
    [10, undefined],
  ])("refuses fee=%s places=%s", (fee, places) => {
    expect(computeFreePrivateReserve(fee, places)).toBeNull();
  });
});

describe("isGmFundedContest", () => {
  it("only an exact gm_funded counts, so legacy contests stay player-paid", () => {
    expect(isGmFundedContest({ fundingMode: "gm_funded" })).toBe(true);
    expect(isGmFundedContest({ fundingMode: "player_paid" })).toBe(false);
    expect(isGmFundedContest({})).toBe(false);
    expect(isGmFundedContest(null)).toBe(false);
    expect(isGmFundedContest({ fundingMode: "GM_FUNDED" })).toBe(false);
  });
});

describe("resolveCanCreateFreePrivate", () => {
  it("the current package decides while it exists", () => {
    expect(
      resolveCanCreateFreePrivate({
        hasPackage: true,
        packageConfig: { canCreateFreePrivateCompetitions: false },
        cachedLimits: { canCreateFreePrivateCompetitions: true },
      }),
    ).toBe(false);
  });

  it("falls back to the cached limits for a deleted package", () => {
    expect(
      resolveCanCreateFreePrivate({
        hasPackage: false,
        cachedLimits: { canCreateFreePrivateCompetitions: true },
      }),
    ).toBe(true);
  });

  it("only an explicit true grants it", () => {
    expect(
      resolveCanCreateFreePrivate({
        hasPackage: true,
        packageConfig: { canCreateFreePrivateCompetitions: "true" },
      }),
    ).toBe(false);
  });
});

describe("checkFundingAllowed", () => {
  const base: CheckFundingInput = {
    requested: "gm_funded",
    visibility: "gm_private",
    platformEnabled: true,
    packageAllows: true,
    privateAllowed: true,
    entryFee: 5,
    maxParticipants: 10,
  };

  it("a funded private contest passes with its reserve", () => {
    expect(checkFundingAllowed(base)).toEqual({ ok: true, fundingMode: "gm_funded", reserve: 50 });
  });

  it.each([undefined, null, "", "  ", "player_paid"])("%s means player-paid", (requested) => {
    expect(checkFundingAllowed({ ...base, requested })).toEqual({ ok: true, fundingMode: "player_paid" });
  });

  it.each<[Partial<CheckFundingInput>, string]>([
    [{ requested: "free" }, "funding_unknown"],
    [{ visibility: "public" }, "funding_requires_private"],
    [{ platformEnabled: false }, "free_private_disabled"],
    [{ packageAllows: false }, "free_private_not_permitted"],
    [{ privateAllowed: false }, "free_private_not_permitted"],
    [{ entryFee: 0 }, "free_private_invalid_fee"],
    [{ maxParticipants: 1 }, "free_private_invalid_fee"],
  ])("refuses %o with %s", (override, reason) => {
    const verdict = checkFundingAllowed({ ...base, ...override });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe(reason);
  });

  it("a public contest is refused rather than silently downgraded to player-paid", () => {
    const verdict = checkFundingAllowed({ ...base, visibility: "public" });
    expect(verdict.ok).toBe(false);
    expect(verdict.fundingMode).toBe("gm_funded");
  });
});

describe("decideFreePrivateTermsAcceptance", () => {
  const facts = {
    userId: "u1",
    gameMasterId: "gm1",
    competitionId: "c1",
    liveVersion: "v2",
  };
  const accepted = {
    userId: "u1",
    termsSlug: FREE_PRIVATE_TERMS_SLUG,
    termsVersion: "v2",
    gameMasterId: "gm1",
    competitionId: "c1",
  };

  it("accepts this player, this contest, this wording", () => {
    expect(decideFreePrivateTermsAcceptance({ ...facts, acceptance: accepted }).ok).toBe(true);
  });

  it("fails closed when the terms page has no live version", () => {
    const d = decideFreePrivateTermsAcceptance({ ...facts, liveVersion: undefined, acceptance: accepted });
    expect(d).toMatchObject({ ok: false, code: "free_private_terms_unavailable" });
  });

  it.each([
    ["no acceptance", null],
    ["another player", { ...accepted, userId: "u2" }],
    ["another contest", { ...accepted, competitionId: "c2" }],
    ["another Game Master", { ...accepted, gameMasterId: "gm2" }],
    ["older wording", { ...accepted, termsVersion: "v1" }],
    ["another terms page", { ...accepted, termsSlug: "terms-other" }],
  ])("requires acceptance again for %s", (_label, acceptance) => {
    const d = decideFreePrivateTermsAcceptance({ ...facts, acceptance });
    expect(d).toMatchObject({ ok: false, code: "free_private_terms_required" });
  });
});

describe("refuseFundedReserveEdit", () => {
  it("freezes the fields the reserve was sized from", () => {
    expect(refuseFundedReserveEdit("gm_funded", ["name", "entryFee"])).toContain('"entryFee"');
    expect(refuseFundedReserveEdit("gm_funded", ["maxParticipants"])).toContain('"maxParticipants"');
  });

  it("leaves other fields and player-paid contests alone", () => {
    expect(refuseFundedReserveEdit("gm_funded", ["name", "description"])).toBeNull();
    expect(refuseFundedReserveEdit("player_paid", ["entryFee"])).toBeNull();
    expect(refuseFundedReserveEdit(undefined, ["entryFee"])).toBeNull();
  });

  it("a request-supplied 'constructor' is not a frozen field", () => {
    expect(refuseFundedReserveEdit("gm_funded", ["constructor", "__proto__"])).toBeNull();
  });
});

describe("Platform / Technical Fault incident action", () => {
  const facts = (over: Partial<IncidentSubjectFacts>): IncidentSubjectFacts => ({
    kind: "competition",
    status: "active",
    isPaused: false,
    isProviderGame: false,
    hasFinalLeaderboard: false,
    needsDecision: false,
    ...over,
  });
  const offered = (s: IncidentSubjectFacts) => actionsForSubject(s).map((a) => a.id);

  it("is offered on a funded contest before settlement", () => {
    for (const status of ["draft", "upcoming", "active"]) {
      expect(offered(facts({ status, isGmFunded: true }))).toContain("free_private_technical_fault");
    }
  });

  it("is never offered on a player-paid or settled contest", () => {
    expect(offered(facts({}))).not.toContain("free_private_technical_fault");
    expect(offered(facts({ isGmFunded: true, status: "completed" }))).not.toContain(
      "free_private_technical_fault",
    );
  });

  it("carries the owner's label", () => {
    const action = actionsForSubject(facts({ isGmFunded: true })).find(
      (a) => a.id === "free_private_technical_fault",
    );
    expect(action?.label).toBe("Platform / Technical Fault — Full GM Refund");
    expect(action?.movesMoney).toBe(true);
  });
});

describe("mirrored Free Private files are byte-identical", () => {
  it.each([
    "lib/services/gamemaster/free-private-competition.ts",
    "lib/services/gamemaster/free-private-create.ts",
    "lib/services/gamemaster/free-private-reserve.ts",
    "lib/services/gamemaster/funding-permission.ts",
    "lib/services/gamemaster/create-provider-competition.ts",
    "lib/services/gamemaster/gm-program-flags.ts",
    "lib/services/gamemaster/subscription-limits.ts",
    "lib/services/game-providers/provider-contest.service.ts",
    "lib/services/settlement/free-private-refund.ts",
    "lib/services/settlement/contest-completion.service.ts",
    "lib/services/settlement/exclusion-refund.ts",
    "lib/services/settlement/fees.service.ts",
    "lib/services/settlement/unscored-refund.ts",
    "database/models/incident.model.ts",
  ])("%s", (file) => {
    expect(read(`apps/admin/${file}`)).toBe(read(file));
  });
});

describe("cancel paths never refund a funded contest to its players", () => {
  it.each([
    "lib/actions/trading/competition-cancel.actions.ts",
    "apps/admin/lib/actions/trading/competition-cancel.actions.ts",
  ])("%s skips the player loop and refunds the Game Master", (file) => {
    const code = stripComments(read(file));
    expect(code).toMatch(/for \(const participant of fundedGameMaster \? \[\] : participants\)/);
    expect(code).toMatch(/refundFundedContestToGameMaster\(\{/);
  });

  it("admin cancel releases the reserve even with no entrants", () => {
    const code = stripComments(read("apps/admin/lib/actions/trading/competition-cancel.actions.ts"));
    expect(code).toMatch(/participantCount > 0 \|\| isGmFundedContest\(competition\)/);
  });

  it("emergency cancel of a funded contest is a technical fault", () => {
    const code = stripComments(read("apps/admin/lib/actions/trading/competition-cancel.actions.ts"));
    const at = code.indexOf("async function emergencyCancelActiveCompetition");
    expect(at).toBeGreaterThan(-1);
    expect(code.slice(at)).toMatch(/outcome: "technical_fault"/);
  });
});
