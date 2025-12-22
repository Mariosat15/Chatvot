"use strict";
/**
 * EU Country VAT Utilities
 * List of EU member states and VAT-related functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COUNTRY_NAMES = exports.EU_COUNTRIES = void 0;
exports.isEUCountry = isEUCountry;
exports.calculateVAT = calculateVAT;
exports.calculateTotalWithVAT = calculateTotalWithVAT;
// EU Member States (ISO 3166-1 alpha-2 codes)
exports.EU_COUNTRIES = [
    'AT', // Austria
    'BE', // Belgium
    'BG', // Bulgaria
    'HR', // Croatia
    'CY', // Cyprus
    'CZ', // Czech Republic
    'DK', // Denmark
    'EE', // Estonia
    'FI', // Finland
    'FR', // France
    'DE', // Germany
    'GR', // Greece
    'HU', // Hungary
    'IE', // Ireland
    'IT', // Italy
    'LV', // Latvia
    'LT', // Lithuania
    'LU', // Luxembourg
    'MT', // Malta
    'NL', // Netherlands
    'PL', // Poland
    'PT', // Portugal
    'RO', // Romania
    'SK', // Slovakia
    'SI', // Slovenia
    'ES', // Spain
    'SE', // Sweden
];
/**
 * Check if a country code is an EU member state
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., 'DE', 'FR', 'US')
 * @returns true if the country is in the EU
 */
function isEUCountry(countryCode) {
    if (!countryCode)
        return false;
    return exports.EU_COUNTRIES.includes(countryCode.toUpperCase());
}
/**
 * Get country name from code
 */
exports.COUNTRY_NAMES = {
    'AT': 'Austria',
    'BE': 'Belgium',
    'BG': 'Bulgaria',
    'HR': 'Croatia',
    'CY': 'Cyprus',
    'CZ': 'Czech Republic',
    'DK': 'Denmark',
    'EE': 'Estonia',
    'FI': 'Finland',
    'FR': 'France',
    'DE': 'Germany',
    'GR': 'Greece',
    'HU': 'Hungary',
    'IE': 'Ireland',
    'IT': 'Italy',
    'LV': 'Latvia',
    'LT': 'Lithuania',
    'LU': 'Luxembourg',
    'MT': 'Malta',
    'NL': 'Netherlands',
    'PL': 'Poland',
    'PT': 'Portugal',
    'RO': 'Romania',
    'SK': 'Slovakia',
    'SI': 'Slovenia',
    'ES': 'Spain',
    'SE': 'Sweden',
};
/**
 * Calculate VAT amount
 * @param baseAmount - Amount before VAT
 * @param vatRate - VAT rate as percentage (e.g., 20 for 20%)
 * @returns VAT amount
 */
function calculateVAT(baseAmount, vatRate) {
    return baseAmount * (vatRate / 100);
}
/**
 * Calculate total amount including VAT
 * @param baseAmount - Amount before VAT
 * @param vatRate - VAT rate as percentage (e.g., 20 for 20%)
 * @returns Total amount including VAT
 */
function calculateTotalWithVAT(baseAmount, vatRate) {
    return baseAmount + calculateVAT(baseAmount, vatRate);
}
