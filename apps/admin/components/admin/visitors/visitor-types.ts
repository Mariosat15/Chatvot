// ─── Types for Visitor Analytics ──────────────────────────────────────────

export interface VisitorOverview {
  totalVisits: number;
  uniqueVisitors: number;
  totalBots: number;
  totalSuspicious: number;
  totalBlocked: number;
  avgDuration: number;
  bounceRate: number;
  avgPagesPerSession: number;
  newVisitors: number;
  returningVisitors: number;
  avgScrollDepth: number;
}

export interface VisitTimeEntry {
  date: string;
  visits: number;
  unique: number;
  bots: number;
  bounceRate: number;
  avgDuration: number;
}

export interface DeviceEntry {
  device: string;
  count: number;
  percentage: number;
}

export interface BrowserEntry {
  browser: string;
  count: number;
  percentage: number;
}

export interface OSEntry {
  os: string;
  count: number;
  percentage: number;
}

export interface CountryEntry {
  country: string;
  count: number;
  percentage: number;
}

export interface CityEntry {
  city: string;
  country: string;
  count: number;
}

export interface ReferrerEntry {
  referrer: string;
  count: number;
}

export interface PageEntry {
  path: string;
  visits: number;
  unique: number;
  category: string;
  avgDuration: number;
  bounceRate: number;
}

export interface SearchQueryEntry {
  query: string;
  count: number;
}

export interface BotEntry {
  botName: string;
  count: number;
}

export interface TrafficSourceEntry {
  source: string;
  count: number;
  percentage: number;
}

export interface UTMCampaignEntry {
  campaign: string;
  source: string;
  medium: string;
  visits: number;
  unique: number;
  bounceRate: number;
}

export interface LanguageEntry {
  language: string;
  count: number;
  percentage: number;
}

export interface ResolutionEntry {
  resolution: string;
  count: number;
  percentage: number;
}

export interface HourlyHeatmapEntry {
  day: number; // 0=Sun, 6=Sat
  hour: number; // 0-23
  count: number;
}

export interface RecentVisit {
  _id: string;
  path: string;
  pageCategory: string;
  ip: string;
  country: string;
  city: string;
  device: string;
  browser: string;
  os: string;
  isBot: boolean;
  botName: string;
  isSuspicious: boolean;
  suspiciousReason: string;
  visitedAt: string;
  referrer: string;
  searchQuery: string;
  visitorId: string;
  duration: number;
  scrollDepth: number;
  trafficSource: string;
  isNewVisitor: boolean;
  language: string;
  screenResolution: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
}

export interface BlockedRule {
  _id: string;
  type: "ip" | "ip_range" | "user_agent" | "user" | "country";
  value: string;
  reason: string;
  blockedBy: string;
  blockedAt: string;
  expiresAt: string | null;
  isActive: boolean;
  hitCount: number;
  lastHitAt: string | null;
}

export interface LiveVisitor {
  _id: string;
  lastPath: string;
  lastCategory: string;
  country: string;
  device: string;
  browser: string;
  lastSeen: string;
  pageViews: number;
}

export interface LiveData {
  activeCount: number;
  liveVisitors: LiveVisitor[];
  hourlyStats: { time: string; visits: number; unique: number; bots: number }[];
  dailyStats: {
    totalVisits: number;
    uniqueVisitors: number;
    totalBots: number;
    totalSuspicious: number;
    totalBlocked: number;
  };
  recentActivity: RecentVisit[];
  topActiveCountries: CountryEntry[];
  topActivePages: { path: string; count: number }[];
}

export interface FullAnalytics {
  overview: VisitorOverview;
  visitsByTime: VisitTimeEntry[];
  deviceBreakdown: DeviceEntry[];
  browserBreakdown: BrowserEntry[];
  osBreakdown: OSEntry[];
  topCountries: CountryEntry[];
  topCities: CityEntry[];
  topReferrers: ReferrerEntry[];
  topPages: PageEntry[];
  topSearchQueries: SearchQueryEntry[];
  botStats: BotEntry[];
  trafficSources: TrafficSourceEntry[];
  utmCampaigns: UTMCampaignEntry[];
  languages: LanguageEntry[];
  resolutions: ResolutionEntry[];
  hourlyHeatmap: HourlyHeatmapEntry[];
  recentVisits: RecentVisit[];
}
