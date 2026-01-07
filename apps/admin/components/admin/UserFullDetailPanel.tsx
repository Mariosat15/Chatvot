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
  Minus,
  Trash2,
  Pin,
  PinOff,
  RefreshCw,
  FileText,
  Ban,
  Calendar,
  Mail,
  MailCheck,
  MailX,
  Coins,
  History,
  Edit,
  Lock,
  Unlock,
  X,
  Save,
  Wallet,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Building2,
  MapPin,
  Phone,
  Globe,
  Send,
  Eye,
  ArrowLeft,
  Trophy,
  Swords,
  ShoppingBag,
  Activity,
  Settings,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { UserData } from './UsersSection';

interface UserFullDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserData;
  onRefresh?: () => void;
}

// Valid user roles
const USER_ROLES = [
  { value: 'trader', label: 'Trader', color: 'bg-cyan-500', icon: '📈' },
  { value: 'admin', label: 'Admin', color: 'bg-yellow-500', icon: '👑' },
  { value: 'backoffice', label: 'Back Office', color: 'bg-purple-500', icon: '🏢' },
] as const;

type UserRole = typeof USER_ROLES[number]['value'];

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

interface Invoice {
  _id: string;
  invoiceNumber: string;
  invoiceDate: string;
  total: number;
  vatAmount: number;
  status: string;
  sentAt?: string;
  lineItems?: { description: string }[];
}

interface HistoryItem {
  id: string;
  type: string;
  category: string;
  description: string;
  details?: Record<string, any>;
  status?: string;
  amount?: number;
  createdAt: string;
  metadata?: Record<string, any>;
}

const HISTORY_TYPE_CONFIG: Record<string, { color: string; bgColor: string; icon: React.ElementType }> = {
  transaction: { color: 'text-green-400', bgColor: 'bg-green-500/20', icon: Coins },
  competition: { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', icon: Trophy },
  challenge: { color: 'text-purple-400', bgColor: 'bg-purple-500/20', icon: Swords },
  trade: { color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', icon: TrendingUp },
  kyc: { color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: Shield },
  restriction: { color: 'text-red-400', bgColor: 'bg-red-500/20', icon: Ban },
  lockout: { color: 'text-orange-400', bgColor: 'bg-orange-500/20', icon: Lock },
  note: { color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: MessageSquare },
  invoice: { color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', icon: FileText },
  fraud_alert: { color: 'text-red-500', bgColor: 'bg-red-500/20', icon: AlertTriangle },
  security_log: { color: 'text-amber-400', bgColor: 'bg-amber-500/20', icon: Shield },
  marketplace: { color: 'text-pink-400', bgColor: 'bg-pink-500/20', icon: ShoppingBag },
  notification: { color: 'text-indigo-400', bgColor: 'bg-indigo-500/20', icon: Activity },
};

const KYC_STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: React.ComponentType<any> }> = {
  none: { color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: Shield },
  pending: { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', icon: Clock },
  started: { color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: Clock },
  approved: { color: 'text-green-400', bgColor: 'bg-green-500/20', icon: CheckCircle },
  declined: { color: 'text-red-400', bgColor: 'bg-red-500/20', icon: XCircle },
  expired: { color: 'text-orange-400', bgColor: 'bg-orange-500/20', icon: AlertTriangle },
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

type TabType = 'overview' | 'edit' | 'wallet' | 'kyc' | 'notes' | 'restrictions' | 'invoices' | 'activity';

export default function UserFullDetailPanel({
  open,
  onOpenChange,
  user,
  onRefresh,
}: UserFullDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  
  // Edit Form State
  const [editName, setEditName] = useState(user.name);
  const [editEmail, setEditEmail] = useState(user.email);
  const [editRole, setEditRole] = useState<UserRole>(user.role || 'trader');
  const [editCountry, setEditCountry] = useState(user.country || '');
  const [editCity, setEditCity] = useState(user.city || '');
  const [editAddress, setEditAddress] = useState(user.address || '');
  const [editPostalCode, setEditPostalCode] = useState(user.postalCode || '');
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [saving, setSaving] = useState(false);
  
  // Credit State
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [crediting, setCrediting] = useState(false);
  
  // KYC State
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [kycSessions, setKycSessions] = useState<KYCSession[]>([]);
  const [updatingKYC, setUpdatingKYC] = useState(false);
  
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
  
  // Email Verification State
  const [emailVerified, setEmailVerified] = useState<boolean | null>(user.emailVerified);
  const [updatingEmailVerification, setUpdatingEmailVerification] = useState(false);
  
  // Invoices State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [resendingInvoice, setResendingInvoice] = useState<string | null>(null);
  
  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilters, setHistoryFilters] = useState<{
    type: string;
    status: string;
    dateFrom: string;
    dateTo: string;
    search: string;
  }>({
    type: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: '',
    search: '',
  });
  const [availableHistoryTypes, setAvailableHistoryTypes] = useState<string[]>([]);
  
  // Account Lockout State
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutInfo, setLockoutInfo] = useState<{
    reason: string;
    lockedAt: string;
    lockedUntil?: string;
    failedAttempts: number;
    ipAddress?: string;
  } | null>(null);
  const [unlockingAccount, setUnlockingAccount] = useState(false);
  
  // Delete State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Password verification state  
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [pendingAction, setPendingAction] = useState<'credit' | 'edit' | 'delete' | null>(null);

  const fetchUserData = useCallback(async () => {
    if (!user.id) return;
    
    setLoading(true);
    try {
      // Fetch KYC data
      const kycResponse = await fetch(`/api/users/${user.id}/kyc`);
      if (kycResponse.ok) {
        const kycData = await kycResponse.json();
        setKycStatus(kycData.kycStatus);
        setKycSessions(kycData.sessions || []);
      }

      // Fetch notes
      const notesResponse = await fetch(`/api/users/${user.id}/notes`);
      if (notesResponse.ok) {
        const notesData = await notesResponse.json();
        setNotes(notesData.notes || []);
      }

      // Fetch restrictions
      const restrictionsResponse = await fetch(`/api/users/${user.id}/restrictions`);
      if (restrictionsResponse.ok) {
        const restrictionsData = await restrictionsResponse.json();
        setRestrictions(restrictionsData.restrictions || []);
      }
      
      // Fetch email verification status
      const emailVerificationResponse = await fetch(`/api/users/${user.id}/email-verification`);
      if (emailVerificationResponse.ok) {
        const emailVerificationData = await emailVerificationResponse.json();
        setEmailVerified(emailVerificationData.emailVerified);
      }
      
      // Fetch lockout status
      const lockoutResponse = await fetch(`/api/users/${user.id}/lockout`);
      if (lockoutResponse.ok) {
        const lockoutData = await lockoutResponse.json();
        setIsLocked(lockoutData.isLocked);
        if (lockoutData.lockout) {
          setLockoutInfo({
            reason: lockoutData.lockout.reason,
            lockedAt: lockoutData.lockout.lockedAt,
            lockedUntil: lockoutData.lockout.lockedUntil,
            failedAttempts: lockoutData.lockout.failedAttempts,
            ipAddress: lockoutData.lockout.ipAddress,
          });
        } else {
          setLockoutInfo(null);
        }
      }
      
      // Fetch invoices
      const invoicesResponse = await fetch(`/api/users/${user.id}/invoices`);
      if (invoicesResponse.ok) {
        const invoicesData = await invoicesResponse.json();
        setInvoices(invoicesData.invoices || []);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Failed to load user data');
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  // Fetch user history (called lazily when tab is opened)
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/users/${user.id}/history`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
        setAvailableHistoryTypes(data.filters?.types || []);
      }
    } catch (error) {
      console.error('Error fetching user history:', error);
      toast.error('Failed to load user history');
    } finally {
      setLoadingHistory(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (open && user.id) {
      fetchUserData();
      // Reset edit form
      setEditName(user.name);
      setEditEmail(user.email);
      setEditRole(user.role || 'trader');
      setEditCountry(user.country || '');
      setEditCity(user.city || '');
      setEditAddress(user.address || '');
      setEditPostalCode(user.postalCode || '');
      setEditPhone(user.phone || '');
    }
  }, [open, user, fetchUserData]);

  // Fetch history when tab is selected (lazy loading)
  useEffect(() => {
    if (activeTab === 'history' && history.length === 0 && !loadingHistory) {
      fetchHistory();
    }
  }, [activeTab, history.length, loadingHistory, fetchHistory]);

  // Verify password before sensitive actions
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
          await executeCreditUser();
        } else if (pendingAction === 'edit') {
          await executeEditUser();
        } else if (pendingAction === 'delete') {
          await executeDeleteUser();
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

  // Save user edits
  const handleSaveUser = () => {
    setPendingAction('edit');
    setPasswordDialogOpen(true);
  };

  const executeEditUser = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/users/edit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: editName !== user.name ? editName : undefined,
          email: editEmail !== user.email ? editEmail : undefined,
          role: editRole !== user.role ? editRole : undefined,
          country: editCountry,
          city: editCity,
          address: editAddress,
          postalCode: editPostalCode,
          phone: editPhone,
        }),
      });

      if (response.ok) {
        toast.success('User updated successfully');
        onRefresh?.();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Error updating user');
    } finally {
      setSaving(false);
    }
  };

  // Credit user
  const handleCreditUser = () => {
    if (!creditAmount || parseFloat(creditAmount) === 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setPendingAction('credit');
    setPasswordDialogOpen(true);
  };

  const executeCreditUser = async () => {
    setCrediting(true);
    try {
      const amount = parseFloat(creditAmount);
      const response = await fetch('/api/users/credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount,
          reason: creditReason || `Admin ${amount > 0 ? 'credited' : 'removed'} ${Math.abs(amount)} credits`,
        }),
      });

      if (response.ok) {
        toast.success(`${amount > 0 ? 'Credited' : 'Removed'} ${Math.abs(amount)} credits`);
        setCreditAmount('');
        setCreditReason('');
        onRefresh?.();
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

  // Delete user
  const handleDeleteUser = () => {
    setPendingAction('delete');
    setPasswordDialogOpen(true);
  };

  const executeDeleteUser = async () => {
    setDeleting(true);
    try {
      const response = await fetch('/api/users/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      if (response.ok) {
        toast.success('User deleted successfully');
        setShowDeleteConfirm(false);
        onOpenChange(false);
        onRefresh?.();
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

  // Email verification
  const handleVerifyEmail = async () => {
    setUpdatingEmailVerification(true);
    try {
      const response = await fetch(`/api/users/${user.id}/email-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      });

      if (response.ok) {
        setEmailVerified(true);
        toast.success('Email verified successfully');
        onRefresh?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to verify email');
      }
    } catch (error) {
      console.error('Error verifying email:', error);
      toast.error('Failed to verify email');
    } finally {
      setUpdatingEmailVerification(false);
    }
  };

  const handleResetEmailVerification = async () => {
    if (!confirm('Reset email verification? User will need to verify their email again.')) return;
    
    setUpdatingEmailVerification(true);
    try {
      const response = await fetch(`/api/users/${user.id}/email-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });

      if (response.ok) {
        setEmailVerified(false);
        toast.success('Email verification reset');
        onRefresh?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to reset email verification');
      }
    } catch (error) {
      console.error('Error resetting email verification:', error);
    } finally {
      setUpdatingEmailVerification(false);
    }
  };

  // KYC actions
  const handleUpdateKYCStatus = async (verified: boolean, status: string) => {
    setUpdatingKYC(true);
    try {
      const response = await fetch(`/api/users/${user.id}/kyc`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kycVerified: verified, kycStatus: status }),
      });

      if (response.ok) {
        const data = await response.json();
        setKycStatus(data.kycStatus);
        toast.success(`KYC ${status === 'approved' ? 'approved' : 'updated'} successfully`);
        onRefresh?.();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update KYC');
      }
    } catch (error) {
      console.error('Error updating KYC:', error);
      toast.error('Failed to update KYC');
    } finally {
      setUpdatingKYC(false);
    }
  };

  const handleResetKYC = async () => {
    if (!confirm('Reset KYC? User will need to verify again.')) return;
    
    setUpdatingKYC(true);
    try {
      const response = await fetch(`/api/users/${user.id}/kyc`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kycVerified: false, kycStatus: 'none', resetAttempts: true }),
      });

      if (response.ok) {
        const data = await response.json();
        setKycStatus(data.kycStatus);
        toast.success('KYC reset successfully');
        onRefresh?.();
      } else {
        toast.error('Failed to reset KYC');
      }
    } catch (error) {
      console.error('Error resetting KYC:', error);
    } finally {
      setUpdatingKYC(false);
    }
  };

  // Account unlock
  const handleUnlockAccount = async () => {
    if (!confirm('Unlock this account?')) return;
    
    setUnlockingAccount(true);
    try {
      const response = await fetch(`/api/users/${user.id}/lockout`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Admin manual unlock' }),
      });

      if (response.ok) {
        setIsLocked(false);
        setLockoutInfo(null);
        toast.success('Account unlocked');
        onRefresh?.();
      } else {
        toast.error('Failed to unlock account');
      }
    } catch (error) {
      console.error('Error unlocking account:', error);
    } finally {
      setUnlockingAccount(false);
    }
  };

  // Notes
  const handleAddNote = async () => {
    if (!newNote.trim()) {
      toast.error('Please enter a note');
      return;
    }

    setSavingNote(true);
    try {
      const response = await fetch(`/api/users/${user.id}/notes`, {
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
        toast.success('Note added');
      } else {
        toast.error('Failed to add note');
      }
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setSavingNote(false);
    }
  };

  const handleTogglePin = async (noteId: string, isPinned: boolean) => {
    try {
      const response = await fetch(`/api/users/${user.id}/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !isPinned }),
      });

      if (response.ok) {
        setNotes(notes.map((n) => (n._id === noteId ? { ...n, isPinned: !isPinned } : n)));
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const response = await fetch(`/api/users/${user.id}/notes/${noteId}`, {
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

  // Restrictions
  const handleAddRestriction = async () => {
    setSavingRestriction(true);
    try {
      const response = await fetch(`/api/users/${user.id}/restrictions`, {
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
        toast.success(`User ${restrictionType === 'banned' ? 'banned' : 'suspended'}`);
        onRefresh?.();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to add restriction');
      }
    } catch (error) {
      console.error('Error adding restriction:', error);
    } finally {
      setSavingRestriction(false);
    }
  };

  const handleRemoveRestriction = async (restrictionId: string) => {
    try {
      const response = await fetch(`/api/users/${user.id}/restrictions/${restrictionId}`, {
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

  // Invoices
  const handleResendInvoice = async (invoiceId: string) => {
    setResendingInvoice(invoiceId);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/resend`, { method: 'POST' });
      
      if (response.ok) {
        toast.success('Invoice sent');
      } else {
        toast.error('Failed to resend invoice');
      }
    } catch (error) {
      console.error('Error resending invoice:', error);
    } finally {
      setResendingInvoice(null);
    }
  };

  const activeRestrictions = restrictions.filter((r) => r.isActive);
  const kycStatusConfig = KYC_STATUS_CONFIG[kycStatus?.status || 'none'] || KYC_STATUS_CONFIG.none;
  const KYCIcon = kycStatusConfig.icon;
  const roleConfig = USER_ROLES.find(r => r.value === user.role) || USER_ROLES[0];

  if (!open) return null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'edit', label: 'Edit User', icon: Edit },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'kyc', label: 'KYC', icon: Shield },
    { id: 'history', label: `History (${history.length})`, icon: History },
    { id: 'notes', label: `Notes (${notes.length})`, icon: MessageSquare },
    { id: 'restrictions', label: 'Restrictions', icon: Ban },
    { id: 'invoices', label: `Invoices (${invoices.length})`, icon: FileText },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700 p-4">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Users
            </Button>
            <div className="h-8 w-px bg-gray-700" />
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-lg ${
                user.isAdmin 
                  ? 'bg-gradient-to-br from-yellow-500 to-yellow-600' 
                  : 'bg-gradient-to-br from-cyan-500 to-cyan-600'
              }`}>
                {user.isAdmin ? <Shield className="h-6 w-6" /> : user.name[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  {user.name}
                  <Badge className={`${roleConfig.color} text-white text-xs`}>
                    {roleConfig.label}
                  </Badge>
                </h1>
                <p className="text-sm text-gray-400">{user.email}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Status badges */}
            {isLocked && (
              <Badge className="bg-red-600 text-white">
                <Lock className="h-3 w-3 mr-1" />
                Locked
              </Badge>
            )}
            {activeRestrictions.length > 0 && (
              <Badge variant="destructive">
                <Ban className="h-3 w-3 mr-1" />
                {activeRestrictions[0].restrictionType === 'banned' ? 'Banned' : 'Suspended'}
              </Badge>
            )}
            <Badge className={`${kycStatusConfig.bgColor} ${kycStatusConfig.color} border-0`}>
              <KYCIcon className="h-3 w-3 mr-1" />
              KYC: {kycStatus?.status || 'none'}
            </Badge>
            {emailVerified ? (
              <Badge className="bg-green-500/20 text-green-400">
                <MailCheck className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            ) : (
              <Badge className="bg-yellow-500/20 text-yellow-400">
                <MailX className="h-3 w-3 mr-1" />
                Unverified
              </Badge>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar Navigation */}
        <div className="w-56 bg-gray-800/50 border-r border-gray-700 p-4 overflow-y-auto">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                    activeTab === tab.id
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
          
          {/* Quick Stats */}
          <div className="mt-6 pt-6 border-t border-gray-700 space-y-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider">Quick Stats</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Balance</span>
                <span className="text-green-400 font-mono">{user.wallet.balance.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Net Profit</span>
                <span className={`font-mono ${user.wallet.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {user.wallet.netProfit >= 0 ? '+' : ''}{user.wallet.netProfit.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Competitions</span>
                <span className="text-blue-400">{user.competitions.total}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Challenges</span>
                <span className="text-orange-400">{user.challenges?.total || 0}</span>
              </div>
            </div>
          </div>
          
          {/* Danger Zone */}
          <div className="mt-6 pt-6 border-t border-gray-700">
            <div className="text-xs text-red-400 uppercase tracking-wider mb-3">Danger Zone</div>
            {user.role !== 'admin' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full text-red-400 border-red-500/30 hover:bg-red-500/20"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete User
              </Button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[1400px] mx-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-cyan-500" />
              </div>
            ) : (
              <>
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-4">
                      <Card className="bg-gray-800/50 border-gray-700">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/20 rounded-lg">
                              <Wallet className="h-5 w-5 text-green-400" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Balance</p>
                              <p className="text-xl font-bold text-green-400">{user.wallet.balance.toFixed(2)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-gray-800/50 border-gray-700">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${user.wallet.netProfit >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                              {user.wallet.netProfit >= 0 ? (
                                <TrendingUp className="h-5 w-5 text-green-400" />
                              ) : (
                                <TrendingDown className="h-5 w-5 text-red-400" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Net Profit</p>
                              <p className={`text-xl font-bold ${user.wallet.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {user.wallet.netProfit >= 0 ? '+' : ''}{user.wallet.netProfit.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-gray-800/50 border-gray-700">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                              <Trophy className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Competitions</p>
                              <p className="text-xl font-bold text-blue-400">{user.competitions.total}</p>
                              <p className="text-xs text-gray-500">{user.competitions.active} active</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-gray-800/50 border-gray-700">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-500/20 rounded-lg">
                              <Swords className="h-5 w-5 text-orange-400" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Challenges</p>
                              <p className="text-xl font-bold text-orange-400">{user.challenges?.total || 0}</p>
                              <p className="text-xs text-gray-500">{user.challenges?.won || 0}W / {user.challenges?.lost || 0}L</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* User Info */}
                    <div className="grid grid-cols-2 gap-6">
                      <Card className="bg-gray-800/50 border-gray-700">
                        <CardHeader>
                          <CardTitle className="text-white text-lg flex items-center gap-2">
                            <User className="h-5 w-5 text-cyan-400" />
                            User Information
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Full Name</p>
                              <p className="text-white">{user.name}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Email</p>
                              <p className="text-white">{user.email}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">User ID</p>
                              <p className="text-white font-mono text-xs">{user.id}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Joined</p>
                              <p className="text-white">{new Date(user.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Email & Security */}
                      <Card className="bg-gray-800/50 border-gray-700">
                        <CardHeader>
                          <CardTitle className="text-white text-lg flex items-center gap-2">
                            <Shield className="h-5 w-5 text-cyan-400" />
                            Security Status
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Email Verification */}
                          <div className={`p-3 rounded-lg border ${emailVerified ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {emailVerified ? (
                                  <MailCheck className="h-5 w-5 text-green-400" />
                                ) : (
                                  <MailX className="h-5 w-5 text-yellow-400" />
                                )}
                                <div>
                                  <p className="text-sm font-medium text-white">Email Verification</p>
                                  <p className="text-xs text-gray-400">{emailVerified ? 'Verified' : 'Not Verified'}</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {!emailVerified ? (
                                  <Button size="sm" variant="outline" onClick={handleVerifyEmail} disabled={updatingEmailVerification} className="text-green-400">
                                    Verify
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="outline" onClick={handleResetEmailVerification} disabled={updatingEmailVerification} className="text-orange-400">
                                    Reset
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Account Lock Status */}
                          {isLocked && lockoutInfo && (
                            <div className="p-3 rounded-lg border bg-red-500/10 border-red-500/30">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Lock className="h-5 w-5 text-red-400" />
                                  <div>
                                    <p className="text-sm font-medium text-white">Account Locked</p>
                                    <p className="text-xs text-gray-400">{lockoutInfo.reason.replace(/_/g, ' ')}</p>
                                  </div>
                                </div>
                                <Button size="sm" variant="outline" onClick={handleUnlockAccount} disabled={unlockingAccount} className="text-green-400">
                                  <Unlock className="h-4 w-4 mr-1" />
                                  Unlock
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* KYC Status */}
                          <div className={`p-3 rounded-lg border ${kycStatusConfig.bgColor} border-gray-700`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <KYCIcon className={`h-5 w-5 ${kycStatusConfig.color}`} />
                                <div>
                                  <p className="text-sm font-medium text-white">KYC Status</p>
                                  <p className="text-xs text-gray-400">{kycStatus?.status || 'Not started'}</p>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => setActiveTab('kyc')} className="text-cyan-400">
                                Manage
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Financial Overview */}
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white text-lg flex items-center gap-2">
                          <BarChart3 className="h-5 w-5 text-cyan-400" />
                          Financial Overview
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-6 gap-4">
                          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                            <p className="text-xs text-gray-400 mb-1">Total Deposited</p>
                            <p className="text-lg font-bold text-green-400">${user.wallet.totalDeposited.toFixed(2)}</p>
                          </div>
                          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                            <p className="text-xs text-gray-400 mb-1">Total Withdrawn</p>
                            <p className="text-lg font-bold text-red-400">${user.wallet.totalWithdrawn.toFixed(2)}</p>
                          </div>
                          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                            <p className="text-xs text-gray-400 mb-1">Total Spent</p>
                            <p className="text-lg font-bold text-orange-400">${user.wallet.totalSpent.toFixed(2)}</p>
                          </div>
                          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                            <p className="text-xs text-gray-400 mb-1">Total Won</p>
                            <p className="text-lg font-bold text-yellow-400">${user.wallet.totalWon.toFixed(2)}</p>
                          </div>
                          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                            <p className="text-xs text-gray-400 mb-1">Win Rate</p>
                            <p className="text-lg font-bold text-purple-400">{(user.competitions.overallWinRate || 0).toFixed(1)}%</p>
                          </div>
                          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                            <p className="text-xs text-gray-400 mb-1">Total Trades</p>
                            <p className="text-lg font-bold text-cyan-400">{user.competitions.totalTrades}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Edit Tab */}
                {activeTab === 'edit' && (
                  <div className="space-y-6">
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white text-lg flex items-center gap-2">
                          <Edit className="h-5 w-5 text-cyan-400" />
                          Edit User Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-gray-300">Full Name</Label>
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="bg-gray-900 border-gray-700"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-gray-300">Email</Label>
                            <Input
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              className="bg-gray-900 border-gray-700"
                            />
                          </div>
                        </div>

                        {/* Role */}
                        <div className="space-y-2">
                          <Label className="text-gray-300">User Role</Label>
                          <div className="grid grid-cols-3 gap-3">
                            {USER_ROLES.map((role) => (
                              <button
                                key={role.value}
                                onClick={() => setEditRole(role.value)}
                                className={`p-4 rounded-lg border-2 transition-all ${
                                  editRole === role.value
                                    ? `${role.color} border-current`
                                    : 'bg-gray-800 border-gray-600 hover:border-gray-500'
                                }`}
                              >
                                <span className="text-2xl">{role.icon}</span>
                                <p className="text-sm font-medium text-white mt-1">{role.label}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Address Info */}
                        <div className="pt-4 border-t border-gray-700">
                          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-cyan-400" />
                            Address Information
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-gray-300">Country</Label>
                              <Input
                                value={editCountry}
                                onChange={(e) => setEditCountry(e.target.value)}
                                placeholder="e.g. Cyprus"
                                className="bg-gray-900 border-gray-700"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-gray-300">City</Label>
                              <Input
                                value={editCity}
                                onChange={(e) => setEditCity(e.target.value)}
                                placeholder="e.g. Nicosia"
                                className="bg-gray-900 border-gray-700"
                              />
                            </div>
                            <div className="space-y-2 col-span-2">
                              <Label className="text-gray-300">Address</Label>
                              <Input
                                value={editAddress}
                                onChange={(e) => setEditAddress(e.target.value)}
                                placeholder="Street address"
                                className="bg-gray-900 border-gray-700"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-gray-300">Postal Code</Label>
                              <Input
                                value={editPostalCode}
                                onChange={(e) => setEditPostalCode(e.target.value)}
                                placeholder="e.g. 1000"
                                className="bg-gray-900 border-gray-700"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-gray-300">Phone</Label>
                              <Input
                                value={editPhone}
                                onChange={(e) => setEditPhone(e.target.value)}
                                placeholder="e.g. +357 99 123456"
                                className="bg-gray-900 border-gray-700"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end pt-4">
                          <Button
                            onClick={handleSaveUser}
                            disabled={saving}
                            className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white font-bold"
                          >
                            {saving ? (
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            Save Changes
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Wallet Tab */}
                {activeTab === 'wallet' && (
                  <div className="space-y-6">
                    {/* Balance Card */}
                    <Card className="bg-gradient-to-r from-green-500/20 to-cyan-500/20 border-green-500/30">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-400 mb-1">Current Balance</p>
                            <p className="text-4xl font-bold text-green-400">{user.wallet.balance.toFixed(2)} Credits</p>
                          </div>
                          <Wallet className="h-16 w-16 text-green-400/30" />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Credit/Debit Form */}
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white text-lg flex items-center gap-2">
                          <Coins className="h-5 w-5 text-yellow-400" />
                          Add or Remove Credits
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-gray-300">Amount</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={creditAmount}
                              onChange={(e) => setCreditAmount(e.target.value)}
                              placeholder="Positive to add, negative to remove"
                              className="bg-gray-900 border-gray-700"
                            />
                            <p className="text-xs text-gray-500">
                              Use positive values to add credits, negative to remove
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-gray-300">Reason</Label>
                            <Input
                              value={creditReason}
                              onChange={(e) => setCreditReason(e.target.value)}
                              placeholder="Reason for adjustment"
                              className="bg-gray-900 border-gray-700"
                            />
                          </div>
                        </div>
                        <Button
                          onClick={handleCreditUser}
                          disabled={crediting || !creditAmount || parseFloat(creditAmount) === 0}
                          className={`${
                            parseFloat(creditAmount || '0') >= 0
                              ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                              : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                          } text-white font-bold`}
                        >
                          {crediting ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : parseFloat(creditAmount || '0') >= 0 ? (
                            <Plus className="h-4 w-4 mr-2" />
                          ) : (
                            <Minus className="h-4 w-4 mr-2" />
                          )}
                          {parseFloat(creditAmount || '0') >= 0 ? 'Add Credits' : 'Remove Credits'}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Wallet Stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <Card className="bg-gray-800/50 border-gray-700">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <CreditCard className="h-8 w-8 text-green-400" />
                            <div>
                              <p className="text-xs text-gray-400">Total Deposited</p>
                              <p className="text-xl font-bold text-green-400">${user.wallet.totalDeposited.toFixed(2)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gray-800/50 border-gray-700">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <CreditCard className="h-8 w-8 text-red-400" />
                            <div>
                              <p className="text-xs text-gray-400">Total Withdrawn</p>
                              <p className="text-xl font-bold text-red-400">${user.wallet.totalWithdrawn.toFixed(2)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gray-800/50 border-gray-700">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <ShoppingBag className="h-8 w-8 text-yellow-400" />
                            <div>
                              <p className="text-xs text-gray-400">Total Won</p>
                              <p className="text-xl font-bold text-yellow-400">${user.wallet.totalWon.toFixed(2)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {/* KYC Tab */}
                {activeTab === 'kyc' && (
                  <div className="space-y-6">
                    {/* Current Status */}
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white text-lg flex items-center gap-2">
                          <Shield className="h-5 w-5 text-cyan-400" />
                          KYC Status
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${kycStatusConfig.bgColor}`}>
                              <KYCIcon className={`h-8 w-8 ${kycStatusConfig.color}`} />
                            </div>
                            <div>
                              <Badge className={`${kycStatusConfig.bgColor} ${kycStatusConfig.color} text-sm px-3 py-1`}>
                                {kycStatus?.status?.toUpperCase() || 'NOT VERIFIED'}
                              </Badge>
                              {kycStatus?.verifiedAt && (
                                <p className="text-sm text-gray-400 mt-1">
                                  Verified: {new Date(kycStatus.verifiedAt).toLocaleString()}
                                </p>
                              )}
                              <p className="text-xs text-gray-500">
                                Verification attempts: {kycStatus?.attempts || 0}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {kycStatus?.status !== 'approved' && (
                              <Button
                                variant="outline"
                                onClick={() => handleUpdateKYCStatus(true, 'approved')}
                                disabled={updatingKYC}
                                className="text-green-400 border-green-500/30"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Approve
                              </Button>
                            )}
                            {kycStatus?.status !== 'declined' && (
                              <Button
                                variant="outline"
                                onClick={() => handleUpdateKYCStatus(false, 'declined')}
                                disabled={updatingKYC}
                                className="text-red-400 border-red-500/30"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Decline
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              onClick={handleResetKYC}
                              disabled={updatingKYC}
                              className="text-orange-400 border-orange-500/30"
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Reset
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* KYC History */}
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white text-lg flex items-center gap-2">
                          <History className="h-5 w-5 text-cyan-400" />
                          Verification History
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {kycSessions.length === 0 ? (
                          <p className="text-gray-400 text-center py-8">No verification attempts</p>
                        ) : (
                          <div className="space-y-3">
                            {kycSessions.map((session) => {
                              const statusConfig = KYC_STATUS_CONFIG[session.status] || KYC_STATUS_CONFIG.none;
                              return (
                                <div key={session._id} className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <Badge className={`${statusConfig.bgColor} ${statusConfig.color}`}>
                                        {session.status}
                                      </Badge>
                                      {session.documentData?.type && (
                                        <span className="text-sm text-gray-400">{session.documentData.type}</span>
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
                                    <p className="text-xs text-gray-400 mt-2">
                                      {session.personData.firstName} {session.personData.lastName}
                                      {session.personData.dateOfBirth && ` • DOB: ${session.personData.dateOfBirth}`}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Notes Tab */}
                {activeTab === 'notes' && (
                  <div className="space-y-6">
                    {/* Add Note Form */}
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white text-lg flex items-center gap-2">
                          <Plus className="h-5 w-5 text-cyan-400" />
                          Add Note
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex gap-3">
                          <Select value={newNoteCategory} onValueChange={setNewNoteCategory}>
                            <SelectTrigger className="w-32 bg-gray-900 border-gray-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {NOTE_CATEGORIES.map((cat) => (
                                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={newNotePriority} onValueChange={setNewNotePriority}>
                            <SelectTrigger className="w-32 bg-gray-900 border-gray-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {NOTE_PRIORITIES.map((p) => (
                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Textarea
                          placeholder="Add a note about this user..."
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          className="bg-gray-900 border-gray-700"
                          rows={3}
                        />
                        <Button onClick={handleAddNote} disabled={savingNote || !newNote.trim()}>
                          <Plus className="h-4 w-4 mr-2" />
                          {savingNote ? 'Adding...' : 'Add Note'}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Notes List */}
                    <div className="space-y-3">
                      {notes
                        .sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1))
                        .map((note) => {
                          const category = NOTE_CATEGORIES.find((c) => c.value === note.category);
                          const priority = NOTE_PRIORITIES.find((p) => p.value === note.priority);
                          return (
                            <Card key={note._id} className={`bg-gray-800/50 ${note.isPinned ? 'border-yellow-500/50' : 'border-gray-700'}`}>
                              <CardContent className="p-4">
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
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleTogglePin(note._id, note.isPinned)}>
                                      {note.isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400" onClick={() => handleDeleteNote(note._id)}>
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
                              </CardContent>
                            </Card>
                          );
                        })}
                      {notes.length === 0 && (
                        <p className="text-center text-gray-400 py-8">No notes yet</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Restrictions Tab */}
                {activeTab === 'restrictions' && (
                  <div className="space-y-6">
                    {/* Add Restriction */}
                    {showRestrictionForm ? (
                      <Card className="bg-red-500/10 border-red-500/30">
                        <CardHeader>
                          <CardTitle className="text-red-400 text-lg flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Add Restriction
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-gray-300">Restriction Type</Label>
                              <Select value={restrictionType} onValueChange={(v) => setRestrictionType(v as 'banned' | 'suspended')}>
                                <SelectTrigger className="bg-gray-900 border-gray-700">
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
                                <SelectTrigger className="bg-gray-900 border-gray-700">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {RESTRICTION_REASONS.map((r) => (
                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
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
                              className="bg-gray-900 border-gray-700"
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
                                className="bg-gray-900 border-gray-700"
                              />
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button variant="destructive" onClick={handleAddRestriction} disabled={savingRestriction}>
                              <Ban className="h-4 w-4 mr-2" />
                              {savingRestriction ? 'Processing...' : restrictionType === 'banned' ? 'Ban User' : 'Suspend User'}
                            </Button>
                            <Button variant="outline" onClick={() => setShowRestrictionForm(false)}>Cancel</Button>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Button variant="outline" className="text-red-400 border-red-500/30" onClick={() => setShowRestrictionForm(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Restriction
                      </Button>
                    )}

                    {/* Active Restrictions */}
                    {activeRestrictions.length > 0 && (
                      <Card className="bg-gray-800/50 border-gray-700">
                        <CardHeader>
                          <CardTitle className="text-red-400 text-lg">Active Restrictions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {activeRestrictions.map((r) => (
                            <div key={r._id} className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge variant="destructive">
                                    {r.restrictionType === 'banned' ? 'BANNED' : 'SUSPENDED'}
                                  </Badge>
                                  <span className="text-sm text-gray-300">
                                    {RESTRICTION_REASONS.find((rr) => rr.value === r.reason)?.label || r.reason}
                                  </span>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => handleRemoveRestriction(r._id)}>
                                  Remove
                                </Button>
                              </div>
                              {r.customReason && <p className="text-sm text-gray-400 mt-2">{r.customReason}</p>}
                              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                <span>Since: {new Date(r.restrictedAt).toLocaleString()}</span>
                                {r.expiresAt && <span>Expires: {new Date(r.expiresAt).toLocaleString()}</span>}
                              </div>
                              <div className="flex gap-2 mt-2">
                                {!r.canTrade && <Badge variant="secondary" className="text-xs">No Trading</Badge>}
                                {!r.canWithdraw && <Badge variant="secondary" className="text-xs">No Withdrawals</Badge>}
                                {!r.canDeposit && <Badge variant="secondary" className="text-xs">No Deposits</Badge>}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* History */}
                    {restrictions.filter((r) => !r.isActive).length > 0 && (
                      <Card className="bg-gray-800/50 border-gray-700">
                        <CardHeader>
                          <CardTitle className="text-gray-400 text-lg">Restriction History</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {restrictions.filter((r) => !r.isActive).map((r) => (
                            <div key={r._id} className="p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="opacity-50">
                                  {r.restrictionType === 'banned' ? 'BANNED' : 'SUSPENDED'}
                                </Badge>
                                <span className="text-sm text-gray-400">
                                  {RESTRICTION_REASONS.find((rr) => rr.value === r.reason)?.label || r.reason}
                                </span>
                                <Badge variant="outline" className="text-green-400 text-xs">Resolved</Badge>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {new Date(r.restrictedAt).toLocaleDateString()}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                  <div className="space-y-6">
                    {/* Filters */}
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-white text-lg flex items-center gap-2">
                          <History className="h-5 w-5 text-cyan-400" />
                          Activity History
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchHistory}
                            disabled={loadingHistory}
                            className="ml-auto border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
                          >
                            <RefreshCw className={`h-4 w-4 mr-1 ${loadingHistory ? 'animate-spin' : ''}`} />
                            Refresh
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                          {/* Type Filter */}
                          <div>
                            <Label className="text-gray-400 text-xs mb-1 block">Type</Label>
                            <Select
                              value={historyFilters.type}
                              onValueChange={(value) => setHistoryFilters(prev => ({ ...prev, type: value }))}
                            >
                              <SelectTrigger className="bg-gray-900 border-gray-600 text-white h-9">
                                <SelectValue placeholder="All Types" />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-800 border-gray-600">
                                <SelectItem value="all" className="text-gray-300 focus:bg-gray-700 focus:text-white">All Types</SelectItem>
                                {availableHistoryTypes.map(type => (
                                  <SelectItem key={type} value={type} className="text-gray-300 focus:bg-gray-700 focus:text-white">
                                    {type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* Status Filter */}
                          <div>
                            <Label className="text-gray-400 text-xs mb-1 block">Status</Label>
                            <Select
                              value={historyFilters.status}
                              onValueChange={(value) => setHistoryFilters(prev => ({ ...prev, status: value }))}
                            >
                              <SelectTrigger className="bg-gray-900 border-gray-600 text-white h-9">
                                <SelectValue placeholder="All Status" />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-800 border-gray-600">
                                <SelectItem value="all" className="text-gray-300 focus:bg-gray-700 focus:text-white">All Status</SelectItem>
                                <SelectItem value="completed" className="text-gray-300 focus:bg-gray-700 focus:text-white">Completed</SelectItem>
                                <SelectItem value="pending" className="text-gray-300 focus:bg-gray-700 focus:text-white">Pending</SelectItem>
                                <SelectItem value="failed" className="text-gray-300 focus:bg-gray-700 focus:text-white">Failed</SelectItem>
                                <SelectItem value="active" className="text-gray-300 focus:bg-gray-700 focus:text-white">Active</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* Date From */}
                          <div>
                            <Label className="text-gray-400 text-xs mb-1 block">From Date</Label>
                            <Input
                              type="date"
                              value={historyFilters.dateFrom}
                              onChange={(e) => setHistoryFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                              className="bg-gray-900 border-gray-600 text-white h-9"
                            />
                          </div>
                          
                          {/* Date To */}
                          <div>
                            <Label className="text-gray-400 text-xs mb-1 block">To Date</Label>
                            <Input
                              type="date"
                              value={historyFilters.dateTo}
                              onChange={(e) => setHistoryFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                              className="bg-gray-900 border-gray-600 text-white h-9"
                            />
                          </div>
                          
                          {/* Search */}
                          <div>
                            <Label className="text-gray-400 text-xs mb-1 block">Search</Label>
                            <Input
                              type="text"
                              placeholder="Search..."
                              value={historyFilters.search}
                              onChange={(e) => setHistoryFilters(prev => ({ ...prev, search: e.target.value }))}
                              className="bg-gray-900 border-gray-600 text-white h-9"
                            />
                          </div>
                        </div>
                        
                        {/* Clear Filters */}
                        {(historyFilters.type !== 'all' || historyFilters.status !== 'all' || historyFilters.dateFrom || historyFilters.dateTo || historyFilters.search) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setHistoryFilters({ type: 'all', status: 'all', dateFrom: '', dateTo: '', search: '' })}
                            className="text-gray-400 hover:text-white mt-2"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Clear Filters
                          </Button>
                        )}
                      </CardContent>
                    </Card>

                    {/* History List */}
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardContent className="pt-6">
                        {loadingHistory ? (
                          <div className="flex items-center justify-center py-12">
                            <RefreshCw className="h-8 w-8 text-cyan-400 animate-spin" />
                          </div>
                        ) : history.length === 0 ? (
                          <p className="text-gray-400 text-center py-12">No activity history found</p>
                        ) : (
                          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                            {history
                              // Apply filters
                              .filter(item => {
                                // Type filter
                                if (historyFilters.type !== 'all' && item.type !== historyFilters.type) return false;
                                
                                // Status filter
                                if (historyFilters.status !== 'all' && item.status !== historyFilters.status) return false;
                                
                                // Date from filter
                                if (historyFilters.dateFrom) {
                                  const itemDate = new Date(item.createdAt);
                                  const fromDate = new Date(historyFilters.dateFrom);
                                  if (itemDate < fromDate) return false;
                                }
                                
                                // Date to filter
                                if (historyFilters.dateTo) {
                                  const itemDate = new Date(item.createdAt);
                                  const toDate = new Date(historyFilters.dateTo);
                                  toDate.setHours(23, 59, 59, 999);
                                  if (itemDate > toDate) return false;
                                }
                                
                                // Search filter
                                if (historyFilters.search) {
                                  const searchLower = historyFilters.search.toLowerCase();
                                  const matchesDescription = item.description.toLowerCase().includes(searchLower);
                                  const matchesCategory = item.category.toLowerCase().includes(searchLower);
                                  const matchesType = item.type.toLowerCase().includes(searchLower);
                                  const matchesDetails = item.details ? 
                                    JSON.stringify(item.details).toLowerCase().includes(searchLower) : false;
                                  if (!matchesDescription && !matchesCategory && !matchesType && !matchesDetails) return false;
                                }
                                
                                return true;
                              })
                              .map((item) => {
                                const config = HISTORY_TYPE_CONFIG[item.type] || { 
                                  color: 'text-gray-400', 
                                  bgColor: 'bg-gray-500/20', 
                                  icon: Activity 
                                };
                                const IconComponent = config.icon;
                                
                                return (
                                  <div 
                                    key={item.id} 
                                    className="p-3 bg-gray-900/50 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors group"
                                  >
                                    <div className="flex items-start gap-3">
                                      {/* Icon */}
                                      <div className={`p-2 rounded-lg ${config.bgColor} flex-shrink-0`}>
                                        <IconComponent className={`h-4 w-4 ${config.color}`} />
                                      </div>
                                      
                                      {/* Content */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="text-sm font-medium text-white">{item.description}</p>
                                          <Badge className={`text-[10px] ${config.bgColor} ${config.color} capitalize`}>
                                            {item.type.replace(/_/g, ' ')}
                                          </Badge>
                                          {item.status && (
                                            <Badge className={`text-[10px] ${
                                              item.status === 'completed' || item.status === 'success' || item.status === 'approved'
                                                ? 'bg-green-500/20 text-green-400'
                                                : item.status === 'pending' || item.status === 'started'
                                                ? 'bg-yellow-500/20 text-yellow-400'
                                                : item.status === 'failed' || item.status === 'declined'
                                                ? 'bg-red-500/20 text-red-400'
                                                : item.status === 'active'
                                                ? 'bg-blue-500/20 text-blue-400'
                                                : 'bg-gray-500/20 text-gray-400'
                                            } capitalize`}>
                                              {item.status.replace(/_/g, ' ')}
                                            </Badge>
                                          )}
                                          {item.amount !== undefined && item.amount !== null && (
                                            <span className={`text-xs font-mono ${
                                              item.amount >= 0 ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                              {item.amount >= 0 ? '+' : ''}{typeof item.amount === 'number' ? item.amount.toFixed(2) : item.amount}
                                            </span>
                                          )}
                                        </div>
                                        
                                        {/* Details (expandable on hover) */}
                                        {item.details && Object.keys(item.details).length > 0 && (
                                          <div className="mt-2 text-xs text-gray-500 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 opacity-0 group-hover:opacity-100 transition-opacity max-h-0 group-hover:max-h-40 overflow-hidden">
                                            {Object.entries(item.details)
                                              .filter(([_, v]) => v !== null && v !== undefined && v !== '')
                                              .slice(0, 8)
                                              .map(([key, value]) => (
                                                <div key={key}>
                                                  <span className="text-gray-600">{key.replace(/([A-Z])/g, ' $1').trim()}: </span>
                                                  <span className="text-gray-400">
                                                    {typeof value === 'boolean' 
                                                      ? (value ? 'Yes' : 'No')
                                                      : typeof value === 'number'
                                                      ? value.toLocaleString()
                                                      : String(value).substring(0, 30)}
                                                  </span>
                                                </div>
                                              ))}
                                          </div>
                                        )}
                                        
                                        {/* Timestamp */}
                                        <p className="text-[10px] text-gray-500 mt-1">
                                          {new Date(item.createdAt).toLocaleString()}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            
                            {/* Show count */}
                            <div className="text-center text-xs text-gray-500 pt-2">
                              Showing {history.filter(item => {
                                if (historyFilters.type !== 'all' && item.type !== historyFilters.type) return false;
                                if (historyFilters.status !== 'all' && item.status !== historyFilters.status) return false;
                                if (historyFilters.dateFrom) {
                                  const itemDate = new Date(item.createdAt);
                                  const fromDate = new Date(historyFilters.dateFrom);
                                  if (itemDate < fromDate) return false;
                                }
                                if (historyFilters.dateTo) {
                                  const itemDate = new Date(item.createdAt);
                                  const toDate = new Date(historyFilters.dateTo);
                                  toDate.setHours(23, 59, 59, 999);
                                  if (itemDate > toDate) return false;
                                }
                                if (historyFilters.search) {
                                  const searchLower = historyFilters.search.toLowerCase();
                                  const matchesDescription = item.description.toLowerCase().includes(searchLower);
                                  const matchesCategory = item.category.toLowerCase().includes(searchLower);
                                  const matchesType = item.type.toLowerCase().includes(searchLower);
                                  if (!matchesDescription && !matchesCategory && !matchesType) return false;
                                }
                                return true;
                              }).length} of {history.length} activities
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Invoices Tab */}
                {activeTab === 'invoices' && (
                  <div className="space-y-6">
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white text-lg flex items-center gap-2">
                          <FileText className="h-5 w-5 text-amber-400" />
                          User Invoices
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {invoices.length === 0 ? (
                          <p className="text-gray-400 text-center py-8">No invoices found</p>
                        ) : (
                          <div className="space-y-3">
                            {invoices.map((invoice) => (
                              <div key={invoice._id} className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg hover:border-amber-500/30 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="text-lg font-bold text-amber-500">{invoice.invoiceNumber}</p>
                                      <Badge className={`text-xs ${
                                        invoice.status === 'paid' 
                                          ? 'bg-green-500/20 text-green-400'
                                          : invoice.status === 'sent'
                                          ? 'bg-blue-500/20 text-blue-400'
                                          : 'bg-gray-500/20 text-gray-400'
                                      }`}>
                                        {invoice.status.toUpperCase()}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-gray-400">
                                      {new Date(invoice.invoiceDate).toLocaleDateString()}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1 truncate">
                                      {invoice.lineItems?.[0]?.description || 'Credit Purchase'}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-xl font-bold text-gray-100">€{invoice.total?.toFixed(2) || '0.00'}</p>
                                    {invoice.vatAmount > 0 && (
                                      <p className="text-xs text-gray-500">incl. VAT €{invoice.vatAmount.toFixed(2)}</p>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-2 shrink-0">
                                    <Button
                                      size="sm"
                                      onClick={() => window.open(`/api/invoices/${invoice._id}/html`, '_blank')}
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
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Password Verification Dialog */}
      {passwordDialogOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center">
          <Card className="bg-gray-800 border-yellow-500/50 w-[400px]">
            <CardHeader>
              <CardTitle className="text-yellow-400 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Admin Verification Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-400">
                Enter your admin password to {pendingAction} this user
              </p>
              <Input
                type="password"
                placeholder="Enter admin password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                className="bg-gray-900 border-gray-700"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setPasswordDialogOpen(false); setAdminPassword(''); }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleVerifyPassword}
                  disabled={verifyingPassword || !adminPassword}
                  className="bg-yellow-500 hover:bg-yellow-600 text-gray-900"
                >
                  {verifyingPassword ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                  Verify
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center">
          <Card className="bg-gray-800 border-red-500/50 w-[450px]">
            <CardHeader>
              <CardTitle className="text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Delete User Permanently
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-sm text-gray-300">This will permanently delete:</p>
                <ul className="text-xs text-gray-400 mt-2 space-y-1 list-disc list-inside">
                  <li>User account and sessions</li>
                  <li>Wallet and transactions</li>
                  <li>Competition participations</li>
                  <li>Trading positions and history</li>
                  <li>Badges and level progress</li>
                </ul>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4 border border-red-500/30">
                <p className="text-lg font-bold text-red-400">{user.name}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteUser}
                  disabled={deleting}
                >
                  {deleting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Delete Permanently
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

