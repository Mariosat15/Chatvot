import mongoose, { Document, Schema } from "mongoose";

// ─── Main Interface ─────────────────────────────────────────────────────────
export interface ILandingPageVisit extends Document {
  /** Reference to the LandingPage */
  landingPageId: mongoose.Types.ObjectId;
  /** Denormalized tracking ID for fast lookups */
  trackingId: string;
  /** Visitor identification */
  visitorId: string; // Browser fingerprint or session ID
  sessionId: string; // Unique per visit
  /** Network info */
  ip: string;
  /** Request metadata */
  userAgent: string;
  referrer: string;
  /** Geo info (parsed from IP) */
  country?: string;
  city?: string;
  region?: string;
  /** Device info (parsed from UA) */
  device: "desktop" | "mobile" | "tablet" | "unknown";
  browser?: string;
  os?: string;
  /** UTM parameters */
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  /** Timing */
  enteredAt: Date;
  /** Where the visitor navigated to (null = bounced) */
  exitPath?: string;
  /** Duration on page in seconds */
  duration?: number;
  /** Conversion tracking */
  converted: boolean; // Did they sign up?
  userId?: mongoose.Types.ObjectId; // If they subsequently signed up
  createdAt: Date;
}

// ─── Schema ─────────────────────────────────────────────────────────────────
const LandingPageVisitSchema = new Schema<ILandingPageVisit>(
  {
    landingPageId: {
      type: Schema.Types.ObjectId,
      ref: "LandingPage",
      required: true,
      index: true,
    },
    trackingId: { type: String, required: true, index: true },
    visitorId: { type: String, default: "" },
    sessionId: { type: String, default: "" },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    referrer: { type: String, default: "" },
    country: { type: String, default: "" },
    city: { type: String, default: "" },
    region: { type: String, default: "" },
    device: {
      type: String,
      enum: ["desktop", "mobile", "tablet", "unknown"],
      default: "unknown",
    },
    browser: { type: String, default: "" },
    os: { type: String, default: "" },
    utmSource: { type: String, default: "" },
    utmMedium: { type: String, default: "" },
    utmCampaign: { type: String, default: "" },
    utmTerm: { type: String, default: "" },
    utmContent: { type: String, default: "" },
    enteredAt: { type: Date, default: Date.now },
    exitPath: { type: String, default: null },
    duration: { type: Number, default: 0 },
    converted: { type: Boolean, default: false },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

// Reason: TTL index to auto-delete visits older than 1 year (configurable)
// Keep recent data fast, archive old data
LandingPageVisitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 86400 });

// Reason: Compound indexes for analytics aggregation queries
LandingPageVisitSchema.index({ trackingId: 1, enteredAt: -1 });
LandingPageVisitSchema.index({ landingPageId: 1, enteredAt: -1 });
LandingPageVisitSchema.index({ trackingId: 1, visitorId: 1 }); // For unique visitor counting
LandingPageVisitSchema.index({ converted: 1, trackingId: 1 }); // Conversion queries

const LandingPageVisit =
  (mongoose.models.LandingPageVisit as mongoose.Model<ILandingPageVisit>) ||
  mongoose.model<ILandingPageVisit>(
    "LandingPageVisit",
    LandingPageVisitSchema,
  );

export default LandingPageVisit;
