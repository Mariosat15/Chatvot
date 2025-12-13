'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Ban, UserX, RefreshCw, Search, Shield, Calendar, AlertCircle, Settings } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface UserInfo {
  id: string;
  name: string;
  email: string;
}

interface UserRestriction {
  _id: string;
  userId: string;
  restrictionType: 'banned' | 'suspended';
  reason: string;
  customReason?: string;
  canTrade: boolean;
  canEnterCompetitions: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
  expiresAt?: string;
  restrictedAt: string;
  restrictedBy: string;
  relatedFraudAlertId?: string;
  isActive: boolean;
  userInfo?: UserInfo;
}

export default function RestrictedUsersSection() {
  const [restrictions, setRestrictions] = useState<UserRestriction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'banned' | 'suspended'>('all');
  const [selectedUser, setSelectedUser] = useState<UserRestriction | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showUnrestrictDialog, setShowUnrestrictDialog] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  // Edit form state
  const [editReason, setEditReason] = useState('');
  const [editCustomReason, setEditCustomReason] = useState('');
  const [editCanTrade, setEditCanTrade] = useState(true);
  const [editCanEnterCompetitions, setEditCanEnterCompetitions] = useState(true);
  const [editCanDeposit, setEditCanDeposit] = useState(true);
  const [editCanWithdraw, setEditCanWithdraw] = useState(true);
  const [editExpiresAt, setEditExpiresAt] = useState('');

  const fetchRestrictions = async () => {
    setLoading(true);
    try {
      console.log('🔍 Fetching restrictions...');
      const response = await fetch('/api/admin/fraud/restrictions');
      const data = await response.json();
      
      console.log('📊 Restrictions response:', data);
      
      if (data.success) {
        console.log(`✅ Found ${data.restrictions.length} restriction(s)`);
        setRestrictions(data.restrictions);
      } else {
        console.error('❌ Failed to load restrictions:', data.message);
        toast.error('Failed to load restrictions');
      }
    } catch (error) {
      console.error('❌ Error fetching restrictions:', error);
      toast.error('Failed to load restrictions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestrictions();
  }, []);

  const handleEditClick = (restriction: UserRestriction) => {
    setSelectedUser(restriction);
    setEditReason(restriction.reason);
    setEditCustomReason(restriction.customReason || '');
    setEditCanTrade(restriction.canTrade);
    setEditCanEnterCompetitions(restriction.canEnterCompetitions);
    setEditCanDeposit(restriction.canDeposit);
    setEditCanWithdraw(restriction.canWithdraw);
    setEditExpiresAt(restriction.expiresAt ? new Date(restriction.expiresAt).toISOString().slice(0, 16) : '');
    setShowEditDialog(true);
  };

  const handleUnrestrictClick = (restriction: UserRestriction) => {
    setSelectedUser(restriction);
    setShowUnrestrictDialog(true);
  };

  const handleUpdateRestriction = async () => {
    if (!selectedUser || !adminPassword) {
      toast.error('Admin password required');
      return;
    }

    try {
      console.log('✏️ Sending update restriction request for:', selectedUser._id);
      
      const response = await fetch('/api/admin/fraud/update-restriction', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restrictionId: selectedUser._id,
          reason: editReason,
          customReason: editCustomReason,
          canTrade: editCanTrade,
          canEnterCompetitions: editCanEnterCompetitions,
          canDeposit: editCanDeposit,
          canWithdraw: editCanWithdraw,
          expiresAt: editExpiresAt || null,
          adminPassword,
        }),
      });

      const data = await response.json();
      
      console.log('📥 Update response:', { status: response.status, data });

      if (data.success) {
        toast.success(data.message || 'Restriction updated successfully');
        setShowEditDialog(false);
        setAdminPassword('');
        fetchRestrictions();
      } else {
        console.error('❌ Update failed:', data.message);
        toast.error(data.message || 'Failed to update restriction');
      }
    } catch (error) {
      console.error('❌ Error updating restriction:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update restriction');
    }
  };

  const handleUnrestrict = async () => {
    if (!selectedUser || !adminPassword) {
      toast.error('Admin password required');
      return;
    }

    try {
      console.log('🔓 Sending unrestrict request for user:', selectedUser.userId);
      
      const response = await fetch('/api/admin/fraud/unrestrict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: [selectedUser.userId],
          adminPassword,
        }),
      });

      const data = await response.json();
      
      console.log('📥 Unrestrict response:', { status: response.status, data });

      if (data.success) {
        toast.success(data.message || 'User unrestricted successfully');
        setShowUnrestrictDialog(false);
        setAdminPassword('');
        fetchRestrictions();
      } else {
        console.error('❌ Unrestrict failed:', data.message);
        toast.error(data.message || 'Failed to unrestrict user');
      }
    } catch (error) {
      console.error('❌ Error unrestricting user:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to unrestrict user');
    }
  };

  const filteredRestrictions = restrictions.filter(r => {
    const userInfo = r.userInfo;
    const matchesSearch = !searchTerm || 
      r.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userInfo?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userInfo?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || r.restrictionType === filterType;
    
    return matchesSearch && matchesType && r.isActive;
  });

  const stats = {
    totalBanned: restrictions.filter(r => r.restrictionType === 'banned' && r.isActive).length,
    totalSuspended: restrictions.filter(r => r.restrictionType === 'suspended' && r.isActive).length,
    expiringSoon: restrictions.filter(r => 
      r.restrictionType === 'suspended' && 
      r.isActive && 
      r.expiresAt && 
      new Date(r.expiresAt) < new Date(Date.now() + 24 * 60 * 60 * 1000)
    ).length,
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-red-500/10 border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-400">Banned Users</CardTitle>
            <Ban className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.totalBanned}</div>
            <p className="text-xs text-gray-400 mt-1">Permanently restricted</p>
          </CardContent>
        </Card>

        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-yellow-400">Suspended Users</CardTitle>
            <UserX className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats.totalSuspended}</div>
            <p className="text-xs text-gray-400 mt-1">Temporarily restricted</p>
          </CardContent>
        </Card>

        <Card className="bg-orange-500/10 border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-orange-400">Expiring Soon</CardTitle>
            <Calendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats.expiringSoon}</div>
            <p className="text-xs text-gray-400 mt-1">Within 24 hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-500" />
              Restricted Users Management
            </CardTitle>
            <Button 
              onClick={fetchRestrictions} 
              variant="outline"
              size="sm"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by User ID, Name, or Email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-900 border-gray-700 text-white"
              />
            </div>
            
            <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
              <SelectTrigger className="w-full sm:w-48 bg-gray-900 border-gray-700 text-white">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Restrictions</SelectItem>
                <SelectItem value="banned">Banned Only</SelectItem>
                <SelectItem value="suspended">Suspended Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Restricted Users List */}
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading restrictions...</div>
          ) : filteredRestrictions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Shield className="h-12 w-12 mx-auto mb-4 text-gray-600" />
              <p>No restricted users found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRestrictions.map((restriction) => {
                const userInfo = restriction.userInfo;
                const isExpiringSoon = restriction.expiresAt && 
                  new Date(restriction.expiresAt) < new Date(Date.now() + 24 * 60 * 60 * 1000);

                return (
                  <Card key={restriction._id} className="bg-gray-900 border-gray-700">
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* User Info */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge 
                              variant={restriction.restrictionType === 'banned' ? 'destructive' : 'secondary'}
                              className={restriction.restrictionType === 'banned' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}
                            >
                              {restriction.restrictionType === 'banned' ? (
                                <><Ban className="h-3 w-3 mr-1" /> BANNED</>
                              ) : (
                                <><UserX className="h-3 w-3 mr-1" /> SUSPENDED</>
                              )}
                            </Badge>
                            
                            {isExpiringSoon && (
                              <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Expiring Soon
                              </Badge>
                            )}
                          </div>

                          <div>
                            <p className="font-semibold text-white">
                              {userInfo?.name || 'Unknown User'}
                            </p>
                            <p className="text-sm text-gray-400">{userInfo?.email || 'No email'}</p>
                            <p className="text-xs text-gray-500 font-mono mt-1">ID: {restriction.userId}</p>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className={!restriction.canTrade ? 'text-red-400' : 'text-gray-500'}>
                              {!restriction.canTrade ? '✗' : '✓'} Trading
                            </div>
                            <div className={!restriction.canEnterCompetitions ? 'text-red-400' : 'text-gray-500'}>
                              {!restriction.canEnterCompetitions ? '✗' : '✓'} Competitions
                            </div>
                            <div className={!restriction.canDeposit ? 'text-red-400' : 'text-gray-500'}>
                              {!restriction.canDeposit ? '✗' : '✓'} Deposit
                            </div>
                            <div className={!restriction.canWithdraw ? 'text-red-400' : 'text-gray-500'}>
                              {!restriction.canWithdraw ? '✗' : '✓'} Withdraw
                            </div>
                          </div>

                          <div className="text-sm">
                            <p className="text-gray-400">
                              <strong>Reason:</strong> {restriction.customReason || restriction.reason.replace(/_/g, ' ')}
                            </p>
                            <p className="text-gray-500 text-xs mt-1">
                              Restricted: {new Date(restriction.restrictedAt).toLocaleString()}
                            </p>
                            {restriction.expiresAt && (
                              <p className={`text-xs mt-1 ${isExpiringSoon ? 'text-orange-400 font-semibold' : 'text-gray-500'}`}>
                                Expires: {new Date(restriction.expiresAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 lg:w-auto w-full">
                          <Button
                            onClick={() => handleEditClick(restriction)}
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Edit Restriction
                          </Button>
                          <Button
                            onClick={() => handleUnrestrictClick(restriction)}
                            variant="outline"
                            size="sm"
                            className="w-full text-green-400 border-green-500/30 hover:bg-green-500/10"
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Unrestrict
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Restriction Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User Restriction</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update restriction settings for {selectedUser?.userInfo?.name || 'user'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Reason */}
            <div className="space-y-2">
              <Label>Reason Category</Label>
              <Select value={editReason} onValueChange={setEditReason}>
                <SelectTrigger className="bg-gray-900 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multi_accounting">Multi-Accounting</SelectItem>
                  <SelectItem value="fraud_detected">Fraud Detected</SelectItem>
                  <SelectItem value="suspicious_activity">Suspicious Activity</SelectItem>
                  <SelectItem value="terms_violation">Terms Violation</SelectItem>
                  <SelectItem value="payment_fraud">Payment Fraud</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Reason */}
            <div className="space-y-2">
              <Label>Custom Message (shown to user)</Label>
              <Textarea
                value={editCustomReason}
                onChange={(e) => setEditCustomReason(e.target.value)}
                placeholder="Optional custom message..."
                className="bg-gray-900 border-gray-700 min-h-[80px]"
              />
            </div>

            {/* Expires At (for suspensions) */}
            {selectedUser?.restrictionType === 'suspended' && (
              <div className="space-y-2">
                <Label>Expires At (leave empty for indefinite)</Label>
                <Input
                  type="datetime-local"
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                  className="bg-gray-900 border-gray-700"
                />
              </div>
            )}

            {/* Permissions */}
            <div className="space-y-3">
              <Label>Allowed Actions</Label>
              <div className="space-y-2 bg-gray-900 p-4 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="canTrade"
                    checked={editCanTrade}
                    onCheckedChange={(checked) => setEditCanTrade(checked as boolean)}
                  />
                  <label htmlFor="canTrade" className="text-sm cursor-pointer">
                    Allow Trading
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="canEnterCompetitions"
                    checked={editCanEnterCompetitions}
                    onCheckedChange={(checked) => setEditCanEnterCompetitions(checked as boolean)}
                  />
                  <label htmlFor="canEnterCompetitions" className="text-sm cursor-pointer">
                    Allow Entering Competitions
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="canDeposit"
                    checked={editCanDeposit}
                    onCheckedChange={(checked) => setEditCanDeposit(checked as boolean)}
                  />
                  <label htmlFor="canDeposit" className="text-sm cursor-pointer">
                    Allow Deposits
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="canWithdraw"
                    checked={editCanWithdraw}
                    onCheckedChange={(checked) => setEditCanWithdraw(checked as boolean)}
                  />
                  <label htmlFor="canWithdraw" className="text-sm cursor-pointer">
                    Allow Withdrawals
                  </label>
                </div>
              </div>
            </div>

            {/* Admin Password */}
            <div className="space-y-2">
              <Label>Admin Password *</Label>
              <Input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter admin password to confirm"
                className="bg-gray-900 border-gray-700"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRestriction} disabled={!adminPassword}>
              Update Restriction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unrestrict Dialog */}
      <Dialog open={showUnrestrictDialog} onOpenChange={setShowUnrestrictDialog}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Unrestrict User</DialogTitle>
            <DialogDescription className="text-gray-400">
              Remove all restrictions for {selectedUser?.userInfo?.name || 'user'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <p className="text-yellow-400 text-sm">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                This will remove all restrictions and the user will regain full access to the platform.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Admin Password *</Label>
              <Input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter admin password to confirm"
                className="bg-gray-900 border-gray-700"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnrestrictDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUnrestrict} 
              disabled={!adminPassword}
              className="bg-green-600 hover:bg-green-700"
            >
              Unrestrict User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

