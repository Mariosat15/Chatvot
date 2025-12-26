'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  User,
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  Plus,
  Trash2,
  Pin,
  PinOff,
  RefreshCw,
  FileText,
  Ban,
  Calendar,
  Mail,
  Coins,
  History,
  Edit,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface UserDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userEmail: string;
  onRefresh?: () => void;
}

interface KYCStatus {
  verified: boolean;
  status: string;
  verifiedAt?: string;
  expiresAt?: string;
  attempts: number;
}

interface KYCSession {
  _id: string;
  status: string;
  verificationCode?: number;
  verificationReason?: string;
  personData?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  };
  documentData?: {
    type?: string;
    number?: string;
    country?: string;
  };
  createdAt: string;
  completedAt?: string;
}

interface UserNote {
  _id: string;
  adminId: string;
  adminName: string;
  content: string;
  category: string;
  priority: string;
  isPinned: boolean;
  createdAt: string;
}

interface UserRestriction {
  _id: string;
  restrictionType: string;
  reason: string;
  customReason?: string;
  canTrade: boolean;
  canEnterCompetitions: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
  restrictedAt: string;
  expiresAt?: string;
  isActive: boolean;
}

const KYC_STATUS_CONFIG: Record<string, { color: string; icon: React.ComponentType<any> }> = {
  none: { color: 'bg-gray-500', icon: Shield },
  pending: { color: 'bg-yellow-500', icon: Clock },
  approved: { color: 'bg-green-500', icon: CheckCircle },
  declined: { color: 'bg-red-500', icon: XCircle },
  expired: { color: 'bg-orange-500', icon: AlertTriangle },
};

const NOTE_CATEGORIES = [
  { value: 'general', label: 'General', color: 'bg-gray-500' },
  { value: 'kyc', label: 'KYC', color: 'bg-green-500' },
  { value: 'fraud', label: 'Fraud', color: 'bg-red-500' },
  { value: 'support', label: 'Support', color: 'bg-blue-500' },
  { value: 'financial', label: 'Financial', color: 'bg-yellow-500' },
  { value: 'warning', label: 'Warning', color: 'bg-orange-500' },
  { value: 'ban', label: 'Ban', color: 'bg-red-700' },
  { value: 'other', label: 'Other', color: 'bg-purple-500' },
];

const NOTE_PRIORITIES = [
  { value: 'low', label: 'Low', color: 'text-gray-400' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400' },
  { value: 'high', label: 'High', color: 'text-orange-400' },
  { value: 'critical', label: 'Critical', color: 'text-red-400' },
];

const RESTRICTION_REASONS = [
  { value: 'kyc_failed', label: 'KYC Failed' },
  { value: 'kyc_fraud', label: 'KYC Fraud' },
  { value: 'fraud', label: 'Fraud' },
  { value: 'multi_accounting', label: 'Multi-accounting' },
  { value: 'terms_violation', label: 'Terms Violation' },
  { value: 'payment_fraud', label: 'Payment Fraud' },
  { value: 'suspicious_activity', label: 'Suspicious Activity' },
  { value: 'admin_decision', label: 'Admin Decision' },
  { value: 'other', label: 'Other' },
];

export default function UserDetailDialog({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
  onRefresh,
}: UserDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  
  // KYC State
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [kycSessions, setKycSessions] = useState<KYCSession[]>([]);
  
  // Notes State
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState('general');
  const [newNotePriority, setNewNotePriority] = useState('medium');
  const [savingNote, setSavingNote] = useState(false);
  
  // Restrictions State
  const [restrictions, setRestrictions] = useState<UserRestriction[]>([]);
  const [showRestrictionForm, setShowRestrictionForm] = useState(false);
  const [restrictionType, setRestrictionType] = useState<'banned' | 'suspended'>('suspended');
  const [restrictionReason, setRestrictionReason] = useState('admin_decision');
  const [customReason, setCustomReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [savingRestriction, setSavingRestriction] = useState(false);

  const fetchUserData = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      // Fetch KYC data
      const kycResponse = await fetch(`/api/users/${userId}/kyc`);
      if (kycResponse.ok) {
        const kycData = await kycResponse.json();
        setKycStatus(kycData.kycStatus);
        setKycSessions(kycData.sessions || []);
      }

      // Fetch notes
      const notesResponse = await fetch(`/api/users/${userId}/notes`);
      if (notesResponse.ok) {
        const notesData = await notesResponse.json();
        setNotes(notesData.notes || []);
      }

      // Fetch restrictions
      const restrictionsResponse = await fetch(`/api/users/${userId}/restrictions`);
      if (restrictionsResponse.ok) {
        const restrictionsData = await restrictionsResponse.json();
        setRestrictions(restrictionsData.restrictions || []);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Failed to load user data');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open && userId) {
      fetchUserData();
    }
  }, [open, userId, fetchUserData]);

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      toast.error('Please enter a note');
      return;
    }

    setSavingNote(true);
    try {
      const response = await fetch(`/api/users/${userId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newNote.trim(),
          category: newNoteCategory,
          priority: newNotePriority,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setNotes([data.note, ...notes]);
        setNewNote('');
        toast.success('Note added successfully');
      } else {
        toast.error('Failed to add note');
      }
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleTogglePin = async (noteId: string, isPinned: boolean) => {
    try {
      const response = await fetch(`/api/users/${userId}/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !isPinned }),
      });

      if (response.ok) {
        setNotes(notes.map((n) => (n._id === noteId ? { ...n, isPinned: !isPinned } : n)));
        toast.success(isPinned ? 'Note unpinned' : 'Note pinned');
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/notes/${noteId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotes(notes.filter((n) => n._id !== noteId));
        toast.success('Note deleted');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleAddRestriction = async () => {
    setSavingRestriction(true);
    try {
      const response = await fetch(`/api/users/${userId}/restrictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restrictionType,
          reason: restrictionReason,
          customReason: customReason.trim() || undefined,
          expiresAt: expiresAt || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setRestrictions([data.restriction, ...restrictions]);
        setShowRestrictionForm(false);
        setCustomReason('');
        setExpiresAt('');
        toast.success(`User ${restrictionType === 'banned' ? 'banned' : 'suspended'} successfully`);
        onRefresh?.();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to add restriction');
      }
    } catch (error) {
      console.error('Error adding restriction:', error);
      toast.error('Failed to add restriction');
    } finally {
      setSavingRestriction(false);
    }
  };

  const handleRemoveRestriction = async (restrictionId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/restrictions/${restrictionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setRestrictions(restrictions.map((r) =>
          r._id === restrictionId ? { ...r, isActive: false } : r
        ));
        toast.success('Restriction removed');
        onRefresh?.();
      }
    } catch (error) {
      console.error('Error removing restriction:', error);
    }
  };

  const handleUpdateKYCStatus = async (verified: boolean, status: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/kyc`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kycVerified: verified, kycStatus: status }),
      });

      if (response.ok) {
        const data = await response.json();
        setKycStatus(data.kycStatus);
        toast.success('KYC status updated');
        onRefresh?.();
      }
    } catch (error) {
      console.error('Error updating KYC status:', error);
      toast.error('Failed to update KYC status');
    }
  };

  const handleResetKYC = async () => {
    if (!confirm('Are you sure you want to reset this user\'s KYC status? They will need to verify again.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/users/${userId}/kyc`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          kycVerified: false, 
          kycStatus: 'none',
          resetAttempts: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setKycStatus(data.kycStatus);
        toast.success('KYC status reset successfully. User can now verify again.');
        onRefresh?.();
      }
    } catch (error) {
      console.error('Error resetting KYC:', error);
      toast.error('Failed to reset KYC status');
    }
  };

  const handleBanForKYC = async () => {
    setRestrictionType('banned');
    setRestrictionReason('kyc_fraud');
    setCustomReason('Banned due to KYC verification issues');
    setActiveTab('restrictions');
    setShowRestrictionForm(true);
  };

  const activeRestrictions = restrictions.filter((r) => r.isActive);
  const kycStatusConfig = KYC_STATUS_CONFIG[kycStatus?.status || 'none'] || KYC_STATUS_CONFIG.none;
  const KYCIcon = kycStatusConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-800 border-gray-700 max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <User className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <span className="block">{userName}</span>
              <span className="text-sm font-normal text-gray-400">{userEmail}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {/* KYC Badge */}
              <Badge
                variant="secondary"
                className={`${kycStatusConfig.color} text-white flex items-center gap-1`}
              >
                <KYCIcon className="h-3 w-3" />
                KYC: {kycStatus?.status || 'None'}
              </Badge>
              
              {/* Restriction Badge */}
              {activeRestrictions.length > 0 && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <Ban className="h-3 w-3" />
                  {activeRestrictions[0].restrictionType === 'banned' ? 'Banned' : 'Suspended'}
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="bg-gray-900/50 border border-gray-700">
              <TabsTrigger value="overview">
                <User className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="kyc">
                <Shield className="h-4 w-4 mr-2" />
                KYC
              </TabsTrigger>
              <TabsTrigger value="notes">
                <MessageSquare className="h-4 w-4 mr-2" />
                Notes ({notes.length})
              </TabsTrigger>
              <TabsTrigger value="restrictions">
                <Ban className="h-4 w-4 mr-2" />
                Restrictions
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-gray-900/50 border-gray-700">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                      <Mail className="h-4 w-4" />
                      <span className="text-sm">Email</span>
                    </div>
                    <p className="text-white">{userEmail}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-900/50 border-gray-700">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">User ID</span>
                    </div>
                    <p className="text-white font-mono text-xs break-all">{userId}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('kyc')}
                  className="flex-1"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Manage KYC
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('notes')}
                  className="flex-1"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveTab('restrictions');
                    setShowRestrictionForm(true);
                  }}
                  className="flex-1 text-red-400 hover:text-red-300"
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Ban/Suspend
                </Button>
              </div>
            </TabsContent>

            {/* KYC Tab */}
            <TabsContent value="kyc" className="space-y-4">
              {/* Current Status */}
              <Card className="bg-gray-900/50 border-gray-700">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 ${kycStatusConfig.color}/20 rounded-lg`}>
                        <KYCIcon className={`h-5 w-5 text-white`} />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">KYC Status</h4>
                        <Badge className={`${kycStatusConfig.color} text-white mt-1`}>
                          {kycStatus?.status?.toUpperCase() || 'NOT VERIFIED'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {kycStatus?.status !== 'approved' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-400 hover:text-green-300"
                          onClick={() => handleUpdateKYCStatus(true, 'approved')}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      )}
                      {kycStatus?.status !== 'declined' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => handleUpdateKYCStatus(false, 'declined')}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Decline
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-orange-400 hover:text-orange-300"
                        onClick={handleResetKYC}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Reset KYC
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 hover:text-red-400 border-red-500/50"
                        onClick={handleBanForKYC}
                      >
                        <Ban className="h-4 w-4 mr-1" />
                        Ban for KYC
                      </Button>
                    </div>
                  </div>
                  {kycStatus?.verifiedAt && (
                    <div className="mt-3 text-sm text-gray-400">
                      Verified: {new Date(kycStatus.verifiedAt).toLocaleString()}
                      {kycStatus.expiresAt && (
                        <> • Expires: {new Date(kycStatus.expiresAt).toLocaleDateString()}</>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Verification attempts: {kycStatus?.attempts || 0}
                  </p>
                </CardContent>
              </Card>

              {/* KYC History */}
              <div>
                <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Verification History
                </h4>
                {kycSessions.length === 0 ? (
                  <p className="text-gray-400 text-sm">No verification attempts</p>
                ) : (
                  <div className="space-y-2">
                    {kycSessions.map((session) => {
                      const statusConfig = KYC_STATUS_CONFIG[session.status] || KYC_STATUS_CONFIG.none;
                      return (
                        <div
                          key={session._id}
                          className="p-3 bg-gray-900/50 rounded-lg border border-gray-700"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className={`${statusConfig.color} text-white`}>
                                {session.status}
                              </Badge>
                              {session.documentData?.type && (
                                <span className="text-sm text-gray-400">
                                  {session.documentData.type}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(session.createdAt).toLocaleString()}
                            </span>
                          </div>
                          {session.verificationReason && (
                            <p className="text-sm text-red-400 mt-2">{session.verificationReason}</p>
                          )}
                          {session.personData && (
                            <div className="mt-2 text-xs text-gray-400">
                              {session.personData.firstName} {session.personData.lastName}
                              {session.personData.dateOfBirth && ` • DOB: ${session.personData.dateOfBirth}`}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="space-y-4">
              {/* Add Note Form */}
              <Card className="bg-gray-900/50 border-gray-700">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex gap-3">
                    <Select value={newNoteCategory} onValueChange={setNewNoteCategory}>
                      <SelectTrigger className="w-32 bg-gray-800 border-gray-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NOTE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={newNotePriority} onValueChange={setNewNotePriority}>
                      <SelectTrigger className="w-32 bg-gray-800 border-gray-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NOTE_PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    placeholder="Add a note about this user..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="bg-gray-800 border-gray-600"
                    rows={3}
                  />
                  <Button onClick={handleAddNote} disabled={savingNote || !newNote.trim()}>
                    <Plus className="h-4 w-4 mr-2" />
                    {savingNote ? 'Adding...' : 'Add Note'}
                  </Button>
                </CardContent>
              </Card>

              {/* Notes List */}
              <div className="space-y-2">
                {notes
                  .sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1))
                  .map((note) => {
                    const category = NOTE_CATEGORIES.find((c) => c.value === note.category);
                    const priority = NOTE_PRIORITIES.find((p) => p.value === note.priority);
                    return (
                      <div
                        key={note._id}
                        className={`p-3 bg-gray-900/50 rounded-lg border ${
                          note.isPinned ? 'border-yellow-500/50' : 'border-gray-700'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className={`${category?.color || 'bg-gray-500'} text-white text-xs`}>
                              {category?.label || note.category}
                            </Badge>
                            <span className={`text-xs ${priority?.color || 'text-gray-400'}`}>
                              {priority?.label || note.priority}
                            </span>
                            {note.isPinned && <Pin className="h-3 w-3 text-yellow-400" />}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleTogglePin(note._id, note.isPinned)}
                            >
                              {note.isPinned ? (
                                <PinOff className="h-3 w-3" />
                              ) : (
                                <Pin className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                              onClick={() => handleDeleteNote(note._id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-white text-sm mt-2">{note.content}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <span>{note.adminName}</span>
                          <span>•</span>
                          <span>{new Date(note.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                {notes.length === 0 && (
                  <p className="text-center text-gray-400 py-8">No notes yet</p>
                )}
              </div>
            </TabsContent>

            {/* Restrictions Tab */}
            <TabsContent value="restrictions" className="space-y-4">
              {/* Add Restriction Form */}
              {showRestrictionForm ? (
                <Card className="bg-red-500/10 border-red-500/30">
                  <CardContent className="pt-4 space-y-4">
                    <h4 className="text-red-400 font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Add Restriction
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-gray-300">Restriction Type</Label>
                        <Select
                          value={restrictionType}
                          onValueChange={(v) => setRestrictionType(v as 'banned' | 'suspended')}
                        >
                          <SelectTrigger className="bg-gray-800 border-gray-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="suspended">Suspend</SelectItem>
                            <SelectItem value="banned">Ban (Permanent)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-300">Reason</Label>
                        <Select value={restrictionReason} onValueChange={setRestrictionReason}>
                          <SelectTrigger className="bg-gray-800 border-gray-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RESTRICTION_REASONS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Custom Reason/Notes</Label>
                      <Textarea
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        className="bg-gray-800 border-gray-600"
                        placeholder="Additional details..."
                      />
                    </div>
                    {restrictionType === 'suspended' && (
                      <div className="space-y-2">
                        <Label className="text-gray-300">Expires At (optional)</Label>
                        <Input
                          type="datetime-local"
                          value={expiresAt}
                          onChange={(e) => setExpiresAt(e.target.value)}
                          className="bg-gray-800 border-gray-600"
                        />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={handleAddRestriction}
                        disabled={savingRestriction}
                      >
                        <Ban className="h-4 w-4 mr-2" />
                        {savingRestriction
                          ? 'Processing...'
                          : restrictionType === 'banned'
                          ? 'Ban User'
                          : 'Suspend User'}
                      </Button>
                      <Button variant="outline" onClick={() => setShowRestrictionForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Button
                  variant="outline"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => setShowRestrictionForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Restriction
                </Button>
              )}

              {/* Active Restrictions */}
              {activeRestrictions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-400 mb-3">Active Restrictions</h4>
                  <div className="space-y-2">
                    {activeRestrictions.map((r) => (
                      <div
                        key={r._id}
                        className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive">
                              {r.restrictionType === 'banned' ? 'BANNED' : 'SUSPENDED'}
                            </Badge>
                            <span className="text-sm text-gray-300">
                              {RESTRICTION_REASONS.find((rr) => rr.value === r.reason)?.label || r.reason}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveRestriction(r._id)}
                          >
                            Remove
                          </Button>
                        </div>
                        {r.customReason && (
                          <p className="text-sm text-gray-400 mt-2">{r.customReason}</p>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                          <span>Since: {new Date(r.restrictedAt).toLocaleString()}</span>
                          {r.expiresAt && (
                            <span>Expires: {new Date(r.expiresAt).toLocaleString()}</span>
                          )}
                        </div>
                        <div className="flex gap-2 mt-2">
                          {!r.canTrade && (
                            <Badge variant="secondary" className="text-xs">
                              No Trading
                            </Badge>
                          )}
                          {!r.canWithdraw && (
                            <Badge variant="secondary" className="text-xs">
                              No Withdrawals
                            </Badge>
                          )}
                          {!r.canDeposit && (
                            <Badge variant="secondary" className="text-xs">
                              No Deposits
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Restriction History */}
              {restrictions.filter((r) => !r.isActive).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-3">Restriction History</h4>
                  <div className="space-y-2">
                    {restrictions
                      .filter((r) => !r.isActive)
                      .map((r) => (
                        <div key={r._id} className="p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="opacity-50">
                              {r.restrictionType === 'banned' ? 'BANNED' : 'SUSPENDED'}
                            </Badge>
                            <span className="text-sm text-gray-400">
                              {RESTRICTION_REASONS.find((rr) => rr.value === r.reason)?.label || r.reason}
                            </span>
                            <Badge variant="outline" className="text-green-400 text-xs">
                              Resolved
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(r.restrictedAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {restrictions.length === 0 && !showRestrictionForm && (
                <p className="text-center text-gray-400 py-8">No restrictions</p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

