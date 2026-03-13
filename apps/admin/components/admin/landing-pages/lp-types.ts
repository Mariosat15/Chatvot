// ─── Landing Pages Admin Types ──────────────────────────────────────────────

export interface LPSection {
  id: string;
  type: string;
  order: number;
  enabled: boolean;
  content: Record<string, unknown>;
}

export interface LandingPageData {
  _id: string;
  name: string;
  trackingId: string;
  templateSlug?: string;
  sections: LPSection[];
  customCss?: string;
  campaign: string;
  source: string;
  assignedTo: string;
  isActive: boolean;
  showRiskDisclaimer: boolean;
  totalVisits: number;
  uniqueVisitors: number;
  totalSignups: number;
  seoTitle: string;
  seoDescription: string;
  createdAt: string;
  updatedAt: string;
}

export interface LPTemplate {
  _id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  thumbnailUrl: string;
  sections: LPSection[];
  isSystem: boolean;
  isActive: boolean;
}

export interface AnalyticsOverview {
  totalVisits: number;
  uniqueVisitors: number;
  totalConversions: number;
  conversionRate: number;
  avgDuration: number;
  bounceRate: number;
}

export interface VisitTimeData {
  date: string;
  visits: number;
  uniqueVisitors: number;
  conversions: number;
  avgDuration: number;
  conversionRate: number;
}

export interface DeviceData {
  device: string;
  count: number;
  percentage: number;
}

export interface BrowserData {
  browser: string;
  count: number;
  percentage: number;
}

export interface OSData {
  os: string;
  count: number;
  percentage: number;
}

export interface CountryData {
  country: string;
  count: number;
  percentage?: number;
}

export interface CityData {
  city: string;
  country: string;
  count: number;
}

export interface ReferrerData {
  referrer: string;
  count: number;
}

export interface UTMSourceData {
  source: string;
  count: number;
}

export interface UTMCampaignData {
  campaign: string;
  source: string;
  medium: string;
  visits: number;
  conversions: number;
  conversionRate: number;
}

export interface ConversionData {
  trackingId: string;
  pageName: string;
  campaign: string;
  source: string;
  visits: number;
  conversions: number;
  conversionRate: number;
  avgDuration: number;
}

export interface LPFullAnalytics {
  overview: AnalyticsOverview;
  visitsByTime: VisitTimeData[];
  deviceBreakdown: DeviceData[];
  browserBreakdown: BrowserData[];
  osBreakdown: OSData[];
  topCountries: CountryData[];
  topCities: CityData[];
  topReferrers: ReferrerData[];
  utmSourceBreakdown: UTMSourceData[];
  utmCampaignBreakdown: UTMCampaignData[];
  conversionData: ConversionData[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recentVisits: any[];
}

export type AdminView = "list" | "templates" | "editor" | "analytics" | "create" | "ai-enhance" | "ai-generate";
