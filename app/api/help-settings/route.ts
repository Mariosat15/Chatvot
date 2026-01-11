import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import XPConfig from '@/database/models/xp-config.model';
import TradingRiskSettings from '@/database/models/trading-risk-settings.model';
import CreditConversionSettings from '@/database/models/credit-conversion-settings.model';
import AppSettings from '@/database/models/app-settings.model';
import { getBadgeXPValues, getTitleLevels } from '@/lib/services/xp-config.service';
import { BADGE_XP_VALUES, TITLE_LEVELS } from '@/lib/constants/levels';

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
    const appSettingsDoc = await AppSettings.findById('app-settings').lean();
    const appSettings = appSettingsDoc || {
      currency: { code: 'EUR', symbol: '€', name: 'Euro' },
      credits: { name: 'Credits', symbol: '⚡', valueInEUR: 1, decimals: 2 },
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
        name: (appSettings as any)?.credits?.name || 'Credits',
        symbol: (appSettings as any)?.credits?.symbol || '⚡',
        valueInEUR: (appSettings as any)?.credits?.valueInEUR ?? 1,
        eurToCreditsRate: creditSettings.eurToCreditsRate ?? 100,
        minimumDeposit: creditSettings.minimumDeposit ?? 10,
        minimumWithdrawal: creditSettings.minimumWithdrawal ?? 20,
        withdrawalFee: creditSettings.platformWithdrawalFeePercentage ?? creditSettings.withdrawalFeePercentage ?? 2,
      },

      // Currency
      currency: {
        code: (appSettings as any)?.currency?.code || 'EUR',
        symbol: (appSettings as any)?.currency?.symbol || '€',
        name: (appSettings as any)?.currency?.name || 'Euro',
      },
    };

    return NextResponse.json({
      success: true,
      settings: helpSettings,
    });
  } catch (error) {
    console.error('Error fetching help settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch help settings' },
      { status: 500 }
    );
  }
}
