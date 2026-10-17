/**
 * The operator's own nouns, inside the AI prompts (X6.5 A3c, chapter 14 s2).
 *
 * WHAT WAS WRONG. Every other consumer of the token dictionary reads a word and prints it.
 * The two content assistants WRITE sentences, and their prompts were fixed strings, so a
 * deployment that had renamed "Competition" to "Tournament" had a wizard whose every label
 * said Tournament sitting directly above a generated description that said Competition - the
 * same box, the same screen, nothing thrown and nothing logged. The operator either edits
 * every suggestion by hand or the platform speaks two vocabularies to its own players.
 *
 * WHAT IS PINNED BELOW, in order: that the clause is a DIFF against the defaults, so an
 * unconfigured platform's prompts are byte-for-byte what they were; that it is APPENDED and
 * therefore LAST; that it carries the operator's spelling verbatim; that it reaches all three
 * vocabularies including trading's; that `terms` has no default value on either function; and
 * that nothing here enumerates a token.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  vocabularyRule,
  tradingVocabulary,
  providerVocabulary,
  TRADING_VOCABULARY,
  TRADING_SYSTEM_PROMPT,
  TRADING_SYSTEM_PROMPT_HISTORICAL,
} from "../../apps/admin/lib/admin/ai-contest-vocabulary";
import { gameContentVocabulary } from "../../apps/admin/lib/admin/ai-game-content-vocabulary";
import {
  TERMS,
  TERMINOLOGY_TOKENS,
  resolveTerms,
} from "../../lib/constants/terminology";

const ROOT = join(__dirname, "..", "..");
const ADMIN = join(ROOT, "apps", "admin");

const VOCABULARY = join(ADMIN, "lib/admin/ai-contest-vocabulary.ts");
const GAME_VOCABULARY = join(ADMIN, "lib/admin/ai-game-content-vocabulary.ts");
const CONTEST_ROUTE = join(ADMIN, "app/api/ai/generate-competition/route.ts");
const GAME_ROUTE = join(ADMIN, "app/api/ai/generate-game-content/route.ts");

/**
 * Source with comments stripped.
 *
 * Both modules EXPLAIN at length the mistakes they exist to avoid, naming the very things
 * asserted against below - "never interpolated", "no default value". A test that reads prose
 * fails in both directions: it flags a correct file for discussing the mistake, and it passes
 * a broken one whose only mention of the right thing is in a comment.
 */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const NO_OVERRIDES = resolveTerms(null);
const TITLE = {
  displayName: "Circuit Sprint",
  category: "puzzle",
  scoreDirection: "higher_is_better" as const,
  scoreType: "integer" as const,
};

// =======================================================================================
// Empty by default, which is what keeps every older assertion honest
// =======================================================================================

describe("vocabularyRule - nothing renamed means nothing said", () => {
  it("is the empty string when no override is stored", () => {
    /*
      THE PROPERTY THE WHOLE DESIGN RESTS ON. `TRADING_SYSTEM_PROMPT_HISTORICAL` is asserted
      character for character elsewhere as the only evidence the trading wizard still writes
      what it wrote, and that evidence survives A3c only because an unconfigured platform gets
      no clause at all. A rule that always emitted a heading - even an empty one - would have
      changed every prompt on the platform in order to change none of them.
    */
    expect(vocabularyRule(NO_OVERRIDES)).toBe("");
    expect(TRADING_VOCABULARY.systemPrompt).toBe(TRADING_SYSTEM_PROMPT);
    expect(TRADING_SYSTEM_PROMPT).toContain(TRADING_SYSTEM_PROMPT_HISTORICAL);
  });

  it("says nothing about a token renamed to its own default", () => {
    /*
      An override storing the current word is a no-op, and it is the shape a settings form
      submitting every field produces. Listing it would tell the model to write "competition
      instead of competition", which is noise in a prompt rather than an instruction.
    */
    const same = resolveTerms({ contest: TERMS.contest });
    expect(vocabularyRule(same)).toBe("");
  });

  it("lists only the tokens that actually differ", () => {
    const one = resolveTerms({ contest: "Tournament" });
    // Asserted, not assumed: a hedge here would make everything below vacuous if the
    // override never landed.
    expect(one.contest).toBe("Tournament");

    const rule = vocabularyRule(one);
    expect(rule).not.toBe("");
    // The operator's word, verbatim - their capitalisation is their decision.
    expect(rule).toContain('"Tournament"');
    // And not a word they left alone.
    expect(rule).not.toContain(`"${TERMS.game}"`);

    const lines = rule.split("\n").filter((line) => line.startsWith("- "));
    expect(lines).toHaveLength(1);
  });
});

// =======================================================================================
// Appended, never interpolated
// =======================================================================================

describe("the clause is appended, so it lands last", () => {
  it("leaves the historical trading prompt intact and sits after it", () => {
    /*
      APPENDED IS NOT A STYLE PREFERENCE. Spliced into trading's rule list, the clause would
      destroy the character-for-character guarantee in the very edit that adds the feature -
      the reasoning that kept the Game Master `||` verbatim while settlement was extracted.
      Being last is a second, independent benefit: it is the position a model resolves a
      conflict in favour of.
    */
    const renamed = resolveTerms({ contest: "Tournament" });
    const prompt = tradingVocabulary(renamed).systemPrompt;

    expect(prompt.startsWith(TRADING_SYSTEM_PROMPT)).toBe(true);
    expect(prompt.slice(TRADING_SYSTEM_PROMPT.length)).toBe(
      vocabularyRule(renamed),
    );
  });

  // Named without backticks or a plus sign on purpose: vitest's `-t` is a REGULAR
  // EXPRESSION, so a probe aiming at a name containing regex metacharacters matches nothing
  // and reports a passing run over zero tests - indistinguishable from a working guard.
  it("is concatenated in the source, never spliced into the string", () => {
    /*
      The behavioural test above can be satisfied by a prompt that interpolates the clause and
      happens to put it at the end. This is the structural half: the historical constant must
      be READ and concatenated, so a later edit moving the clause inside its rule list is a
      change to a literal that two other suites assert exactly.
    */
    const source = code(VOCABULARY);
    const historical = source.slice(
      source.indexOf("export const TRADING_SYSTEM_PROMPT_HISTORICAL"),
      source.indexOf("export const TRADING_SYSTEM_PROMPT ="),
    );

    expect(historical.length).toBeGreaterThan(200);
    expect(historical).not.toContain("vocabularyRule");
    expect(source).toContain("TRADING_SYSTEM_PROMPT + vocabularyRule(terms)");
  });

  it("is last in all three prompts", () => {
    const renamed = resolveTerms({ contest: "Tournament" });
    const clause = vocabularyRule(renamed);

    for (const prompt of [
      tradingVocabulary(renamed).systemPrompt,
      providerVocabulary(TITLE, renamed).systemPrompt,
      gameContentVocabulary(TITLE, renamed).systemPrompt,
    ]) {
      expect(prompt.endsWith(clause)).toBe(true);
    }
  });
});

// =======================================================================================
// It reaches every assistant, trading included
// =======================================================================================

describe("all three vocabularies carry it", () => {
  it("includes trading, whose nouns an operator renamed too", () => {
    /*
      Chapter 14 section 5 promises a trader cannot tell this programme happened, and the
      tokens keep that promise STRUCTURALLY - no trading word is a token, so nothing here can
      rename "trade", "position" or "P&L". What a rename does reach is the platform-neutral
      nouns trading shares with every other game, and a trading prompt that ignored the
      rename would produce the only copy on the platform still using the old word.
    */
    const renamed = resolveTerms({ contest: "Tournament" });

    expect(tradingVocabulary(renamed).systemPrompt).toContain('"Tournament"');
    expect(providerVocabulary(TITLE, renamed).systemPrompt).toContain(
      '"Tournament"',
    );
    expect(gameContentVocabulary(TITLE, renamed).systemPrompt).toContain(
      '"Tournament"',
    );
  });

  it("is reached from both routes with the terms read server-side", () => {
    /*
      The vocabulary is OURS, not the caller's - the same rule that makes `gameKey` a lookup
      key and nothing else. A body field naming the nouns would be arbitrary text inside a
      system prompt, and would also let a stale wizard tab contradict a rename since made.
    */
    for (const route of [CONTEST_ROUTE, GAME_ROUTE]) {
      const source = code(route);
      expect(source).toContain("getTerms()");
      expect(source).toMatch(/await getTerms\(\)/);
      // Never off the request.
      expect(source).not.toMatch(/terms\s*\}\s*=\s*await request\.json\(\)/);
    }
  });
});

// =======================================================================================
// No default value, and no token enumerated
// =======================================================================================

describe("the parameter is required", () => {
  it("has no default value on any of the three functions", () => {
    /*
      THE LOAD-BEARING ASSERTION OF THIS FILE. An optional `terms` falling back to the
      defaults is the failure this codebase keeps finding: a call site that forgets it gets
      fluent, correct-looking English in the operator's OLD vocabulary, with nothing thrown
      and nothing logged. The same shape as `apps/admin` mounting no `AppSettingsProvider` -
      nineteen components read a context that was never seeded and every one of them rendered
      a plausible default. Required means a forgotten call site is a compile error.
    */
    const sources = [code(VOCABULARY), code(GAME_VOCABULARY)].join("\n");
    const signatures =
      sources.match(/terms\s*(\?)?\s*:\s*TerminologyPack\s*(=)?/g) ?? [];

    expect(signatures.length).toBeGreaterThanOrEqual(3);
    for (const signature of signatures) {
      expect(signature).not.toContain("?");
      expect(signature).not.toContain("=");
    }
  });

  it("enumerates no token anywhere in the clause", () => {
    /*
      A hand-picked list of "the tokens that matter to contest copy" is a second place to
      forget a token, and the one forgotten is the one somebody has just renamed. The rule is
      a diff over `TERMINOLOGY_TOKENS`, so a token added to the dictionary is covered the day
      it lands - the same property as an aggregate that must never switch on game type.
    */
    const source = code(VOCABULARY);
    const rule = source.slice(
      source.indexOf("export function vocabularyRule"),
      source.indexOf("export function tradingVocabulary"),
    );

    expect(rule.length).toBeGreaterThan(100);
    expect(rule).toContain("TERMINOLOGY_TOKENS");
    for (const token of TERMINOLOGY_TOKENS) {
      expect(rule, `the clause names the ${token} token`).not.toContain(
        `"${token}"`,
      );
    }
  });
});
