import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseConfigSchema,
  defaultConfigValues,
} from "@/lib/services/games/config-schema";
import { challengeTitleFacts } from "@/lib/services/games/challenge-game-copy";
import type { ChallengeableTitle } from "@/lib/services/games/challengeable-titles.service";

/**
 * The first half of the owner's 13 September 2026 report about creating a challenge:
 *
 *   1. "the selection of games must be a list as the games will be many"
 *   2. "the screen must adapt to any game settings"
 *
 * NEITHER WAS A CALCULATION FAULT, and there is no risk number - a horizontal strip of two
 * chips renders perfectly and a dialog that asks for no settings submits a valid challenge, so
 * nothing threw and nothing logged. What the second one cost is real all the same: every
 * challenge was created on the schema's own defaults, so a title's board size, difficulty or
 * playing time were settings only an operator could ever choose.
 *
 * The guards split three ways. The facts a row shows and the values an untouched form holds are
 * BEHAVIOURAL, because both are computed. Which shape the list is, and that the two pieces of
 * state move together, are STRUCTURAL. And the no-per-game-code claim is a negative assertion,
 * which is the load-bearing one: a dialog that renders a schema-driven form and then special-
 * cases one title's field satisfies every positive assertion here.
 */

const ROOT = process.cwd();
const PICKER = join(ROOT, "components", "challenges", "ChallengeGamePicker.tsx");
const FIELDS = join(
  ROOT,
  "components",
  "challenges",
  "ChallengeSettingsFields.tsx",
);
const DIALOG = join(
  ROOT,
  "components",
  "challenges",
  "ChallengeCreateDialog.tsx",
);
const ADMIN_FIELDS = join(
  ROOT,
  "apps",
  "admin",
  "components",
  "admin",
  "games",
  "ConfigSchemaFields.tsx",
);
const SHARED_SCHEMA = join(
  ROOT,
  "lib",
  "services",
  "games",
  "config-schema.ts",
);

/**
 * Comments stripped before matching, always.
 *
 * Every file here argues in prose about the thing it must not do - the settings form explains
 * why a `field.name === "boardSize"` check is forbidden, and names one to explain it. A bare
 * match reads the warning as the offence and fails a correct file for discussing the mistake,
 * which is the kind of guard the first person it inconveniences deletes.
 */
function readCode(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function title(overrides: Partial<ChallengeableTitle> = {}): ChallengeableTitle {
  return {
    gameKey: "provider:chartvolt-games:circuit-sprint",
    providerKey: "chartvolt-games",
    providerName: "ChartVolt Games",
    gameCode: "circuit-sprint",
    displayName: "Circuit Sprint",
    playMode: "anytime",
    scoreDirection: "higher_is_better",
    scoreType: "integer",
    maxDurationSeconds: 600,
    supportsOneVsOne: true,
    supportsContentSeed: true,
    schemaOk: true,
    settingsFields: [],
    defaults: {
      durationMinutes: 60,
      roundStartPolicy: "until_window_closes",
      settings: {},
    },
    ...overrides,
  } as ChallengeableTitle;
}

describe("what a row in the game list says", () => {
  it("leads with the provider and ends with which direction wins", () => {
    // Reason: the direction is the one fact a player cannot discover by playing - a puzzle
    // scoring upward and a time trial scoring downward look identical from the lobby, and
    // getting it backwards is the difference between playing the game and playing it wrong.
    const facts = challengeTitleFacts(title());
    expect(facts[0]).toBe("ChartVolt Games");
    expect(facts.at(-1)).toBe("Highest wins");
  });

  it("says the LOWEST wins for a downward title", () => {
    const facts = challengeTitleFacts(
      title({ scoreDirection: "lower_is_better" }),
    );
    expect(facts.at(-1)).toBe("Lowest wins");
  });

  it("states the round ceiling as an UP TO, never as a length", () => {
    // Reason: `maxDurationSeconds` is the longest a round of this title may last, not how long
    // it will. Printing it bare is a deadline the platform never set - the same distinction
    // R66 turned on, one screen along.
    const facts = challengeTitleFacts(title({ maxDurationSeconds: 600 }));
    expect(facts).toContain("Up to 10 min per round");
  });

  it("says nothing at all about the clock when the title declares none", () => {
    const facts = challengeTitleFacts(title({ maxDurationSeconds: undefined }));
    expect(facts.some((fact) => /min|sec|round/i.test(fact))).toBe(false);
  });

  it("includes the genre when one is stored and omits it otherwise, never a placeholder", () => {
    expect(challengeTitleFacts(title({ category: "Puzzle" }))).toContain(
      "Puzzle",
    );
    expect(
      challengeTitleFacts(title({ category: undefined })).join(" "),
    ).not.toMatch(/uncategor/i);
  });

  it("names no game and no provider key, so a new title needs no code here", () => {
    // Reason: the one failure mode of the no-developer-needed claim is something that
    // enumerates games. Every fact above is read off the row.
    const code = readCode(
      join(ROOT, "lib", "services", "games", "challenge-game-copy.ts"),
    );
    expect(code).not.toMatch(/circuit-sprint|chartvolt-games|gameCode ===/);
  });
});

describe("the list is a list", () => {
  it("scrolls on its own axis with a capped height, rather than growing the dialog", () => {
    const code = readCode(PICKER);
    expect(code).toMatch(/max-h-\[[^\]]+\][^"]*overflow-y-auto/);
  });

  it("is not the horizontal strip it replaced", () => {
    // Reason: the defect was the SHAPE. A `flex-wrap` row of chips reads correctly in a diff
    // and puts the eleventh game off the right-hand edge of a dialog nobody scrolls sideways.
    const code = readCode(PICKER);
    expect(code).not.toMatch(/overflow-x-auto|flex-nowrap/);
  });

  it("renders Trading first and without fetching it", () => {
    // Reason: Trading is not a `ChallengeableTitle`. If a provider fetch fails, or every
    // provider is disabled, the one option every existing challenge depends on must survive.
    const code = readCode(PICKER);
    const trading = code.indexOf('label="Trading"');
    const mapped = code.indexOf("titles.map(");
    expect(trading).toBeGreaterThan(-1);
    expect(mapped).toBeGreaterThan(trading);
  });

  it("shows an unusable title disabled WITH ITS REASON, rather than hiding it", () => {
    // Reason: a reason rendered as text, not a `title` attribute - a disabled control cannot
    // be hovered on a phone, which is where the reason is most needed.
    const code = readCode(PICKER);
    expect(code).toMatch(/reason=\{reason\}/);
    expect(code).toMatch(/\{reason \?\? facts\.join/);
  });
});

describe("an untouched settings form holds the title's own defaults", () => {
  const parsed = parseConfigSchema({
    type: "object",
    properties: {
      rounds: { type: "integer", minimum: 1, maximum: 20, default: 5 },
      gridSize: { type: "integer", minimum: 4, maximum: 8 },
      ranked: { type: "boolean" },
    },
  });

  it("seeds every declared default", () => {
    if (!parsed.ok) throw new Error("fixture schema should parse");
    expect(defaultConfigValues(parsed.fields).rounds).toBe(5);
  });

  it("seeds a boolean with no declared default as OFF, and leaves a bare number ABSENT", () => {
    // Reason: the two are different facts. A checkbox has to render in one position or the
    // other, so off is the honest reading of "nobody has said"; a number box left empty means
    // exactly that, and seeding it with the minimum would submit a choice nobody made.
    if (!parsed.ok) throw new Error("fixture schema should parse");
    const seeded = defaultConfigValues(parsed.fields);
    expect(seeded.ranked).toBe(false);
    expect("gridSize" in seeded).toBe(false);
  });

  it("is ONE definition shared with the admin form, not a second copy of the same rule", () => {
    // Reason: "one rule, two copies" is the shape behind `referenceId`, `failedReason`,
    // `challengeId` and the Game Master `||`. Here the drift would mean an operator's untouched
    // form and a player's untouched form producing different rounds of the same title. The
    // admin file re-exports rather than declaring, so a probe deleting the shared function
    // breaks both apps at once.
    expect(readCode(SHARED_SCHEMA)).toMatch(
      /export function defaultConfigValues/,
    );
    expect(readCode(ADMIN_FIELDS)).toMatch(
      /export \{ defaultConfigValues \} from "@\/lib\/services\/games\/config-schema"/,
    );
    expect(readCode(ADMIN_FIELDS)).not.toMatch(
      /function defaultConfigValues/,
    );
  });
});

describe("the settings form adapts to any game", () => {
  it("names no field, no game code and no provider key", () => {
    // THE LOAD-BEARING ASSERTION. Everything else here is satisfied by a form that renders the
    // schema correctly and then special-cases one title - which is exactly how the acceptance
    // criterion stops being true while every existing test still passes.
    const code = readCode(FIELDS);
    expect(code).not.toMatch(
      /circuit-sprint|chartvolt-games|gameCode|gameKey|providerKey/,
    );
    expect(code).not.toMatch(/field\.name ===/);
  });

  it("branches on the declared field TYPE and FORMAT, which is what makes it general", () => {
    const code = readCode(FIELDS);
    expect(code).toMatch(/field\.type === "boolean"/);
    expect(code).toMatch(/field\.format === "duration-seconds"/);
  });

  it("shows a play clock in minutes while STORING seconds", () => {
    // Reason: the minutes are presentation. Storing them would mean a title whose clock is
    // genuinely in seconds needs a special case at the other end - and the stored value would
    // no longer be what the schema declares.
    const code = readCode(FIELDS);
    expect(code).toMatch(/Number\(raw\) \* 60/);
    expect(code).toMatch(/Math\.round\(usable \/ 60\)/);
  });

  it("states a duration field's bounds in the unit the box is showing", () => {
    // Reason: printing the schema's raw seconds beside a box holding minutes is how somebody
    // types 600 into a field expecting 10.
    const code = readCode(FIELDS);
    expect(code).toMatch(/duration \? Math\.round\(raw \/ 60\) : raw/);
  });

  it("draws its own list surface opaque, not on the dialog's translucent one (R60)", () => {
    // Reason: a browser paints a native select's list itself from this element's own
    // background-color, so a translucent value composites over the browser's light surface and
    // every option is white on white - which is R60 exactly, and it reported as missing data.
    const code = readCode(FIELDS);
    const select = code.slice(code.indexOf("<select"));
    expect(select).toMatch(/bg-gray-800(?!\/)/);
  });

  it("says so when a title has no settings, rather than rendering nothing", () => {
    // Reason: a player who saw settings on the previous game otherwise assumes this one is
    // still loading, or that the dialog is broken.
    expect(readCode(FIELDS)).toMatch(/fields\.length === 0/);
    expect(readFileSync(FIELDS, "utf8")).toMatch(/no settings to choose/i);
  });
});

describe("the dialog carries the chosen settings, and only the chosen game's", () => {
  it("moves the game and its settings TOGETHER, everywhere, with no third writer", () => {
    // THE PROPERTY: a component that seeds the defaults on selection and then resets the game
    // somewhere else without them leaves the previous title's keys in the payload, which the
    // create route refuses while naming a field the player never saw.
    //
    // Reason this asserts PER OCCURRENCE rather than comparing two counts: the first version
    // was `seeds.length >= selects.length`, and a probe deleting one seed came back GREEN,
    // because a THIRD `setGameSettings` exists legitimately - the per-field onChange that
    // merges one value - so 2 >= 2 held with the defect in place. A tally cannot tell a paired
    // writer from an unrelated one, so each `setSelection` is required to carry a seed with it.
    const code = readCode(DIALOG);
    const selects = [...code.matchAll(/setSelection\(/g)];
    expect(selects).toHaveLength(2);
    for (const at of selects) {
      const after = code.slice(at.index, at.index + 220);
      expect(after).toMatch(/setGameSettings\(/);
    }
  });

  it("replaces the settings WHOLE on a game change, never merging the previous game's", () => {
    // Reason: the seed now comes from the title's own resolved defaults rather than from the
    // schema's declared ones - an operator may pre-choose a board size per title (13 Sep 2026),
    // and `listChallengeableTitles` resolves that answer server-side. The property under test is
    // unchanged: whatever seeds it, the previous game's keys must not survive the change.
    const code = readCode(DIALOG);
    const chooser = code.slice(
      code.indexOf("const chooseGame"),
      code.indexOf("const [formData"),
    );
    expect(chooser.length).toBeGreaterThan(60);
    expect(chooser).toMatch(/next\.title\.defaults\.settings/);
    expect(chooser).not.toMatch(/\.\.\.gameSettings/);
  });

  it("sends them to the create route, and reads the field list off the chosen title", () => {
    const code = readCode(DIALOG);
    expect(code).toMatch(/settings: gameSettings/);
    expect(code).toMatch(/fields=\{selection\.title\.settingsFields\}/);
  });

  it("routes every pick through the one handler rather than setting state from the picker", () => {
    // Reason: `onSelect={setSelection}` compiles, reviews as correct and silently skips the
    // seeding - the form then renders the new title's controls over the old title's values.
    const code = readCode(DIALOG);
    expect(code).toMatch(/onSelect=\{chooseGame\}/);
    expect(code).not.toMatch(/onSelect=\{setSelection\}/);
  });
});
