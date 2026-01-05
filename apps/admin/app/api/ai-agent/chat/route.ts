/**
 * AI Agent Chat API
 * 
 * Uses OpenAI function calling to execute database queries and return structured results
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { connectToDatabase } from '@/database/mongoose';
import { WhiteLabel } from '@/database/models/whitelabel.model';
import { verifyAdminAuth } from '@/lib/admin/auth';
import mongoose from 'mongoose';

// Import models (non-fraud models that are well-registered)
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import UserLevel from '@/database/models/user-level.model';
// Note: Fraud-related models (PaymentFingerprint, FraudAlert, SuspicionScore) 
// are queried via raw MongoDB to avoid schema registration issues

// Types
interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: any;
}

interface AgentResult {
  type: 'table' | 'list' | 'cards' | 'stats' | 'chart' | 'text' | 'alert';
  title: string;
  data: any;
  columns?: { key: string; label: string; type?: string }[];
}

// Define the tools/functions the AI can call
const TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_shared_payment_methods',
      description: 'Find users who share the same payment method (potential fraud indicator). Returns users with shared card fingerprints.',
      parameters: {
        type: 'object',
        properties: {
          minSharedCount: {
            type: 'number',
            description: 'Minimum number of users sharing the payment method (default: 2)'
          },
          provider: {
            type: 'string',
            enum: ['stripe', 'nuvei', 'paypal', 'all'],
            description: 'Payment provider to filter by'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_fraud_alerts',
      description: 'Get active fraud alerts with optional filtering by severity, type, or status',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'investigating', 'resolved', 'dismissed', 'all'],
            description: 'Alert status to filter by'
          },
          severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical', 'all'],
            description: 'Severity level to filter by'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of alerts to return (default: 20)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_user_details',
      description: 'Get detailed information about a specific user including their wallet, transactions, KYC status, and fraud scores',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User ID to look up'
          },
          email: {
            type: 'string',
            description: 'User email to look up (alternative to userId)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_kyc',
      description: 'List all users with pending KYC verification',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of users to return (default: 50)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_financial_summary',
      description: 'Get financial summary including total deposits, withdrawals, fees, and revenue for a time period',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'week', 'month', 'year', 'all'],
            description: 'Time period for the summary'
          }
        },
        required: ['period']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_withdrawals',
      description: 'List all pending withdrawal requests that need review',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number to return (default: 50)'
          },
          minAmount: {
            type: 'number',
            description: 'Minimum withdrawal amount to filter by'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_user_statistics',
      description: 'Get overall user statistics including total users, active users, verified users, etc.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'week', 'month', 'year', 'all'],
            description: 'Time period for registration stats'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_top_traders',
      description: 'Get top traders by various metrics',
      parameters: {
        type: 'object',
        properties: {
          metric: {
            type: 'string',
            enum: ['xp', 'deposits', 'trades', 'winrate'],
            description: 'Metric to rank by'
          },
          limit: {
            type: 'number',
            description: 'Number of traders to return (default: 10)'
          },
          period: {
            type: 'string',
            enum: ['week', 'month', 'year', 'all'],
            description: 'Time period'
          }
        },
        required: ['metric']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_reconciliation',
      description: 'Run a reconciliation check comparing transactions with payment provider records',
      parameters: {
        type: 'object',
        properties: {
          provider: {
            type: 'string',
            enum: ['stripe', 'nuvei', 'all'],
            description: 'Payment provider to reconcile'
          },
          period: {
            type: 'string',
            enum: ['today', 'week', 'month'],
            description: 'Time period to check'
          }
        },
        required: ['period']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_users',
      description: 'Search for users by various criteria',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (email, name, or ID)'
          },
          status: {
            type: 'string',
            enum: ['all', 'active', 'suspended', 'banned'],
            description: 'User status filter'
          },
          kycStatus: {
            type: 'string',
            enum: ['all', 'pending', 'verified', 'rejected'],
            description: 'KYC status filter'
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 20)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_high_risk_users',
      description: 'Get users with high suspicion scores or multiple fraud indicators',
      parameters: {
        type: 'object',
        properties: {
          minScore: {
            type: 'number',
            description: 'Minimum suspicion score (0-100, default: 50)'
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 20)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_transaction_history',
      description: 'Get transaction history with optional filters',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['deposit', 'withdrawal', 'all'],
            description: 'Transaction type'
          },
          status: {
            type: 'string',
            enum: ['pending', 'completed', 'failed', 'all'],
            description: 'Transaction status'
          },
          period: {
            type: 'string',
            enum: ['today', 'week', 'month', 'all'],
            description: 'Time period'
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 50)'
          }
        }
      }
    }
  }
];

// Tool execution functions
async function executeGetSharedPaymentMethods(args: any): Promise<AgentResult> {
  const minSharedCount = args.minSharedCount || 2;
  const provider = args.provider === 'all' ? undefined : args.provider;
  const db = mongoose.connection.db!;

  // Use raw MongoDB query to avoid schema registration issues
  const query: any = { isShared: true };
  if (provider) query.paymentProvider = provider;

  const sharedPayments = await db.collection('paymentfingerprints')
    .find(query)
    .sort({ riskScore: -1 })
    .limit(50)
    .toArray();

  // Get user info for each payment fingerprint
  const userIds = [...new Set(sharedPayments.map((p: any) => p.userId?.toString()).filter(Boolean))];
  const users = await db.collection('user').find({
    $or: [
      { id: { $in: userIds } },
      { _id: { $in: userIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id)).map((id: string) => new mongoose.Types.ObjectId(id)) } }
    ]
  }).toArray();
  const userMap = new Map(users.map((u: any) => [u.id || u._id?.toString(), u]));

  const data = sharedPayments
    .filter((p: any) => (p.linkedUserIds?.length || 0) >= minSharedCount - 1)
    .map((p: any) => {
      const user = userMap.get(p.userId?.toString());
      return {
        fingerprint: p.paymentFingerprint?.substring(0, 12) + '...',
        provider: p.paymentProvider,
        owner: user?.email || 'Unknown',
        sharedWith: p.linkedUserIds?.length || 0,
        cardLast4: p.cardLast4 || '—',
        cardBrand: p.cardBrand || '—',
        riskScore: p.riskScore,
        lastUsed: p.lastUsed,
      };
    });

  return {
    type: 'table',
    title: `Shared Payment Methods (${data.length} found)`,
    data,
    columns: [
      { key: 'fingerprint', label: 'Fingerprint' },
      { key: 'provider', label: 'Provider', type: 'badge' },
      { key: 'owner', label: 'Owner' },
      { key: 'sharedWith', label: 'Shared With', type: 'number' },
      { key: 'cardLast4', label: 'Last 4' },
      { key: 'cardBrand', label: 'Brand' },
      { key: 'riskScore', label: 'Risk Score', type: 'number' },
      { key: 'lastUsed', label: 'Last Used', type: 'date' },
    ]
  };
}

async function executeGetFraudAlerts(args: any): Promise<AgentResult> {
  const limit = args.limit || 20;
  const db = mongoose.connection.db!;
  const query: any = {};
  
  if (args.status && args.status !== 'all') query.status = args.status;
  if (args.severity && args.severity !== 'all') query.severity = args.severity;

  // Use raw MongoDB query to avoid schema registration issues
  const alerts = await db.collection('fraudalerts')
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  const data = alerts.map((a: any) => ({
    id: a._id.toString().substring(0, 8),
    type: a.alertType,
    severity: a.severity,
    status: a.status,
    description: a.description?.substring(0, 50) + (a.description?.length > 50 ? '...' : ''),
    userId: a.userId?.toString().substring(0, 8) || '—',
    score: a.suspicionScore,
    createdAt: a.createdAt,
  }));

  return {
    type: 'table',
    title: `Fraud Alerts (${data.length})`,
    data,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'type', label: 'Type', type: 'badge' },
      { key: 'severity', label: 'Severity', type: 'status' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'description', label: 'Description' },
      { key: 'score', label: 'Score', type: 'number' },
      { key: 'createdAt', label: 'Created', type: 'date' },
    ]
  };
}

async function executeGetUserDetails(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  let user: any = null;

  if (args.userId) {
    const userQueries: any[] = [{ id: args.userId }];
    if (mongoose.Types.ObjectId.isValid(args.userId)) {
      userQueries.push({ _id: new mongoose.Types.ObjectId(args.userId) });
    }
    user = await db.collection('user').findOne({ $or: userQueries });
  } else if (args.email) {
    user = await db.collection('user').findOne({ email: { $regex: new RegExp(`^${args.email}$`, 'i') } });
  }

  if (!user) {
    return {
      type: 'alert',
      title: 'User Not Found',
      data: {
        severity: 'medium',
        title: 'User Not Found',
        message: `No user found with ${args.userId ? 'ID: ' + args.userId : 'email: ' + args.email}`
      }
    };
  }

  const userId = user.id || user._id?.toString();
  
  const [wallet, transactions, userLevel, suspicionScore] = await Promise.all([
    CreditWallet.findOne({ userId }).lean() as Promise<any>,
    WalletTransaction.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
    UserLevel.findOne({ userId }).lean() as Promise<any>,
    // Use raw MongoDB for suspicion score to avoid schema registration issues
    db.collection('suspicionscores').findOne({ userId }) as Promise<any>,
  ]);

  return {
    type: 'cards',
    title: `User Details: ${user.name || user.email}`,
    data: [
      {
        section: 'Profile',
        email: user.email,
        name: user.name || '—',
        verified: user.emailVerified ? 'Yes' : 'No',
        country: user.country || '—',
        joined: new Date(user.createdAt).toLocaleDateString(),
      },
      {
        section: 'Wallet',
        balance: `€${(wallet?.creditBalance || 0).toFixed(2)}`,
        totalDeposited: `€${(wallet?.totalDeposited || 0).toFixed(2)}`,
        totalWithdrawn: `€${(wallet?.totalWithdrawn || 0).toFixed(2)}`,
        kycVerified: wallet?.kycVerified ? 'Yes' : 'No',
      },
      {
        section: 'Progress',
        level: userLevel?.currentLevel || 1,
        xp: userLevel?.currentXP || 0,
        title: userLevel?.currentTitle || 'Novice',
        badges: userLevel?.totalBadgesEarned || 0,
      },
      {
        section: 'Security',
        suspicionScore: suspicionScore?.totalScore || 0,
        riskLevel: (suspicionScore?.totalScore || 0) > 50 ? 'High' : (suspicionScore?.totalScore || 0) > 25 ? 'Medium' : 'Low',
        lastActivity: user.lastActivity ? new Date(user.lastActivity).toLocaleDateString() : '—',
      }
    ]
  };
}

async function executeGetPendingKYC(args: any): Promise<AgentResult> {
  const limit = args.limit || 50;
  const db = mongoose.connection.db!;

  // Find wallets with pending or no KYC
  const wallets = await CreditWallet.find({ 
    $or: [
      { kycVerified: false },
      { kycVerified: { $exists: false } }
    ]
  }).limit(limit).lean();

  const userIds = wallets.map((w: any) => w.userId);
  const users = await db.collection('user').find({ 
    $or: [
      { id: { $in: userIds } },
      { _id: { $in: userIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id)).map((id: string) => new mongoose.Types.ObjectId(id)) } }
    ]
  }).toArray();

  const userMap = new Map(users.map((u: any) => [u.id || u._id?.toString(), u]));

  const data = wallets.map((w: any) => {
    const user = userMap.get(w.userId);
    return {
      email: user?.email || 'Unknown',
      name: user?.name || '—',
      balance: w.creditBalance || 0,
      totalDeposited: w.totalDeposited || 0,
      country: user?.country || '—',
      joined: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—',
    };
  });

  return {
    type: 'table',
    title: `Pending KYC (${data.length} users)`,
    data,
    columns: [
      { key: 'email', label: 'Email' },
      { key: 'name', label: 'Name' },
      { key: 'balance', label: 'Balance', type: 'currency' },
      { key: 'totalDeposited', label: 'Deposited', type: 'currency' },
      { key: 'country', label: 'Country' },
      { key: 'joined', label: 'Joined' },
    ]
  };
}

async function executeGetFinancialSummary(args: any): Promise<AgentResult> {
  const period = args.period || 'month';
  
  let dateFilter: any = {};
  const now = new Date();
  
  switch (period) {
    case 'today':
      dateFilter = { $gte: new Date(now.setHours(0, 0, 0, 0)) };
      break;
    case 'week':
      dateFilter = { $gte: new Date(now.setDate(now.getDate() - 7)) };
      break;
    case 'month':
      dateFilter = { $gte: new Date(now.setMonth(now.getMonth() - 1)) };
      break;
    case 'year':
      dateFilter = { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) };
      break;
  }

  const depositQuery: any = { transactionType: 'deposit', status: 'completed' };
  const withdrawalQuery: any = { transactionType: 'withdrawal', status: 'completed' };
  
  if (period !== 'all') {
    depositQuery.processedAt = dateFilter;
    withdrawalQuery.processedAt = dateFilter;
  }

  const [deposits, withdrawals] = await Promise.all([
    WalletTransaction.find(depositQuery).lean(),
    WalletTransaction.find(withdrawalQuery).lean(),
  ]);

  const totalDeposits = deposits.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
  const totalWithdrawals = withdrawals.reduce((sum: number, w: any) => sum + (w.amount || 0), 0);
  const totalFees = deposits.reduce((sum: number, d: any) => sum + (d.platformFee || 0) + (d.bankFee || 0), 0);
  const totalVAT = deposits.reduce((sum: number, d: any) => sum + (d.vatAmount || 0), 0);

  return {
    type: 'stats',
    title: `Financial Summary (${period})`,
    data: {
      total_deposits: `€${totalDeposits.toFixed(2)}`,
      deposit_count: deposits.length,
      total_withdrawals: `€${totalWithdrawals.toFixed(2)}`,
      withdrawal_count: withdrawals.length,
      platform_fees: `€${totalFees.toFixed(2)}`,
      vat_collected: `€${totalVAT.toFixed(2)}`,
      net_flow: `€${(totalDeposits - totalWithdrawals).toFixed(2)}`,
    }
  };
}

async function executeGetPendingWithdrawals(args: any): Promise<AgentResult> {
  const limit = args.limit || 50;
  const query: any = { 
    transactionType: 'withdrawal',
    status: { $in: ['pending', 'processing'] }
  };
  
  if (args.minAmount) {
    query.amount = { $gte: args.minAmount };
  }

  const withdrawals = await WalletTransaction.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const db = mongoose.connection.db!;
  const userIds = [...new Set(withdrawals.map((w: any) => w.userId))];
  const users = await db.collection('user').find({ 
    $or: [
      { id: { $in: userIds } },
      { _id: { $in: userIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id)).map((id: string) => new mongoose.Types.ObjectId(id)) } }
    ]
  }).toArray();
  const userMap = new Map(users.map((u: any) => [u.id || u._id?.toString(), u]));

  const data = withdrawals.map((w: any) => {
    const user = userMap.get(w.userId);
    return {
      id: w._id.toString().substring(0, 8),
      email: user?.email || 'Unknown',
      amount: w.amount,
      status: w.status,
      method: w.metadata?.withdrawalMethod || 'card',
      createdAt: w.createdAt,
    };
  });

  return {
    type: 'table',
    title: `Pending Withdrawals (${data.length})`,
    data,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'email', label: 'User' },
      { key: 'amount', label: 'Amount', type: 'currency' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'method', label: 'Method', type: 'badge' },
      { key: 'createdAt', label: 'Created', type: 'date' },
    ]
  };
}

async function executeGetUserStatistics(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const period = args.period || 'all';
  
  let dateFilter: any = {};
  const now = new Date();
  
  switch (period) {
    case 'today':
      dateFilter = { $gte: new Date(now.setHours(0, 0, 0, 0)) };
      break;
    case 'week':
      dateFilter = { $gte: new Date(now.setDate(now.getDate() - 7)) };
      break;
    case 'month':
      dateFilter = { $gte: new Date(now.setMonth(now.getMonth() - 1)) };
      break;
    case 'year':
      dateFilter = { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) };
      break;
  }

  const usersCollection = db.collection('user');
  
  const [totalUsers, verifiedUsers, recentUsers] = await Promise.all([
    usersCollection.countDocuments(),
    usersCollection.countDocuments({ emailVerified: true }),
    period !== 'all' 
      ? usersCollection.countDocuments({ createdAt: dateFilter })
      : Promise.resolve(0),
  ]);

  const walletsWithDeposits = await CreditWallet.countDocuments({ totalDeposited: { $gt: 0 } });
  const kycVerified = await CreditWallet.countDocuments({ kycVerified: true });

  return {
    type: 'stats',
    title: `User Statistics${period !== 'all' ? ` (${period})` : ''}`,
    data: {
      total_users: totalUsers,
      email_verified: verifiedUsers,
      new_registrations: period !== 'all' ? recentUsers : '—',
      depositing_users: walletsWithDeposits,
      kyc_verified: kycVerified,
      verification_rate: `${((verifiedUsers / totalUsers) * 100).toFixed(1)}%`,
    }
  };
}

async function executeGetTopTraders(args: any): Promise<AgentResult> {
  const metric = args.metric || 'xp';
  const limit = args.limit || 10;
  const db = mongoose.connection.db!;

  let data: any[] = [];

  if (metric === 'xp') {
    const topLevels = await UserLevel.find()
      .sort({ currentXP: -1 })
      .limit(limit)
      .lean();

    const userIds = topLevels.map((l: any) => l.userId);
    const users = await db.collection('user').find({ 
      $or: [
        { id: { $in: userIds } },
        { _id: { $in: userIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id)).map((id: string) => new mongoose.Types.ObjectId(id)) } }
      ]
    }).toArray();
    const userMap = new Map(users.map((u: any) => [u.id || u._id?.toString(), u]));

    data = topLevels.map((l: any, i: number) => {
      const user = userMap.get(l.userId);
      return {
        rank: i + 1,
        email: user?.email || 'Unknown',
        name: user?.name || '—',
        xp: l.currentXP,
        level: l.currentLevel,
        title: l.currentTitle,
      };
    });
  } else if (metric === 'deposits') {
    const topWallets = await CreditWallet.find()
      .sort({ totalDeposited: -1 })
      .limit(limit)
      .lean();

    const userIds = topWallets.map((w: any) => w.userId);
    const users = await db.collection('user').find({ 
      $or: [
        { id: { $in: userIds } },
        { _id: { $in: userIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id)).map((id: string) => new mongoose.Types.ObjectId(id)) } }
      ]
    }).toArray();
    const userMap = new Map(users.map((u: any) => [u.id || u._id?.toString(), u]));

    data = topWallets.map((w: any, i: number) => {
      const user = userMap.get(w.userId);
      return {
        rank: i + 1,
        email: user?.email || 'Unknown',
        name: user?.name || '—',
        totalDeposited: w.totalDeposited,
        balance: w.creditBalance,
      };
    });
  }

  return {
    type: 'table',
    title: `Top Traders by ${metric.toUpperCase()} (Top ${limit})`,
    data,
    columns: metric === 'xp' ? [
      { key: 'rank', label: '#', type: 'number' },
      { key: 'email', label: 'Email' },
      { key: 'name', label: 'Name' },
      { key: 'xp', label: 'XP', type: 'number' },
      { key: 'level', label: 'Level', type: 'number' },
      { key: 'title', label: 'Title', type: 'badge' },
    ] : [
      { key: 'rank', label: '#', type: 'number' },
      { key: 'email', label: 'Email' },
      { key: 'name', label: 'Name' },
      { key: 'totalDeposited', label: 'Total Deposited', type: 'currency' },
      { key: 'balance', label: 'Balance', type: 'currency' },
    ]
  };
}

async function executeRunReconciliation(args: any): Promise<AgentResult> {
  const period = args.period || 'week';
  
  let dateFilter: any = {};
  const now = new Date();
  
  switch (period) {
    case 'today':
      dateFilter = { $gte: new Date(now.setHours(0, 0, 0, 0)) };
      break;
    case 'week':
      dateFilter = { $gte: new Date(now.setDate(now.getDate() - 7)) };
      break;
    case 'month':
      dateFilter = { $gte: new Date(now.setMonth(now.getMonth() - 1)) };
      break;
  }

  // Get transactions
  const transactions = await WalletTransaction.find({
    processedAt: dateFilter,
    status: 'completed'
  }).lean();

  const deposits = transactions.filter((t: any) => t.transactionType === 'deposit');
  const withdrawals = transactions.filter((t: any) => t.transactionType === 'withdrawal');

  // Check for discrepancies
  const discrepancies: any[] = [];
  
  // Check for missing provider IDs
  const missingProviderIds = transactions.filter((t: any) => 
    !t.providerTransactionId && t.status === 'completed'
  );
  
  if (missingProviderIds.length > 0) {
    discrepancies.push({
      type: 'missing_provider_id',
      count: missingProviderIds.length,
      severity: 'medium',
      message: `${missingProviderIds.length} completed transactions missing provider IDs`
    });
  }

  // Check wallet balances consistency
  const wallets = await CreditWallet.find().lean();
  let balanceIssues = 0;
  
  for (const wallet of wallets) {
    const userDeposits = deposits.filter((d: any) => d.userId === wallet.userId);
    const userWithdrawals = withdrawals.filter((w: any) => w.userId === wallet.userId);
    
    const calculatedDeposits = userDeposits.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
    const calculatedWithdrawals = userWithdrawals.reduce((sum: number, w: any) => sum + (w.amount || 0), 0);
    
    // Check if totalDeposited matches sum of deposits (allowing small rounding errors)
    if (Math.abs((wallet.totalDeposited || 0) - calculatedDeposits) > 0.01) {
      balanceIssues++;
    }
  }
  
  if (balanceIssues > 0) {
    discrepancies.push({
      type: 'balance_mismatch',
      count: balanceIssues,
      severity: 'high',
      message: `${balanceIssues} wallets have deposit totals that don't match transaction history`
    });
  }

  return {
    type: 'stats',
    title: `Reconciliation Report (${period})`,
    data: {
      total_transactions: transactions.length,
      deposits: deposits.length,
      withdrawals: withdrawals.length,
      discrepancies_found: discrepancies.length,
      status: discrepancies.length === 0 ? '✅ All Clear' : '⚠️ Issues Found',
      issues: discrepancies.length > 0 
        ? discrepancies.map(d => `${d.type}: ${d.message}`).join('; ')
        : 'None'
    }
  };
}

async function executeSearchUsers(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const limit = args.limit || 20;
  
  const query: any = {};
  
  if (args.query) {
    query.$or = [
      { email: { $regex: args.query, $options: 'i' } },
      { name: { $regex: args.query, $options: 'i' } },
    ];
    
    if (mongoose.Types.ObjectId.isValid(args.query)) {
      query.$or.push({ _id: new mongoose.Types.ObjectId(args.query) });
    }
  }

  const users = await db.collection('user')
    .find(query)
    .limit(limit)
    .toArray();

  const data = users.map((u: any) => ({
    id: (u.id || u._id?.toString())?.substring(0, 8),
    email: u.email,
    name: u.name || '—',
    verified: u.emailVerified ? 'Yes' : 'No',
    country: u.country || '—',
    joined: new Date(u.createdAt).toLocaleDateString(),
  }));

  return {
    type: 'table',
    title: `Search Results (${data.length} users)`,
    data,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'email', label: 'Email' },
      { key: 'name', label: 'Name' },
      { key: 'verified', label: 'Verified', type: 'status' },
      { key: 'country', label: 'Country' },
      { key: 'joined', label: 'Joined' },
    ]
  };
}

async function executeGetHighRiskUsers(args: any): Promise<AgentResult> {
  const minScore = args.minScore || 50;
  const limit = args.limit || 20;
  const db = mongoose.connection.db!;

  // Use raw MongoDB query to avoid schema registration issues
  const highRiskScores = await db.collection('suspicionscores')
    .find({ totalScore: { $gte: minScore } })
    .sort({ totalScore: -1 })
    .limit(limit)
    .toArray();

  const userIds = highRiskScores.map((s: any) => s.userId?.toString()).filter(Boolean);
  const users = await db.collection('user').find({ 
    $or: [
      { id: { $in: userIds } },
      { _id: { $in: userIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id)).map((id: string) => new mongoose.Types.ObjectId(id)) } }
    ]
  }).toArray();
  const userMap = new Map(users.map((u: any) => [u.id || u._id?.toString(), u]));

  const data = highRiskScores.map((s: any) => {
    const user = userMap.get(s.userId?.toString());
    return {
      email: user?.email || 'Unknown',
      name: user?.name || '—',
      score: s.totalScore,
      riskLevel: s.totalScore >= 70 ? 'Critical' : s.totalScore >= 50 ? 'High' : 'Medium',
      lastUpdated: s.lastUpdated,
    };
  });

  return {
    type: 'table',
    title: `High Risk Users (Score ≥ ${minScore})`,
    data,
    columns: [
      { key: 'email', label: 'Email' },
      { key: 'name', label: 'Name' },
      { key: 'score', label: 'Score', type: 'number' },
      { key: 'riskLevel', label: 'Risk Level', type: 'status' },
      { key: 'lastUpdated', label: 'Last Updated', type: 'date' },
    ]
  };
}

async function executeGetTransactionHistory(args: any): Promise<AgentResult> {
  const limit = args.limit || 50;
  const query: any = {};
  
  if (args.type && args.type !== 'all') {
    query.transactionType = args.type;
  }
  
  if (args.status && args.status !== 'all') {
    query.status = args.status;
  }
  
  if (args.period && args.period !== 'all') {
    const now = new Date();
    switch (args.period) {
      case 'today':
        query.createdAt = { $gte: new Date(now.setHours(0, 0, 0, 0)) };
        break;
      case 'week':
        query.createdAt = { $gte: new Date(now.setDate(now.getDate() - 7)) };
        break;
      case 'month':
        query.createdAt = { $gte: new Date(now.setMonth(now.getMonth() - 1)) };
        break;
    }
  }

  const transactions = await WalletTransaction.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const db = mongoose.connection.db!;
  const userIds = [...new Set(transactions.map((t: any) => t.userId))];
  const users = await db.collection('user').find({ 
    $or: [
      { id: { $in: userIds } },
      { _id: { $in: userIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id)).map((id: string) => new mongoose.Types.ObjectId(id)) } }
    ]
  }).toArray();
  const userMap = new Map(users.map((u: any) => [u.id || u._id?.toString(), u]));

  const data = transactions.map((t: any) => {
    const user = userMap.get(t.userId);
    return {
      id: t._id.toString().substring(0, 8),
      type: t.transactionType,
      email: user?.email || 'Unknown',
      amount: t.amount,
      status: t.status,
      provider: t.provider || '—',
      createdAt: t.createdAt,
    };
  });

  return {
    type: 'table',
    title: `Transaction History (${data.length})`,
    data,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'type', label: 'Type', type: 'badge' },
      { key: 'email', label: 'User' },
      { key: 'amount', label: 'Amount', type: 'currency' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'provider', label: 'Provider' },
      { key: 'createdAt', label: 'Date', type: 'date' },
    ]
  };
}

// Tool execution dispatcher
async function executeTool(name: string, args: any): Promise<AgentResult> {
  switch (name) {
    case 'get_shared_payment_methods':
      return executeGetSharedPaymentMethods(args);
    case 'get_fraud_alerts':
      return executeGetFraudAlerts(args);
    case 'get_user_details':
      return executeGetUserDetails(args);
    case 'get_pending_kyc':
      return executeGetPendingKYC(args);
    case 'get_financial_summary':
      return executeGetFinancialSummary(args);
    case 'get_pending_withdrawals':
      return executeGetPendingWithdrawals(args);
    case 'get_user_statistics':
      return executeGetUserStatistics(args);
    case 'get_top_traders':
      return executeGetTopTraders(args);
    case 'run_reconciliation':
      return executeRunReconciliation(args);
    case 'search_users':
      return executeSearchUsers(args);
    case 'get_high_risk_users':
      return executeGetHighRiskUsers(args);
    case 'get_transaction_history':
      return executeGetTransactionHistory(args);
    default:
      return {
        type: 'text',
        title: 'Unknown Tool',
        data: `Tool '${name}' not found`
      };
  }
}

// Get AI configuration
async function getAIConfig() {
  try {
    await connectToDatabase();
    const settings = await WhiteLabel.findOne();
    if (settings?.openaiApiKey && settings?.openaiEnabled) {
      return {
        apiKey: settings.openaiApiKey,
        model: settings.openaiModel || 'gpt-4o-mini',
        enabled: true,
      };
    }
  } catch (error) {
    console.log('ℹ️ AI config not found in database, checking environment');
  }

  return {
    apiKey: process.env.OPENAI_API_KEY || null,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    enabled: !!process.env.OPENAI_API_KEY,
  };
}

// System prompt for the AI agent
const SYSTEM_PROMPT = `You are an intelligent AI assistant for the ChartVolt admin panel. You help administrators with:

1. **Fraud Detection & Security**: Finding shared payment methods, reviewing fraud alerts, checking suspicion scores
2. **User Management**: Looking up user details, KYC status, account information
3. **Financial Operations**: Running reconciliation, reviewing transactions, generating financial summaries
4. **Compliance**: KYC verification status, user restrictions, audit trails
5. **Analytics**: Top traders, user statistics, growth metrics

When responding:
- Be concise and professional
- Use the available tools to fetch real data
- Present data in appropriate formats (tables for lists, stats for summaries, alerts for warnings)
- Highlight any potential issues or anomalies you find
- Suggest follow-up actions when appropriate

You have access to the database through specialized tools. Always use these tools to get accurate, real-time data rather than making assumptions.

IMPORTANT: When users ask for specific data, call the appropriate tool first, then explain the results.`;

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array required' }, { status: 400 });
    }

    const config = await getAIConfig();

    if (!config.enabled || !config.apiKey) {
      return NextResponse.json({ 
        error: 'AI features are not configured. Please add your OpenAI API key in Environment Variables.' 
      }, { status: 400 });
    }

    await connectToDatabase();

    const openai = new OpenAI({ apiKey: config.apiKey });

    // Build messages with system prompt
    const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
    ];

    // Initial completion with tools
    let completion = await openai.chat.completions.create({
      model: config.model,
      messages: chatMessages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 2000,
    });

    let response = completion.choices[0]?.message;
    const toolCalls: ToolCall[] = [];
    const results: AgentResult[] = [];

    // Handle tool calls
    while (response?.tool_calls && response.tool_calls.length > 0) {
      const toolResults: OpenAI.ChatCompletionMessageParam[] = [];

      for (const toolCall of response.tool_calls) {
        // Type guard for function tool calls
        if (toolCall.type !== 'function') continue;
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`🤖 AI Agent calling tool: ${functionName}`, functionArgs);

        toolCalls.push({
          id: toolCall.id,
          name: functionName,
          arguments: functionArgs,
          status: 'running',
        });

        try {
          const result = await executeTool(functionName, functionArgs);
          results.push(result);
          
          toolCalls[toolCalls.length - 1].status = 'completed';
          toolCalls[toolCalls.length - 1].result = result;

          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } catch (error) {
          console.error(`Tool execution error (${functionName}):`, error);
          toolCalls[toolCalls.length - 1].status = 'error';
          
          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: error instanceof Error ? error.message : 'Tool execution failed' }),
          });
        }
      }

      // Continue conversation with tool results
      chatMessages.push(response);
      chatMessages.push(...toolResults);

      completion = await openai.chat.completions.create({
        model: config.model,
        messages: chatMessages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 2000,
      });

      response = completion.choices[0]?.message;
    }

    return NextResponse.json({
      content: response?.content || 'I apologize, but I was unable to generate a response.',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      results: results.length > 0 ? results : undefined,
    });

  } catch (error) {
    console.error('AI Agent error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI processing failed' },
      { status: 500 }
    );
  }
}

