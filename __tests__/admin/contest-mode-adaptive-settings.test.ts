/**
 * Task document 12 - the two contest setup screens adapt to the contest's play shape.
 *
 * WHAT THIS IS ACTUALLY GUARDING, because "the form should adapt" sounds cosmetic and the
 * defect it closes was not. `applyEdit` forces `attemptsPolicy` and `roundStartPolicy` from
 * the shape, unconditionally and before it looks at what the operator sent. The wizard has
 * withheld both controls on a simultaneous contest since `22` s8; the editor offered both and
 * never imported `play-shape.ts` at all. So an operator could open a race, choose "Best of
 * several", save, be told it saved, and have `single` stored - no error, no log line, and the
 * screen still showing their choice until they reloaded. The control appeared to work and did
 * nothing, which is this codebase's most repeated failure and the one the plan documents keep
 * finding one screen at a time.
 *
 * THE INVARIANT WORTH HAVING IS BEHAVIOURAL, not a list of which control each screen hides:
 * a control is withheld exactly when the shape forces its value. Written that way it is a
 * tripwire rather than a snapshot - a third mode that forces something without withholding
 * its control turns it red on the day the mode is added, which is the only day anybody could
 * act on it cheaply.
 *
 * The structural half exists because no runtime assertion here can render a React tree, and
 * its NEGATIVE assertions are the load-bearing ones: importing `play-shape.ts` is trivially
 * satisfied by a screen that imports it and then hardcodes the labels anyway, which is
 * exactly what "Contest starts" was.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  PLAY_MODES,
  playShapeRules,
} from "../../lib/services/games/play-shape";

const ADMIN = join(process.cwd(), "apps", "admin");
const EDITOR = join(ADMIN, "components/admin/games/ProviderContestEditor.tsx");
const WIZARD_STEPS = join(ADMIN, "components/admin/games/wizard");
const ROUTE = join(
  ADMIN,
  "app/api/games/contests/[competitionId]/route.ts",
);

/**
 * Source with block and line comments removed.
 *
 * Every file in this slice explains the anti-pattern in prose - the editor's header names
 * "Contest starts" as the defect it fixed - so a test that reads prose fails on a correct
 * file for discussing the mistake, and passes a broken one whose only mention of the right
 * thing is a comment.
 */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/**
 * The wizard SCREEN: every step file together.
 *
 * A claim about what an operator can reach must be asserted over the whole screen, or it goes
 * green the moment the control it guards moves one file along. Throws on an empty folder,
 * because a walk that finds nothing turns these into tests of "".
 */
function wizardScreen(): string {
  const files = readdirSync(WIZARD_STEPS).filter((name) => name.endsWith(".tsx"));
  if (files.length === 0) throw new Error(`No step files under ${WIZARD_STEPS}`);
  return files.map((name) => code(join(WIZARD_STEPS, name))).join("\n");
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

// =======================================================================================
// The invariant itself
// =======================================================================================

describe("a control is withheld exactly when the shape forces its value", () => {
  it.each(PLAY_MODES)(
    "%s: the round-start control is offered only when nothing is forced",
    (mode) => {
      const shape = playShapeRules(mode);
      expect(shape.offersRoundStartPolicy).toBe(
        shape.forcedRoundStartPolicy === undefined,
      );
    },
  );

  it.each(PLAY_MODES)(
    "%s: the attempts control is withheld only when a policy is forced",
    (mode) => {
      const shape = playShapeRules(mode);
      expect(shape.requiresSingleAttempt).toBe(
        shape.forcedAttemptsPolicy !== undefined,
      );
    },
  );

  it.each(PLAY_MODES)(
    "%s: a withheld control carries its reason, and an offered one does not",
    (mode) => {
      const shape = playShapeRules(mode);

      // The pairing, not merely the presence: a sentence on a shape that offers the control
      // would be rendered nowhere, and an absent one on a shape that withholds it leaves the
      // operator a blank space where the explanation should be - which teaches them the
      // setting does not exist rather than that it is already decided.
      expect(typeof shape.copy.attemptsWithheld === "string").toBe(
        shape.requiresSingleAttempt,
      );
      expect(typeof shape.copy.roundStartWithheld === "string").toBe(
        !shape.offersRoundStartPolicy,
      );
    },
  );

  it("gives the two shapes different words for the same two moments", () => {
    const anytime = playShapeRules("anytime").copy;
    const scheduled = playShapeRules("scheduled").copy;

    // Reason: the labels are the only thing on the screen that says the start of a
    // simultaneous contest is also the moment entry closes. Identical copy would make the
    // whole adaptation invisible while every structural assertion below stayed green.
    expect(scheduled.startLabel).not.toBe(anytime.startLabel);
    expect(scheduled.startHint).not.toBe(anytime.startHint);
    expect(scheduled.endLabel).not.toBe(anytime.endLabel);
  });
});

// =======================================================================================
// The editor reads the shape rather than assuming one
// =======================================================================================

describe("the editor adapts to the contest's shape", () => {
  it("takes its date labels and hints from the shape, never from itself", () => {
    const editor = code(EDITOR);

    expect(editor).toContain("shape.copy.startLabel");
    expect(editor).toContain("shape.copy.startHint");
    expect(editor).toContain("shape.copy.endLabel");
    expect(editor).toContain("shape.copy.endHint");

    // THE LOAD-BEARING HALF. Reading the shape is trivially satisfied by a screen that reads
    // it and then hardcodes the label anyway - which is precisely what this file did, with
    // `play-shape.ts` sitting unimported and "Contest starts" written out in full.
    const anytime = playShapeRules("anytime").copy;
    expect(editor).not.toContain(anytime.startLabel);
    expect(editor).not.toContain(anytime.endLabel);
  });

  it("withholds the round-start control rather than disabling it", () => {
    const editor = code(EDITOR);
    const control = editor.indexOf("<RoundStartPolicyField");
    expect(control).toBeGreaterThan(-1);

    // Positional, never a bare mention: `shape.offersRoundStartPolicy` appearing somewhere in
    // a 650-line file says nothing about whether it guards this control. And `disabled` is
    // not the same remedy - a greyed-out control still tells an operator the setting applies
    // to this contest, when the server is about to overwrite whatever it holds.
    const guard = editor.lastIndexOf("shape.offersRoundStartPolicy", control);
    expect(guard).toBeGreaterThan(-1);
    expect(control - guard).toBeLessThan(200);
  });

  it("withholds every attempts control, not just the first", () => {
    const editor = code(EDITOR);

    // ONE guard, asserted as one. With the condition written twice, deleting the second
    // leaves the first satisfying any check that looks backwards from the attempts count -
    // a half-removed guard hiding behind the half that remains, which is the fifth time an
    // identifier appearing twice has defeated a structural test here.
    expect(occurrences(editor, "!shape.requiresSingleAttempt")).toBe(1);

    const guard = editor.indexOf("!shape.requiresSingleAttempt");
    const region = editor.slice(guard, editor.indexOf("</>", guard));
    // A slice that found nothing passes everything asked of it.
    expect(region.length).toBeGreaterThan(400);

    expect(region).toContain('SelectItem value="best_of_n"');
    expect(region).toContain('id="attemptsAllowed"');
  });

  it("does not resolve the shape itself - the route hands it over", () => {
    const editor = code(EDITOR);

    expect(editor).toContain("playShapeRules");

    // Resolving needs the catalogue row, which this screen does not have, so a client-side
    // answer would be a second implementation of the rule `applyEdit` forces from. Same
    // reasoning as the play-mode picker reading `listContestableTitles`' resolved set.
    expect(editor).not.toContain("resolveContestPlayMode");
    expect(editor).not.toContain("resolvePlayShape");
    expect(editor).not.toContain("resolvePlayMode");
  });
});

// =======================================================================================
// The route is where the resolution happens
// =======================================================================================

describe("the edit route resolves the contest's shape", () => {
  it("resolves from the stored contest and the title, and sends the answer", () => {
    const route = code(ROUTE);

    // `resolveContestPlayMode`, never `resolvePlayMode`: once a title supports two shapes the
    // title's answer is its DEFAULT, so re-deriving from the title alone would tell the
    // editor a staggered contest is a synchronised one and withhold controls that apply.
    expect(route).toContain("resolveContestPlayMode(contest.playMode");
    expect(route).toMatch(/\n\s+playMode,/);
  });
});

// =======================================================================================
// One sentence, two screens
// =======================================================================================

describe("the withheld controls explain themselves from one definition", () => {
  it("both screens read the sentences rather than carrying them", () => {
    const screens = `${code(EDITOR)}\n${wizardScreen()}`;
    const scheduled = playShapeRules("scheduled").copy;

    expect(occurrences(screens, "copy.attemptsWithheld")).toBe(2);
    expect(occurrences(screens, "copy.roundStartWithheld")).toBe(2);

    // Reason: the "one rule, two copies" shape behind `referenceId`, `failedReason`,
    // `challengeId` and the Game Master `||` - none of which `check:mirrors` can see, because
    // it compares models. Two screens explaining one forced value differently is how an
    // operator concludes that one of them is stale and hunts for the setting on the other.
    expect(screens).not.toContain(scheduled.attemptsWithheld);
    expect(screens).not.toContain(scheduled.roundStartWithheld);
  });
});
