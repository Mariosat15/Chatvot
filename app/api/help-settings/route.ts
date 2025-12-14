import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/connection';
import XPConfig from '@/database/models/xp-config.model';
import TradingRiskSettings from '@/database/models/trading-risk-settings.model';
import CreditConversionSettings from '@/database/models/credit-conversion-settings.model';
import AppSettings from '@/database/models/app-settings.model';
import { getXPConfigFromDB, seedDefaultXPConfig, seedDefaultLevelProgression } from '@/lib/services/xp-config.service';

/**
 * GET /api/help-settings
 * Fetch all dynamic settings for the Help Center
 * Public endpoint - no authentication required
 */
export async function GET() {
  try {
    await connectToDatabase();

    // Fetch XP configuration (badge XP values and level progression)
    let xpConfig = await getXPConfigFromDB();
    
    // If no XP config exists, seed defaults
    if (!xpConfig.badgeXP) {
      await seedDefaultXPConfig();
      xpConfig = await getXPConfigFromDB();
    }
    if (!xpConfig.levels || xpConfig.levels.length === 0) {
      await seedDefaultLevelProgression();
      xpConfig = await getXPConfigFromDB();
    }

    // Fetch trading risk settings
    const riskSettings = await TradingRiskSettings.getSingleton();

    // Fetch credit conversion settings
    const creditSettings = await CreditConversionSettings.getSingleton();

    // Fetch app settings
    let appSettings = await AppSettings.findById('app-settings').lean();
    if (!appSettings) {
      // Create default app settings if none exist
      appSettings = {
        currency: { code: 'EUR', symbol: '€', name: 'Euro' },
        credits: { name: 'Credits', symbol: '⚡', valueInEUR: 1, decimals: 2 },
      };
    }

    // Format the response
    const helpSettings = {
      // Badge XP Values
      badgeXP: xpConfig.badgeXP || {
        common: 10,
        rare: 25,
        epic: 50,
        legendary: 100,
      },

      // Level Progression
      levels: xpConfig.levels || [
        { level: 1, title: 'Novice Trader', minXP: 0, icon: '🌱', color: 'text-gray-400' },
        { level: 2, title: 'Apprentice Trader', minXP: 100, icon: '📚', color: 'text-green-400' },
        { level: 3, title: 'Skilled Trader', minXP: 300, icon: '⚔️', color: 'text-blue-400' },
        { level: 4, title: 'Expert Trader', minXP: 600, icon: '🎯', color: 'text-cyan-400' },
        { level: 5, title: 'Elite Trader', minXP: 1000, icon: '💎', color: 'text-purple-400' },
        { level: 6, title: 'Master Trader', minXP: 1600, icon: '👑', color: 'text-pink-400' },
        { level: 7, title: 'Grand Master', minXP: 2400, icon: '🔥', color: 'text-orange-400' },
        { level: 8, title: 'Trading Champion', minXP: 3400, icon: '⚡', color: 'text-red-400' },
        { level: 9, title: 'Market Legend', minXP: 4600, icon: '🌟', color: 'text-yellow-400' },
        { level: 10, title: 'Trading God', minXP: 6000, icon: '👑', color: 'text-yellow-300' },
      ],

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
      credits: {
        name: (appSettings as any)?.credits?.name || 'Credits',
        symbol: (appSettings as any)?.credits?.symbol || '⚡',
        valueInEUR: (appSettings as any)?.credits?.valueInEUR || 1,
        eurToCreditsRate: creditSettings.eurToCreditsRate || 100,
        minimumDeposit: creditSettings.minimumDeposit || 10,
        minimumWithdrawal: creditSettings.minimumWithdrawal || 20,
        withdrawalFee: creditSettings.platformWithdrawalFeePercentage || creditSettings.withdrawalFeePercentage || 2,
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

