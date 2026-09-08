/**
 * The game contest wizard, and the words the content assistant is given.
 *
 * THE OWNER'S REPORT, 8 September 2026: "the game competition wizard - I want it to look like
 * the trading competition one but with the data for the game, I need consistency, also use the
 * AI for the generation of the content."
 *
 * Two things were wrong and only one of them was cosmetic. The chrome: the trading form has a
 * progress rail, a Quick Preview and an accented step header, and the game wizard had a
 * four-item breadcrumb and a flat panel, so an operator creating a game contest arrived
 * somewhere that looked like a different admin tool. And the assistant: its system prompt was
 * one hard-coded string about "a trading competition platform... content that attracts
 * traders", which on a puzzle contest produces confident, fluent copy about markets and profit
 * for a game that has neither - no error, nothing in a log, which is this codebase's recurring
 * failure shape.
 *
 * WHAT IS PINNED BELOW, in order: that the vocabulary is composed from catalogue fields and
 * never from the request body; that trading's own prompt did not change; that the game wizard
 * renders the SHARED shell rather than a second copy of it; that every AI entry point carries
 * the game; and that nothing here enumerates a game.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  TRADING_SYSTEM_PROMPT,
  TRADING_VOCABULARY,
  describeSubject,
  describeWinningRule,
  providerVocabulary,
} from "../../apps/admin/lib/admin/ai-contest-vocabulary";

const ROOT = join(__dirname, "..", "..");
const ADMIN = join(ROOT, "apps", "admin");

const VOCABULARY = join(ADMIN, "lib/admin/ai-contest-vocabulary.ts");
const AI_ROUTE = join(ADMIN, "app/api/ai/generate-competition/route.ts");
const SHELL = join(ADMIN, "components/admin/wizard/WizardShell.tsx");
const AI_PANEL = join(ADMIN, "components/admin/wizard/AiContentPanel.tsx");
const WIZARD = join(ADMIN, "components/admin/games/ProviderContestWizard.tsx");
const WIZARD_STEPS = join(ADMIN, "components/admin/games/wizard");
const NEW_PAGE = join(ADMIN, "app/competitions/new/page.tsx");

/**
 * Source with comments stripped.
 *
 * Every file here EXPLAINS the mistake it exists to avoid, naming the very things asserted
 * against below - "never about trading", "no market card". A test that reads prose fails in
 * both directions: it flags a correct file for discussing the mistake and passes a broken one
 * whose only mention of the right thing is in a comment.
 */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** The wizard SCREEN: the orchestrator plus every step file it renders. */
function wizardScreen(): string {
  const files = readdirSync(WIZARD_STEPS).filter(
    (name) => name.endsWith(".ts") || name.endsWith(".tsx"),
  );
  if (files.length === 0) {
    throw new Error("No step files under components/admin/games/wizard");
  }
  return [code(WIZARD), ...files.map((f) => code(join(WIZARD_STEPS, f)))].join(
    "\n",
  );
}

const PUZZLE = {
  displayName: "Circuit Sprint",
  category: "puzzle",
  description: "Trace the shortest path across a grid before the clock runs out.",
  scoreDirection: "higher_is_better" as const,
  scoreType: "integer" as const,
  typicalDurationSeconds: 120,
};

// =======================================================================================
// The vocabulary comes off the catalogue row
// =======================================================================================

describe("providerVocabulary - the prompt describes the game the operator picked", () => {
  it("names the title and how it decides a winner", () => {
    const vocabulary = providerVocabulary(PUZZLE);

    expect(vocabulary.systemPrompt).toContain("Circuit Sprint");
    expect(vocabulary.systemPrompt).toContain("the highest score wins");
    // And the provider's own blurb, which is what stops the copy being generic when a
    // title's name says nothing about what it is.
    expect(vocabulary.systemPrompt).toContain("Trace the shortest path");
  });

  it("does not reuse trading's prompt for a game", () => {
    /*
      The defect in one assertion. The old route sent this string for every contest, so a
      puzzle got copy written for "a trading competition platform" and an audience of
      "traders" - correct English, entirely wrong subject, and nothing anywhere reported it.
    */
    const vocabulary = providerVocabulary(PUZZLE);

    expect(vocabulary.systemPrompt).not.toBe(TRADING_SYSTEM_PROMPT);
    expect(vocabulary.systemPrompt).not.toContain(
      "trading competition platform",
    );
    expect(vocabulary.systemPrompt).not.toContain("attracts traders");
    expect(vocabulary.audience).toBe("players");
  });

  it("forbids the trading words by name, not by hope", () => {
    /*
      Stated as a ban because a model writing about a puzzle will still reach for "traders"
      and "markets" - almost every other sentence on this platform uses them. The three
      checked here are the ones that would read as a platform-wide claim rather than as a
      stylistic slip.
    */
    const prompt = providerVocabulary(PUZZLE).systemPrompt;
    const banned = prompt.slice(prompt.indexOf("Never use these words:"));

    expect(banned.length).toBeGreaterThan(30);
    for (const word of ["trading", "market", "leverage"]) {
      expect(banned).toContain(word);
    }
  });

  it("tells the model not to invent the prize, the field size or the start", () => {
    // Those three are the operator's settings, and copy naming a figure nobody configured is
    // a promise to a paying player that the contest will not keep.
    expect(providerVocabulary(PUZZLE).systemPrompt).toMatch(
      /Do not claim a prize amount, a player count or a start time/,
    );
  });

  it("says something about a game with no description and no duration", () => {
    // A catalogue row with only the required fields is the normal case for a title an
    // operator has just synced, and the prompt must still describe a game rather than
    // trailing off into an empty bullet.
    const bare = providerVocabulary({
      displayName: "Tile Rush",
      scoreDirection: "lower_is_better",
      scoreType: "integer",
    });

    expect(bare.systemPrompt).toContain("A skill game called Tile Rush");
    expect(bare.systemPrompt).toContain("the lowest score wins");
    expect(bare.systemPrompt).not.toContain("undefined");
    expect(bare.systemPrompt).not.toMatch(/A round takes about\s*(seconds)?/);
  });
});

describe("describeWinningRule - the direction and the units are read together", () => {
  it("reads a timed game as speed only when lower is better", () => {
    /*
      THE CASE THAT WOULD BE EXACTLY BACKWARDS. A title reporting milliseconds where a HIGHER
      number wins is measuring how long a player survived, not how fast they were, and
      "the fastest time wins" in front of players would invert how the game is played. So the
      unit is never read on its own.
    */
    expect(describeWinningRule("lower_is_better", "duration_ms")).toBe(
      "the fastest time wins",
    );
    expect(describeWinningRule("higher_is_better", "duration_ms")).toBe(
      "the longest time survived wins",
    );
  });

  it("reads a scored game by its direction", () => {
    expect(describeWinningRule("higher_is_better", "integer")).toBe(
      "the highest score wins",
    );
    expect(describeWinningRule("lower_is_better", "decimal")).toBe(
      "the lowest score wins",
    );
  });

  it("puts the genre beside the name when the catalogue declares one", () => {
    expect(describeSubject(PUZZLE)).toBe("Circuit Sprint (puzzle)");
    expect(
      describeSubject({
        displayName: "Tile Rush",
        scoreDirection: "higher_is_better",
        scoreType: "integer",
      }),
    ).toBe("Tile Rush");
  });
});

describe("trading's own prompt did not change", () => {
  it("is the same string it always was", () => {
    /*
      The only evidence this work does not alter what the trading wizard produces is that its
      prompt is untouched. Same reasoning as keeping the Game Master `||` verbatim while
      settlement was extracted: improving it in the same edit destroys the proof.
    */
    expect(TRADING_VOCABULARY.systemPrompt).toBe(TRADING_SYSTEM_PROMPT);
    expect(TRADING_SYSTEM_PROMPT).toContain(
      "creative marketing expert for a trading competition platform",
    );
    expect(TRADING_SYSTEM_PROMPT).toContain(
      "engaging, exciting competition content that attracts traders",
    );
  });
});

// =======================================================================================
// The route: gameKey is a lookup key, not vocabulary
// =======================================================================================

describe("the AI route derives the words server-side", () => {
  it("reads only prompt, type and gameKey off the body", () => {
    /*
      A caller-supplied game name or genre would be arbitrary text inside a system prompt, and
      - more mundanely - a way for the wizard's own state to drift from a catalogue an
      operator has since edited, so the copy describes a game by a name nobody uses.
    */
    const source = code(AI_ROUTE);

    /*
      ASSERTED AS AN EXACT AND ONLY DESTRUCTURE, because the near-miss version of this test
      does nothing. Written as "the file must not mention `displayName` near `request.json()`"
      it passes on `const { prompt, type, gameKey, displayName } = await request.json()` -
      the added field sits BEFORE the call, so no proximity pattern anchored on the call can
      see it. All four of these words legitimately appear elsewhere in the route, in the
      database projection and the lean type, so the only safe assertion is what the body's
      one destructure contains.
    */
    const destructures =
      source.match(/const \{[^}]*\} = await request\.json\(\)/g) ?? [];

    expect(destructures).toHaveLength(1);
    expect(destructures[0]).toBe(
      "const { prompt, type, gameKey } = await request.json()",
    );
  });

  it("builds the vocabulary from the row the key found", () => {
    const source = code(AI_ROUTE);
    expect(source).toMatch(/providerVocabulary\(title\)/);
    expect(source).toMatch(/ProviderGame\.findOne\(\{ gameKey: gameKey\.trim\(\) \}\)/);
  });

  it("refuses an unknown game instead of quietly writing trading copy", () => {
    /*
      THE LOAD-BEARING HALF, and the tempting shortcut is the defect: falling back to trading
      when the lookup misses produces fluent, confident, wrong copy with nothing to notice.
      Asserted by position - `TRADING_VOCABULARY` must be reachable only from the
      no-key-at-all branch, so it appears exactly once in the resolver.
    */
    const source = code(AI_ROUTE);
    const resolver = source.slice(
      source.indexOf("async function resolveVocabulary"),
      source.indexOf("export async function POST"),
    );

    expect(resolver.length).toBeGreaterThan(300);
    expect(resolver.match(/TRADING_VOCABULARY/g) ?? []).toHaveLength(1);

    const afterLookup = resolver.slice(resolver.indexOf("if (!title)"));
    expect(afterLookup.length).toBeGreaterThan(50);
    expect(afterLookup).not.toContain("TRADING_VOCABULARY");
    expect(afterLookup).toMatch(/ok: false/);
  });

  it("still refuses a caller who is not granted the competitions section", () => {
    // R51's guard, re-asserted here because this route gained a body field: a new parameter
    // is exactly the change during which a guard gets moved below the parse.
    const source = code(AI_ROUTE);
    const guard = source.indexOf('guardSection("competitions")');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(source.indexOf("request.json()"));
  });
});

// =======================================================================================
// The chrome: one shell, two wizards
// =======================================================================================

describe("the game wizard wears the trading wizard's chrome", () => {
  it("renders the shared shell rather than its own", () => {
    const screen = wizardScreen();

    for (const element of [
      "<WizardShell",
      "<WizardStepRail",
      "<WizardPreview",
      "<WizardStepCard",
    ]) {
      expect(screen).toContain(element);
    }
    expect(screen).toMatch(
      /from "@\/components\/admin\/wizard\/WizardShell"/,
    );
  });

  it("has no chrome of its own, which is the half that stops a second look-alike", () => {
    /*
      Importing the shell is trivially satisfied by a file that also hand-rolls a panel beside
      it - the shape behind every "one rule, two copies" defect here. The two headings are the
      shell's, so finding either in a consumer means somebody has rebuilt the sidebar.
    */
    const screen = wizardScreen();

    expect(screen).not.toContain("Creation Progress");
    expect(screen).not.toContain("Quick Preview");
    // The old breadcrumb: a bare ordered list of step labels with its own state styling.
    expect(screen).not.toMatch(/<ol[^>]*>/);

    // And the definitions live in the shell, or the assertions above pass on a screen with
    // no sidebar at all.
    expect(code(SHELL)).toContain("Creation Progress");
    expect(code(SHELL)).toContain("Quick Preview");
  });

  it("drives the rail and the step bodies from one list, by name", () => {
    /*
      `step === 3` and a rail built from a second array are how a reordered wizard renders one
      step's body under another step's heading. Every body is gated on a named constant, so
      moving a step is one edit to the list.
    */
    const source = code(WIZARD);

    expect(source).toMatch(/steps=\{STEPS\}/);
    // The heading is resolved out of the same list the rail is built from. Written with
    // `.at()` rather than STEPS[step] so the lookup is total; what matters is that the list
    // is STEPS and the index is the live step, not the spelling of the access.
    expect(source).toMatch(/STEPS\.at\(step\)/);
    expect(source).toMatch(/step=\{currentStep\}/);
    expect(source).not.toMatch(/step === \d/);
    expect(source).toMatch(/const STEP_REVIEW = \d/);
  });

  it("shows game facts in the preview and no trading ones", () => {
    /*
      The trading form's preview reports starting capital and leverage. A game has neither, and
      a preview that kept them would be `05` s10's rule broken on the smallest possible
      surface: a figure captioned as this contest's while belonging to another game.
    */
    const source = code(WIZARD);

    expect(source).toMatch(/label="Game"/);
    expect(source).toMatch(/label="Play time"/);
    expect(source).toMatch(/label="Prize ranks"/);

    for (const field of ["startingCapital", "leverage", "assetClass"]) {
      expect(wizardScreen()).not.toContain(field);
    }
  });

  it("previews the play time the operator chose, not the title's ceiling", () => {
    /*
      THE LABEL CHANGED BECAUSE THE VALUE DID, and asserting only the caption would pass on
      the bug. This row read "up to 300s" off `selected.maxDurationSeconds` while the operator
      had set two minutes - a number that appears on no other screen and that nobody chose.

      Pinned as "resolves, and does not read the ceiling directly", because the ceiling is
      still a legitimate INPUT to the resolver: a title declaring no play clock falls back to
      it. What must not happen is the preview reaching past `resolveAttemptSeconds` for it.
    */
    const source = code(WIZARD);

    expect(source).toMatch(/resolveAttemptSeconds\(/);
    expect(source).toMatch(/value=\{playTime \? describeDurationSeconds\(playTime\)/);
    expect(source).not.toMatch(/up to \$\{/);
    expect(source).not.toMatch(/value=\{[^}]*selected\?\.maxDurationSeconds/);
  });

  it("has no market card, because a puzzle does not care", () => {
    // The forex market's state gates trading order placement and nothing a game does.
    // Carrying the trading form's status card here would be a control that appears to mean
    // something and cannot.
    const screen = wizardScreen();
    expect(screen).not.toMatch(/market-status/);
    expect(screen).not.toMatch(/marketStatus/);
    expect(code(NEW_PAGE)).not.toMatch(/market-status/);
  });

  it("names no game anywhere, so a new title needs no code", () => {
    /*
      The single failure mode of the "no developer needed for a new title" claim is something
      that enumerates games. The wizard reads the catalogue row it was handed; a comparison on
      a game code against a LITERAL is where the first special case would go.

      NARROWED, BECAUSE THE FIRST VERSION FAILED ON CORRECT CODE. A bare `gameCode ===` ban
      caught `selected?.gameCode === title.gameCode`, which is how the picker recognises the
      row an operator chose - two catalogue values compared with each other, naming no game at
      all. A guard that fires on the correct implementation is the fastest way to have it
      deleted along with the half that matters. Same trap as the blanket `GameIcon` ban in
      `13` s4.1g and the lower-cased `durationSeconds` check in the clock note's tests.
    */
    const screen = wizardScreen();

    expect(screen).not.toMatch(/gameCode\s*===\s*["'`]/);
    expect(screen).not.toMatch(/providerKey\s*===\s*["'`]/);
    expect(screen).not.toMatch(/switch\s*\(\s*[\w.?]*(gameCode|gameKey)/i);
    expect(screen).not.toMatch(/circuit|sprint/i);
    expect(code(VOCABULARY)).not.toMatch(/circuit|sprint/i);
    expect(code(VOCABULARY)).not.toContain("gameCode");
  });
});

// =======================================================================================
// The assistant, on the screen
// =======================================================================================

describe("the AI panel is wired to the name and the description", () => {
  it("offers the banner and a button on each field", () => {
    const screen = wizardScreen();

    expect(screen).toContain("<AiContentPanel");
    expect(screen).toMatch(/<AiFieldButton[\s\S]{0,200}?field="title"/);
    expect(screen).toMatch(/<AiFieldButton[\s\S]{0,200}?field="description"/);
  });

  it("writes what it generates into the draft", () => {
    // A generator whose output is displayed and not stored is the failure an operator finds
    // out about after saving, so the assertion is on the patch rather than on the element.
    const screen = wizardScreen();
    expect(screen).toMatch(/patch\(\{ name: data\.title \}\)/);
    expect(screen).toMatch(/patch\(\{ description: data\.description \}\)/);
  });

  it("passes the game to EVERY entry point, not just the banner", () => {
    /*
      Counted rather than matched once. Three of these exist - the banner and the two field
      buttons - and one written without `gameKey` still renders, still generates, and returns
      trading copy for a game. The count is what makes a fourth one added later fail here.
    */
    const screen = wizardScreen();
    const entryPoints =
      (screen.match(/<AiContentPanel/g) ?? []).length +
      (screen.match(/<AiFieldButton/g) ?? []).length;

    expect(entryPoints).toBeGreaterThanOrEqual(3);
    expect(
      (screen.match(/gameKey=\{title\?\.gameKey\}/g) ?? []).length,
    ).toBeGreaterThanOrEqual(entryPoints);
  });

  it("sends the key and nothing else about the game", () => {
    // The dialog is the one place a game word could be smuggled into the request body.
    const dialog = code(join(ADMIN, "components/admin/AIGeneratorDialog.tsx"));
    const body = dialog.slice(dialog.indexOf("JSON.stringify"));

    expect(body.length).toBeGreaterThan(40);
    expect(body).toMatch(/gameKey/);
    for (const word of ["displayName", "scoreDirection", "subjectLabel"]) {
      expect(body.slice(0, body.indexOf("})"))).not.toContain(word);
    }
  });

  it("keeps one definition of the panel for both wizards", () => {
    // The prop that matters is easy to forget, so a second hand-written banner is how one
    // wizard silently stops sending the game. `AiContentPanel` is the only definition.
    const panel = code(AI_PANEL);
    expect(panel).toContain("AI Content Generator");
    expect(wizardScreen()).not.toContain("AI Content Generator");
  });
});

describe("the page header crosses the server boundary as data", () => {
  it("is handed a rendered element, never a component", () => {
    /*
      R39 IN ONE ASSERTION. `components/neon/Accordion.tsx` took `icon: LucideIcon` for a few
      minutes on 6 September and the trading lobby was unavailable in production for every
      trading contest: a React component is a function, and a function cannot cross a
      server/client boundary. This page is a server component, so the header's icon prop is a
      rendered element - which is data.
    */
    const page = code(NEW_PAGE);

    expect(page).toMatch(/icon=\{<[A-Z][A-Za-z0-9]* \/>\}/);
    expect(page).not.toMatch(/icon=\{[A-Z][A-Za-z0-9]*\}/);

    const shell = code(SHELL);
    const header = shell.slice(
      shell.indexOf("export function WizardPageHeader"),
      shell.indexOf("export function WizardShell"),
    );
    expect(header.length).toBeGreaterThan(200);
    expect(header).toMatch(/icon: ReactNode/);
    expect(header).not.toMatch(/icon: LucideIcon/);
  });
});
