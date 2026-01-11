import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { ObjectId } from 'mongodb';

interface HistoryItem {
  id: string;
  type: string;
  category: string;
  description: string;
  details?: Record<string, any>;
  status?: string;
  amount?: number;
  createdAt: Date;
  metadata?: Record<string, any>;
}

/**
 * GET /api/users/[userId]/history
 * Get comprehensive history for a user including all activities
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    await connectToDatabase();
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    
    if (!db) {
      throw new Error('Database connection not found');
    }

    const history: HistoryItem[] = [];

    // 1. Wallet Transactions (deposits, withdrawals, credits, fees)
    try {
      const transactions = await db.collection('wallettransactions').find({
        userId: userId
      }).sort({ createdAt: -1 }).toArray();

      for (const tx of transactions) {
        const typeLabels: Record<string, string> = {
          'deposit': '💰 Deposit',
          'withdrawal': '💸 Withdrawal',
          'withdrawal_fee': '💸 Withdrawal Fee',
          'withdrawal_refund': '↩️ Withdrawal Refund',
          'manual_deposit_credit': '🎁 Manual Credit',
          'competition_entry': '🏆 Competition Entry',
          'competition_win': '🥇 Competition Win',
          'competition_refund': '↩️ Competition Refund',
          'challenge_entry': '⚔️ Challenge Entry',
          'challenge_win': '🏅 Challenge Win',
          'challenge_refund': '↩️ Challenge Refund',
          'platform_fee': '🏛️ Platform Fee',
          'admin_adjustment': '⚙️ Admin Adjustment',
          'marketplace_purchase': '🛒 Marketplace Purchase',
          'refund': '↩️ Refund',
        };

        history.push({
          id: tx._id.toString(),
          type: 'transaction',
          category: tx.transactionType || 'unknown',
          description: typeLabels[tx.transactionType] || tx.transactionType || 'Transaction',
          amount: tx.amount,
          status: tx.status,
          createdAt: tx.createdAt,
          details: {
            transactionType: tx.transactionType,
            amountEUR: tx.amountEUR,
            reference: tx.reference,
            providerId: tx.providerId,
          },
          metadata: tx.metadata,
        });
      }
    } catch (e) {
      console.error('Error fetching transactions:', e);
    }

    // 2. Competition Participations
    try {
      const participations = await db.collection('competitionparticipants').find({
        userId: userId
      }).sort({ joinedAt: -1 }).toArray();

      // Get competition details
      const competitionIds = participations.map(p => p.competitionId).filter(Boolean);
      const competitions = competitionIds.length > 0 
        ? await db.collection('competitions').find({ 
            _id: { $in: competitionIds.map(id => {
              try { return new ObjectId(id); } catch { return id; }
            })}
          }).toArray()
        : [];
      const competitionMap = new Map(competitions.map(c => [c._id.toString(), c]));

      for (const p of participations) {
        const competition = competitionMap.get(p.competitionId?.toString());
        history.push({
          id: p._id.toString(),
          type: 'competition',
          category: p.status || 'participation',
          description: `🏆 Competition: ${competition?.name || 'Unknown'}`,
          status: p.status,
          amount: p.entryFee,
          createdAt: p.joinedAt || p.createdAt,
          details: {
            competitionName: competition?.name,
            competitionId: p.competitionId,
            entryFee: p.entryFee,
            startingCapital: p.startingCapital,
            currentCapital: p.currentCapital,
            pnl: p.pnl,
            pnlPercent: p.pnlPercent,
            totalTrades: p.totalTrades,
            winningTrades: p.winningTrades,
            rank: p.rank,
            isWinner: p.isWinner,
            prizeWon: p.prizeWon,
          },
        });
      }
    } catch (e) {
      console.error('Error fetching competitions:', e);
    }

    // 3. Challenge Participations
    try {
      const challengeParticipations = await db.collection('challengeparticipants').find({
        userId: userId
      }).sort({ joinedAt: -1 }).toArray();

      // Get challenge details
      const challengeIds = challengeParticipations.map(p => p.challengeId).filter(Boolean);
      const challenges = challengeIds.length > 0 
        ? await db.collection('challenges').find({ 
            _id: { $in: challengeIds.map(id => {
              try { return new ObjectId(id); } catch { return id; }
            })}
          }).toArray()
        : [];
      const challengeMap = new Map(challenges.map(c => [c._id.toString(), c]));

      for (const p of challengeParticipations) {
        const challenge = challengeMap.get(p.challengeId?.toString());
        history.push({
          id: p._id.toString(),
          type: 'challenge',
          category: p.status || 'participation',
          description: `⚔️ Challenge${challenge?.wagerAmount ? ` (${challenge.wagerAmount} credits)` : ''}`,
          status: p.status,
          amount: challenge?.wagerAmount,
          createdAt: p.joinedAt || p.createdAt,
          details: {
            challengeId: p.challengeId,
            wagerAmount: challenge?.wagerAmount,
            isCreator: p.isCreator,
            isWinner: p.isWinner,
            prizeWon: p.prizeWon,
            pnl: p.pnl,
            totalTrades: p.totalTrades,
          },
        });
      }
    } catch (e) {
      console.error('Error fetching challenges:', e);
    }

    // 4. Trades (Competition & Challenge)
    try {
      const trades = await db.collection('trades').find({
        userId: userId
      }).sort({ openedAt: -1 }).limit(100).toArray();

      for (const trade of trades) {
        const tradeType = trade.pnl >= 0 ? '📈' : '📉';
        history.push({
          id: trade._id.toString(),
          type: 'trade',
          category: trade.status || 'trade',
          description: `${tradeType} ${trade.direction?.toUpperCase() || 'Trade'} ${trade.symbol || ''}`,
          status: trade.status,
          amount: trade.pnl,
          createdAt: trade.openedAt || trade.createdAt,
          details: {
            symbol: trade.symbol,
            direction: trade.direction,
            lotSize: trade.lotSize,
            leverage: trade.leverage,
            entryPrice: trade.entryPrice,
            exitPrice: trade.exitPrice,
            pnl: trade.pnl,
            pnlPercent: trade.pnlPercent,
            competitionId: trade.competitionId,
            challengeId: trade.challengeId,
            closedAt: trade.closedAt,
          },
        });
      }
    } catch (e) {
      console.error('Error fetching trades:', e);
    }

    // 5. KYC Sessions
    try {
      const kycSessions = await db.collection('kycsessions').find({
        userId: userId
      }).sort({ createdAt: -1 }).toArray();

      for (const session of kycSessions) {
        const statusEmoji = session.status === 'approved' ? '✅' : 
                           session.status === 'declined' ? '❌' : 
                           session.status === 'pending' ? '⏳' : '🔍';
        history.push({
          id: session._id.toString(),
          type: 'kyc',
          category: session.status || 'session',
          description: `${statusEmoji} KYC Verification: ${session.status?.toUpperCase() || 'Unknown'}`,
          status: session.status,
          createdAt: session.createdAt,
          details: {
            verificationId: session.verificationId,
            status: session.status,
            verificationCode: session.verificationCode,
            verificationReason: session.verificationReason,
            documentType: session.documentData?.type,
            documentCountry: session.documentData?.country,
            completedAt: session.completedAt,
          },
        });
      }
    } catch (e) {
      console.error('Error fetching KYC sessions:', e);
    }

    // 6. User Restrictions (bans, suspensions)
    try {
      const restrictions = await db.collection('userrestrictions').find({
        userId: userId
      }).sort({ restrictedAt: -1 }).toArray();

      for (const r of restrictions) {
        const emoji = r.restrictionType === 'banned' ? '🚫' : '⚠️';
        history.push({
          id: r._id.toString(),
          type: 'restriction',
          category: r.restrictionType || 'restriction',
          description: `${emoji} ${r.restrictionType === 'banned' ? 'Account Banned' : 'Account Suspended'}`,
          status: r.isActive ? 'active' : 'resolved',
          createdAt: r.restrictedAt,
          details: {
            restrictionType: r.restrictionType,
            reason: r.reason,
            customReason: r.customReason,
            canTrade: r.canTrade,
            canDeposit: r.canDeposit,
            canWithdraw: r.canWithdraw,
            canEnterCompetitions: r.canEnterCompetitions,
            expiresAt: r.expiresAt,
            isActive: r.isActive,
            adminId: r.adminId,
          },
        });
      }
    } catch (e) {
      console.error('Error fetching restrictions:', e);
    }

    // 7. Account Lockouts
    try {
      const lockouts = await db.collection('accountlockouts').find({
        $or: [{ userId: userId }, { email: { $exists: true } }]
      }).sort({ lockedAt: -1 }).toArray();

      // Filter by user
      const userLockouts = lockouts.filter(l => l.userId === userId);

      for (const lockout of userLockouts) {
        history.push({
          id: lockout._id.toString(),
          type: 'lockout',
          category: lockout.reason || 'lockout',
          description: `🔒 Account Lockout: ${lockout.reason?.replace(/_/g, ' ') || 'Security'}`,
          status: lockout.isLocked ? 'locked' : 'unlocked',
          createdAt: lockout.lockedAt,
          details: {
            reason: lockout.reason,
            failedAttempts: lockout.failedAttempts,
            ipAddress: lockout.ipAddress,
            lockedUntil: lockout.lockedUntil,
            unlockReason: lockout.unlockReason,
          },
        });
      }
    } catch (e) {
      console.error('Error fetching lockouts:', e);
    }

    // 8. Admin Notes
    try {
      const notes = await db.collection('usernotes').find({
        userId: userId
      }).sort({ createdAt: -1 }).toArray();

      for (const note of notes) {
        history.push({
          id: note._id.toString(),
          type: 'note',
          category: note.category || 'general',
          description: `📝 Admin Note: ${note.category || 'General'}`,
          status: note.priority,
          createdAt: note.createdAt,
          details: {
            content: note.content,
            category: note.category,
            priority: note.priority,
            adminName: note.adminName,
            isPinned: note.isPinned,
          },
        });
      }
    } catch (e) {
      console.error('Error fetching notes:', e);
    }

    // 9. Invoices
    try {
      const invoices = await db.collection('invoices').find({
        userId: userId
      }).sort({ createdAt: -1 }).toArray();

      for (const invoice of invoices) {
        history.push({
          id: invoice._id.toString(),
          type: 'invoice',
          category: invoice.status || 'invoice',
          description: `📄 Invoice: ${invoice.invoiceNumber || 'N/A'}`,
          status: invoice.status,
          amount: invoice.total,
          createdAt: invoice.invoiceDate || invoice.createdAt,
          details: {
            invoiceNumber: invoice.invoiceNumber,
            total: invoice.total,
            subtotal: invoice.subtotal,
            vatAmount: invoice.vatAmount,
            status: invoice.status,
            sentAt: invoice.sentAt,
          },
        });
      }
    } catch (e) {
      console.error('Error fetching invoices:', e);
    }

    // 10. Fraud Alerts
    try {
      const fraudAlerts = await db.collection('fraudalerts').find({
        userId: userId
      }).sort({ createdAt: -1 }).toArray();

      for (const alert of fraudAlerts) {
        const severityEmoji = alert.severity === 'critical' ? '🚨' : 
                             alert.severity === 'high' ? '⚠️' : '⚡';
        history.push({
          id: alert._id.toString(),
          type: 'fraud_alert',
          category: alert.alertType || 'fraud',
          description: `${severityEmoji} Fraud Alert: ${alert.alertType?.replace(/_/g, ' ') || 'Security'}`,
          status: alert.status,
          createdAt: alert.createdAt,
          details: {
            alertType: alert.alertType,
            severity: alert.severity,
            status: alert.status,
            description: alert.description,
            riskScore: alert.riskScore,
            resolvedAt: alert.resolvedAt,
            resolvedBy: alert.resolvedBy,
            resolution: alert.resolution,
          },
        });
      }
    } catch (e) {
      console.error('Error fetching fraud alerts:', e);
    }

    // 11. Security Logs
    try {
      const securityLogs = await db.collection('securitylogs').find({
        userId: userId
      }).sort({ createdAt: -1 }).limit(50).toArray();

      for (const log of securityLogs) {
        history.push({
          id: log._id.toString(),
          type: 'security_log',
          category: log.eventType || 'security',
          description: `🔐 ${log.eventType?.replace(/_/g, ' ') || 'Security Event'}`,
          status: log.success ? 'success' : 'failed',
          createdAt: log.createdAt,
          details: {
            eventType: log.eventType,
            success: log.success,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
            metadata: log.metadata,
          },
        });
      }
    } catch (e) {
      console.error('Error fetching security logs:', e);
    }

    // 12. Marketplace Purchases
    try {
      const purchases = await db.collection('userpurchases').find({
        userId: userId
      }).sort({ purchasedAt: -1 }).toArray();

      for (const purchase of purchases) {
        history.push({
          id: purchase._id.toString(),
          type: 'marketplace',
          category: 'purchase',
          description: `🛒 Marketplace Purchase`,
          status: purchase.status || 'completed',
          amount: purchase.pricePaid,
          createdAt: purchase.purchasedAt || purchase.createdAt,
          details: {
            itemId: purchase.itemId,
            pricePaid: purchase.pricePaid,
            status: purchase.status,
          },
        });
      }
    } catch (e) {
      console.error('Error fetching marketplace purchases:', e);
    }

    // 13. Notifications (user notifications)
    try {
      const notifications = await db.collection('notifications').find({
        userId: userId
      }).sort({ createdAt: -1 }).limit(30).toArray();

      for (const notif of notifications) {
        history.push({
          id: notif._id.toString(),
          type: 'notification',
          category: notif.type || 'notification',
          description: `🔔 ${notif.title || 'Notification'}`,
          status: notif.read ? 'read' : 'unread',
          createdAt: notif.createdAt,
          details: {
            title: notif.title,
            message: notif.message,
            type: notif.type,
            read: notif.read,
            link: notif.link,
          },
        });
      }
    } catch (e) {
      console.error('Error fetching notifications:', e);
    }

    // Sort all history by date (newest first)
    history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Get unique categories and types for filters
    const types = [...new Set(history.map(h => h.type))];
    const categories = [...new Set(history.map(h => h.category))];

    return NextResponse.json({
      success: true,
      history,
      total: history.length,
      filters: {
        types,
        categories,
      },
    });
  } catch (error) {
    console.error('Error fetching user history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user history' },
      { status: 500 }
    );
  }
}

