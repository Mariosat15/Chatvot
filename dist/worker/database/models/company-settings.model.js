"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COUNTRY_NAMES = exports.EU_COUNTRIES = void 0;
exports.isEUCountry = isEUCountry;
const mongoose_1 = require("mongoose");
// EU countries for VAT purposes (ISO 3166-1 alpha-2 codes)
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
const CompanySettingsSchema = new mongoose_1.Schema({
    // Company Information
    companyName: {
        type: String,
        default: 'Your Company Name',
    },
    legalName: {
        type: String,
        default: '',
    },
    registrationNumber: {
        type: String,
        default: '',
    },
    // Address
    addressLine1: {
        type: String,
        default: '',
    },
    addressLine2: {
        type: String,
        default: '',
    },
    city: {
        type: String,
        default: '',
    },
    stateProvince: {
        type: String,
        default: '',
    },
    postalCode: {
        type: String,
        default: '',
    },
    country: {
        type: String,
        default: 'US', // Default to US
    },
    // Contact
    email: {
        type: String,
        default: '',
    },
    phone: {
        type: String,
        default: '',
    },
    website: {
        type: String,
        default: '',
    },
    // Tax Information
    vatNumber: {
        type: String,
        default: '',
    },
    taxId: {
        type: String,
        default: '',
    },
    isVatRegistered: {
        type: Boolean,
        default: false,
    },
    // Banking
    bankName: {
        type: String,
        default: '',
    },
    bankAccountNumber: {
        type: String,
        default: '',
    },
    bankIban: {
        type: String,
        default: '',
    },
    bankSwift: {
        type: String,
        default: '',
    },
    // Branding
    logoUrl: {
        type: String,
        default: '',
    },
}, {
    timestamps: true,
});
// Static method to get singleton instance
CompanySettingsSchema.statics.getSingleton = async function () {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({});
    }
    return settings;
};
// Static method to check if company is in EU
CompanySettingsSchema.statics.isEUCompany = async function () {
    const settings = await this.getSingleton();
    return exports.EU_COUNTRIES.includes(settings.country);
};
// Helper to check if a country is in EU
function isEUCountry(countryCode) {
    return exports.EU_COUNTRIES.includes(countryCode);
}
// Get country name from code
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
    // Non-EU countries
    'US': 'United States',
    'GB': 'United Kingdom',
    'CH': 'Switzerland',
    'NO': 'Norway',
    'CA': 'Canada',
    'AU': 'Australia',
    'NZ': 'New Zealand',
    'JP': 'Japan',
    'CN': 'China',
    'IN': 'India',
    'BR': 'Brazil',
    'MX': 'Mexico',
    'SG': 'Singapore',
    'HK': 'Hong Kong',
    'KR': 'South Korea',
    'AE': 'United Arab Emirates',
};
const CompanySettings = mongoose_1.models?.CompanySettings ||
    (0, mongoose_1.model)('CompanySettings', CompanySettingsSchema);
exports.default = CompanySettings;
