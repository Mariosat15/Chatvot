/**
 * The one way a competition amount is written down.
 *
 * WHY THIS EXISTS. Entry fees, prize pools and prizes are credits - they are debited from and
 * credited to `CreditWallet.creditBalance`, and nothing about them is a euro. Roughly forty
 * render sites nonetheless prefixed them with `settings.currency.symbol`, which is the *fiat*
 * symbol configured for deposits and invoices, so a 50-credit entry fee read `€50`. A handful
 * were worse: `formatCurrency` in `lib/utils.ts` is hard-coded to USD and prepends a `+`, so a
 * provider contest's prize pool rendered as `+$30.00`.
 *
 * None of that was a wrong number. Every amount was correct and only its unit was a lie, which
 * is why it survived: there is no error, no log line, and the figure reconciles perfectly
 * against the ledger.
 *
 * THIS MODULE NEVER CONVERTS. It writes a credit amount in credits. Converting to fiat is a
 * deposit/withdrawal concern, it has its own stored rate, and - see the note at the foot of
 * this file - the platform currently holds two of those rates that disagree. A formatter that
 * could convert would be a formatter that could quietly pick the wrong one.
 *
 * Mirrored byte-for-byte into `apps/admin/lib/utils/format-volts.ts` and pinned by a test.
 * `check:mirrors` compares models, so it has no opinion about this file.
 */

/**
 * The unit's name when nothing overrides it.
 *
 * The name is configurable - `AppSettings.credits.name`, edited in admin Settings -> Currency -
 * so a caller with the settings loaded should pass it. The default exists because the callers
 * that need this most are on the server: a notification body or an entry refusal has no React
 * context, and making them each read the settings singleton would put a database round trip on
 * paths that currently have none. A renamed unit therefore reaches every screen and not the
 * handful of server-composed strings; that is a known boundary, recorded rather than implied
 * away, and it is a strictly smaller inconsistency than the euro sign it replaces.
 */
export const DEFAULT_VOLTS_UNIT = "Volts";

/** What to render when there is no amount. */
export const NO_AMOUNT = "-";

export interface FormatVoltsOptions {
  /** `AppSettings.credits.name`. Falls back to {@link DEFAULT_VOLTS_UNIT}. */
  unit?: string | null;
  /** Drop the unit and return the bare number, for a cell whose column header carries it. */
  bare?: boolean;
}

/**
 * Whole amounts carry no decimals, fractional ones carry exactly two.
 *
 * An entry fee is nearly always whole, and `50.00 Volts` on a lobby hero is noise. A prize
 * share is nearly never whole, because it is a percentage of a pool, and `33.3 Volts` beside
 * `33.33 Volts` in the same column reads as a rounding bug rather than as two numbers.
 */
function formatAmount(amount: number): string {
  const isWhole = Number.isInteger(amount);
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  });
}

/**
 * `1 Volt`, not `1 Volts`.
 *
 * Derived by trimming a trailing `s` because the setting is a single string and cannot carry
 * both forms. That is right for every name the placeholder suggests - Volts, Volt Credits,
 * Trading Points - and harmlessly inert for one that does not end in `s`. An entry fee of
 * exactly 1 is ordinary, so this is not a hypothetical.
 */
function singularise(unit: string): string {
  return unit.endsWith("s") ? unit.slice(0, -1) : unit;
}

/**
 * Writes a competition credit amount.
 *
 * `formatVolts(500)` -> `500 Volts`
 * `formatVolts(1000)` -> `1,000 Volts`
 * `formatVolts(33.335)` -> `33.34 Volts`
 * `formatVolts(1)` -> `1 Volt`
 *
 * An absent or non-finite amount returns {@link NO_AMOUNT}. `NaN` is one `parseFloat` away on
 * every admin form, and `NaN Volts` in a prize column is worse than a dash: it is a number
 * shaped like a payout. This is the same rule as R45's unheld rank and R50's absent score -
 * a missing amount and a zero amount are different facts, and only one of them is `0 Volts`.
 */
export function formatVolts(
  amount: number | null | undefined,
  options: FormatVoltsOptions = {},
): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return NO_AMOUNT;
  }

  const formatted = formatAmount(amount);
  if (options.bare) return formatted;

  const unit = options.unit?.trim() || DEFAULT_VOLTS_UNIT;
  return `${formatted} ${amount === 1 ? singularise(unit) : unit}`;
}

/**
 * The same amount, abbreviated, for a headline with no room for a full figure.
 *
 * `formatVoltsCompact(30000)` -> `30K Volts`
 * `formatVoltsCompact(2400000)` -> `2.4M Volts`
 * `formatVoltsCompact(750)` -> `750 Volts`
 *
 * This exists because the landing page had two identical private `formatCurrency` helpers, one
 * per route, each hard-coded to `$` and each abbreviating a *credit* prize pool as dollars. Two
 * copies of one rule is the shape behind several defects here, so there is one copy and both
 * routes import it. Signed-out visitors are the audience, so there are no settings to read and
 * the default unit applies.
 */
export function formatVoltsCompact(
  amount: number | null | undefined,
  options: FormatVoltsOptions = {},
): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return NO_AMOUNT;
  }

  const magnitude =
    amount >= 1_000_000
      ? `${(amount / 1_000_000).toFixed(1)}M`
      : amount >= 1_000
        ? `${(amount / 1_000).toFixed(0)}K`
        : amount.toLocaleString("en-US");

  if (options.bare) return magnitude;

  const unit = options.unit?.trim() || DEFAULT_VOLTS_UNIT;
  return `${magnitude} ${amount === 1 ? singularise(unit) : unit}`;
}

/*
  A FINDING RECORDED HERE BECAUSE THIS IS WHERE SOMEBODY WILL COME LOOKING.

  The platform stores what a credit is worth twice, in two collections, and the two defaults
  disagree by a factor of a hundred:

    AppSettings.credits.valueInEUR              default 1     (1 credit = EUR 1)
    CreditConversionSettings.eurToCreditsRate   default 100   (100 credits = EUR 1)

  The second is the one the money moves on - deposits, withdrawals, the financial dashboard,
  transaction exports and the admin analytics screen all read it. The first drives the client
  context's `creditsToEUR`, which is what puts the "approximately EUR x" line under a player's
  wallet balance and transaction rows.

  So the player's fiat equivalent and the operator's are computed from different stored
  numbers. Out of scope here, and deliberately so: this module removes the fiat equivalent
  from competition surfaces rather than correcting it, because a competition is denominated in
  credits and has no business quoting a second unit at all. The wallet and deposit surfaces
  where the disagreement actually bites are untouched.
*/
