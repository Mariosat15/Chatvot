/**
 * R105 — a comma-joined id list is not a list.
 *
 * The milestone agent is handed `requiredBadgeIds` comma-joined inside a
 * pipe-separated table (`milestonesToCompact`), so a model echoing
 * `"trade_25,risk_survivor"` back is reading the format it was given. The reply
 * was then cast `as MilestoneDraft[]` with no shape check, and two things
 * followed, neither of which raised anything:
 *
 * - The review step CRASHED. A string has `.length`, so
 *   `(m.requiredBadgeIds?.length ?? 0) > 0` admitted it and the `.join(", ")`
 *   beneath threw, taking the whole step down and losing every proposal.
 * - The stored gate was PERMANENTLY UNSATISFIABLE, which is the worse half and
 *   the one nobody could see. Mongoose wraps a bare string into a one-element
 *   array rather than rejecting it, and the document then validates, so the
 *   gate names one badge whose id is two ids with a comma in it.
 *
 * The second half is proven behaviourally below, because no structural
 * assertion can see a cast that Mongoose performs silently.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  MILESTONE_ID_LIST_FIELDS,
  normaliseMilestoneIdLists,
  toIdList,
} from "../../apps/admin/lib/admin/milestone-id-lists";
import JourneyMilestone from "../../apps/admin/database/models/journey-milestone.model";

const root = process.cwd();

/** Comments stripped — both files explain this anti-pattern in prose. */
function readCode(relative: string): string {
  return readFileSync(join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("reading a milestone's id lists", () => {
  it("splits the format the agent was given", () => {
    expect(toIdList("trade_25,risk_survivor")).toEqual(["trade_25", "risk_survivor"]);
    expect(toIdList("trade_25, risk_survivor ")).toEqual(["trade_25", "risk_survivor"]);
  });

  it("leaves a clean list alone, by reference", () => {
    const already = ["trade_25", "risk_survivor"];
    expect(toIdList(already)).toEqual(already);

    const milestone = { id: "m1", requiredBadgeIds: already };
    // Reason: an untouched milestone must not be rewritten, or a write that
    // changes nothing appears in the diff an operator reviews.
    expect(normaliseMilestoneIdLists(milestone)).toBe(milestone);
  });

  it("yields an empty list for a shape with no reading, rather than throwing", () => {
    // Reason: every caller is either rendering a review screen or building a
    // document, and neither can usefully handle an exception. Dropping an
    // unreadable gate leaves the milestone reachable and the gap visible;
    // keeping it would preserve the permanent lock this module prevents.
    expect(toIdList(undefined)).toEqual([]);
    expect(toIdList(null)).toEqual([]);
    expect(toIdList(42)).toEqual([]);
    expect(toIdList({})).toEqual([]);
    expect(toIdList([null, 7, "ok", "  "])).toEqual(["ok"]);
    expect(toIdList(",,")).toEqual([]);
  });

  it("normalises every path declared as a list of strings, and only those", () => {
    // Reason: the four are declared `[String]` on the model, so all four are
    // silently coercible. A fix covering `requiredBadgeIds` alone leaves the
    // same defect on the three beside it.
    expect([...MILESTONE_ID_LIST_FIELDS].sort()).toEqual([
      "connectedFrom",
      "connectedTo",
      "gameTypes",
      "requiredBadgeIds",
    ]);

    const out = normaliseMilestoneIdLists({
      id: "m1",
      name: "Milestone, one",
      requiredBadgeIds: "a,b",
      gameTypes: "trading,provider:x:y",
      connectedTo: "m2,m3",
      connectedFrom: "m0",
    });

    expect(out.requiredBadgeIds).toEqual(["a", "b"]);
    expect(out.gameTypes).toEqual(["trading", "provider:x:y"]);
    expect(out.connectedTo).toEqual(["m2", "m3"]);
    expect(out.connectedFrom).toEqual(["m0"]);
    // A name is prose and may legitimately contain a comma.
    expect(out.name).toBe("Milestone, one");
  });

  it("does not invent an absent list", () => {
    // Reason: `gameTypes` carries no schema default on purpose — an absent list
    // means platform-wide, which is a different fact from an empty one — so
    // normalising absent into `[]` would destroy that on every milestone.
    const out = normaliseMilestoneIdLists({ id: "m1" });
    expect("gameTypes" in out).toBe(false);
    expect("requiredBadgeIds" in out).toBe(false);
  });
});

describe("what Mongoose does with a bare string (the invisible half)", () => {
  /**
   * The whole schema, not the subset under test.
   *
   * Reason: Mongoose validates the document, so a trimmed fixture fails on
   * `description` / `zoneId` / `completeCondition` and says nothing at all
   * about the field this suite is here to examine.
   */
  const base = {
    id: "probe",
    mapId: "journey_trading",
    name: "Probe",
    description: "A probe milestone.",
    zoneId: "zone_1",
    completeCondition: { type: "trades_count", value: 1 },
  };

  it("wraps it into a one-element array and validates it", () => {
    const doc = new JourneyMilestone({
      ...base,
      requiredBadgeIds: "trade_25,risk_survivor",
    });

    // Reason: this is the whole reason the defect was silent. There is no
    // rejection to catch and no error to log — the gate is simply one id that
    // no badge carries, so `every(id => earned.has(id))` can never be true.
    expect(doc.requiredBadgeIds).toEqual(["trade_25,risk_survivor"]);
    expect(doc.validateSync()).toBeUndefined();
  });

  it("stores two ids once the value is read as a list", () => {
    const doc = new JourneyMilestone({
      ...base,
      ...normaliseMilestoneIdLists({ requiredBadgeIds: "trade_25,risk_survivor" }),
    });

    expect(doc.requiredBadgeIds).toEqual(["trade_25", "risk_survivor"]);
  });
});

describe("where the reading happens (structural)", () => {
  const route = readCode("apps/admin/app/api/ai/gamification-wizard/route.ts");
  const ui = readCode("apps/admin/components/admin/GamificationWizardSection.tsx");

  it("normalises in the one milestone writer, before the document is looked up", () => {
    // Reason: five call sites reach `writeMilestonesBatch`, one of them
    // `apply_changes`, which takes its list straight from a request body. The
    // POSITION is the claim — normalising after the write is a call that
    // changes nothing while reading as though it protects something.
    const call = route.indexOf("normaliseMilestoneIdLists(rest)");
    const lookup = route.indexOf("JourneyMilestone.findOne({ id: clean.id");
    expect(call).toBeGreaterThan(-1);
    expect(lookup).toBeGreaterThan(-1);
    expect(call).toBeLessThan(lookup);
  });

  it("normalises the agent's proposal too, so review and write agree", () => {
    // Reason: the writer alone stops the bad gate being stored and still lets
    // the review step be handed a string. One definition on both sides is what
    // stops the screen and the database disagreeing about what a gate is.
    const slice = route.slice(route.indexOf("parsed?.milestones"));
    expect(slice.slice(0, 400)).toMatch(/normaliseMilestoneIdLists/);
  });

  it("reads the badge list the same way, one model along", () => {
    // Reason: `gameTypes` on a badge is `[String]` as well, and the update
    // branch DROPS a non-array, which hides it rather than fixing it. A badge
    // scoped to "trading,provider:x:y" is displayed and evaluated for nobody.
    const slice = route.slice(
      route.indexOf("sanitized.badge as BadgeDraft"),
      route.indexOf("Skipping badge with missing/invalid id"),
    );
    expect(slice.length).toBeGreaterThan(50);
    expect(slice).toMatch(/toIdList\(clean\.gameTypes\)/);
  });

  it("no longer trusts the declared type on the review screen", () => {
    // Reason: `(m.requiredBadgeIds?.length ?? 0) > 0` is the crash — a string
    // satisfies it. Both the guard and the render must read the value, so the
    // occurrences are COUNTED: fixing one and leaving the other still throws.
    expect(ui).not.toMatch(/requiredBadgeIds\?\.length/);
    expect(ui).not.toMatch(/\(m\.requiredBadgeIds \?\? \[\]\)\.join/);

    const reads = ui.match(/toIdList\(m\.requiredBadgeIds\)/g) ?? [];
    expect(reads.length).toBe(2);
  });

  it("keeps the shared reading model-free, so both sides can import it", () => {
    // Reason (R58): the writer is an API route holding Mongoose models and the
    // reader is a `"use client"` component, so a module either of them imports
    // must reach no database driver.
    const shared = readFileSync(
      join(root, "apps/admin/lib/admin/milestone-id-lists.ts"),
      "utf8",
    );
    expect(shared).not.toMatch(/from\s+["'][^"']*(mongoose|mongodb|models)/);
  });
});
