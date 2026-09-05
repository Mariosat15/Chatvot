import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  hasProviderGameLabel,
  resolveContestGameType,
  DEFAULT_GAME_TYPE,
} from "../../apps/admin/lib/admin/contest-game-label";

/**
 * Guards the admin control that publishes a draft provider contest.
 *
 * Until this slice, the whole provider contest lifecycle was reachable by API and by test
 * only - the publish route had zero callers anywhere in the repository. The risk in closing
 * that gap is not that the button fails to work; it is the two things beside it.
 *
 * First, `CompetitionsListSection` is a **trading-shaped screen that keeps working and keeps
 * being wrong**: `GET /api/competitions` returns drafts unfiltered, so provider drafts were
 * already being rendered there, with a status the TypeScript union denied, in the same grey
 * as a completed contest, and with an Edit button pointing at the trading editor. Making
 * drafts publishable without fixing that would have made the wrong control the easiest one
 * to press.
 *
 * Second, `PUT /api/competitions/[id]` does a blind `Object.assign` of whatever the trading
 * editor submits, so opening a provider contest in it writes trading fields onto a contest
 * whose provider settings that form cannot show.
 *
 * THESE TESTS STRIP COMMENTS BEFORE MATCHING, and it is not optional here: the source files
 * they read explain, in prose, the anti-patterns being asserted against - the trading edit
 * route, the strict `isProviderContest`, the generic error path. A structural test that reads
 * prose fails in both directions. It flags a correct file that discusses the mistake, and it
 * passes a broken one whose only mention of the right thing is in a comment.
 */

const LIST_PATH = join(
  process.cwd(),
  "apps/admin/components/admin/CompetitionsListSection.tsx",
);
const BUTTON_PATH = join(
  process.cwd(),
  "apps/admin/components/admin/games/PublishContestButton.tsx",
);
const ROUTE_PATH = join(
  process.cwd(),
  "apps/admin/app/api/games/contests/[competitionId]/publish/route.ts",
);

/** Block and line comments removed, so an assertion cannot be satisfied by prose. */
function readCode(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("the game label an admin screen reads", () => {
  it("treats an absent label as trading, because .lean() skips the schema default", () => {
    // `gameType` defaults to "trading" on the model, but `GET /api/competitions` reads with
    // `.lean()`, which does not hydrate - so the key is simply missing on any contest stored
    // before the label existed. Without the fallback every one of them reads as not-trading.
    expect(resolveContestGameType({})).toBe(DEFAULT_GAME_TYPE);
    expect(resolveContestGameType(undefined)).toBe(DEFAULT_GAME_TYPE);
    expect(resolveContestGameType(null)).toBe(DEFAULT_GAME_TYPE);
    expect(hasProviderGameLabel({})).toBe(false);
    expect(hasProviderGameLabel(null)).toBe(false);
  });

  it("treats an empty-string label as absent, which is a third missing-value shape", () => {
    // Absent, null and "" are the three shapes of "missing", and "" is the one that looks
    // correct in a document dump. It is also what the game-label backfill exists to fix.
    expect(resolveContestGameType({ gameType: "" })).toBe(DEFAULT_GAME_TYPE);
    expect(hasProviderGameLabel({ gameType: "" })).toBe(false);
  });

  it("recognises a provider contest from the label alone", () => {
    // Deliberately NOT the strict `isProviderContest` from contest-config, which also
    // demands a provider key and a game code. A provider contest missing its keys must
    // still be badged as one and must still be kept out of the trading editor - using the
    // strict helper here would render it as a trading contest, silently.
    expect(hasProviderGameLabel({ gameType: "provider" })).toBe(true);
  });

  it("does not match a label that merely contains the word", () => {
    expect(hasProviderGameLabel({ gameType: "provider-ish" })).toBe(false);
    expect(hasProviderGameLabel({ gameType: "Provider" })).toBe(false);
  });
});

describe("the publish button", () => {
  it("posts to the publish route for the contest it was given", () => {
    const code = readCode(BUTTON_PATH);

    expect(code).toMatch(
      /fetch\(\s*`\/api\/games\/contests\/\$\{competitionId\}\/publish`/,
    );
    expect(code).toContain('method: "POST"');
  });

  it("renders every accumulated refusal, not just the summary line", () => {
    // `runPreflight` accumulates its hard refusals rather than stopping at the first,
    // precisely so an operator is not made to fix one problem per submission. A UI that
    // shows only `error` throws that away - so the list has to be read AND rendered.
    const code = readCode(BUTTON_PATH);

    expect(code).toContain("data.errors");
    expect(code).toMatch(/refusals\.map\(/);
  });

  it("shows the provider's own refusal text rather than a generic failure", () => {
    // The checklist's refusals are actionable and specific. Replacing them with the generic
    // fallback would leave an operator with a control that says only that it did not work.
    const code = readCode(BUTTON_PATH);

    expect(code).toContain("data.error ??");
  });

  it("still has a generic fallback for a thrown network error", () => {
    const code = readCode(BUTTON_PATH);

    expect(code).toContain("Something went wrong. Please contact support.");
  });

  it("surfaces warnings without letting them read as failures", () => {
    // Three pre-flight items are advisory by design - the platform master switch being off,
    // a stale sandbox round, the per-round cost. Publishing succeeded, so they must not be
    // raised as errors.
    const code = readCode(BUTTON_PATH);

    expect(code).toContain("data.warnings");
    expect(code).toMatch(/toast\.warning\(/);
    expect(code).not.toMatch(/toast\.error\(\s*warning/);
  });

  it("offers no unpublish, because a visible contest can already have been paid into", () => {
    const code = readCode(BUTTON_PATH);

    expect(code.toLowerCase()).not.toContain("unpublish");
  });

  it("disables itself while a publish is in flight", () => {
    // The route claims the contest with a status-filtered update, so a double-click is
    // refused rather than double-publishing. This is about not asking it twice.
    const code = readCode(BUTTON_PATH);

    expect(code).toContain("disabled={pending}");
  });
});

describe("the competitions list understands a draft provider contest", () => {
  it("admits draft as a status, which the type used to deny", () => {
    const code = readCode(LIST_PATH);

    expect(code).toMatch(/status:\s*"draft"\s*\|/);
  });

  it("gives draft its own colour rather than the grey used for completed", () => {
    const code = readCode(LIST_PATH);
    const colourFn = code.slice(code.indexOf("const getStatusColor"));
    const draftCase = colourFn.slice(
      colourFn.indexOf('case "draft":'),
      colourFn.indexOf('case "upcoming":'),
    );

    expect(draftCase).toContain("amber");
    expect(draftCase).not.toContain("gray");
  });

  it("counts drafts in the summary, which enumerates statuses", () => {
    // An aggregate that enumerates its cases is exactly where a new case silently
    // disappears. A draft used to land in Total and in none of the other cards.
    const code = readCode(LIST_PATH);

    expect(code).toMatch(/c\.status === "draft"/);
  });

  it("shows the publish control only for a draft that is a provider contest", () => {
    // Both halves matter. A trading contest is never a draft and the route refuses one
    // anyway, so offering it there would be a control that cannot work; and a published
    // provider contest must not be offered publishing again.
    const code = readCode(LIST_PATH);
    const guard = code.slice(
      code.indexOf("<PublishContestButton") - 400,
      code.indexOf("<PublishContestButton"),
    );

    expect(guard).toContain('competition.status === "draft"');
    expect(guard).toContain("hasProviderGameLabel(competition)");
  });

  it("refetches after publishing rather than patching the row locally", () => {
    // Publishing changes the status, which changes which controls the row offers. Patching
    // one field locally is how a published contest keeps showing a Publish button.
    const code = readCode(LIST_PATH);

    expect(code).toMatch(/onPublished=\{fetchCompetitions\}/);
  });

  it("withholds the trading editor from provider contests", () => {
    // `PUT /api/competitions/[id]` blindly `Object.assign`s the trading form's body, so this
    // link is a corruption path for a provider contest, not merely a confusing screen.
    //
    // Asserted by position in the ternary rather than by scanning a fixed number of
    // characters backwards: the first version of this test used a 300-character window, which
    // began mid-identifier and reported the guard missing when it was present. A window whose
    // size is a guess fails for reasons that have nothing to do with the code under test.
    const code = readCode(LIST_PATH);

    const guardIndex = code.indexOf("hasProviderGameLabel(competition) ? (");
    const editIndex = code.indexOf("/competitions/edit/");

    expect(guardIndex).toBeGreaterThan(-1);
    expect(editIndex).toBeGreaterThan(-1);

    // The link must sit in the ELSE branch, so the branch separator has to fall between the
    // condition and the link. Without this, a guard placed after the link would still pass.
    const elseIndex = code.indexOf(") : (", guardIndex);
    expect(elseIndex).toBeGreaterThan(guardIndex);
    expect(editIndex).toBeGreaterThan(elseIndex);

    // And exactly one edit link, so a second unguarded one cannot hide behind the first.
    expect(code.split("/competitions/edit/").length - 1).toBe(1);
  });

  it("badges a provider contest so it is not read as a trading one", () => {
    // Added because a probe exposed its absence: blanking the badge's condition left the
    // whole suite green. The probe had been aimed at the test below, which asserts that the
    // strict helper is not imported - a different claim that the same identifier satisfies.
    // A probe aimed at the wrong test is indistinguishable from a test that does not work.
    //
    // It matters because every other cue on the row is trading's: the trophy icon, the entry
    // fee, the pool. Without a badge a provider contest is a trading contest that happens to
    // have no starting capital.
    const code = readCode(LIST_PATH);

    const badgeGuard = code.indexOf("hasProviderGameLabel(competition) && (");
    const badgeValue = code.indexOf("competition.gameKey");

    expect(badgeGuard).toBeGreaterThan(-1);
    expect(badgeValue).toBeGreaterThan(badgeGuard);

    // And it must survive a contest labelled provider before `gameKey` was populated,
    // rather than rendering an empty badge.
    expect(code).toMatch(/competition\.gameKey \?\?/);
  });

  it("uses the label-only helper, never the strict playability one", () => {
    // Importing `isProviderContest` here would compile, read correctly, and silently render
    // a keyless provider contest as a trading one - complete with the Edit button.
    const code = readCode(LIST_PATH);

    expect(code).toContain("hasProviderGameLabel");
    expect(code).not.toContain("isProviderContest");
  });
});

describe("the publish route stays contest administration, not provider administration", () => {
  it("is guarded on the competitions section, not on game providers", () => {
    // Publishing a contest must not require the grant that reaches provider API
    // credentials. `requireAdminAuth` would only ask whether the caller is an admin at all.
    const code = readCode(ROUTE_PATH);

    expect(code).toContain('guardSection("competitions")');
    expect(code).not.toContain("requireAdminAuth");
  });

  it("guards every exported handler", () => {
    // Counting handlers against guards, because a file whose GET is guarded and whose POST
    // is not passes any check that merely looks for the helper's presence.
    const code = readCode(ROUTE_PATH);
    const handlers = [...code.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)/g)];
    const guards = [...code.matchAll(/guardSection\(/g)];

    expect(handlers.length).toBeGreaterThan(0);
    expect(guards.length).toBe(handlers.length);
  });
});
