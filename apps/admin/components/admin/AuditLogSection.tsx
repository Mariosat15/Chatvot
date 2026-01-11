'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ScrollText,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
  Shield,
  DollarSign,
  Trophy,
  Settings,
  FileText,
  Database,
  AlertTriangle,
  Clock,
  Trash2,
  Eye,
  Download,
  Calendar,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

interface AuditLog {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  action: string;
  actionCategory: string;
  description: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, unknown>;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
  requestPath?: string;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  createdAt: string;
}

interface UniqueUser {
  _id: string;
  userName: string;
  userEmail: string;
  count: number;
}

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'user_management', label: 'User Management', icon: User, color: 'bg-blue-500' },
  { value: 'financial', label: 'Financial', icon: DollarSign, color: 'bg-green-500' },
  { value: 'competition', label: 'Competition', icon: Trophy, color: 'bg-yellow-500' },
  { value: 'settings', label: 'Settings', icon: Settings, color: 'bg-purple-500' },
  { value: 'content', label: 'Content', icon: FileText, color: 'bg-pink-500' },
  { value: 'security', label: 'Security', icon: Shield, color: 'bg-red-500' },
  { value: 'system', label: 'System', icon: Settings, color: 'bg-gray-500' },
  { value: 'data', label: 'Data', icon: Database, color: 'bg-orange-500' },
  { value: 'other', label: 'Other', icon: AlertTriangle, color: 'bg-gray-400' },
];

const getCategoryInfo = (category: string) => {
  return CATEGORIES.find(c => c.value === category) || CATEGORIES[CATEGORIES.length - 1];
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'success': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

export default function AuditLogSection() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Filter options
  const [uniqueActions, setUniqueActions] = useState<string[]>([]);
  const [uniqueUsers, setUniqueUsers] = useState<UniqueUser[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  
  // Dialogs
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearBeforeDate, setClearBeforeDate] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      
      if (search) params.append('search', search);
      if (category !== 'all') params.append('category', category);
      if (status !== 'all') params.append('status', status);
      if (selectedUser !== 'all') params.append('userEmail', selectedUser); // Filter by email, not userId
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`/api/audit-logs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch logs');
      
      const result = await response.json();
      setLogs(result.data.logs);
      setTotal(result.data.pagination.total);
      setTotalPages(result.data.pagination.totalPages);
      setUniqueActions(result.data.filters.uniqueActions);
      setUniqueUsers(result.data.filters.uniqueUsers);
      setStats(result.data.stats);
    } catch (error) {
      toast.error('Failed to load audit logs');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, search, category, status, selectedUser, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };

  const handleClearLogs = async () => {
    setClearing(true);
    try {
      const params = clearBeforeDate ? `?beforeDate=${clearBeforeDate}` : '';
      const response = await fetch(`/api/audit-logs${params}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to clear logs');
      
      const result = await response.json();
      toast.success(`Cleared ${result.deletedCount} audit logs`);
      setShowClearDialog(false);
      setClearBeforeDate('');
      fetchLogs();
    } catch (error) {
      toast.error('Failed to clear audit logs');
    } finally {
      setClearing(false);
    }
  };

  const exportLogs = async () => {
    try {
      const params = new URLSearchParams({ limit: '10000' });
      if (search) params.append('search', search);
      if (category !== 'all') params.append('category', category);
      if (status !== 'all') params.append('status', status);
      if (selectedUser !== 'all') params.append('userId', selectedUser);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`/api/audit-logs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch logs');
      
      const result = await response.json();
      
      // Create CSV
      const csvRows = [
        ['Date', 'User', 'Email', 'Role', 'Action', 'Category', 'Description', 'Target', 'Status', 'IP Address'].join(','),
      ];
      
      for (const log of result.data.logs) {
        csvRows.push([
          new Date(log.createdAt).toISOString(),
          `"${log.userName}"`,
          log.userEmail,
          log.userRole,
          log.action,
          log.actionCategory,
          `"${log.description.replace(/"/g, '""')}"`,
          log.targetName || '-',
          log.status,
          log.ipAddress || '-',
        ].join(','));
      }
      
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Audit logs exported');
    } catch (error) {
      toast.error('Failed to export audit logs');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white text-xl flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-indigo-400" />
                Admin Audit Log
              </CardTitle>
              <CardDescription>
                Track all admin actions and changes made in the dashboard
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportLogs}
                className="border-gray-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClearDialog(true)}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Logs
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLogs}
                disabled={loading}
                className="border-gray-700"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {CATEGORIES.slice(1).map((cat) => {
          const count = stats[cat.value] || 0;
          const Icon = cat.icon;
          const colorClass = cat.color || 'bg-gray-500';
          if (!Icon) return null;
          return (
            <Card
              key={cat.value}
              className={`bg-gray-900 border-gray-700 cursor-pointer hover:border-gray-600 transition-colors ${
                category === cat.value ? 'border-indigo-500' : ''
              }`}
              onClick={() => setCategory(category === cat.value ? 'all' : cat.value)}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded ${colorClass}/20`}>
                    <Icon className={`h-3.5 w-3.5 ${colorClass.replace('bg-', 'text-').replace('-500', '-400')}`} />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">{count}</div>
                    <div className="text-xs text-gray-500 truncate">{cat.label}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search logs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            {/* Category */}
            <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value} className="text-white">
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status */}
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all" className="text-white">All Status</SelectItem>
                <SelectItem value="success" className="text-white">Success</SelectItem>
                <SelectItem value="failed" className="text-white">Failed</SelectItem>
                <SelectItem value="pending" className="text-white">Pending</SelectItem>
              </SelectContent>
            </Select>

            {/* User */}
            <Select value={selectedUser} onValueChange={(v) => { setSelectedUser(v); setPage(1); }}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all" className="text-white">All Users</SelectItem>
                {uniqueUsers.map((user) => (
                  <SelectItem key={user._id} value={user._id} className="text-white">
                    {user.userName} ({user.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range */}
            <div className="flex gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="bg-gray-800 border-gray-700 text-white text-sm"
                placeholder="Start"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="bg-gray-800 border-gray-700 text-white text-sm"
                placeholder="End"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <ScrollText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700">
                      <TableHead className="text-gray-400">Date/Time</TableHead>
                      <TableHead className="text-gray-400">Admin</TableHead>
                      <TableHead className="text-gray-400">Category</TableHead>
                      <TableHead className="text-gray-400">Action</TableHead>
                      <TableHead className="text-gray-400">Description</TableHead>
                      <TableHead className="text-gray-400">Target</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                      <TableHead className="text-gray-400 w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const catInfo = getCategoryInfo(log.actionCategory);
                      const CatIcon = catInfo.icon;
                      return (
                        <TableRow key={log._id} className="border-gray-700 hover:bg-gray-800/50">
                          <TableCell className="text-gray-400 text-sm whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5" />
                              {new Date(log.createdAt).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <div className="font-medium text-white text-sm">{log.userName}</div>
                              <div className="text-xs text-gray-500">{log.userEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${catInfo.color || 'bg-gray-500'} text-white text-xs`}>
                              {CatIcon && <CatIcon className="h-3 w-3 mr-1" />}
                              {catInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-gray-300">
                            {log.action.replace(/_/g, ' ')}
                          </TableCell>
                          <TableCell className="text-gray-400 text-sm max-w-xs truncate">
                            {log.description}
                          </TableCell>
                          <TableCell className="text-gray-500 text-sm">
                            {log.targetName || log.targetId || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${getStatusColor(log.status)} text-xs`}>
                              {log.status === 'success' && <CheckCircle className="h-3 w-3 mr-1" />}
                              {log.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4 text-gray-400" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t border-gray-700">
                <div className="text-sm text-gray-400">
                  Showing {((page - 1) * 50) + 1} - {Math.min(page * 50, total)} of {total} logs
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="border-gray-700"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-400">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages}
                    className="border-gray-700"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Log Detail Dialog - Full Screen */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent 
          className="bg-gray-900 border-gray-700 overflow-y-auto"
          style={{ width: '95vw', maxWidth: '95vw', height: '90vh', maxHeight: '90vh' }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <ScrollText className="h-5 w-5 text-indigo-400" />
              Audit Log Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Date/Time</div>
                  <div className="text-white text-sm">
                    {new Date(selectedLog.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Status</div>
                  <Badge variant="outline" className={`${getStatusColor(selectedLog.status)}`}>
                    {selectedLog.status}
                  </Badge>
                </div>
              </div>

              {/* Admin Info */}
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-2">Performed By</div>
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-500/20 rounded-full p-2">
                    <User className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-white font-medium">{selectedLog.userName}</div>
                    <div className="text-sm text-gray-400">{selectedLog.userEmail}</div>
                    <div className="text-xs text-gray-500">Role: {selectedLog.userRole}</div>
                  </div>
                </div>
              </div>

              {/* Action Info */}
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-2">Action</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={`${getCategoryInfo(selectedLog.actionCategory).color} text-white`}>
                      {getCategoryInfo(selectedLog.actionCategory).label}
                    </Badge>
                    <span className="font-mono text-sm text-gray-300">
                      {selectedLog.action}
                    </span>
                  </div>
                  <p className="text-white">{selectedLog.description}</p>
                </div>
              </div>

              {/* Target Info */}
              {(selectedLog.targetType || selectedLog.targetId || selectedLog.targetName) && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-2">Target</div>
                  <div className="space-y-1">
                    {selectedLog.targetType && (
                      <div className="text-sm">
                        <span className="text-gray-500">Type:</span>{' '}
                        <span className="text-white">{selectedLog.targetType}</span>
                      </div>
                    )}
                    {selectedLog.targetName && (
                      <div className="text-sm">
                        <span className="text-gray-500">Name:</span>{' '}
                        <span className="text-white">{selectedLog.targetName}</span>
                      </div>
                    )}
                    {selectedLog.targetId && (
                      <div className="text-sm font-mono">
                        <span className="text-gray-500">ID:</span>{' '}
                        <span className="text-gray-300">{selectedLog.targetId}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Changes */}
              {(selectedLog.previousValue !== undefined || selectedLog.newValue !== undefined) && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-2">Changes</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-red-400 mb-1">Previous Value</div>
                      <pre className="text-xs text-gray-300 bg-gray-900 rounded p-2 overflow-auto max-h-32">
                        {JSON.stringify(selectedLog.previousValue, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <div className="text-xs text-green-400 mb-1">New Value</div>
                      <pre className="text-xs text-gray-300 bg-gray-900 rounded p-2 overflow-auto max-h-32">
                        {JSON.stringify(selectedLog.newValue, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-2">Additional Info</div>
                  <pre className="text-xs text-gray-300 bg-gray-900 rounded p-2 overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Request Info */}
              {(selectedLog.ipAddress || selectedLog.userAgent) && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-2">Request Info</div>
                  <div className="space-y-1 text-sm">
                    {selectedLog.ipAddress && (
                      <div>
                        <span className="text-gray-500">IP:</span>{' '}
                        <span className="text-gray-300 font-mono">{selectedLog.ipAddress}</span>
                      </div>
                    )}
                    {selectedLog.requestPath && (
                      <div>
                        <span className="text-gray-500">Path:</span>{' '}
                        <span className="text-gray-300 font-mono">{selectedLog.requestPath}</span>
                      </div>
                    )}
                    {selectedLog.userAgent && (
                      <div className="truncate">
                        <span className="text-gray-500">Agent:</span>{' '}
                        <span className="text-gray-400 text-xs">{selectedLog.userAgent}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Error Message */}
              {selectedLog.errorMessage && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <div className="text-xs text-red-400 mb-1">Error Message</div>
                  <p className="text-red-300 text-sm">{selectedLog.errorMessage}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Clear Logs Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Trash2 className="h-5 w-5 text-red-400" />
              Clear Audit Logs
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. Choose how to clear the logs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-sm text-yellow-400">
                ⚠️ Clearing audit logs will permanently remove the selected records.
                This action will be logged.
              </p>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">
                Clear logs before date (optional)
              </label>
              <Input
                type="date"
                value={clearBeforeDate}
                onChange={(e) => setClearBeforeDate(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to clear all logs
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearDialog(false)}
              className="border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleClearLogs}
              disabled={clearing}
              className="bg-red-600 hover:bg-red-700"
            >
              {clearing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {clearBeforeDate ? `Clear Logs Before ${clearBeforeDate}` : 'Clear All Logs'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

