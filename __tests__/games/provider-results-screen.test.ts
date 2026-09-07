import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findCountedAttempt } from "@/lib/services/games/contest-results.service";

/**
 * The player-facing provider results screen, and the one piece of judgement behind it.
 *
 * Two kinds of test here and they answer different questions. `findCountedAttempt` is real
 * logic and is tested as such. The screen itself is structural, because it is a server
 * component rendering money-adjacent facts, and the properties worth pinning are the ones a
 * future edit would silently break: that it never computes a prize, and that an absent score
 * renders as a dash rather than a zero.
 */

const SCREEN_PATH = join(
  process.cwd(),
  "components",
  "games",
  "ProviderResultsScreen.tsx",
);
const PAGE_PATH = join(
  process.cwd(),
  "app",
  "(root)",
  "competitions",
  "[id]",
  "results",
  "page.tsx",
);

/**
 * Comments in these files discuss the anti-patterns they avoid, so a test that reads prose
 * fails a correct file for explaining itself and passes a broken one whose only mention of the
 * right thing is in a comment.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const screenSource = readFileSync(SCREEN_PATH, "utf8");
const screenCode = stripComments(screenSource);
const pageCode = stripComments(readFileSync(PAGE_PATH, "utf8"));

describe("findCountedAttempt", () => {
  it("picks the highest score when higher is better", () => {
    const counted = findCountedAttempt(
      [
        { attemptNumber: 1, score: 120 },
        { attemptNumber: 2, score: 340 },
        { attemptNumber: 3, score: 90 },
      ],
      "best_of_n",
      "higher_is_better",
    );

    expect(counted).toBe(2);
  });

  it("picks the LOWEST score when lower is better", () => {
    // Reason this is its own test rather than a parameter: marking the slowest attempt as the
    // one that counted, on a screen sitting beside a leaderboard that ranked the fastest, is a
    // visible self-contradiction rather than a rounding difference.
    const counted = findCountedAttempt(
      [
        { attemptNumber: 1, score: 120 },
        { attemptNumber: 2, score: 340 },
        { attemptNumber: 3, score: 90 },
      ],
      "best_of_n",
      "lower_is_better",
    );

    expect(counted).toBe(3);
  });

  it("marks nothing as counted under sum_of_n", () => {
    // Every scored round contributed, so highlighting one would misrepresent how the total was
    // reached. The screen has a separate branch that lists them all instead.
    const counted = findCountedAttempt(
      [
        { attemptNumber: 1, score: 120 },
        { attemptNumber: 2, score: 340 },
      ],
      "sum_of_n",
      "higher_is_better",
    );

    expect(counted).toBeNull();
  });

  it("returns null when no round scored", () => {
    const counted = findCountedAttempt(
      [
        { attemptNumber: 1, score: undefined },
        { attemptNumber: 2, score: undefined },
      ],
      "best_of_n",
      "higher_is_better",
    );

    expect(counted).toBeNull();
  });

  it("treats a genuine zero as a score, not as an absence", () => {
    // The read-side form of R45: a player who finished with nothing still finished, and a
    // screen that hid their round would be telling them they never played.
    const counted = findCountedAttempt(
      [{ attemptNumber: 1, score: 0 }],
      "best_of_n",
      "higher_is_better",
    );

    expect(counted).toBe(1);
  });

  it("ignores a NaN score rather than placing it arbitrarily", () => {
    const counted = findCountedAttempt(
      [
        { attemptNumber: 1, score: Number.NaN },
        { attemptNumber: 2, score: 5 },
      ],
      "best_of_n",
      "higher_is_better",
    );

    expect(counted).toBe(2);
  });
});

describe("ProviderResultsScreen", () => {
  it("renders an absent score as a dash and never as zero", () => {
    // R45's read side. `score ?? 0` is the natural spelling and it tells a player who never
    // finished a round that they scored nothing, which is a different claim.
    const scoreText = screenCode.match(
      /function scoreText[\s\S]*?\n}/,
    )?.[0];

    expect(scoreText).toBeDefined();
    expect(scoreText).toContain("Number.isFinite");
    expect(scoreText).toContain('"-"');
    expect(scoreText).not.toMatch(/\?\?\s*0/);
  });

  it("reads the prize from the settled leaderboard and computes no money of its own", () => {
    // The screen must not have a second opinion about what a player was paid; that disagreement
    // is the reporting defect R46 was about. `results.prizeAmount` is the stored figure.
    expect(screenCode).toContain("results.prizeAmount");

    // No arithmetic on the pool, the entry fee or the configured shares.
    expect(screenCode).not.toContain("prizePool");
    expect(screenCode).not.toContain("prizeDistribution");
    expect(screenCode).not.toContain("platformFee");
  });

  it("explains a refund from the LEDGER row, never from the contest policy", () => {
    /*
      The policy field says what was configured; the ledger row says what happened to this
      player. A contest configured to refund whose players were paid a prize has no row, and
      telling them they were refunded would simply be false.
    */
    expect(screenCode).toContain("refundedAmount !== undefined");
    expect(screenCode).not.toContain("unscoredContestPolicy");
  });

  it("takes the refund from a service outside the round path", () => {
    /*
      Invariant 6 of `round-lifecycle.test.ts` bans money imports from `lib/services/games/`,
      and this screen's data comes from there. The refund read therefore lives beside the code
      that WRITES the row, and the page composes the two. This pins the composition, because
      the tidy-looking alternative - folding the read back into the results service - is
      exactly what the invariant caught the first time.
    */
    expect(pageCode).toContain(
      'from "@/lib/services/settlement/unscored-refund"',
    );
    expect(pageCode).toContain("findUnscoredRefund(");

    const service = readFileSync(
      join(process.cwd(), "lib", "services", "games", "contest-results.service.ts"),
      "utf8",
    );
    expect(stripComments(service)).not.toMatch(/wallet/i);
  });

  it("reads the refund reason from one constant, not two string literals", () => {
    // The writer and the reader join on this value. Two spellings would drift silently in the
    // worst direction: refunds keep being written correctly while the screen stops finding
    // them, so a player who WAS refunded is told nothing at all.
    const refund = stripComments(
      readFileSync(
        join(process.cwd(), "lib", "services", "settlement", "unscored-refund.ts"),
        "utf8",
      ),
    );

    const literals = refund.match(/"no_score_recorded"/g) ?? [];
    expect(literals.length).toBe(1);
    expect(refund).toContain("export const UNSCORED_REFUND_REASON");
    expect(refund).toContain("refundReason: UNSCORED_REFUND_REASON");
    expect(refund).toContain(
      '"metadata.refundReason": UNSCORED_REFUND_REASON',
    );
  });

  it("names the platform fee in the refund explanation", () => {
    // The owner asked for the explanation specifically. The amount being less than the entry
    // fee is the part that generates a support ticket if it goes unsaid.
    const refundBlock = screenCode.slice(
      screenCode.indexOf("refundedAmount !== undefined"),
    );

    expect(refundBlock.length).toBeGreaterThan(200);
    expect(refundBlock).toContain("platform fee");
  });

  it("labels 'best' by the contest's own direction", () => {
    // A time trial's best round is its lowest. A screen that says "Best round" over the highest
    // number contradicts the leaderboard beside it.
    expect(screenCode).toContain("lowerIsBetter");
    expect(screenCode).toContain('results.scoreDirection === "lower_is_better"');
  });

  it("humanizes the provider's score breakdown keys", () => {
    /*
      `boardsCompleted` and `penaltyMs` were being printed raw to players.

      Matched as a CALL with its arguments, not as a bare identifier: the first version of this
      assertion read `toContain("humanizeMetric")` and stayed green when the call was replaced
      by `{ label: key, value: String(value) }`, because the name is still on the import line.
      An import is not a use, and this is the fourth time that has defeated a structural test
      in this codebase.
    */
    expect(screenCode).toMatch(/humanizeMetric\(\s*key\s*,\s*value\s*\)/);
  });

  it("enumerates no game code, key or provider anywhere", () => {
    /*
      The "no additional coding" acceptance criterion has exactly one failure mode: something
      that enumerates games. A branch on the title here means the next game silently renders a
      screen missing half its content while every existing test still passes.
    */
    expect(screenCode).not.toMatch(/gameKey\s*===/);
    expect(screenCode).not.toMatch(/gameCode\s*===/);
    expect(screenCode).not.toMatch(/providerKey/);
  });
});

describe("the results route", () => {
  it("renders the provider screen rather than redirecting away from it", () => {
    /*
      This branch used to redirect to the lobby, which stopped the crash and left a provider
      player with no record of their own contest. The probe for this asserts the ORDER: the
      provider check must reach the screen, not a redirect.
    */
    const branchStart = pageCode.indexOf("hasProviderGameLabel(competition)");
    expect(branchStart).toBeGreaterThan(-1);

    const branch = pageCode.slice(branchStart, branchStart + 2000);
    expect(branch).toContain("ProviderResultsScreen");

    // The only redirect inside the branch is the no-seat one, which is a different fact.
    const redirects = branch.match(/redirect\(/g) ?? [];
    expect(redirects.length).toBe(1);
    expect(branch).toContain("!providerResults");
  });

  it("keeps the trading post-mortem unreachable for a provider contest", () => {
    // The trading reads below the branch are what threw. The branch must return before them.
    const branchStart = pageCode.indexOf("hasProviderGameLabel(competition)");
    const tradingRead = pageCode.indexOf("getCompetitionTradeHistory(competitionId)");

    expect(tradingRead).toBeGreaterThan(branchStart);
  });
});
