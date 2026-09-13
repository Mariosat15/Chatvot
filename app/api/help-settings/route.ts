import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import XPConfig from "@/database/models/xp-config.model";
import TradingRiskSettings from "@/database/models/trading-risk-settings.model";
import CreditConversionSettings from "@/database/models/credit-conversion-settings.model";
import AppSettings from "@/database/models/app-settings.model";
import KYCSettings from "@/database/models/kyc-settings.model";
import InvoiceSettings from "@/database/models/invoice-settings.model";
import PaymentProvider from "@/database/models/payment-provider.model";
import { getPaymentProviderCredentials } from "@/lib/services/settings.service";
import { isPaddleConfigured } from "@/lib/paddle/config";
import { nuveiService } from "@/lib/services/nuvei.service";
import {
  getBadgeXPValues,
  getTitleLevels,
} from "@/lib/services/xp-config.service";
import { BADGE_XP_VALUES, TITLE_LEVELS } from "@/lib/constants/levels";

/**
 * GET /api/help-settings
 * Fetch all dynamic settings for the Help Center
 * Public endpoint - no authentication required
 */
export async function GET() {
  try {
    await connectToDatabase();

    // Fetch XP configuration (badge XP values and level progression)
    let badgeXP;
    let levels;

    try {
      badgeXP = await getBadgeXPValues();
      levels = await getTitleLevels();
    } catch {
      // Fallback to constants if service fails
      badgeXP = BADGE_XP_VALUES;
      levels = TITLE_LEVELS;
    }

    // Fetch trading risk settings
    const riskSettings = await TradingRiskSettings.getSingleton();

    // Fetch credit conversion settings
    const creditSettings = await CreditConversionSettings.getSingleton();

    // Fetch app settings
    const appSettingsDoc = await AppSettings.findById("app-settings").lean();
    const appSettings = appSettingsDoc || {
      currency: { code: "EUR", symbol: "€", name: "Euro" },
      credits: { name: "Credits", symbol: "⚡", valueInEUR: 1, decimals: 2 },
    };

    // Format the response
    const helpSettings = {
      // Badge XP Values
      badgeXP: badgeXP || {
        common: 10,
        rare: 25,
        epic: 50,
        legendary: 100,
      },

      // Level Progression
      levels: levels || TITLE_LEVELS,

      // Margin Levels
      margin: {
        safe: riskSettings.marginSafe || 200,
        warning: riskSettings.marginWarning || 150,
        marginCall: riskSettings.marginCall || 100,
        liquidation: riskSettings.marginLiquidation || 50,
      },

      // Leverage
      leverage: {
        min: riskSettings.minLeverage || 1,
        max: riskSettings.maxLeverage || 500,
        default: riskSettings.defaultLeverage || 10,
      },

      // Position Limits
      positions: {
        maxOpen: riskSettings.maxOpenPositions || 10,
        maxSize: riskSettings.maxPositionSize || 100,
      },

      // Risk Limits
      risk: {
        maxDrawdown: riskSettings.maxDrawdownPercent || 50,
        dailyLossLimit: riskSettings.dailyLossLimit || 20,
      },

      // Credit/Currency Settings
      // Use nullish coalescing (??) for numeric values that can legitimately be 0
      // (e.g., 0% withdrawal fee for free withdrawals, 0 minimum deposit, etc.)
      credits: {
        name: (appSettings as any)?.credits?.name || "Credits",
        symbol: (appSettings as any)?.credits?.symbol || "⚡",
        valueInEUR: (appSettings as any)?.credits?.valueInEUR ?? 1,
        eurToCreditsRate: creditSettings.eurToCreditsRate ?? 100,
        minimumDeposit: creditSettings.minimumDeposit ?? 10,
        minimumWithdrawal: creditSettings.minimumWithdrawal ?? 20,
        withdrawalFee:
          creditSettings.platformWithdrawalFeePercentage ??
          creditSettings.withdrawalFeePercentage ??
          2,
      },

      // Currency
      currency: {
        code: (appSettings as any)?.currency?.code || "EUR",
        symbol: (appSettings as any)?.currency?.symbol || "€",
        name: (appSettings as any)?.currency?.name || "Euro",
      },
    };

    // KYC settings (admin-configurable, public-safe — no Veriff keys)
    // Reason: the Help Center copy needs to tell the user *when* identity
    // verification is required so the Getting Started flow doesn't lie.
    let kyc = {
      enabled: false,
      requiredForDeposit: false,
      requiredForWithdrawal: true,
      requiredAmount: 0,
    };
    try {
      const kycSettings = await KYCSettings.findOne().lean<{
        enabled?: boolean;
        requiredForDeposit?: boolean;
        requiredForWithdrawal?: boolean;
        requiredAmount?: number;
      } | null>();
      if (kycSettings) {
        kyc = {
          enabled: kycSettings.enabled ?? false,
          requiredForDeposit: kycSettings.requiredForDeposit ?? false,
          requiredForWithdrawal: kycSettings.requiredForWithdrawal ?? true,
          requiredAmount: kycSettings.requiredAmount ?? 0,
        };
      }
    } catch {
      // Fall back to defaults declared above
    }

    // Payment provider availability — booleans only, no API keys.
    // Reason: the Getting Started step "Fund your wallet" should only list
    // methods the admin has actually enabled.
    let stripeEnabled = false;
    let nuveiEnabled = false;
    let paddleEnabled = false;
    try {
      const stripeProvider = await PaymentProvider.findOne({
        slug: "stripe",
        isActive: true,
      }).lean();
      if (stripeProvider) {
        const stripeCfg = (await getPaymentProviderCredentials(
          "stripe",
        )) as { publishable_key?: string; public_key?: string } | null;
        stripeEnabled = !!(
          stripeCfg && (stripeCfg.publishable_key || stripeCfg.public_key)
        );
      }
    } catch {
      // Stripe not configured
    }
    try {
      const nuveiCfg = await nuveiService.getClientConfig();
      nuveiEnabled = !!nuveiCfg?.enabled;
    } catch {
      // Nuvei not configured
    }
    try {
      paddleEnabled = await isPaddleConfigured();
    } catch {
      // Paddle not configured
    }

    // VAT settings (company-wide; user-specific applicability is decided
    // at deposit time by /api/payment-config, but the Help Center just
    // needs the policy the admin published).
    let vat = { enabled: false, percentage: 0 };
    try {
      const invoiceSettings = await InvoiceSettings.getSingleton();
      vat = {
        enabled: !!invoiceSettings.vatEnabled,
        percentage: invoiceSettings.vatPercentage ?? 0,
      };
    } catch {
      // Fall back to defaults
    }

    const helpSettingsFull = {
      ...helpSettings,
      kyc,
      payments: {
        stripe: stripeEnabled,
        nuvei: nuveiEnabled,
        paddle: paddleEnabled,
        anyEnabled: stripeEnabled || nuveiEnabled || paddleEnabled,
        depositFeePercentage: creditSettings.platformDepositFeePercentage ?? 0,
      },
      vat,
    };

    return NextResponse.json({
      success: true,
      settings: helpSettingsFull,
    });
  } catch (error) {
    console.error("Error fetching help settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch help settings" },
      { status: 500 },
    );
  }
}
