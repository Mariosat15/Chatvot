/**
 * X6.5 step A1 - the terminology layer itself (chapter 14 section 2).
 *
 * WHAT THIS IS TESTING, because "a dictionary of words" invites the wrong reading: almost
 * nothing here is about the words. The catalogue's VALUE is its four boundaries, and each of
 * them is a thing the obvious version of the file gets wrong while reading perfectly:
 *
 *   no trading vocabulary is a token   - or an operator can rename "position" from a
 *                                        settings screen and break chapter 14 section 5's
 *                                        guarantee from outside the codebase
 *   no credit or currency token        - `format-volts.ts` already owns that label, and the
 *                                        copy that drifts is in front of a player deciding
 *                                        whether to pay
 *   nothing here is an identifier      - a token renders for a human; renaming a route or a
 *                                        ledger enum orphans financial history (R13)
 *   singular and plural are separate   - deriving one runs string surgery on a word an
 *                                        operator typed
 *
 * So the absences are asserted as hard as the presences. An absence is what makes a
 * guarantee structural rather than a promise, and it is exactly what a later "consistency"
 * edit removes.
 *
 * The schema halves are read as TEXT rather than by importing the models. Both copies
 * register under the name `WhiteLabel` via `models.X || model(...)`, so importing both into
 * one test silently returns the first twice and the test then examines the wrong schema
 * while looking completely correct.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TERMS,
  TERMINOLOGY_TOKENS,
  isTerminologyToken,
  resolveTerms,
} from "@/lib/constants/terminology";
import { validateTerminologyOverrides } from "@/lib/services/terminology.service";

const ROOT = join(__dirname, "..", "..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

/** Strip comments, so a file that EXPLAINS an anti-pattern is not flagged for discussing it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const CATALOGUE = "lib/constants/terminology.ts";
const SERVICE = "lib/services/terminology.service.ts";
const MODELS = [
  "database/models/whitelabel.model.ts",
  "apps/admin/database/models/whitelabel.model.ts",
] as const;

/**
 * The token names declared on a `WhiteLabel` schema copy.
 *
 * Sliced from the SCHEMA's `terminologyOverrides` block specifically, not the interface's -
 * the interface is what the compiler checks and the schema is what Mongoose enforces, and a
 * token present in the interface and absent from the schema is DISCARDED by strict mode on
 * write, silently, while every typecheck passes. Both ends of the slice are asserted,
 * because `indexOf` returning -1 yields a slice that satisfies everything asked of it.
 */
function schemaTokens(source: string): string[] {
  // The schema block is the one whose entries are `name: { type: String`.
  const marker = "terminologyOverrides: {";
  const start = source.lastIndexOf(marker);
  expect(start, `${marker} not found in the schema`).toBeGreaterThan(-1);

  const body = source.slice(start + marker.length);
  const end = body.indexOf("\n    },");
  expect(end, "end of the terminologyOverrides schema block not found").toBeGreaterThan(-1);

  const block = body.slice(0, end);
  expect(block).toContain("type: String");

  return [...block.matchAll(/^\s*(\w+):\s*\{\s*type:\s*String/gm)].map((m) => m[1]);
}

describe("the catalogue's defaults are the TARGET words, not today's words", () => {
  it("says Player, because installing this file is not meant to be a no-op", () => {
    // Reason: the whole point of the pass is that a screen reading "Trader" starts reading
    // "Player". A default of "Trader" would make every later assertion pass while changing
    // nothing on any screen.
    expect(TERMS.player).toBe("Player");
    expect(TERMS.players).toBe("Players");
  });

  it("says Competition, because that word is already neutral and nothing should move", () => {
    expect(TERMS.contest).toBe("Competition");
    expect(TERMS.contests).toBe("Competitions");
  });

  it("says Challenge and never Duel", () => {
    // Reason: a hard programme constraint. There is a `Challenge` model, `/challenges`
    // routes, a `challengesEnabled` flag and `challenge_entry` / `challenge_refund` ledger
    // values. Source sites from `13` s9.1a were rewritten 24 Sep 2026; seeded DB rows are
    // report-only (`tools/vocabulary/rewrite-duel-seeds.ts`).
    expect(TERMS.challenge).toBe("Challenge");
    expect(TERMS.challenges).toBe("Challenges");
    for (const value of Object.values(TERMS)) {
      expect(value.toLowerCase()).not.toContain("duel");
    }
  });
});

describe("boundary 1 - no trading vocabulary is a token", () => {
  it.each([
    "position",
    "positions",
    "trade",
    "trades",
    "trader",
    "traders",
    "pnl",
    "margin",
    "equity",
    "lot",
    "pip",
    "pips",
    "spread",
    "order",
    "orders",
    "symbol",
    "leverage",
  ])("does not declare a %s token", (name) => {
    // Reason: chapter 14 section 5 guarantees a trader cannot tell this programme happened.
    // Every screen under `/trade`, the whole `components/trading/` stack, the trading help
    // guide and the trading notification types keep their own words. Making one of them a
    // token hands an operator a settings box that breaks that guarantee.
    expect(TERMINOLOGY_TOKENS).not.toContain(name);
  });
});

describe("boundary 2 - no credit or currency token", () => {
  it.each(["credit", "credits", "currency", "volt", "volts", "money", "balance"])(
    "does not declare a %s token",
    (name) => {
      // Reason: what an amount is written in is decided once, by `AppSettings.credits.symbol`
      // through `lib/utils/format-volts.ts`, and what one credit is worth by
      // `lib/utils/credit-value.ts` (R74). A token here would be a second definition of a
      // money label - the "one rule, two copies" shape behind `referenceId`, `failedReason`,
      // `challengeId` and the Game Master `||`.
      expect(TERMINOLOGY_TOKENS).not.toContain(name);
    },
  );

  it("keeps the money LABELS, which are the words beside a figure and not the figure", () => {
    // Reason: the positive half is not decoration. Without it, "no money tokens" could be
    // satisfied by a catalogue that also dropped the headings, at which point the pass
    // cannot rename "Entry Fee" at all.
    expect(TERMINOLOGY_TOKENS).toContain("entryFee");
    expect(TERMINOLOGY_TOKENS).toContain("prizePool");
    expect(TERMINOLOGY_TOKENS).toContain("prize");
  });

  it("does not reach for the credit formatter or the value resolver", () => {
    const source = stripComments(read(CATALOGUE));
    expect(source).not.toContain("format-volts");
    expect(source).not.toContain("credit-value");
  });
});

describe("boundary 3 - nothing here is an identifier", () => {
  it("names no route, no ledger enum, no model and no gameKey", () => {
    const source = stripComments(read(CATALOGUE));
    // Reason: chapter 14 section 6's never-rename list. A token value is read by a human and
    // by nothing else, so `contests` may render as "Tournaments" while the route stays
    // `/api/competitions/*` and the ledger row stays `competition_entry`.
    for (const identifier of [
      "/api/",
      "competition_entry",
      "competition_refund",
      "challenge_entry",
      "challenge_refund",
      "gameKey",
      "allowedSections",
      "rankingMethod",
    ]) {
      expect(source).not.toContain(identifier);
    }
  });

  it("declares no token whose default LOOKS like an identifier", () => {
    for (const [token, value] of Object.entries(TERMS)) {
      // Reason: a snake_case or slashed default is the tell that somebody has put a stored
      // key into the dictionary, which is how a rename reaches a ledger row.
      expect(value, token).not.toMatch(/[_/]/);
      expect(value, token).toMatch(/^[A-Z]/);
    }
  });
});

describe("boundary 4 - singular and plural are separate tokens, never derived", () => {
  it.each([
    ["contest", "contests"],
    ["challenge", "challenges"],
    ["player", "players"],
    ["round", "rounds"],
    ["attempt", "attempts"],
    ["game", "games"],
    ["level", "levels"],
  ])("declares %s and %s independently", (one, many) => {
    expect(TERMINOLOGY_TOKENS).toContain(one);
    expect(TERMINOLOGY_TOKENS).toContain(many);
  });

  it("runs no string surgery on a configured word", () => {
    const source = stripComments(read(CATALOGUE));
    // Reason: `replace(/s$/, "")` on an operator-supplied value is the mistake the
    // credit-symbol work had to remove - a glyph has no plural and neither does every noun
    // in every deployment. Concatenating an "s" is the same mistake facing the other way.
    expect(source).not.toMatch(/replace\([^)]*s\$/);
    expect(source).not.toMatch(/\+\s*"s"/);
  });
});

describe("resolveTerms", () => {
  it("prefers an override and falls through to the default for everything else", () => {
    const pack = resolveTerms({ contest: "Tournament" });
    expect(pack.contest).toBe("Tournament");
    expect(pack.contests).toBe("Competitions");
    expect(pack.player).toBe("Player");
  });

  it("always returns every token, so a consumer never handles an absent word", () => {
    const pack = resolveTerms({ contest: "Tournament" });
    expect(Object.keys(pack).sort()).toEqual([...TERMINOLOGY_TOKENS].sort());
  });

  it.each(["", "   ", "\n\t"])("treats a blank override (%j) as ABSENT", (blank) => {
    // Reason: a blank field is what a cleared input, a half-run migration or a bad edit
    // leaves behind, and no legitimate writer means "this noun has no name". Taking it
    // literally renders a heading with a word missing out of the middle of it. Same reading
    // as `resolveAllowedGameTypes` on an empty array.
    expect(resolveTerms({ contest: blank }).contest).toBe("Competition");
  });

  it("trims a configured word", () => {
    expect(resolveTerms({ contest: "  Tournament  " }).contest).toBe("Tournament");
  });

  it("IGNORES an unrecognised key rather than refusing", () => {
    // Reason: this runs on every render of every screen. A stored key that is no longer a
    // token - because the catalogue was trimmed - must not take a page down months later.
    // The refusal belongs at the write, where an operator is present to read it.
    expect(() =>
      resolveTerms({ somethingRetired: "Whatever" } as never),
    ).not.toThrow();
    expect(resolveTerms({ somethingRetired: "Whatever" } as never).contest).toBe(
      "Competition",
    );
  });

  it("ignores a non-string value", () => {
    expect(resolveTerms({ contest: 42 as never }).contest).toBe("Competition");
  });

  it.each(["__proto__", "constructor", "toString", "valueOf"])(
    "does not admit %s, which an object lookup would",
    (key) => {
      // Reason: both `in` and object indexing walk the prototype chain, so `TERMS["__proto__"]`
      // returns a truthy `Object.prototype` that survives a `!value` test before failing
      // somewhere unrelated. Fifth instance after the round-inspector action map, the
      // contest-edit field list, the Game Master allow-list and `UNSCORED_CONTEST_POLICY_COPY`.
      expect(isTerminologyToken(key)).toBe(false);
      const pack = resolveTerms({ [key]: "Injected" } as never);
      expect(Object.values(pack)).not.toContain("Injected");
      expect(Object.keys(pack).sort()).toEqual([...TERMINOLOGY_TOKENS].sort());
    },
  );

  it("is backed by a Set, not by an object lookup", () => {
    const source = stripComments(read(CATALOGUE));
    expect(source).toContain("new Set<string>(TERMINOLOGY_TOKENS)");
    expect(source).not.toMatch(/token in TERMS/);
  });
});

describe("validateTerminologyOverrides", () => {
  it("accepts a known token", () => {
    expect(validateTerminologyOverrides({ contest: "Tournament" })).toEqual({
      ok: true,
      overrides: { contest: "Tournament" },
    });
  });

  it("REFUSES an unknown token and names it, rather than dropping it", () => {
    // Reason: dropping means the save appears to succeed while doing nothing, and the
    // operator concludes they misclicked. Same reading as the contest-edit allow-list, where
    // the refusal had to name the specific field for exactly this reason.
    const result = validateTerminologyOverrides({ positions: "Trades" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("positions");
  });

  it.each(["__proto__", "constructor", "toString"])("refuses %s", (key) => {
    expect(validateTerminologyOverrides({ [key]: "Injected" }).ok).toBe(false);
  });

  it("records a blank as a CLEAR, because that is how an operator un-renames a token", () => {
    // Reason: blank is a deliberate instruction on the WRITE side and an absent value on the
    // read side, and the two are consistent - clearing stores nothing, and reading nothing
    // yields the default.
    const result = validateTerminologyOverrides({ contest: "   " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.overrides.contest).toBeUndefined();
  });

  it("refuses a non-string value", () => {
    expect(validateTerminologyOverrides({ contest: 42 }).ok).toBe(false);
  });

  it("refuses an array AS an array, not as a token named 0", () => {
    // Reason: `typeof [] === "object"`, so without the explicit `Array.isArray` the validator
    // walks the indices and refuses on the key "0" - the right OUTCOME by accident, with a
    // message naming a token the operator never typed. So `ok: false` alone cannot tell the
    // two apart; the observable difference is the sentence an operator reads, and a message
    // about a token called "0" sends them looking for a field that does not exist.
    const result = validateTerminologyOverrides(["Tournament"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("must be an object");
      expect(result.error).not.toContain('"0"');
    }
  });
});

describe("the schema and the catalogue agree, in BOTH directions", () => {
  it.each(MODELS)("%s declares every token", (model) => {
    const declared = schemaTokens(read(model));
    for (const token of TERMINOLOGY_TOKENS) {
      // Reason: a token the schema does not declare is DISCARDED by strict mode on write,
      // silently, while the operator's save reports success. This is the mirror-drift
      // failure mode from one writer's side, and `check:mirrors` cannot see it because both
      // copies would be equally wrong.
      expect(declared, `${model} is missing "${token}"`).toContain(token);
    }
  });

  it.each(MODELS)("%s declares NOTHING the catalogue does not", (model) => {
    // Reason: the other direction. A path left behind after a token is retired is a stored
    // value nothing reads, and `resolveTerms` would ignore it - so it reads as configured
    // on the settings screen and has no effect anywhere.
    for (const declared of schemaTokens(read(model))) {
      expect(TERMINOLOGY_TOKENS, `${model} declares an unknown "${declared}"`).toContain(
        declared,
      );
    }
  });

  it("stores no default on any token path", () => {
    for (const model of MODELS) {
      const source = read(model);
      const marker = "terminologyOverrides: {";
      const start = source.lastIndexOf(marker);
      const block = source.slice(start, source.indexOf("\n    },", start));
      expect(block.length, model).toBeGreaterThan(100);
      // Reason: an unset token must read as ABSENT so it falls through to the catalogue
      // default. A `default: ""` stores a real empty string on every row, which then has to
      // be reinterpreted on every read - and a reinterpreted value is indistinguishable from
      // an operator who meant it.
      expect(block, model).not.toContain("default:");
    }
  });
});

describe("the two mirrors", () => {
  it.each([CATALOGUE, SERVICE])("%s is byte-identical in apps/admin", (file) => {
    // Reason: `check:mirrors` compares MODELS, so it has no opinion about either of these
    // files. A text comparison is the only guard, and the admin copy is the one that runs
    // when an operator saves from the settings screen.
    expect(read(`apps/admin/${file}`)).toBe(read(file));
  });

  it("keeps the catalogue MODEL-FREE, so a client component can import it", () => {
    const source = stripComments(read(CATALOGUE));
    // Reason: R58 - a `"use client"` file may not name a driver-reaching module in a
    // value-import position, and the admin panel was down for exactly this. The catalogue is
    // imported by the browser through `AppSettingsProvider`; the database read lives in the
    // service beside it, which is why they are two files rather than one.
    expect(source).not.toContain("import");
    expect(source).not.toContain("database/models");
  });

  it("keeps the database read OUT of the catalogue and IN the service", () => {
    expect(stripComments(read(SERVICE))).toContain("WhiteLabel.findOne()");
    expect(stripComments(read(SERVICE))).toContain('.select("terminologyOverrides")');
  });
});
