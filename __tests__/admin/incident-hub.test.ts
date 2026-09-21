/**
 * The incident hub catalogue, the dual grant, and the credit wording.
 *
 * Applicability is a pure function of the stored subject. The route tests are
 * structural because the grant helper throws from a session this file does not
 * open. Comments are stripped before a source assertion, because these files
 * name the anti-patterns in prose.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  actionsForSubject,
  explainInapplicable,
  type IncidentSubjectFacts,
} from "../../apps/admin/lib/admin/incident-actions";

const ROOT = join(__dirname, "..", "..");

function readCode(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function facts(
  overrides: Partial<IncidentSubjectFacts> & Pick<IncidentSubjectFacts, "kind">,
): IncidentSubjectFacts {
  return {
    status: "active",
    isPaused: false,
    isProviderGame: false,
    hasFinalLeaderboard: false,
    needsDecision: false,
    ...overrides,
  };
}

function ids(subject: IncidentSubjectFacts): string[] {
  return actionsForSubject(subject).map((action) => action.id);
}

describe("catalogue applicability follows the stored subject", () => {
  it("offers pause and emergency cancel on a live trading contest", () => {
    expect(ids(facts({ kind: "competition" }))).toEqual([
      "pause_contest",
      "emergency_cancel",
    ]);
  });

  it("offers resume instead of pause when the contest is already paused", () => {
    expect(ids(facts({ kind: "competition", isPaused: true }))).toEqual([
      "resume_contest",
      "emergency_cancel",
    ]);
  });

  it("offers cancel-and-refund only on an upcoming contest", () => {
    expect(ids(facts({ kind: "competition", status: "upcoming" }))).toEqual([
      "cancel_upcoming",
    ]);
  });

  it("offers re-settle only for a completed game contest that has a board", () => {
    const provider = facts({
      kind: "competition",
      status: "completed",
      isProviderGame: true,
      hasFinalLeaderboard: true,
    });
    expect(ids(provider)).toEqual(["re_settle", "adjust_results"]);
    const trading = facts({
      kind: "competition",
      status: "completed",
      hasFinalLeaderboard: true,
    });
    expect(ids(trading)).toEqual(["adjust_results"]);
    expect(explainInapplicable("re_settle", trading)).toMatch(/trading contest/);
  });

  it("gives a game contest the play consequences, not the trading ones", () => {
    const actions = actionsForSubject(
      facts({ kind: "competition", isProviderGame: true }),
    );
    const pause = actions.find((action) => action.id === "pause_contest");
    expect(pause?.consequences.join(" ")).not.toMatch(/position/i);
    expect(pause?.consequences.join(" ")).toMatch(/round/i);
    const emergency = actions.find((action) => action.id === "emergency_cancel");
    expect(emergency?.consequences.join(" ")).not.toMatch(/position/i);
    expect(emergency?.section).toBe("competitions");
  });

  it("offers the three round endings only when a decision is still owed", () => {
    const open = ids(facts({ kind: "round", needsDecision: true }));
    expect(open).toEqual([
      "resolve_round_void",
      "resolve_round_abandon",
      "resolve_round_expire",
    ]);
    expect(ids(facts({ kind: "round" }))).toEqual([]);
    const offered = actionsForSubject(facts({ kind: "round", needsDecision: true }));
    expect(offered.every((action) => action.section === "round-inspector")).toBe(
      true,
    );
  });

  it("offers challenge cancel only while the challenge can still be cancelled", () => {
    expect(ids(facts({ kind: "challenge", status: "pending" }))).toEqual([
      "cancel_challenge",
    ]);
    expect(ids(facts({ kind: "challenge", status: "completed" }))).toEqual([]);
    expect(
      actionsForSubject(facts({ kind: "challenge", status: "active" }))[0]?.section,
    ).toBe("challenges");
  });

  it("offers nothing for a system incident", () => {
    expect(ids(facts({ kind: "system" }))).toEqual([]);
  });

  it("names an unknown action instead of dropping it", () => {
    expect(explainInapplicable("__proto__", facts({ kind: "competition" }))).toMatch(
      /Unknown action/,
    );
  });
});

describe("the act route requires both grants", () => {
  it("checks incidents, then the Map, then the subject section", () => {
    const code = readCode("apps/admin/app/api/incidents/[id]/act/route.ts");
    const incidents = code.indexOf('guardSection("incidents")');
    const lookup = code.indexOf("INCIDENT_ACTIONS.get(");
    const subject = code.indexOf("guardSection(action.section)");
    expect(incidents).toBeGreaterThan(-1);
    expect(lookup).toBeGreaterThan(incidents);
    expect(subject).toBeGreaterThan(lookup);
    expect(code).not.toMatch(/INCIDENT_ACTIONS\[/);
  });
});

describe("consequence sentences are not copied into components", () => {
  it("the trading and game emergency sentences live only in the copy module", () => {
    const banned = [
      "Immediately close ALL open positions at current market prices",
      "Immediately void ALL rounds still in flight",
      "Prevent a player resuming a round they already have open",
    ];
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!full.endsWith(".tsx") && !full.endsWith(".ts")) continue;
        const text = readFileSync(full, "utf8");
        for (const phrase of banned) {
          if (text.includes(phrase)) hits.push(`${full} :: ${phrase}`);
        }
      }
    };
    walk(join(ROOT, "apps/admin/components"));
    expect(hits).toEqual([]);
  });
});

describe("the refusal names the hub", () => {
  it("the shared notice names Incident Management and deep-links to it", () => {
    const code = readCode(
      "apps/admin/components/admin/incidents/HubWithheldAction.tsx",
    );
    expect(code).toMatch(/Incident Management/);
    expect(code).toMatch(/\/dashboard\?activeTab=incidents/);
  });
});

describe("raising an incident uses the board subject id", () => {
  it("sends the id on the field the stamp reads for that kind", () => {
    const code = readCode(
      "apps/admin/components/admin/incidents/RaiseIncidentDialog.tsx",
    );
    expect(code).toMatch(/subjectType:\s*subject\.kind/);
    expect(code).toMatch(/body\.competitionId\s*=\s*subject\.id/);
    expect(code).toMatch(/body\.challengeId\s*=\s*subject\.id/);
    expect(code).toMatch(/body\.roundId\s*=\s*subject\.id/);
    const route = readCode("apps/admin/app/api/incidents/route.ts");
    expect(route).toMatch(/stampIncidentSubject\(/);
  });
});

describe("compensation is written in credits", () => {
  it("the player notification uses formatVolts and not a euro amount", () => {
    const code = readCode("apps/admin/app/api/incidents/[id]/resolve/route.ts");
    expect(code).toMatch(/You have been credited \$\{formatVolts\(/);
    expect(code).not.toMatch(/credited €/);
  });

  it("the resolution modal renders amounts through formatVolts", () => {
    const code = readCode(
      "apps/admin/components/admin/IncidentResolutionModal.tsx",
    );
    expect(code).toMatch(/formatVolts\(/);
    expect(code).not.toMatch(/€/);
  });
});

describe("subjectType has no schema default", () => {
  it("both model copies leave an old row distinguishable from system", () => {
    for (const relative of [
      "database/models/incident.model.ts",
      "apps/admin/database/models/incident.model.ts",
    ]) {
      const code = readCode(relative);
      const start = code.lastIndexOf("subjectType: {");
      const field = code.slice(start, start + 220);
      expect(field).toMatch(/enum:/);
      expect(field).not.toMatch(/default:/);
      expect(code).toMatch(/actionsTaken:/);
      expect(code).toMatch(/roundId:/);
    }
  });
});
