import { Schema, model, models, type Document } from "mongoose";

export type BillingCycle = "monthly" | "quarterly" | "yearly" | "one-time";
export type ServiceType =
  | "database"
  | "ai"
  | "email"
  | "hosting"
  | "domain"
  | "api"
  | "storage"
  | "analytics"
  | "security"
  | "other";

export interface IVendorSubscription extends Document {
  name: string; // "MongoDB Atlas", "OpenAI", etc.
  serviceType: ServiceType; // Category of service
  description?: string; // What this service is used for

  // Billing
  amount: number; // Cost per billing cycle
  currency: string; // "EUR", "USD", etc.
  billingCycle: BillingCycle; // monthly, quarterly, yearly
  nextPaymentDate: Date; // When is the next payment due
  lastPaymentDate?: Date; // When was the last payment

  // Notifications
  reminderDaysBefore: number; // Send reminder X days before payment
  reminderSent: boolean; // Has reminder been sent for current cycle

  // Status
  isActive: boolean; // Is this subscription active
  autoRenew: boolean; // Does it auto-renew

  // Vendor Details
  vendorUrl?: string; // URL to vendor dashboard/billing
  accountEmail?: string; // Email used for the account
  accountId?: string; // Account/customer ID with vendor

  // API Integration (for future use)
  apiIntegration?: {
    enabled: boolean;
    provider: "mongodb_atlas" | "openai" | "google_workspace" | "manual";
    apiKey?: string; // Encrypted
    orgId?: string;
    lastSyncAt?: Date;
  };

  // Notes
  notes?: string;

  // Payment history
  paymentHistory?: Array<{
    date: Date;
    amount: number;
    status: "paid" | "pending" | "failed";
    reference?: string;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

const VendorSubscriptionSchema = new Schema<IVendorSubscription>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    serviceType: {
      type: String,
      enum: [
        "database",
        "ai",
        "email",
        "hosting",
        "domain",
        "api",
        "storage",
        "analytics",
        "security",
        "other",
      ],
      default: "other",
    },
    description: {
      type: String,
      default: "",
    },

    // Billing
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "EUR",
      uppercase: true,
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "yearly", "one-time"],
      default: "monthly",
    },
    nextPaymentDate: {
      type: Date,
      required: true,
    },
    lastPaymentDate: {
      type: Date,
    },

    // Notifications
    reminderDaysBefore: {
      type: Number,
      default: 7,
      min: 1,
      max: 30,
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },

    // Vendor Details
    vendorUrl: {
      type: String,
      default: "",
    },
    accountEmail: {
      type: String,
      default: "",
    },
    accountId: {
      type: String,
      default: "",
    },

    // API Integration
    apiIntegration: {
      enabled: { type: Boolean, default: false },
      provider: {
        type: String,
        enum: ["mongodb_atlas", "openai", "google_workspace", "manual"],
        default: "manual",
      },
      apiKey: { type: String },
      orgId: { type: String },
      lastSyncAt: { type: Date },
    },

    // Notes
    notes: {
      type: String,
      default: "",
    },

    // Payment history
    paymentHistory: [
      {
        date: { type: Date, required: true },
        amount: { type: Number, required: true },
        status: {
          type: String,
          enum: ["paid", "pending", "failed"],
          default: "paid",
        },
        reference: { type: String },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Index for querying upcoming payments
VendorSubscriptionSchema.index({ nextPaymentDate: 1, isActive: 1 });
VendorSubscriptionSchema.index({ serviceType: 1 });

// Static method to get upcoming payments
VendorSubscriptionSchema.statics.getUpcomingPayments = async function (
  daysAhead: number = 30,
) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return this.find({
    isActive: true,
    nextPaymentDate: { $lte: futureDate },
  }).sort({ nextPaymentDate: 1 });
};

// Static method to get payments needing reminders
VendorSubscriptionSchema.statics.getPaymentsNeedingReminders =
  async function () {
    const today = new Date();

    return this.find({
      isActive: true,
      reminderSent: false,
      $expr: {
        $lte: [
          {
            $subtract: [
              "$nextPaymentDate",
              { $multiply: ["$reminderDaysBefore", 24 * 60 * 60 * 1000] },
            ],
          },
          today,
        ],
      },
    });
  };

// Instance method to calculate monthly cost
VendorSubscriptionSchema.methods.getMonthlyCost = function (): number {
  switch (this.billingCycle) {
    case "monthly":
      return this.amount;
    case "quarterly":
      return this.amount / 3;
    case "yearly":
      return this.amount / 12;
    case "one-time":
      return 0;
    default:
      return this.amount;
  }
};

// Instance method to calculate yearly cost
VendorSubscriptionSchema.methods.getYearlyCost = function (): number {
  switch (this.billingCycle) {
    case "monthly":
      return this.amount * 12;
    case "quarterly":
      return this.amount * 4;
    case "yearly":
      return this.amount;
    case "one-time":
      return 0;
    default:
      return this.amount * 12;
  }
};

// Instance method to advance to next payment date
VendorSubscriptionSchema.methods.advanceToNextPaymentDate = function () {
  const current = new Date(this.nextPaymentDate);

  switch (this.billingCycle) {
    case "monthly":
      current.setMonth(current.getMonth() + 1);
      break;
    case "quarterly":
      current.setMonth(current.getMonth() + 3);
      break;
    case "yearly":
      current.setFullYear(current.getFullYear() + 1);
      break;
    case "one-time":
      // Don't advance for one-time payments
      break;
  }

  this.nextPaymentDate = current;
  this.reminderSent = false;
  return this;
};

const VendorSubscription =
  models?.VendorSubscription ||
  model<IVendorSubscription>("VendorSubscription", VendorSubscriptionSchema);

export default VendorSubscription;
