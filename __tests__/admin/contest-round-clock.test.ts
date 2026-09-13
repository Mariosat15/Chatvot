/**
 * How a game's round length relates to the contest's start and end, on the operator's screens.
 *
 * WHAT THIS PINS, and it is the owner's report rather than a hypothetical: "the sprint circuit
 * is confusing, it lets you set the duration like 120 but then you specify also time in the
 * window play, and the two don't obviously relate."
 *
 * They do relate, through a third number that appeared on no form. The game's settings step
 * offers whatever the title's `configSchema` declares - which is how long ONE attempt lasts.
 * The timing step sets the contest's own clock. The gate that decides whether an attempt may
 * start reserves one attempt's worth of time at the end.
 *
 * THIS FILE USED TO OPEN BY DEFENDING THE CEILING, AND THAT PARAGRAPH IS NOW WRONG. It said:
 * "the gate reads `maxDurationSeconds` from the CATALOGUE row, which is the title's ceiling and
 * not this contest's setting. THAT IS NOT A BUG AND THESE TESTS MUST NOT BE CHANGED TO MAKE IT
 * ONE... Reading the configured value instead would trade a confusing message for a round that
 * stops mid-play." It is quoted rather than deleted because it was believed, it was argued
 * from chapter 03 section 1.2, and it was half right.
 *
 * WHAT WAS RIGHT: a contest that promises a full attempt must reserve a FULL attempt. Reserving
 * less would promise the player their whole session and then cut it short, which is worse than
 * either policy on its own. That property is still pinned below.
 *
 * WHAT WAS WRONG: it assumed the ceiling was the only number the platform could know. So the
 * gate reserved 300 seconds for a Circuit Sprint contest configured at 120 - refusing every
 * round for the whole contest whenever the contest was under five minutes, and telling players
 * "there is not enough time left in this competition" beside a countdown showing minutes. That
 * is the owner's report, and the objection to fixing it ("a round that stops mid-play") does not
 * apply: reserving the configured length reserves exactly as much as the player will be given.
 *
 * WHAT CHANGED TO MAKE THE FIX POSSIBLE, 8 September 2026: a title DECLARES which of its
 * settings is its play clock, with `format: "duration-seconds"`, and `resolveAttemptSeconds`
 * reads it. Platform code still learns no field name and still enumerates no game, so the
 * "no developer needed for a new title" claim is intact - and a title declaring nothing falls
 * back to the ceiling, which is never shorter than the truth, so the fallback still fails
 * closed.
 *
 * The disclosure this file was originally written to pin is all still here and still required.
 * The change is that the number being disclosed is now one the operator chose.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  deriveResultGraceSeconds,
  describeRoundFit,
  emptyDraft,
} from "../../apps/admin/components/admin/games/contest-draft";
import {
  parseConfigSchema,
  type ConfigField,
} from "../../lib/services/games/config-schema";

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
/**
 * A title's settings schema whose play clock is declared under a DELIBERATELY ODD NAME.
 *
 * `playSeconds`, not `durationSeconds`, and that is the point of the fixture rather than a
 * detail of it. The resolver must find the clock through the declared `format`, so a helper
 * named after Circuit Sprint's own key would pass just as happily against an implementation
 * that matched on the name - which is the per-game code this whole path forbids.
 */
function durationSchema(minimum: number, maximum: number): ConfigField[] {
  const parsed = parseConfigSchema({
    type: "object",
    properties: {
      playSeconds: {
        type: "integer",
        minimum,
        maximum,
        format: "duration-seconds",
      },
    },
    required: ["playSeconds"],
  });
  if (!parsed.ok) throw new Error(`fixture schema rejected: ${parsed.error}`);
  return parsed.fields;
}

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

  it("reserves the CONFIGURED playing time, not the game's ceiling", () => {
    /*
      REVERSED ON 8 SEPTEMBER 2026, and it is the owner's exact case either way: Circuit Sprint
      configured at 120 seconds against a ceiling of 300.

      This test used to assert the deadline was NOT 13:58 - that the screen had to promise
      13:55, because 13:55 was what the server enforced. Both the screen and the server now
      use the configured length, so 13:58 is the correct answer and the old assertion was
      pinning the defect in place. The inversion is deliberate and the reasoning is in the file
      header; the important part is that the screen and the gate still agree, which is what the
      original test was really protecting.
    */
    const fit = describeRoundFit({
      startTime: "2026-09-08T13:00",
      endTime: "2026-09-08T14:00",
      schemaFields: durationSchema(60, 300),
      settings: { playSeconds: 120 },
      maxDurationSeconds: 300,
    });

    expect(fit!.reservedSeconds).toBe(120);
    expect(fit!.lastAttemptStart!.getTime()).toBe(
      new Date("2026-09-08T13:58").getTime(),
    );
  });

  it("falls back to the ceiling when the title declares no play clock", () => {
    /*
      THE FALLBACK IS NOT A LEFTOVER, it is what keeps the fix general. A provider title we
      have never seen may declare no duration at all, and the ceiling is never SHORTER than
      the real length - so the fallback over-reserves, which is the visible mistake rather
      than the silent one.
    */
    const fit = describeRoundFit({
      startTime: "2026-09-08T13:00",
      endTime: "2026-09-08T14:00",
      schemaFields: [],
      settings: { somethingElse: 5 },
      maxDurationSeconds: 300,
    });

    expect(fit!.reservedSeconds).toBe(300);
    expect(fit!.lastAttemptStart!.getTime()).toBe(
      new Date("2026-09-08T13:55").getTime(),
    );
  });

  it("clamps a setting outside the declared range rather than trusting it", () => {
    /*
      An operator's stored value can be out of range - a schema whose bounds were tightened
      after the contest was drafted, or a payload that never went through the form. Reserving
      an hour on a title that allows five minutes would refuse every contest under an hour;
      reserving thirty seconds on one that requires five minutes would promise a full session
      and cut it short. Clamping is the only answer that cannot do either.
    */
    const tooLong = describeRoundFit({
      startTime: "2026-09-08T13:00",
      endTime: "2026-09-08T14:00",
      schemaFields: durationSchema(60, 300),
      settings: { playSeconds: 99_999 },
    });
    expect(tooLong!.reservedSeconds).toBe(300);

    const tooShort = describeRoundFit({
      startTime: "2026-09-08T13:00",
      endTime: "2026-09-08T14:00",
      schemaFields: durationSchema(60, 300),
      settings: { playSeconds: 1 },
    });
    expect(tooShort!.reservedSeconds).toBe(60);
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

    /*
      INVERTED, NOT UPDATED. This asserted that the note said "longest possible round", which
      was the honest description of a ceiling the operator had not chosen. Now that the note
      names the CONFIGURED playing time, that phrase would be a false statement about a number
      the operator can see on the previous step - so its absence is the assertion.
    */
    expect(code).not.toMatch(/longest possible round/i);
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
  it("names the configured playing time AND the contest length, in BOTH copies", () => {
    /*
      This is what the owner actually hit. The message used to say "shorter than one round of
      this game (300 seconds)" to an operator who had just typed 120 into that game's settings,
      so the platform appeared to be quoting a number they had not chosen and could not find.
      The 7 September wording was honest about that and still unactionable.

      BOTH SIDES OF THE COMPARISON, because "the playing time is longer than the contest" with
      one number in it leaves the operator to work out which of the two to change - and they
      live on different steps.

      Both copies, because the two apps' pre-flights are mirrored and a message that differs
      between them means the explanation an operator gets depends on which app served the form.
    */
    for (const copy of [PREFLIGHT, ADMIN_PREFLIGHT]) {
      const code = readCode(copy);
      expect(code).toMatch(/playing time you have set/);
      expect(code).toMatch(/longer than the contest itself/);
      /*
        COUNTED, BECAUSE THE SAME FACT IS TWO MESSAGES. The reserving branch refuses and the
        until-close branch warns, and both are read by an operator in the situation this
        describes - so a bare match on either phrase is satisfied by one branch while the other
        quotes a single figure. A probe that stripped the contest length out of the REFUSAL
        alone came back green on 11 September for exactly that reason.

        Same class as the play screen's two `!expectedOrigin` copies and the pause list covering
        for the emergency list: a per-branch claim has to be asserted per branch.
      */
      expect(code.match(/playing time you have set/g)).toHaveLength(2);
      expect(code.match(/longer than the contest itself/g)).toHaveLength(2);
      // Both figures interpolated, and through the humanising helper - "the playing time you
      // have set (300 seconds)" is the old problem in new words.
      expect(code.match(/describeSeconds\(roundSeconds\)/g)).toHaveLength(2);
      expect(
        code.match(/describeSeconds\(Math\.floor\(windowSeconds\)\)/g),
      ).toHaveLength(2);
      // The phrase that named an invisible ceiling must not come back.
      expect(code).not.toMatch(/longest possible round/);
    }
  });

  it("gates on the DECLARED play clock, falling back to the ceiling", () => {
    /*
      REVERSED ON 8 SEPTEMBER 2026. This test asserted the opposite - literally
      `const roundSeconds = input.title.maxDurationSeconds` - and forbade the pre-flight from
      reading the operator's settings at all. The file header quotes the reasoning; the short
      version is that the ceiling was defended as the only number the platform could know, and
      it stopped being so.

      THE FAIRNESS PROPERTY IT WAS PROTECTING IS PINNED IN THE NEXT TEST, not dropped. What is
      forbidden here instead is the shape that would break generality: reaching into
      `input.settings` by a field NAME. The resolver finds the clock through the `format`
      keyword, so this file's other guard - that no game or config key is named anywhere on
      the settings path - is what keeps the fix from becoming per-game code.
    */
    for (const copy of [PREFLIGHT, ADMIN_PREFLIGHT]) {
      const code = readCode(copy);
      expect(code).toMatch(/const roundSeconds = resolveAttemptSeconds\(/);
      // The ceiling is still an input - the fallback for a title that declares no clock - so
      // it must still be passed in. Its absence would mean such a title got no gate at all.
      expect(code).toMatch(/input\.title\.maxDurationSeconds/);
      // But never by naming one of the game's own keys.
      expect(code).not.toMatch(/input\.settings\[/);
    }
  });

  it("reserves the WHOLE attempt, never a fraction of it", () => {
    /*
      The half of the old thesis that survived, and the one worth stating loudest: a contest
      promising every player the full playing time must reserve the full playing time. Any
      shortening here - reserving half, or a fixed minute, or the window remainder - promises
      a complete session and then cuts one short, which is worse than either policy alone.

      Asserted as an exact identity rather than by reading the arithmetic, because the failure
      would be a plausible-looking factor slipped into a subtraction.
    */
    const fit = describeRoundFit({
      startTime: "2026-09-08T13:00",
      endTime: "2026-09-08T14:00",
      schemaFields: durationSchema(60, 3600),
      settings: { playSeconds: 900 },
    });

    expect(fit!.reservedSeconds).toBe(900);
    expect(fit!.lastAttemptStart!.getTime()).toBe(
      new Date("2026-09-08T13:45").getTime(),
    );
  });
});

describe("the playing time is chosen from a list, not typed in seconds", () => {
  /*
    THE OWNER'S REQUEST, and the report it answers. "It lets you set the duration like 120" -
    a bare number box in seconds, which reads as two minutes only if you stop and divide. The
    list is 1, 5, 10, 20, 30 and 60 minutes, plus a way out of the list.
  */

  it("keys the control on the declared format, never on a field name", () => {
    /*
      THE ONE FAILURE MODE OF THE "NO DEVELOPER NEEDED" CLAIM, on the smallest possible
      surface. `field.name === "durationSeconds"` would have been shorter, would have worked,
      and would have quietly made this Circuit Sprint's control rather than the platform's -
      the next title's clock would render as a number box with no explanation of why.
    */
    const code = readCode(CONFIG_FIELDS);

    expect(code).toMatch(/field\.format === "duration-seconds"/);
    // The existing guard forbids `durationSeconds` outright; this is the positive half, that
    // the branch exists at all and is reached from the field's declared role.
    expect(code).toMatch(/<DurationControl/);
  });

  it("offers the lengths the owner asked for", () => {
    const code = readCode(CONFIG_FIELDS);
    expect(code).toMatch(/DURATION_PRESET_MINUTES = \[1, 5, 10, 20, 30, 60\]/);
  });

  it("filters the list against the title's OWN declared range", () => {
    /*
      A title may allow only two to five minutes. Offering an hour that the game then clamps
      is worse than not offering it: the contest saves with a length the operator did not
      choose, and the round gate reserves that clamped value rather than the one on screen.
    */
    const code = readCode(CONFIG_FIELDS);
    const control = code.slice(code.indexOf("function DurationControl"));
    expect(control.length).toBeGreaterThan(400);

    expect(control).toMatch(/DURATION_PRESET_MINUTES\.filter\(/);
    expect(control).toMatch(/seconds >= min/);
    expect(control).toMatch(/seconds <= max/);
  });

  it("keeps a plain number box when no preset can fit", () => {
    // A title allowing at most 45 seconds cannot be expressed in whole minutes. A dropdown
    // with no usable options is a control that appears to work and offers nothing.
    const control = readCode(CONFIG_FIELDS).slice(
      readCode(CONFIG_FIELDS).indexOf("function DurationControl"),
    );
    expect(control).toMatch(/presets\.length === 0/);
    expect(control).toMatch(/<NumberBox/);
  });

  it("stores seconds, so the game receives what its own schema declares", () => {
    /*
      The minutes are presentation. Storing minutes would mean the value on the wire disagreed
      with the schema's `minimum`/`maximum`, so validation would reject a legal choice - and a
      title whose clock is genuinely in seconds would need a special case at the other end.
    */
    const control = readCode(CONFIG_FIELDS).slice(
      readCode(CONFIG_FIELDS).indexOf("function DurationControl"),
    );
    expect(control).toMatch(/onChange\(Number\(next\) \* 60\)/);
    expect(control).toMatch(/Number\(raw\) \* 60/);
  });

  it("does not change the stored value merely because Custom was opened", () => {
    // An operator who opens the box to look and changes their mind has not edited the
    // contest. Writing a value on selecting Custom would be an edit they did not make.
    const control = readCode(CONFIG_FIELDS).slice(
      readCode(CONFIG_FIELDS).indexOf("function DurationControl"),
    );
    // Reason: slice FORWARDS from the handler. `indexOf` for the closing marker finds the
    // earliest one in the whole function - which is inside the no-presets NumberBox above -
    // producing an empty slice and a test that examines nothing while looking correct.
    const opens = control.indexOf("onValueChange");
    const onSelect = control.slice(
      opens,
      control.indexOf("disabled={disabled}", opens),
    );
    expect(onSelect.length).toBeGreaterThan(60);
    expect(onSelect).toMatch(/if \(next === CUSTOM\)/);
    expect(onSelect).toMatch(/return;/);
  });

  it("remembers that Custom was chosen, rather than deriving it from the value", () => {
    /*
      THE DEFECT, reported by the owner on 11 September 2026: "when i choose custom in wizard no
      box comes to add custom round time."

      The control had no state. It decided it was in custom mode when the stored value matched no
      preset, and the handler above deliberately did nothing when Custom was picked so as not to
      edit a value the operator was only inspecting. Both halves are right on their own, and
      together they made the option UNREACHABLE: ten minutes is the default, ten minutes is a
      preset, so picking Custom changed nothing, the derived mode stayed false, the select snapped
      back and no box ever appeared. The only way in was to already hold a value no preset matched.

      Keeping the value untouched is still the rule. The MODE is what the click changes.
    */
    const control = readCode(CONFIG_FIELDS).slice(
      readCode(CONFIG_FIELDS).indexOf("function DurationControl"),
    );
    expect(control.length).toBeGreaterThan(400);

    expect(control).toMatch(/useState\(false\)/);
    expect(control).toMatch(/const custom = customChosen \|\| !matched/);

    const opens = control.indexOf("onValueChange");
    const onSelect = control.slice(
      opens,
      control.indexOf("disabled={disabled}", opens),
    );
    expect(onSelect).toMatch(/setCustomChosen\(true\)/);
    // And the rule it must not break: opening the box is not an edit.
    expect(onSelect.slice(0, onSelect.indexOf("return;"))).not.toMatch(/onChange\(/);
  });

  it("opens the box on the remembered choice, not on the value alone", () => {
    /*
      The load-bearing half, and the one a probe can reach. State that nothing renders from is
      state that changes nothing - the mode can be recorded perfectly and the box still gated on
      the value, which is the defect with an extra variable in front of it.
    */
    const control = readCode(CONFIG_FIELDS).slice(
      readCode(CONFIG_FIELDS).indexOf("function DurationControl"),
    );

    expect(control).toMatch(/\{custom && \(/);
    expect(control).not.toMatch(/\{!matched && \(/);
  });
});

describe("the wizard refuses a contest nobody could start", () => {
  /*
    THE OWNER'S SECOND REQUEST on 8 September 2026, after choosing the reserving policy as the
    default: "validation to prevent setting a playtime longer than the contest window". Under
    that policy a contest shorter than one playing time never opens - every attempt is refused
    from the first second - so saving it is never what the operator meant.

    IT BLOCKS RATHER THAN WARNS, and that is the whole point. `RoundClockNote` already showed
    the amber caution and an operator could read it, agree, and click Next anyway; the contest
    then saves, publishes, sells seats and refuses every one of them.
  */

  it("blocks the schedule step, naming both durations", () => {
    const code = readCode(WIZARD);
    const guard = code.slice(code.indexOf("if (step === STEP_SCHEDULE)"));
    expect(guard.length).toBeGreaterThan(200);

    expect(guard).toMatch(/fit\?\.windowTooShort && fit\.reservesFullRound/);
    // Both numbers, because "too short" without them sends the operator to guess which of the
    // two fields to change - and the playing time is three steps back.
    expect(guard).toMatch(/describeDurationSeconds\(\s*fit\.reservedSeconds,?\s*\)/);
    expect(guard).toMatch(/describeDurationSeconds\(\s*fit\.windowSeconds,?\s*\)/);
  });

  it("blocks ONLY under the reserving policy", () => {
    /*
      Under `until_window_closes` a short contest is legitimate: a late starter is closed with
      the contest and scored on what they managed, which is exactly what that policy is for.
      Blocking there would forbid the one configuration that answers the problem.
    */
    const fit = describeRoundFit({
      startTime: "2026-09-08T13:00",
      endTime: "2026-09-08T13:05",
      schemaFields: durationSchema(60, 3600),
      settings: { playSeconds: 600 },
      roundStartPolicy: "until_window_closes",
    });
    expect(fit!.windowTooShort).toBe(true);
    expect(fit!.reservesFullRound).toBe(false);

    const reserving = describeRoundFit({
      startTime: "2026-09-08T13:00",
      endTime: "2026-09-08T13:05",
      schemaFields: durationSchema(60, 3600),
      settings: { playSeconds: 600 },
      roundStartPolicy: "reserve_full_round",
    });
    expect(reserving!.windowTooShort).toBe(true);
    expect(reserving!.reservesFullRound).toBe(true);
  });

  it("routes the refusal through the shared blocking mechanism", () => {
    // Not a second disabled attribute on the Next button. A refusal that only greys a control
    // names no reason, which is the shape this programme keeps finding.
    const code = readCode(WIZARD);
    expect(code).toMatch(/const blocked = blockedReason\(\)/);
  });
});

describe("the result grace period is derived from the playing time", () => {
  /*
    WHY THIS IS DERIVED RATHER THAN ASKED FOR. No screen offers it, because no operator has a
    basis for choosing it - and `contest-preflight.ts` REFUSES a contest whose grace is
    shorter than one attempt plus five minutes. Left at a fixed 900, every contest with more
    than ten minutes of play would have been refused, naming a field the operator cannot see.
  */

  it("raises the floor to cover the chosen playing time", () => {
    const draft = { ...emptyDraft, resultGracePeriodSeconds: 900 };

    expect(deriveResultGraceSeconds(draft, 600)).toBe(900);
    // Twenty minutes of play needs 25 minutes of grace, which 900 does not cover.
    expect(deriveResultGraceSeconds(draft, 1200)).toBe(1200 + 300);
    expect(deriveResultGraceSeconds(draft, 3600)).toBe(3600 + 300);
  });

  it("never LOWERS a grace period somebody set deliberately", () => {
    // A stored contest whose operator allowed longer keeps it. Shortening a grace period
    // retroactively is how a result that was going to be counted stops being counted.
    const generous = { ...emptyDraft, resultGracePeriodSeconds: 7200 };
    expect(deriveResultGraceSeconds(generous, 600)).toBe(7200);
  });

  it("leaves it alone when nothing declares a playing time", () => {
    // Same rule as the rest of this path: an absent duration means no statement, never a
    // guessed one.
    const draft = { ...emptyDraft, resultGracePeriodSeconds: 900 };
    expect(deriveResultGraceSeconds(draft, undefined)).toBe(900);
  });

  it("uses the SAME margin the pre-flight then demands, in one definition", () => {
    /*
      "One rule, two copies" in its most silent form. Two margins means the wizard derives a
      number the server refuses, on a field no screen offers - so the contest simply cannot be
      saved and the message names a setting that is not there.
    */
    expect(readCode(DRAFT)).toMatch(
      /import \{ RESULT_GRACE_MARGIN_SECONDS \} from "@\/lib\/services\/games\/contest-preflight"/,
    );
    for (const copy of [PREFLIGHT, ADMIN_PREFLIGHT]) {
      expect(readCode(copy)).toMatch(
        /export const RESULT_GRACE_MARGIN_SECONDS = 5 \* 60/,
      );
      expect(readCode(copy)).toMatch(
        /longestPossibleRound \+ RESULT_GRACE_MARGIN_SECONDS/,
      );
    }
  });

  it("is applied by the payload builders, so no caller can forget", () => {
    /*
      The derivation has to sit in the one place that turns the draft into a request. A wizard
      that derived it in a handler would leave the editor sending the stored 900 - and the two
      screens would disagree about whether a twenty-minute contest can be saved at all.
    */
    const draft = readCode(DRAFT);
    const calls = draft.match(/resultGracePeriodSeconds: deriveResultGraceSeconds\(/g) ?? [];
    // Twice: the create payload and the edit payload.
    expect(calls.length).toBe(2);
    expect(draft).not.toMatch(/resultGracePeriodSeconds: draft\.resultGracePeriodSeconds/);
  });
});

describe("the three files that carry this rule are mirrored", () => {
  /*
    `check:mirrors` compares MODELS, so it has no opinion about any of these. Two copies of the
    clock arithmetic that disagreed would make how much time a contest reserves depend on which
    app answered - and both apps finalize, both apps run a cron, and both apps' pre-flights
    refuse. It is the "one rule, two copies" shape behind `referenceId`, `failedReason`,
    `challengeId` and the Game Master `||`, none of which the mirror guard can see.

    Compared byte for byte, newlines normalised, because a difference in wording is as
    dangerous here as a difference in arithmetic: the refusal text names two durations, and an
    operator reading a different explanation from the one the server enforced is exactly the
    confusion the whole slice exists to remove.
  */
  const pairs: [string, string][] = [
    ["lib/services/games/config-schema.ts", "apps/admin/lib/services/games/config-schema.ts"],
    [PREFLIGHT, ADMIN_PREFLIGHT],
    [
      "lib/services/games/round-types.ts",
      "apps/admin/lib/services/games/round-types.ts",
    ],
  ];

  it.each(pairs)("%s agrees with its admin copy", (main, admin) => {
    const read = (p: string) => readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n");
    expect(read(admin)).toBe(read(main));
  });

  it("the round SERVICES are deliberately NOT mirrored", () => {
    /*
      `round.service.ts`, `round-launch.service.ts` and `round-status.service.ts` exist in the
      main app only, and that is the same decision as `participant-score.service.ts`: creating
      and launching a round is the one door, and a second copy in the app with the widest
      privileges is a second door. Pinned so a later "consistency" sync does not open one.
    */
    for (const service of [
      "round.service.ts",
      "round-launch.service.ts",
      "round-status.service.ts",
    ]) {
      expect(existsSync(join(ROOT, "lib/services/games", service))).toBe(true);
      expect(
        existsSync(join(ROOT, "apps/admin/lib/services/games", service)),
      ).toBe(false);
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

      RE-AIMED 11 September 2026, AND IT HAD BEEN GREEN AGAINST ITS OWN PROBE. The end marker was
      "An attempt may be started", wording this component no longer uses, so `indexOf` returned
      -1 and `slice(0, -1)` handed back almost the whole file - which contains both identifiers
      twice over, in the settings variant and inside the paragraph being guarded. So the guard
      passed however the condition was mutilated.

      That is the "assert the slice found something" rule with a sharper edge than the usual one:
      a marker that has moved does not produce an empty slice here, it produces a slice so wide
      that every assertion is trivially true. Both ends are now asserted to exist.
    */
    const timingStart = note.indexOf("Players can join from the moment");
    expect(timingStart).toBeGreaterThan(-1);
    const timing = note.slice(timingStart);
    expect(timing.length).toBeGreaterThan(400);

    const conditionEnd = timing.indexOf("Play lasts");
    expect(conditionEnd).toBeGreaterThan(-1);
    const condition = timing.slice(0, conditionEnd);
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
