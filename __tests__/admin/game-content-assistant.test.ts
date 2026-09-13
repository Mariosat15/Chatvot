/**
 * The content assistant on the game page screen (task document 19).
 *
 * WHAT THIS SUITE IS FOR. The assistant writes marketing copy for a catalogue title, and the
 * owner's decision of 10 September 2026 is that it must never write the rules summary or how
 * to play. Those are the provider's account of their own game; `01` s3.1 calls the rules
 * summary the first text support quotes back when a player disputes a prize, so generated
 * wording there is invented wording in a money argument. Both were already being discarded on
 * every sync until R63, so the temptation to have the model fill them is exactly what this
 * exists to stop.
 *
 * THE BAR IS PROVED BEHAVIOURALLY, NOT BY READING A LIST. A field named in a policy that the
 * builder then carries anyway satisfies any structural check perfectly - which is the shape
 * of every strict-mode defect in this programme. So the central test hands the parser a reply
 * that DOES carry both fields and asserts the whole object it produces.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  AI_WRITABLE_CONTENT_FIELDS,
  AI_NEVER_WRITABLE_CONTENT_FIELDS,
  EDITABLE_CONTENT_FIELDS,
  CONTENT_LIMITS,
} from "@/apps/admin/lib/admin/game-content-fields";
import {
  parseGameContentSuggestion,
  suggestionIsEmpty,
} from "@/apps/admin/lib/admin/ai-game-content-suggestion";
import {
  gameContentVocabulary,
  NO_RULES_CLAIMS_RULE,
} from "@/apps/admin/lib/admin/ai-game-content-vocabulary";
import { TRADING_WORDS } from "@/apps/admin/lib/admin/ai-contest-vocabulary";
import {
  stripComments,
  findRouteFiles,
  handlerPattern,
  guardedSections,
} from "../helpers/route-guard-audit";

const ROOT = join(__dirname, "..", "..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

const VOCABULARY_FILE = "apps/admin/lib/admin/ai-game-content-vocabulary.ts";
const SUGGESTION_FILE = "apps/admin/lib/admin/ai-game-content-suggestion.ts";
const ROUTE_DIR = "apps/admin/app/api/ai/generate-game-content";
const PANEL_FILE = "apps/admin/components/admin/games/GameContentAiPanel.tsx";
const DIALOG_FILE = "apps/admin/components/admin/games/GameContentDialog.tsx";

/** A catalogue row, exactly as the route selects one. Nothing here names a game in code. */
const TITLE = {
  displayName: "Circuit Sprint",
  category: "puzzle",
  description: "Trace the circuit before the current does.",
  scoreDirection: "higher_is_better" as const,
  scoreType: "integer" as const,
  typicalDurationSeconds: 90,
};

describe("what the assistant is allowed to write", () => {
  /*
    THE CENTRAL TEST. The reply carries both barred fields and a third the policy does not
    know about, which is what a model actually returns when it is asked to write a game's
    page - the page plainly wants rules on it.

    The assertion is on the WHOLE object rather than on the two names, because a field nobody
    asserted is the only way to notice one nobody expected. That is how the admin credential
    dialog's first-save-recorded-as-a-rotation bug surfaced.
  */
  it("cannot carry the rules summary or how to play, whatever the model returns", () => {
    const suggestion = parseGameContentSuggestion(
      JSON.stringify({
        displayName: "Circuit Sprint",
        tagline: "Beat the current.",
        description: "A quick circuit puzzle.",
        highlights: [{ title: "Fast rounds", detail: "Ninety seconds a go." }],
        rulesSummary: "Solve each board before the timer expires. Ties break on time.",
        howToPlay: "Drag tiles to complete the circuit.",
        scoreDirection: "lower_is_better",
      }),
    );

    expect(suggestion).toEqual({
      displayName: "Circuit Sprint",
      tagline: "Beat the current.",
      description: "A quick circuit puzzle.",
      highlights: [{ title: "Fast rounds", detail: "Ninety seconds a go." }],
    });
    expect(Object.keys(suggestion).sort()).toEqual([
      "description",
      "displayName",
      "highlights",
      "tagline",
    ]);
  });

  it("bars the two provider fields by name and says why", () => {
    for (const field of ["rulesSummary", "howToPlay"]) {
      const reason = AI_NEVER_WRITABLE_CONTENT_FIELDS.get(field);
      expect(reason, `${field} must be barred by name, not merely left out`).toBeTruthy();
      // Reason: a refusal that names no reason sends an operator to ask why the biggest two
      // boxes were skipped, and the honest answer is the whole point of the decision.
      expect(reason!.length).toBeGreaterThan(20);
    }
  });

  it("nothing is both writable by the assistant and barred from it", () => {
    for (const field of AI_WRITABLE_CONTENT_FIELDS) {
      expect(
        AI_NEVER_WRITABLE_CONTENT_FIELDS.has(field),
        `${field} appears in both lists`,
      ).toBe(false);
    }
  });

  /*
    A suggestion the save route would refuse is a button that appears to work and does
    nothing - the shape behind a provider with no adapter and a `rankingMethod` a provider
    game ignores. The assistant's list must be a subset of the operator's.
  */
  it("every field it may write is one an operator may save", () => {
    for (const field of AI_WRITABLE_CONTENT_FIELDS) {
      expect(
        EDITABLE_CONTENT_FIELDS.has(field),
        `the assistant offers ${field}, which the save route refuses`,
      ).toBe(true);
    }
  });
});

describe("what the model is told", () => {
  it("forbids stating how the game is played", () => {
    const { systemPrompt } = gameContentVocabulary(TITLE);
    expect(systemPrompt).toContain(NO_RULES_CLAIMS_RULE.trim().split("\n")[0]);
    expect(systemPrompt).toMatch(/Never state how the game is played/);
  });

  /*
    ONE DEFINITION OF THE BANNED WORDS. The contest assistant already has the list; a second
    copy here drifts in the direction where the game prompt keeps permitting a word the
    contest prompt has learned to refuse, and nothing compares them.
  */
  it("bans trading vocabulary from the shared list rather than its own", () => {
    const { systemPrompt } = gameContentVocabulary(TITLE);
    for (const word of TRADING_WORDS) {
      expect(systemPrompt, `${word} is not banned in the game prompt`).toContain(word);
    }
    // The negative half, which is the load-bearing one: importing the list is trivially
    // satisfied by a module that imports it and then writes out its own beside it.
    const source = stripComments(read(VOCABULARY_FILE));
    expect(source).not.toMatch(/\bforex\b/);
    expect(source).not.toMatch(/\bpips\b/);
  });

  /*
    A prompt asking for 200 characters into a field the form caps at 120 produces a suggestion
    that is silently cut. Same reasoning that keeps the dialog's counters reading from
    `CONTENT_LIMITS`: two numbers for one rule is one number that is wrong.
  */
  it("takes its lengths from the content limits rather than typing them in", () => {
    const { systemPrompt } = gameContentVocabulary(TITLE);
    for (const limit of [
      CONTENT_LIMITS.displayName,
      CONTENT_LIMITS.tagline,
      CONTENT_LIMITS.highlightTitle,
      CONTENT_LIMITS.highlightDetail,
    ]) {
      expect(systemPrompt).toContain(String(limit));
    }

    const source = stripComments(read(VOCABULARY_FILE));
    for (const limit of [
      CONTENT_LIMITS.displayName,
      CONTENT_LIMITS.tagline,
      CONTENT_LIMITS.highlightTitle,
      CONTENT_LIMITS.highlightDetail,
    ]) {
      expect(
        source,
        `the prompt hard-codes ${limit} instead of reading CONTENT_LIMITS`,
        // Reason: the pattern is built from a number in CONTENT_LIMITS, not from input.
        // eslint-disable-next-line security/detect-non-literal-regexp
      ).not.toMatch(new RegExp(`\\b${limit}\\b`));
    }
  });

  /*
    The one failure mode of the "no additional coding" claim is something that enumerates
    games. Every sentence is composed from declared fields, so the first title needing a
    special case would make the claim quietly false while every existing test still passed.
  */
  it("names no game, provider or game code anywhere", () => {
    const source = stripComments(read(VOCABULARY_FILE));
    for (const forbidden of ["gameCode", "gameKey", "providerKey"]) {
      expect(source, `the prompt branches on ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("degrades rather than inventing when the catalogue row says little", () => {
    const { systemPrompt } = gameContentVocabulary({
      displayName: "Untitled",
      scoreDirection: "lower_is_better",
      scoreType: "duration_ms",
    });
    expect(systemPrompt).toContain("A skill game called Untitled.");
    expect(systemPrompt).toContain("the fastest time wins");
    // An absent duration states nothing rather than guessing one, matching `RoundPreflight`.
    expect(systemPrompt).not.toMatch(/A round takes about/);
  });
});

describe("reading the model's reply", () => {
  it("offers an over-long line shortened rather than dropping it", () => {
    const long = "x".repeat(CONTENT_LIMITS.tagline + 50);
    const suggestion = parseGameContentSuggestion(
      JSON.stringify({ tagline: long, displayName: "A", description: "", highlights: [] }),
    );
    expect(suggestion.tagline.length).toBe(CONTENT_LIMITS.tagline);
  });

  /*
    The opposite choice to the line above, deliberately. The card renders both halves, so a
    detail clipped mid-sentence looks like a bug on the player's screen - and highlights are
    accepted as a set rather than read one at a time.
  */
  it("drops a half-filled or over-long highlight rather than offering it broken", () => {
    const suggestion = parseGameContentSuggestion(
      JSON.stringify({
        displayName: "A",
        highlights: [
          { title: "Kept", detail: "This one is fine." },
          { title: "No detail", detail: "   " },
          { title: "", detail: "No title." },
          { title: "Too long", detail: "y".repeat(CONTENT_LIMITS.highlightDetail + 1) },
          "not an object",
        ],
      }),
    );
    expect(suggestion.highlights).toEqual([{ title: "Kept", detail: "This one is fine." }]);
  });

  it("never offers more highlights than the form accepts", () => {
    const many = Array.from({ length: CONTENT_LIMITS.highlights + 4 }, (_, at) => ({
      title: `T${at}`,
      detail: `D${at}`,
    }));
    const suggestion = parseGameContentSuggestion(
      JSON.stringify({ displayName: "A", highlights: many }),
    );
    expect(suggestion.highlights.length).toBe(CONTENT_LIMITS.highlights);
  });

  it("answers empty rather than throwing when the reply is not JSON", () => {
    for (const reply of ["", "I cannot help with that.", "{ broken", "{ nope: }"]) {
      const suggestion = parseGameContentSuggestion(reply);
      expect(suggestionIsEmpty(suggestion)).toBe(true);
      expect(Object.keys(suggestion).length).toBe(4);
    }
  });
});

describe("the route", () => {
  /*
    Counted per handler, never per file: a file whose POST is guarded and whose GET is not
    passes any check that merely asks whether the file mentions a guard. R40's
    `finalize-old-competitions` and R57's image optimizer were both found this way.
  */
  it("guards every handler with the section that owns the calling screen", () => {
    const files = findRouteFiles(join(ROOT, ROUTE_DIR));
    expect(files.length, "no route file found").toBeGreaterThan(0);

    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      const handlers = [...code.matchAll(handlerPattern())].length;
      const sections = guardedSections(code);
      expect(handlers, `${file} exports no handler`).toBeGreaterThan(0);
      expect(sections.length, `${file}: ${handlers} handlers, ${sections.length} guards`).toBe(
        handlers,
      );
      // The content screen itself is granted by `game-providers`. A different section here
      // would either lock out the operators who run the catalogue or widen a grant to reach
      // a screen it was never given for.
      for (const section of sections) expect(section).toBe("game-providers");
    }
  });

  /*
    The operator's steer is the one thing that legitimately comes from the browser, and it
    belongs in the USER message. In the system message it could restate - or contradict - the
    rules the system message has just set, which includes the bar on writing rules.
  */
  it("puts the operator's own words in the user message, never the system one", () => {
    const code = stripComments(read(join(ROUTE_DIR, "route.ts")));

    const systemAt = code.indexOf('role: "system"');
    expect(systemAt, "no system message found").toBeGreaterThan(-1);
    const systemLine = code.slice(systemAt, code.indexOf("}", systemAt));
    expect(systemLine.length).toBeGreaterThan(20);
    expect(systemLine).toContain("vocabulary.systemPrompt");
    expect(systemLine).not.toContain("steer");

    const userAt = code.indexOf('role: "user"');
    expect(userAt).toBeGreaterThan(-1);
    expect(code.slice(userAt, code.indexOf("}", userAt))).toContain("userPrompt");
  });

  it("refuses a game the catalogue does not hold instead of writing generic copy", () => {
    const code = stripComments(read(join(ROUTE_DIR, "route.ts")));
    const at = code.indexOf("if (!title)");
    expect(at, "no refusal for an unknown title").toBeGreaterThan(-1);
    const branch = code.slice(at, at + 400);
    expect(branch.length).toBeGreaterThan(100);
    expect(branch).toContain("status: 400");
  });
});

describe("the screen", () => {
  /*
    The panel tells the operator what it will not write, and it must read that sentence from
    the policy rather than carry its own. Two copies drift in the direction where the screen
    keeps promising something the route has since stopped doing.
  */
  it("explains the bar from the shared policy rather than restating it", () => {
    const panel = stripComments(read(PANEL_FILE));
    expect(panel).toContain("AI_NEVER_WRITABLE_CONTENT_FIELDS");
    expect(panel).toMatch(/AI_NEVER_WRITABLE_CONTENT_FIELDS\.get\(\s*["']rulesSummary["']\s*\)/);
    // The negative half: importing the map is trivially satisfied by a component that also
    // hand-writes the sentence beside it.
    expect(panel).not.toMatch(/quotes back/);
  });

  /*
    THE PANEL PROPOSES INTO THE FORM AND NEVER POSTS. Everything it suggests is subject to the
    same Save press, the same server validation and the same audit line as text typed by hand
    - which is what makes the bar enforceable in one place instead of two.
  */
  it("proposes into the form and never writes to the content route itself", () => {
    const panel = stripComments(read(PANEL_FILE));
    expect(panel).toContain("/api/ai/generate-game-content");
    expect(panel, "the panel posts content directly, bypassing Save").not.toMatch(
      /games\/content/,
    );
  });

  /*
    Saving must hand back EVERY field the form edits. Omitting one leaves the parent row
    holding the old value, so reopening shows the text the operator just replaced and saving
    again writes it back - a silent revert of an edit that reported success. This was real:
    `rulesSummary` and `howToPlay` were missing from this object when they were added on
    10 September 2026.
  */
  it("hands every edited field back to the list after a save", () => {
    const dialog = read(DIALOG_FILE);

    const draftAt = dialog.indexOf("interface Draft {");
    expect(draftAt, "no Draft interface").toBeGreaterThan(-1);
    const draftBody = dialog.slice(draftAt, dialog.indexOf("}", draftAt));
    expect(draftBody.length).toBeGreaterThan(50);
    const draftFields = [...draftBody.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
    expect(draftFields.length).toBeGreaterThan(5);

    const savedAt = dialog.indexOf("onSaved({");
    expect(savedAt, "no onSaved call").toBeGreaterThan(-1);
    const savedBody = dialog.slice(savedAt, dialog.indexOf("});", savedAt));
    expect(savedBody.length).toBeGreaterThan(50);

    for (const field of draftFields) {
      expect(savedBody, `${field} is edited but not handed back after saving`).toMatch(
        // Reason: the pattern is built from an identifier read out of the file under test,
        // not from input. `\s*` rather than a literal so a reformat cannot fail the guard.
        // eslint-disable-next-line security/detect-non-literal-regexp
        new RegExp(`\\b${field}:\\s*draft\\.${field}\\b`),
      );
    }
  });

  it("sends the game key and nothing else about the game", () => {
    const panel = stripComments(read(PANEL_FILE));
    const bodyAt = panel.indexOf("JSON.stringify({");
    expect(bodyAt, "no request body").toBeGreaterThan(-1);
    const body = panel.slice(bodyAt, panel.indexOf("})", bodyAt));
    expect(body.length).toBeGreaterThan(10);
    expect(body).toContain("gameKey");
    for (const forbidden of ["displayName", "category", "scoreDirection", "description"]) {
      expect(body, `${forbidden} travels from the browser into the prompt`).not.toContain(
        forbidden,
      );
    }
  });
});

describe("the suggestion module", () => {
  it("builds its object field by field rather than spreading the reply", () => {
    const source = stripComments(read(SUGGESTION_FILE));
    // A spread is the one change that would reintroduce every barred field at once, silently.
    expect(source, "the parser spreads the model's payload").not.toMatch(/\.\.\.\s*body/);
    expect(source).not.toMatch(/\.\.\.\s*payload/);
  });
});
