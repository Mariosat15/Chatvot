import { Schema, model, models, type Document, type Model } from "mongoose";

// ─── Cookie Consent Banner Settings ──────────────────────────────────────────
// Reason: Stored in a separate collection (not WhiteLabel) because cookie
// consent is a self-contained feature with its own rich data shape. The admin
// can fully customise the banner text, categories, and behaviour from the
// Content → Cookie Consent section.

export interface CookieCategory {
  id: string;
  name: string;
  description: string;
  required: boolean; // Strictly-necessary cookies cannot be declined
  defaultEnabled: boolean;
}

export interface CookieConsentDocument extends Document {
  // ── Global toggle
  enabled: boolean;

  // ── Banner copy
  title: string;
  message: string;
  acceptAllText: string;
  rejectAllText: string;
  customizeText: string;
  savePreferencesText: string;

  // ── Cookie categories
  categories: CookieCategory[];

  // ── Links
  cookiePolicyUrl: string;
  privacyPolicyUrl: string;

  // ── Appearance
  position: "bottom" | "bottom-left" | "bottom-right";
  showDeclineButton: boolean;
  showCustomizeButton: boolean;
  backdropEnabled: boolean;

  // ── Behaviour
  autoExpireDays: number; // How many days before re-asking consent

  // Timestamps
  updatedAt: Date;
  createdAt: Date;
}

const CookieCategorySchema = new Schema<CookieCategory>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    required: { type: Boolean, default: false },
    defaultEnabled: { type: Boolean, default: false },
  },
  { _id: false },
);

const CookieConsentSchema = new Schema<CookieConsentDocument>(
  {
    enabled: { type: Boolean, default: true },

    title: { type: String, default: "We Value Your Privacy" },
    message: {
      type: String,
      default:
        "We use cookies to enhance your experience, analyse site traffic, and for security and fraud prevention. Some cookies are strictly necessary for the platform to function (authentication, session management, security tokens). By clicking \"Accept All\", you consent to our use of all cookies. You can manage your preferences or learn more in our Cookie Policy.",
    },
    acceptAllText: { type: String, default: "Accept All" },
    rejectAllText: { type: String, default: "Reject Non-Essential" },
    customizeText: { type: String, default: "Manage Preferences" },
    savePreferencesText: { type: String, default: "Save Preferences" },

    categories: {
      type: [CookieCategorySchema],
      default: [
        {
          id: "necessary",
          name: "Strictly Necessary",
          description:
            "Essential cookies for platform operation: authentication tokens, session identifiers, CSRF protection, and load-balancing cookies. These cannot be disabled.",
          required: true,
          defaultEnabled: true,
        },
        {
          id: "functional",
          name: "Functional",
          description:
            "Cookies that remember your preferences such as language, theme, chart layout, and display settings to provide a personalised experience.",
          required: false,
          defaultEnabled: true,
        },
        {
          id: "analytics",
          name: "Analytics & Performance",
          description:
            "Cookies that help us understand how visitors interact with the platform so we can measure and improve performance. Data is aggregated and anonymised.",
          required: false,
          defaultEnabled: false,
        },
        {
          id: "security",
          name: "Security & Fraud Prevention",
          description:
            "Cookies used for device fingerprinting, VPN/proxy detection, and fraud prevention to protect your account and maintain platform integrity.",
          required: true,
          defaultEnabled: true,
        },
      ],
    },

    cookiePolicyUrl: { type: String, default: "/cookie-policy" },
    privacyPolicyUrl: { type: String, default: "/privacy" },

    position: {
      type: String,
      enum: ["bottom", "bottom-left", "bottom-right"],
      default: "bottom",
    },
    showDeclineButton: { type: Boolean, default: true },
    showCustomizeButton: { type: Boolean, default: true },
    backdropEnabled: { type: Boolean, default: false },

    autoExpireDays: { type: Number, default: 365 },
  },
  { timestamps: true },
);

export const CookieConsent: Model<CookieConsentDocument> =
  (models?.CookieConsent as Model<CookieConsentDocument>) ||
  model<CookieConsentDocument>("CookieConsent", CookieConsentSchema);
