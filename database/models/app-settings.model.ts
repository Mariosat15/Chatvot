import { Schema, model, models } from "mongoose";

const AppSettingsSchema = new Schema({
  // Singleton pattern - only one document should exist
  _id: {
    type: String,
    default: "app-settings",
  },

  // Currency Settings
  currency: {
    code: {
      type: String,
      default: "EUR",
      enum: ["EUR", "USD", "GBP", "JPY", "AUD", "CAD", "CHF"],
    },
    symbol: {
      type: String,
      default: "€",
    },
    name: {
      type: String,
      default: "Euro",
    },
    exchangeRateToEUR: {
      type: Number,
      default: 1.0, // 1 EUR = X of selected currency
    },
  },

  // Credits/Virtual Currency Settings
  credits: {
    name: {
      type: String,
      default: "Volt Credits",
    },
    symbol: {
      type: String,
      default: "⚡",
    },
    icon: {
      type: String,
      default: "zap", // Lucide icon name
    },
    /*
      HISTORICAL. Stored, and read by nothing since 14 September 2026.

      The comment here used to say "Conversion: 1 credit = X EUR", and it was believed — the
      client context built `creditsToEUR` and `eurToCredits` from it, while every path that
      moves money used `CreditConversionSettings.eurToCreditsRate` instead. The two defaults
      disagreed by a factor of a hundred, so a wallet balance and a withdrawal quoted
      different euro figures for the same credits.

      // Reason: the field is kept rather than dropped because an operator may have typed a
      // deliberate value into it, and because removing it is a mirrored migration for a
      // cosmetic gain. Both `/api/settings` routes now serve a value DERIVED from the rate
      // and the admin PUT refuses to write this path. See `lib/utils/credit-value.ts`.
    */
    valueInEUR: {
      type: Number,
      default: 1.0,
    },
    // Display settings
    showEUREquivalent: {
      type: Boolean,
      default: true,
    },
    decimals: {
      type: Number,
      default: 2,
    },
  },

  // Transaction Limits & Fees
  transactions: {
    minimumDeposit: {
      type: Number,
      default: 10, // Minimum EUR/currency deposit
      min: 1,
    },
    maximumDeposit: {
      type: Number,
      default: 10000, // Maximum EUR/currency deposit (AML ceiling)
      min: 1,
    },
    minimumWithdrawal: {
      type: Number,
      default: 20, // Minimum EUR/currency withdrawal
      min: 1,
    },
    withdrawalFeePercentage: {
      type: Number,
      default: 2, // Withdrawal fee percentage
      min: 0,
      max: 20,
    },
  },

  // Branding
  branding: {
    primaryColor: {
      type: String,
      default: "#EAB308", // yellow-500
    },
    accentColor: {
      type: String,
      default: "#F59E0B", // yellow-600
    },
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

AppSettingsSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

const AppSettings =
  models.AppSettings || model("AppSettings", AppSettingsSchema);

export default AppSettings;
