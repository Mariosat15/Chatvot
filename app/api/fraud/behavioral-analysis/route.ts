import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { BehavioralAnalysisService } from '@/lib/services/fraud/behavioral-analysis.service';
import { SimilarityDetectionService } from '@/lib/services/fraud/similarity-detection.service';
import { MirrorTradingService } from '@/lib/services/fraud/mirror-trading.service';
import TradingBehaviorProfile from '@/database/models/fraud/trading-behavior-profile.model';
import BehavioralSimilarity from '@/database/models/fraud/behavioral-similarity.model';

/**
 * GET /api/fraud/behavioral-analysis
 * 
 * Fetch behavioral analysis data for admin dashboard
 * 
 * Query params:
 * - action: 'profiles' | 'profile' | 'similar' | 'mirror-trading' | 'matrix'
 * - userId: For specific profile
 * - threshold: For similar accounts
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin status
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is admin (support both isAdmin and role for backwards compatibility)
    const user = session.user as any;
    const isAdmin = user?.isAdmin === true || user?.role === 'admin';
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'profiles';
    const userId = searchParams.get('userId');
    const threshold = parseFloat(searchParams.get('threshold') || '0.7');
    
    switch (action) {
      case 'profiles': {
        // Get all trading behavior profiles
        const profiles = await TradingBehaviorProfile.find({
          totalTradesAnalyzed: { $gte: 1 }
        })
          .sort({ lastUpdated: -1 })
          .limit(100)
          .lean();
        
        // Map to summary format
        const summaries = await Promise.all(
          profiles.map(async (profile) => {
            try {
              return await BehavioralAnalysisService.getProfileSummary(
                profile.userId.toString()
              );
            } catch {
              return {
                userId: profile.userId.toString(),
                totalTrades: profile.totalTradesAnalyzed || 0,
                preferredPairs: profile.patterns?.preferredPairs || [],
                tradingStyle: 'unknown',
                winRate: 0,
                avgDuration: 'N/A',
                riskLevel: 'Unknown',
                lastUpdated: profile.lastUpdated
              };
            }
          })
        );
        
        return NextResponse.json({
          success: true,
          profiles: summaries,
          total: summaries.length
        });
      }
      
      case 'profile': {
        // Get specific user profile
        if (!userId) {
          return NextResponse.json(
            { error: 'userId is required' },
            { status: 400 }
          );
        }
        
        const profile = await TradingBehaviorProfile.findOne({ userId }).lean();
        
        if (!profile) {
          return NextResponse.json(
            { error: 'Profile not found' },
            { status: 404 }
          );
        }
        
        const summary = await BehavioralAnalysisService.getProfileSummary(userId);
        const style = await BehavioralAnalysisService.getTradingStyle(userId);
        const stats = await BehavioralAnalysisService.getAverageTradeStats(userId);
        
        return NextResponse.json({
          success: true,
          profile: {
            ...profile,
            summary,
            tradingStyle: style,
            averageStats: stats
          }
        });
      }
      
      case 'similar': {
        // Get high similarity pairs
        const similarities = await SimilarityDetectionService.detectHighSimilarity(threshold);
        
        return NextResponse.json({
          success: true,
          similarities: similarities.map(s => ({
            userId1: s.userId1.toString(),
            userId2: s.userId2.toString(),
            similarityScore: (s.similarityScore * 100).toFixed(1) + '%',
            breakdown: s.similarityBreakdown,
            mirrorTradingDetected: s.mirrorTradingDetected,
            flaggedForReview: s.flaggedForReview,
            lastCalculated: s.lastCalculated
          })),
          total: similarities.length,
          threshold
        });
      }
      
      case 'mirror-trading': {
        // Get all mirror trading pairs
        const mirrorPairs = await MirrorTradingService.getAllMirrorTradingPairs();
        
        return NextResponse.json({
          success: true,
          mirrorTradingPairs: mirrorPairs,
          total: mirrorPairs.length
        });
      }
      
      case 'matrix': {
        // Get similarity matrix for visualization
        const userIds = searchParams.get('userIds')?.split(',') || [];
        
        if (userIds.length < 2) {
          // Get top 10 most active profiles
          const topProfiles = await TradingBehaviorProfile.find({
            totalTradesAnalyzed: { $gte: 5 }
          })
            .sort({ totalTradesAnalyzed: -1 })
            .limit(10)
            .select('userId')
            .lean();
          
          if (topProfiles.length < 2) {
            return NextResponse.json({
              success: true,
              matrix: [],
              userIds: [],
              message: 'Not enough profiles for matrix'
            });
          }
          
          const ids = topProfiles.map(p => p.userId.toString());
          const matrix = await SimilarityDetectionService.getSimilarityMatrix(ids);
          
          return NextResponse.json({
            success: true,
            matrix,
            userIds: ids
          });
        }
        
        const matrix = await SimilarityDetectionService.getSimilarityMatrix(userIds);
        
        return NextResponse.json({
          success: true,
          matrix,
          userIds
        });
      }
      
      case 'stats': {
        // Get overall stats
        const profileCount = await TradingBehaviorProfile.countDocuments({
          totalTradesAnalyzed: { $gte: 1 }
        });
        
        const highSimilarityCount = await BehavioralSimilarity.countDocuments({
          similarityScore: { $gte: 0.7 }
        });
        
        const mirrorTradingCount = await BehavioralSimilarity.countDocuments({
          mirrorTradingDetected: true
        });
        
        const flaggedCount = await BehavioralSimilarity.countDocuments({
          flaggedForReview: true
        });
        
        return NextResponse.json({
          success: true,
          stats: {
            profileCount,
            highSimilarityCount,
            mirrorTradingCount,
            flaggedCount
          }
        });
      }
      
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in behavioral analysis API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fraud/behavioral-analysis
 * 
 * Trigger analysis calculations
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin status
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if ((session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    await connectToDatabase();
    
    const body = await request.json();
    const { action, userId1, userId2 } = body;
    
    switch (action) {
      case 'calculate-similarity': {
        // Calculate similarity between two users
        if (!userId1 || !userId2) {
          return NextResponse.json(
            { error: 'userId1 and userId2 are required' },
            { status: 400 }
          );
        }
        
        const result = await SimilarityDetectionService.calculateSimilarity(userId1, userId2);
        
        return NextResponse.json({
          success: true,
          similarity: {
            similarityScore: (result.similarityScore * 100).toFixed(1) + '%',
            breakdown: result.similarityBreakdown,
            mirrorTradingDetected: result.mirrorTradingDetected
          }
        });
      }
      
      case 'check-mirror-trading': {
        // Check for mirror trading between two users
        if (!userId1 || !userId2) {
          return NextResponse.json(
            { error: 'userId1 and userId2 are required' },
            { status: 400 }
          );
        }
        
        const result = await MirrorTradingService.detectMirrorTrading(userId1, userId2);
        
        return NextResponse.json({
          success: true,
          mirrorTrading: {
            detected: result.detected,
            score: (result.score * 100).toFixed(1) + '%',
            matchingTrades: result.matchingTrades,
            timingCorrelation: (result.timingCorrelation * 100).toFixed(1) + '%',
            directionCorrelation: result.directionCorrelation.toFixed(2),
            evidenceCount: result.evidence.length
          }
        });
      }
      
      case 'run-full-analysis': {
        // Run full similarity analysis for all profiles
        console.log('🔄 Starting full behavioral analysis...');
        
        const result = await SimilarityDetectionService.runFullAnalysis();
        
        return NextResponse.json({
          success: true,
          analysis: result
        });
      }
      
      case 'recalculate-profile': {
        // Force recalculate a user's profile
        const userId = body.userId;
        if (!userId) {
          return NextResponse.json(
            { error: 'userId is required' },
            { status: 400 }
          );
        }
        
        const profile = await BehavioralAnalysisService.getOrCreateProfile(userId);
        
        return NextResponse.json({
          success: true,
          profile: {
            userId: profile.userId.toString(),
            totalTrades: profile.totalTradesAnalyzed,
            lastUpdated: profile.lastUpdated
          }
        });
      }
      
      case 'debug-status': {
        // Debug: Get current status of all behavioral data
        const profiles = await TradingBehaviorProfile.find({}).lean();
        const similarities = await BehavioralSimilarity.find({}).lean();
        
        const profileSummary = profiles.map(p => ({
          userId: p.userId.toString(),
          totalTrades: p.totalTradesAnalyzed,
          recentTrades: p.recentTradeSequence?.length || 0,
          mirrorSuspects: p.mirrorTradingSuspects?.length || 0,
          preferredPairs: p.patterns?.preferredPairs || [],
          lastUpdated: p.lastUpdated
        }));
        
        const similaritySummary = similarities.map(s => ({
          userId1: s.userId1.toString(),
          userId2: s.userId2.toString(),
          score: (s.similarityScore * 100).toFixed(1) + '%',
          mirrorTrading: s.mirrorTradingDetected,
          flagged: s.flaggedForReview
        }));
        
        return NextResponse.json({
          success: true,
          debug: {
            profiles: {
              total: profiles.length,
              withTrades: profiles.filter(p => p.totalTradesAnalyzed > 0).length,
              list: profileSummary
            },
            similarities: {
              total: similarities.length,
              highSimilarity: similarities.filter(s => s.similarityScore >= 0.7).length,
              mirrorTrading: similarities.filter(s => s.mirrorTradingDetected).length,
              list: similaritySummary
            }
          }
        });
      }
      
      case 'test-mirror-trading': {
        // Test: Run mirror trading check for all user pairs
        const profiles = await TradingBehaviorProfile.find({ 
          totalTradesAnalyzed: { $gte: 1 } 
        }).lean();
        
        const results: any[] = [];
        
        for (let i = 0; i < profiles.length; i++) {
          for (let j = i + 1; j < profiles.length; j++) {
            const result = await MirrorTradingService.detectMirrorTrading(
              profiles[i].userId.toString(),
              profiles[j].userId.toString()
            );
            
            if (result.matchingTrades > 0) {
              results.push({
                userId1: profiles[i].userId.toString(),
                userId2: profiles[j].userId.toString(),
                detected: result.detected,
                score: (result.score * 100).toFixed(1) + '%',
                matchingTrades: result.matchingTrades
              });
            }
          }
        }
        
        return NextResponse.json({
          success: true,
          pairsChecked: (profiles.length * (profiles.length - 1)) / 2,
          mirrorTradingResults: results
        });
      }
      
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in behavioral analysis POST:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

