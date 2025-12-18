'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  Search, 
  Coins, 
  Calendar,
  Mail,
  RefreshCw,
  Plus,
  Minus,
  Edit,
  Trash2,
  Shield,
  AlertTriangle,
  FileText,
  Send,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Valid user roles
const USER_ROLES = [
  { value: 'trader', label: 'Trader', color: 'cyan', icon: '📈' },
  { value: 'admin', label: 'Admin', color: 'yellow', icon: '👑' },
  { value: 'backoffice', label: 'Back Office', color: 'purple', icon: '🏢' },
] as const;

type UserRole = typeof USER_ROLES[number]['value'];

interface UserData {
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
}

export default function UsersSection() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Credit dialog state
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [crediting, setCrediting] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('trader');
  const [editing, setEditing] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Invoice dialog state
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [userInvoices, setUserInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [resendingInvoice, setResendingInvoice] = useState<string | null>(null);

  // Password verification state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [pendingAction, setPendingAction] = useState<'credit' | 'edit' | 'delete' | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    // Filter users based on search query
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (user) =>
            user.name.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query) ||
            user.id.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, users]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setFilteredUsers(data.users);
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

  const handleOpenCreditDialog = (user: UserData) => {
    setSelectedUser(user);
    setCreditAmount('');
    setCreditReason('');
    setPendingAction('credit');
    setPasswordDialogOpen(true);
  };

  const handleOpenEditDialog = (user: UserData) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role || 'trader');
    setPendingAction('edit');
    setPasswordDialogOpen(true);
  };

  const handleOpenDeleteDialog = (user: UserData) => {
    setSelectedUser(user);
    setPendingAction('delete');
    setPasswordDialogOpen(true);
  };

  const handleOpenInvoiceDialog = async (user: UserData) => {
    setSelectedUser(user);
    setInvoiceDialogOpen(true);
    setLoadingInvoices(true);
    setUserInvoices([]);
    
    try {
      const response = await fetch(`/api/users/${user.id}/invoices`);
      if (response.ok) {
        const data = await response.json();
        setUserInvoices(data.invoices || []);
      } else {
        toast.error('Failed to load invoices');
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
      toast.error('Error loading invoices');
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleResendInvoice = async (invoiceId: string) => {
    setResendingInvoice(invoiceId);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/resend`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || 'Invoice sent successfully');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to resend invoice');
      }
    } catch (error) {
      console.error('Error resending invoice:', error);
      toast.error('Error resending invoice');
    } finally {
      setResendingInvoice(null);
    }
  };

  const handleViewInvoice = (invoiceId: string) => {
    window.open(`/api/invoices/${invoiceId}/html`, '_blank');
  };

  const handleVerifyPassword = async () => {
    if (!adminPassword) {
      toast.error('Please enter admin password');
      return;
    }

    setVerifyingPassword(true);
    try {
      const response = await fetch('/api/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });

      if (response.ok) {
        setPasswordDialogOpen(false);
        setAdminPassword('');
        
        // Execute the pending action
        if (pendingAction === 'credit') {
          setCreditDialogOpen(true);
        } else if (pendingAction === 'edit') {
          setEditDialogOpen(true);
        } else if (pendingAction === 'delete') {
          setDeleteDialogOpen(true);
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Invalid admin password');
      }
    } catch (error) {
      console.error('Error verifying password:', error);
      toast.error('Error verifying password');
    } finally {
      setVerifyingPassword(false);
    }
  };

  const handleCreditUser = async () => {
    if (!selectedUser || !creditAmount) {
      toast.error('Please enter an amount');
      return;
    }

    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount === 0) {
      toast.error('Please enter a valid amount (cannot be zero)');
      return;
    }

    if (!selectedUser.id) {
      toast.error('User ID is missing. Please refresh and try again.');
      return;
    }

    setCrediting(true);
    try {
      const payload = {
        userId: selectedUser.id,
        amount,
        reason: creditReason || `Admin ${amount > 0 ? 'credited' : 'removed'} ${Math.abs(amount)} credits`,
      };

      const response = await fetch('/api/users/credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        setCreditDialogOpen(false);
        fetchUsers(); // Refresh users list
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to credit user');
      }
    } catch (error) {
      console.error('Error crediting user:', error);
      toast.error('Error crediting user');
    } finally {
      setCrediting(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    // Check what changed
    const nameChanged = editName !== selectedUser.name;
    const emailChanged = editEmail !== selectedUser.email;
    const roleChanged = editRole !== (selectedUser.role || 'trader');

    if (!nameChanged && !emailChanged && !roleChanged) {
      toast.error('No changes detected');
      return;
    }

    setEditing(true);
    try {
      const response = await fetch('/api/users/edit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          name: nameChanged ? editName : undefined,
          email: emailChanged ? editEmail : undefined,
          role: roleChanged ? editRole : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        setEditDialogOpen(false);
        fetchUsers(); // Refresh users list
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Error updating user');
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setDeleting(true);
    try {
      const response = await fetch('/api/users/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        setDeleteDialogOpen(false);
        fetchUsers(); // Refresh users list
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Error deleting user');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-cyan-500/50 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-500 to-cyan-600 p-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-yellow-500 rounded-xl blur-lg opacity-50"></div>
                <div className="relative h-16 w-16 bg-white rounded-xl flex items-center justify-center shadow-xl">
                  <Users className="h-8 w-8 text-cyan-500" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                  User Management
                </h2>
                <p className="text-cyan-100 mt-1">
                  View all users and manage their accounts
                </p>
              </div>
            </div>
            <Button
              onClick={fetchUsers}
              disabled={loading}
              className="bg-white hover:bg-gray-100 text-cyan-600 font-bold shadow-xl h-12 px-6 transition-all hover:scale-105"
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search by name, email, or user ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-gray-900 border-gray-700 text-gray-100"
          />
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-12 text-center">
          <RefreshCw className="h-12 w-12 text-cyan-500 mx-auto mb-4 animate-spin" />
          <p className="text-gray-400">Loading users...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-12 text-center">
          <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">
            {searchQuery ? 'No users found matching your search' : 'No users found'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* User Info */}
                <div className="lg:col-span-3">
                  <div className="flex items-start gap-3">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0 ${
                      user.isAdmin 
                        ? 'bg-gradient-to-br from-yellow-500 to-yellow-600 ring-2 ring-yellow-500/50' 
                        : 'bg-gradient-to-br from-cyan-500 to-cyan-600'
                    }`}>
                      {user.isAdmin ? <Shield className="h-6 w-6" /> : user.name[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-lg font-bold text-gray-100 truncate">{user.name}</h3>
                        {/* Role Badge */}
                        {(() => {
                          const role = USER_ROLES.find(r => r.value === (user.role || 'trader')) || USER_ROLES[0];
                          const colorClasses = {
                            yellow: 'from-yellow-500/20 to-yellow-600/20 text-yellow-500 border-yellow-500/30',
                            cyan: 'from-cyan-500/20 to-cyan-600/20 text-cyan-500 border-cyan-500/30',
                            purple: 'from-purple-500/20 to-purple-600/20 text-purple-500 border-purple-500/30',
                          };
                          return (
                            <span className={`px-2 py-0.5 rounded-md bg-gradient-to-r ${colorClasses[role.color]} text-xs font-bold border flex items-center gap-1`}>
                              {role.value === 'admin' ? <Shield className="h-3 w-3" /> : <span>{role.icon}</span>}
                              {role.label.toUpperCase()}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-sm text-gray-400 truncate flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {user.email}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 font-mono break-all">
                        ID: {user.id}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Joined {formatDate(user.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Wallet Stats */}
                <div className="lg:col-span-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
                      <p className="text-xs text-gray-500 mb-1">Balance</p>
                      <p className="text-lg font-bold text-green-500">
                        {user.wallet.balance.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
                      <p className="text-xs text-gray-500 mb-1">Net Profit</p>
                      <p className={`text-lg font-bold ${user.wallet.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {user.wallet.netProfit >= 0 ? '+' : ''}{user.wallet.netProfit.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
                      <p className="text-xs text-gray-500 mb-1">Won</p>
                      <p className="text-sm font-semibold text-yellow-500">
                        {user.wallet.totalWon.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
                      <p className="text-xs text-gray-500 mb-1">Spent</p>
                      <p className="text-sm font-semibold text-gray-400">
                        {user.wallet.totalSpent.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Competition Stats */}
                <div className="lg:col-span-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-900/50 rounded-lg p-2 border border-gray-700/50">
                      <p className="text-xs text-gray-500 mb-0.5">Competitions</p>
                      <p className="text-base font-bold text-blue-500">
                        {user.competitions.total}
                      </p>
                      <p className="text-xs text-gray-500">
                        {user.competitions.active} active
                      </p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-2 border border-gray-700/50">
                      <p className="text-xs text-gray-500 mb-0.5">Win Rate</p>
                      <p className="text-base font-bold text-purple-500">
                        {(user.competitions.overallWinRate || 0).toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {user.competitions.totalTrades} trades
                      </p>
                    </div>
                  </div>
                </div>

                {/* Challenge Stats */}
                <div className="lg:col-span-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-900/50 rounded-lg p-2 border border-orange-500/20">
                      <p className="text-xs text-gray-500 mb-0.5">Challenges</p>
                      <p className="text-base font-bold text-orange-500">
                        {user.challenges?.total || 0}
                      </p>
                      <p className="text-xs text-gray-500">
                        {user.challenges?.won || 0}W / {user.challenges?.lost || 0}L
                      </p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-2 border border-orange-500/20">
                      <p className="text-xs text-gray-500 mb-0.5">Challenge P&L</p>
                      <p className={`text-base font-bold ${(user.challenges?.totalWon || 0) - (user.challenges?.totalSpent || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {((user.challenges?.totalWon || 0) - (user.challenges?.totalSpent || 0)).toFixed(0)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {user.challenges?.active || 0} active
                      </p>
                    </div>
                  </div>
                </div>

                {/* Marketplace Stats */}
                <div className="lg:col-span-1">
                  <div className="bg-gray-900/50 rounded-lg p-2 border border-purple-500/20 h-full">
                    <p className="text-xs text-gray-500 mb-0.5">Marketplace</p>
                    <p className="text-base font-bold text-purple-500">
                      {user.marketplace?.totalPurchases || 0}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(user.marketplace?.totalSpent || 0).toFixed(0)} spent
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="lg:col-span-2 flex items-center justify-end">
                  <div className="flex flex-col gap-2 w-full max-w-[200px]">
                    {/* Credit Button - Top (only for non-admin roles) */}
                    {user.role !== 'admin' && (
                      <Button
                        onClick={() => handleOpenCreditDialog(user)}
                        className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold shadow-lg shadow-green-500/50 transition-all hover:scale-105 gap-1"
                      >
                        <Plus className="h-4 w-4" />
                        Credit
                      </Button>
                    )}
                    
                    {/* Edit and Delete Buttons - Middle Row */}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleOpenEditDialog(user)}
                        variant="outline"
                        className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border-blue-500/30 hover:border-blue-500/50 transition-all gap-1"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                      {user.role !== 'admin' && (
                        <Button
                          onClick={() => handleOpenDeleteDialog(user)}
                          variant="outline"
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/30 hover:border-red-500/50 transition-all px-3"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    {/* Invoices Button - Bottom (only for non-admin roles) */}
                    {user.role !== 'admin' && (
                      <Button
                        onClick={() => handleOpenInvoiceDialog(user)}
                        variant="outline"
                        className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-amber-500/30 hover:border-amber-500/50 transition-all gap-1"
                      >
                        <FileText className="h-4 w-4" />
                        Invoices
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Credit User Dialog */}
      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 text-gray-100">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-green-500 flex items-center gap-2">
              <Coins className="h-6 w-6" />
              Manage User Credits
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Add or remove credits from {selectedUser?.name}'s wallet
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* User Info */}
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
              <p className="text-sm text-gray-400">User</p>
              <p className="text-lg font-bold text-gray-100">{selectedUser?.name}</p>
              <p className="text-sm text-gray-500">{selectedUser?.email}</p>
              <p className="text-sm text-green-500 mt-2">
                Current Balance: {selectedUser?.wallet.balance.toFixed(2)} credits
              </p>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-gray-300">
                Amount *
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="Enter amount (positive to add, negative to remove)"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="bg-gray-900 border-gray-700 text-gray-100"
              />
              <p className="text-xs text-gray-500">
                💡 Use positive values to add credits (e.g., 100) or negative values to remove credits (e.g., -50)
              </p>
            </div>

            {/* Reason Textarea */}
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-gray-300">
                Reason (Optional)
              </Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for crediting..."
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                className="bg-gray-900 border-gray-700 text-gray-100 min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreditDialogOpen(false)}
              className="bg-gray-700 hover:bg-gray-600 text-gray-100 border-gray-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreditUser}
              disabled={crediting || !creditAmount || parseFloat(creditAmount) === 0}
              className={`${
                parseFloat(creditAmount) >= 0
                  ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                  : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
              } text-white font-bold`}
            >
              {crediting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : parseFloat(creditAmount) >= 0 ? (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add {creditAmount || '0'} Credits
                </>
              ) : (
                <>
                  <Minus className="h-4 w-4 mr-2" />
                  Remove {Math.abs(parseFloat(creditAmount))} Credits
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Verification Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-800 to-gray-900 border border-yellow-700 text-gray-100">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-yellow-500 flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Admin Verification Required
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter your admin password to {pendingAction} this user
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-yellow-500">Security Check</p>
                  <p className="text-xs text-gray-400 mt-1">
                    This action requires admin authentication for security purposes
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminPassword" className="text-gray-300">
                Admin Password *
              </Label>
              <Input
                id="adminPassword"
                type="password"
                placeholder="Enter admin password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !verifyingPassword) {
                    handleVerifyPassword();
                  }
                }}
                className="bg-gray-900 border-gray-700 text-gray-100"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPasswordDialogOpen(false);
                setAdminPassword('');
              }}
              className="bg-gray-700 hover:bg-gray-600 text-gray-100 border-gray-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerifyPassword}
              disabled={verifyingPassword || !adminPassword}
              className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-900 font-bold"
            >
              {verifyingPassword ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Verify & Continue
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 text-gray-100">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-blue-500 flex items-center gap-2">
              <Edit className="h-6 w-6" />
              Edit User
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Update user information and role
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* User Info */}
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
              <p className="text-sm text-gray-400">Current User</p>
              <p className="text-lg font-bold text-gray-100">{selectedUser?.name}</p>
              <p className="text-sm text-gray-500">{selectedUser?.email}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500">Current Role:</span>
                {(() => {
                  const role = USER_ROLES.find(r => r.value === (selectedUser?.role || 'trader')) || USER_ROLES[0];
                  return (
                    <span className="text-xs font-bold text-gray-300">
                      {role.icon} {role.label}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="editName" className="text-gray-300">
                Name
              </Label>
              <Input
                id="editName"
                type="text"
                placeholder="Enter new name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-gray-900 border-gray-700 text-gray-100"
              />
            </div>

            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="editEmail" className="text-gray-300">
                Email
              </Label>
              <Input
                id="editEmail"
                type="email"
                placeholder="Enter new email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="bg-gray-900 border-gray-700 text-gray-100"
              />
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <Label className="text-gray-300">
                User Role
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {USER_ROLES.map((role) => {
                  const isSelected = editRole === role.value;
                  const colorClasses = {
                    yellow: isSelected ? 'bg-yellow-500/30 border-yellow-500 text-yellow-400' : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-yellow-500/50',
                    cyan: isSelected ? 'bg-cyan-500/30 border-cyan-500 text-cyan-400' : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-cyan-500/50',
                    purple: isSelected ? 'bg-purple-500/30 border-purple-500 text-purple-400' : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-purple-500/50',
                  };
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setEditRole(role.value)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${colorClasses[role.color]}`}
                    >
                      <span className="text-xl">{role.icon}</span>
                      <span className="text-xs font-bold">{role.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                ⚠️ Changing role affects what the user can access. Only traders appear in the leaderboard.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="bg-gray-700 hover:bg-gray-600 text-gray-100 border-gray-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditUser}
              disabled={editing || (!editName && !editEmail)}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold"
            >
              {editing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Update User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-800 to-gray-900 border border-red-700 text-gray-100">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-red-500 flex items-center gap-2">
              <Trash2 className="h-6 w-6" />
              Delete User
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              This action cannot be undone
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Warning */}
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-500">Permanent Deletion</p>
                  <p className="text-xs text-gray-400 mt-1">
                    This will permanently delete all user data including:
                  </p>
                  <ul className="text-xs text-gray-400 mt-2 space-y-1 list-disc list-inside">
                    <li>User account and sessions</li>
                    <li>Wallet and transactions</li>
                    <li>Competition participations</li>
                    <li>Trading positions and history</li>
                    <li>Badges and level progress</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* User Info */}
            <div className="bg-gray-900/50 rounded-lg p-4 border border-red-700">
              <p className="text-sm text-gray-400 mb-2">You are about to delete:</p>
              <p className="text-lg font-bold text-red-500">{selectedUser?.name}</p>
              <p className="text-sm text-gray-500">{selectedUser?.email}</p>
              <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-400">
                <p>Balance: ${selectedUser?.wallet.balance.toFixed(2)}</p>
                <p>Competitions: {selectedUser?.competitions.total}</p>
                <p>Total Trades: {selectedUser?.competitions.totalTrades}</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="bg-gray-700 hover:bg-gray-600 text-gray-100 border-gray-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteUser}
              disabled={deleting}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold"
            >
              {deleting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete User Permanently
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Invoices Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-800 to-gray-900 border border-amber-700 text-gray-100 max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-amber-500 flex items-center gap-2">
              <FileText className="h-6 w-6" />
              User Invoices
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              All invoices for {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {loadingInvoices ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 text-amber-500 animate-spin" />
                <span className="ml-3 text-gray-400">Loading invoices...</span>
              </div>
            ) : userInvoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No invoices found for this user</p>
              </div>
            ) : (
              <div className="space-y-3">
                {userInvoices.map((invoice) => (
                  <div
                    key={invoice._id}
                    className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 hover:border-amber-500/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Invoice Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-lg font-bold text-amber-500">
                            {invoice.invoiceNumber}
                          </p>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            invoice.status === 'paid' 
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : invoice.status === 'sent'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                          }`}>
                            {invoice.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">
                          {new Date(invoice.invoiceDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {invoice.lineItems?.[0]?.description || 'Credit Purchase'}
                        </p>
                      </div>

                      {/* Amount */}
                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold text-gray-100">
                          €{invoice.total?.toFixed(2) || '0.00'}
                        </p>
                        {invoice.vatAmount > 0 && (
                          <p className="text-xs text-gray-500">
                            incl. VAT €{invoice.vatAmount.toFixed(2)}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleViewInvoice(invoice._id)}
                          className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleResendInvoice(invoice._id)}
                          disabled={resendingInvoice === invoice._id}
                          className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30"
                        >
                          {resendingInvoice === invoice._id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-1" />
                              Resend
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    {/* Email sent info */}
                    {invoice.sentAt && (
                      <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        Last sent: {new Date(invoice.sentAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInvoiceDialogOpen(false)}
              className="bg-gray-700 hover:bg-gray-600 text-gray-100 border-gray-600"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

