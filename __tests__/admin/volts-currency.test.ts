/**
 * TASK 1 - a competition amount is written in the platform's own credit symbol, never in a
 * national currency.
 *
 * AMENDED 9 SEP 2026, owner instruction, and the amendment is recorded rather than folded in
 * because the first build got the surface right and the field wrong. It rendered the credit
 * NAME - "50 Volts", from `AppSettings.credits.name` - and the owner's requirement is the
 * SYMBOL, `AppSettings.credits.symbol`, which defaults to the lightning bolt: "50 ⚡". Two
 * consequences follow and both are tested below. Singularisation is gone, because a symbol has
 * no plural, and the two tests that pinned it are inverted rather than deleted. And every
 * consumer's prop and option is named `creditSymbol` / `symbol` rather than `unit`, so a site
 * still reading `credits.name` is a compile error rather than a screen quietly showing a word
 * where the operator configured a glyph.
 *
 * WHAT THE DEFECT WAS. Entry fees, prize pools, prizes and refunds are credits: they are
 * debited from and credited to `CreditWallet.creditBalance`, and no fiat currency is involved
 * at any point. Around forty render sites nonetheless prefixed them with
 * `settings.currency.symbol`, which is the fiat symbol configured for deposits and invoices,
 * so a 50-credit entry fee read `EUR 50`. Two landing routes were worse: a private
 * `formatCurrency` in each, hard-coded to `$`.
 *
 * None of it was a wrong number. Every amount was correct and only its unit was a lie, which
 * is exactly why it survived - there is no error, no log line, and every figure reconciles
 * against the ledger.
 *
 * WHAT THESE TESTS DO NOT COVER, deliberately. Simulated trading capital and PnL are a
 * different unit and a question this task did not answer, so `LiveRankingPanel` keeps its own
 * symbol for the ranking metric while its prize pool moves to Volts. And the deposit,
 * withdrawal, invoice and financial-dashboard screens are genuinely fiat and are untouched.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  formatVolts,
  formatVoltsCompact,
  DEFAULT_CREDIT_SYMBOL,
  NO_AMOUNT,
} from "@/lib/utils/format-volts";
import {
  NO_FIAT_RULE,
  TRADING_SYSTEM_PROMPT,
  TRADING_SYSTEM_PROMPT_HISTORICAL,
  TRADING_VOCABULARY,
  providerVocabulary,
} from "@/apps/admin/lib/admin/ai-contest-vocabulary";

const ROOT = join(__dirname, "..", "..");

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

/**
 * These files explain the defect in prose, so a bare `toContain("currency.symbol")` would fire
 * on a correct file for discussing the mistake and pass a broken one whose only mention of the
 * right thing is a comment. Strip both comment forms before matching.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

// =======================================================================================
// The formatter
// =======================================================================================

describe("formatVolts writes a credit amount", () => {
  it("marks the amount with the credit symbol", () => {
    expect(formatVolts(50)).toBe(`50 ${DEFAULT_CREDIT_SYMBOL}`);
  });

  it("puts the symbol after the number, matching the wallet", () => {
    /*
      The wallet has always written `1,000 ⚡`, so a contest screen writing `⚡ 1,000` would put
      two spellings of one amount in front of the same player. The order is asserted rather
      than assumed because it is the kind of thing a later edit "tidies" towards the fiat
      convention, which is symbol-first.
    */
    expect(formatVolts(1000)).toBe(`1,000 ${DEFAULT_CREDIT_SYMBOL}`);
    expect(formatVolts(1000).indexOf(DEFAULT_CREDIT_SYMBOL)).toBeGreaterThan(0);
  });

  it("separates thousands, because a prize pool is often four figures", () => {
    expect(formatVolts(1000)).toBe(`1,000 ${DEFAULT_CREDIT_SYMBOL}`);
    expect(formatVolts(1234567)).toBe(`1,234,567 ${DEFAULT_CREDIT_SYMBOL}`);
  });

  it("does NOT singularise one, because a symbol has no plural", () => {
    /*
      Inverted on 9 Sep 2026, not deleted. This test used to assert `1 Volt`, and the reason it
      existed is the reason it is kept: an entry fee of 1 is ordinary, so whatever this
      renders is on a real screen. Rendering the symbol makes the whole question disappear -
      there is no `1 ⚡` / `2 ⚡s` distinction to get wrong - and a re-added singulariser would
      strip the last character of whatever the operator configured.

      THE SECOND ASSERTION IS THE ONLY ONE THAT CAN SEE THAT, and it was added because a probe
      re-adding the singulariser came back GREEN against the first line alone: the default
      glyph has no trailing `s`, so stripping one is unobservable. The field is free text, so
      an operator who types a word is the case that exposes it - and the rule the two lines
      together pin is the general one, which is that the configured symbol is rendered
      verbatim and never edited.
    */
    expect(formatVolts(1)).toBe(`1 ${DEFAULT_CREDIT_SYMBOL}`);
    expect(formatVolts(1, { symbol: "Volts" })).toBe("1 Volts");
  });

  it("carries no decimals on a whole amount and two on a fraction", () => {
    /*
      An entry fee is nearly always whole and `50.00 ⚡` on a lobby hero is noise. A prize
      share is nearly never whole, being a percentage of a pool, and `33.3` beside `33.33` in
      one column reads as a rounding bug rather than as two numbers.
    */
    expect(formatVolts(50)).toBe(`50 ${DEFAULT_CREDIT_SYMBOL}`);
    expect(formatVolts(33.335)).toBe(`33.34 ${DEFAULT_CREDIT_SYMBOL}`);
    expect(formatVolts(33.3)).toBe(`33.30 ${DEFAULT_CREDIT_SYMBOL}`);
  });

  it("takes the operator's configured symbol", () => {
    // The field is free text in admin Settings -> Currency, so it is not necessarily one glyph.
    expect(formatVolts(5, { symbol: "🔥" })).toBe("5 🔥");
    expect(formatVolts(1, { symbol: "CV" })).toBe("1 CV");
  });

  it("falls back to the default when the configured symbol is blank", () => {
    // A settings read that has not resolved yet, and an operator who cleared the field.
    expect(formatVolts(5, { symbol: undefined })).toBe(
      `5 ${DEFAULT_CREDIT_SYMBOL}`,
    );
    expect(formatVolts(5, { symbol: "   " })).toBe(`5 ${DEFAULT_CREDIT_SYMBOL}`);
    expect(formatVolts(5, { symbol: null })).toBe(`5 ${DEFAULT_CREDIT_SYMBOL}`);
  });

  it("defaults to the same glyph the settings schema does", () => {
    /*
      Two definitions of the default, one in the formatter and one in `app-settings.model.ts`,
      and nothing else makes them agree. If they drift, a platform whose operator never touched
      the currency screen renders one glyph while the settings form shows another - and the
      formatter's copy is the one on every screen, so the settings form would look wrong.
    */
    const schema = read("database/models/app-settings.model.ts");
    const symbolDefault = /symbol:\s*\{[^}]*default:\s*"([^"]+)"/.exec(
      schema.slice(schema.indexOf("credits:")),
    );
    expect(symbolDefault?.[1]).toBe(DEFAULT_CREDIT_SYMBOL);
  });

  it("renders a dash for an absent amount, never a zero", () => {
    /*
      Same rule as R45's unheld rank and R50's absent score: a missing amount and a zero amount
      are different facts, and only one of them is `0 ⚡`. `NaN` matters most - it is one
      `parseFloat` away on every admin form, and `NaN ⚡` in a prize column is worse than a
      dash because it is a number shaped like a payout.
    */
    expect(formatVolts(undefined)).toBe(NO_AMOUNT);
    expect(formatVolts(null)).toBe(NO_AMOUNT);
    expect(formatVolts(Number.NaN)).toBe(NO_AMOUNT);
    expect(formatVolts(Number.POSITIVE_INFINITY)).toBe(NO_AMOUNT);
    // ... and a real zero is a real amount.
    expect(formatVolts(0)).toBe(`0 ${DEFAULT_CREDIT_SYMBOL}`);
  });

  it("drops the symbol on request, for a column whose header carries it", () => {
    expect(formatVolts(1000, { bare: true })).toBe("1,000");
  });

  it("never converts to a national currency", () => {
    /*
      Load-bearing rather than pedantic. The platform stores what a credit is worth TWICE and
      the two defaults disagree by a factor of a hundred - `AppSettings.credits.valueInEUR` at
      1, `CreditConversionSettings.eurToCreditsRate` at 100. A formatter that could convert
      would be a formatter that could quietly pick the wrong one, so this one takes no rate
      argument at all and its output contains no fiat symbol for any input.
    */
    const source = read("lib/utils/format-volts.ts");
    const code = stripComments(source);
    expect(code).not.toMatch(/valueInEUR|eurToCreditsRate|creditsToEUR/);
    for (const amount of [0, 1, 50, 1000, 1234.56]) {
      expect(formatVolts(amount)).not.toMatch(/[€$£¥]/);
    }
  });
});

describe("formatVoltsCompact abbreviates a headline figure", () => {
  it("abbreviates thousands and millions", () => {
    expect(formatVoltsCompact(30000)).toBe(`30K ${DEFAULT_CREDIT_SYMBOL}`);
    expect(formatVoltsCompact(2_400_000)).toBe(`2.4M ${DEFAULT_CREDIT_SYMBOL}`);
  });

  it("leaves a small amount alone", () => {
    expect(formatVoltsCompact(750)).toBe(`750 ${DEFAULT_CREDIT_SYMBOL}`);
  });

  it("does NOT singularise one either", () => {
    /*
      Inverted alongside its sibling on 9 Sep 2026. It is kept because of what it originally
      caught: a comment here once claimed an abbreviated amount is never exactly one, which is
      false below 1000, and this assertion is the reason that claim did not survive. The value
      of 1 is still the interesting input - it is simply no longer a special case.

      Second assertion for the same reason as its sibling's: the default glyph has no trailing
      `s`, so a probe re-adding the singulariser is invisible without a configured symbol that
      has one.
    */
    expect(formatVoltsCompact(1)).toBe(`1 ${DEFAULT_CREDIT_SYMBOL}`);
    expect(formatVoltsCompact(1, { symbol: "Volts" })).toBe("1 Volts");
  });

  it("renders a dash for an absent amount", () => {
    expect(formatVoltsCompact(Number.NaN)).toBe(NO_AMOUNT);
  });
});

describe("the formatter is mirrored byte for byte", () => {
  it("the admin copy is identical", () => {
    /*
      `check:mirrors` compares models, so it has no opinion about this file. A text comparison
      is the only guard - and it matters here because the two apps both render prize figures,
      so a drifted copy means one screen writes the operator's glyph and the other writes a
      word, or the default differs between them.
    */
    expect(read("apps/admin/lib/utils/format-volts.ts")).toBe(
      read("lib/utils/format-volts.ts"),
    );
  });
});

describe("no caller pre-formats the number it hands to the formatter", () => {
  /*
    THE DEFECT THIS GUARDS, WHICH WAS REAL AND WAS COMMITTED FOR ABOUT AN HOUR.

    Five call sites on the admin challenge view were written as
    `formatVolts(challenge.prizePool?.toLocaleString(), { symbol })` and
    `formatVolts(gm.gmEarning.toFixed(2), { symbol })` - the pre-formatting left over from the
    string being replaced. The formatter does both jobs itself, so the argument arrived as a
    STRING, hit the `typeof amount !== "number"` guard, and returned NO_AMOUNT.

    So the prize pool, the entry fee and the winner's prize rendered as `-` on a screen whose
    whole purpose is those three numbers. This is the absent-amount rule biting from the far
    side: a dash is right for a missing amount and is a lie about a present one, and it looks
    exactly like data that has not loaded.

    Two things about how it was found, because neither instrument was sufficient alone. The
    admin typecheck caught only TWO of the five, because that page's challenge object is
    loosely typed, so `?.toLocaleString()` widens to `any` on three of them and the compiler
    had nothing to object to - which is the older rule that a hand-written type is not the
    schema, in a new place. And every structural test in this file stayed green, because they
    ask whether a screen reads the fiat symbol and this screen does not. The count that
    exposed it was the typecheck DIFF against a stashed baseline, not the total: two new
    errors inside 225.

    Scanned rather than listed, on the R51 rule: a list of the files that had it is green on
    the day somebody writes the sixth.
  */
  const CALLERS = [
    "app",
    "components",
    "lib",
    "apps/admin/app",
    "apps/admin/components",
    "apps/admin/lib",
  ];

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        out.push(...walk(rel));
      } else if (/\.tsx?$/.test(entry.name)) {
        out.push(rel);
      }
    }
    return out;
  }

  // Matches a formatVolts / formatVoltsCompact call whose first argument ends in a call to
  // toFixed or toLocaleString. Deliberately narrow: it is the pre-formatting that is wrong,
  // not an expression that happens to mention those names elsewhere.
  const PREFORMATTED = /formatVolts(?:Compact)?\(\s*[^,()]*\.to(?:Fixed|LocaleString)\(/g;

  it("no call site hands it a string", () => {
    const offenders: string[] = [];
    for (const dir of CALLERS) {
      for (const file of walk(dir)) {
        const hits = stripComments(read(file)).match(PREFORMATTED);
        if (hits) offenders.push(`${file}: ${hits.join(", ")}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("a pre-formatted amount really does render as a dash", () => {
    // The behavioural half. Without this, the scan above is a rule nobody can see the cost
    // of, and the first person it inconveniences deletes it.
    expect(formatVolts("1,000" as never)).toBe(NO_AMOUNT);
    expect(formatVolts("30.00" as never)).toBe(NO_AMOUNT);
    expect(formatVoltsCompact("30,000" as never)).toBe(NO_AMOUNT);
  });
});

// =======================================================================================
// The render sites
// =======================================================================================

/**
 * Every file listed here renders a competition or challenge money figure. The assertion is
 * that none of them reaches for the fiat symbol.
 *
 * Written as a list of files rather than a directory walk on purpose: a walk would sweep in
 * the deposit, withdrawal, invoice and financial-dashboard screens, where `currency.symbol` is
 * exactly right, and the resulting exclusion list would be longer and less honest than this.
 */
const CONTEST_MONEY_SCREENS = [
  "components/competitions/PrizeTable.tsx",
  "components/trading/CompetitionCard.tsx",
  "components/trading/CompetitionEntryButton.tsx",
  "components/trading/ChallengeCard.tsx",
  "components/trading/LastManStandingListener.tsx",
  "components/trading/LastManStandingPopup.tsx",
  "components/trading/lobby/TradingLobbyHero.tsx",
  "components/trading/lobby/TradingLobbySidebar.tsx",
  "components/trading/lobby/trading-lobby-accordions.tsx",
  "components/games/ProviderContestLobby.tsx",
  "components/games/ProviderResultsScreen.tsx",
  "components/games/arena/ArenaContestPanel.tsx",
  "components/dashboard/ContestStatsCards.tsx",
  "app/(root)/competitions/[id]/page.tsx",
  "app/(root)/competitions/[id]/play/page.tsx",
  "app/(root)/competitions/[id]/results/page.tsx",
  "app/api/landing/competitions/route.ts",
  "app/api/landing/stats/route.ts",
  "apps/admin/app/competitions/view/[id]/page.tsx",
  "apps/admin/app/challenges/view/[id]/page.tsx",
  "apps/admin/components/admin/competitions/ContestPrizePanel.tsx",
  "apps/admin/components/admin/competitions/SettledResultPanel.tsx",
  "apps/admin/components/admin/CompetitionsListSection.tsx",
  "apps/admin/components/admin/CompetitionCreatorForm.tsx",
  "apps/admin/components/admin/games/ProviderContestWizard.tsx",
  "apps/admin/components/admin/games/wizard/StepSchedule.tsx",
  "apps/admin/components/admin/games/wizard/StepReview.tsx",
];

describe("no contest screen reads the fiat symbol", () => {
  it.each(CONTEST_MONEY_SCREENS)("%s", (relativePath) => {
    const code = stripComments(read(relativePath));
    expect(code).not.toMatch(/currency\??\.\s*symbol/);
  });

  it("no contest screen hard-codes a currency symbol either", () => {
    /*
      The separate half, and the one a `currency.symbol` check cannot see: the landing routes
      never read settings at all, they simply wrote `"$"`. Scoped to a string literal
      containing only the symbol, because a euro sign inside prose - "converted from EUR" - is
      legitimate and this guard must not fail on correct code.
      Reason: a guard that fires on a correct file is the fastest way to have it deleted.
    */
    for (const relativePath of CONTEST_MONEY_SCREENS) {
      const code = stripComments(read(relativePath));
      expect(code, relativePath).not.toMatch(/["'`][€$£¥]["'`]/);
    }
  });
});

describe("the ranking panels keep two units apart", () => {
  /*
    These two panels are the one place the sweep did NOT go all the way, and the reason is that
    they render two different quantities. The ranking metric and the distance to first are the
    player's simulated TRADING capital - not credits, and not a unit this task decided. The
    prize pool and the potential reward are credits.

    Giving both the same prefix is what made the two look like one quantity, so the test pins
    that they are now different: the pool carries the credit symbol, the metric does not.
  */
  const PANELS = [
    "components/trading/LiveRankingPanel.tsx",
    "components/trading/GameLiveRankingPanel.tsx",
  ];

  it.each(PANELS)("%s writes the pool and the reward in credits", (p) => {
    const code = stripComments(read(p));
    expect(code).toMatch(
      /formatVolts\(prizePool,\s*\{\s*symbol:\s*creditSymbol\s*\}\)/,
    );
    expect(code).toMatch(
      /formatVolts\(entry\.potentialReward,\s*\{\s*symbol:\s*creditSymbol\s*\}\)/,
    );
  });

  it.each(PANELS)("%s still writes the metric in its own symbol", (p) => {
    /*
      The negative half of the same claim. If a later sweep "finishes the job" here it will
      relabel simulated capital as credits, which is a new lie rather than a fix.

      Each panel has exactly two metric formatters - the ranking value and the distance to
      first - and the assertion COUNTS the interpolations rather than looking for the
      identifier. A bare `toMatch(/currSymbol/)` was the first version and a probe renaming the
      declaration came back green, because the name still appears on the prop, the parameter
      and the type. Fifth time one identifier appearing twice has defeated a structural test
      here, after `!expectedOrigin`, the fixed-character Edit guard, `canTransitionRound` and
      `MIN_REASON_LENGTH`.
    */
    const code = stripComments(read(p));
    expect(code.match(/\$\{currSymbol\}/g) ?? []).toHaveLength(2);
  });
});

describe("the shared prize table takes the credit symbol, not the fiat one", () => {
  it("its prop is named for what it now carries", () => {
    /*
      `PrizeTable` is rendered by both lobbies, so a leftover `currSymbol` prop would be the
      "one rule, two copies" shape - one lobby in credits, the other in euros, from one
      component. Asserting the prop NAME changed is what makes a half-done sweep fail.

      Reason the name is `creditSymbol` and not `symbol`: this component sits next to trading
      code where `symbol` means a market instrument - `EUR/USD`. A prop called `symbol` on a
      contest component is ambiguous exactly where the ambiguity is expensive.
    */
    const code = stripComments(read("components/competitions/PrizeTable.tsx"));
    expect(code).not.toMatch(/currSymbol/);
    expect(code).toMatch(/creditSymbol\??\s*:/);
  });

  it.each([
    "components/trading/lobby/TradingLobbySidebar.tsx",
    "components/games/ProviderContestLobby.tsx",
  ])("%s hands it the credit symbol", (p) => {
    expect(stripComments(read(p))).toMatch(/creditSymbol=\{/);
  });
});

describe("the landing routes share one abbreviating formatter", () => {
  /*
    Both routes held an identical private `formatCurrency`, each hard-coded to `$`. One copy
    corrected and the other missed is precisely the failure this codebase keeps finding, so the
    guard is that neither declares its own and that every amount goes through the shared one.
  */
  const ROUTES: Array<[string, number]> = [
    // The route, and how many amounts it formats. Counted, not merely found: the first version
    // asserted the name appeared somewhere in the file and a probe reverting ONE of the two
    // call sites came back green, satisfied by the surviving import line. An import is not a
    // use - the fourth time that has defeated a structural test here.
    ["app/api/landing/competitions/route.ts", 2],
    ["app/api/landing/stats/route.ts", 2],
  ];

  it.each(ROUTES)("%s formats every amount through it", (p, expected) => {
    const code = stripComments(read(p));
    const calls = code.match(/formatVoltsCompact\(/g) ?? [];
    expect(calls).toHaveLength(expected);
  });

  it.each(ROUTES)("%s carries no formatter of its own", (p) => {
    // Any mention at all, not just a declaration: a call to a `formatCurrency` that has moved
    // somewhere shared is the same defect one file along.
    expect(stripComments(read(p))).not.toMatch(/formatCurrency/);
  });
});

// =======================================================================================
// The strings the server composes
// =======================================================================================

/**
 * A screen can read the operator's configured symbol; a notification body cannot, because it is
 * written on a path with no React context and giving it one would put a settings read on every
 * send. These sites therefore call `formatVolts` with no options and get the default glyph.
 *
 * That boundary is real and is recorded rather than implied away: changing the symbol reaches
 * every screen and not these handful of strings. It is a strictly smaller inconsistency than
 * the euro sign it replaces, and it shrank further on 9 Sep 2026 - the default is now the same
 * lightning bolt the settings schema ships, so an operator who never edits the field sees no
 * inconsistency at all.
 */
const SERVER_COMPOSED_CONTEST_MONEY = [
  // Three prize notifications - won, podium, prize received - each of which told a winner they
  // had won a number of euros. The only place the wrong unit reached a player by email as well
  // as on screen.
  "lib/services/notification.service.ts",
  "apps/admin/lib/services/notification.service.ts",
  // "Your full entry fee of X has been refunded" on an emergency cancellation.
  "apps/admin/lib/actions/trading/competition-cancel.actions.ts",
  // Disqualification and prize-adjustment notifications, and the operator's audit line.
  "apps/admin/app/api/competitions/[id]/adjust-results/route.ts",
  // The operator's reconciliation lines for a settled contest.
  "lib/services/settlement/fees.service.ts",
  "apps/admin/lib/services/settlement/fees.service.ts",
  "lib/services/settlement/game-master-fees/calculate.ts",
  "apps/admin/lib/services/settlement/game-master-fees/calculate.ts",
];

describe("no contest string composed on the server names a currency", () => {
  it.each(SERVER_COMPOSED_CONTEST_MONEY)("%s", (relativePath) => {
    /*
      Scoped to these files rather than to a directory walk, because the same services also
      compose deposit, withdrawal and invoice strings where the euro sign is exactly right.
      `notification.service.ts` carries both, which is why the assertion is on the interpolation
      shape - a fiat symbol immediately before a template expression - and not on the symbol
      alone. Reason: a guard that fires on correct code is the fastest way to have it deleted.
    */
    const code = stripComments(read(relativePath));
    const contestLines = code
      .split("\n")
      .filter((line) => /prize|entryFee|entry fee|platform fee|referral|GM /i.test(line))
      .filter((line) => /[€$£](\$\{|\d)/.test(line));
    expect(contestLines).toEqual([]);
  });

  it("the prize notifications go through the formatter", () => {
    // The positive half. The negative assertion above is satisfied by a notification that has
    // simply stopped mentioning the amount at all.
    const main = stripComments(read("lib/services/notification.service.ts"));
    expect(main.match(/prize: formatVolts\(prize\)/g) ?? []).toHaveLength(3);
    const admin = stripComments(
      read("apps/admin/lib/services/notification.service.ts"),
    );
    expect(admin).toMatch(/prize: formatVolts\(prize\)/);
  });

  it("the refund notification names what the player actually gets back", () => {
    const code = stripComments(
      read("apps/admin/lib/actions/trading/competition-cancel.actions.ts"),
    );
    expect(code).toMatch(/entry fee of \$\{formatVolts\(entryFee\)\}/);
  });
});

// =======================================================================================
// The assistant
// =======================================================================================

describe("generated contest copy may not name a currency", () => {
  it("the rule reaches both prompts", () => {
    expect(TRADING_SYSTEM_PROMPT).toContain(NO_FIAT_RULE);
    const provider = providerVocabulary({
      displayName: "Circuit Sprint",
      category: "puzzle",
      scoreDirection: "higher_is_better",
      scoreType: "points",
    } as never);
    expect(provider.systemPrompt).toContain(NO_FIAT_RULE);
  });

  it("the rule forbids the symbol without naming the unit", () => {
    /*
      The unit is operator-configurable, so a prompt hard-coding "Volts" is wrong the day
      somebody renames it. The rule is therefore a prohibition, and this pins that it stays
      one - a later edit "helpfully" naming the unit is the thing to catch.
    */
    expect(NO_FIAT_RULE).toMatch(/Never name a currency/);
    expect(NO_FIAT_RULE).not.toMatch(/\bVolts?\b/);
  });

  it("trading's historical prompt is still character for character what it was", () => {
    /*
      The guarantee moved rather than disappeared. It used to be "trading's prompt is
      unchanged"; it is now "trading's prompt is the historical string PLUS one shared rule,
      and nothing else". Asserting the composition is what keeps that true - a `toContain` on
      the old opening line stays green against a prompt somebody has rewritten around it.
    */
    expect(TRADING_SYSTEM_PROMPT).toBe(
      TRADING_SYSTEM_PROMPT_HISTORICAL + NO_FIAT_RULE,
    );
    expect(TRADING_SYSTEM_PROMPT_HISTORICAL).toContain(
      "creative marketing expert for a trading competition platform",
    );
    expect(TRADING_SYSTEM_PROMPT_HISTORICAL).toContain(
      "Focus on the competitive/gaming aspect",
    );
    expect(TRADING_VOCABULARY.systemPrompt).toBe(TRADING_SYSTEM_PROMPT);
  });
});
