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
  avgDuration: number;
}

export interface VisitTimeData {
  date: string;
  visits: number;
  uniqueVisitors: number;
  conversions: number;
}

export interface DeviceData {
  device: string;
  count: number;
}

export interface CountryData {
  country: string;
  count: number;
}

export interface ConversionData {
  trackingId: string;
  pageName: string;
  campaign: string;
  source: string;
  visits: number;
  conversions: number;
  conversionRate: number;
}

export type AdminView = "list" | "templates" | "editor" | "analytics" | "create";
