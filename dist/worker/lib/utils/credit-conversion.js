"use strict";
/**
 * Credit Conversion Utilities
 * Helper functions for converting between EUR and Credits
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.creditsToEUR = creditsToEUR;
exports.eurToCredits = eurToCredits;
exports.formatCredits = formatCredits;
exports.formatEUR = formatEUR;
exports.formatCreditsWithEUR = formatCreditsWithEUR;
// Default rate if settings not loaded (100 credits = 1 EUR)
const DEFAULT_RATE = 100;
function creditsToEUR(credits, rate = DEFAULT_RATE) {
    return credits / rate;
}
function eurToCredits(eur, rate = DEFAULT_RATE) {
    return eur * rate;
}
function formatCredits(credits) {
    return `${credits.toLocaleString()} Credits`;
}
function formatEUR(eur) {
    return `€${eur.toFixed(2)}`;
}
function formatCreditsWithEUR(credits, rate = DEFAULT_RATE) {
    const eur = creditsToEUR(credits, rate);
    return `${credits.toLocaleString()} Credits (≈ €${eur.toFixed(2)})`;
}
