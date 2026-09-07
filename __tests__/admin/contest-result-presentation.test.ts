/**
 * The admin contest view, per game.
 *
 * WHAT THIS PINS, and it is the owner's report rather than a hypothetical: `/competitions/view/[id]`
 * rendered `pnl`, `pnlPercentage` and `totalTrades` for every contest. All three default to `0`
 * on every seat regardless of game (`lib/services/contest-entry/participant-seat.ts`), so a
 * provider contest showed "+0.00 / +0.00% / 0 trades" against every player - present, zero, and
 * rendering perfectly - while `score`, the number the contest ranked on, was on the row and was
 * never displayed. Rows in an order nobody could explain, identical metrics, winner badges and
 * prize amounts beside them. It reads as a broken payout; the payout was correct.
 *
 * WHY THESE TESTS CAN EXIST AT ALL. The logic was extracted out of the JSX deliberately. A
 * structural test over the page can assert the file *mentions* `score` and cannot assert which
 * branch renders it - and "asserts the identifier is present" is the exact weakness that let
 * four earlier probes pass on injected defects. These functions take a row and a flag, so a
 * provider row and a trading row can be passed through and compared.
 */

import { describe, it, expect } from "vitest";
import {
  resolveResultMetric,
  resolveParticipantSubline,
  showsTradingConfiguration,
  resolveEditHref,
  resolveNoWinnersNotice,
  PRIZE_REDISTRIBUTION_NOTE,
} from "../../apps/admin/lib/admin/contest-result-presentation";

describe("admin contest result presentation - the metric column", () => {
  it("shows a provider participant's SCORE, not their zero P&L", () => {
    const metric = resolveResultMetric(
      { score: 1840, pnl: 0, pnlPercentage: 0, totalTrades: 0 },
      true,
    );

    expect(metric.value).toBe("1,840");
    expect(metric.label).toBe("Score");
    // The defect in one assertion: the old column read `pnl`, which is 0 on this very row, so
    // it rendered "+0.00" for a player who scored 1,840.
    expect(metric.value).not.toBe("+0.00");
    expect(metric.sub).toBeNull();
  });

  it("does not render a provider score as a profit or a loss", () => {
    // Reason: a puzzle score is not a gain. Colouring 1,840 green claims the player made
    // money, and colouring a low score red claims they lost some.
    expect(
      resolveResultMetric({ score: 1840 }, true).tone,
    ).toBe("neutral");
    expect(resolveResultMetric({ score: 0 }, true).tone).toBe("neutral");
  });

  it("distinguishes NO SCORE from a score of zero", () => {
    /*
      The whole of R45 in one assertion, on the read side. A player who never produced a result
      is not a player who scored nothing, and printing `0` for the first is what made unscored
      players look like legitimate last-place finishers holding a prize rank.
    */
    const absent = resolveResultMetric({ score: undefined }, true);
    const zero = resolveResultMetric({ score: 0 }, true);

    expect(absent.value).toBe("-");
    expect(absent.label).toBe("No score recorded");

    expect(zero.value).toBe("0");
    expect(zero.label).toBe("Score");
  });

  it("treats null and a non-finite score as absent, not as zero", () => {
    // `Number.isFinite` rather than a truthiness check, for the same reason the ranking module
    // uses it: `if (!score)` folds 0 in with absent and that is the defect, not the guard.
    expect(resolveResultMetric({ score: null }, true).value).toBe("-");
    expect(resolveResultMetric({ score: NaN }, true).value).toBe("-");
    expect(resolveResultMetric({ score: Infinity }, true).value).toBe("-");
  });

  it("leaves the trading column exactly as it was", () => {
    const profit = resolveResultMetric(
      { pnl: 1234.5, pnlPercentage: 12.345, totalTrades: 9 },
      false,
    );
    expect(profit.value).toBe("+1234.50");
    expect(profit.sub).toBe("+12.35%");
    expect(profit.tone).toBe("positive");

    const loss = resolveResultMetric(
      { pnl: -80.2, pnlPercentage: -8.02 },
      false,
    );
    expect(loss.value).toBe("-80.20");
    expect(loss.sub).toBe("-8.02%");
    expect(loss.tone).toBe("negative");
  });

  it("never reports a trade count for a provider contest", () => {
    // "0 trades" against every player of a game that has no trades. Returning null rather than
    // "" matters: an empty string still renders the element and leaves an unexplained gap.
    expect(resolveParticipantSubline({ totalTrades: 0 }, true)).toBeNull();
    expect(resolveParticipantSubline({ totalTrades: 7 }, false)).toBe(
      "7 trades",
    );
  });
});

describe("admin contest result presentation - withheld trading configuration", () => {
  it("withholds starting capital, leverage and asset classes on a provider contest", () => {
    // Withheld, not zeroed. `$0` and `1:1` make a claim about the contest rather than
    // declining to, and an operator reads `$0` starting capital as something to go and fix.
    expect(showsTradingConfiguration(true)).toBe(false);
    expect(showsTradingConfiguration(false)).toBe(true);
  });
});

describe("admin contest result presentation - Edit routing", () => {
  it("routes a provider contest to the game editor and trading to the trading editor", () => {
    /*
      The competitions LIST learned this on 7 Sep 2026 (`12` s2.2); this page was missed. Not a
      corruption path - `PUT /api/competitions/[id]` refuses a labelled provider contest - which
      is what makes it worth fixing: the operator was walked through the whole trading form and
      refused on submit.

      Asserted as a SWAP rather than one destination, because a test that only mentions the game
      editor stays green when the two are exchanged, and a swap is precisely what sends a
      provider contest to the trading form.
    */
    expect(resolveEditHref("abc123", true)).toBe(
      "/competitions/edit-game/abc123",
    );
    expect(resolveEditHref("abc123", false)).toBe("/competitions/edit/abc123");
    expect(resolveEditHref("abc123", true)).not.toBe(
      resolveEditHref("abc123", false),
    );
  });
});

describe("admin contest result presentation - nobody was paid", () => {
  it("says so plainly on a completed contest with no winners", () => {
    const notice = resolveNoWinnersNotice({
      isCompleted: true,
      noWinners: true,
      participantCount: 4,
    });

    expect(notice).toBeTruthy();
    // The operator's actual next question is where the money went, so the notice answers it.
    expect(notice).toMatch(/unclaimed pool/i);
  });

  it("distinguishes an empty contest from one nobody scored in", () => {
    const empty = resolveNoWinnersNotice({
      isCompleted: true,
      noWinners: true,
      participantCount: 0,
    });
    expect(empty).toMatch(/no participants/i);
    expect(empty).not.toMatch(/unclaimed pool/i);
  });

  it("stays silent unless the contest is completed AND paid nobody", () => {
    /*
      Both halves asserted separately. `noWinners` is only written at settlement, so a mid-flight
      contest must not be announced as having paid nobody - the same scoping mistake R45's
      eligibility gate had to avoid, one screen along.
    */
    expect(
      resolveNoWinnersNotice({
        isCompleted: false,
        noWinners: true,
        participantCount: 4,
      }),
    ).toBeNull();

    expect(
      resolveNoWinnersNotice({
        isCompleted: true,
        noWinners: false,
        participantCount: 4,
      }),
    ).toBeNull();

    expect(
      resolveNoWinnersNotice({
        isCompleted: true,
        noWinners: undefined,
        participantCount: 4,
      }),
    ).toBeNull();
  });
});

describe("admin contest result presentation - the prize caution", () => {
  it("tells the reader the configured shares are a floor, not the payout", () => {
    /*
      An operator reconciling the sidebar against the wallet credits concluded the payout was
      broken. Both reasons the figures move must be named, because naming only one still leaves
      a gap the reader fills with "the payout is wrong".
    */
    expect(PRIZE_REDISTRIBUTION_NOTE).toMatch(/split among the players who did place/i);
    expect(PRIZE_REDISTRIBUTION_NOTE).toMatch(/no result holds no rank/i);
    expect(PRIZE_REDISTRIBUTION_NOTE).toMatch(/higher than the amounts here/i);
  });
});
