'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  History,
  Search,
  Filter,
  AlertTriangle,
  Ban,
  Clock,
  Shield,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  FileWarning,
  CheckCircle2,
  XCircle,
  UserX,
  UserCheck,
  Gavel,
  Scale,
  Activity,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface FraudHistoryEntry {
  _id: string;
  userId: string;
  userEmail: string;
  userName: string;
  actionType: string;
  actionSeverity: string;
  performedBy: {
    type: string;
    adminId?: string;
    adminEmail?: string;
    adminName?: string;
  };
  reason: string;
  details: string;
  evidence?: Array<{
    type: string;
    description: string;
    value?: string | number;
    timestamp?: string;
  }>;
  previousState?: {
    suspicionScore?: number;
    restrictionStatus?: string;
    accountStatus?: string;
  };
  newState?: {
    suspicionScore?: number;
    restrictionStatus?: string;
    accountStatus?: string;
  };
  duration?: {
    startDate?: string;
    endDate?: string;
    isPermanent?: boolean;
    durationDays?: number;
  };
  adminNotes?: string;
  relatedAlertId?: { _id: string; title: string; status: string };
  relatedCompetitionId?: { _id: string; name: string };
  createdAt: string;
}

interface HistoryStats {
  totalActions: number;
  warnings: number;
  suspensions: number;
  bans: number;
  lifts: number;
  criticalActions: number;
  autoActions: number;
  adminActions: number;
}

interface UserHistorySummary {
  history: FraudHistoryEntry[];
  actionCounts: Record<string, number>;
  stats: {
    totalActions: number;
    firstIncident?: string;
    lastIncident?: string;
    warningCount: number;
    suspensionCount: number;
    suspensionLiftCount: number;
    banCount: number;
    banLiftCount: number;
    investigationCount: number;
    criticalIncidents: number;
    highIncidents: number;
    behaviorScore: number;
    currentStatus: string;
  };
}

const ACTION_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  warning_issued: { label: 'Warning Issued', icon: <AlertTriangle className="h-4 w-4" />, color: 'bg-yellow-500' },
  investigation_started: { label: 'Investigation Started', icon: <Search className="h-4 w-4" />, color: 'bg-blue-500' },
  investigation_resolved: { label: 'Investigation Resolved', icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-green-500' },
  suspended: { label: 'Suspended', icon: <Clock className="h-4 w-4" />, color: 'bg-orange-500' },
  suspension_lifted: { label: 'Suspension Lifted', icon: <UserCheck className="h-4 w-4" />, color: 'bg-emerald-500' },
  banned: { label: 'Banned', icon: <Ban className="h-4 w-4" />, color: 'bg-red-600' },
  ban_lifted: { label: 'Ban Lifted', icon: <UserCheck className="h-4 w-4" />, color: 'bg-emerald-500' },
  restriction_added: { label: 'Restriction Added', icon: <Shield className="h-4 w-4" />, color: 'bg-orange-500' },
  restriction_removed: { label: 'Restriction Removed', icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-green-500' },
  alert_created: { label: 'Alert Created', icon: <FileWarning className="h-4 w-4" />, color: 'bg-purple-500' },
  alert_dismissed: { label: 'Alert Dismissed', icon: <XCircle className="h-4 w-4" />, color: 'bg-gray-500' },
  alert_resolved: { label: 'Alert Resolved', icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-green-500' },
  evidence_added: { label: 'Evidence Added', icon: <Activity className="h-4 w-4" />, color: 'bg-blue-500' },
  manual_review: { label: 'Manual Review', icon: <Eye className="h-4 w-4" />, color: 'bg-indigo-500' },
  auto_action: { label: 'Auto Action', icon: <Gavel className="h-4 w-4" />, color: 'bg-red-500' },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-gray-500' },
  medium: { label: 'Medium', color: 'bg-yellow-500' },
  high: { label: 'High', color: 'bg-orange-500' },
  critical: { label: 'Critical', color: 'bg-red-600' },
};

export default function FraudHistorySection() {
  const [history, setHistory] = useState<FraudHistoryEntry[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [performedByFilter, setPerformedByFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  // User detail dialog
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userHistory, setUserHistory] = useState<UserHistorySummary | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [loadingUserHistory, setLoadingUserHistory] = useState(false);

  // Entry detail dialog
  const [selectedEntry, setSelectedEntry] = useState<FraudHistoryEntry | null>(null);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
      });

      if (searchTerm) params.append('search', searchTerm);
      if (actionTypeFilter !== 'all') params.append('actionType', actionTypeFilter);
      if (severityFilter !== 'all') params.append('severity', severityFilter);
      if (performedByFilter !== 'all') params.append('performedByType', performedByFilter);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);

      const res = await fetch(`/api/fraud/history?${params}`);
      const data = await res.json();

      if (data.success) {
        setHistory(data.data.history);
        setStats(data.data.stats);
        setTotalPages(data.data.pagination.totalPages);
        setTotal(data.data.pagination.total);
      }
    } catch (error) {
      console.error('Error fetching fraud history:', error);
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, actionTypeFilter, severityFilter, performedByFilter, dateRange]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const fetchUserHistory = async (userId: string) => {
    setLoadingUserHistory(true);
    try {
      const res = await fetch(`/api/fraud/history/user/${userId}`);
      const data = await res.json();

      if (data.success) {
        setUserHistory(data.data);
        setUserDialogOpen(true);
      }
    } catch (error) {
      console.error('Error fetching user history:', error);
    } finally {
      setLoadingUserHistory(false);
    }
  };

  const handleUserClick = (userId: string) => {
    setSelectedUserId(userId);
    fetchUserHistory(userId);
  };

  const handleEntryClick = (entry: FraudHistoryEntry) => {
    setSelectedEntry(entry);
    setEntryDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      clean: 'bg-green-500',
      warned: 'bg-yellow-500',
      under_investigation: 'bg-blue-500',
      suspended: 'bg-orange-500',
      banned: 'bg-red-600',
    };
    return colors[status] || 'bg-gray-500';
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats?.totalActions || 0}</div>
            <div className="text-xs text-zinc-400">Total Actions</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-500">{stats?.warnings || 0}</div>
            <div className="text-xs text-zinc-400">Warnings</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-500">{stats?.suspensions || 0}</div>
            <div className="text-xs text-zinc-400">Suspensions</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{stats?.bans || 0}</div>
            <div className="text-xs text-zinc-400">Bans</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-500">{stats?.lifts || 0}</div>
            <div className="text-xs text-zinc-400">Lifts</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats?.criticalActions || 0}</div>
            <div className="text-xs text-zinc-400">Critical</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-500">{stats?.autoActions || 0}</div>
            <div className="text-xs text-zinc-400">Auto Actions</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-500">{stats?.adminActions || 0}</div>
            <div className="text-xs text-zinc-400">Admin Actions</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  placeholder="Search by email, name, reason..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-zinc-800 border-zinc-700"
                />
              </div>
            </div>
            <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700">
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {Object.entries(ACTION_TYPE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={performedByFilter} onValueChange={setPerformedByFilter}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700">
                <SelectValue placeholder="Performed By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="automated">Automated</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={fetchHistory}
              className="border-zinc-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History List */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Fraud Action History
          </CardTitle>
          <CardDescription>
            {total} total entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No fraud history entries found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => {
                const actionConfig = ACTION_TYPE_CONFIG[entry.actionType] || {
                  label: entry.actionType,
                  icon: <Activity className="h-4 w-4" />,
                  color: 'bg-gray-500',
                };
                const severityConfig = SEVERITY_CONFIG[entry.actionSeverity] || SEVERITY_CONFIG.medium;

                return (
                  <div
                    key={entry._id}
                    className="bg-zinc-800 rounded-lg p-4 hover:bg-zinc-700 transition-colors cursor-pointer"
                    onClick={() => handleEntryClick(entry)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${actionConfig.color}`}>
                          {actionConfig.icon}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{actionConfig.label}</span>
                            <Badge className={`${severityConfig.color} text-white text-xs`}>
                              {severityConfig.label}
                            </Badge>
                            {entry.performedBy.type === 'automated' && (
                              <Badge variant="outline" className="text-purple-400 border-purple-400 text-xs">
                                Auto
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-zinc-400">
                            <button
                              className="text-blue-400 hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUserClick(entry.userId);
                              }}
                            >
                              {entry.userName || entry.userEmail}
                            </button>
                            <span className="mx-2">•</span>
                            <span>{entry.reason}</span>
                          </div>
                          <div className="text-xs text-zinc-500">
                            {entry.performedBy.type === 'admin' && entry.performedBy.adminEmail && (
                              <span>By: {entry.performedBy.adminEmail} • </span>
                            )}
                            <span>{formatDate(entry.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-800">
              <div className="text-sm text-zinc-400">
                Page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-zinc-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="border-zinc-700"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Entry Detail Dialog */}
      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEntry && ACTION_TYPE_CONFIG[selectedEntry.actionType]?.icon}
              {selectedEntry && ACTION_TYPE_CONFIG[selectedEntry.actionType]?.label}
            </DialogTitle>
            <DialogDescription>
              Full details for this action
            </DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="max-h-[60vh] overflow-y-auto">
              <div className="space-y-4 p-1">
                {/* User Info */}
                <div className="bg-zinc-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">User</h4>
                  <div className="flex items-center gap-3">
                    <User className="h-10 w-10 text-zinc-500" />
                    <div>
                      <p className="font-medium text-white">{selectedEntry.userName}</p>
                      <p className="text-sm text-zinc-400">{selectedEntry.userEmail}</p>
                    </div>
                  </div>
                </div>

                {/* Action Details */}
                <div className="bg-zinc-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">Reason</h4>
                  <p className="text-white">{selectedEntry.reason}</p>
                </div>

                <div className="bg-zinc-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">Details</h4>
                  <p className="text-white whitespace-pre-wrap">{selectedEntry.details}</p>
                </div>

                {/* Performed By */}
                <div className="bg-zinc-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">Performed By</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedEntry.performedBy.type === 'admin' ? 'default' : 'secondary'}>
                      {selectedEntry.performedBy.type.toUpperCase()}
                    </Badge>
                    {selectedEntry.performedBy.adminEmail && (
                      <span className="text-white">{selectedEntry.performedBy.adminEmail}</span>
                    )}
                  </div>
                </div>

                {/* Duration */}
                {selectedEntry.duration && (
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-zinc-400 mb-2">Duration</h4>
                    <div className="space-y-1">
                      {selectedEntry.duration.isPermanent ? (
                        <Badge className="bg-red-600">Permanent</Badge>
                      ) : (
                        <>
                          {selectedEntry.duration.startDate && (
                            <p className="text-white">Start: {formatDate(selectedEntry.duration.startDate)}</p>
                          )}
                          {selectedEntry.duration.endDate && (
                            <p className="text-white">End: {formatDate(selectedEntry.duration.endDate)}</p>
                          )}
                          {selectedEntry.duration.durationDays && (
                            <p className="text-zinc-400">{selectedEntry.duration.durationDays} days</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* State Changes */}
                {(selectedEntry.previousState || selectedEntry.newState) && (
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-zinc-400 mb-2">State Change</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedEntry.previousState && (
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">Previous</p>
                          <p className="text-white">{selectedEntry.previousState.accountStatus || 'N/A'}</p>
                        </div>
                      )}
                      {selectedEntry.newState && (
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">New</p>
                          <p className="text-white">{selectedEntry.newState.accountStatus || 'N/A'}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Evidence */}
                {selectedEntry.evidence && selectedEntry.evidence.length > 0 && (
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-zinc-400 mb-2">Evidence</h4>
                    <div className="space-y-2">
                      {selectedEntry.evidence.map((ev, idx) => (
                        <div key={idx} className="bg-zinc-700 rounded p-2 text-sm">
                          <div className="font-medium text-white">{ev.type}</div>
                          <div className="text-zinc-400">{ev.description}</div>
                          {ev.value && <div className="text-zinc-300 mt-1">Value: {String(ev.value)}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin Notes */}
                {selectedEntry.adminNotes && (
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-zinc-400 mb-2">Admin Notes</h4>
                    <p className="text-white whitespace-pre-wrap">{selectedEntry.adminNotes}</p>
                  </div>
                )}

                {/* Timestamp */}
                <div className="bg-zinc-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">Timestamp</h4>
                  <p className="text-white">{formatDate(selectedEntry.createdAt)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* User History Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="max-w-4xl bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Fraud History
            </DialogTitle>
            <DialogDescription>
              Complete fraud history and behavior analysis
            </DialogDescription>
          </DialogHeader>
          {loadingUserHistory ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
          ) : userHistory && (
            <div className="max-h-[70vh] overflow-y-auto">
              <div className="space-y-6 p-1">
                {/* User Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-gray-900 border-gray-700">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-white">
                        {userHistory.stats.totalActions || userHistory.history.length || 0}
                      </div>
                      <div className="text-xs text-zinc-400">Total Incidents</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-900 border-gray-700">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-orange-500">
                        {userHistory.stats.suspensionCount || userHistory.actionCounts.suspended || 0}
                      </div>
                      <div className="text-xs text-zinc-400">Suspensions</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-900 border-gray-700">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-red-500">
                        {userHistory.stats.banCount || userHistory.actionCounts.banned || 0}
                      </div>
                      <div className="text-xs text-zinc-400">Bans</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-900 border-gray-700">
                    <CardContent className="p-4 text-center">
                      <Badge className={getStatusBadge(
                        // Calculate status from action counts if stats are empty
                        userHistory.stats.currentStatus || 
                        ((userHistory.actionCounts.banned || 0) > (userHistory.actionCounts.ban_lifted || 0) ? 'banned' :
                         (userHistory.actionCounts.suspended || 0) > (userHistory.actionCounts.suspension_lifted || 0) ? 'suspended' :
                         (userHistory.actionCounts.investigation_started || 0) > 0 ? 'under_investigation' :
                         (userHistory.actionCounts.warning_issued || 0) > 0 ? 'warned' : 'clean')
                      )}>
                        {(userHistory.stats.currentStatus || 
                          ((userHistory.actionCounts.banned || 0) > (userHistory.actionCounts.ban_lifted || 0) ? 'banned' :
                           (userHistory.actionCounts.suspended || 0) > (userHistory.actionCounts.suspension_lifted || 0) ? 'suspended' :
                           (userHistory.actionCounts.investigation_started || 0) > 0 ? 'under_investigation' :
                           (userHistory.actionCounts.warning_issued || 0) > 0 ? 'warned' : 'clean')
                        )?.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <div className="text-xs text-zinc-400 mt-2">Current Status</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Behavior Score */}
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Scale className="h-4 w-4" />
                      Behavior Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      // Calculate behavior score from action counts if not provided
                      const calcScore = userHistory.stats.behaviorScore || (
                        ((userHistory.actionCounts.warning_issued || 0) * 10) +
                        ((userHistory.actionCounts.suspended || 0) * 25) +
                        ((userHistory.actionCounts.banned || 0) * 50) +
                        ((userHistory.actionCounts.investigation_started || 0) * 5) -
                        ((userHistory.actionCounts.suspension_lifted || 0) * 5) -
                        ((userHistory.actionCounts.ban_lifted || 0) * 10)
                      );
                      const score = Math.max(0, Math.min(100, calcScore));
                      
                      return (
                        <>
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <div className="h-4 bg-zinc-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    score > 70 ? 'bg-red-500' :
                                    score > 40 ? 'bg-orange-500' :
                                    score > 20 ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${score}%` }}
                                />
                              </div>
                            </div>
                            <div className="text-2xl font-bold">
                              {score}/100
                            </div>
                          </div>
                          <p className="text-sm text-zinc-400 mt-2">
                            {score > 70 ? 'High risk - Multiple serious violations' :
                             score > 40 ? 'Medium risk - Has violations on record' :
                             score > 20 ? 'Low risk - Minor incidents' : 'Clean record'}
                          </p>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Action Counts */}
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Action Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(userHistory.actionCounts).map(([type, count]) => {
                        const config = ACTION_TYPE_CONFIG[type];
                        return (
                          <div key={type} className="flex items-center gap-2 bg-gray-800 rounded p-2">
                            <div className={`p-1 rounded ${config?.color || 'bg-gray-500'}`}>
                              {config?.icon || <Activity className="h-3 w-3" />}
                            </div>
                            <div>
                              <div className="text-white font-medium">{count}</div>
                              <div className="text-xs text-zinc-400">{config?.label || type}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Timeline */}
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">History Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {userHistory.history.slice(0, 10).map((entry, idx) => {
                        const config = ACTION_TYPE_CONFIG[entry.actionType];
                        return (
                          <div key={entry._id} className="flex items-start gap-3">
                            <div className="relative">
                              <div className={`p-2 rounded-full ${config?.color || 'bg-gray-500'}`}>
                                {config?.icon || <Activity className="h-4 w-4" />}
                              </div>
                              {idx < userHistory.history.length - 1 && (
                                <div className="absolute top-10 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-gray-700" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white">{config?.label || entry.actionType}</span>
                                <Badge className={`${SEVERITY_CONFIG[entry.actionSeverity]?.color || 'bg-gray-500'} text-white text-xs`}>
                                  {entry.actionSeverity}
                                </Badge>
                              </div>
                              <p className="text-sm text-zinc-400">{entry.reason}</p>
                              <p className="text-xs text-zinc-500">{formatDate(entry.createdAt)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

