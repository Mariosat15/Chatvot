'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  CreditCard,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCcw,
  Activity,
  Server,
  Wifi,
  Shield,
  Database,
  Zap,
  TrendingUp,
  UserCheck,
  UserX,
  Eye,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DashboardStats {
  users: {
    total: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
    verified: number;
    active: number;
  };
  deposits: {
    total: number;
    totalEUR: number;
    completedToday: number;
    completedTodayEUR: number;
    pendingCount: number;
    pendingEUR: number;
    failedToday: number;
  };
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
  kyc: {
    totalVerified: number;
    pendingCount: number;
    approvedToday: number;
    rejectedToday: number;
  };
  fraud: {
    activeAlerts: number;
    highPriorityAlerts: number;
    alertsToday: number;
    suspendedUsers: number;
    bannedUsers: number;
  };
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
  recentActivity: {
    type: 'deposit' | 'withdrawal' | 'user' | 'kyc' | 'fraud';
    description: string;
    timestamp: string;
    status?: 'success' | 'warning' | 'error';
  }[];
  generatedAt: string;
}

const statusColors = {
  operational: 'bg-green-500',
  degraded: 'bg-yellow-500',
  down: 'bg-red-500',
  not_configured: 'bg-gray-500',
};

const statusText = {
  operational: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
  not_configured: 'Not Configured',
};

function StatusIndicator({ status }: { status: 'operational' | 'degraded' | 'down' | 'not_configured' }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn('h-2.5 w-2.5 rounded-full animate-pulse', statusColors[status])} />
      <span className={cn(
        'text-sm',
        status === 'operational' && 'text-green-400',
        status === 'degraded' && 'text-yellow-400',
        status === 'down' && 'text-red-400',
        status === 'not_configured' && 'text-gray-400',
      )}>
        {statusText[status]}
      </span>
    </div>
  );
}

function StatCard({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  trendLabel,
  color = 'blue',
  onClick,
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'cyan';
  onClick?: () => void;
}) {
  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
  };
  
  const iconColors = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
    purple: 'text-purple-400',
    cyan: 'text-cyan-400',
  };

  return (
    <Card 
      className={cn(
        'bg-gradient-to-br border cursor-pointer transition-all hover:scale-[1.02]',
        colorClasses[color]
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-400 mb-1">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
            {subValue && (
              <p className="text-sm text-gray-400 mt-1">{subValue}</p>
            )}
            {trendLabel && (
              <div className="flex items-center gap-1 mt-2">
                {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-400" />}
                {trend === 'down' && <TrendingUp className="h-3 w-3 text-red-400 rotate-180" />}
                <span className={cn(
                  'text-xs',
                  trend === 'up' && 'text-green-400',
                  trend === 'down' && 'text-red-400',
                  trend === 'neutral' && 'text-gray-400',
                )}>
                  {trendLabel}
                </span>
              </div>
            )}
          </div>
          <div className={cn('p-3 rounded-lg bg-gray-800/50', iconColors[color])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ReconciliationSummary {
  healthy: boolean;
  totalUsersChecked: number;
  issuesFound: number;
  criticalIssues: number;
  warningIssues: number;
  usersWithMismatch: number;
  totalDiscrepancy: number;
  lastRun?: string;
}

export default function AdminOverviewDashboard({ 
  onNavigate 
}: { 
  onNavigate?: (section: string) => void 
}) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  
  // Reconciliation state
  const [reconciliation, setReconciliation] = useState<ReconciliationSummary | null>(null);
  const [reconciliationLoading, setReconciliationLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dashboard/stats');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setStats(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchReconciliation = async () => {
    try {
      setReconciliationLoading(true);
      const response = await fetch('/api/reconciliation?action=run', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to run reconciliation');
      const data = await response.json();
      
      if (data.success && data.result) {
        setReconciliation({
          healthy: data.result.healthy,
          totalUsersChecked: data.result.summary?.totalUsersChecked || 0,
          issuesFound: data.result.summary?.issuesFound || 0,
          criticalIssues: data.result.summary?.criticalIssues || 0,
          warningIssues: data.result.summary?.warningIssues || 0,
          usersWithMismatch: data.result.balanceCheck?.usersWithMismatch || 0,
          totalDiscrepancy: data.result.balanceCheck?.totalDiscrepancy || 0,
          lastRun: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error running reconciliation:', error);
      // Don't show toast, just set null state
      setReconciliation(null);
    } finally {
      setReconciliationLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchReconciliation(); // Run reconciliation check on load
    
    // Auto-refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
    fetchReconciliation(); // Also refresh reconciliation
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-400">Failed to load dashboard</p>
          <Button onClick={fetchStats} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const totalPendingActions = 
    stats.withdrawals.pendingCount + 
    stats.withdrawals.approvedCount + 
    stats.kyc.pendingCount + 
    stats.fraud.activeAlerts;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>
          <p className="text-gray-400">
            {lastRefresh && (
              <>Last updated: {lastRefresh.toLocaleTimeString()}</>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="border-gray-600"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCcw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* Alert Banner */}
      {totalPendingActions > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <div>
              <p className="text-yellow-400 font-medium">
                {totalPendingActions} items require your attention
              </p>
              <p className="text-sm text-yellow-400/70">
                {stats.withdrawals.pendingCount > 0 && `${stats.withdrawals.pendingCount} pending withdrawals • `}
                {stats.withdrawals.approvedCount > 0 && `${stats.withdrawals.approvedCount} approved (awaiting completion) • `}
                {stats.kyc.pendingCount > 0 && `${stats.kyc.pendingCount} KYC pending • `}
                {stats.fraud.activeAlerts > 0 && `${stats.fraud.activeAlerts} fraud alerts`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Service Status Bar */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-400" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase">Database</p>
              <StatusIndicator status={stats.services.database} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase">Webhooks</p>
              <StatusIndicator status={stats.services.webhooks} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase">Stripe</p>
              <StatusIndicator status={stats.services.payments.stripe} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase">Nuvei</p>
              <StatusIndicator status={stats.services.payments.nuvei} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase">WebSocket</p>
              <StatusIndicator status={stats.services.massive} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase">Redis</p>
              <StatusIndicator status={stats.services.redis} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase">KYC (Veriff)</p>
              <StatusIndicator status={stats.services.kyc} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reconciliation Check */}
      <Card className={cn(
        "border",
        reconciliationLoading 
          ? "bg-gray-900/50 border-gray-800"
          : reconciliation?.healthy 
            ? "bg-green-500/5 border-green-500/30" 
            : "bg-red-500/5 border-red-500/30"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className={cn(
                "h-5 w-5",
                reconciliationLoading 
                  ? "text-gray-400"
                  : reconciliation?.healthy 
                    ? "text-green-400" 
                    : "text-red-400"
              )} />
              System Reconciliation
            </CardTitle>
            <div className="flex items-center gap-2">
              {reconciliation?.lastRun && (
                <span className="text-xs text-gray-500">
                  Last check: {new Date(reconciliation.lastRun).toLocaleTimeString()}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                className="border-gray-600"
                onClick={fetchReconciliation}
                disabled={reconciliationLoading}
              >
                {reconciliationLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {reconciliationLoading ? (
            <div className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              <span className="text-gray-400">Running reconciliation checks...</span>
            </div>
          ) : reconciliation ? (
            <div className="space-y-4">
              {/* Main Status */}
              <div className="flex items-center gap-3">
                {reconciliation.healthy ? (
                  <>
                    <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-green-400" />
                    </div>
                    <div>
                      <p className="text-green-400 font-semibold text-lg">All Systems Healthy</p>
                      <p className="text-gray-400 text-sm">
                        {reconciliation.totalUsersChecked} users checked, no issues found
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-red-400" />
                    </div>
                    <div>
                      <p className="text-red-400 font-semibold text-lg">Issues Detected</p>
                      <p className="text-gray-400 text-sm">
                        {reconciliation.issuesFound} issue(s) found across {reconciliation.usersWithMismatch} user(s)
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-white">{reconciliation.totalUsersChecked}</p>
                  <p className="text-xs text-gray-400">Users Checked</p>
                </div>
                <div className={cn(
                  "rounded-lg p-3 text-center",
                  reconciliation.criticalIssues > 0 ? "bg-red-500/10" : "bg-gray-800/50"
                )}>
                  <p className={cn(
                    "text-2xl font-bold",
                    reconciliation.criticalIssues > 0 ? "text-red-400" : "text-white"
                  )}>
                    {reconciliation.criticalIssues}
                  </p>
                  <p className="text-xs text-gray-400">Critical Issues</p>
                </div>
                <div className={cn(
                  "rounded-lg p-3 text-center",
                  reconciliation.warningIssues > 0 ? "bg-yellow-500/10" : "bg-gray-800/50"
                )}>
                  <p className={cn(
                    "text-2xl font-bold",
                    reconciliation.warningIssues > 0 ? "text-yellow-400" : "text-white"
                  )}>
                    {reconciliation.warningIssues}
                  </p>
                  <p className="text-xs text-gray-400">Warnings</p>
                </div>
                <div className={cn(
                  "rounded-lg p-3 text-center",
                  reconciliation.totalDiscrepancy > 0 ? "bg-red-500/10" : "bg-gray-800/50"
                )}>
                  <p className={cn(
                    "text-2xl font-bold",
                    reconciliation.totalDiscrepancy > 0 ? "text-red-400" : "text-white"
                  )}>
                    {reconciliation.totalDiscrepancy.toFixed(0)}
                  </p>
                  <p className="text-xs text-gray-400">Credit Discrepancy</p>
                </div>
              </div>

              {/* View Details Button */}
              {!reconciliation.healthy && (
                <Button
                  className="w-full mt-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                  onClick={() => onNavigate?.('reconciliation')}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Detailed Reconciliation Report
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 py-4 text-gray-400">
              <XCircle className="h-5 w-5" />
              <span>Failed to run reconciliation check</span>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchReconciliation}
                className="ml-auto"
              >
                Retry
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Users */}
        <StatCard
          title="Total Users"
          value={stats.users.total.toLocaleString()}
          subValue={`${stats.users.newToday} new today`}
          icon={Users}
          trend={stats.users.newToday > 0 ? 'up' : 'neutral'}
          trendLabel={`${stats.users.newThisWeek} this week`}
          color="blue"
          onClick={() => onNavigate?.('users')}
        />
        
        {/* Deposits Today */}
        <StatCard
          title="Deposits Today"
          value={`€${stats.deposits.completedTodayEUR.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subValue={`${stats.deposits.completedToday} transactions`}
          icon={ArrowDownToLine}
          trend={stats.deposits.completedToday > 0 ? 'up' : 'neutral'}
          trendLabel={`Total: €${stats.deposits.totalEUR.toLocaleString()}`}
          color="green"
          onClick={() => onNavigate?.('financial')}
        />
        
        {/* Withdrawals Pending */}
        <StatCard
          title="Pending Withdrawals"
          value={stats.withdrawals.pendingCount + stats.withdrawals.approvedCount}
          subValue={`€${(stats.withdrawals.pendingEUR || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          icon={ArrowUpFromLine}
          trend={stats.withdrawals.pendingCount > 5 ? 'up' : 'neutral'}
          trendLabel={`${stats.withdrawals.processingCount} processing`}
          color="yellow"
          onClick={() => onNavigate?.('pending-withdrawals')}
        />
        
        {/* Fraud Alerts */}
        <StatCard
          title="Fraud Alerts"
          value={stats.fraud.activeAlerts}
          subValue={`${stats.fraud.highPriorityAlerts} high priority`}
          icon={Shield}
          trend={stats.fraud.activeAlerts > 0 ? 'up' : 'neutral'}
          trendLabel={`${stats.fraud.alertsToday} new today`}
          color={stats.fraud.activeAlerts > 0 ? 'red' : 'green'}
          onClick={() => onNavigate?.('fraud')}
        />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Users */}
        <StatCard
          title="Active Users (30d)"
          value={stats.users.active.toLocaleString()}
          subValue={`${stats.users.verified} verified`}
          icon={UserCheck}
          color="cyan"
          onClick={() => onNavigate?.('users')}
        />
        
        {/* Pending Deposits */}
        <StatCard
          title="Pending Deposits"
          value={stats.deposits.pendingCount}
          subValue={`€${stats.deposits.pendingEUR.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          icon={Clock}
          color={stats.deposits.pendingCount > 0 ? 'yellow' : 'green'}
          onClick={() => onNavigate?.('payments')}
        />
        
        {/* KYC Pending */}
        <StatCard
          title="KYC Pending"
          value={stats.kyc.pendingCount}
          subValue={`${stats.kyc.approvedToday} approved today`}
          icon={Eye}
          color={stats.kyc.pendingCount > 0 ? 'yellow' : 'green'}
          onClick={() => onNavigate?.('kyc-history')}
        />
        
        {/* Suspended/Banned */}
        <StatCard
          title="Restricted Users"
          value={stats.fraud.suspendedUsers + stats.fraud.bannedUsers}
          subValue={`${stats.fraud.suspendedUsers} suspended, ${stats.fraud.bannedUsers} banned`}
          icon={UserX}
          color={stats.fraud.suspendedUsers + stats.fraud.bannedUsers > 0 ? 'red' : 'green'}
          onClick={() => onNavigate?.('fraud')}
        />
      </div>

      {/* Third Row - Detailed Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Overview */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-400" />
              Financial Overview
            </CardTitle>
            <CardDescription>Today's financial summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <p className="text-sm text-gray-400">Deposits Today</p>
                <p className="text-xl font-bold text-green-400">
                  €{stats.deposits.completedTodayEUR.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500">{stats.deposits.completedToday} transactions</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-sm text-gray-400">Withdrawals Today</p>
                <p className="text-xl font-bold text-yellow-400">
                  €{stats.withdrawals.completedTodayEUR.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500">{stats.withdrawals.completedToday} transactions</p>
              </div>
            </div>
            
            <div className="border-t border-gray-700 pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400">Total Deposits (All Time)</span>
                <span className="text-white font-medium">
                  €{stats.deposits.totalEUR.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400">Total Withdrawals (All Time)</span>
                <span className="text-white font-medium">
                  €{stats.withdrawals.totalEUR.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Failed Today</span>
                <span className={cn(
                  'font-medium',
                  stats.deposits.failedToday + stats.withdrawals.failedToday > 0 
                    ? 'text-red-400' 
                    : 'text-green-400'
                )}>
                  {stats.deposits.failedToday + stats.withdrawals.failedToday} transactions
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest platform activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[280px] overflow-y-auto">
              {stats.recentActivity.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No recent activity</p>
              ) : (
                stats.recentActivity.map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 rounded-lg bg-gray-800/50"
                  >
                    <div className={cn(
                      'h-2 w-2 rounded-full',
                      activity.status === 'success' && 'bg-green-500',
                      activity.status === 'warning' && 'bg-yellow-500',
                      activity.status === 'error' && 'bg-red-500',
                      !activity.status && 'bg-gray-500',
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{activity.description}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs border-gray-600 text-gray-400">
                      {activity.type}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Button
              variant="outline"
              className="border-gray-600 hover:bg-gray-800"
              onClick={() => onNavigate?.('pending-withdrawals')}
            >
              <ArrowUpFromLine className="h-4 w-4 mr-2" />
              Withdrawals
              {(stats.withdrawals.pendingCount + stats.withdrawals.approvedCount) > 0 && (
                <Badge className="ml-2 bg-yellow-500/20 text-yellow-400">
                  {stats.withdrawals.pendingCount + stats.withdrawals.approvedCount}
                </Badge>
              )}
            </Button>
            
            <Button
              variant="outline"
              className="border-gray-600 hover:bg-gray-800"
              onClick={() => onNavigate?.('payments')}
            >
              <Clock className="h-4 w-4 mr-2" />
              Pending Deposits
              {stats.deposits.pendingCount > 0 && (
                <Badge className="ml-2 bg-yellow-500/20 text-yellow-400">
                  {stats.deposits.pendingCount}
                </Badge>
              )}
            </Button>
            
            <Button
              variant="outline"
              className="border-gray-600 hover:bg-gray-800"
              onClick={() => onNavigate?.('kyc-history')}
            >
              <Eye className="h-4 w-4 mr-2" />
              KYC Reviews
              {stats.kyc.pendingCount > 0 && (
                <Badge className="ml-2 bg-yellow-500/20 text-yellow-400">
                  {stats.kyc.pendingCount}
                </Badge>
              )}
            </Button>
            
            <Button
              variant="outline"
              className="border-gray-600 hover:bg-gray-800"
              onClick={() => onNavigate?.('fraud')}
            >
              <Shield className="h-4 w-4 mr-2" />
              Fraud Alerts
              {stats.fraud.activeAlerts > 0 && (
                <Badge className="ml-2 bg-red-500/20 text-red-400">
                  {stats.fraud.activeAlerts}
                </Badge>
              )}
            </Button>
            
            <Button
              variant="outline"
              className="border-gray-600 hover:bg-gray-800"
              onClick={() => onNavigate?.('users')}
            >
              <Users className="h-4 w-4 mr-2" />
              Users
            </Button>
            
            <Button
              variant="outline"
              className="border-gray-600 hover:bg-gray-800"
              onClick={() => onNavigate?.('financial')}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Financials
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

