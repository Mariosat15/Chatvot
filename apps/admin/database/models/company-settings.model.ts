import { Schema, model, models, type Document, type Model } from 'mongoose';

// Interface for static methods
export interface ICompanySettingsModel extends Model<ICompanySettings> {
  getSingleton(): Promise<ICompanySettings>;
  isEUCompany(): Promise<boolean>;
}

// EU countries for VAT purposes (ISO 3166-1 alpha-2 codes)
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

export interface ICompanySettings extends Document {
  // Company Information
  companyName: string;
  legalName: string; // Official registered name
  registrationNumber: string; // Company registration number
  
  // Address
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateProvince?: string;
  postalCode: string;
  country: string; // ISO 3166-1 alpha-2 code
  
  // Contact
  email: string;
  phone?: string;
  website?: string;
  
  // Tax Information
  vatNumber?: string; // EU VAT number (e.g., DE123456789)
  taxId?: string; // Local tax ID
  isVatRegistered: boolean;
  
  // Banking (for invoices)
  bankName?: string;
  bankAccountNumber?: string;
  bankIban?: string;
  bankSwift?: string;
  
  // Branding (linked to WhiteLabel)
  logoUrl?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const CompanySettingsSchema = new Schema<ICompanySettings>(
  {
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
  },
  {
    timestamps: true,
  }
);

// Static method to get singleton instance
CompanySettingsSchema.statics.getSingleton = async function (): Promise<ICompanySettings> {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

// Static method to check if company is in EU
CompanySettingsSchema.statics.isEUCompany = async function (): Promise<boolean> {
  const settings = await (this as ICompanySettingsModel).getSingleton();
  return EU_COUNTRIES.includes(settings.country as EUCountryCode);
};

// Helper to check if a country is in EU
export function isEUCountry(countryCode: string): boolean {
  return EU_COUNTRIES.includes(countryCode as EUCountryCode);
}

// Get country name from code
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

const CompanySettings: ICompanySettingsModel =
  (models?.CompanySettings as ICompanySettingsModel) ||
  model<ICompanySettings, ICompanySettingsModel>('CompanySettings', CompanySettingsSchema);

export default CompanySettings;

