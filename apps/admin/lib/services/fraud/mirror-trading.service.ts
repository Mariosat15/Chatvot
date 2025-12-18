import TradingBehaviorProfile, { IRecentTrade, IMirrorTradingSuspect } from '@/database/models/fraud/trading-behavior-profile.model';
import BehavioralSimilarity, { IMirrorTradingEvidence } from '@/database/models/fraud/behavioral-similarity.model';
import { SuspicionScoringService } from '@/lib/services/fraud/suspicion-scoring.service';
import { AlertManagerService } from '@/lib/services/fraud/alert-manager.service';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

/**
 * Mirror Trading Detection Service
 * 
 * Detects coordinated or mirrored trading between accounts
 * Flags accounts that trade the same or opposite positions in sync
 */

interface MirrorTradingResult {
  detected: boolean;
  score: number;                     // 0-1 confidence
  matchingTrades: number;
  timingCorrelation: number;
  directionCorrelation: number;      // -1 (opposite) to 1 (same)
  evidence: IMirrorTradingEvidence[];
}

export class MirrorTradingService {
  
  // Time window for considering trades as "synchronized" (seconds)
  private static readonly SYNC_WINDOW_SECONDS = 60;
  
  // Minimum matching trades to flag (lowered for testing)
  private static readonly MIN_MATCHING_TRADES = 1;
  
  // Threshold for mirror trading detection (lowered for testing)
  private static readonly DETECTION_THRESHOLD = 0.3;
  
  /**
   * Detect mirror trading between two users
   */
  static async detectMirrorTrading(
    userId1: string,
    userId2: string
  ): Promise<MirrorTradingResult> {
    await connectToDatabase();
    
    console.log(`🪞 Checking for mirror trading: ${userId1.substring(0, 8)}... vs ${userId2.substring(0, 8)}...`);
    
    // Get recent trades for both users
    const profile1 = await TradingBehaviorProfile.findOne({ userId: userId1 });
    const profile2 = await TradingBehaviorProfile.findOne({ userId: userId2 });
    
    if (!profile1 || !profile2) {
      return {
        detected: false,
        score: 0,
        matchingTrades: 0,
        timingCorrelation: 0,
        directionCorrelation: 0,
        evidence: []
      };
    }
    
    const trades1 = profile1.recentTradeSequence || [];
    const trades2 = profile2.recentTradeSequence || [];
    
    console.log(`   User1 trades: ${trades1.length}, User2 trades: ${trades2.length}`);
    
    // Only need 1 trade per user for detection (lowered from 3)
    if (trades1.length < 1 || trades2.length < 1) {
      console.log(`   ❌ Not enough trades for analysis`);
      return {
        detected: false,
        score: 0,
        matchingTrades: 0,
        timingCorrelation: 0,
        directionCorrelation: 0,
        evidence: []
      };
    }
    
    // Analyze trade sequences
    const analysis = this.analyzeTradeSequence(trades1, trades2);
    
    // Determine if mirror trading is detected
    const detected = analysis.score >= this.DETECTION_THRESHOLD &&
                     analysis.matchingTrades >= this.MIN_MATCHING_TRADES;
    
    // If detected, update profiles and create alerts
    if (detected) {
      console.log(`🚨 MIRROR TRADING DETECTED between ${userId1} and ${userId2}`);
      console.log(`   Score: ${(analysis.score * 100).toFixed(1)}%`);
      console.log(`   Matching trades: ${analysis.matchingTrades}`);
      console.log(`   Direction correlation: ${analysis.directionCorrelation.toFixed(2)}`);
      
      // Update profile with suspect
      await this.addMirrorTradingSuspect(userId1, userId2, analysis);
      await this.addMirrorTradingSuspect(userId2, userId1, analysis);
      
      // Update behavioral similarity record
      await this.updateBehavioralSimilarity(userId1, userId2, analysis);
      
      // Update suspicion scores (+35 for mirror trading)
      await SuspicionScoringService.updateScore(userId1, {
        method: 'mirrorTrading',
        percentage: 35,
        evidence: `Mirror trading detected with user ${userId2.substring(0, 12)}... (${analysis.matchingTrades} matching trades)`,
        linkedUserIds: [userId2],
        confidence: analysis.score
      });
      
      await SuspicionScoringService.updateScore(userId2, {
        method: 'mirrorTrading',
        percentage: 35,
        evidence: `Mirror trading detected with user ${userId1.substring(0, 12)}... (${analysis.matchingTrades} matching trades)`,
        linkedUserIds: [userId1],
        confidence: analysis.score
      });
      
      // Create fraud alert
      const isOppositeDirection = analysis.directionCorrelation < -0.5;
      await AlertManagerService.createOrUpdateAlert({
        alertType: 'mirror_trading',
        userIds: [userId1, userId2],
        title: isOppositeDirection 
          ? 'Opposite Direction Trading Detected' 
          : 'Mirror Trading Detected',
        description: `Two accounts are ${isOppositeDirection ? 'trading opposite directions' : 'executing synchronized trades'} (${analysis.matchingTrades} matches, ${(analysis.score * 100).toFixed(0)}% confidence)`,
        severity: analysis.score >= 0.8 ? 'critical' : 'high',
        confidence: analysis.score,
        evidence: [{
          type: 'mirror_trading',
          description: `${analysis.matchingTrades} trades executed within ${this.SYNC_WINDOW_SECONDS}s of each other`,
          data: {
            matchingTrades: analysis.matchingTrades,
            timingCorrelation: (analysis.timingCorrelation * 100).toFixed(1) + '%',
            directionCorrelation: analysis.directionCorrelation.toFixed(2),
            tradingPattern: isOppositeDirection ? 'Opposite Direction' : 'Same Direction',
            confidence: (analysis.score * 100).toFixed(1) + '%',
            connectedAccountIds: [userId1, userId2],
            recentMatches: analysis.evidence.slice(0, 5).map(e => ({
              pair: e.pair,
              timeDelta: `${e.timeDelta}s`,
              directions: `${e.direction1} vs ${e.direction2}`,
              isOpposite: e.isOpposite
            }))
          }
        }]
      });
    }
    
    return {
      detected,
      score: analysis.score,
      matchingTrades: analysis.matchingTrades,
      timingCorrelation: analysis.timingCorrelation,
      directionCorrelation: analysis.directionCorrelation,
      evidence: analysis.evidence
    };
  }
  
  /**
   * Analyze trade sequences for synchronization patterns
   */
  static analyzeTradeSequence(
    trades1: IRecentTrade[],
    trades2: IRecentTrade[]
  ): {
    score: number;
    matchingTrades: number;
    timingCorrelation: number;
    directionCorrelation: number;
    evidence: IMirrorTradingEvidence[];
  } {
    const evidence: IMirrorTradingEvidence[] = [];
    let sameDirection = 0;
    let oppositeDirection = 0;
    let totalTimeDelta = 0;
    
    // Find matching trades (same pair, close timing)
    for (const trade1 of trades1) {
      for (const trade2 of trades2) {
        // Skip if different pairs
        if (trade1.pair !== trade2.pair) continue;
        
        // Calculate time difference
        const time1 = new Date(trade1.openTime).getTime();
        const time2 = new Date(trade2.openTime).getTime();
        const timeDelta = Math.abs(time1 - time2) / 1000; // seconds
        
        // Check if within sync window
        if (timeDelta <= this.SYNC_WINDOW_SECONDS) {
          const isOpposite = trade1.direction !== trade2.direction;
          const isSameTime = timeDelta <= 10; // Within 10 seconds
          
          evidence.push({
            tradeId1: trade1.tradeId,
            tradeId2: trade2.tradeId,
            pair: trade1.pair,
            timeDelta: Math.round(timeDelta),
            direction1: trade1.direction,
            direction2: trade2.direction,
            isOpposite,
            isSameTime,
            detectedAt: new Date()
          });
          
          totalTimeDelta += timeDelta;
          
          if (isOpposite) {
            oppositeDirection++;
          } else {
            sameDirection++;
          }
        }
      }
    }
    
    const matchingTrades = evidence.length;
    
    if (matchingTrades === 0) {
      return {
        score: 0,
        matchingTrades: 0,
        timingCorrelation: 0,
        directionCorrelation: 0,
        evidence: []
      };
    }
    
    // Calculate correlations
    const avgTimeDelta = totalTimeDelta / matchingTrades;
    const timingCorrelation = Math.max(0, 1 - avgTimeDelta / this.SYNC_WINDOW_SECONDS);
    
    // Direction correlation: -1 (all opposite) to 1 (all same)
    const directionCorrelation = (sameDirection - oppositeDirection) / matchingTrades;
    
    // Calculate overall score
    // Higher score for:
    // - More matching trades
    // - Closer timing
    // - Consistent direction pattern (either all same OR all opposite)
    const matchRatio = Math.min(1, matchingTrades / Math.min(trades1.length, trades2.length));
    const consistentDirection = Math.abs(directionCorrelation); // Both extremes are suspicious
    
    const score = (
      matchRatio * 0.3 +
      timingCorrelation * 0.4 +
      consistentDirection * 0.3
    );
    
    return {
      score: Math.min(1, score),
      matchingTrades,
      timingCorrelation,
      directionCorrelation,
      evidence
    };
  }
  
  /**
   * Find opposite direction trades (hedging across accounts)
   */
  static async findOppositeDirectionTrades(
    userId1: string,
    userId2: string
  ): Promise<IMirrorTradingEvidence[]> {
    const result = await this.detectMirrorTrading(userId1, userId2);
    return result.evidence.filter(e => e.isOpposite);
  }
  
  /**
   * Calculate timing correlation between trade sequences
   */
  static calculateTimingCorrelation(
    trades1: IRecentTrade[],
    trades2: IRecentTrade[]
  ): number {
    const analysis = this.analyzeTradeSequence(trades1, trades2);
    return analysis.timingCorrelation;
  }
  
  /**
   * Add mirror trading suspect to profile
   */
  private static async addMirrorTradingSuspect(
    userId: string,
    pairedUserId: string,
    analysis: {
      score: number;
      matchingTrades: number;
      timingCorrelation: number;
      directionCorrelation: number;
    }
  ): Promise<void> {
    const profile = await TradingBehaviorProfile.findOne({ userId });
    if (!profile) return;
    
    // Check if suspect already exists
    const existingIndex = profile.mirrorTradingSuspects.findIndex(
      (s: IMirrorTradingSuspect) => s.pairedUserId.toString() === pairedUserId
    );
    
    const suspect: IMirrorTradingSuspect = {
      pairedUserId: new mongoose.Types.ObjectId(pairedUserId),
      detectedAt: new Date(),
      matchingTrades: analysis.matchingTrades,
      timingCorrelation: analysis.timingCorrelation,
      directionCorrelation: analysis.directionCorrelation,
      confidence: analysis.score
    };
    
    if (existingIndex >= 0) {
      // Update existing suspect
      profile.mirrorTradingSuspects[existingIndex] = suspect;
    } else {
      // Add new suspect
      profile.mirrorTradingSuspects.push(suspect);
    }
    
    await profile.save();
  }
  
  /**
   * Update behavioral similarity with mirror trading data
   */
  private static async updateBehavioralSimilarity(
    userId1: string,
    userId2: string,
    analysis: {
      score: number;
      matchingTrades: number;
      evidence: IMirrorTradingEvidence[];
    }
  ): Promise<void> {
    const [sortedId1, sortedId2] = [userId1, userId2].sort();
    
    let similarity = await BehavioralSimilarity.findOne({
      userId1: sortedId1,
      userId2: sortedId2
    });
    
    if (!similarity) {
      similarity = new BehavioralSimilarity({
        userId1: sortedId1,
        userId2: sortedId2,
        firstDetected: new Date()
      });
    }
    
    similarity.mirrorTradingDetected = true;
    similarity.mirrorTradingScore = analysis.score;
    similarity.mirrorTradingEvidence.push(...analysis.evidence);
    similarity.flaggedForReview = true;
    similarity.lastCalculated = new Date();
    
    await similarity.save();
  }
  
  /**
   * Run real-time check when a trade is executed
   * Compares against all users who traded the same pair recently
   */
  static async checkRealTimeMirrorTrading(
    userId: string,
    trade: IRecentTrade
  ): Promise<void> {
    await connectToDatabase();
    
    console.log(`🔄 Real-time mirror trading check for ${trade.pair} by ${userId.substring(0, 8)}...`);
    
    // Use a longer time window (5 minutes) for real-time detection to catch more cases
    const REAL_TIME_WINDOW_SECONDS = 300; // 5 minutes
    const timeWindow = new Date(Date.now() - REAL_TIME_WINDOW_SECONDS * 1000);
    
    console.log(`   Looking for trades after: ${timeWindow.toISOString()}`);
    
    // Find ALL profiles that have traded the same pair recently
    const recentProfiles = await TradingBehaviorProfile.find({
      userId: { $ne: userId },
      'recentTradeSequence.pair': trade.pair
    }).limit(100);
    
    console.log(`   Found ${recentProfiles.length} profiles that have traded ${trade.pair}`);
    
    let checksRun = 0;
    for (const otherProfile of recentProfiles) {
      // Filter to recent trades
      const recentTrades = otherProfile.recentTradeSequence.filter((t: { pair: string; openTime: Date }) => 
        t.pair === trade.pair &&
        new Date(t.openTime).getTime() >= timeWindow.getTime()
      );
      
      if (recentTrades.length > 0) {
        console.log(`   👀 User ${otherProfile.userId.toString().substring(0, 8)}... has ${recentTrades.length} recent ${trade.pair} trades`);
        
        // Check if any trade matches our trade timing
        const matchingTrade = recentTrades.find((t: { openTime: Date }) => 
          Math.abs(new Date(t.openTime).getTime() - new Date(trade.openTime).getTime()) <= this.SYNC_WINDOW_SECONDS * 1000
        );
        
        if (matchingTrade) {
          console.log(`   ⚠️ POTENTIAL MIRROR TRADE with ${otherProfile.userId}`);
          console.log(`      Their trade: ${matchingTrade.direction} @ ${matchingTrade.openTime}`);
          console.log(`      Your trade: ${trade.direction} @ ${trade.openTime}`);
          
          checksRun++;
          // Run full analysis
          await this.detectMirrorTrading(userId, otherProfile.userId.toString());
        }
      }
    }
    
    console.log(`   ✅ Mirror trading check completed. ${checksRun} potential matches analyzed.`);
  }
  
  /**
   * Get all mirror trading pairs
   */
  static async getAllMirrorTradingPairs(): Promise<{
    userId1: string;
    userId2: string;
    score: number;
    matchingTrades: number;
    directionPattern: string;
    detectedAt: Date;
  }[]> {
    await connectToDatabase();
    
    const similarities = await BehavioralSimilarity.find({
      mirrorTradingDetected: true
    }).sort({ mirrorTradingScore: -1 });
    
    return similarities.map(s => ({
      userId1: s.userId1.toString(),
      userId2: s.userId2.toString(),
      score: s.mirrorTradingScore,
      matchingTrades: s.mirrorTradingEvidence.length,
      directionPattern: s.mirrorTradingEvidence.filter((e: { isOpposite: boolean }) => e.isOpposite).length > 
                        s.mirrorTradingEvidence.filter((e: { isOpposite: boolean }) => !e.isOpposite).length
                        ? 'Opposite' : 'Same',
      detectedAt: s.lastCalculated
    }));
  }
}

