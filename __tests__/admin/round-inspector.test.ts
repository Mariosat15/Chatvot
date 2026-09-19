import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The round inspector and its one write (X6).
 *
 * These are STRUCTURAL tests, and they strip comments before matching. The reason is a mistake
 * already made once on this codebase: these files explain the anti-patterns they avoid in prose,
 * so a test that reads prose fails in both directions - it flags a correct file for discussing
 * the mistake, and it passes a broken one whose only mention of the right thing is a comment.
 *
 * What they pin is the set of properties that are invisible at a glance and expensive to lose:
 * the section guard on every handler, the mandatory reason, the refusal to enter a score, and
 * the model owning which transitions are legal.
 */

const ADMIN = join(process.cwd(), "apps", "admin");

function source(...parts: string[]): string {
  const raw = readFileSync(join(ADMIN, ...parts), "utf8");
  // Block comments then line comments. Order matters: a `//` inside a block comment would
  // otherwise truncate the line-comment strip at the wrong place.
  return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const LIST_ROUTE = ["app", "api", "games", "rounds", "route.ts"];
const DETAIL_ROUTE = ["app", "api", "games", "rounds", "[roundId]", "route.ts"];
const RESOLVE_ROUTE = [
  "app",
  "api",
  "games",
  "rounds",
  "[roundId]",
  "resolve",
  "route.ts",
];
const SERVICE = ["lib", "services", "games", "round-resolution.service.ts"];
const ACTIONS = ["lib", "admin", "round-resolution-actions.ts"];

describe("every round-inspector handler is guarded by its section", () => {
  const routes: [string, string[]][] = [
    ["list", LIST_ROUTE],
    ["detail", DETAIL_ROUTE],
    ["resolve", RESOLVE_ROUTE],
  ];

  for (const [name, path] of routes) {
    it(`${name} asks guardSection("round-inspector"), not requireAdminAuth`, () => {
      const code = source(...path);

      // `requireAdminAuth` asks only whether the caller is an admin at all, so an employee
      // granted one unrelated section passes it. It is the natural thing to reach for and it
      // has been the wrong answer four times in this codebase.
      expect(code).not.toContain("requireAdminAuth");
      expect(code).toContain('guardSection("round-inspector")');
    });

    it(`${name} guards every exported handler, not just the first`, () => {
      const code = source(...path);
      // Counting both is what catches a file whose GET is guarded and whose POST is not - a
      // shape that passes any "does it mention the guard" assertion while leaving the mutation
      // wide open.
      const handlers = (code.match(/export async function (GET|POST|PATCH|PUT|DELETE)/g) ?? [])
        .length;
      const guards = (code.match(/guardSection\(/g) ?? []).length;

      expect(handlers).toBeGreaterThan(0);
      expect(guards).toBe(handlers);
    });
  }
});

describe("manual resolution cannot enter a score", () => {
  it("neither the route nor the service writes a score", () => {
    // THE ARCHITECTURAL BOUNDARY THIS SCREEN EXISTS INSIDE. Scores enter through exactly one
    // function (chapter 02 s10 rule 3) and it lives in the main app. A score box here would be
    // a second door into the money path, in the app with the widest privileges - the same
    // mistake as Stage 0's four competition-entry writers, which is what this rule came from.
    for (const path of [RESOLVE_ROUTE, SERVICE]) {
      const code = source(...path);
      expect(code).not.toContain("rawScore");
      expect(code).not.toContain("applyResult");
      expect(code).not.toContain("participant.score");
      expect(code).not.toContain("syncParticipantScore");
    }
  });

  it("only ever moves a round to a terminal status that scores nothing", () => {
    const code = source(...ACTIONS);
    // `completed` is the one status that means a score landed, so it must not be offered here.
    // Asserting on the Map's values rather than on prose is what makes this checkable.
    expect(code).toContain('status: "voided"');
    expect(code).toContain('status: "abandoned"');
    expect(code).toContain('status: "expired"');
    expect(code).not.toContain('status: "completed"');
  });
});

describe("the action list has exactly one definition", () => {
  it("the dialog reads the shared module rather than declaring its own list", () => {
    const code = source("components", "admin", "games", "ResolveRoundDialog.tsx");
    // "One rule, two copies" is the shape behind four separate defects here, and no mirror
    // guard can see it. The drift it invites is a button offering an id the server has since
    // renamed, which fails with a 400 that reads like a permissions problem.
    expect(code).toContain("round-resolution-actions");
    expect(code).toContain("RESOLUTION_ACTIONS");
    // The giveaway of a second copy: the consequence wording written out again in the component.
    expect(code).not.toContain("scores nothing for the player");
  });

  it("the server service reads the same module too", () => {
    const code = source(...SERVICE);
    expect(code).toContain("round-resolution-actions");
    expect(code).not.toContain("new Map<");
  });
});

describe("the reason is mandatory", () => {
  it("the route refuses a short reason before doing anything", () => {
    const code = source(...RESOLVE_ROUTE);

    // THE COMPARISON, not the identifier. The first version of this test asserted only that
    // `MIN_REASON_LENGTH` appeared somewhere, which stays true when the check is neutered to
    // `if (false)` - the constant is still named in the import and in the error message. A probe
    // proved it: the test stayed green with the guard disabled. **Assert the operator, not the
    // operand.**
    expect(code).toMatch(/reason\.length\s*<\s*MIN_REASON_LENGTH/);

    // Position matters: the refusal has to come before the call that changes the round, or a
    // round is resolved and only then found to have no reason recorded.
    //
    // Matched as a CALL (`await resolveRoundManually(`), not by name. Written as
    // `indexOf("resolveRoundManually")` this found the import on line 8 and compared against
    // that - **third instance in this file of an import being mistaken for a use.**
    const check = code.search(/reason\.length\s*<\s*MIN_REASON_LENGTH/);
    const act = code.search(/await\s+resolveRoundManually\(/);
    expect(check).toBeGreaterThan(-1);
    expect(act).toBeGreaterThan(check);
  });

  it("the service refuses too, so a second caller cannot skip it", () => {
    // The route is not the only possible caller. A guard that lives only in the route is one
    // refactor away from being absent.
    const code = source(...SERVICE);
    expect(code).toMatch(/reason\.trim\(\)\.length\s*<\s*MIN_REASON_LENGTH/);
  });

  it("the audit entry is written after the change succeeds, never before", () => {
    const code = source(...RESOLVE_ROUTE);
    // The call, not the import. See the note in the test above.
    const act = code.search(/await\s+resolveRoundManually\(/);
    const audit = code.indexOf("auditLogService.log");
    expect(audit).toBeGreaterThan(act);
    // Filed as a contest decision. `settings` would hide it from anyone auditing a disputed
    // result, which is the only reason this log exists.
    expect(code).toContain('category: "competition"');
    expect(code).toContain('action: "round_manually_resolved"');
  });
});

describe("the action name is not trusted as an object key", () => {
  it("looks the action up in a Map, never by indexing an object", () => {
    const code = source(...SERVICE) + source(...ACTIONS);
    // `in` and object indexing both reach the prototype chain, so "toString" and "__proto__"
    // pass. `RESOLUTION_ACTIONS["__proto__"]` returns Object.prototype - truthy, surviving a
    // `!target` check, failing later on a missing `.status`. Safe by accident is not safe.
    expect(code).toContain("new Map<");
    expect(code).toContain("RESOLUTION_ACTIONS.get(action)");
    expect(code).not.toMatch(/RESOLUTION_ACTIONS\[/);
  });

  it("the route validates through the same helper rather than its own check", () => {
    const code = source(...RESOLVE_ROUTE);
    expect(code).toContain("isResolutionAction");
    expect(code).not.toMatch(/in RESOLUTION_ACTIONS/);
  });
});

describe("the state machine stays owned by the model", () => {
  it("asks canTransitionRound rather than deciding for itself", () => {
    const code = source(...SERVICE);
    // Reason this matters: the ingestion path obeys the same table. A second copy of "which
    // transitions are legal" is a place for the two to drift, and it would let an operator move
    // a round to a state a provider result never could.
    //
    // ASSERT THE CALL, not the name. A probe replaced the call with a hand-rolled
    // `round.status === "completed"` check and this test stayed green, because
    // `canTransitionRound` was still named in the import line. **An import is not a use.**
    expect(code).toMatch(/canTransitionRound\(\s*round\.status/);
  });

  it("records that a human decided the outcome", () => {
    const code = source(...SERVICE);
    // Without this a voided round is indistinguishable from one the reconciliation net gave up
    // on - the difference between a decision and a failure.
    expect(code).toContain('resultSource = "manual"');
  });
});

describe("the list only shows rounds needing a decision", () => {
  it("queries unresolved rounds and live rounds past expiry, not everything", () => {
    const code = source(...SERVICE);
    expect(code).toContain('status: "unresolved"');
    expect(code).toContain("expiresAt");
    // A list including completed rounds buries the handful that matter.
    expect(code).not.toMatch(/GameRound\.find\(\{\s*\}\)/);
  });

  it("flags holding-settlement only for hold_and_alert contests", () => {
    const code = source(...SERVICE);
    // The other two policies settle on time, so flagging every unresolved round as holding
    // settlement would make the badge meaningless exactly where it needs to be trusted.
    expect(code).toContain("hold_and_alert");

    const flag = code.indexOf("holdingSettlement:");
    const policy = code.indexOf("hold_and_alert", flag);
    expect(flag).toBeGreaterThan(-1);
    expect(policy).toBeGreaterThan(flag);
  });
});

describe("the RBAC id exists and is separate from game-providers", () => {
  it("round-inspector is in ADMIN_SECTIONS", () => {
    const code = source("database", "models", "admin-employee.model.ts");
    expect(code).toContain('"round-inspector"');
  });

  it("the dashboard both lists it and renders it", () => {
    // A menu entry with no switch case renders nothing; a switch case with no menu entry is
    // unreachable. Both halves, or the section is broken in a way that looks fine in one file.
    const code = source("components", "admin", "AdminDashboard.tsx");
    expect(code).toContain('id: "round-inspector"');
    expect(code).toContain('case "round-inspector"');
    expect(code).toContain("RoundInspectorSection");
  });
});
