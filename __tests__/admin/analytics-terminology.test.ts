/**
 * X6.5 A4 - the analytics and financial surface, and R92's game-aware challenge reporting.
 *
 * TWO PROPERTIES, ONE SUITE, and they are here together because they failed together. The
 * wording half is chapter 14's pass over the screens `05` section 10 governs: every money and
 * performance figure an operator reads is either generalised across games or explicitly scoped
 * to one. The reporting half is R92 - both admin challenge screens rendered `+0.00` over
 * `0 trades` for a provider challenge, because `challengerFinalStats` had no field for the
 * score settlement had already ranked on. A renamed noun over a wrong number is the worse of
 * the two outcomes, so the suite that tokenises the labels also pins what they label.
 *
 * WHY THE SURFACE IS LISTED RATHER THAN WALKED, which inverts A3b's rule. A3b walks
 * `components/admin/games/` because that directory is one subject - the provider contest
 * surface - so a file added to it next month is in scope by construction. There is no
 * directory that means "analytics and financials": `CompetitionAnalytics.tsx` and
 * `FinancialDashboard.tsx` sit at the top of `components/admin/` beside sixty unrelated
 * screens, and walking that would put the whole admin app in scope in one commit. The two
 * files under `competitions/` and the presentation module are already walked by A3b, so they
 * are deliberately NOT repeated here - see the note on that suite's surface below.
 */

import { describe, it, expect } from "vitest";
import { join } from "node:path";
import {
  ADMIN,
  ROOT,
  code,
  literalNounHits,
  lowercaseNounHits,
  report,
  tradingWordHits,
} from "../helpers/terminology-scan";

const ANALYTICS = join(ADMIN, "components/admin/CompetitionAnalytics.tsx");
const FINANCIALS = join(ADMIN, "components/admin/FinancialDashboard.tsx");
const TX_DIALOG = join(
  ADMIN,
  "components/admin/transactions/TransactionDetailDialog.tsx",
);
const CHALLENGE_VIEW = join(ADMIN, "app/challenges/view/[id]/page.tsx");
const PLAYER_CARD = join(
  ADMIN,
  "components/admin/competitions/ChallengePlayerCard.tsx",
);
const STAT_ROWS = join(
  ADMIN,
  "components/admin/competitions/ChallengeStatRows.tsx",
);
const PRESENTATION = join(ADMIN, "lib/admin/contest-result-presentation.ts");
const ANALYTICS_ROUTE = join(ADMIN, "app/api/competition-analytics/route.ts");

/**
 * The four files A3b's directory walk does not reach.
 *
 * `ChallengePlayerCard.tsx` and `ChallengeStatRows.tsx` live under `components/admin/
 * competitions/`, which A3b walks, so adding them here would give two suites one claim - and
 * the one that loses a rule keeps passing, which is the shape this whole programme keeps
 * meeting. They are still asserted below, for their BEHAVIOUR rather than their wording.
 */
const SURFACE = [ANALYTICS, FINANCIALS, TX_DIALOG, CHALLENGE_VIEW];

const MODEL = join(ROOT, "database/models/trading/challenge.model.ts");
const MODEL_ADMIN = join(
  ADMIN,
  "database/models/trading/challenge.model.ts",
);
const OUTCOME = join(ROOT, "lib/services/settlement/challenge-outcome.ts");
const OUTCOME_ADMIN = join(
  ADMIN,
  "lib/services/settlement/challenge-outcome.ts",
);

// =======================================================================================
// The reader reaches the surface
// =======================================================================================

describe("the scan reaches the analytics surface", () => {
  /*
    FIRST, for the reason A3b's equivalent is first: every wording claim below is "no match was
    found", and a reader that silently returns nothing satisfies all of them. A renamed or
    moved file makes the suite vacuous while reporting passes - the fourth cause of a green
    probe, a mutation with no observable.
  */
  it("reads every file, each with content", () => {
    /*
      THE SIZE ASSERTION IS THE HALF THAT WAS MISSING, and a probe found it rather than a
      review. Emptying `SURFACE` makes all three wording scans pass over zero files - three
      greens - and the loop below stayed green too, because the nine behavioural files it also
      lists still had content. So "every file has content" was true of a surface that was no
      longer being scanned at all.

      Pinned as an exact count rather than a `toBeGreaterThan`, so removing one file from the
      list is as loud as emptying it: a file dropped from a wording surface is the same defect
      in a quieter shape.
    */
    expect(SURFACE).toHaveLength(4);

    for (const file of [
      ...SURFACE,
      PLAYER_CARD,
      STAT_ROWS,
      PRESENTATION,
      ANALYTICS_ROUTE,
      MODEL,
      MODEL_ADMIN,
      OUTCOME,
      OUTCOME_ADMIN,
    ]) {
      expect(code(file).length).toBeGreaterThan(0);
    }
  });
});

// =======================================================================================
// The wording
// =======================================================================================

describe("no renameable noun survives as a literal on the analytics surface", () => {
  it("has no Title Case noun as a JSX literal or a quoted caption", () => {
    expect(report(literalNounHits(SURFACE))).toBe("");
  });

  it("has no lowercase noun in running prose", () => {
    expect(report(lowercaseNounHits(SURFACE))).toBe("");
  });

  it("has no trading vocabulary in an unconditional caption", () => {
    expect(report(tradingWordHits(SURFACE))).toBe("");
  });
});

describe("the surface reads its nouns from the token layer", () => {
  it.each([
    ["CompetitionAnalytics", ANALYTICS],
    ["FinancialDashboard", FINANCIALS],
    ["TransactionDetailDialog", TX_DIALOG],
  ])("%s calls useTerms", (_name, file) => {
    const source = code(file);
    expect(source).toMatch(/\bconst\s+terms\s*=\s*useTerms\(\)/);
    expect(source).toMatch(
      /import\s*\{[^}]*\buseTerms\b[^}]*\}\s*from\s*"@\/contexts\/TerminologyContext"/,
    );
  });

  it("the challenge detail page resolves terms on the server", () => {
    /*
      A server component, so it must NOT use the hook - `useTerms` would make the page a
      client component and take its database reads into the browser. Both halves are asserted:
      a page that calls `getTerms()` and also imports the hook has one of the two by accident.
    */
    const source = code(CHALLENGE_VIEW);
    expect(source).toMatch(/\bawait\s+getTerms\(\)/);
    expect(source).not.toMatch(/\buseTerms\b/);
  });
});

// =======================================================================================
// R92 - the write side
// =======================================================================================

describe("a settled challenge stores the score it was ranked on", () => {
  it.each([
    ["main", MODEL],
    ["admin", MODEL_ADMIN],
  ])("%s declares score on both stat blocks", (_app, file) => {
    const source = code(file);
    /*
      COUNTED, never merely found. The model declares the shape twice in the interface and
      twice in the schema, and one copy carrying the field while its sibling does not is
      exactly the defect - the challenged player's card reports `+0.00` and the challenger's
      reports a score, which reads as one player having played badly.
    */
    expect(source.match(/^\s*score\??:\s*(?:number|Number)\s*[,;]/gm)).toHaveLength(4);
  });

  it.each([
    ["main", OUTCOME],
    ["admin", OUTCOME_ADMIN],
  ])("%s writes both players' scores into the snapshot", (_app, file) => {
    const source = code(file);
    expect(source).toMatch(/score:\s*challenger\.score\b/);
    expect(source).toMatch(/score:\s*challenged\.score\b/);
  });

  it.each([
    ["main", MODEL],
    ["admin", MODEL_ADMIN],
    ["main outcome", OUTCOME],
    ["admin outcome", OUTCOME_ADMIN],
  ])("%s gives the stored score no default and no coalesce", (_app, file) => {
    const source = code(file);
    /*
      THE LOAD-BEARING HALF, and it is an absence. `default: 0` on the schema, or `?? 0` at
      the writer, makes "this player scored nothing" and "this game has no score" one stored
      fact - and on a lower-is-better title that zero sorts FIRST, so the phantom becomes the
      winner. Identical reasoning to R50, where a `default: 0` on
      `CompetitionParticipant.score` made every entrant look prize-eligible.
    */
    expect(source).not.toMatch(/score:\s*Number\s*,\s*default/);
    expect(source).not.toMatch(/score:\s*\{[^}]*default/);
    expect(source).not.toMatch(/score:\s*challeng(?:er|ed)\.score\s*\?\?/);
  });
});

// =======================================================================================
// R92 - the read side
// =======================================================================================

describe("both challenge screens report by game rather than by assumption", () => {
  // No apostrophe in the name, deliberately: vitest's `-t` is a REGULAR EXPRESSION, and the
  // probe harness passes the name through `cmd /c`, where a quote inside a quote is how a
  // probe ends up matching nothing and reporting a passing run over zero tests - which reads
  // exactly like a missing guard.
  it("the analytics route sends the challenge game label", () => {
    /*
      Without these two fields the screens cannot tell a provider challenge from a trading
      one, so every guard below is satisfiable by a component that is handed nothing and
      branches on `false` - which is precisely the state R92 shipped in.
    */
    const source = code(ANALYTICS_ROUTE);
    expect(source).toMatch(/gameType:\s*chalLabel\.gameType/);
    expect(source).toMatch(/gameKey:\s*chalLabel\.gameKey/);
  });

  it.each([
    ["ChallengePlayerCard", PLAYER_CARD],
    ["ChallengeStatRows", STAT_ROWS],
  ])("%s resolves the figure through the shared rule", (_name, file) => {
    /*
      One rule, two screens. `resolveResultMetric` is the single place that decides whether a
      player's headline figure is a score or a P&L, and it is asserted as a CALL rather than as
      an import - a component that imports it and then writes its own ternary satisfies any
      mention-based check while being the second answer this is here to prevent.
    */
    const source = code(file);
    expect(source).toMatch(/resolveResultMetric\(\s*\w+\s*,\s*isProviderGame/);
  });

  /*
    WITHHELD, NOT ZEROED, is the shared claim, and it is the thing that made R92 invisible:
    `pnl`, `pnlPercentage`, `totalTrades` and `winRate` are all absent on a provider
    challenge, so a `?? 0` renders `+0.00`, `+0.00%`, `0` and `0.0%` - four plausible
    figures, not one of which settlement ever stated.

    THE TWO COMPONENTS HOLD IT BY TWO DIFFERENT MECHANISMS, so it is asserted twice rather
    than once over both files. `ChallengeStatRows` takes an early return on `isProviderGame`;
    `ChallengePlayerCard` has no such branch at all, because its trade row is driven off
    `resolveParticipantSubline` returning `null` - which is the better design, since it stops
    "is this a provider game" and "does a trade count belong here" being answered separately
    later. The first version of this guard was one `it.each` asserting the early return, and
    it FAILED ON THE CARD, which is correct code: the mechanism was asserted where only the
    property is shared. A guard that fires on correct code is the one the next reader
    deletes, and the deletion takes the real half with it.
  */
  it("ChallengeStatRows returns before it reads a trading field", () => {
    const source = code(STAT_ROWS);
    const branch = source.search(/if\s*\(\s*isProviderGame\s*\)/);
    expect(branch).toBeGreaterThan(-1);
    const firstTradingRead = source.search(/stats\.(?:pnl|totalTrades|winRate)/);
    expect(firstTradingRead).toBeGreaterThan(branch);
  });

  it("ChallengePlayerCard gates its trade row on the shared subline rule", () => {
    /*
      Asserted as a gate on the RESOLVED value rather than on `isProviderGame`, because a
      second `isProviderGame` test here is exactly the drift the subline rule exists to
      prevent - and asserted by POSITION, so a version computing `subline` correctly and then
      rendering the row unconditionally cannot pass.
    */
    const source = code(PLAYER_CARD);
    expect(source).toMatch(
      /resolveParticipantSubline\(\s*\w+\s*,\s*isProviderGame\s*\)/,
    );
    const gate = source.search(/subline\s*!==\s*null\s*&&/);
    expect(gate).toBeGreaterThan(-1);
    const tradeRead = source.search(/row\.totalTrades/);
    expect(tradeRead).toBeGreaterThan(gate);

    // And no trading figure may be read outside that gate at all.
    expect(source).not.toMatch(/row\.(?:pnl|pnlPercentage|winRate)\b/);
  });

  it("the challenge detail page withholds trading-only configuration", () => {
    /*
      The Rules block and the ranking method are trading's own vocabulary on trading's own
      branch. Renaming them for a provider game would send an operator looking for a setting
      that does not exist there; withholding them says nothing, which is the honest answer.
    */
    const source = code(CHALLENGE_VIEW);
    expect(source).toMatch(/\bconst\s+isProviderGame\s*=\s*hasProviderGameLabel\(/);
    expect(source).toMatch(/challenge\.rules\s*&&\s*!isProviderGame/);
  });
});

// =======================================================================================
// The never-rename canary
// =======================================================================================

describe("the ledger's stored values are not renameable", () => {
  it("tokenises the LABEL and leaves the key alone", () => {
    /*
      A CANARY, and it is the one assertion here that fails when somebody is helpful. The
      financial screen maps a `WalletTransaction.type` to a caption, and A4 tokenised the
      captions - so "Competition Entry" now reads "Event Entry" for an operator who renamed
      the noun. The KEYS beside them are stored enum values on documents already written:
      renaming one orphans every row holding it, and the screen then shows a blank label
      against real money with nothing in a log.

      So the map's keys must still be the literal ledger values. Asserted by naming two of
      them, because they are the two this pass touched.
    */
    const source = code(FINANCIALS);
    expect(source).toMatch(/competition_entry\s*:/);
    expect(source).toMatch(/challenge_entry\s*:/);
  });
});

// =======================================================================================
// R92's open remainder
// =======================================================================================

/*
  These five files read the same snapshot fields A4 made game-aware and are STILL
  unconditionally trading-shaped. They are listed as named exceptions, each carrying an
  assertion that it is STILL an offender, for the R60 reason: a stale exception reads as a
  known problem long after it is solved, and silently re-permits the defect in that file.
  When one is fixed its line here goes red, which is the point.

  The count matters. A4's task named two screens; `rg` over the two field names found seven
  readers. That is the counting rule after four entry paths, ten finalize sites, six raw
  inserts and seven lifecycle routes - so the number in the risk register was measured here
  rather than estimated, and this suite is what keeps it honest.
*/
describe("R92's remaining readers are still trading-shaped", () => {
  const PLAYER_PAGE = join(ROOT, "app/(root)/challenges/[id]/page.tsx");
  const ADMIN_LIST = join(ADMIN, "components/admin/ChallengesAdminSection.tsx");
  const PROFILE = join(ROOT, "lib/actions/user/profile.actions.ts");
  const PROFILE_ADMIN = join(ADMIN, "lib/actions/user/profile.actions.ts");
  const AI_AGENT = join(ADMIN, "app/api/ai-agent/chat/route.ts");

  it("the PLAYER's own result page renders four trading figures with no game branch", () => {
    /*
      The worst of the five, because this is the person who paid. A provider challenge shows
      them $0.00 capital and 0 trades for a game that has neither. X7 by phase.
    */
    const source = code(PLAYER_PAGE);
    expect(source).toMatch(/myStats\.pnl/);
    expect(source).toMatch(/myStats\.totalTrades/);
    expect(source).toMatch(/myStats\.winRate/);
    // The tell: no provider-game question is asked anywhere on the page.
    expect(source).not.toMatch(/hasProviderGameLabel|isProviderGame/);
  });

  it("the admin challenge LIST drawer renders them twice, once per side", () => {
    const source = code(ADMIN_LIST);
    // Counted, not merely found: a fix to one side leaves the other reading as correct.
    const hits = source.match(/stats\.pnlPercentage/g) ?? [];
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(source).not.toMatch(/hasProviderGameLabel|isProviderGame/);
  });

  it.each([
    ["main app", PROFILE],
    ["admin app", PROFILE_ADMIN],
  ])(
    "%s's profile action collapses an absent score to zero at the action",
    (_label, path) => {
      /*
        This one is upstream of every component, so no screen downstream CAN tell absent from
        zero - R50's phantom-zero shape one layer up. Both copies, because a fix to one is the
        "one rule, two copies" drift this programme keeps finding.
      */
      const source = code(path);
      expect(source).toMatch(/myStats\?\.pnl\s*\|\|\s*0/);
      expect(source).toMatch(/myStats\?\.totalTrades\s*\|\|\s*0/);
    },
  );

  it("the AI agent reports a challenge with no score field at all", () => {
    /*
      Reason: this claim was first recorded as "the agent states a confident P&L for a puzzle"
      and that was WRONG - the two challenge lines fall back to an em-dash, not to zero, which
      is the correct read-side behaviour (R45/R50's dash rule). Corrected here rather than
      quietly reworded, because the overstatement was believed and acted on.

      The real defect is an ABSENCE: the challenge report carries only P&L, so asked about a
      provider challenge the agent can give the entry fee, the pot and the winner and has no
      performance figure to explain WHY that player won. It answers "—" and stops.

      Aimed at the absence, so it goes red the day A6 adds a score. Aimed at the presence of
      challenger_pnl it would have stayed green through the fix - the P&L line is correct for
      a trading challenge and is not going anywhere.
    */
    const source = code(AI_AGENT);
    /*
      Sliced to the one function, with BOTH ends proven to exist - a slice whose end marker
      has moved returns the rest of the file and satisfies everything asked of it. The end
      marker is the next FUNCTION, never the banner comment above it, because `code()` strips
      comments before matching.
    */
    const start = source.indexOf("async function executeGetChallengeDetails");
    const end = source.indexOf("async function executeGetInvoices");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const report = source.slice(start, end);

    expect(report).toMatch(/challenger_pnl\s*:/);
    // The em-dash, not a zero. Pinned so a later "tidy-up" to || 0 is caught.
    expect(report).toMatch(/challengerFinalStats\?\.pnl\?\.toFixed\(2\)\s*\|\|\s*"\u2014"/);
    expect(report).not.toMatch(/score/i);
  });

  it("the agent's COMPETITION reports are where the phantom zeros actually are", () => {
    /*
      Found while correcting the claim above. These are the same R50 shape and they feed the
      same agent, so a provider contest's participants are reported as having scored 0 with 0
      trades - which for a game IS a false figure rather than an absent one.
    */
    const source = code(AI_AGENT);
    const hits = source.match(/pnl\s*:[^,\n]*\|\|\s*(0|"0")/g) ?? [];
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });
});
