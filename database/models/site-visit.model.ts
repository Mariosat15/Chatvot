import mongoose, { Document, Schema } from "mongoose";

// ─── Interface ──────────────────────────────────────────────────────────────
export interface ISiteVisit extends Document {
  /** Full page path (e.g. "/", "/competitions", "/lp/abc123") */
  path: string;
  /** Page category for grouping: hero, landing, app, auth, other */
  pageCategory: "hero" | "landing" | "app" | "auth" | "admin" | "other";
  /** Visitor fingerprint (IP + UA hash) for unique counting */
  visitorId: string;
  /** Unique session identifier (persistent across page views in same session) */
  sessionId: string;
  /** IP address */
  ip: string;
  /** Raw user agent string (truncated to 500 chars) */
  userAgent: string;
  /** Referrer URL */
  referrer: string;
  /** 2-letter country code from Cloudflare or geo-IP */
  country: string;
  /** City from Cloudflare or geo-IP */
  city: string;
  /** Region / state */
  region: string;
  /** Device type */
  device: "desktop" | "mobile" | "tablet" | "unknown";
  /** Browser name */
  browser: string;
  /** OS name */
  os: string;
  /** Screen resolution (e.g. "1920x1080") */
  screenResolution: string;
  /** Language from Accept-Language header */
  language: string;
  /** Whether this is a known bot */
  isBot: boolean;
  /** Bot name if detected (e.g. "Googlebot", "Bingbot") */
  botName: string;
  /** Whether this visit is flagged as suspicious */
  isSuspicious: boolean;
  /** Reason for flagging */
  suspiciousReason: string;
  /** Search query if arriving from a search engine */
  searchQuery: string;
  /** UTM parameters */
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  /** Traffic source category: direct, organic, social, referral, paid, email, campaign */
  trafficSource: string;
  /** Whether this is a first-time visitor (never seen before) */
  isNewVisitor: boolean;
  /** Number of pages viewed in this session so far */
  sessionPageCount: number;
  /** Network connection type (e.g. "4g", "3g", "wifi") */
  connectionType: string;
  /** Scroll depth percentage (0-100) — updated via engagement beacon */
  scrollDepth: number;
  /** Authenticated user ID (if logged in) */
  userId?: mongoose.Types.ObjectId;
  /** Duration on page in seconds (updated via engagement beacon) */
  duration: number;
  /** Timestamp of visit */
  visitedAt: Date;
  /** Whether visitor is blocked */
  isBlocked: boolean;
  createdAt: Date;
}

// ─── Schema ─────────────────────────────────────────────────────────────────
const SiteVisitSchema = new Schema<ISiteVisit>(
  {
    path: { type: String, required: true, index: true },
    pageCategory: {
      type: String,
      enum: ["hero", "landing", "app", "auth", "admin", "other"],
      default: "other",
      index: true,
    },
    visitorId: { type: String, default: "", index: true },
    sessionId: { type: String, default: "", index: true },
    ip: { type: String, default: "", index: true },
    userAgent: { type: String, default: "" },
    referrer: { type: String, default: "" },
    country: { type: String, default: "", index: true },
    city: { type: String, default: "" },
    region: { type: String, default: "" },
    device: {
      type: String,
      enum: ["desktop", "mobile", "tablet", "unknown"],
      default: "unknown",
    },
    browser: { type: String, default: "" },
    os: { type: String, default: "" },
    screenResolution: { type: String, default: "" },
    language: { type: String, default: "" },
    isBot: { type: Boolean, default: false, index: true },
    botName: { type: String, default: "" },
    isSuspicious: { type: Boolean, default: false },
    suspiciousReason: { type: String, default: "" },
    searchQuery: { type: String, default: "" },
    utmSource: { type: String, default: "" },
    utmMedium: { type: String, default: "" },
    utmCampaign: { type: String, default: "" },
    utmTerm: { type: String, default: "" },
    utmContent: { type: String, default: "" },
    trafficSource: { type: String, default: "direct", index: true },
    isNewVisitor: { type: Boolean, default: false },
    sessionPageCount: { type: Number, default: 1 },
    connectionType: { type: String, default: "" },
    scrollDepth: { type: Number, default: 0 },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    duration: { type: Number, default: 0 },
    visitedAt: { type: Date, default: Date.now, index: true },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Reason: TTL index — auto-delete visits older than 1 year to keep DB lean
SiteVisitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 86400 });

// Reason: Compound indexes for analytics aggregation queries
SiteVisitSchema.index({ visitedAt: -1, pageCategory: 1 });
SiteVisitSchema.index({ country: 1, visitedAt: -1 });
SiteVisitSchema.index({ isBot: 1, visitedAt: -1 });
SiteVisitSchema.index({ ip: 1, visitedAt: -1 });
SiteVisitSchema.index({ sessionId: 1, path: 1 }); // For engagement updates
SiteVisitSchema.index({ trafficSource: 1, visitedAt: -1 }); // For source analytics

const SiteVisit =
  (mongoose.models.SiteVisit as mongoose.Model<ISiteVisit>) ||
  mongoose.model<ISiteVisit>("SiteVisit", SiteVisitSchema);

export default SiteVisit;
