/**
 * Dashboard Stats API
 * 
 * Returns comprehensive statistics for the admin dashboard overview
 */

import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import User from '@/database/models/user.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import WithdrawalRequest from '@/database/models/trading/withdrawal-request.model';
import FraudAlert from '@/database/models/fraud/fraud-alert.model';
import KYCVerification from '@/database/models/kyc/kyc-verification.model';
import PaymentProvider from '@/database/models/payment-provider.model';
import WhiteLabel from '@/database/models/whitelabel.model';

interface DashboardStats {
  // User Stats
  users: {
    total: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
    verified: number;
    active: number; // logged in last 30 days
  };
  
  // Deposit Stats
  deposits: {
    total: number;
    totalEUR: number;
    completedToday: number;
    completedTodayEUR: number;
    pendingCount: number;
    pendingEUR: number;
    failedToday: number;
  };
  
  // Withdrawal Stats
  withdrawals: {
    total: number;
    totalEUR: number;
    completedToday: number;
    completedTodayEUR: number;
    pendingCount: number;
    pendingEUR: number;
    failedToday: number;
    processingCount: number;
    approvedCount: number;
  };
  
  // KYC Stats
  kyc: {
    totalVerified: number;
    pendingCount: number;
    rejectedToday: number;
    approvedToday: number;
  };
  
  // Fraud Stats
  fraud: {
    activeAlerts: number;
    highPriorityAlerts: number;
    alertsToday: number;
    suspendedUsers: number;
    bannedUsers: number;
  };
  
  // Service Status
  services: {
    database: 'operational' | 'degraded' | 'down';
    webhooks: 'operational' | 'degraded' | 'down';
    payments: {
      stripe: 'operational' | 'degraded' | 'down' | 'not_configured';
      nuvei: 'operational' | 'degraded' | 'down' | 'not_configured';
    };
    massive: 'operational' | 'degraded' | 'down' | 'not_configured';
    redis: 'operational' | 'degraded' | 'down' | 'not_configured';
    kyc: 'operational' | 'degraded' | 'down' | 'not_configured';
  };
  
  // Recent Activity
  recentActivity: {
    type: 'deposit' | 'withdrawal' | 'user' | 'kyc' | 'fraud';
    description: string;
    timestamp: string;
    status?: 'success' | 'warning' | 'error';
  }[];
  
  // Timestamp
  generatedAt: string;
}

// Helper to get date boundaries
function getDateBoundaries() {
  const now = new Date();
  
  // Start of today (midnight)
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  
  // Start of this week (Monday)
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);
  
  // Start of this month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // 30 days ago
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return { now, startOfToday, startOfWeek, startOfMonth, thirtyDaysAgo };
}

// Check service status
async function checkServiceStatus(): Promise<DashboardStats['services']> {
  const services: DashboardStats['services'] = {
    database: 'operational',
    webhooks: 'operational',
    payments: {
      stripe: 'not_configured',
      nuvei: 'not_configured',
    },
    massive: 'not_configured',
    redis: 'not_configured',
    kyc: 'not_configured',
  };
  
  try {
    // Check payment providers
    const paymentProviders = await PaymentProvider.find({ isActive: true });
    for (const provider of paymentProviders) {
      if (provider.slug === 'stripe') {
        services.payments.stripe = provider.testMode ? 'operational' : 'operational';
      } else if (provider.slug === 'nuvei') {
        services.payments.nuvei = provider.testMode ? 'operational' : 'operational';
      }
    }
    
    // Also check env vars
    if (process.env.STRIPE_SECRET_KEY) {
      services.payments.stripe = 'operational';
    }
    if (process.env.NUVEI_MERCHANT_ID && process.env.NUVEI_SECRET_KEY) {
      services.payments.nuvei = 'operational';
    }
    
    // Check WhiteLabel settings for other services
    const settings = await WhiteLabel.findOne();
    if (settings) {
      // Massive WebSocket
      if (settings.massiveApiKey || process.env.MASSIVE_API_KEY) {
        services.massive = 'operational';
      }
      
      // Redis
      if (settings.redisEnabled || process.env.REDIS_URL) {
        try {
          // Try to ping Redis if configured
          const redisUrl = settings.redisUrl || process.env.REDIS_URL;
          if (redisUrl) {
            services.redis = 'operational';
          }
        } catch {
          services.redis = 'down';
        }
      }
      
      // KYC (Veriff)
      if (settings.veriffApiKey || process.env.VERIFF_API_KEY) {
        services.kyc = 'operational';
      }
    }
  } catch (error) {
    console.error('Error checking service status:', error);
  }
  
  return services;
}

export async function GET() {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    const { startOfToday, startOfWeek, startOfMonth, thirtyDaysAgo } = getDateBoundaries();
    
    // Run all queries in parallel for efficiency
    const [
      // User stats
      totalUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      verifiedUsers,
      activeUsers,
      
      // Deposit stats
      totalDeposits,
      depositsTodayCompleted,
      pendingDeposits,
      failedDepositsToday,
      
      // Withdrawal stats
      totalWithdrawals,
      withdrawalsTodayCompleted,
      pendingWithdrawals,
      processingWithdrawals,
      approvedWithdrawals,
      failedWithdrawalsToday,
      
      // KYC stats
      totalKYCVerified,
      pendingKYC,
      kycApprovedToday,
      kycRejectedToday,
      
      // Fraud stats
      activeAlerts,
      highPriorityAlerts,
      alertsToday,
      suspendedUsers,
      bannedUsers,
      
      // Recent activity (last 10 items)
      recentDeposits,
      recentWithdrawals,
      recentUsers,
      
      // Service status
      services,
    ] = await Promise.all([
      // User queries
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startOfToday } }),
      User.countDocuments({ createdAt: { $gte: startOfWeek } }),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ emailVerified: true }),
      User.countDocuments({ updatedAt: { $gte: thirtyDaysAgo } }),
      
      // Deposit queries
      WalletTransaction.aggregate([
        { $match: { transactionType: 'deposit', status: 'completed' } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$metadata.eurAmount' } } },
      ]),
      WalletTransaction.aggregate([
        { $match: { transactionType: 'deposit', status: 'completed', completedAt: { $gte: startOfToday } } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$metadata.eurAmount' } } },
      ]),
      WalletTransaction.aggregate([
        { $match: { transactionType: 'deposit', status: 'pending' } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$metadata.eurAmount' } } },
      ]),
      WalletTransaction.countDocuments({ transactionType: 'deposit', status: 'failed', updatedAt: { $gte: startOfToday } }),
      
      // Withdrawal queries
      WithdrawalRequest.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amountEUR' } } },
      ]),
      WithdrawalRequest.aggregate([
        { $match: { status: 'completed', processedAt: { $gte: startOfToday } } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amountEUR' } } },
      ]),
      WithdrawalRequest.aggregate([
        { $match: { status: 'pending' } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amountEUR' } } },
      ]),
      WithdrawalRequest.countDocuments({ status: 'processing' }),
      WithdrawalRequest.countDocuments({ status: 'approved' }),
      WithdrawalRequest.countDocuments({ status: { $in: ['failed', 'rejected'] }, updatedAt: { $gte: startOfToday } }),
      
      // KYC queries
      KYCVerification.countDocuments({ status: 'approved' }).catch(() => 0),
      KYCVerification.countDocuments({ status: 'pending' }).catch(() => 0),
      KYCVerification.countDocuments({ status: 'approved', updatedAt: { $gte: startOfToday } }).catch(() => 0),
      KYCVerification.countDocuments({ status: 'rejected', updatedAt: { $gte: startOfToday } }).catch(() => 0),
      
      // Fraud queries
      FraudAlert.countDocuments({ status: { $in: ['pending', 'investigating'] } }).catch(() => 0),
      FraudAlert.countDocuments({ status: { $in: ['pending', 'investigating'] }, priority: 'high' }).catch(() => 0),
      FraudAlert.countDocuments({ createdAt: { $gte: startOfToday } }).catch(() => 0),
      User.countDocuments({ 'restrictions.status': 'suspended' }).catch(() => 0),
      User.countDocuments({ 'restrictions.status': 'banned' }).catch(() => 0),
      
      // Recent activity
      WalletTransaction.find({ transactionType: 'deposit' })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('status metadata.eurAmount createdAt')
        .lean(),
      WithdrawalRequest.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('status amountEUR createdAt')
        .lean(),
      User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name email createdAt')
        .lean(),
      
      // Service status
      checkServiceStatus(),
    ]);
    
    // Build recent activity
    const recentActivity: DashboardStats['recentActivity'] = [];
    
    for (const deposit of (recentDeposits as any[])) {
      recentActivity.push({
        type: 'deposit',
        description: `€${deposit.metadata?.eurAmount?.toFixed(2) || '0'} deposit ${deposit.status}`,
        timestamp: deposit.createdAt.toISOString(),
        status: deposit.status === 'completed' ? 'success' : deposit.status === 'failed' ? 'error' : 'warning',
      });
    }
    
    for (const withdrawal of (recentWithdrawals as any[])) {
      recentActivity.push({
        type: 'withdrawal',
        description: `€${withdrawal.amountEUR?.toFixed(2) || '0'} withdrawal ${withdrawal.status}`,
        timestamp: withdrawal.createdAt.toISOString(),
        status: withdrawal.status === 'completed' ? 'success' : 
               ['failed', 'rejected'].includes(withdrawal.status) ? 'error' : 'warning',
      });
    }
    
    for (const user of (recentUsers as any[])) {
      recentActivity.push({
        type: 'user',
        description: `New user: ${user.name || user.email}`,
        timestamp: user.createdAt.toISOString(),
        status: 'success',
      });
    }
    
    // Sort by timestamp
    recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Build response
    const stats: DashboardStats = {
      users: {
        total: totalUsers,
        newToday: newUsersToday,
        newThisWeek: newUsersThisWeek,
        newThisMonth: newUsersThisMonth,
        verified: verifiedUsers,
        active: activeUsers,
      },
      deposits: {
        total: totalDeposits[0]?.count || 0,
        totalEUR: totalDeposits[0]?.total || 0,
        completedToday: depositsTodayCompleted[0]?.count || 0,
        completedTodayEUR: depositsTodayCompleted[0]?.total || 0,
        pendingCount: pendingDeposits[0]?.count || 0,
        pendingEUR: pendingDeposits[0]?.total || 0,
        failedToday: failedDepositsToday,
      },
      withdrawals: {
        total: totalWithdrawals[0]?.count || 0,
        totalEUR: totalWithdrawals[0]?.total || 0,
        completedToday: withdrawalsTodayCompleted[0]?.count || 0,
        completedTodayEUR: withdrawalsTodayCompleted[0]?.total || 0,
        pendingCount: pendingWithdrawals[0]?.count || 0,
        pendingEUR: pendingWithdrawals[0]?.total || 0,
        failedToday: failedWithdrawalsToday,
        processingCount: processingWithdrawals,
        approvedCount: approvedWithdrawals,
      },
      kyc: {
        totalVerified: totalKYCVerified,
        pendingCount: pendingKYC,
        approvedToday: kycApprovedToday,
        rejectedToday: kycRejectedToday,
      },
      fraud: {
        activeAlerts: activeAlerts,
        highPriorityAlerts: highPriorityAlerts,
        alertsToday: alertsToday,
        suspendedUsers: suspendedUsers,
        bannedUsers: bannedUsers,
      },
      services,
      recentActivity: recentActivity.slice(0, 10),
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}

