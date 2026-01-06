'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Wrench,
  Clock,
  Users,
  Receipt,
  Wallet,
  Loader2,
  Info,
  AlertCircle,
  History,
  Calendar,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Eye,
} from 'lucide-react';

interface ReconciliationIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  userId?: string;
  userEmail?: string;
  details: {
    expected?: number;
    actual?: number;
    difference?: number;
    transactionId?: string;
    withdrawalId?: string;
    description: string;
  };
}

interface UserReconciliationDetail {
  userId: string;
  userEmail: string;
  userName: string;
  wallet: {
    creditBalance: number;
    totalDeposited: number;
    totalWithdrawn: number;
    totalWonFromCompetitions: number;
    totalWonFromChallenges: number;
    totalSpentOnCompetitions: number;
    totalSpentOnChallenges: number;
    totalSpentOnMarketplace: number;
  };
  calculated: {
    expectedBalance: number;
    balanceFromTransactions: number;
    depositTotal: number;
    withdrawalTotal: number;
    competitionWinTotal: number;
    challengeWinTotal: number;
    competitionSpentTotal: number;
    pendingWithdrawalCredits?: number;
    pendingDepositCredits?: number;
    challengeSpentTotal: number;
    marketplaceSpentTotal: number;
  };
  transactionBreakdown: {
    deposits: number;
    withdrawals: number;
    competitionJoins: number;
    competitionWins: number;
    challengeJoins: number;
    challengeWins: number;
    marketplacePurchases: number;
    adminAdjustments: number;
    refunds: number;
    other: number;
  };
  issues: ReconciliationIssue[];
  healthy: boolean;
}

interface ReconciliationResult {
  success: boolean;
  runAt: string;
  duration: number;
  summary: {
    totalUsersChecked: number;
    totalTransactionsChecked: number;
    orphanWallets?: number;
    totalWithdrawalsChecked: number;
    issuesFound: number;
    criticalIssues: number;
    warningIssues: number;
    infoIssues: number;
  };
  balanceCheck: {
    usersWithMismatch: number;
    totalDiscrepancy: number;
  };
  issues: ReconciliationIssue[];
  userDetails: UserReconciliationDetail[];
  healthy: boolean;
}

interface ReconciliationHistoryItem {
  _id: string;
  runAt: string;
  runBy: string;
  runByEmail: string;
  duration: number;
  summary: {
    totalUsersChecked: number;
    totalTransactionsChecked: number;
    totalWithdrawalsChecked: number;
    issuesFound: number;
    criticalIssues: number;
    warningIssues: number;
    infoIssues: number;
  };
  balanceCheck: {
    usersWithMismatch: number;
    totalDiscrepancy: number;
  };
  healthy: boolean;
  status: 'completed' | 'failed';
  issueCount: number;
  issues: ReconciliationIssue[];
}

const ISSUE_TYPES: Record<string, { label: string; description: string; fixable: boolean }> = {
  balance_mismatch: {
    label: 'Balance Mismatch',
    description: 'Wallet balance doesn\'t match sum of transactions',
    fixable: true,
  },
  deposit_total_mismatch: {
    label: 'Deposit Total Mismatch',
    description: 'Total deposited counter is incorrect',
    fixable: true,
  },
  withdrawal_total_mismatch: {
    label: 'Withdrawal Total Mismatch',
    description: 'Total withdrawn counter is incorrect',
    fixable: true,
  },
  orphan_transaction: {
    label: 'Orphan Transaction',
    description: 'Transaction references non-existent record',
    fixable: false,
  },
  orphan_withdrawal: {
    label: 'Orphan Withdrawal',
    description: 'Withdrawal request has no matching transaction',
    fixable: false,
  },
  duplicate_transaction: {
    label: 'Duplicate Transaction',
    description: 'Multiple transactions with same payment ID',
    fixable: false,
  },
  missing_platform_transaction: {
    label: 'Missing Platform Fee',
    description: 'Completed withdrawal has no fee record',
    fixable: false,
  },
  marketplace_spent_mismatch: {
    label: 'Marketplace Spent Mismatch',
    description: 'Marketplace spent counter doesn\'t match purchases',
    fixable: true,
  },
  competition_win_mismatch: {
    label: 'Competition Win Mismatch',
    description: 'Competition winnings counter is incorrect',
    fixable: false,
  },
  challenge_win_mismatch: {
    label: 'Challenge Win Mismatch',
    description: 'Challenge winnings counter is incorrect',
    fixable: false,
  },
  competition_spent_mismatch: {
    label: 'Competition Spent Mismatch',
    description: 'Competition spent counter is incorrect',
    fixable: false,
  },
  challenge_spent_mismatch: {
    label: 'Challenge Spent Mismatch',
    description: 'Challenge spent counter is incorrect',
    fixable: false,
  },
};

export default function ReconciliationSection() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [history, setHistory] = useState<ReconciliationHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [fixDialog, setFixDialog] = useState<{
    open: boolean;
    issue: ReconciliationIssue | null;
  }>({ open: false, issue: null });
  const [fixing, setFixing] = useState(false);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const [detailDialog, setDetailDialog] = useState<{
    open: boolean;
    run: ReconciliationHistoryItem | null;
  }>({ open: false, run: null });

  // Filters for history
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  // User details filters and state
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userIssueFilter, setUserIssueFilter] = useState<'all' | 'issues' | 'healthy'>('all');
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [allUsersExpanded, setAllUsersExpanded] = useState(false);

  // Toggle user expansion
  const toggleUserExpanded = (userId: string) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // Expand/collapse all users
  const toggleAllUsers = () => {
    if (allUsersExpanded) {
      setExpandedUsers(new Set());
      setAllUsersExpanded(false);
    } else {
      if (result?.userDetails) {
        setExpandedUsers(new Set(result.userDetails.map(u => u.userId)));
      }
      setAllUsersExpanded(true);
    }
  };

  // Filter users based on search and issue filter
  const getFilteredUsers = () => {
    if (!result?.userDetails) return [];
    
    let filtered = result.userDetails;
    
    // Search filter
    if (userSearchQuery.trim()) {
      const query = userSearchQuery.toLowerCase();
      filtered = filtered.filter(u => 
        u.userEmail?.toLowerCase().includes(query) ||
        u.userName?.toLowerCase().includes(query) ||
        u.userId.toLowerCase().includes(query)
      );
    }
    
    // Issue filter
    if (userIssueFilter === 'issues') {
      filtered = filtered.filter(u => !u.healthy);
    } else if (userIssueFilter === 'healthy') {
      filtered = filtered.filter(u => u.healthy);
    }
    
    // Sort by issues first
    return filtered.sort((a, b) => {
      if (!a.healthy && b.healthy) return -1;
      if (a.healthy && !b.healthy) return 1;
      return b.issues.length - a.issues.length;
    });
  };

  // Fetch history on mount and when filters change
  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const params = new URLSearchParams({
        action: 'history',
        limit: '50',
        search: searchQuery,
        status: statusFilter,
        severity: severityFilter,
      });
      const response = await fetch(`/api/reconciliation?${params}`);
      const data = await response.json();
      if (data.success) {
        setHistory(data.history);
      }
    } catch (error) {
      console.error('Error fetching reconciliation history:', error);
    } finally {
      setLoadingHistory(false);
    }
  }, [searchQuery, statusFilter, severityFilter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const toggleRunExpanded = (runId: string) => {
    setExpandedRuns(prev => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  };

  const runReconciliation = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/reconciliation');
      const data = await response.json();

      if (data.success) {
        setResult(data);
        // Refresh history after running
        fetchHistory();
        if (data.healthy) {
          toast.success('System is healthy! No critical issues found.');
        } else {
          toast.warning(`Found ${data.summary.criticalIssues} critical issues`);
        }
      } else {
        toast.error(data.error || 'Failed to run reconciliation');
      }
    } catch (error) {
      console.error('Error running reconciliation:', error);
      toast.error('Failed to run reconciliation');
    } finally {
      setLoading(false);
    }
  };

  const handleFix = async () => {
    if (!fixDialog.issue || !fixDialog.issue.userId) return;

    setFixing(true);
    try {
      const response = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueType: fixDialog.issue.type,
          userId: fixDialog.issue.userId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setFixDialog({ open: false, issue: null });
        // Re-run reconciliation to see updated state
        runReconciliation();
      } else {
        toast.error(data.error || 'Failed to fix issue');
      }
    } catch (error) {
      console.error('Error fixing issue:', error);
      toast.error('Failed to fix issue');
    } finally {
      setFixing(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Critical</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Warning</Badge>;
      case 'info':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Info</Badge>;
      default:
        return <Badge>{severity}</Badge>;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-400" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                <Shield className="h-6 w-6 text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-white">System Reconciliation</CardTitle>
                <CardDescription className="text-gray-400">
                  Verify data integrity across wallets, transactions, and withdrawals
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={runReconciliation}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Run Health Check
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className={`border ${result.healthy ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  {result.healthy ? (
                    <CheckCircle className="h-8 w-8 text-green-400" />
                  ) : (
                    <XCircle className="h-8 w-8 text-red-400" />
                  )}
                  <div>
                    <p className="text-sm text-gray-400">System Status</p>
                    <p className={`text-xl font-bold ${result.healthy ? 'text-green-400' : 'text-red-400'}`}>
                      {result.healthy ? 'Healthy' : 'Issues Found'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-blue-400" />
                  <div>
                    <p className="text-sm text-gray-400">Users Checked</p>
                    <p className="text-xl font-bold text-white">{result.summary.totalUsersChecked}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Receipt className="h-8 w-8 text-purple-400" />
                  <div>
                    <p className="text-sm text-gray-400">Transactions</p>
                    <p className="text-xl font-bold text-white">{result.summary.totalTransactionsChecked}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-400">Duration</p>
                    <p className="text-xl font-bold text-white">{result.duration}ms</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Issue Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className={`border ${result.summary.criticalIssues > 0 ? 'border-red-500/50' : 'border-gray-700'}`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-400" />
                    <span className="text-gray-400">Critical Issues</span>
                  </div>
                  <span className={`text-2xl font-bold ${result.summary.criticalIssues > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {result.summary.criticalIssues}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className={`border ${result.summary.warningIssues > 0 ? 'border-yellow-500/50' : 'border-gray-700'}`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    <span className="text-gray-400">Warnings</span>
                  </div>
                  <span className={`text-2xl font-bold ${result.summary.warningIssues > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {result.summary.warningIssues}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-blue-400" />
                    <span className="text-gray-400">Info</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-400">
                    {result.summary.infoIssues}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Balance Discrepancy */}
          {result.balanceCheck.usersWithMismatch > 0 && (
            <Card className="bg-red-500/10 border-red-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Wallet className="h-6 w-6 text-red-400" />
                  <div>
                    <p className="text-red-400 font-semibold">Balance Discrepancies Detected</p>
                    <p className="text-gray-400 text-sm">
                      {result.balanceCheck.usersWithMismatch} user(s) have wallet balance mismatches totaling{' '}
                      <span className="text-red-400 font-mono">{result.balanceCheck.totalDiscrepancy} credits</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Per-User Breakdown */}
          {result.userDetails && result.userDetails.length > 0 && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-400" />
                      Detailed User Reconciliation ({result.userDetails.length} users)
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Complete breakdown of each user&apos;s wallet with stored vs calculated values
                    </CardDescription>
                  </div>
                  
                  {/* Quick Stats */}
                  <div className="flex items-center gap-4">
                    <div className="text-center px-3 py-1 bg-red-500/10 rounded-lg">
                      <p className="text-red-400 font-bold text-lg">
                        {result.userDetails.filter(u => !u.healthy).length}
                      </p>
                      <p className="text-xs text-gray-400">Issues</p>
                    </div>
                    <div className="text-center px-3 py-1 bg-green-500/10 rounded-lg">
                      <p className="text-green-400 font-bold text-lg">
                        {result.userDetails.filter(u => u.healthy).length}
                      </p>
                      <p className="text-xs text-gray-400">Healthy</p>
                    </div>
                  </div>
                </div>

                {/* Filters and Controls */}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search users by email, name, or ID..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="pl-10 bg-gray-900 border-gray-600"
                    />
                  </div>

                  {/* Issue Filter */}
                  <Select value={userIssueFilter} onValueChange={(v) => setUserIssueFilter(v as 'all' | 'issues' | 'healthy')}>
                    <SelectTrigger className="w-[160px] bg-gray-900 border-gray-600">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="issues">
                        <span className="flex items-center gap-2">
                          <XCircle className="h-3 w-3 text-red-400" />
                          With Issues
                        </span>
                      </SelectItem>
                      <SelectItem value="healthy">
                        <span className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-green-400" />
                          Healthy Only
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Expand/Collapse All */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleAllUsers}
                    className="border-gray-600"
                  >
                    {allUsersExpanded ? (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Collapse All
                      </>
                    ) : (
                      <>
                        <ChevronRight className="h-4 w-4 mr-2" />
                        Expand All
                      </>
                    )}
                  </Button>

                  {/* Jump to Issues */}
                  {result.userDetails.some(u => !u.healthy) && userIssueFilter !== 'issues' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUserIssueFilter('issues')}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Jump to Issues ({result.userDetails.filter(u => !u.healthy).length})
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {getFilteredUsers().length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No users match your filters</p>
                    <Button
                      variant="link"
                      className="text-blue-400"
                      onClick={() => {
                        setUserSearchQuery('');
                        setUserIssueFilter('all');
                      }}
                    >
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  getFilteredUsers().map((user) => (
                    <Collapsible
                      key={user.userId}
                      open={expandedUsers.has(user.userId)}
                      onOpenChange={() => toggleUserExpanded(user.userId)}
                    >
                      <div
                        className={`rounded-lg border ${
                          user.healthy 
                            ? 'bg-gray-900/50 border-gray-700' 
                            : 'bg-red-500/5 border-red-500/30'
                        }`}
                      >
                        {/* User Header - Always visible */}
                        <CollapsibleTrigger asChild>
                          <div className="p-4 cursor-pointer hover:bg-gray-800/30 transition-colors flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {/* Expand/Collapse indicator */}
                              <div className="text-gray-400">
                                {expandedUsers.has(user.userId) ? (
                                  <ChevronDown className="h-5 w-5" />
                                ) : (
                                  <ChevronRight className="h-5 w-5" />
                                )}
                              </div>
                              <div className={`p-2 rounded-full ${user.healthy ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                {user.healthy ? (
                                  <CheckCircle className="h-5 w-5 text-green-400" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-400" />
                                )}
                              </div>
                              <div>
                                <p className="text-white font-medium">{user.userName || user.userEmail?.split('@')[0] || 'Unknown'}</p>
                                <p className="text-sm text-gray-400">{user.userEmail}</p>
                                <p className="text-xs text-gray-500 font-mono">ID: {user.userId}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {/* Quick balance info */}
                              <div className="text-right text-sm hidden sm:block">
                                <p className="text-gray-400">Balance</p>
                                <p className="text-white font-mono">{user.wallet.creditBalance.toFixed(2)}</p>
                              </div>
                              <Badge className={user.healthy ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                                {user.healthy ? 'Healthy' : `${user.issues.length} Issue(s)`}
                              </Badge>
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        {/* Expandable Content */}
                        <CollapsibleContent>
                          <div className="px-4 pb-4 border-t border-gray-700/50 pt-4">

                    {/* Values Comparison Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-700">
                            <th className="text-left text-gray-400 py-2 px-3">Field</th>
                            <th className="text-right text-gray-400 py-2 px-3">Stored Value</th>
                            <th className="text-right text-gray-400 py-2 px-3">Calculated</th>
                            <th className="text-right text-gray-400 py-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-gray-800 bg-gray-800/30">
                            <td className="py-2 px-3 text-gray-300 font-medium">
                              💰 Credit Balance
                              {((user.calculated.pendingWithdrawalCredits || 0) > 0 || (user.calculated.pendingDepositCredits || 0) > 0) && (
                                <div className="text-xs text-yellow-400 mt-1">
                                  {(user.calculated.pendingWithdrawalCredits || 0) > 0 && (
                                    <span>⏳ {user.calculated.pendingWithdrawalCredits} pending withdrawal</span>
                                  )}
                                  {(user.calculated.pendingDepositCredits || 0) > 0 && (
                                    <span className="ml-2">📥 {user.calculated.pendingDepositCredits} pending deposit</span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right text-white font-mono">{user.wallet.creditBalance.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right text-white font-mono">
                              <span title={`Expected (accounting for pending): ${user.calculated.expectedBalance.toFixed(2)}`}>
                                {user.calculated.expectedBalance.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              {Math.abs(user.wallet.creditBalance - user.calculated.expectedBalance) < 0.01 ? (
                                <span className="text-green-400">✓</span>
                              ) : (
                                <span className="text-red-400">✗ {(user.wallet.creditBalance - user.calculated.expectedBalance).toFixed(2)}</span>
                              )}
                            </td>
                          </tr>
                          <tr className="border-b border-gray-800">
                            <td className="py-2 px-3 text-gray-300">📥 Total Deposited</td>
                            <td className="py-2 px-3 text-right text-white font-mono">{user.wallet.totalDeposited.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right text-white font-mono">{user.calculated.depositTotal.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right">
                              {Math.abs(user.wallet.totalDeposited - user.calculated.depositTotal) < 0.01 ? (
                                <span className="text-green-400">✓</span>
                              ) : (
                                <span className="text-yellow-400">⚠ {(user.wallet.totalDeposited - user.calculated.depositTotal).toFixed(2)}</span>
                              )}
                            </td>
                          </tr>
                          <tr className="border-b border-gray-800">
                            <td className="py-2 px-3 text-gray-300">📤 Total Withdrawn</td>
                            <td className="py-2 px-3 text-right text-white font-mono">{user.wallet.totalWithdrawn.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right text-white font-mono">{user.calculated.withdrawalTotal.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right">
                              {Math.abs(user.wallet.totalWithdrawn - user.calculated.withdrawalTotal) < 0.01 ? (
                                <span className="text-green-400">✓</span>
                              ) : (
                                <span className="text-yellow-400">⚠ {(user.wallet.totalWithdrawn - user.calculated.withdrawalTotal).toFixed(2)}</span>
                              )}
                            </td>
                          </tr>
                          <tr className="border-b border-gray-800">
                            <td className="py-2 px-3 text-gray-300">🏆 Competition Wins</td>
                            <td className="py-2 px-3 text-right text-white font-mono">{user.wallet.totalWonFromCompetitions.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right text-white font-mono">{user.calculated.competitionWinTotal.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right">
                              {Math.abs(user.wallet.totalWonFromCompetitions - user.calculated.competitionWinTotal) < 0.01 ? (
                                <span className="text-green-400">✓</span>
                              ) : (
                                <span className="text-yellow-400">⚠ {(user.wallet.totalWonFromCompetitions - user.calculated.competitionWinTotal).toFixed(2)}</span>
                              )}
                            </td>
                          </tr>
                          <tr className="border-b border-gray-800">
                            <td className="py-2 px-3 text-gray-300">🎯 Challenge Wins</td>
                            <td className="py-2 px-3 text-right text-white font-mono">{user.wallet.totalWonFromChallenges.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right text-white font-mono">{user.calculated.challengeWinTotal.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right">
                              {Math.abs(user.wallet.totalWonFromChallenges - user.calculated.challengeWinTotal) < 0.01 ? (
                                <span className="text-green-400">✓</span>
                              ) : (
                                <span className="text-yellow-400">⚠ {(user.wallet.totalWonFromChallenges - user.calculated.challengeWinTotal).toFixed(2)}</span>
                              )}
                            </td>
                          </tr>
                          <tr className="border-b border-gray-800">
                            <td className="py-2 px-3 text-gray-300">💸 Competition Spent</td>
                            <td className="py-2 px-3 text-right text-white font-mono">{user.wallet.totalSpentOnCompetitions.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right text-white font-mono">{user.calculated.competitionSpentTotal.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right">
                              {Math.abs(user.wallet.totalSpentOnCompetitions - user.calculated.competitionSpentTotal) < 0.01 ? (
                                <span className="text-green-400">✓</span>
                              ) : (
                                <span className="text-yellow-400">⚠ {(user.wallet.totalSpentOnCompetitions - user.calculated.competitionSpentTotal).toFixed(2)}</span>
                              )}
                            </td>
                          </tr>
                          <tr className="border-b border-gray-800">
                            <td className="py-2 px-3 text-gray-300">🎲 Challenge Spent</td>
                            <td className="py-2 px-3 text-right text-white font-mono">{user.wallet.totalSpentOnChallenges.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right text-white font-mono">{user.calculated.challengeSpentTotal.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right">
                              {Math.abs(user.wallet.totalSpentOnChallenges - user.calculated.challengeSpentTotal) < 0.01 ? (
                                <span className="text-green-400">✓</span>
                              ) : (
                                <span className="text-yellow-400">⚠ {(user.wallet.totalSpentOnChallenges - user.calculated.challengeSpentTotal).toFixed(2)}</span>
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 text-gray-300">🛒 Marketplace Spent</td>
                            <td className="py-2 px-3 text-right text-white font-mono">{(user.wallet.totalSpentOnMarketplace || 0).toFixed(2)}</td>
                            <td className="py-2 px-3 text-right text-white font-mono">{(user.calculated.marketplaceSpentTotal || 0).toFixed(2)}</td>
                            <td className="py-2 px-3 text-right">
                              {Math.abs((user.wallet.totalSpentOnMarketplace || 0) - (user.calculated.marketplaceSpentTotal || 0)) < 0.01 ? (
                                <span className="text-green-400">✓</span>
                              ) : (
                                <span className="text-yellow-400">⚠ {((user.wallet.totalSpentOnMarketplace || 0) - (user.calculated.marketplaceSpentTotal || 0)).toFixed(2)}</span>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Transaction Breakdown */}
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <p className="text-xs text-gray-500 mb-2">Transaction Breakdown:</p>
                      <div className="flex flex-wrap gap-2">
                        {user.transactionBreakdown.deposits > 0 && (
                          <Badge variant="outline" className="text-xs border-green-500/50 text-green-400">
                            {user.transactionBreakdown.deposits} Deposits
                          </Badge>
                        )}
                        {user.transactionBreakdown.withdrawals > 0 && (
                          <Badge variant="outline" className="text-xs border-red-500/50 text-red-400">
                            {user.transactionBreakdown.withdrawals} Withdrawals
                          </Badge>
                        )}
                        {user.transactionBreakdown.competitionJoins > 0 && (
                          <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-400">
                            {user.transactionBreakdown.competitionJoins} Competition Joins
                          </Badge>
                        )}
                        {user.transactionBreakdown.competitionWins > 0 && (
                          <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-400">
                            {user.transactionBreakdown.competitionWins} Competition Wins
                          </Badge>
                        )}
                        {(user.transactionBreakdown.competitionRefunds || 0) > 0 && (
                          <Badge variant="outline" className="text-xs border-teal-500/50 text-teal-400">
                            {user.transactionBreakdown.competitionRefunds} Competition Refunds
                          </Badge>
                        )}
                        {user.transactionBreakdown.challengeJoins > 0 && (
                          <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
                            {user.transactionBreakdown.challengeJoins} Challenge Joins
                          </Badge>
                        )}
                        {user.transactionBreakdown.challengeWins > 0 && (
                          <Badge variant="outline" className="text-xs border-cyan-500/50 text-cyan-400">
                            {user.transactionBreakdown.challengeWins} Challenge Wins
                          </Badge>
                        )}
                        {(user.transactionBreakdown.challengeRefunds || 0) > 0 && (
                          <Badge variant="outline" className="text-xs border-sky-500/50 text-sky-400">
                            {user.transactionBreakdown.challengeRefunds} Challenge Refunds
                          </Badge>
                        )}
                        {(user.transactionBreakdown.withdrawalRefunds || 0) > 0 && (
                          <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-400">
                            {user.transactionBreakdown.withdrawalRefunds} Withdrawal Refunds
                          </Badge>
                        )}
                        {(user.transactionBreakdown.marketplacePurchases || 0) > 0 && (
                          <Badge variant="outline" className="text-xs border-pink-500/50 text-pink-400">
                            {user.transactionBreakdown.marketplacePurchases} Marketplace Purchases
                          </Badge>
                        )}
                        {user.transactionBreakdown.adminAdjustments > 0 && (
                          <Badge variant="outline" className="text-xs border-orange-500/50 text-orange-400">
                            {user.transactionBreakdown.adminAdjustments} Admin Adjustments
                          </Badge>
                        )}
                        {(user.transactionBreakdown.manualCredits || 0) > 0 && (
                          <Badge variant="outline" className="text-xs border-lime-500/50 text-lime-400">
                            {user.transactionBreakdown.manualCredits} Manual Credits
                          </Badge>
                        )}
                        {(user.transactionBreakdown.platformFees || 0) > 0 && (
                          <Badge variant="outline" className="text-xs border-red-500/50 text-red-400">
                            {user.transactionBreakdown.platformFees} Platform Fees
                          </Badge>
                        )}
                        {user.transactionBreakdown.other > 0 && (
                          <Badge variant="outline" className="text-xs border-gray-500/50 text-gray-400">
                            {user.transactionBreakdown.other} Other
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Issues for this user */}
                    {user.issues.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-700 space-y-2">
                        <p className="text-xs text-red-400 font-medium">Issues Found:</p>
                        {user.issues.map((issue, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-red-500/10 rounded">
                            <div className="flex items-center gap-2">
                              {getSeverityBadge(issue.severity)}
                              <span className="text-gray-300 text-sm">{issue.details.description}</span>
                            </div>
                            {ISSUE_TYPES[issue.type]?.fixable && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10 text-xs"
                                onClick={() => setFixDialog({ open: true, issue })}
                              >
                                <Wrench className="h-3 w-3 mr-1" />
                                Fix
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {/* Issues Summary Table (if any) */}
          {result.issues.length > 0 && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  All Issues Summary ({result.issues.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-gray-700 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-700 hover:bg-gray-800/50">
                        <TableHead className="text-gray-400">Severity</TableHead>
                        <TableHead className="text-gray-400">Type</TableHead>
                        <TableHead className="text-gray-400">User</TableHead>
                        <TableHead className="text-gray-400">Details</TableHead>
                        <TableHead className="text-gray-400 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.issues.map((issue, index) => {
                        const issueInfo = ISSUE_TYPES[issue.type] || {
                          label: issue.type,
                          description: '',
                          fixable: false,
                        };
                        return (
                          <TableRow key={index} className="border-gray-700 hover:bg-gray-800/30">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getSeverityIcon(issue.severity)}
                                {getSeverityBadge(issue.severity)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-white font-medium">{issueInfo.label}</p>
                                <p className="text-xs text-gray-500">{issueInfo.description}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {issue.userEmail ? (
                                <div>
                                  <p className="text-white text-sm">{issue.userEmail}</p>
                                  <p className="text-xs text-gray-500 font-mono">{issue.userId?.slice(0, 8)}...</p>
                                </div>
                              ) : (
                                <span className="text-gray-500">System</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <p className="text-gray-300 text-sm max-w-md truncate">
                                {issue.details.description}
                              </p>
                              {issue.details.difference !== undefined && (
                                <p className="text-xs text-gray-500">
                                  Difference:{' '}
                                  <span className={issue.details.difference > 0 ? 'text-green-400' : 'text-red-400'}>
                                    {issue.details.difference > 0 ? '+' : ''}{issue.details.difference}
                                  </span>
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {issueInfo.fixable && issue.userId && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10"
                                  onClick={() => setFixDialog({ open: true, issue })}
                                >
                                  <Wrench className="h-4 w-4 mr-1" />
                                  Fix
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* All Clear Message */}
          {result.issues.length === 0 && (
            <Card className="bg-green-500/10 border-green-500/30">
              <CardContent className="py-12">
                <div className="flex flex-col items-center gap-4">
                  <CheckCircle className="h-16 w-16 text-green-400" />
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-green-400">All Systems Healthy</h3>
                    <p className="text-gray-400 mt-1">
                      No reconciliation issues found. All wallets, transactions, and withdrawals are in sync.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Run Info */}
          <p className="text-xs text-gray-500 text-center">
            Last run: {new Date(result.runAt).toLocaleString()} • Checked {result.summary.totalUsersChecked} users,{' '}
            {result.summary.totalTransactionsChecked} transactions, {result.summary.totalWithdrawalsChecked} withdrawals
            {result.summary.orphanWallets && result.summary.orphanWallets > 0 && (
              <span className="text-yellow-400"> • {result.summary.orphanWallets} orphan wallets</span>
            )}
          </p>
        </>
      )}

      {/* Initial State */}
      {!result && !loading && (
        <Card className="bg-gray-800/30 border-gray-700 border-dashed">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4 text-center">
              <Shield className="h-16 w-16 text-gray-600" />
              <div>
                <h3 className="text-lg font-semibold text-gray-400">Run Health Check</h3>
                <p className="text-gray-500 mt-1 max-w-md">
                  Click &quot;Run Health Check&quot; to verify data integrity across all wallets, transactions, and
                  withdrawals in the system.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reconciliation History */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <History className="h-5 w-5 text-purple-400" />
                Reconciliation History
              </CardTitle>
              <CardDescription className="text-gray-400">
                All reconciliation runs with full details - click to expand
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="border-gray-600"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loadingHistory ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search by email or user ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="healthy">✅ Healthy</SelectItem>
                <SelectItem value="issues">❌ Has Issues</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[150px] bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">🔴 Critical</SelectItem>
                <SelectItem value="warning">🟡 Warning</SelectItem>
                <SelectItem value="info">🔵 Info</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* History List */}
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-400">Loading history...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No reconciliation runs found</p>
              <p className="text-sm">
                {searchQuery || statusFilter !== 'all' || severityFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Run your first health check to see history here'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <Collapsible
                  key={item._id}
                  open={expandedRuns.has(item._id)}
                  onOpenChange={() => toggleRunExpanded(item._id)}
                >
                  <div className="border border-gray-700 rounded-lg overflow-hidden">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-800/70 transition-colors">
                        <div className="flex items-center gap-4">
                          {expandedRuns.has(item._id) ? (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          )}
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <p className="text-white font-medium">
                                {new Date(item.runAt).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </p>
                              <span className="text-gray-500">•</span>
                              <p className="text-gray-400 text-sm">
                                {new Date(item.runAt).toLocaleTimeString()}
                              </p>
                            </div>
                            <p className="text-gray-500 text-sm">Run by: {item.runByEmail}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            {item.summary.criticalIssues > 0 && (
                              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                                {item.summary.criticalIssues} critical
                              </Badge>
                            )}
                            {item.summary.warningIssues > 0 && (
                              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                                {item.summary.warningIssues} warnings
                              </Badge>
                            )}
                            {item.summary.infoIssues > 0 && (
                              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                {item.summary.infoIssues} info
                              </Badge>
                            )}
                          </div>
                          {item.healthy ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Healthy
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                              <XCircle className="h-3 w-3 mr-1" />
                              Issues
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-gray-400 hover:text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailDialog({ open: true, run: item });
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-4 bg-gray-900/50 border-t border-gray-700 space-y-4">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-3 bg-gray-800/50 rounded-lg">
                            <p className="text-xs text-gray-500">Users Checked</p>
                            <p className="text-lg font-bold text-white">{item.summary.totalUsersChecked}</p>
                          </div>
                          <div className="p-3 bg-gray-800/50 rounded-lg">
                            <p className="text-xs text-gray-500">Transactions</p>
                            <p className="text-lg font-bold text-white">{item.summary.totalTransactionsChecked}</p>
                          </div>
                          <div className="p-3 bg-gray-800/50 rounded-lg">
                            <p className="text-xs text-gray-500">Withdrawals</p>
                            <p className="text-lg font-bold text-white">{item.summary.totalWithdrawalsChecked}</p>
                          </div>
                          <div className="p-3 bg-gray-800/50 rounded-lg">
                            <p className="text-xs text-gray-500">Duration</p>
                            <p className="text-lg font-bold text-white">{item.duration}ms</p>
                          </div>
                        </div>

                        {/* Balance Discrepancy */}
                        {item.balanceCheck.usersWithMismatch > 0 && (
                          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <p className="text-red-400 text-sm font-medium">
                              ⚠️ {item.balanceCheck.usersWithMismatch} user(s) with balance mismatch
                            </p>
                            <p className="text-gray-400 text-xs">
                              Total discrepancy: {item.balanceCheck.totalDiscrepancy} credits
                            </p>
                          </div>
                        )}

                        {/* Issues List */}
                        {item.issues && item.issues.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-gray-400 text-sm font-medium">Issues Found ({item.issues.length})</p>
                            <div className="max-h-[300px] overflow-y-auto space-y-2">
                              {item.issues.map((issue, idx) => {
                                const issueInfo = ISSUE_TYPES[issue.type] || {
                                  label: issue.type,
                                  description: '',
                                  fixable: false,
                                };
                                return (
                                  <div
                                    key={idx}
                                    className={`p-3 rounded-lg border ${
                                      issue.severity === 'critical'
                                        ? 'bg-red-500/10 border-red-500/30'
                                        : issue.severity === 'warning'
                                        ? 'bg-yellow-500/10 border-yellow-500/30'
                                        : 'bg-blue-500/10 border-blue-500/30'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          {getSeverityBadge(issue.severity)}
                                          <span className="text-white font-medium text-sm">
                                            {issueInfo.label}
                                          </span>
                                        </div>
                                        <p className="text-gray-300 text-sm">{issue.details.description}</p>
                                        {issue.userEmail && (
                                          <p className="text-gray-500 text-xs mt-1">
                                            User: {issue.userEmail} ({issue.userId?.slice(0, 8)}...)
                                          </p>
                                        )}
                                        {issue.details.difference !== undefined && (
                                          <p className="text-gray-500 text-xs">
                                            Difference:{' '}
                                            <span className={issue.details.difference > 0 ? 'text-green-400' : 'text-red-400'}>
                                              {issue.details.difference > 0 ? '+' : ''}{issue.details.difference}
                                            </span>
                                          </p>
                                        )}
                                      </div>
                                      {issueInfo.fixable && issue.userId && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10"
                                          onClick={() => setFixDialog({ open: true, issue })}
                                        >
                                          <Wrench className="h-3 w-3 mr-1" />
                                          Fix
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4 text-green-400">
                            <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                            <p>No issues found in this run</p>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}

          {/* Summary */}
          {history.length > 0 && (
            <p className="text-xs text-gray-500 text-center pt-4">
              Showing {history.length} reconciliation run(s)
            </p>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => setDetailDialog({ open, run: detailDialog.run })}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <History className="h-5 w-5 text-purple-400" />
              Reconciliation Details
            </DialogTitle>
            {detailDialog.run && (
              <DialogDescription className="text-gray-400">
                Run on {new Date(detailDialog.run.runAt).toLocaleString()} by {detailDialog.run.runByEmail}
              </DialogDescription>
            )}
          </DialogHeader>

          {detailDialog.run && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-4">
                {detailDialog.run.healthy ? (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-lg px-4 py-1">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Healthy
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-lg px-4 py-1">
                    <XCircle className="h-4 w-4 mr-2" />
                    Issues Found
                  </Badge>
                )}
                <span className="text-gray-400">Duration: {detailDialog.run.duration}ms</span>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-gray-800/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-white">{detailDialog.run.summary.totalUsersChecked}</p>
                  <p className="text-xs text-gray-500">Users</p>
                </div>
                <div className="p-3 bg-gray-800/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-white">{detailDialog.run.summary.totalTransactionsChecked}</p>
                  <p className="text-xs text-gray-500">Transactions</p>
                </div>
                <div className="p-3 bg-gray-800/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-white">{detailDialog.run.summary.totalWithdrawalsChecked}</p>
                  <p className="text-xs text-gray-500">Withdrawals</p>
                </div>
                <div className="p-3 bg-gray-800/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-white">{detailDialog.run.summary.issuesFound}</p>
                  <p className="text-xs text-gray-500">Total Issues</p>
                </div>
              </div>

              {/* Issue Breakdown */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
                  <p className="text-xl font-bold text-red-400">{detailDialog.run.summary.criticalIssues}</p>
                  <p className="text-xs text-gray-400">Critical</p>
                </div>
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center">
                  <p className="text-xl font-bold text-yellow-400">{detailDialog.run.summary.warningIssues}</p>
                  <p className="text-xs text-gray-400">Warnings</p>
                </div>
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-center">
                  <p className="text-xl font-bold text-blue-400">{detailDialog.run.summary.infoIssues}</p>
                  <p className="text-xs text-gray-400">Info</p>
                </div>
              </div>

              {/* All Issues */}
              {detailDialog.run.issues && detailDialog.run.issues.length > 0 && (
                <div className="space-y-2">
                  <p className="text-white font-medium">All Issues ({detailDialog.run.issues.length})</p>
                  <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {detailDialog.run.issues.map((issue, idx) => {
                      const issueInfo = ISSUE_TYPES[issue.type] || { label: issue.type, description: '', fixable: false };
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border ${
                            issue.severity === 'critical'
                              ? 'bg-red-500/10 border-red-500/30'
                              : issue.severity === 'warning'
                              ? 'bg-yellow-500/10 border-yellow-500/30'
                              : 'bg-blue-500/10 border-blue-500/30'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {getSeverityBadge(issue.severity)}
                            <span className="text-white font-medium text-sm">{issueInfo.label}</span>
                          </div>
                          <p className="text-gray-300 text-sm">{issue.details.description}</p>
                          {issue.userEmail && (
                            <div className="mt-2 p-2 bg-gray-800/50 rounded text-xs">
                              <p className="text-gray-400">User: <span className="text-white">{issue.userEmail}</span></p>
                              <p className="text-gray-400">ID: <span className="text-white font-mono">{issue.userId}</span></p>
                              {issue.details.expected !== undefined && (
                                <p className="text-gray-400">
                                  Expected: <span className="text-green-400">{issue.details.expected}</span>
                                  {' → '}Actual: <span className="text-red-400">{issue.details.actual}</span>
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDetailDialog({ open: false, run: null })}
              className="border-gray-600"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fix Dialog */}
      <Dialog open={fixDialog.open} onOpenChange={(open) => setFixDialog({ open, issue: fixDialog.issue })}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Wrench className="h-5 w-5 text-indigo-400" />
              Fix Reconciliation Issue
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              This will automatically correct the data inconsistency.
            </DialogDescription>
          </DialogHeader>

          {fixDialog.issue && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-800/50 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  {getSeverityBadge(fixDialog.issue.severity)}
                  <span className="text-white font-medium">
                    {ISSUE_TYPES[fixDialog.issue.type]?.label || fixDialog.issue.type}
                  </span>
                </div>
                <p className="text-gray-300 text-sm">{fixDialog.issue.details.description}</p>
                {fixDialog.issue.userEmail && (
                  <p className="text-gray-500 text-xs">User: {fixDialog.issue.userEmail}</p>
                )}
              </div>

              {fixDialog.issue.details.expected !== undefined && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-800/30 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500">Current Value</p>
                    <p className="text-red-400 font-mono">{fixDialog.issue.details.actual}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Will Be Corrected To</p>
                    <p className="text-green-400 font-mono">{fixDialog.issue.details.expected}</p>
                  </div>
                </div>
              )}

              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-400 text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  This action will modify the database. Make sure you understand the impact.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFixDialog({ open: false, issue: null })}
              className="border-gray-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleFix}
              disabled={fixing}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {fixing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Fixing...
                </>
              ) : (
                <>
                  <Wrench className="h-4 w-4 mr-2" />
                  Apply Fix
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

