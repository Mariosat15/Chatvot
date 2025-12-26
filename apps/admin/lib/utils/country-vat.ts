/**
 * EU Country VAT Utilities
 * List of EU member states and VAT-related functions
 */

// EU Member States (ISO 3166-1 alpha-2 codes)
export const EU_COUNTRIES = [
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
] as const;

export type EUCountryCode = typeof EU_COUNTRIES[number];

/**
 * Check if a country code is an EU member state
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., 'DE', 'FR', 'US')
 * @returns true if the country is in the EU
 */
export function isEUCountry(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false;
  return EU_COUNTRIES.includes(countryCode.toUpperCase() as EUCountryCode);
}

/**
 * Get country name from code
 */
export const COUNTRY_NAMES: Record<string, string> = {
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
export function calculateVAT(baseAmount: number, vatRate: number): number {
  return baseAmount * (vatRate / 100);
}

/**
 * Calculate total amount including VAT
 * @param baseAmount - Amount before VAT
 * @param vatRate - VAT rate as percentage (e.g., 20 for 20%)
 * @returns Total amount including VAT
 */
export function calculateTotalWithVAT(baseAmount: number, vatRate: number): number {
  return baseAmount + calculateVAT(baseAmount, vatRate);
}

