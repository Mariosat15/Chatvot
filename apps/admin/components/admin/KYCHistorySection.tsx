'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  RefreshCw,
  Search,
  Calendar,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  FileText,
  Eye,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface KYCSession {
  _id: string;
  userId: string;
  userEmail: string;
  userName: string;
  veriffSessionId: string;
  status: string;
  verificationCode?: number;
  verificationReason?: string;
  personData?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    nationality?: string;
    idNumber?: string;
  };
  documentData?: {
    type?: string;
    number?: string;
    country?: string;
    validFrom?: string;
    validUntil?: string;
  };
  addressData?: {
    fullAddress?: string;
    country?: string;
  };
  createdAt: string;
  completedAt?: string;
  decisionTime?: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ComponentType<any>; label: string }> = {
  created: { color: 'bg-gray-500', icon: Clock, label: 'Created' },
  started: { color: 'bg-blue-500', icon: Clock, label: 'Started' },
  submitted: { color: 'bg-yellow-500', icon: Clock, label: 'Submitted' },
  approved: { color: 'bg-green-500', icon: CheckCircle, label: 'Approved' },
  declined: { color: 'bg-red-500', icon: XCircle, label: 'Declined' },
  resubmission_requested: { color: 'bg-orange-500', icon: AlertTriangle, label: 'Resubmission Required' },
  expired: { color: 'bg-gray-600', icon: Clock, label: 'Expired' },
  abandoned: { color: 'bg-gray-700', icon: XCircle, label: 'Abandoned' },
};

export default function KYCHistorySection() {
  const [sessions, setSessions] = useState<KYCSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    declined: 0,
    pending: 0,
    expired: 0,
  });
  const [detailDialog, setDetailDialog] = useState<{
    open: boolean;
    session: KYCSession | null;
  }>({ open: false, session: null });

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/kyc-history?${params}`);
      const data = await response.json();

      if (data.sessions) {
        setSessions(data.sessions);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching KYC history:', error);
      toast.error('Failed to load KYC history');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, dateFrom, dateTo, searchQuery]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const exportToCSV = () => {
    const headers = ['Date', 'User', 'Email', 'Status', 'Document Type', 'Country', 'Verification ID'];
    const rows = sessions.map((s) => [
      formatDate(s.createdAt),
      s.userName,
      s.userEmail,
      s.status,
      s.documentData?.type || '',
      s.documentData?.country || '',
      s.veriffSessionId,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kyc-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <Shield className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">KYC Verification History</h2>
            <p className="text-sm text-gray-400">View all identity verification attempts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={fetchHistory}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <p className="text-sm text-gray-400">Total Verifications</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-400">{stats.approved}</div>
            <p className="text-sm text-gray-400">Approved</p>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-400">{stats.declined}</div>
            <p className="text-sm text-gray-400">Declined</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
            <p className="text-sm text-gray-400">Pending</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-500/10 border-gray-500/30">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-gray-400">{stats.expired}</div>
            <p className="text-sm text-gray-400">Expired</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, document..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-900 border-gray-600"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-gray-900 border-gray-600">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="created">Created</SelectItem>
                <SelectItem value="started">Started</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-36 bg-gray-900 border-gray-600"
              />
              <span className="text-gray-400">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-36 bg-gray-900 border-gray-600"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No KYC verifications found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Document</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Country</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {sessions.map((session) => {
                    const statusConfig = STATUS_CONFIG[session.status] || STATUS_CONFIG.created;
                    const StatusIcon = statusConfig.icon;

                    return (
                      <tr key={session._id} className="hover:bg-gray-900/30">
                        <td className="px-4 py-3">
                          <div className="text-sm text-white">
                            {new Date(session.createdAt).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(session.createdAt).toLocaleTimeString()}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-gray-700 rounded-full">
                              <User className="h-4 w-4 text-gray-300" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">{session.userName}</div>
                              <div className="text-xs text-gray-400">{session.userEmail}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="secondary"
                            className={`${statusConfig.color} text-white flex items-center gap-1 w-fit`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-white">
                            {session.documentData?.type || '—'}
                          </div>
                          {session.documentData?.number && (
                            <div className="text-xs text-gray-400">
                              ****{session.documentData.number.slice(-4)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-white">
                            {session.documentData?.country || session.addressData?.country || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailDialog({ open: true, session })}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
              <div className="text-sm text-gray-400">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} results
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => setDetailDialog({ ...detailDialog, open })}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5" />
              KYC Verification Details
            </DialogTitle>
          </DialogHeader>
          {detailDialog.session && (
            <div className="space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-400">Status</p>
                  <Badge
                    variant="secondary"
                    className={`${STATUS_CONFIG[detailDialog.session.status]?.color || 'bg-gray-500'} text-white mt-1`}
                  >
                    {STATUS_CONFIG[detailDialog.session.status]?.label || detailDialog.session.status}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Verification ID</p>
                  <p className="text-xs font-mono text-white">{detailDialog.session.veriffSessionId}</p>
                </div>
              </div>

              {/* User Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-900/50 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">User</p>
                  <p className="text-white font-medium">{detailDialog.session.userName}</p>
                  <p className="text-sm text-gray-400">{detailDialog.session.userEmail}</p>
                </div>
                <div className="p-4 bg-gray-900/50 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">User ID</p>
                  <p className="text-xs font-mono text-white break-all">{detailDialog.session.userId}</p>
                </div>
              </div>

              {/* Person Data */}
              {detailDialog.session.personData && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-400 mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Person Data (from Veriff)
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {detailDialog.session.personData.firstName && (
                      <div>
                        <p className="text-xs text-gray-400">First Name</p>
                        <p className="text-white">{detailDialog.session.personData.firstName}</p>
                      </div>
                    )}
                    {detailDialog.session.personData.lastName && (
                      <div>
                        <p className="text-xs text-gray-400">Last Name</p>
                        <p className="text-white">{detailDialog.session.personData.lastName}</p>
                      </div>
                    )}
                    {detailDialog.session.personData.dateOfBirth && (
                      <div>
                        <p className="text-xs text-gray-400">Date of Birth</p>
                        <p className="text-white">{detailDialog.session.personData.dateOfBirth}</p>
                      </div>
                    )}
                    {detailDialog.session.personData.nationality && (
                      <div>
                        <p className="text-xs text-gray-400">Nationality</p>
                        <p className="text-white">{detailDialog.session.personData.nationality}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Document Data */}
              {detailDialog.session.documentData && (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <h4 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Document Data
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {detailDialog.session.documentData.type && (
                      <div>
                        <p className="text-xs text-gray-400">Document Type</p>
                        <p className="text-white">{detailDialog.session.documentData.type}</p>
                      </div>
                    )}
                    {detailDialog.session.documentData.number && (
                      <div>
                        <p className="text-xs text-gray-400">Document Number</p>
                        <p className="text-white font-mono">****{detailDialog.session.documentData.number.slice(-4)}</p>
                      </div>
                    )}
                    {detailDialog.session.documentData.country && (
                      <div>
                        <p className="text-xs text-gray-400">Country</p>
                        <p className="text-white">{detailDialog.session.documentData.country}</p>
                      </div>
                    )}
                    {detailDialog.session.documentData.validUntil && (
                      <div>
                        <p className="text-xs text-gray-400">Valid Until</p>
                        <p className="text-white">{detailDialog.session.documentData.validUntil}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Verification Result */}
              {detailDialog.session.verificationReason && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <h4 className="text-sm font-medium text-red-400 mb-2">Verification Result</h4>
                  <p className="text-white">{detailDialog.session.verificationReason}</p>
                  {detailDialog.session.verificationCode && (
                    <p className="text-xs text-gray-400 mt-1">Code: {detailDialog.session.verificationCode}</p>
                  )}
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Created</p>
                  <p className="text-white">{formatDate(detailDialog.session.createdAt)}</p>
                </div>
                {detailDialog.session.completedAt && (
                  <div>
                    <p className="text-gray-400">Completed</p>
                    <p className="text-white">{formatDate(detailDialog.session.completedAt)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

