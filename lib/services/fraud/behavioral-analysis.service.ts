import TradingBehaviorProfile, { 
  ITradingBehaviorProfile, 
  ITradingPattern, 
  IRecentTrade 
} from '@/database/models/fraud/trading-behavior-profile.model';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

/**
 * Behavioral Analysis Service
 * 
 * Analyzes and tracks user trading patterns for fraud detection
 * Creates behavioral fingerprints for similarity comparison
 */

interface TradeData {
  tradeId: string;
  pair: string;
  direction: 'buy' | 'sell';
  openTime: Date;
  closeTime?: Date;
  lotSize: number;
  pnl?: number;
  pips?: number;
  stopLoss?: number;
  takeProfit?: number;
  entryPrice?: number;
  exitPrice?: number;
}

export class BehavioralAnalysisService {
  
  /**
   * Get or create trading behavior profile for a user
   */
  static async getOrCreateProfile(userId: string): Promise<ITradingBehaviorProfile> {
    await connectToDatabase();
    
    let profile = await TradingBehaviorProfile.findOne({ userId });
    
    if (!profile) {
      profile = await TradingBehaviorProfile.create({
        userId,
        patterns: {},
        behavioralFingerprint: Array(32).fill(0),
        recentTradeSequence: [],
        mirrorTradingSuspects: [],
        competitionEntryTimes: []
      });
      console.log(`✅ Created new trading behavior profile for user ${userId}`);
    }
    
    return profile;
  }
  
  /**
   * Update profile when a trade is closed
   */
  static async updateProfileOnTrade(userId: string, trade: TradeData): Promise<void> {
    await connectToDatabase();
    
    console.log(`📊 Updating trading profile for user ${userId} - Trade: ${trade.pair} ${trade.direction}`);
    
    const profile = await this.getOrCreateProfile(userId);
    
    // Calculate trade duration
    const duration = trade.closeTime && trade.openTime
      ? (trade.closeTime.getTime() - trade.openTime.getTime()) / (1000 * 60) // minutes
      : 0;
    
    // Add to recent trade sequence
    const recentTrade: IRecentTrade = {
      tradeId: trade.tradeId,
      pair: trade.pair,
      direction: trade.direction,
      openTime: trade.openTime,
      closeTime: trade.closeTime,
      duration,
      lotSize: trade.lotSize,
      pnl: trade.pnl,
      pips: trade.pips,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit
    };
    
    profile.recentTradeSequence.push(recentTrade);
    profile.totalTradesAnalyzed += 1;
    
    // Recalculate patterns based on recent trades
    await this.recalculatePatterns(profile);
    
    // Generate new behavioral fingerprint
    await this.generateBehavioralFingerprint(profile);
    
    profile.lastUpdated = new Date();
    await profile.save();
    
    console.log(`✅ Profile updated. Total trades analyzed: ${profile.totalTradesAnalyzed}`);
  }
  
  /**
   * Recalculate trading patterns from recent trades
   */
  private static async recalculatePatterns(profile: ITradingBehaviorProfile): Promise<void> {
    const trades = profile.recentTradeSequence;
    if (trades.length === 0) return;
    
    const patterns: Partial<ITradingPattern> = {};
    
    // Calculate preferred pairs
    const pairCounts: Record<string, number> = {};
    trades.forEach(t => {
      pairCounts[t.pair] = (pairCounts[t.pair] || 0) + 1;
    });
    patterns.preferredPairs = Object.entries(pairCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pair]) => pair);
    
    // Calculate trading hours distribution
    const hourDistribution = Array(24).fill(0);
    trades.forEach(t => {
      const hour = new Date(t.openTime).getUTCHours();
      hourDistribution[hour] += 1;
    });
    // Normalize
    const totalHours = hourDistribution.reduce((a, b) => a + b, 0);
    patterns.tradingHoursDistribution = hourDistribution.map(h => h / Math.max(totalHours, 1));
    
    // Calculate averages
    const closedTrades = trades.filter(t => t.closeTime);
    
    patterns.avgTradeSize = trades.reduce((sum, t) => sum + t.lotSize, 0) / trades.length;
    
    patterns.avgTradeDuration = closedTrades.length > 0
      ? closedTrades.reduce((sum, t) => sum + (t.duration || 0), 0) / closedTrades.length
      : 0;
    
    // Calculate SL/TP averages (only for trades with SL/TP)
    const tradesWithSL = trades.filter(t => t.stopLoss && t.stopLoss > 0);
    const tradesWithTP = trades.filter(t => t.takeProfit && t.takeProfit > 0);
    
    patterns.avgStopLoss = tradesWithSL.length > 0
      ? tradesWithSL.reduce((sum, t) => sum + (t.stopLoss || 0), 0) / tradesWithSL.length
      : 0;
    
    patterns.avgTakeProfit = tradesWithTP.length > 0
      ? tradesWithTP.reduce((sum, t) => sum + (t.takeProfit || 0), 0) / tradesWithTP.length
      : 0;
    
    // Calculate win rate
    const profitableTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
    patterns.winRate = closedTrades.length > 0
      ? profitableTrades.length / closedTrades.length
      : 0;
    
    // Calculate profit factor
    const grossProfit = closedTrades
      .filter(t => (t.pnl || 0) > 0)
      .reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(closedTrades
      .filter(t => (t.pnl || 0) < 0)
      .reduce((sum, t) => sum + (t.pnl || 0), 0));
    patterns.profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
    
    // Calculate trades per day (approximate)
    if (trades.length >= 2) {
      const firstTrade = new Date(trades[0].openTime);
      const lastTrade = new Date(trades[trades.length - 1].openTime);
      const daysDiff = Math.max(1, (lastTrade.getTime() - firstTrade.getTime()) / (1000 * 60 * 60 * 24));
      patterns.avgTradesPerDay = trades.length / daysDiff;
    } else {
      patterns.avgTradesPerDay = trades.length;
    }
    
    // Calculate trading style scores
    patterns.scalperScore = this.calculateScalperScore(closedTrades);
    patterns.dayTraderScore = this.calculateDayTraderScore(closedTrades);
    patterns.swingScore = this.calculateSwingScore(closedTrades);
    
    // Apply patterns
    Object.assign(profile.patterns, patterns);
  }
  
  /**
   * Calculate scalper score (short duration trades, many trades)
   */
  private static calculateScalperScore(trades: IRecentTrade[]): number {
    if (trades.length === 0) return 0;
    
    const avgDuration = trades.reduce((sum, t) => sum + (t.duration || 0), 0) / trades.length;
    const tradesPerDay = trades.length / Math.max(1, 
      (new Date(trades[trades.length - 1]?.openTime || Date.now()).getTime() - 
       new Date(trades[0]?.openTime || Date.now()).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Scalpers: < 15 min avg duration, > 10 trades/day
    const durationScore = Math.max(0, 1 - avgDuration / 15);
    const frequencyScore = Math.min(1, tradesPerDay / 10);
    
    return (durationScore * 0.6 + frequencyScore * 0.4);
  }
  
  /**
   * Calculate day trader score (closes within same day)
   */
  private static calculateDayTraderScore(trades: IRecentTrade[]): number {
    if (trades.length === 0) return 0;
    
    const sameDayTrades = trades.filter(t => {
      if (!t.closeTime || !t.openTime) return false;
      const openDate = new Date(t.openTime).toDateString();
      const closeDate = new Date(t.closeTime).toDateString();
      return openDate === closeDate;
    });
    
    return sameDayTrades.length / trades.length;
  }
  
  /**
   * Calculate swing trader score (holds for days)
   */
  private static calculateSwingScore(trades: IRecentTrade[]): number {
    if (trades.length === 0) return 0;
    
    const longDurationTrades = trades.filter(t => (t.duration || 0) > 60 * 24); // > 1 day
    return longDurationTrades.length / trades.length;
  }
  
  /**
   * Generate behavioral fingerprint (32-dimension vector)
   */
  private static async generateBehavioralFingerprint(profile: ITradingBehaviorProfile): Promise<void> {
    const fingerprint: number[] = [];
    const patterns = profile.patterns;
    
    // Dimensions 0-4: Pair preferences (top 5)
    const topPairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'];
    for (const pair of topPairs) {
      fingerprint.push(patterns.preferredPairs?.includes(pair) ? 1 : 0);
    }
    
    // Dimensions 5-8: Trading hours (quarters of day)
    const hours = patterns.tradingHoursDistribution || Array(24).fill(0);
    fingerprint.push(hours.slice(0, 6).reduce((a, b) => a + b, 0));   // 00-06
    fingerprint.push(hours.slice(6, 12).reduce((a, b) => a + b, 0));  // 06-12
    fingerprint.push(hours.slice(12, 18).reduce((a, b) => a + b, 0)); // 12-18
    fingerprint.push(hours.slice(18, 24).reduce((a, b) => a + b, 0)); // 18-24
    
    // Dimensions 9-12: Trade sizes (buckets: micro, mini, standard, large)
    const avgSize = patterns.avgTradeSize || 0;
    fingerprint.push(avgSize < 0.1 ? 1 : 0);  // Micro
    fingerprint.push(avgSize >= 0.1 && avgSize < 1 ? 1 : 0);  // Mini
    fingerprint.push(avgSize >= 1 && avgSize < 10 ? 1 : 0);   // Standard
    fingerprint.push(avgSize >= 10 ? 1 : 0);  // Large
    
    // Dimensions 13-16: Trade duration (buckets)
    const avgDuration = patterns.avgTradeDuration || 0;
    fingerprint.push(avgDuration < 5 ? 1 : 0);     // < 5 min
    fingerprint.push(avgDuration >= 5 && avgDuration < 60 ? 1 : 0);   // 5-60 min
    fingerprint.push(avgDuration >= 60 && avgDuration < 480 ? 1 : 0); // 1-8 hours
    fingerprint.push(avgDuration >= 480 ? 1 : 0);  // > 8 hours
    
    // Dimensions 17-19: Trading style
    fingerprint.push(patterns.scalperScore || 0);
    fingerprint.push(patterns.dayTraderScore || 0);
    fingerprint.push(patterns.swingScore || 0);
    
    // Dimensions 20-22: Risk management
    fingerprint.push(Math.min(1, (patterns.avgStopLoss || 0) / 50));  // Normalized SL
    fingerprint.push(Math.min(1, (patterns.avgTakeProfit || 0) / 100)); // Normalized TP
    fingerprint.push(patterns.winRate || 0);
    
    // Dimensions 23-25: Activity
    fingerprint.push(Math.min(1, (patterns.avgTradesPerDay || 0) / 20)); // Normalized trades/day
    fingerprint.push(Math.min(1, (patterns.profitFactor || 0) / 3));    // Normalized PF
    fingerprint.push(Math.min(1, profile.totalTradesAnalyzed / 100));   // Experience
    
    // Dimensions 26-31: Reserved for future expansion
    while (fingerprint.length < 32) {
      fingerprint.push(0);
    }
    
    profile.behavioralFingerprint = fingerprint;
  }
  
  /**
   * Get preferred trading pairs for a user
   */
  static async getPreferredPairs(userId: string): Promise<string[]> {
    const profile = await this.getOrCreateProfile(userId);
    return profile.patterns.preferredPairs || [];
  }
  
  /**
   * Get trading hours distribution for a user
   */
  static async getTradingHours(userId: string): Promise<number[]> {
    const profile = await this.getOrCreateProfile(userId);
    return profile.patterns.tradingHoursDistribution || Array(24).fill(0);
  }
  
  /**
   * Get average trade statistics
   */
  static async getAverageTradeStats(userId: string): Promise<{
    avgSize: number;
    avgDuration: number;
    avgStopLoss: number;
    avgTakeProfit: number;
    winRate: number;
    profitFactor: number;
    tradesPerDay: number;
  }> {
    const profile = await this.getOrCreateProfile(userId);
    return {
      avgSize: profile.patterns.avgTradeSize || 0,
      avgDuration: profile.patterns.avgTradeDuration || 0,
      avgStopLoss: profile.patterns.avgStopLoss || 0,
      avgTakeProfit: profile.patterns.avgTakeProfit || 0,
      winRate: profile.patterns.winRate || 0,
      profitFactor: profile.patterns.profitFactor || 0,
      tradesPerDay: profile.patterns.avgTradesPerDay || 0
    };
  }
  
  /**
   * Get trading style classification
   */
  static async getTradingStyle(userId: string): Promise<{
    primaryStyle: 'scalper' | 'dayTrader' | 'swing' | 'unknown';
    scalperScore: number;
    dayTraderScore: number;
    swingScore: number;
  }> {
    const profile = await this.getOrCreateProfile(userId);
    const patterns = profile.patterns;
    
    const scores = {
      scalperScore: patterns.scalperScore || 0,
      dayTraderScore: patterns.dayTraderScore || 0,
      swingScore: patterns.swingScore || 0
    };
    
    let primaryStyle: 'scalper' | 'dayTrader' | 'swing' | 'unknown' = 'unknown';
    const maxScore = Math.max(scores.scalperScore, scores.dayTraderScore, scores.swingScore);
    
    if (maxScore > 0.3) {
      if (scores.scalperScore === maxScore) primaryStyle = 'scalper';
      else if (scores.dayTraderScore === maxScore) primaryStyle = 'dayTrader';
      else if (scores.swingScore === maxScore) primaryStyle = 'swing';
    }
    
    return { primaryStyle, ...scores };
  }
  
  /**
   * Get all profiles for similarity analysis
   */
  static async getAllProfiles(): Promise<ITradingBehaviorProfile[]> {
    await connectToDatabase();
    return TradingBehaviorProfile.find({ totalTradesAnalyzed: { $gte: 5 } })
      .sort({ lastUpdated: -1 });
  }
  
  /**
   * Get profile summary for admin display
   */
  static async getProfileSummary(userId: string): Promise<{
    userId: string;
    totalTrades: number;
    preferredPairs: string[];
    tradingStyle: string;
    winRate: number;
    avgDuration: string;
    riskLevel: string;
    lastUpdated: Date;
  }> {
    const profile = await this.getOrCreateProfile(userId);
    const style = await this.getTradingStyle(userId);
    
    // Format duration
    const avgMin = profile.patterns.avgTradeDuration || 0;
    let avgDuration = 'N/A';
    if (avgMin > 0) {
      if (avgMin < 60) avgDuration = `${Math.round(avgMin)} min`;
      else if (avgMin < 1440) avgDuration = `${Math.round(avgMin / 60)} hours`;
      else avgDuration = `${Math.round(avgMin / 1440)} days`;
    }
    
    // Determine risk level based on SL usage
    const avgSL = profile.patterns.avgStopLoss || 0;
    let riskLevel = 'Unknown';
    if (profile.totalTradesAnalyzed >= 5) {
      if (avgSL > 30) riskLevel = 'Conservative';
      else if (avgSL > 15) riskLevel = 'Moderate';
      else if (avgSL > 0) riskLevel = 'Aggressive';
      else riskLevel = 'No SL';
    }
    
    return {
      userId: profile.userId.toString(),
      totalTrades: profile.totalTradesAnalyzed,
      preferredPairs: profile.patterns.preferredPairs || [],
      tradingStyle: style.primaryStyle,
      winRate: Math.round((profile.patterns.winRate || 0) * 100),
      avgDuration,
      riskLevel,
      lastUpdated: profile.lastUpdated
    };
  }
  
  /**
   * Record competition entry for coordination detection
   */
  static async recordCompetitionEntry(userId: string): Promise<void> {
    await connectToDatabase();
    
    const profile = await this.getOrCreateProfile(userId);
    profile.competitionEntryTimes.push(new Date());
    await profile.save();
    
    console.log(`📝 Recorded competition entry for user ${userId}`);
  }
}

