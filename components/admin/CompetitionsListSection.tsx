'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Trophy, Trash2, Edit, Eye, Users, Calendar, DollarSign, 
  RefreshCw, AlertCircle, CheckCircle, Clock, XCircle, Ban, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// Live countdown badge component
function LiveCountdownBadge({ targetDate, label, isEnding = false }: { targetDate: string; label: string; isEnding?: boolean }) {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date();
      const target = new Date(targetDate);
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown(isEnding ? 'Ended' : 'Started');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setCountdown(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${minutes}m ${seconds}s`);
      }
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, [targetDate, isEnding]);

  return (
    <div className={`px-3 py-1 rounded-full border text-xs font-semibold flex items-center gap-1 ${
      isEnding 
        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
        : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    }`}>
      <Clock className="h-3 w-3 animate-pulse" />
      <span className="text-gray-400">{label}:</span>
      <span className="font-mono tabular-nums">{countdown}</span>
    </div>
  );
}

interface Competition {
  _id: string;
  name: string;
  description: string;
  slug: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  startTime: string;
  endTime: string;
  entryFee: number;
  startingCapital: number;
  maxParticipants: number;
  currentParticipants: number;
  prizePool: number;
  platformFeePercentage: number;
  assetClasses: string[];
}

export default function CompetitionsListSection() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [competitionToDelete, setCompetitionToDelete] = useState<Competition | null>(null);
  
  // Cancel competition state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [competitionToCancel, setCompetitionToCancel] = useState<Competition | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const fetchCompetitions = async () => {
    try {
      const response = await fetch('/api/admin/competitions');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setCompetitions(data.competitions || []);
    } catch (error) {
      toast.error('Failed to load competitions');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (competition: Competition) => {
    setCompetitionToDelete(competition);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!competitionToDelete) return;

    setDeletingId(competitionToDelete._id);
    try {
      const response = await fetch(`/api/admin/competitions/${competitionToDelete._id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete');
      }

      toast.success('Competition deleted successfully');
      setCompetitions(competitions.filter(c => c._id !== competitionToDelete._id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete competition');
    } finally {
      setDeletingId(null);
      setDeleteDialogOpen(false);
      setCompetitionToDelete(null);
    }
  };

  // Cancel competition handlers
  const handleCancelClick = (competition: Competition) => {
    setCompetitionToCancel(competition);
    setCancelReason('');
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!competitionToCancel || !cancelReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    setIsCancelling(true);
    try {
      const response = await fetch(`/api/admin/competitions/${competitionToCancel._id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel competition');
      }

      toast.success(`Competition cancelled! ${data.refundedCount} participants refunded.`);
      
      // Update local state
      setCompetitions(competitions.map(c => 
        c._id === competitionToCancel._id 
          ? { ...c, status: 'cancelled' as const }
          : c
      ));
      
      setCancelDialogOpen(false);
      setCompetitionToCancel(null);
      setCancelReason('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel competition');
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'upcoming':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'completed':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4" />;
      case 'upcoming':
        return <Clock className="h-4 w-4" />;
      case 'completed':
        return <Trophy className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (competitions.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-12 text-center">
        <Trophy className="h-16 w-16 text-gray-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-300 mb-2">No Competitions Yet</h3>
        <p className="text-gray-500 mb-6">Create your first trading competition to get started</p>
        <Link href="/admin/competitions/create">
          <Button className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-900 font-bold">
            Create Competition
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase">Total</p>
              <p className="text-2xl font-bold text-gray-200">{competitions.length}</p>
            </div>
            <Trophy className="h-8 w-8 text-gray-600" />
          </div>
        </div>
        <div className="bg-gray-800/50 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase">Active</p>
              <p className="text-2xl font-bold text-green-400">
                {competitions.filter(c => c.status === 'active').length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500/50" />
          </div>
        </div>
        <div className="bg-gray-800/50 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase">Upcoming</p>
              <p className="text-2xl font-bold text-blue-400">
                {competitions.filter(c => c.status === 'upcoming').length}
              </p>
            </div>
            <Clock className="h-8 w-8 text-blue-500/50" />
          </div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase">Completed</p>
              <p className="text-2xl font-bold text-gray-400">
                {competitions.filter(c => c.status === 'completed').length}
              </p>
            </div>
            <Trophy className="h-8 w-8 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Competitions List */}
      <div className="space-y-4">
        {competitions.map((competition) => (
          <div
            key={competition._id}
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Left: Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-12 w-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Trophy className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-100 truncate">{competition.name}</h3>
                    <p className="text-sm text-gray-400 line-clamp-2">{competition.description}</p>
                  </div>
                </div>

                {/* Status and Stats */}
                <div className="flex flex-wrap items-center gap-3 mt-4">
                  <div className={`px-3 py-1 rounded-full border text-xs font-semibold flex items-center gap-1 ${getStatusColor(competition.status)}`}>
                    {getStatusIcon(competition.status)}
                    {competition.status.toUpperCase()}
                  </div>

                  {/* Live Countdown for Upcoming */}
                  {competition.status === 'upcoming' && (
                    <LiveCountdownBadge targetDate={competition.startTime} label="Starts in" />
                  )}

                  {/* Time Remaining for Active */}
                  {competition.status === 'active' && (
                    <LiveCountdownBadge targetDate={competition.endTime} label="Ends in" isEnding />
                  )}
                  
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Users className="h-3 w-3" />
                    {competition.currentParticipants}/{competition.maxParticipants}
                  </div>
                  
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <DollarSign className="h-3 w-3" />
                    Entry: €{competition.entryFee}
                  </div>
                  
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Trophy className="h-3 w-3" />
                    Pool: €{competition.prizePool?.toFixed(0) || 0}
                  </div>
                  
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="h-3 w-3" />
                    {new Date(competition.startTime).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex flex-col gap-2">
                <Link href={`/admin/competitions/view/${competition._id}`}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </Link>
                
                <Link href={`/admin/competitions/edit/${competition._id}`}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-yellow-500 text-yellow-400 hover:bg-yellow-500 hover:text-gray-900"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </Link>

                {/* Cancel Button - Only for upcoming competitions */}
                {competition.status === 'upcoming' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCancelClick(competition)}
                    className="w-full border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-white"
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Cancel & Refund
                  </Button>
                )}
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteClick(competition)}
                  disabled={deletingId === competition._id}
                  className="w-full border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                >
                  {deletingId === competition._id ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-gray-800 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-100 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Delete Competition?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete "<span className="font-semibold text-gray-300">{competitionToDelete?.name}</span>"?
              <br /><br />
              This action cannot be undone. All participants and related data will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-700 text-gray-300 hover:bg-gray-600">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete Competition
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Competition Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-orange-400 flex items-center gap-2">
              <Ban className="h-5 w-5" />
              Cancel Competition & Refund
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to cancel <span className="text-white font-semibold">"{competitionToCancel?.name}"</span>?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <p className="text-sm text-orange-300">
                <strong>⚠️ This action will:</strong>
              </p>
              <ul className="mt-2 space-y-1 text-sm text-orange-300/80 list-disc list-inside">
                <li>Immediately cancel the competition</li>
                <li>Refund <strong>{competitionToCancel?.currentParticipants || 0}</strong> participant(s) their full entry fees</li>
                <li>Send notification to all participants</li>
                <li>This action cannot be undone</li>
              </ul>
            </div>

            <div>
              <Label htmlFor="cancelReason" className="text-gray-300">
                Reason for cancellation *
              </Label>
              <Textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Not enough participants, Technical issues, Schedule conflict..."
                className="mt-2 bg-gray-800 border-gray-600 text-gray-100"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              className="border-gray-600"
            >
              Keep Competition
            </Button>
            <Button
              onClick={handleCancelConfirm}
              disabled={isCancelling || !cancelReason.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4 mr-2" />
                  Cancel & Refund All
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

