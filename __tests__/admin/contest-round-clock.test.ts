/**
 * How a game's round length relates to the contest's start and end, on the operator's screens.
 *
 * WHAT THIS PINS, and it is the owner's report rather than a hypothetical: "the sprint circuit
 * is confusing, it lets you set the duration like 120 but then you specify also time in the
 * window play, and the two don't obviously relate."
 *
 * They do relate, through a third number that appeared on no form. The game's settings step
 * offers whatever the title's `configSchema` declares - `durationSeconds`, 60 to 300 for
 * Circuit Sprint - which is how long ONE attempt lasts. The timing step sets the contest's own
 * clock. The gate that decides whether an attempt may start reads `maxDurationSeconds` from the
 * CATALOGUE row, which is the title's ceiling and not this contest's setting.
 *
 * THAT IS NOT A BUG AND THESE TESTS MUST NOT BE CHANGED TO MAKE IT ONE. Chapter 03 section 1.2
 * specifies `now + maxDurationSeconds <= playWindowEnd` precisely so an attempt can never be
 * admitted that the contest end would cut short - it fails closed. Reading the configured value
 * instead would trade a confusing message for a round that stops mid-play, which is the failure
 * the rule exists to prevent. So the fix is disclosure, and what is pinned below is that the
 * operator is told, in wall-clock terms, on both screens, with one shared explanation.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describeRoundFit } from "../../apps/admin/components/admin/games/contest-draft";

const ROOT = join(__dirname, "..", "..");

const NOTE = "apps/admin/components/admin/games/RoundClockNote.tsx";
const WIZARD = "apps/admin/components/admin/games/ProviderContestWizard.tsx";
const WIZARD_STEPS = "apps/admin/components/admin/games/wizard";
const EDITOR = "apps/admin/components/admin/games/ProviderContestEditor.tsx";
const DRAFT = "apps/admin/components/admin/games/contest-draft.ts";
const PREFLIGHT = "lib/services/games/contest-preflight.ts";
const ADMIN_PREFLIGHT = "apps/admin/lib/services/games/contest-preflight.ts";
const CONFIG_FIELDS = "apps/admin/components/admin/games/ConfigSchemaFields.tsx";

/**
 * Source with comments stripped.
 *
 * Every one of these files EXPLAINS the confusion it exists to remove, naming the very things
 * the assertions below forbid. A test that reads prose fails in both directions: it flags a
 * correct file for discussing the mistake, and it passes a broken one whose only mention of
 * the right thing is in a comment.
 */
function readCode(relative: string): string {
  const raw = readFileSync(join(ROOT, relative), "utf8");
  return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/**
 * The wizard SCREEN: its orchestrator plus every step file it renders.
 *
 * The wizard was one 711-line component until 8 September 2026 and is now a state owner with
 * its step bodies in `./wizard/`. Every claim below is about what the operator sees, so it has
 * to be asserted over the whole screen - pinned to the orchestrator alone, each one would go
 * green the moment the thing it guards moved into a step file, which is exactly the change
 * that just happened.
 *
 * IT THROWS RATHER THAN RETURNING NOTHING when the folder is empty. A walk that silently finds
 * no files turns every assertion below into a test of the empty string.
 */
function readWizardScreen(): string {
  const files = readdirSync(join(ROOT, WIZARD_STEPS)).filter(
    (name) => name.endsWith(".ts") || name.endsWith(".tsx"),
  );
  if (files.length === 0) {
    throw new Error(`No step files under ${WIZARD_STEPS}`);
  }
  return [
    readCode(WIZARD),
    ...files.map((name) => readCode(`${WIZARD_STEPS}/${name}`)),
  ].join("\n");
}

describe("describeRoundFit - turning the reserved ceiling into a moment", () => {
  it("says when the last attempt can start", () => {
    const fit = describeRoundFit({
      startTime: "2026-09-08T13:00",
      endTime: "2026-09-08T14:00",
      maxDurationSeconds: 300,
    });

    expect(fit).toBeDefined();
    expect(fit!.reservedSeconds).toBe(300);
    // 14:00 minus the game's longest possible round. This single fact is what the two clocks
    // were missing between them.
    // Non-null: `lastAttemptStart` is optional since the start policy became a setting, and
    // it is present exactly when the contest reserves - which the default does.
    expect(fit!.lastAttemptStart!.getTime()).toBe(
      new Date("2026-09-08T13:55").getTime(),
    );
    expect(fit!.windowTooShort).toBe(false);
  });

  it("reserves the game's ceiling, NOT the round length the operator configured", () => {
    /*
      The owner's exact case: Circuit Sprint configured at 120 seconds, ceiling 300. The
      deadline must be computed from 300, because that is what `round.service.ts` gates on.
      A screen that promised 13:58 here would contradict a server that refuses from 13:55.
    */
    const fit = describeRoundFit({
      startTime: "2026-09-08T13:00",
      endTime: "2026-09-08T14:00",
      maxDurationSeconds: 300,
    });

    expect(fit!.lastAttemptStart!.getTime()).not.toBe(
      new Date("2026-09-08T13:58").getTime(),
    );
  });

  it("says nothing at all when the catalogue declares no duration", () => {
    /*
      Matches `RoundPreflight.tsx`, which applies no gate on an absent `maxRoundSeconds`. An
      invented deadline is worse than none: for the one class of title where nobody knows the
      answer, it would state a cut-off the server does not enforce.
    */
    const base = { startTime: "2026-09-08T13:00", endTime: "2026-09-08T14:00" };

    expect(describeRoundFit(base)).toBeUndefined();
    expect(describeRoundFit({ ...base, maxDurationSeconds: 0 })).toBeUndefined();
    expect(
      describeRoundFit({ ...base, maxDurationSeconds: Number.NaN }),
    ).toBeUndefined();
  });

  it("says nothing while the dates are still half-typed", () => {
    // `datetime-local` is empty until the operator finishes, and an "Invalid Date" rendered
    // into a sentence about their contest reads as the form being broken.
    expect(
      describeRoundFit({
        startTime: "",
        endTime: "2026-09-08T14:00",
        maxDurationSeconds: 300,
      }),
    ).toBeUndefined();
    expect(
      describeRoundFit({
        startTime: "2026-09-08T13:00",
        endTime: "not a date",
        maxDurationSeconds: 300,
      }),
    ).toBeUndefined();
  });

  it("flags a contest shorter than one round of its own game", () => {
    // The clearest late failure available: nobody can finish, so every player settles on zero
    // and the contest pays out on a field nobody filled.
    const fit = describeRoundFit({
      startTime: "2026-09-08T13:00",
      endTime: "2026-09-08T13:02",
      maxDurationSeconds: 300,
    });

    expect(fit!.windowTooShort).toBe(true);
  });

  it("does not flag a contest exactly one round long", () => {
    // The boundary is `<`, matching the server's `windowSeconds < roundSeconds`. Exactly one
    // round fits, and refusing it would refuse something the server accepts.
    const fit = describeRoundFit({
      startTime: "2026-09-08T13:00",
      endTime: "2026-09-08T13:05",
      maxDurationSeconds: 300,
    });

    expect(fit!.windowTooShort).toBe(false);
  });
});

describe("the clock explanation is one definition, on both screens", () => {
  it("is rendered by the wizard AND the editor", () => {
    /*
      The "one rule, two copies" shape has produced five defects in this codebase already, and
      an explanation is not exempt: two copies eventually describe two different rules and the
      operator cannot tell which screen is lying.
    */
    for (const code of [readWizardScreen(), readCode(EDITOR)]) {
      expect(code).toMatch(/import \{ RoundClockNote \}/);
      expect(code).toMatch(/<RoundClockNote/);
    }
  });

  it("explains the game's settings and the contest clock in BOTH places", () => {
    // Both questions get an answer where they are asked. An operator reading the settings step
    // wants to know what these fields are for; one on the timing step wants to know when
    // people can actually play.
    for (const code of [readWizardScreen(), readCode(EDITOR)]) {
      expect(code).toMatch(/variant="settings"/);
      expect(code).toMatch(/variant="timing"/);
    }
  });

  it("derives the deadline in ONE place, not in the screens", () => {
    /*
      Asserting the negative is the load-bearing half. Importing the note is trivially
      satisfied by a screen that then computes its own deadline beside it, which is exactly
      how the two would drift.
    */
    expect(readCode(DRAFT)).toMatch(/export function describeRoundFit/);

    for (const code of [readWizardScreen(), readCode(EDITOR), readCode(NOTE)]) {
      // The subtraction that produces the cut-off must appear nowhere but the helper.
      expect(code).not.toMatch(/maxDurationSeconds \* 1000/);
    }
  });

  it("names the reserved seconds and the wall-clock moment, not a formula", () => {
    const code = readCode(NOTE);

    // "Reserves 300 seconds" is the rule; "the last attempt can start at 13:55" is the thing
    // an operator can act on. The report was about confusion, so the actionable half is the
    // one that has to be on screen.
    expect(code).toMatch(/reservedSeconds/);
    expect(code).toMatch(/lastAttemptStart\.toLocaleString\(\)/);
  });

  it("separates the game's own settings from the contest clock in words", () => {
    // The whole confusion in one sentence: a length in the game's settings is one attempt, and
    // when people may start one is set elsewhere.
    const code = readCode(NOTE);
    expect(code).toMatch(/one attempt/i);
    expect(code).toMatch(/longest possible round/i);
  });

  it("warns about a contest too short for its own game before the review step", () => {
    // The server refuses it either way. Surfacing it beside the dates means the operator finds
    // out while editing the thing that caused it.
    expect(readCode(NOTE)).toMatch(/windowTooShort/);
  });
});

describe("no game is named on the settings path", () => {
  it("names no game, provider or config field anywhere in the explanation", () => {
    /*
      The "no developer needed for a new title" claim has exactly one failure mode: something
      that enumerates games. `ConfigSchemaFields` is guarded for this already; the note sits
      beside it reading the same catalogue row, so it needs the same guard. A special case for
      `durationSeconds` here would be the obvious way to write this and would make the
      acceptance criterion quietly false while every other test still passed.
    */
    const code = readCode(NOTE);

    /*
      CASE-SENSITIVE, AND THE FIRST VERSION OF THIS TEST WAS WRONG FOR IT. Lower-casing both
      sides made `durationSeconds` match inside `maxDurationSeconds`, which the note reads
      legitimately - it is the CATALOGUE's ceiling, carried by every title, and the whole
      mechanism by which this component works for a game we have never seen. The guard failed
      on correct code, which is the fastest way to have it deleted along with the half that
      matters. Same trap as the blanket `GameIcon` ban in `13` s4.1g.

      The real distinction is a CONFIG KEY versus a TITLE FIELD: `durationSeconds` is one of
      Circuit Sprint's own settings and naming it here would be per-game code;
      `maxDurationSeconds` is a field every catalogue row has.
    */
    for (const configKey of ["durationSeconds", "gridSize", "boards"]) {
      expect(code).not.toContain(configKey);
    }

    for (const identifier of ["gameCode", "gameKey", "providerKey"]) {
      expect(code).not.toContain(identifier);
    }

    // And no title named in prose either, which is how a "temporary" example becomes per-game
    // copy that the next game silently contradicts.
    expect(code).not.toMatch(/circuit|sprint/i);

    // The positive half: it must still be reading the catalogue field that makes it general.
    expect(code).toContain("maxDurationSeconds");
  });

  it("leaves the schema-driven form free of game knowledge too", () => {
    // Guarding the note is pointless if the form beside it grew a special case instead.
    const code = readCode(CONFIG_FIELDS);
    expect(code).not.toMatch(/durationSeconds/);
    expect(code).not.toMatch(/gameCode/);
  });
});

describe("the refusal stops contradicting the operator's own setting", () => {
  it("calls the reserved figure the game's longest possible round, in BOTH copies", () => {
    /*
      This is what the owner actually hit. The message used to say "shorter than one round of
      this game (300 seconds)" to an operator who had just typed 120 into that game's settings,
      so the platform appeared to be quoting a number they had not chosen and could not find.

      Both copies, because the two apps' pre-flights are mirrored and a message that differs
      between them means the explanation an operator gets depends on which app served the form.
    */
    for (const copy of [PREFLIGHT, ADMIN_PREFLIGHT]) {
      const code = readCode(copy);
      expect(code).toMatch(/longest possible round/);
      // And it must say which number it is, or naming it differently is just new wording.
      expect(code).toMatch(/rather than the length set in its own settings/);
    }
  });

  it("still gates on the ceiling rather than the configured value", () => {
    /*
      The guard against "fixing" the confusion in the wrong direction, and it survives the
      7 September 2026 change rather than being softened by it.

      NARROWED, BECAUSE THE ORIGINAL REASON IS NO LONGER THE WHOLE TRUTH. This used to say the
      ceiling exists so an attempt can never be cut short, full stop. Since `RoundStartPolicy`
      that is the RESERVING branch's promise, not the platform's - a contest may now choose to
      permit a shortened round. What has not changed is that when a contest does reserve, it
      must reserve the ceiling: reading the configured length there would promise a full round
      and then cut one short, which is the worst of both settings.
    */
    for (const copy of [PREFLIGHT, ADMIN_PREFLIGHT]) {
      const code = readCode(copy);
      expect(code).toMatch(/const roundSeconds = input\.title\.maxDurationSeconds/);
      expect(code).not.toMatch(/input\.settings\[/);
    }
  });
});

describe("the wizard's closing note", () => {
  it("tells the operator to publish rather than to wait for a feature", () => {
    /*
      CORRECTED, not merely reworded. It used to end "Publishing arrives with the player-facing
      game screens", which was true when written and false from 5 September, when the publish
      button and the play screen both shipped. An operator-facing caution that has become false
      is worse than none: this one sent them looking for a missing feature instead of pressing
      a button that was already there.
    */
    const code = readWizardScreen();
    expect(code).toMatch(/Publish/);
    expect(code).not.toMatch(/Publishing arrives with/);

    /*
      CORRECTED A SECOND TIME, 7 September 2026. The note then described an unconditional
      draft, which stopped being true the moment publishing became a checkbox - and a review
      step that states the wrong outcome is worse than one that states none, because an
      operator reads it as confirmation of what they just chose. It now branches on the box.
    */
    expect(code).not.toMatch(
      /It will be saved as a <strong className="text-white">draft<\/strong>/,
    );
    expect(code).toMatch(/draft\.publishOnSave\s*\n?\s*\?/);
  });
});

describe("the round-start policy - the gate became the contest's choice", () => {
  /*
    THE DEFECT THIS CLOSES, because the setting reads like a preference and is not one.

    The gate reserved the CATALOGUE ceiling, so a contest shorter than that ceiling refused
    every round from the instant it opened - "there is not enough time left in this
    competition" beside a countdown showing minutes remaining. That is what the owner
    reported. Circuit Sprint's ceiling is 300 seconds, so any contest under five minutes was
    unplayable however it was configured.
  */

  it("names no cut-off moment when the contest lets players start at any time", () => {
    const permissive = describeRoundFit({
      startTime: "2026-09-08T13:00",
      endTime: "2026-09-08T14:00",
      maxDurationSeconds: 300,
      roundStartPolicy: "until_window_closes",
    });

    // The load-bearing half. A deadline that does not exist is worse than no deadline: an
    // operator plans around it, and a player is told to be back by a time that means nothing.
    expect(permissive!.lastAttemptStart).toBeUndefined();
    expect(permissive!.reservesFullRound).toBe(false);

    // Absent means the schema default, so a contest saved before the field existed is still
    // described by the rule it was created under.
    const stored = describeRoundFit({
      startTime: "2026-09-08T13:00",
      endTime: "2026-09-08T14:00",
      maxDurationSeconds: 300,
    });
    expect(stored!.reservesFullRound).toBe(true);
    expect(stored!.lastAttemptStart).toBeDefined();
  });

  it("still reports a short contest under BOTH policies, because the fact is the same", () => {
    /*
      Only the consequence differs - a refusal one way, a warning the other. Reporting it only
      on the reserving branch would leave an operator creating a two-minute Circuit Sprint
      contest with no idea that every attempt will be cut off.
    */
    for (const policy of ["reserve_full_round", "until_window_closes"] as const) {
      const fit = describeRoundFit({
        startTime: "2026-09-08T13:00",
        endTime: "2026-09-08T13:02",
        maxDurationSeconds: 300,
        roundStartPolicy: policy,
      });
      expect(fit!.windowTooShort).toBe(true);
    }
  });

  it("refuses a short contest that reserves, and only warns about one that does not", () => {
    /*
      The rule that makes the setting usable at all. Left as a hard refusal for both, an
      operator could select "players may start at any time" and then be refused for creating
      exactly the contest that setting exists to allow.

      Asserted in BOTH copies: a check that differs between the apps is a validation rule
      whose outcome depends on which app served the form.
    */
    for (const copy of [PREFLIGHT, ADMIN_PREFLIGHT]) {
      const code = readCode(copy);

      expect(code).toMatch(
        /const reservesFullRound = input\.roundStartPolicy !== "until_window_closes"/,
      );

      // The short-contest branch pushes to BOTH lists, one per policy. Asserting only that
      // the file mentions `warnings.push` would go green on a version that refuses both.
      const shortContest = code.slice(
        code.indexOf("windowSeconds < roundSeconds"),
        code.indexOf("const longestPossibleRound"),
      );
      expect(shortContest.length).toBeGreaterThan(200);
      expect(shortContest).toMatch(/if \(reservesFullRound\)/);
      expect(shortContest).toMatch(/errors\.push/);
      expect(shortContest).toMatch(/warnings\.push/);
    }
  });

  it("asks the grace period to cover a round this contest can actually produce", () => {
    /*
      `resolveExpiry` clamps a round to the contest end, so under until-close no round can be
      longer than the window however high the ceiling is. Demanding grace for the full ceiling
      would refuse a short contest for a round length it cannot produce - the same
      ceiling-versus-reality confusion the whole change is about, one field along.
    */
    for (const copy of [PREFLIGHT, ADMIN_PREFLIGHT]) {
      const code = readCode(copy);
      expect(code).toMatch(
        /reservesFullRound \|\| !\(windowSeconds > 0\)\s*\n?\s*\?\s*roundSeconds/,
      );
      expect(code).toMatch(/Math\.min\(roundSeconds, Math\.ceil\(windowSeconds\)\)/);
    }
  });

  it("is one control, shared by the wizard and the editor", () => {
    // Same reasoning as `UnscoredPolicyField` and `RoundClockNote`: a rule about where money
    // and play time go, offered twice, eventually offers two different sets of options.
    for (const code of [readWizardScreen(), readCode(EDITOR)]) {
      expect(code).toMatch(/<RoundStartPolicyField/);
    }

    // And the option ids and consequence sentences come from the module the SERVER reads, so
    // the screen cannot describe a rule `round.service.ts` does not enforce.
    const field = readCode(
      "apps/admin/components/admin/games/RoundStartPolicyField.tsx",
    );
    expect(field).toMatch(/ROUND_START_POLICIES/);
    expect(field).toMatch(/ROUND_START_POLICY_COPY/);
    expect(field).not.toMatch(/reserve_full_round["']\s*:\s*\{/);
  });

  it("changes what the clock note SAYS, not just what it emphasises", () => {
    /*
      The note is the one place the derived deadline is rendered. If it kept printing one
      under until-close it would be describing the other setting - which is worse than the
      silence the component was written to fix.
    */
    const note = readCode(NOTE);

    /*
      SLICED TO THE TIMING VARIANT, because a bare `fit.reservesFullRound` match went GREEN on
      a probe that deleted this very condition. Both identifiers appear twice - the settings
      variant branches on the policy too, and `lastAttemptStart` is named inside the paragraph
      being guarded - so removing the guard leaves every name in the file exactly where it was.

      Fourth instance of the class, after the fixed-character Edit guard, `canTransitionRound`
      and the play screen's two `!expectedOrigin` copies: assert position within the construct,
      never a bare identifier.
    */
    const timing = note.slice(note.indexOf("Players can join from the moment"));
    expect(timing.length).toBeGreaterThan(400);

    const condition = timing.slice(0, timing.indexOf("An attempt may be started"));
    expect(condition.length).toBeGreaterThan(100);
    expect(condition).toMatch(/fit\.reservesFullRound/);
    expect(condition).toMatch(/fit\.lastAttemptStart/);

    // The settings variant branches too, so the policy is not merely consulted once and then
    // ignored by the paragraph an operator reads while choosing the game's own round length.
    const settings = note.slice(0, note.indexOf("Players can join from the moment"));
    expect(settings).toMatch(/fit\.reservesFullRound/);

    // Both screens pass the policy in. A note that always read the default would describe the
    // reserving rule on a permissive contest and nobody would see the two disagree.
    for (const code of [readWizardScreen(), readCode(EDITOR)]) {
      const notes = code.match(/roundStartPolicy=\{draft\.roundStartPolicy\}/g) ?? [];
      // Twice per screen: the settings variant and the timing variant.
      expect(notes.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("frozen once anyone has paid to enter", () => {
    /*
      It is absent from `EDITABLE_ONCE_ENTERED`, so the server refuses it anyway. The editor
      disables it so an operator finds that out before submitting, rather than as a refusal
      naming a field they did not knowingly change.
    */
    const policy = readCode(
      "apps/admin/lib/admin/provider-contest-edit-policy.ts",
    );
    expect(policy).not.toMatch(/roundStartPolicy/);

    const editor = readCode(EDITOR);
    const control = editor.slice(
      editor.indexOf("<RoundStartPolicyField"),
      editor.indexOf("<RoundStartPolicyField") + 260,
    );
    expect(control.length).toBeGreaterThan(60);
    expect(control).toMatch(/disabled=\{entered\}/);
  });
});
