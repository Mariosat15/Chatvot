/*
  WHAT A CREDIT IS WORTH — ONE ANSWER, DERIVED FROM ONE STORED NUMBER.

  The platform used to store this twice, in two collections, and the two disagreed by a factor
  of a hundred:

    CreditConversionSettings.eurToCreditsRate   default 100   (100 credits = EUR 1)
    AppSettings.credits.valueInEUR              default 1     (1 credit  = EUR 1)

  The first is the one the money moves on — deposits, withdrawals, the financial dashboard,
  transaction exports and the admin analytics all read it. The second drove the client
  context's `creditsToEUR` / `eurToCredits`, which is what puts the "approximately EUR x" line
  under a wallet balance and what the deposit modal quotes back to somebody about to pay.

  So a player holding 1,000 credits was shown EUR 1,000.00 and could withdraw EUR 10, and the
  deposit modal offered 10 credits for EUR 10 while the processor credited 1,000.

  Owner decision, 9 September 2026: 100 credits = EUR 1 is authoritative, and `valueInEUR`
  DERIVES from `eurToCreditsRate` rather than being a second stored number.

  // Reason: the stored `AppSettings.credits.valueInEUR` is deliberately left in place rather
  // than migrated. It may hold a value an operator typed on purpose, and overwriting it would
  // destroy the only record of that; nothing reads it now, so it is inert either way.
*/

/** 100 credits = 1 unit of the base currency. Matches the schema default on the rate. */
export const DEFAULT_EUR_TO_CREDITS_RATE = 100;

/**
  Narrow whatever is stored to a usable rate.

  // Reason: `|| DEFAULT` would be right about 0 and right about NaN by accident, but the rate
  // reaches us from `parseFloat` on an admin form and from a `.lean()` read, so enumerate what
  // is being caught rather than relying on falsiness: a negative rate is neither falsy nor
  // usable, and it would flip every conversion's sign.
*/
export function resolveEurToCreditsRate(stored: unknown): number {
  const rate = typeof stored === "number" ? stored : Number(stored);
  if (!Number.isFinite(rate) || rate <= 0) return DEFAULT_EUR_TO_CREDITS_RATE;
  return rate;
}

/**
  What one credit is worth in the base currency — the derived replacement for the stored
  `AppSettings.credits.valueInEUR`.
*/
export function creditValueInBaseCurrency(storedRate: unknown): number {
  return 1 / resolveEurToCreditsRate(storedRate);
}

/**
  The value to show before a settings fetch has resolved, or when one fails.

  // Reason: every client fallback used to be a hard-coded `1`, which is the wrong side of the
  // disagreement above — so a slow or failed fetch reinstated the hundredfold figure, briefly
  // and silently, on the one screen where it matters. A fallback is a stored value as far as
  // the player reading it is concerned.
*/
export const DEFAULT_CREDIT_VALUE_IN_BASE_CURRENCY = creditValueInBaseCurrency(
  DEFAULT_EUR_TO_CREDITS_RATE,
);
