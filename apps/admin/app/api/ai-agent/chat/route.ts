/**
 * AI Agent Chat API
 * 
 * Uses OpenAI function calling to execute database queries and return structured results
 * 
 * SECURITY FEATURES:
 * - Data masking: Sensitive data (emails, amounts, IDs) are anonymized before sending to OpenAI
 * - Audit logging: All queries are logged for compliance and monitoring
 * - Rate limiting: Prevents abuse
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
import AIAgentAudit from '@/database/models/ai-agent-audit.model';

// Import data masking utilities
import { 
  resetMaskingMap, 
  maskEmail, 
  maskName, 
  maskUserId,
  maskAmount,
  maskTotalAmount,
  maskFingerprint,
  maskCardLast4,
  maskTransactionId,
  maskDate,
  getMaskingSummary,
  maskSensitiveData
} from '@/lib/ai-agent/data-masking';

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
  },
  // ==================== COMPETITIONS ====================
  {
    type: 'function',
    function: {
      name: 'get_competitions',
      description: 'List all competitions with optional status filter. Shows competition details, participants, prize pools.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['draft', 'upcoming', 'active', 'completed', 'cancelled', 'all'],
            description: 'Competition status filter'
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
      name: 'get_competition_details',
      description: 'Get detailed information about a specific competition including settings, rules, and results',
      parameters: {
        type: 'object',
        properties: {
          competitionId: {
            type: 'string',
            description: 'Competition ID or slug'
          }
        },
        required: ['competitionId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_competition_leaderboard',
      description: 'Get the leaderboard/participant rankings for a specific competition',
      parameters: {
        type: 'object',
        properties: {
          competitionId: {
            type: 'string',
            description: 'Competition ID or slug'
          },
          limit: {
            type: 'number',
            description: 'Number of participants to show (default: 20)'
          }
        },
        required: ['competitionId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_competition_analytics',
      description: 'Get analytics and statistics across all competitions - win rates, popular assets, average returns',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['month', 'quarter', 'year', 'all'],
            description: 'Time period for analytics'
          }
        }
      }
    }
  },
  // ==================== CHALLENGES (1v1) ====================
  {
    type: 'function',
    function: {
      name: 'get_challenges',
      description: 'List 1v1 challenges with optional status filter',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'accepted', 'declined', 'expired', 'active', 'completed', 'cancelled', 'all'],
            description: 'Challenge status filter'
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
      name: 'get_challenge_details',
      description: 'Get detailed information about a specific 1v1 challenge',
      parameters: {
        type: 'object',
        properties: {
          challengeId: {
            type: 'string',
            description: 'Challenge ID or slug'
          }
        },
        required: ['challengeId']
      }
    }
  },
  // ==================== INVOICES & BILLING ====================
  {
    type: 'function',
    function: {
      name: 'get_invoices',
      description: 'List all invoices with optional filters for status, user, or date range',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['draft', 'sent', 'paid', 'cancelled', 'refunded', 'all'],
            description: 'Invoice status filter'
          },
          period: {
            type: 'string',
            enum: ['today', 'week', 'month', 'year', 'all'],
            description: 'Time period'
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 50)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_invoice_summary',
      description: 'Get invoice statistics - total invoiced, VAT collected, by status',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['month', 'quarter', 'year', 'all'],
            description: 'Time period for summary'
          }
        }
      }
    }
  },
  // ==================== PLATFORM FINANCIALS ====================
  {
    type: 'function',
    function: {
      name: 'get_platform_earnings',
      description: 'Get platform earnings breakdown - fees from deposits, withdrawals, competitions, unclaimed pools',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'week', 'month', 'quarter', 'year', 'all'],
            description: 'Time period'
          },
          breakdown: {
            type: 'boolean',
            description: 'Include detailed breakdown by type'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_vat_report',
      description: 'Get VAT collection report - collected, pending, paid to tax authority',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['month', 'quarter', 'year'],
            description: 'Time period for VAT report'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_fee_breakdown',
      description: 'Get detailed breakdown of all fees - deposit fees, withdrawal fees, bank fees, net platform earnings',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'week', 'month', 'all'],
            description: 'Time period'
          }
        }
      }
    }
  },
  // ==================== TRADING POSITIONS ====================
  {
    type: 'function',
    function: {
      name: 'get_open_positions',
      description: 'Get all currently open trading positions across competitions',
      parameters: {
        type: 'object',
        properties: {
          competitionId: {
            type: 'string',
            description: 'Filter by specific competition (optional)'
          },
          symbol: {
            type: 'string',
            description: 'Filter by trading symbol (optional)'
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 50)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_trading_activity',
      description: 'Get recent trading activity - orders, trades, position changes',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['hour', 'today', 'week'],
            description: 'Time period'
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 50)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_margin_status',
      description: 'Get users/positions at risk of margin call or liquidation',
      parameters: {
        type: 'object',
        properties: {
          riskLevel: {
            type: 'string',
            enum: ['warning', 'critical', 'all'],
            description: 'Risk level filter'
          }
        }
      }
    }
  },
  // ==================== USER MANAGEMENT ====================
  {
    type: 'function',
    function: {
      name: 'get_user_restrictions',
      description: 'Get all users with active restrictions (deposits, withdrawals, trading blocked)',
      parameters: {
        type: 'object',
        properties: {
          restrictionType: {
            type: 'string',
            enum: ['deposit', 'withdraw', 'trade', 'login', 'all'],
            description: 'Type of restriction'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_user_badges',
      description: 'Get badge distribution statistics - how many users have each badge',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_user_levels',
      description: 'Get user level/XP distribution - how many users at each level',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_online_users',
      description: 'Get currently online users count and list',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum users to list (default: 20)'
          }
        }
      }
    }
  },
  // ==================== SYSTEM STATUS ====================
  {
    type: 'function',
    function: {
      name: 'get_payment_providers',
      description: 'Get status of all payment providers - enabled, active, last transaction',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_system_notifications',
      description: 'Get recent system notifications and alerts',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['system', 'user', 'admin', 'all'],
            description: 'Notification type'
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 30)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_audit_logs',
      description: 'Get recent admin audit logs - who did what actions',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'Filter by action type (optional)'
          },
          adminEmail: {
            type: 'string',
            description: 'Filter by admin email (optional)'
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 50)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_account_lockouts',
      description: 'Get accounts currently locked out due to failed login attempts',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum results (default: 50)'
          }
        }
      }
    }
  },
  // ==================== DASHBOARD SUMMARY ====================
  {
    type: 'function',
    function: {
      name: 'get_dashboard_overview',
      description: 'Get a comprehensive dashboard overview with key metrics - users, revenue, active competitions, pending items',
      parameters: {
        type: 'object',
        properties: {}
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
  
  // Create new date for each calculation to avoid mutation issues
  const getDateFilter = () => {
    const now = new Date();
    switch (period) {
      case 'today':
        return { $gte: new Date(now.setHours(0, 0, 0, 0)) };
      case 'week':
        return { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
      case 'month':
        return { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
      case 'year':
        return { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) };
      default:
        return {};
    }
  };

  const dateFilter = getDateFilter();
  
  const depositQuery: any = { transactionType: 'deposit', status: 'completed' };
  const withdrawalQuery: any = { transactionType: 'withdrawal', status: 'completed' };
  const withdrawalFeeQuery: any = { transactionType: 'withdrawal_fee', status: 'completed' };
  const platformFeeQuery: any = { transactionType: 'platform_fee', status: 'completed' };
  
  if (period !== 'all' && Object.keys(dateFilter).length > 0) {
    depositQuery.processedAt = dateFilter;
    withdrawalQuery.processedAt = dateFilter;
    withdrawalFeeQuery.createdAt = dateFilter;
    platformFeeQuery.createdAt = dateFilter;
  }

  const [deposits, withdrawals, withdrawalFees, platformFees] = await Promise.all([
    WalletTransaction.find(depositQuery).lean(),
    WalletTransaction.find(withdrawalQuery).lean(),
    WalletTransaction.find(withdrawalFeeQuery).lean(),
    WalletTransaction.find(platformFeeQuery).lean(),
  ]);

  // Calculate deposit totals (amount is in credits, EUR value is in metadata)
  const totalDepositsCredits = deposits.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
  
  // Get EUR values from metadata for accurate financial reporting
  const totalDepositsEUR = deposits.reduce((sum: number, d: any) => {
    // Try to get actual EUR charged from metadata
    const eurValue = d.metadata?.totalCharged || d.metadata?.eurAmount || (d.amount / (d.exchangeRate || 1));
    return sum + eurValue;
  }, 0);

  // Platform fees from deposit metadata
  const depositPlatformFees = deposits.reduce((sum: number, d: any) => {
    return sum + (d.metadata?.platformFeeAmount || 0);
  }, 0);
  
  // Bank fees from deposit metadata
  const depositBankFees = deposits.reduce((sum: number, d: any) => {
    return sum + (d.metadata?.bankFeeTotal || 0);
  }, 0);

  // VAT from deposit metadata
  const totalVAT = deposits.reduce((sum: number, d: any) => {
    return sum + (d.metadata?.vatAmount || d.metadata?.actualVatAmount || 0);
  }, 0);

  // Withdrawal totals
  const totalWithdrawalsCredits = withdrawals.reduce((sum: number, w: any) => sum + (w.amount || 0), 0);
  const totalWithdrawalsEUR = withdrawals.reduce((sum: number, w: any) => {
    return sum + (w.metadata?.eurGross || (w.amount / (w.exchangeRate || 1)));
  }, 0);

  // Withdrawal fees collected
  const withdrawalFeesCollected = withdrawalFees.reduce((sum: number, w: any) => Math.abs(sum + (w.amount || 0)), 0);
  const withdrawalFeesEUR = withdrawals.reduce((sum: number, w: any) => {
    return sum + (w.metadata?.platformFeeAmountEUR || 0);
  }, 0);

  // Platform fees from competition winnings
  const competitionPlatformFees = platformFees.reduce((sum: number, p: any) => Math.abs(sum + (p.amount || 0)), 0);

  // Total platform revenue (fees collected)
  const totalPlatformRevenue = depositPlatformFees + withdrawalFeesEUR + competitionPlatformFees;
  
  // Net platform earning (after paying bank fees)
  const netPlatformEarning = totalPlatformRevenue - depositBankFees;

  return {
    type: 'stats',
    title: `Financial Summary (${period})`,
    data: {
      // Deposits
      total_deposits_eur: `€${totalDepositsEUR.toFixed(2)}`,
      total_deposits_credits: `${totalDepositsCredits.toLocaleString()} credits`,
      deposit_count: deposits.length,
      // Withdrawals
      total_withdrawals_eur: `€${totalWithdrawalsEUR.toFixed(2)}`,
      withdrawal_count: withdrawals.length,
      // Fees & Revenue
      deposit_fees_collected: `€${depositPlatformFees.toFixed(2)}`,
      withdrawal_fees_collected: `€${withdrawalFeesEUR.toFixed(2)}`,
      bank_fees_paid: `€${depositBankFees.toFixed(2)}`,
      vat_collected: `€${totalVAT.toFixed(2)}`,
      // Summary
      total_platform_revenue: `€${totalPlatformRevenue.toFixed(2)}`,
      net_platform_earning: `€${netPlatformEarning.toFixed(2)}`,
      net_flow_eur: `€${(totalDepositsEUR - totalWithdrawalsEUR).toFixed(2)}`,
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
  const db = mongoose.connection.db!;
  
  // Create date filter without mutation
  const getDateFilter = () => {
    switch (period) {
      case 'today':
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return { $gte: today };
      case 'week':
        return { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
      case 'month':
        return { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
      default:
        return {};
    }
  };

  const dateFilter = getDateFilter();
  const hasDateFilter = Object.keys(dateFilter).length > 0;

  // Get all transactions in period (not just completed)
  const allTransactionsQuery: any = {};
  if (hasDateFilter) {
    allTransactionsQuery.$or = [
      { processedAt: dateFilter },
      { createdAt: dateFilter }
    ];
  }

  const allTransactions = await WalletTransaction.find(allTransactionsQuery).lean();

  // Categorize transactions
  const deposits = allTransactions.filter((t: any) => t.transactionType === 'deposit');
  const withdrawals = allTransactions.filter((t: any) => t.transactionType === 'withdrawal');
  const completedDeposits = deposits.filter((t: any) => t.status === 'completed');
  const completedWithdrawals = withdrawals.filter((t: any) => t.status === 'completed');
  const pendingDeposits = deposits.filter((t: any) => t.status === 'pending');
  const failedDeposits = deposits.filter((t: any) => t.status === 'failed');
  const pendingWithdrawals = withdrawals.filter((t: any) => t.status === 'pending' || t.status === 'processing');

  // Check for discrepancies
  const discrepancies: any[] = [];
  const issueDetails: string[] = [];
  
  // 1. Check for missing provider transaction IDs on completed transactions
  const missingProviderIds = completedDeposits.filter((t: any) => 
    !t.providerTransactionId && t.provider !== 'manual'
  );
  
  if (missingProviderIds.length > 0) {
    discrepancies.push({
      type: 'missing_provider_id',
      count: missingProviderIds.length,
      severity: 'medium',
    });
    issueDetails.push(`⚠️ ${missingProviderIds.length} deposits missing provider transaction IDs`);
  }

  // 2. Check for transactions requiring manual review
  const requiresManualReview = allTransactions.filter((t: any) => 
    t.metadata?.requiresManualReview === true
  );
  
  if (requiresManualReview.length > 0) {
    discrepancies.push({
      type: 'manual_review_required',
      count: requiresManualReview.length,
      severity: 'high',
    });
    issueDetails.push(`🚨 ${requiresManualReview.length} transactions need manual review`);
  }

  // 3. Check for stuck pending transactions (older than 1 hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const stuckPending = allTransactions.filter((t: any) => 
    t.status === 'pending' && new Date(t.createdAt) < oneHourAgo
  );
  
  if (stuckPending.length > 0) {
    discrepancies.push({
      type: 'stuck_pending',
      count: stuckPending.length,
      severity: 'medium',
    });
    issueDetails.push(`⏳ ${stuckPending.length} transactions stuck in pending state`);
  }

  // 4. Calculate financial totals for reconciliation
  const totalDepositsEUR = completedDeposits.reduce((sum: number, d: any) => {
    return sum + (d.metadata?.totalCharged || d.metadata?.eurAmount || (d.amount / (d.exchangeRate || 1)));
  }, 0);

  const totalWithdrawalsEUR = completedWithdrawals.reduce((sum: number, w: any) => {
    return sum + (w.metadata?.eurGross || (w.amount / (w.exchangeRate || 1)));
  }, 0);

  const totalFeesCollected = completedDeposits.reduce((sum: number, d: any) => {
    return sum + (d.metadata?.platformFeeAmount || 0);
  }, 0);

  // 5. Check by provider for completeness
  const byProvider: Record<string, { deposits: number; withdrawals: number; total: number }> = {};
  allTransactions.forEach((t: any) => {
    const provider = t.provider || 'unknown';
    if (!byProvider[provider]) {
      byProvider[provider] = { deposits: 0, withdrawals: 0, total: 0 };
    }
    if (t.transactionType === 'deposit' && t.status === 'completed') {
      byProvider[provider].deposits++;
      byProvider[provider].total += t.metadata?.totalCharged || (t.amount / (t.exchangeRate || 1));
    }
    if (t.transactionType === 'withdrawal' && t.status === 'completed') {
      byProvider[provider].withdrawals++;
    }
  });

  // Build provider breakdown string
  const providerBreakdown = Object.entries(byProvider)
    .map(([p, v]) => `${p}: ${v.deposits}D/${v.withdrawals}W (€${v.total.toFixed(2)})`)
    .join(', ');

  return {
    type: 'stats',
    title: `Reconciliation Report (${period})`,
    data: {
      // Transaction counts
      total_transactions: allTransactions.length,
      completed_deposits: `${completedDeposits.length} (€${totalDepositsEUR.toFixed(2)})`,
      completed_withdrawals: `${completedWithdrawals.length} (€${totalWithdrawalsEUR.toFixed(2)})`,
      pending_deposits: pendingDeposits.length,
      pending_withdrawals: pendingWithdrawals.length,
      failed_deposits: failedDeposits.length,
      // Financial
      fees_collected: `€${totalFeesCollected.toFixed(2)}`,
      net_flow: `€${(totalDepositsEUR - totalWithdrawalsEUR).toFixed(2)}`,
      // Provider breakdown
      by_provider: providerBreakdown || 'No data',
      // Issues
      issues_found: discrepancies.length,
      status: discrepancies.length === 0 ? '✅ All Clear' : '⚠️ Issues Found',
      issue_details: issueDetails.length > 0 ? issueDetails.join(' | ') : 'None'
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

// ==================== COMPETITION EXECUTION FUNCTIONS ====================

async function executeGetCompetitions(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const limit = args.limit || 20;
  const query: any = {};
  
  if (args.status && args.status !== 'all') {
    query.status = args.status;
  }

  const competitions = await db.collection('competitions')
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  const data = competitions.map((c: any) => ({
    id: c._id.toString().substring(0, 8),
    name: c.name,
    status: c.status,
    type: c.competitionType,
    entryFee: c.entryFee,
    prizePool: c.prizePool,
    participants: `${c.currentParticipants}/${c.maxParticipants}`,
    startTime: c.startTime,
    endTime: c.endTime,
  }));

  return {
    type: 'table',
    title: `Competitions (${data.length})`,
    data,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'type', label: 'Type', type: 'badge' },
      { key: 'entryFee', label: 'Entry Fee', type: 'number' },
      { key: 'prizePool', label: 'Prize Pool', type: 'number' },
      { key: 'participants', label: 'Participants' },
      { key: 'startTime', label: 'Start', type: 'date' },
      { key: 'endTime', label: 'End', type: 'date' },
    ]
  };
}

async function executeGetCompetitionDetails(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  
  let competition: any = null;
  if (mongoose.Types.ObjectId.isValid(args.competitionId)) {
    competition = await db.collection('competitions').findOne({ _id: new mongoose.Types.ObjectId(args.competitionId) });
  }
  if (!competition) {
    competition = await db.collection('competitions').findOne({ slug: args.competitionId });
  }
  
  if (!competition) {
    return { type: 'text', title: 'Not Found', data: 'Competition not found' };
  }

  const participantCount = await db.collection('competitionparticipants').countDocuments({ competitionId: competition._id.toString() });
  const activePositions = await db.collection('tradingpositions').countDocuments({ 
    competitionId: competition._id.toString(), 
    status: 'open' 
  });

  return {
    type: 'stats',
    title: `Competition: ${competition.name}`,
    data: {
      id: competition._id.toString(),
      name: competition.name,
      status: competition.status,
      type: competition.competitionType,
      entry_fee: `${competition.entryFee} credits`,
      starting_capital: competition.startingCapital,
      prize_pool: `${competition.prizePool} credits`,
      platform_fee: `${competition.platformFeePercentage}%`,
      participants: `${participantCount}/${competition.maxParticipants}`,
      min_participants: competition.minParticipants,
      start_time: new Date(competition.startTime).toLocaleString(),
      end_time: new Date(competition.endTime).toLocaleString(),
      registration_deadline: new Date(competition.registrationDeadline).toLocaleString(),
      active_positions: activePositions,
      leverage: competition.leverage?.enabled ? `${competition.leverage.min}-${competition.leverage.max}x` : 'Disabled',
      ranking_method: competition.rules?.rankingMethod || 'pnl',
      asset_classes: competition.assetClasses?.join(', ') || 'All',
      winner: competition.winnerId || 'TBD',
    }
  };
}

async function executeGetCompetitionLeaderboard(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const limit = args.limit || 20;
  
  let competitionId = args.competitionId;
  if (mongoose.Types.ObjectId.isValid(competitionId)) {
    competitionId = competitionId;
  } else {
    const comp = await db.collection('competitions').findOne({ slug: competitionId });
    if (comp) competitionId = comp._id.toString();
  }

  const participants = await db.collection('competitionparticipants')
    .find({ competitionId: competitionId })
    .sort({ pnl: -1, currentCapital: -1 })
    .limit(limit)
    .toArray();

  const data = participants.map((p: any, index: number) => ({
    rank: index + 1,
    username: p.username,
    email: p.email,
    capital: p.currentCapital?.toFixed(2) || '0',
    pnl: p.pnl?.toFixed(2) || '0',
    pnlPercent: `${p.pnlPercentage?.toFixed(2) || 0}%`,
    trades: p.totalTrades,
    winRate: `${p.winRate?.toFixed(1) || 0}%`,
    status: p.status,
  }));

  return {
    type: 'table',
    title: `Competition Leaderboard (${data.length} participants)`,
    data,
    columns: [
      { key: 'rank', label: '#', type: 'number' },
      { key: 'username', label: 'Username' },
      { key: 'email', label: 'Email' },
      { key: 'capital', label: 'Capital', type: 'number' },
      { key: 'pnl', label: 'P&L', type: 'number' },
      { key: 'pnlPercent', label: 'P&L %' },
      { key: 'trades', label: 'Trades', type: 'number' },
      { key: 'winRate', label: 'Win Rate' },
      { key: 'status', label: 'Status', type: 'status' },
    ]
  };
}

async function executeGetCompetitionAnalytics(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const period = args.period || 'all';
  
  let dateFilter: any = {};
  const now = new Date();
  switch (period) {
    case 'month': dateFilter = { $gte: new Date(now.setMonth(now.getMonth() - 1)) }; break;
    case 'quarter': dateFilter = { $gte: new Date(now.setMonth(now.getMonth() - 3)) }; break;
    case 'year': dateFilter = { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) }; break;
  }

  const query = period !== 'all' ? { createdAt: dateFilter } : {};
  
  const [totalComps, activeComps, completedComps, participants, totalPrizePool] = await Promise.all([
    db.collection('competitions').countDocuments(query),
    db.collection('competitions').countDocuments({ ...query, status: 'active' }),
    db.collection('competitions').countDocuments({ ...query, status: 'completed' }),
    db.collection('competitionparticipants').countDocuments(),
    db.collection('competitions').aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$prizePool' } } }
    ]).toArray()
  ]);

  const avgParticipants = await db.collection('competitions').aggregate([
    { $match: query },
    { $group: { _id: null, avg: { $avg: '$currentParticipants' } } }
  ]).toArray();

  return {
    type: 'stats',
    title: `Competition Analytics (${period})`,
    data: {
      total_competitions: totalComps,
      active_competitions: activeComps,
      completed_competitions: completedComps,
      total_participants: participants,
      total_prize_pool: `${totalPrizePool[0]?.total || 0} credits`,
      avg_participants: (avgParticipants[0]?.avg || 0).toFixed(1),
    }
  };
}

// ==================== CHALLENGE EXECUTION FUNCTIONS ====================

async function executeGetChallenges(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const limit = args.limit || 20;
  const query: any = {};
  
  if (args.status && args.status !== 'all') {
    query.status = args.status;
  }

  const challenges = await db.collection('challenges')
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  const data = challenges.map((c: any) => ({
    id: c._id.toString().substring(0, 8),
    challenger: c.challengerName,
    challenged: c.challengedName,
    status: c.status,
    entryFee: c.entryFee,
    prizePool: c.prizePool,
    duration: `${c.duration} min`,
    winner: c.winnerName || '—',
    createdAt: c.createdAt,
  }));

  return {
    type: 'table',
    title: `1v1 Challenges (${data.length})`,
    data,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'challenger', label: 'Challenger' },
      { key: 'challenged', label: 'Challenged' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'entryFee', label: 'Entry', type: 'number' },
      { key: 'prizePool', label: 'Pool', type: 'number' },
      { key: 'duration', label: 'Duration' },
      { key: 'winner', label: 'Winner' },
      { key: 'createdAt', label: 'Created', type: 'date' },
    ]
  };
}

async function executeGetChallengeDetails(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  
  let challenge: any = null;
  if (mongoose.Types.ObjectId.isValid(args.challengeId)) {
    challenge = await db.collection('challenges').findOne({ _id: new mongoose.Types.ObjectId(args.challengeId) });
  }
  if (!challenge) {
    challenge = await db.collection('challenges').findOne({ slug: args.challengeId });
  }
  
  if (!challenge) {
    return { type: 'text', title: 'Not Found', data: 'Challenge not found' };
  }

  return {
    type: 'stats',
    title: `Challenge: ${challenge.challengerName} vs ${challenge.challengedName}`,
    data: {
      id: challenge._id.toString(),
      status: challenge.status,
      challenger: `${challenge.challengerName} (${challenge.challengerEmail})`,
      challenged: `${challenge.challengedName} (${challenge.challengedEmail})`,
      entry_fee: `${challenge.entryFee} credits each`,
      prize_pool: `${challenge.prizePool} credits`,
      winner_prize: `${challenge.winnerPrize} credits`,
      platform_fee: `${challenge.platformFeePercentage}% (${challenge.platformFeeAmount} credits)`,
      duration: `${challenge.duration} minutes`,
      starting_capital: challenge.startingCapital,
      created: new Date(challenge.createdAt).toLocaleString(),
      start_time: challenge.startTime ? new Date(challenge.startTime).toLocaleString() : 'Not started',
      end_time: challenge.endTime ? new Date(challenge.endTime).toLocaleString() : 'Not ended',
      winner: challenge.winnerName || 'TBD',
      challenger_pnl: challenge.challengerFinalStats?.pnl?.toFixed(2) || '—',
      challenged_pnl: challenge.challengedFinalStats?.pnl?.toFixed(2) || '—',
    }
  };
}

// ==================== INVOICE EXECUTION FUNCTIONS ====================

async function executeGetInvoices(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const limit = args.limit || 50;
  const query: any = {};
  
  if (args.status && args.status !== 'all') {
    query.status = args.status;
  }
  
  if (args.period && args.period !== 'all') {
    const now = new Date();
    switch (args.period) {
      case 'today': query.invoiceDate = { $gte: new Date(now.setHours(0, 0, 0, 0)) }; break;
      case 'week': query.invoiceDate = { $gte: new Date(now.setDate(now.getDate() - 7)) }; break;
      case 'month': query.invoiceDate = { $gte: new Date(now.setMonth(now.getMonth() - 1)) }; break;
      case 'year': query.invoiceDate = { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) }; break;
    }
  }

  const invoices = await db.collection('invoices')
    .find(query)
    .sort({ invoiceDate: -1 })
    .limit(limit)
    .toArray();

  const data = invoices.map((inv: any) => ({
    number: inv.invoiceNumber,
    customer: inv.customerName,
    email: inv.customerEmail,
    total: inv.total,
    vat: inv.vatAmount,
    status: inv.status,
    type: inv.transactionType,
    date: inv.invoiceDate,
  }));

  return {
    type: 'table',
    title: `Invoices (${data.length})`,
    data,
    columns: [
      { key: 'number', label: 'Invoice #' },
      { key: 'customer', label: 'Customer' },
      { key: 'email', label: 'Email' },
      { key: 'total', label: 'Total', type: 'currency' },
      { key: 'vat', label: 'VAT', type: 'currency' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'type', label: 'Type', type: 'badge' },
      { key: 'date', label: 'Date', type: 'date' },
    ]
  };
}

async function executeGetInvoiceSummary(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const period = args.period || 'month';
  
  let dateFilter: any = {};
  const now = new Date();
  switch (period) {
    case 'month': dateFilter = { $gte: new Date(now.setMonth(now.getMonth() - 1)) }; break;
    case 'quarter': dateFilter = { $gte: new Date(now.setMonth(now.getMonth() - 3)) }; break;
    case 'year': dateFilter = { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) }; break;
  }

  const query = { invoiceDate: dateFilter };
  
  const stats = await db.collection('invoices').aggregate([
    { $match: query },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        total: { $sum: '$total' },
        vat: { $sum: '$vatAmount' }
      }
    }
  ]).toArray();

  const totals = await db.collection('invoices').aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalInvoiced: { $sum: '$total' },
        totalVAT: { $sum: '$vatAmount' },
        count: { $sum: 1 }
      }
    }
  ]).toArray();

  const statusBreakdown = stats.reduce((acc: any, s: any) => {
    acc[`${s._id}_count`] = s.count;
    acc[`${s._id}_total`] = `€${s.total.toFixed(2)}`;
    return acc;
  }, {});

  return {
    type: 'stats',
    title: `Invoice Summary (${period})`,
    data: {
      total_invoices: totals[0]?.count || 0,
      total_invoiced: `€${(totals[0]?.totalInvoiced || 0).toFixed(2)}`,
      total_vat_collected: `€${(totals[0]?.totalVAT || 0).toFixed(2)}`,
      ...statusBreakdown
    }
  };
}

// ==================== PLATFORM EARNINGS EXECUTION FUNCTIONS ====================

async function executeGetPlatformEarnings(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const period = args.period || 'month';
  const breakdown = args.breakdown || false;
  
  let dateFilter: any = {};
  const now = new Date();
  switch (period) {
    case 'today': dateFilter = { $gte: new Date(now.setHours(0, 0, 0, 0)) }; break;
    case 'week': dateFilter = { $gte: new Date(now.setDate(now.getDate() - 7)) }; break;
    case 'month': dateFilter = { $gte: new Date(now.setMonth(now.getMonth() - 1)) }; break;
    case 'quarter': dateFilter = { $gte: new Date(now.setMonth(now.getMonth() - 3)) }; break;
    case 'year': dateFilter = { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) }; break;
  }

  const query = period !== 'all' ? { createdAt: dateFilter } : {};

  const earnings = await db.collection('platformtransactions').aggregate([
    { $match: query },
    {
      $group: {
        _id: '$transactionType',
        total: { $sum: '$amountEUR' },
        count: { $sum: 1 }
      }
    }
  ]).toArray();

  const earningsMap = earnings.reduce((acc: any, e: any) => {
    acc[e._id] = { total: e.total, count: e.count };
    return acc;
  }, {});

  const data: any = {
    deposit_fees: `€${(earningsMap.deposit_fee?.total || 0).toFixed(2)} (${earningsMap.deposit_fee?.count || 0})`,
    withdrawal_fees: `€${(earningsMap.withdrawal_fee?.total || 0).toFixed(2)} (${earningsMap.withdrawal_fee?.count || 0})`,
    competition_fees: `€${(earningsMap.platform_fee?.total || 0).toFixed(2)} (${earningsMap.platform_fee?.count || 0})`,
    challenge_fees: `€${(earningsMap.challenge_platform_fee?.total || 0).toFixed(2)} (${earningsMap.challenge_platform_fee?.count || 0})`,
    unclaimed_pools: `€${(earningsMap.unclaimed_pool?.total || 0).toFixed(2)} (${earningsMap.unclaimed_pool?.count || 0})`,
    admin_withdrawals: `€${Math.abs(earningsMap.admin_withdrawal?.total || 0).toFixed(2)} (${earningsMap.admin_withdrawal?.count || 0})`,
  };

  const totalEarnings = Object.values(earningsMap).reduce((sum: number, e: any) => {
    if (e._id !== 'admin_withdrawal') return sum + e.total;
    return sum;
  }, 0);
  
  data.total_earnings = `€${totalEarnings.toFixed(2)}`;
  data.net_balance = `€${(totalEarnings - Math.abs(earningsMap.admin_withdrawal?.total || 0)).toFixed(2)}`;

  return {
    type: 'stats',
    title: `Platform Earnings (${period})`,
    data
  };
}

async function executeGetVATReport(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const period = args.period || 'month';
  
  let dateFilter: any = {};
  const now = new Date();
  switch (period) {
    case 'month': dateFilter = { $gte: new Date(now.setMonth(now.getMonth() - 1)) }; break;
    case 'quarter': dateFilter = { $gte: new Date(now.setMonth(now.getMonth() - 3)) }; break;
    case 'year': dateFilter = { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) }; break;
  }

  // Get VAT from transactions
  const vatCollected = await db.collection('wallettransactions').aggregate([
    { 
      $match: { 
        status: 'completed',
        processedAt: dateFilter 
      } 
    },
    {
      $group: {
        _id: null,
        totalVAT: { $sum: '$metadata.vatAmount' },
        count: { $sum: 1 }
      }
    }
  ]).toArray();

  // Get VAT payments
  const vatPayments = await db.collection('vatpayments')
    .find({ periodStart: dateFilter })
    .toArray();

  const paidVAT = vatPayments.filter((v: any) => v.status === 'paid')
    .reduce((sum: number, v: any) => sum + v.vatAmountEUR, 0);
  const pendingVAT = vatPayments.filter((v: any) => v.status === 'pending')
    .reduce((sum: number, v: any) => sum + v.vatAmountEUR, 0);

  return {
    type: 'stats',
    title: `VAT Report (${period})`,
    data: {
      vat_collected: `€${(vatCollected[0]?.totalVAT || 0).toFixed(2)}`,
      transactions_with_vat: vatCollected[0]?.count || 0,
      vat_paid_to_authority: `€${paidVAT.toFixed(2)}`,
      vat_pending_payment: `€${pendingVAT.toFixed(2)}`,
      vat_periods_recorded: vatPayments.length,
    }
  };
}

async function executeGetFeeBreakdown(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const period = args.period || 'month';
  
  let dateFilter: any = {};
  const now = new Date();
  switch (period) {
    case 'today': dateFilter = { $gte: new Date(now.setHours(0, 0, 0, 0)) }; break;
    case 'week': dateFilter = { $gte: new Date(now.setDate(now.getDate() - 7)) }; break;
    case 'month': dateFilter = { $gte: new Date(now.setMonth(now.getMonth() - 1)) }; break;
  }

  const query = period !== 'all' ? { processedAt: dateFilter, status: 'completed' } : { status: 'completed' };

  const fees = await db.collection('wallettransactions').aggregate([
    { $match: query },
    {
      $group: {
        _id: '$transactionType',
        platformFees: { $sum: '$metadata.platformFeeAmount' },
        bankFees: { $sum: '$metadata.bankFeeTotal' },
        vatAmount: { $sum: '$metadata.vatAmount' },
        count: { $sum: 1 }
      }
    }
  ]).toArray();

  const depositFees = fees.find((f: any) => f._id === 'deposit') || { platformFees: 0, bankFees: 0, vatAmount: 0, count: 0 };
  const withdrawalFees = fees.find((f: any) => f._id === 'withdrawal') || { platformFees: 0, bankFees: 0, vatAmount: 0, count: 0 };

  const netEarnings = (depositFees.platformFees + withdrawalFees.platformFees) - (depositFees.bankFees + withdrawalFees.bankFees);

  return {
    type: 'stats',
    title: `Fee Breakdown (${period})`,
    data: {
      deposit_platform_fees: `€${depositFees.platformFees.toFixed(2)} (${depositFees.count} transactions)`,
      deposit_bank_fees: `€${depositFees.bankFees.toFixed(2)}`,
      deposit_vat_collected: `€${depositFees.vatAmount.toFixed(2)}`,
      withdrawal_platform_fees: `€${withdrawalFees.platformFees.toFixed(2)} (${withdrawalFees.count} transactions)`,
      withdrawal_bank_fees: `€${withdrawalFees.bankFees.toFixed(2)}`,
      total_platform_fees: `€${(depositFees.platformFees + withdrawalFees.platformFees).toFixed(2)}`,
      total_bank_fees: `€${(depositFees.bankFees + withdrawalFees.bankFees).toFixed(2)}`,
      net_platform_earnings: `€${netEarnings.toFixed(2)}`,
    }
  };
}

// ==================== TRADING EXECUTION FUNCTIONS ====================

async function executeGetOpenPositions(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const limit = args.limit || 50;
  const query: any = { status: 'open' };
  
  if (args.competitionId) query.competitionId = args.competitionId;
  if (args.symbol) query.symbol = args.symbol.toUpperCase();

  const positions = await db.collection('tradingpositions')
    .find(query)
    .sort({ unrealizedPnl: -1 })
    .limit(limit)
    .toArray();

  const data = positions.map((p: any) => ({
    id: p._id.toString().substring(0, 8),
    symbol: p.symbol,
    side: p.side,
    quantity: p.quantity,
    entryPrice: p.entryPrice?.toFixed(5),
    currentPrice: p.currentPrice?.toFixed(5),
    pnl: p.unrealizedPnl?.toFixed(2),
    pnlPercent: `${p.unrealizedPnlPercentage?.toFixed(2)}%`,
    leverage: `${p.leverage}x`,
    openedAt: p.openedAt,
  }));

  return {
    type: 'table',
    title: `Open Positions (${data.length})`,
    data,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'symbol', label: 'Symbol' },
      { key: 'side', label: 'Side', type: 'badge' },
      { key: 'quantity', label: 'Qty', type: 'number' },
      { key: 'entryPrice', label: 'Entry' },
      { key: 'currentPrice', label: 'Current' },
      { key: 'pnl', label: 'P&L', type: 'number' },
      { key: 'pnlPercent', label: 'P&L %' },
      { key: 'leverage', label: 'Leverage' },
      { key: 'openedAt', label: 'Opened', type: 'date' },
    ]
  };
}

async function executeGetTradingActivity(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const limit = args.limit || 50;
  
  let dateFilter: any = {};
  const now = new Date();
  switch (args.period || 'today') {
    case 'hour': dateFilter = { $gte: new Date(now.getTime() - 60 * 60 * 1000) }; break;
    case 'today': dateFilter = { $gte: new Date(now.setHours(0, 0, 0, 0)) }; break;
    case 'week': dateFilter = { $gte: new Date(now.setDate(now.getDate() - 7)) }; break;
  }

  const trades = await db.collection('tradehistory')
    .find({ closedAt: dateFilter })
    .sort({ closedAt: -1 })
    .limit(limit)
    .toArray();

  const data = trades.map((t: any) => ({
    id: t._id.toString().substring(0, 8),
    symbol: t.symbol,
    side: t.side,
    quantity: t.quantity,
    entryPrice: t.entryPrice?.toFixed(5),
    exitPrice: t.exitPrice?.toFixed(5),
    pnl: t.realizedPnl?.toFixed(2),
    closeReason: t.closeReason,
    closedAt: t.closedAt,
  }));

  return {
    type: 'table',
    title: `Trading Activity (${data.length} trades)`,
    data,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'symbol', label: 'Symbol' },
      { key: 'side', label: 'Side', type: 'badge' },
      { key: 'quantity', label: 'Qty', type: 'number' },
      { key: 'entryPrice', label: 'Entry' },
      { key: 'exitPrice', label: 'Exit' },
      { key: 'pnl', label: 'P&L', type: 'number' },
      { key: 'closeReason', label: 'Reason', type: 'badge' },
      { key: 'closedAt', label: 'Closed', type: 'date' },
    ]
  };
}

async function executeGetMarginStatus(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const riskLevel = args.riskLevel || 'all';

  const participants = await db.collection('competitionparticipants')
    .find({ status: 'active' })
    .toArray();

  const atRisk = participants.filter((p: any) => {
    const capitalRatio = (p.currentCapital / p.startingCapital) * 100;
    if (riskLevel === 'critical') return capitalRatio < 30;
    if (riskLevel === 'warning') return capitalRatio < 60 && capitalRatio >= 30;
    return capitalRatio < 60; // All at-risk
  });

  const data = atRisk.map((p: any) => {
    const capitalRatio = (p.currentCapital / p.startingCapital) * 100;
    return {
      username: p.username,
      email: p.email,
      currentCapital: p.currentCapital?.toFixed(2),
      startingCapital: p.startingCapital,
      capitalRatio: `${capitalRatio.toFixed(1)}%`,
      riskLevel: capitalRatio < 30 ? 'Critical' : 'Warning',
      marginWarnings: p.marginCallWarnings,
      usedMargin: p.usedMargin?.toFixed(2),
    };
  }).sort((a: any, b: any) => parseFloat(a.capitalRatio) - parseFloat(b.capitalRatio));

  return {
    type: 'table',
    title: `Margin Status (${data.length} at risk)`,
    data,
    columns: [
      { key: 'username', label: 'Username' },
      { key: 'email', label: 'Email' },
      { key: 'currentCapital', label: 'Capital', type: 'number' },
      { key: 'capitalRatio', label: 'Ratio' },
      { key: 'riskLevel', label: 'Risk', type: 'status' },
      { key: 'marginWarnings', label: 'Warnings', type: 'number' },
      { key: 'usedMargin', label: 'Used Margin', type: 'number' },
    ]
  };
}

// ==================== USER MANAGEMENT EXECUTION FUNCTIONS ====================

async function executeGetUserRestrictions(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const query: any = { isActive: true };
  
  if (args.restrictionType && args.restrictionType !== 'all') {
    query.restrictionType = args.restrictionType;
  }

  const restrictions = await db.collection('userrestrictions')
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();

  const userIds = restrictions.map((r: any) => r.userId);
  const users = await db.collection('user').find({
    $or: [
      { id: { $in: userIds } },
      { _id: { $in: userIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id)).map((id: string) => new mongoose.Types.ObjectId(id)) } }
    ]
  }).toArray();
  const userMap = new Map(users.map((u: any) => [u.id || u._id?.toString(), u]));

  const data = restrictions.map((r: any) => {
    const user = userMap.get(r.userId);
    return {
      email: user?.email || 'Unknown',
      type: r.restrictionType,
      reason: r.reason?.substring(0, 40) + (r.reason?.length > 40 ? '...' : ''),
      createdBy: r.createdByEmail || '—',
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    };
  });

  return {
    type: 'table',
    title: `Active Restrictions (${data.length})`,
    data,
    columns: [
      { key: 'email', label: 'User' },
      { key: 'type', label: 'Type', type: 'badge' },
      { key: 'reason', label: 'Reason' },
      { key: 'createdBy', label: 'By' },
      { key: 'expiresAt', label: 'Expires', type: 'date' },
      { key: 'createdAt', label: 'Created', type: 'date' },
    ]
  };
}

async function executeGetUserBadges(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;

  const badgeStats = await db.collection('userbadges').aggregate([
    {
      $group: {
        _id: '$badgeId',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]).toArray();

  // Get badge names
  const badgeConfigs = await db.collection('badgeconfigs').find({}).toArray();
  const badgeMap = new Map(badgeConfigs.map((b: any) => [b._id.toString(), b]));

  const data = badgeStats.map((b: any) => {
    const config = badgeMap.get(b._id);
    return {
      badge: config?.name || b._id,
      category: config?.category || '—',
      rarity: config?.rarity || '—',
      usersEarned: b.count,
      xpReward: config?.xpReward || 0,
    };
  });

  return {
    type: 'table',
    title: `Badge Distribution`,
    data,
    columns: [
      { key: 'badge', label: 'Badge' },
      { key: 'category', label: 'Category', type: 'badge' },
      { key: 'rarity', label: 'Rarity', type: 'badge' },
      { key: 'usersEarned', label: 'Users Earned', type: 'number' },
      { key: 'xpReward', label: 'XP Reward', type: 'number' },
    ]
  };
}

async function executeGetUserLevels(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;

  const levelStats = await db.collection('userlevels').aggregate([
    {
      $group: {
        _id: '$currentLevel',
        count: { $sum: 1 },
        avgXP: { $avg: '$currentXP' },
        avgBadges: { $avg: '$totalBadgesEarned' }
      }
    },
    { $sort: { _id: 1 } }
  ]).toArray();

  const data = levelStats.map((l: any) => ({
    level: l._id,
    users: l.count,
    avgXP: Math.round(l.avgXP),
    avgBadges: l.avgBadges?.toFixed(1) || '0',
  }));

  return {
    type: 'table',
    title: `User Level Distribution`,
    data,
    columns: [
      { key: 'level', label: 'Level', type: 'number' },
      { key: 'users', label: 'Users', type: 'number' },
      { key: 'avgXP', label: 'Avg XP', type: 'number' },
      { key: 'avgBadges', label: 'Avg Badges' },
    ]
  };
}

async function executeGetOnlineUsers(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const limit = args.limit || 20;

  // Users active in last 5 minutes
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  
  const onlineStatuses = await db.collection('useronlinestatuses')
    .find({ lastSeenAt: { $gte: cutoff } })
    .limit(limit)
    .toArray();

  const userIds = onlineStatuses.map((s: any) => s.userId);
  const users = await db.collection('user').find({
    $or: [
      { id: { $in: userIds } },
      { _id: { $in: userIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id)).map((id: string) => new mongoose.Types.ObjectId(id)) } }
    ]
  }).toArray();
  const userMap = new Map(users.map((u: any) => [u.id || u._id?.toString(), u]));

  const data = onlineStatuses.map((s: any) => {
    const user = userMap.get(s.userId);
    return {
      email: user?.email || 'Unknown',
      name: user?.name || '—',
      lastSeen: s.lastSeenAt,
      currentPage: s.currentPage || '—',
    };
  });

  const totalOnline = await db.collection('useronlinestatuses').countDocuments({ lastSeenAt: { $gte: cutoff } });

  return {
    type: 'table',
    title: `Online Users (${totalOnline} total)`,
    data,
    columns: [
      { key: 'email', label: 'Email' },
      { key: 'name', label: 'Name' },
      { key: 'lastSeen', label: 'Last Seen', type: 'date' },
      { key: 'currentPage', label: 'Page' },
    ]
  };
}

// ==================== SYSTEM STATUS EXECUTION FUNCTIONS ====================

async function executeGetPaymentProviders(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;

  const providers = await db.collection('paymentproviders').find({}).toArray();

  const data = providers.map((p: any) => ({
    name: p.name,
    slug: p.slug,
    type: p.type,
    isActive: p.isActive ? 'Yes' : 'No',
    environment: p.environment,
    lastUsed: p.lastUsedAt || '—',
  }));

  // Also check for providers configured via env
  const envProviders = [];
  if (process.env.STRIPE_SECRET_KEY) {
    envProviders.push({ name: 'Stripe (ENV)', type: 'card', isActive: 'Yes' });
  }
  if (process.env.NUVEI_MERCHANT_ID) {
    envProviders.push({ name: 'Nuvei (ENV)', type: 'card', isActive: 'Yes' });
  }

  return {
    type: 'table',
    title: `Payment Providers (${data.length + envProviders.length})`,
    data: [...data, ...envProviders],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'slug', label: 'Slug' },
      { key: 'type', label: 'Type', type: 'badge' },
      { key: 'isActive', label: 'Active', type: 'status' },
      { key: 'environment', label: 'Environment' },
      { key: 'lastUsed', label: 'Last Used', type: 'date' },
    ]
  };
}

async function executeGetSystemNotifications(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const limit = args.limit || 30;
  const query: any = {};
  
  if (args.type && args.type !== 'all') {
    query.type = args.type;
  }

  const notifications = await db.collection('notifications')
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  const data = notifications.map((n: any) => ({
    id: n._id.toString().substring(0, 8),
    type: n.type,
    title: n.title?.substring(0, 30) + (n.title?.length > 30 ? '...' : ''),
    message: n.message?.substring(0, 50) + (n.message?.length > 50 ? '...' : ''),
    read: n.isRead ? 'Yes' : 'No',
    createdAt: n.createdAt,
  }));

  return {
    type: 'table',
    title: `System Notifications (${data.length})`,
    data,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'type', label: 'Type', type: 'badge' },
      { key: 'title', label: 'Title' },
      { key: 'message', label: 'Message' },
      { key: 'read', label: 'Read', type: 'status' },
      { key: 'createdAt', label: 'Created', type: 'date' },
    ]
  };
}

async function executeGetAuditLogs(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const limit = args.limit || 50;
  const query: any = {};
  
  if (args.action) query.action = { $regex: args.action, $options: 'i' };
  if (args.adminEmail) query['performedBy.email'] = { $regex: args.adminEmail, $options: 'i' };

  const logs = await db.collection('auditlogs')
    .find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();

  const data = logs.map((l: any) => ({
    id: l._id.toString().substring(0, 8),
    action: l.action,
    admin: l.performedBy?.email || '—',
    target: l.targetType || '—',
    details: JSON.stringify(l.details || {}).substring(0, 40) + '...',
    timestamp: l.timestamp,
  }));

  return {
    type: 'table',
    title: `Audit Logs (${data.length})`,
    data,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'action', label: 'Action' },
      { key: 'admin', label: 'Admin' },
      { key: 'target', label: 'Target' },
      { key: 'details', label: 'Details' },
      { key: 'timestamp', label: 'Time', type: 'date' },
    ]
  };
}

async function executeGetAccountLockouts(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const limit = args.limit || 50;

  const lockouts = await db.collection('accountlockouts')
    .find({ lockedUntil: { $gt: new Date() } })
    .sort({ lockedUntil: -1 })
    .limit(limit)
    .toArray();

  const data = lockouts.map((l: any) => ({
    email: l.email,
    attempts: l.failedAttempts,
    lockedUntil: l.lockedUntil,
    lastAttempt: l.lastFailedAttempt,
    reason: l.lockReason || 'Too many failed attempts',
  }));

  return {
    type: 'table',
    title: `Account Lockouts (${data.length} active)`,
    data,
    columns: [
      { key: 'email', label: 'Email' },
      { key: 'attempts', label: 'Failed Attempts', type: 'number' },
      { key: 'lockedUntil', label: 'Locked Until', type: 'date' },
      { key: 'lastAttempt', label: 'Last Attempt', type: 'date' },
      { key: 'reason', label: 'Reason' },
    ]
  };
}

async function executeGetDashboardOverview(args: any): Promise<AgentResult> {
  const db = mongoose.connection.db!;
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersToday,
    activeCompetitions,
    activeChallenges,
    pendingWithdrawals,
    pendingKYC,
    openFraudAlerts,
    lockedAccounts,
    onlineUsers,
    depositsToday,
  ] = await Promise.all([
    db.collection('user').countDocuments(),
    db.collection('user').countDocuments({ createdAt: { $gte: today } }),
    db.collection('competitions').countDocuments({ status: 'active' }),
    db.collection('challenges').countDocuments({ status: 'active' }),
    db.collection('withdrawalrequests').countDocuments({ status: 'pending' }),
    db.collection('kycsessions').countDocuments({ status: 'pending' }),
    db.collection('fraudalerts').countDocuments({ status: 'active' }),
    db.collection('accountlockouts').countDocuments({ lockedUntil: { $gt: new Date() } }),
    db.collection('useronlinestatuses').countDocuments({ lastSeenAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } }),
    db.collection('wallettransactions').aggregate([
      { $match: { transactionType: 'deposit', status: 'completed', processedAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$metadata.totalCharged' } } }
    ]).toArray(),
  ]);

  return {
    type: 'stats',
    title: `Dashboard Overview`,
    data: {
      total_users: totalUsers,
      new_users_today: newUsersToday,
      users_online_now: onlineUsers,
      active_competitions: activeCompetitions,
      active_challenges: activeChallenges,
      pending_withdrawals: pendingWithdrawals,
      pending_kyc: pendingKYC,
      open_fraud_alerts: openFraudAlerts,
      locked_accounts: lockedAccounts,
      deposits_today: `€${(depositsToday[0]?.total || 0).toFixed(2)}`,
    }
  };
}

// Tool execution dispatcher
async function executeTool(name: string, args: any): Promise<AgentResult> {
  switch (name) {
    // Original tools
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
    
    // Competition tools
    case 'get_competitions':
      return executeGetCompetitions(args);
    case 'get_competition_details':
      return executeGetCompetitionDetails(args);
    case 'get_competition_leaderboard':
      return executeGetCompetitionLeaderboard(args);
    case 'get_competition_analytics':
      return executeGetCompetitionAnalytics(args);
    
    // Challenge tools
    case 'get_challenges':
      return executeGetChallenges(args);
    case 'get_challenge_details':
      return executeGetChallengeDetails(args);
    
    // Invoice & billing tools
    case 'get_invoices':
      return executeGetInvoices(args);
    case 'get_invoice_summary':
      return executeGetInvoiceSummary(args);
    
    // Platform earnings tools
    case 'get_platform_earnings':
      return executeGetPlatformEarnings(args);
    case 'get_vat_report':
      return executeGetVATReport(args);
    case 'get_fee_breakdown':
      return executeGetFeeBreakdown(args);
    
    // Trading tools
    case 'get_open_positions':
      return executeGetOpenPositions(args);
    case 'get_trading_activity':
      return executeGetTradingActivity(args);
    case 'get_margin_status':
      return executeGetMarginStatus(args);
    
    // User management tools
    case 'get_user_restrictions':
      return executeGetUserRestrictions(args);
    case 'get_user_badges':
      return executeGetUserBadges(args);
    case 'get_user_levels':
      return executeGetUserLevels(args);
    case 'get_online_users':
      return executeGetOnlineUsers(args);
    
    // System status tools
    case 'get_payment_providers':
      return executeGetPaymentProviders(args);
    case 'get_system_notifications':
      return executeGetSystemNotifications(args);
    case 'get_audit_logs':
      return executeGetAuditLogs(args);
    case 'get_account_lockouts':
      return executeGetAccountLockouts(args);
    case 'get_dashboard_overview':
      return executeGetDashboardOverview(args);
    
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
const SYSTEM_PROMPT = `You are an intelligent AI assistant for the ChartVolt admin panel. You have comprehensive access to all system data and can help administrators with:

## CAPABILITIES

### 1. Fraud Detection & Security
- Find shared payment methods across users (potential fraud)
- Review fraud alerts by severity and status
- Check user suspicion scores and high-risk users
- View account lockouts and restrictions

### 2. User Management
- Search and lookup user details
- Check KYC verification status
- View user badges, levels, and XP distribution
- Monitor online users in real-time
- Review user restrictions (deposit/withdraw/trade blocks)

### 3. Financial Operations
- Run reconciliation checks on deposits/withdrawals
- Generate financial summaries (deposits, withdrawals, fees, VAT)
- View platform earnings breakdown
- Get detailed fee breakdowns (platform fees, bank fees, net earnings)
- Invoice management and summaries
- VAT collection reports

### 4. Competitions & Challenges
- List all competitions by status (draft, upcoming, active, completed)
- View competition details, rules, and settings
- Get live leaderboards and participant rankings
- Competition analytics across the platform
- 1v1 challenge management and results

### 5. Trading Activity
- View all open positions across competitions
- Monitor recent trading activity
- Track margin status and users at risk of liquidation
- Analyze trading patterns

### 6. System Status
- Payment provider status (Stripe, Nuvei, etc.)
- System notifications
- Admin audit logs (who did what)
- Dashboard overview with key metrics

## DATA PRIVACY
- User identifiers (emails, IDs) are masked (e.g., "user_0001")
- Transaction amounts may be shown as ranges
- This protects user privacy while providing insights

## RESPONSE GUIDELINES
- Be concise and professional
- Always use tools to fetch real data - never make assumptions
- Present data in appropriate formats (tables, stats, alerts)
- Highlight anomalies and suggest follow-up actions
- If data is incomplete, mention it explicitly
- End data responses with verification reminder

## IMPORTANT
1. Call appropriate tools first, then explain results
2. Never hallucinate or make up data
3. User identities are masked for privacy
4. Always recommend cross-referencing with actual system

⚠️ DISCLAIMER: Data is anonymized. Always verify against actual system data for accuracy.`;

export async function POST(request: NextRequest) {
  const requestTimestamp = new Date();
  let auditData: any = null;
  
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

    // Reset masking map for this request
    resetMaskingMap();

    const openai = new OpenAI({ apiKey: config.apiKey });

    // Token pricing per 1M tokens (as of 2024)
    const MODEL_PRICING: Record<string, { input: number; output: number }> = {
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'gpt-4o': { input: 2.50, output: 10.00 },
      'gpt-4-turbo': { input: 10.00, output: 30.00 },
      'gpt-4': { input: 30.00, output: 60.00 },
      'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
    };

    // Track total token usage
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Track tools called for audit
    const auditToolsCalled: any[] = [];

    // Get the last user message for audit logging
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()?.content || '';

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

    // Track tokens from initial completion
    if (completion.usage) {
      totalInputTokens += completion.usage.prompt_tokens;
      totalOutputTokens += completion.usage.completion_tokens;
    }

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
        const toolStartTime = Date.now();

        console.log(`🤖 AI Agent calling tool: ${functionName}`, functionArgs);

        toolCalls.push({
          id: toolCall.id,
          name: functionName,
          arguments: functionArgs,
          status: 'running',
        });

        try {
          // Execute tool and get raw result
          const rawResult = await executeTool(functionName, functionArgs);
          
          // IMPORTANT: Mask sensitive data before sending to OpenAI
          const maskedResult = maskSensitiveData(rawResult);
          
          // Store original result for client (they have access to raw data anyway)
          results.push(rawResult);
          
          toolCalls[toolCalls.length - 1].status = 'completed';
          toolCalls[toolCalls.length - 1].result = rawResult;

          // Send MASKED result to OpenAI
          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(maskedResult),
          });

          // Audit log
          auditToolsCalled.push({
            name: functionName,
            arguments: functionArgs, // Already safe (just filter params)
            executionTimeMs: Date.now() - toolStartTime,
            success: true
          });
        } catch (error) {
          console.error(`Tool execution error (${functionName}):`, error);
          toolCalls[toolCalls.length - 1].status = 'error';
          
          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: error instanceof Error ? error.message : 'Tool execution failed' }),
          });

          // Audit log error
          auditToolsCalled.push({
            name: functionName,
            arguments: functionArgs,
            executionTimeMs: Date.now() - toolStartTime,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
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

      // Track tokens from follow-up completions
      if (completion.usage) {
        totalInputTokens += completion.usage.prompt_tokens;
        totalOutputTokens += completion.usage.completion_tokens;
      }

      response = completion.choices[0]?.message;
    }

    // Calculate cost
    const pricing = MODEL_PRICING[config.model] || MODEL_PRICING['gpt-4o-mini'];
    const inputCost = (totalInputTokens / 1_000_000) * pricing.input;
    const outputCost = (totalOutputTokens / 1_000_000) * pricing.output;
    const totalCost = inputCost + outputCost;

    console.log(`🤖 AI Agent usage: ${totalInputTokens} input + ${totalOutputTokens} output tokens = $${totalCost.toFixed(6)}`);

    // Get masking summary for audit
    const maskingSummary = getMaskingSummary();

    // Create audit log entry
    const responseTimestamp = new Date();
    try {
      await AIAgentAudit.create({
        adminEmail: admin.email || 'unknown',
        adminId: admin.adminId,
        query: lastUserMessage.substring(0, 500), // Limit query length
        messageCount: messages.length,
        toolsCalled: auditToolsCalled,
        responseLength: response?.content?.length || 0,
        resultCount: results.length,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        estimatedCost: totalCost,
        model: config.model,
        dataMasked: true,
        maskingSummary,
        requestTimestamp,
        responseTimestamp,
        totalDurationMs: responseTimestamp.getTime() - requestTimestamp.getTime(),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      });
      console.log(`📝 AI Agent audit log created for ${admin.email}`);
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({
      content: response?.content || 'I apologize, but I was unable to generate a response.',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      results: results.length > 0 ? results : undefined,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        cost: totalCost,
        model: config.model,
      },
      dataMasked: true,
      maskingSummary
    });

  } catch (error) {
    console.error('AI Agent error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI processing failed' },
      { status: 500 }
    );
  }
}

