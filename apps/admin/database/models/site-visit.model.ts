import mongoose, { Document, Schema } from "mongoose";

// ─── Interface ──────────────────────────────────────────────────────────────
export interface ISiteVisit extends Document {
  path: string;
  pageCategory: "hero" | "landing" | "app" | "auth" | "admin" | "other";
  visitorId: string;
  sessionId: string;
  ip: string;
  userAgent: string;
  referrer: string;
  country: string;
  city: string;
  region: string;
  device: "desktop" | "mobile" | "tablet" | "unknown";
  browser: string;
  os: string;
  screenResolution: string;
  language: string;
  isBot: boolean;
  botName: string;
  isSuspicious: boolean;
  suspiciousReason: string;
  searchQuery: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  userId?: mongoose.Types.ObjectId;
  duration: number;
  visitedAt: Date;
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
    sessionId: { type: String, default: "" },
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
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    duration: { type: Number, default: 0 },
    visitedAt: { type: Date, default: Date.now, index: true },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true },
);

SiteVisitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 86400 });
SiteVisitSchema.index({ visitedAt: -1, pageCategory: 1 });
SiteVisitSchema.index({ country: 1, visitedAt: -1 });
SiteVisitSchema.index({ isBot: 1, visitedAt: -1 });
SiteVisitSchema.index({ ip: 1, visitedAt: -1 });

const SiteVisit =
  (mongoose.models.SiteVisit as mongoose.Model<ISiteVisit>) ||
  mongoose.model<ISiteVisit>("SiteVisit", SiteVisitSchema);

export default SiteVisit;
