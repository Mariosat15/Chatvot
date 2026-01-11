'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  Search, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Filter,
  ArrowUpDown,
  Shield,
  Ban,
  Mail,
  MailCheck,
  MailX,
  TrendingUp,
  TrendingDown,
  Wallet,
  Trophy,
  Swords,
  Download,
  UserCheck,
  UserPlus,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import UserFullDetailPanel from './UserFullDetailPanel';
import { CustomerAssignmentBadge } from './CustomerAssignmentBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Valid user roles
const USER_ROLES = [
  { value: 'trader', label: 'Trader', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  { value: 'affiliate', label: 'Affiliate', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { value: 'gamemaster', label: 'Gamemaster', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
] as const;

type UserRole = typeof USER_ROLES[number]['value'];

export interface Assignment {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeRole: string;
  assignedAt: string;
}

export interface UserData {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isAdmin: boolean;
  createdAt: string;
  emailVerified: boolean;
  wallet: {
    balance: number;
    totalDeposited: number;
    totalWithdrawn: number;
    totalSpent: number;
    totalWon: number;
    netProfit: number;
  };
  competitions: {
    total: number;
    active: number;
    completed: number;
    totalTrades: number;
    totalPnl: number;
    overallWinRate: number;
  };
  challenges: {
    total: number;
    active: number;
    won: number;
    lost: number;
    totalSpent: number;
    totalWon: number;
  };
  marketplace: {
    totalPurchases: number;
    totalSpent: number;
    items: string[];
  };
  // Assignment info
  assignment?: Assignment | null;
  // Online status
  isOnline?: boolean;
  lastSeen?: string;
  // Optional fields that may be present
  country?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  phone?: string;
}

type SortField = 'name' | 'email' | 'balance' | 'netProfit' | 'createdAt' | 'competitions' | 'challenges' | 'online';
type SortDirection = 'asc' | 'desc';

export default function UsersSection() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Filters
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [emailVerifiedFilter, setEmailVerifiedFilter] = useState<string>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<string>('all');
  const [onlineFilter, setOnlineFilter] = useState<string>('all');
  
  // Assignments data
  const [assignments, setAssignments] = useState<Map<string, Assignment>>(new Map());
  const [employees, setEmployees] = useState<{ _id: string; name: string; email: string }[]>([]);
  
  // Online status data
  const [onlineStatus, setOnlineStatus] = useState<Map<string, { isOnline: boolean; lastSeen?: string }>>(new Map());
  
  // Detail panel state
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchAssignments();
    fetchEmployees();
    fetchOnlineStatus();
    
    // Refresh online status every 30 seconds
    const onlineInterval = setInterval(fetchOnlineStatus, 30000);
    return () => clearInterval(onlineInterval);
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        toast.success(`Loaded ${data.total} users`);
      } else {
        toast.error('Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error loading users');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      const response = await fetch('/api/customer-assignments?limit=10000');
      if (response.ok) {
        const data = await response.json();
        const assignmentMap = new Map<string, Assignment>();
        (data.assignments || []).forEach((a: any) => {
          assignmentMap.set(a.customerId, {
            employeeId: a.employeeId,
            employeeName: a.employeeName,
            employeeEmail: a.employeeEmail,
            employeeRole: a.employeeRole,
            assignedAt: a.assignedAt,
          });
        });
        setAssignments(assignmentMap);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchOnlineStatus = async () => {
    try {
      const response = await fetch('/api/users/presence');
      if (response.ok) {
        const data = await response.json();
        const statusMap = new Map<string, { isOnline: boolean; lastSeen?: string }>();
        (data.presences || []).forEach((p: { participantId: string; status: string; lastSeen?: string }) => {
          statusMap.set(p.participantId, {
            isOnline: p.status !== 'offline',
            lastSeen: p.lastSeen,
          });
        });
        setOnlineStatus(statusMap);
      }
    } catch (error) {
      console.error('Error fetching online status:', error);
    }
  };

  // Enrich users with assignment data and online status
  const enrichedUsers = useMemo(() => {
    return users.map(user => {
      const presence = onlineStatus.get(user.id);
      return {
        ...user,
        assignment: assignments.get(user.id) || null,
        isOnline: presence?.isOnline || false,
        lastSeen: presence?.lastSeen,
      };
    });
  }, [users, assignments, onlineStatus]);

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    let result = [...enrichedUsers];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          user.id.toLowerCase().includes(query) ||
          user.assignment?.employeeName?.toLowerCase().includes(query)
      );
    }
    
    // Apply role filter
    if (roleFilter !== 'all') {
      result = result.filter((user) => user.role === roleFilter);
    }
    
    // Apply email verified filter
    if (emailVerifiedFilter !== 'all') {
      result = result.filter((user) => 
        emailVerifiedFilter === 'verified' ? user.emailVerified : !user.emailVerified
      );
    }
    
    // Apply assignment filter
    if (assignmentFilter !== 'all') {
      if (assignmentFilter === 'assigned') {
        result = result.filter((user) => user.assignment !== null);
      } else if (assignmentFilter === 'unassigned') {
        result = result.filter((user) => user.assignment === null);
      } else {
        // Filter by specific employee ID
        result = result.filter((user) => user.assignment?.employeeId === assignmentFilter);
      }
    }
    
    // Apply online filter
    if (onlineFilter !== 'all') {
      result = result.filter((user) => 
        onlineFilter === 'online' ? user.isOnline : !user.isOnline
      );
    }
    
    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'email':
          comparison = a.email.localeCompare(b.email);
          break;
        case 'balance':
          comparison = a.wallet.balance - b.wallet.balance;
          break;
        case 'netProfit':
          comparison = a.wallet.netProfit - b.wallet.netProfit;
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'competitions':
          comparison = a.competitions.total - b.competitions.total;
          break;
        case 'challenges':
          comparison = (a.challenges?.total || 0) - (b.challenges?.total || 0);
          break;
        case 'online':
          // Online users first when sorting descending
          comparison = (a.isOnline ? 1 : 0) - (b.isOnline ? 1 : 0);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    // Sort unassigned first if enabled (can be controlled by settings)
    result.sort((a, b) => {
      if (!a.assignment && b.assignment) return -1;
      if (a.assignment && !b.assignment) return 1;
      return 0;
    });
    
    return result;
  }, [enrichedUsers, searchQuery, roleFilter, emailVerifiedFilter, assignmentFilter, onlineFilter, sortField, sortDirection]);

  // Paginated users
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredAndSortedUsers.slice(start, end);
  }, [filteredAndSortedUsers, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredAndSortedUsers.length / pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const openUserDetail = (user: UserData) => {
    setSelectedUser(user);
    setDetailPanelOpen(true);
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-cyan-400 transition-colors group"
    >
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-cyan-400' : 'text-gray-600 group-hover:text-gray-400'}`} />
    </button>
  );

  // Stats calculations
  const stats = useMemo(() => ({
    totalUsers: users.length,
    totalTraders: users.filter(u => u.role === 'trader').length,
    verifiedEmails: users.filter(u => u.emailVerified).length,
    totalBalance: users.reduce((sum, u) => sum + u.wallet.balance, 0),
    assignedUsers: assignments.size,
    unassignedUsers: users.length - assignments.size,
    onlineUsers: enrichedUsers.filter(u => u.isOnline).length,
    offlineUsers: enrichedUsers.filter(u => !u.isOnline).length,
  }), [users, assignments, enrichedUsers]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-cyan-500/50 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-cyan-500 to-cyan-600 p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-yellow-500 rounded-xl blur-lg opacity-50"></div>
                <div className="relative h-14 w-14 bg-white rounded-xl flex items-center justify-center shadow-xl">
                  <Users className="h-7 w-7 text-cyan-500" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">User Management</h2>
                <p className="text-cyan-100 text-sm flex items-center gap-2 flex-wrap">
                  <span>{stats.totalUsers} users</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    {stats.onlineUsers} online
                  </span>
                  <span>•</span>
                  <span>{stats.verifiedEmails} verified</span>
                  <span>•</span>
                  <span>{stats.assignedUsers} assigned</span>
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {/* Export functionality */}}
                variant="outline"
                className="bg-white/10 hover:bg-white/20 text-white border-white/30"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                onClick={fetchUsers}
                disabled={loading}
                className="bg-white hover:bg-gray-100 text-cyan-600 font-bold shadow-xl h-10 px-5 transition-all hover:scale-105"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, or ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 bg-gray-900 border-gray-700 text-gray-100"
              />
            </div>
          </div>
          
          {/* Role Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[140px] bg-gray-900 border-gray-700">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="trader">Traders</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="backoffice">Back Office</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Email Verified Filter */}
          <Select value={emailVerifiedFilter} onValueChange={(v) => { setEmailVerifiedFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[160px] bg-gray-900 border-gray-700">
              <SelectValue placeholder="Email Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="unverified">Unverified</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Assignment Filter */}
          <Select value={assignmentFilter} onValueChange={(v) => { setAssignmentFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[180px] bg-gray-900 border-gray-700">
              <UserCheck className="h-4 w-4 mr-2 text-gray-400" />
              <SelectValue placeholder="Assignment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignments</SelectItem>
              <SelectItem value="assigned">
                <span className="flex items-center gap-2">
                  <UserCheck className="h-3 w-3 text-green-400" />
                  Assigned
                </span>
              </SelectItem>
              <SelectItem value="unassigned">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-yellow-400" />
                  Unassigned
                </span>
              </SelectItem>
              {employees.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs text-gray-500 font-semibold uppercase">
                    By Employee
                  </div>
                  {employees.map((emp) => (
                    <SelectItem key={emp._id} value={emp._id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
          
          {/* Online Status Filter */}
          <Select value={onlineFilter} onValueChange={(v) => { setOnlineFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[140px] bg-gray-900 border-gray-700">
              <SelectValue placeholder="Online Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="online">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Online ({stats.onlineUsers})
                </span>
              </SelectItem>
              <SelectItem value="offline">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                  Offline ({stats.offlineUsers})
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          
          {/* Page Size */}
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
            <SelectTrigger className="w-[100px] bg-gray-900 border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          
          <span className="text-sm text-gray-400">
            Showing {paginatedUsers.length} of {filteredAndSortedUsers.length}
          </span>
        </div>
      </div>

      {/* Users Table */}
      <div className="flex-1 bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-12 w-12 text-cyan-500 animate-spin" />
          </div>
        ) : filteredAndSortedUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Users className="h-12 w-12 text-gray-600 mb-4" />
            <p className="text-gray-400">
              {searchQuery ? 'No users found matching your search' : 'No users found'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900/50 border-b border-gray-700">
                <tr>
                  <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortableHeader field="name">User</SortableHeader>
                  </th>
                  <th className="text-center p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortableHeader field="online">Online</SortableHeader>
                  </th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortableHeader field="balance">Balance</SortableHeader>
                  </th>
                  <th className="text-right p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortableHeader field="netProfit">Net Profit</SortableHeader>
                  </th>
                  <th className="text-center p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortableHeader field="competitions">Comp.</SortableHeader>
                  </th>
                  <th className="text-center p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortableHeader field="challenges">Chal.</SortableHeader>
                  </th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortableHeader field="createdAt">Joined</SortableHeader>
                  </th>
                  <th className="text-center p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {paginatedUsers.map((user) => {
                  const roleConfig = USER_ROLES.find(r => r.value === user.role) || USER_ROLES[0];
                  
                  return (
                    <tr 
                      key={user.id} 
                      className="hover:bg-gray-700/30 transition-colors cursor-pointer"
                      onClick={() => openUserDetail(user)}
                    >
                      {/* User Info */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0 ${
                            user.isAdmin 
                              ? 'bg-gradient-to-br from-yellow-500 to-yellow-600' 
                              : 'bg-gradient-to-br from-cyan-500 to-cyan-600'
                          }`}>
                            {user.isAdmin ? <Shield className="h-5 w-5" /> : user.name[0]?.toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-100 truncate">{user.name}</p>
                              <Badge className={`${roleConfig.color} text-xs border`}>
                                {roleConfig.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      
                      {/* Online Status */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center">
                          {user.isOnline ? (
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></span>
                              <span className="text-xs text-green-400 font-medium">Online</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5" title={user.lastSeen ? `Last seen: ${new Date(user.lastSeen).toLocaleString()}` : 'Never seen'}>
                              <span className="w-2.5 h-2.5 bg-gray-500 rounded-full"></span>
                              <span className="text-xs text-gray-500 font-medium">Offline</span>
                            </div>
                          )}
                        </div>
                      </td>
                      
                      {/* Email Status */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {user.emailVerified ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                              <MailCheck className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                              <MailX className="h-3 w-3 mr-1" />
                              Unverified
                            </Badge>
                          )}
                        </div>
                      </td>
                      
                      {/* Balance */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Wallet className="h-4 w-4 text-green-400" />
                          <span className="font-mono font-semibold text-green-400">
                            {user.wallet.balance.toFixed(2)}
                          </span>
                        </div>
                      </td>
                      
                      {/* Net Profit */}
                      <td className="p-4 text-right">
                        <div className={`flex items-center justify-end gap-1 ${
                          user.wallet.netProfit >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {user.wallet.netProfit >= 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          <span className="font-mono font-semibold">
                            {user.wallet.netProfit >= 0 ? '+' : ''}{user.wallet.netProfit.toFixed(2)}
                          </span>
                        </div>
                      </td>
                      
                      {/* Competitions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Trophy className="h-4 w-4 text-blue-400" />
                          <span className="text-gray-300">{user.competitions.total}</span>
                          {user.competitions.active > 0 && (
                            <span className="text-xs text-green-400">({user.competitions.active})</span>
                          )}
                        </div>
                      </td>
                      
                      {/* Challenges */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Swords className="h-4 w-4 text-orange-400" />
                          <span className="text-gray-300">{user.challenges?.total || 0}</span>
                          <span className="text-xs text-gray-500">
                            ({user.challenges?.won || 0}W/{user.challenges?.lost || 0}L)
                          </span>
                        </div>
                      </td>
                      
                      {/* Assignment */}
                      <td className="p-4">
                        <CustomerAssignmentBadge 
                          assignment={user.assignment} 
                          compact={true}
                        />
                      </td>
                      
                      {/* Joined Date */}
                      <td className="p-4 text-gray-400 text-sm">
                        {formatDate(user.createdAt)}
                      </td>
                      
                      {/* Actions */}
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          onClick={() => openUserDetail(user)}
                          className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border-cyan-500/30"
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
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <p className="text-sm text-gray-400">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="bg-gray-800 border-gray-700 hover:bg-gray-700"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="bg-gray-800 border-gray-700 hover:bg-gray-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            {/* Page numbers */}
            <div className="flex gap-1 mx-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className={currentPage === pageNum 
                      ? "bg-cyan-500 text-white" 
                      : "bg-gray-800 border-gray-700 hover:bg-gray-700"
                    }
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="bg-gray-800 border-gray-700 hover:bg-gray-700"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="bg-gray-800 border-gray-700 hover:bg-gray-700"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Full Screen Detail Panel */}
      {selectedUser && (
        <UserFullDetailPanel
          open={detailPanelOpen}
          onOpenChange={setDetailPanelOpen}
          user={selectedUser}
          onRefresh={() => {
            fetchUsers();
            fetchAssignments();
          }}
        />
      )}
    </div>
  );
}
