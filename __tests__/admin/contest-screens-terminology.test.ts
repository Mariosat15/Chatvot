/**
 * X6.5 A3 - the contest LIST and DETAIL screens read their nouns from the token layer.
 *
 * WHY THIS IS A SEPARATE SUITE FROM A2's, and it is not filing: the delivery mechanism is
 * different, so the positive assertions are different. The wizard is `"use client"` and calls
 * `useTerms()`. This surface is mostly SERVER components - `app/competitions/view/[id]/page.tsx`
 * and the two panels it renders - which have no React context, so the page resolves the pack
 * once with `getTerms()` and passes it down as a prop. A guard written around `useTerms()`
 * would report the whole detail screen as unwired while it is entirely correct, and a guard
 * that fires on correct code is the one the next reader deletes.
 *
 * ONE READ PER REQUEST IS THE LOAD-BEARING PART of that arrangement, and it is asserted
 * negatively: the panels must NOT call `getTerms()` themselves. Two reads inside one render
 * are two answers to one question, which is the "one rule, two copies" shape behind
 * `referenceId`, `failedReason`, `challengeId` and the Game Master `||` - and here the drift
 * is visible to the operator in a single screenshot, one panel saying "Event" and the one
 * beside it saying "Competition", which reads as the setting being broken rather than as a
 * caching artefact.
 *
 * THE DEFECT A3 CLOSED. `contest-result-presentation.ts` composed operator-facing sentences
 * from hard-coded nouns - "Nobody placed at this rank", "prizes were paid", "Unknown player" -
 * and it is the module BEHIND both panels and the analytics screen, so one literal there
 * reached three surfaces. That is also why every prose function now takes the pack as a
 * REQUIRED parameter rather than defaulting to `TERMS`: a default is how a caller that forgot
 * to thread the pack keeps rendering the platform's own vocabulary while every test passes.
 *
 * The scanner is shared with A2 (`__tests__/helpers/terminology-scan.ts`), deliberately.
 */

import { describe, it, expect } from "vitest";
import { join } from "node:path";
import {
  ADMIN,
  code,
  literalNounHits,
  report,
  tradingWordHits,
} from "../helpers/terminology-scan";

const LIST = join(ADMIN, "components/admin/CompetitionsListSection.tsx");
const DETAIL = join(ADMIN, "app/competitions/view/[id]/page.tsx");
const PRIZE_PANEL = join(ADMIN, "components/admin/competitions/ContestPrizePanel.tsx");
const SETTLED_PANEL = join(
  ADMIN,
  "components/admin/competitions/SettledResultPanel.tsx",
);
const PRESENTATION = join(ADMIN, "lib/admin/contest-result-presentation.ts");
const ANALYTICS_PRESENTATION = join(
  ADMIN,
  "lib/admin/contest-analytics-presentation.ts",
);

/** The server-rendered panels, which receive the pack rather than resolving it. */
const PANELS = [PRIZE_PANEL, SETTLED_PANEL];

const SURFACE = [
  LIST,
  DETAIL,
  ...PANELS,
  PRESENTATION,
  ANALYTICS_PRESENTATION,
];

// =======================================================================================
// The surface exists and the reader reaches it
// =======================================================================================

describe("the scan reaches the contest screens", () => {
  /*
    First, because every claim below is "no match was found" and a reader that silently
    returns nothing satisfies all of them - the fourth cause of a green probe, a mutation
    with no observable. A moved or renamed file would make this suite vacuous while
    reporting a column of passes.
  */
  it("reads every file, and each one has content", () => {
    expect(SURFACE).toHaveLength(6);
    for (const file of SURFACE) {
      expect(code(file).length).toBeGreaterThan(400);
    }
  });
});

// =======================================================================================
// 1. The pack is resolved ONCE, on the server, and threaded down
// =======================================================================================

describe("the detail screen resolves the pack once and passes it down", () => {
  // Reason: every name in this file is regex-safe - no parentheses, no apostrophes - because
  // vitest's `-t` is a REGULAR EXPRESSION, so `getTerms()` in a name would match "getTerms"
  // followed by an empty group and select nothing. A passing run over zero tests reads
  // exactly like a missing guard.
  it("calls getTerms on the page", () => {
    const source = code(DETAIL);
    expect(source).toMatch(/\bawait\s+getTerms\(\)/);
    expect(source).toMatch(
      /import\s*\{[^}]*\bgetTerms\b[^}]*\}\s*from\s*"@\/lib\/services\/terminology\.service"/,
    );
  });

  it("hands the pack to both panels", () => {
    const source = code(DETAIL);
    /*
      COUNTED, not merely found. The page renders two panels and the presentation helpers
      besides; a version that threads the pack into one of them and leaves the other on its
      own read satisfies any assertion that only asks whether `terms={terms}` appears. That
      is exactly the half-renamed screen this pass exists to remove.
    */
    const handovers = source.match(/\bterms=\{terms\}/g) || [];
    expect(handovers.length).toBeGreaterThanOrEqual(2);
  });

  it("hands the pack to every presentation helper it calls", () => {
    const source = code(DETAIL);
    /*
      These are the functions that compose sentences. Calling one without the pack is a type
      error today, which is the point of making the parameter required - but the typecheck is
      not this suite's to rely on, because a later `terms?: TerminologyPack` would silently
      restore the defaults and keep compiling.
    */
    expect(source).toMatch(/resolveResultMetric\([\s\S]{0,160}?\bterms\b/);
    expect(source).toMatch(/resolveNoWinnersNotice\([\s\S]{0,200}?\bterms\b/);
  });

  it("does not resolve the pack a second time inside a panel", () => {
    /*
      THE NEGATIVE HALF, and the one that can fail. A panel calling `getTerms()` for itself
      compiles, renders and looks tidier than a prop - and gives one screen two answers the
      moment a read is cached, mis-ordered or pointed at a stale document. The page owns the
      request; the panels own the markup.
    */
    for (const file of PANELS) {
      const source = code(file);
      expect(source).not.toMatch(/\bgetTerms\s*\(/);
      expect(source).not.toMatch(/\buseTerms\s*\(/);
      expect(source).toMatch(/\bterms\s*:\s*TerminologyPack/);
    }
  });
});

describe("the contest list reads the pack from the context", () => {
  it("calls useTerms and imports it from the context", () => {
    const source = code(LIST);
    expect(source).toMatch(/\buseTerms\(\)/);
    expect(source).toMatch(
      /import\s*\{[^}]*\buseTerms\b[^}]*\}\s*from\s*"@\/contexts\/TerminologyContext"/,
    );
  });

  it("is a client component, which is why it uses the hook at all", () => {
    /*
      Pins the REASON the two halves of this surface differ. If this file ever becomes a
      server component, `useTerms()` throws at render - so the assertion that documents the
      distinction is worth more than a comment that describes it.
    */
    expect(code(LIST)).toMatch(/^\s*"use client"/);
  });
});

// =======================================================================================
// 2. The prose module takes the pack, and has no way to fall back
// =======================================================================================

describe("contest-result-presentation composes prose from the pack only", () => {
  const PROSE_FUNCTIONS = [
    "resolveResultMetric",
    "prizeRedistributionNote",
    "prizeSettledNote",
    "resolvePrizeBasisNote",
    "resolveSettledPrizeRows",
    "resolveNoWinnersNotice",
  ];

  it("requires a TerminologyPack in every function that produces a sentence", () => {
    const source = code(PRESENTATION);
    for (const name of PROSE_FUNCTIONS) {
      const start = source.indexOf(`export function ${name}(`);
      expect(start, `${name} is exported`).toBeGreaterThan(-1);
      const body = source.slice(start, start + 600);
      /*
        `terms: TerminologyPack`, never `terms?:`. An optional pack is a default by another
        name: the caller that forgets compiles, the screen renders the platform's nouns, and
        the only symptom is an operator's rename not reaching one panel.
      */
      expect(body, `${name} takes a required pack`).toMatch(
        /\bterms\s*:\s*TerminologyPack/,
      );
      expect(body, `${name} does not make it optional`).not.toMatch(
        /\bterms\s*\?\s*:/,
      );
    }
  });

  it("never imports the defaults, so it cannot answer without being asked", () => {
    /*
      Importing `TERMS` here is the one-line change that makes every assertion above
      cosmetic: the parameter stays required and the body reads the defaults anyway. Asserted
      on the VALUE import specifically - the `TerminologyPack` type import is required and
      comes from the same module.
    */
    for (const file of [PRESENTATION, ANALYTICS_PRESENTATION]) {
      const source = code(file);
      expect(source).not.toMatch(/import\s*\{[^}]*\bTERMS\b[^}]*\}\s*from/);
      expect(source).toMatch(
        /import\s+type\s*\{[^}]*\bTerminologyPack\b[^}]*\}\s*from/,
      );
    }
  });

  it("threads the pack through the analytics wrapper rather than re-deriving", () => {
    /*
      `resolvePlayerMetric` is the analytics screen's door onto the same rule. It must pass
      the pack it was given to `resolveResultMetric` - a wrapper that accepts a pack and then
      calls the inner function without it is the shape that satisfies a signature check while
      rendering the defaults.
    */
    const source = code(ANALYTICS_PRESENTATION);
    expect(source).toMatch(/resolveResultMetric\([\s\S]{0,160}?\bterms\b/);
  });
});

// =======================================================================================
// 3. No renameable noun survives as a literal - the assertion that can fail
// =======================================================================================

describe("no renameable noun is a literal in displayed text", () => {
  /*
    THE LOAD-BEARING GUARD, for the same reason as A2's: adding a hard-coded "Participants"
    beside a correct `terms.players` satisfies every positive assertion in this file. On this
    surface it is the likelier mistake, because the detail page is long and a new figure is
    added by copying the block above it.
  */
  it("has no Title Case noun as a JSX literal or a quoted caption", () => {
    expect(report(literalNounHits(SURFACE))).toBe("");
  });

  it("has no trading vocabulary in a caption", () => {
    /*
      Scoped to Title Case by the scanner, deliberately. This surface names trading in the
      lowercase on purpose: `resolveParticipantSubline` returns a trade count, and
      `showsTradingConfiguration` exists precisely to withhold Starting Capital and Max
      Leverage from a game contest rather than printing `$0` for them. Chapter 14 section 5
      keeps trading's own vocabulary where it is the subject.
    */
    expect(report(tradingWordHits(SURFACE))).toBe("");
  });
});

// =======================================================================================
// 4. The never-rename list holds
// =======================================================================================

describe("ids, routes and stored values stay literal", () => {
  it("links by route, never by a token", () => {
    /*
      `/competitions/new`, `/competitions/edit/[id]` and `?activeTab=competitions` are the
      URLs in an operator's bookmarks and the `ADMIN_SECTIONS` value their grant is stored
      against - a Mongoose enum, so add-only. Tokenising one sends an operator who renamed
      the noun to a page that does not exist, and the symptom is a blank screen rather than a
      wrong word.
    */
    const source = code(LIST);
    expect(source).toMatch(/href="\/competitions\/new"/);
    expect(source).not.toMatch(/href=\{`\/\$\{/);
  });

  it("keeps the status values it switches on", () => {
    /*
      `active`, `completed`, `cancelled`, `draft` and `upcoming` are stored on the document
      and drive the state machine. A token here would compare an operator's word against a
      database value and silently match nothing - every contest would render in the
      `default:` arm, which is where a new state already goes to die quietly on this screen.
    */
    const source = code(LIST);
    for (const status of ["active", "completed", "cancelled", "draft"]) {
      expect(source, `${status} is compared literally`).toContain(`"${status}"`);
    }
  });
});
