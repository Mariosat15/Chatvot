import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { FraudHistory } from '@/database/models/fraud/fraud-history.model';
import { requireAdminAuth } from '@/lib/admin/auth';
import mongoose from 'mongoose';

// GET - Fetch complete fraud history for a specific user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { userId } = await params;
    
    // Convert to ObjectId for proper matching
    let userObjectId;
    try {
      userObjectId = new mongoose.Types.ObjectId(userId);
    } catch {
      // If not a valid ObjectId, use string match
      userObjectId = userId;
    }

    // Get user's complete history
    const history = await FraudHistory.getUserHistory(userId);
    
    // Get action counts
    const actionCounts = await FraudHistory.getActionCounts(userId);

    // Get detailed statistics - try both ObjectId and string match
    const stats = await FraudHistory.aggregate([
      { $match: { $or: [{ userId: userObjectId }, { userId: userId }] } },
      {
        $group: {
          _id: null,
          totalActions: { $sum: 1 },
          firstIncident: { $min: '$createdAt' },
          lastIncident: { $max: '$createdAt' },
          warningCount: {
            $sum: { $cond: [{ $eq: ['$actionType', 'warning_issued'] }, 1, 0] },
          },
          suspensionCount: {
            $sum: { $cond: [{ $eq: ['$actionType', 'suspended'] }, 1, 0] },
          },
          suspensionLiftCount: {
            $sum: { $cond: [{ $eq: ['$actionType', 'suspension_lifted'] }, 1, 0] },
          },
          banCount: {
            $sum: { $cond: [{ $eq: ['$actionType', 'banned'] }, 1, 0] },
          },
          banLiftCount: {
            $sum: { $cond: [{ $eq: ['$actionType', 'ban_lifted'] }, 1, 0] },
          },
          investigationCount: {
            $sum: { $cond: [{ $eq: ['$actionType', 'investigation_started'] }, 1, 0] },
          },
          criticalIncidents: {
            $sum: { $cond: [{ $eq: ['$actionSeverity', 'critical'] }, 1, 0] },
          },
          highIncidents: {
            $sum: { $cond: [{ $eq: ['$actionSeverity', 'high'] }, 1, 0] },
          },
        },
      },
    ]);

    // Calculate behavior score (higher is worse)
    const userStats = stats[0] || {};
    const behaviorScore = calculateBehaviorScore(userStats);

    // Get timeline of severity changes
    const severityTimeline = await FraudHistory.aggregate([
      { $match: { $or: [{ userId: userObjectId }, { userId: userId }] } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          incidents: { $sum: 1 },
          criticalCount: {
            $sum: { $cond: [{ $eq: ['$actionSeverity', 'critical'] }, 1, 0] },
          },
          highCount: {
            $sum: { $cond: [{ $eq: ['$actionSeverity', 'high'] }, 1, 0] },
          },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 },
    ]);

    return NextResponse.json({
      success: true,
      data: {
        history,
        actionCounts,
        stats: {
          ...userStats,
          behaviorScore,
          currentStatus: determineCurrentStatus(userStats),
        },
        severityTimeline,
      },
    });
  } catch (error) {
    console.error('Error fetching user fraud history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user fraud history' },
      { status: 500 }
    );
  }
}

// Calculate a behavior score based on history
function calculateBehaviorScore(stats: Record<string, number>): number {
  let score = 0;
  
  // Add points for negative actions
  score += (stats.warningCount || 0) * 10;
  score += (stats.suspensionCount || 0) * 25;
  score += (stats.banCount || 0) * 50;
  score += (stats.criticalIncidents || 0) * 15;
  score += (stats.highIncidents || 0) * 8;
  
  // Subtract points for lifted actions (shows rehabilitation)
  score -= (stats.suspensionLiftCount || 0) * 5;
  score -= (stats.banLiftCount || 0) * 10;
  
  return Math.max(0, Math.min(100, score));
}

// Determine current status based on history
function determineCurrentStatus(stats: Record<string, number>): string {
  const netBans = (stats.banCount || 0) - (stats.banLiftCount || 0);
  const netSuspensions = (stats.suspensionCount || 0) - (stats.suspensionLiftCount || 0);
  
  if (netBans > 0) return 'banned';
  if (netSuspensions > 0) return 'suspended';
  if (stats.investigationCount > 0) return 'under_investigation';
  if (stats.warningCount > 0) return 'warned';
  return 'clean';
}

