/**
 * Dynamic Knowledge Base Generator
 * 
 * Generates customer FAQ content with ACTUAL values from database settings.
 * This ensures white-label platforms get correct info (Volts, Credits, Coins, etc.)
 */

import { connectToDatabase } from '@/database/mongoose';

// Import models - use dynamic imports for compatibility
async function getSettings() {
  await connectToDatabase();
  
  // Dynamic imports to avoid circular dependencies
  const mongoose = await import('mongoose');
  const db = mongoose.default.connection.db;
  
  if (!db) {
    throw new Error('Database not connected');
  }
  
  // Fetch app settings
  const appSettingsDoc = await db.collection('appsettings').findOne({ _id: 'app-settings' as any });
  const appSettings: any = appSettingsDoc || {
    currency: { code: 'EUR', symbol: '€', name: 'Euro' },
    credits: { name: 'Credits', symbol: '⚡', valueInEUR: 1, decimals: 2 },
  };
  
  // Fetch credit conversion settings
  const creditSettingsDoc = await db.collection('creditconversionsettings').findOne({});
  const creditSettings: any = creditSettingsDoc || {
    eurToCreditsRate: 100,
    minimumDeposit: 10,
    minimumWithdrawal: 20,
    platformWithdrawalFeePercentage: 2,
    withdrawalFeePercentage: 2,
  };
  
  // Fetch trading risk settings
  const riskSettingsDoc = await db.collection('tradingrisksettings').findOne({});
  const riskSettings: any = riskSettingsDoc || {
    marginSafe: 200,
    marginWarning: 150,
    marginCall: 100,
    marginLiquidation: 50,
    minLeverage: 1,
    maxLeverage: 500,
    defaultLeverage: 10,
    maxOpenPositions: 10,
    maxPositionSize: 100,
    maxDrawdownPercent: 50,
    dailyLossLimit: 20,
  };
  
  // Fetch XP/badge settings
  const xpConfigDoc = await db.collection('xpconfigs').findOne({});
  const xpConfig: any = xpConfigDoc || {
    badgeXP: { common: 10, rare: 25, epic: 50, legendary: 100 },
  };
  
  return {
    // Credits/Currency (e.g., "Volts", "Credits", "Coins")
    creditName: appSettings?.credits?.name || 'Credits',
    creditSymbol: appSettings?.credits?.symbol || '⚡',
    currencyCode: appSettings?.currency?.code || 'EUR',
    currencySymbol: appSettings?.currency?.symbol || '€',
    currencyName: appSettings?.currency?.name || 'Euro',
    
    // Conversion rates
    conversionRate: creditSettings?.eurToCreditsRate || 100,
    minDeposit: creditSettings?.minimumDeposit || 10,
    minWithdrawal: creditSettings?.minimumWithdrawal || 20,
    withdrawalFee: creditSettings?.platformWithdrawalFeePercentage || creditSettings?.withdrawalFeePercentage || 2,
    
    // Trading/Risk
    marginSafe: riskSettings?.marginSafe || 200,
    marginWarning: riskSettings?.marginWarning || 150,
    marginCall: riskSettings?.marginCall || 100,
    marginLiquidation: riskSettings?.marginLiquidation || 50,
    minLeverage: riskSettings?.minLeverage || 1,
    maxLeverage: riskSettings?.maxLeverage || 500,
    defaultLeverage: riskSettings?.defaultLeverage || 10,
    maxOpenPositions: riskSettings?.maxOpenPositions || 10,
    maxPositionSize: riskSettings?.maxPositionSize || 100,
    maxDrawdown: riskSettings?.maxDrawdownPercent || 50,
    dailyLossLimit: riskSettings?.dailyLossLimit || 20,
    
    // XP
    badgeXP: xpConfig?.badgeXP || { common: 10, rare: 25, epic: 50, legendary: 100 },
  };
}

/**
 * Generate dynamic customer FAQ content
 * All values are pulled from database settings
 */
export async function generateCustomerKnowledgeBase(): Promise<string> {
  const s = await getSettings();
  
  return `
# Customer Support Knowledge Base
## Frequently Asked Questions

This document contains answers to common questions about our trading competition platform.

---

# Getting Started

## What is this platform?
This is a trading competition platform where you can compete against other traders using virtual capital. You deposit real money to get ${s.creditName}, enter trading competitions or 1v1 challenges, trade with virtual capital, and win real prizes based on your performance. It's a skill-based platform where you can prove your trading abilities without risking your own capital during trades.

## How do I create an account?
To create an account:
1. Click "Sign Up" on the homepage
2. Enter your email address and create a password
3. Verify your email by clicking the link we send you
4. Complete your profile information
5. You're ready to start! You can deposit ${s.creditName.toLowerCase()} and join competitions.

## Is my personal information safe?
Yes, your personal information is protected using industry-standard encryption. We comply with data protection regulations and never share your personal information with third parties without your consent. All financial transactions are processed through secure, PCI-compliant payment providers.

---

# ${s.creditName} & Wallet

## What are ${s.creditName}?
${s.creditName} (${s.creditSymbol}) are our platform currency. When you deposit real money (${s.currencyCode}), it's converted to ${s.creditName} at a fixed rate. The standard conversion rate is ${s.currencySymbol}1 = ${s.conversionRate} ${s.creditName}. You use ${s.creditName} to:
- Pay entry fees for competitions
- Join 1v1 challenges against other traders
- Purchase items in the marketplace
Your winnings are also paid in ${s.creditName}, which you can withdraw as real money.

## What are credits?
Credits and ${s.creditName} are the same thing! "Credits" is a generic term that refers to the platform currency. On this platform, they are called "${s.creditName}" (${s.creditSymbol}).

## What's the difference between ${s.creditName} and trading capital?
- **${s.creditName}**: Real money converted to platform currency. Used to pay entry fees. Can be deposited and withdrawn.
- **Trading Capital**: Virtual money you receive when entering a competition. This is what you trade with during competitions. Trading capital cannot be withdrawn - only prizes from winning competitions are converted to ${s.creditName} and added to your wallet.

## How do I check my ${s.creditName} balance?
Go to your Wallet page or look at the header bar - your current ${s.creditName} balance (${s.creditSymbol}) is always displayed there.

## Why did my ${s.creditName} balance change?
Your ${s.creditName} balance changes when you:
- Make a deposit (increases) - ${s.currencySymbol}${s.minDeposit} deposit = ${s.minDeposit * s.conversionRate} ${s.creditName}
- Enter a competition (decreases by entry fee)
- Win a competition (increases by prize amount in ${s.creditName})
- Make a withdrawal (decreases)
- Receive a refund (increases)
Check your transaction history in the Wallet section for details.

## Can I transfer ${s.creditName} to another user?
No, ${s.creditName} cannot be transferred between users. Each account's ${s.creditName} are tied to that specific account for security and regulatory reasons.

---

# Deposits & Withdrawals

## How do I deposit money?
To deposit:
1. Go to your Wallet or click "Deposit"
2. Select your preferred payment method (card, bank transfer, etc.)
3. Enter the amount you wish to deposit (minimum ${s.currencySymbol}${s.minDeposit})
4. Complete the payment through our secure payment provider
5. ${s.creditName} will be added to your wallet instantly (or within 1-2 business days for bank transfers)

## What is the minimum deposit amount?
The minimum deposit amount is ${s.currencySymbol}${s.minDeposit}. This gives you ${s.minDeposit * s.conversionRate} ${s.creditName}.

## How long do deposits take?
- Card payments: Usually instant
- Bank transfers: 1-3 business days
- E-wallets: Usually instant
You'll receive a notification when your deposit is confirmed.

## How do I withdraw my winnings?
To withdraw:
1. Go to your Wallet and click "Withdraw"
2. Enter the amount you wish to withdraw (minimum ${s.currencySymbol}${s.minWithdrawal})
3. Select your withdrawal method
4. Confirm the withdrawal request
5. Funds will be processed within 1-5 business days depending on the method

## What is the minimum withdrawal amount?
The minimum withdrawal amount is ${s.currencySymbol}${s.minWithdrawal}. This ensures that transaction fees don't consume a large portion of small withdrawals.

## Are there any fees for withdrawals?
Withdrawal fees are ${s.withdrawalFee}% of the withdrawal amount. Deposits are generally free. Any applicable fees will be clearly displayed before you confirm the transaction.

## Why is my withdrawal pending?
Withdrawals may be pending for several reasons:
- First-time withdrawals require identity verification (KYC)
- Large withdrawals may require additional security checks
- Bank processing times
- Weekend/holiday delays
If your withdrawal is pending for more than 5 business days, please contact support.

---

# Competitions

## How do trading competitions work?
1. Browse available competitions and choose one that interests you
2. Pay the entry fee in ${s.creditName}
3. Receive virtual trading capital when the competition starts
4. Trade during the competition period to maximize your returns
5. At the end, participants are ranked by performance
6. Winners receive prizes from the prize pool in ${s.creditName}

## What trading instruments can I trade?
Depending on the competition, you can trade:
- Forex (currency pairs like EUR/USD, GBP/JPY)
- Stocks (major company shares)
- Cryptocurrencies (BTC, ETH, etc.)
- Indices (S&P 500, NASDAQ, etc.)
- Commodities (Gold, Oil, etc.)
Each competition will specify which instruments are available.

## How is the winner determined?
Winners are typically determined by:
- **Profit & Loss (P&L)**: Total profit made during the competition
- **Return on Investment (ROI)**: Percentage return on starting capital
- **Risk-adjusted returns**: Some competitions factor in risk management
The ranking method is always displayed in the competition details before you join.

## What happens if I get liquidated?
If your losses reach the liquidation threshold (margin below ${s.marginLiquidation}%), you're eliminated from that competition. You won't be able to place new trades, but you may still be ranked based on when you were liquidated.

## How can someone get disqualified from a competition?
You can get disqualified for:
1. **Liquidation**: If your margin drops below ${s.marginLiquidation}%, you're automatically eliminated
2. **Minimum trade requirements**: Some competitions require a minimum number of trades
3. **Rule violations**: Using automated trading bots, market manipulation, or other prohibited activities
4. **Account issues**: Having an unverified account or suspicious activity
5. **Technical violations**: Opening positions outside allowed trading hours or instruments

## Can I join multiple competitions at once?
Yes! You can participate in multiple competitions simultaneously. Each competition is independent with its own trading capital and results.

## What is the prize distribution?
Prize distribution varies by competition but typically:
- 1st place: 50-70% of prize pool
- 2nd place: 20-30% of prize pool
- 3rd place: 10-15% of prize pool
The exact distribution is shown in each competition's details.

## When do I receive my prize?
Prizes are automatically credited to your wallet in ${s.creditName} when the competition ends and results are finalized. This usually happens within a few minutes to a few hours after the competition ends.

---

# 1v1 Challenges

## What are 1v1 challenges?
1v1 challenges are head-to-head trading battles between two traders. You challenge another user (or accept a challenge), both pay an entry fee in ${s.creditName}, and compete over a set period. The trader with the better performance wins the combined prize pool.

## How do I challenge someone?
1. Go to the Leaderboard or Matchmaking section
2. Find a user you want to challenge
3. Click "Challenge"
4. Select the challenge parameters (entry fee, duration, etc.)
5. Wait for them to accept
Once accepted, the challenge begins at the scheduled time.

## What if my opponent doesn't accept?
Challenges have an expiration time. If your opponent doesn't accept within that time, the challenge is cancelled and any reserved ${s.creditName} are returned to your wallet.

---

# Trading

## What leverage is available?
Leverage ranges from ${s.minLeverage}x to ${s.maxLeverage}x. The default leverage is ${s.defaultLeverage}x. Specific competitions may have different leverage limits - always check the competition rules.

## Are there any trading restrictions?
Some competitions may have restrictions like:
- Maximum ${s.maxOpenPositions} open positions at a time
- Maximum position size of ${s.maxPositionSize} lots
- Daily loss limit of ${s.dailyLossLimit}%
- Maximum drawdown of ${s.maxDrawdown}%
These rules are always displayed in the competition details before you join.

## How do I place a trade?
1. Open the trading interface
2. Select your instrument (e.g., EUR/USD)
3. Choose your position size
4. Click "Buy" (if you think price will go up) or "Sell" (if you think price will go down)
5. Set optional stop-loss and take-profit levels
6. Confirm your trade

## What is the spread?
The spread is the difference between the buy and sell price. Our spreads are competitive and vary by instrument. Tighter spreads are generally available during peak trading hours.

## Can I use automated trading or bots?
Automated trading and bots are generally not allowed in competitions as they provide an unfair advantage. Using such tools may result in disqualification and account suspension.

---

# Risk Management

## What are the margin levels?
- **Safe Zone**: Above ${s.marginSafe}% - Account is healthy
- **Warning Zone**: ${s.marginWarning + 1}% - ${s.marginSafe}% - Consider reducing positions
- **Margin Call**: ${s.marginCall + 1}% - ${s.marginWarning}% - Danger! Close positions or risk liquidation
- **Liquidation**: Below ${s.marginLiquidation}% - All positions automatically closed

## How can I avoid liquidation?
- Never risk more than ${s.dailyLossLimit}% of capital daily
- Always use Stop Loss orders
- Keep maximum ${s.maxOpenPositions} positions open
- Stay above ${s.marginSafe}% margin level
- Monitor your positions regularly

---

# Account & Security

## How do I verify my account (KYC)?
To verify your account:
1. Go to Settings > Verification
2. Upload a valid government-issued ID (passport, driver's license, or national ID)
3. Take a selfie for facial verification
4. Wait for our team to review (usually within 24 hours)
Verification is required for withdrawals and ensures platform security.

## I forgot my password. How do I reset it?
1. Click "Forgot Password" on the login page
2. Enter your email address
3. Check your email for a reset link
4. Click the link and create a new password
If you don't receive the email, check your spam folder or contact support.

## How do I enable two-factor authentication (2FA)?
1. Go to Settings > Security
2. Click "Enable 2FA"
3. Scan the QR code with an authenticator app (Google Authenticator, Authy, etc.)
4. Enter the code to confirm
2FA adds an extra layer of security to your account.

---

# Technical Issues

## The charts aren't loading. What should I do?
Try these steps:
1. Refresh the page
2. Clear your browser cache
3. Try a different browser
4. Check your internet connection
5. Disable browser extensions that might interfere
If the issue persists, contact support with your browser type and any error messages.

## My trade didn't execute. What happened?
Trades may not execute if:
- Market was closed
- Price moved too fast (slippage)
- Insufficient margin/capital
- Connection issues
Check your trade history and open positions. If you believe there's an error, contact support with the trade details.

---

# Contact & Support

If your question isn't answered here, you can:
- Use the chat to speak with our AI assistant or request a human agent
- Check our full documentation in the Help section

Our support team is available to help you with any questions or issues you may have!
`;
}

/**
 * Get a summary of current settings for logging
 */
export async function getSettingsSummary(): Promise<string> {
  const s = await getSettings();
  return `Currency: ${s.creditName} (${s.creditSymbol}), Rate: ${s.currencySymbol}1 = ${s.conversionRate} ${s.creditName}, Min Deposit: ${s.currencySymbol}${s.minDeposit}`;
}
