/**
 * Credit Conversion Utilities
 * Helper functions for converting between EUR and Credits
 */

// Default rate if settings not loaded (100 credits = 1 EUR)
const DEFAULT_RATE = 100;

export function creditsToEUR(credits: number, rate: number = DEFAULT_RATE): number {
  return credits / rate;
}

export function eurToCredits(eur: number, rate: number = DEFAULT_RATE): number {
  return eur * rate;
}

export function formatCredits(credits: number): string {
  return `${credits.toLocaleString()} Credits`;
}

export function formatEUR(eur: number): string {
  return `€${eur.toFixed(2)}`;
}

export function formatCreditsWithEUR(credits: number, rate: number = DEFAULT_RATE): string {
  const eur = creditsToEUR(credits, rate);
  return `${credits.toLocaleString()} Credits (≈ €${eur.toFixed(2)})`;
}

