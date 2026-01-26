'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { XCircle, Clock, AlertTriangle, Loader2, Pause, Play, ShieldAlert, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface CompetitionAdminActionsProps {
  competitionId: string;
  competitionName: string;
  status: string;
  startTime: string;
  endTime: string;
  participantCount: number;
  isPaused?: boolean;
  pauseReason?: string;
}

export default function CompetitionAdminActions({
  competitionId,
  competitionName,
  status,
  startTime,
  endTime,
  participantCount,
  isPaused: initialIsPaused = false,
  pauseReason: initialPauseReason = '',
}: CompetitionAdminActionsProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [countdown, setCountdown] = useState('');
  
  // Emergency controls state
  const [isPaused, setIsPaused] = useState(initialIsPaused);
  const [pauseReason, setPauseReason] = useState(initialPauseReason);
  const [isPausing, setIsPausing] = useState(false);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [newPauseReason, setNewPauseReason] = useState('');
  
  const [emergencyCancelDialogOpen, setEmergencyCancelDialogOpen] = useState(false);
  const [emergencyCancelReason, setEmergencyCancelReason] = useState('');
  const [isEmergencyCancelling, setIsEmergencyCancelling] = useState(false);

  const isUpcoming = status === 'upcoming';
  const isActive = status === 'active';
  const isCancelled = status === 'cancelled';
  const isCompleted = status === 'completed';
  const isEmergencyEnded = status === 'emergency_ended';

  // Live countdown
  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date();
      const target = isUpcoming ? new Date(startTime) : new Date(endTime);
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown(isUpcoming ? 'Starting...' : 'Ended');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setCountdown(`${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${seconds}s`);
      }
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);

    return () => clearInterval(interval);
  }, [startTime, endTime, isUpcoming]);

  const handleCancelCompetition = async () => {
    if (!cancelReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    setIsCancelling(true);
    try {
      const response = await fetch(`/api/competitions/${competitionId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel competition');
      }

      toast.success(`Competition cancelled! ${data.refundedCount} participants refunded.`);
      setCancelDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel competition');
    } finally {
      setIsCancelling(false);
    }
  };

  // Pause/Resume handlers
  const handlePauseCompetition = async () => {
    if (!newPauseReason.trim()) {
      toast.error('Please provide a reason for pausing');
      return;
    }

    setIsPausing(true);
    try {
      const response = await fetch(`/api/competitions/${competitionId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause', reason: newPauseReason }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to pause competition');
      }

      toast.success('Competition paused! Trading is now frozen.');
      setIsPaused(true);
      setPauseReason(newPauseReason);
      setPauseDialogOpen(false);
      setNewPauseReason('');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to pause competition');
    } finally {
      setIsPausing(false);
    }
  };

  const handleResumeCompetition = async () => {
    setIsPausing(true);
    try {
      const response = await fetch(`/api/competitions/${competitionId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resume competition');
      }

      toast.success(`Competition resumed! End time extended by ${Math.round(data.extensionMinutes)} minutes.`);
      setIsPaused(false);
      setPauseReason('');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resume competition');
    } finally {
      setIsPausing(false);
    }
  };

  // Emergency Cancel (for active competitions)
  const handleEmergencyCancel = async () => {
    if (!emergencyCancelReason.trim()) {
      toast.error('Please provide a reason for emergency cancellation');
      return;
    }

    setIsEmergencyCancelling(true);
    try {
      const response = await fetch(`/api/competitions/${competitionId}/emergency-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: emergencyCancelReason }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to emergency cancel competition');
      }

      toast.success(`Competition emergency cancelled! ${data.positionsClosed} positions closed, ${data.refundedCount} participants refunded.`);
      setEmergencyCancelDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to emergency cancel competition');
    } finally {
      setIsEmergencyCancelling(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Live Countdown */}
      {(isUpcoming || isActive) && (
        <div className={`p-4 rounded-xl border ${
          isUpcoming 
            ? 'bg-yellow-500/10 border-yellow-500/30' 
            : 'bg-blue-500/10 border-blue-500/30'
        }`}>
          <div className="flex items-center gap-3">
            <Clock className={`h-5 w-5 ${isUpcoming ? 'text-yellow-400' : 'text-blue-400'} animate-pulse`} />
            <div>
              <p className={`text-xs font-semibold ${isUpcoming ? 'text-yellow-400' : 'text-blue-400'}`}>
                {isUpcoming ? '⏳ STARTS IN' : '⏱️ TIME REMAINING'}
              </p>
              <p className={`text-2xl font-black tabular-nums ${isUpcoming ? 'text-yellow-300' : 'text-blue-300'}`}>
                {countdown}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cancelled Status */}
      {isCancelled && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-400" />
            <div>
              <p className="text-sm font-semibold text-red-400">CANCELLED</p>
              <p className="text-xs text-red-300/70">All participants have been refunded</p>
            </div>
          </div>
        </div>
      )}

      {/* Completed Status */}
      {isCompleted && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-green-400" />
            <div>
              <p className="text-sm font-semibold text-green-400">COMPLETED</p>
              <p className="text-xs text-green-300/70">Competition has ended</p>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Button - Only for upcoming competitions */}
      {isUpcoming && (
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="destructive" 
              className="w-full bg-red-600 hover:bg-red-700"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Competition
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-900 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Cancel Competition
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Are you sure you want to cancel <span className="text-white font-semibold">"{competitionName}"</span>?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-300">
                  <strong>Warning:</strong> This action will:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-red-300/80 list-disc list-inside">
                  <li>Immediately cancel the competition</li>
                  <li>Refund <strong>{participantCount}</strong> participant(s) their full entry fees</li>
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
                variant="destructive"
                onClick={handleCancelCompetition}
                disabled={isCancelling || !cancelReason.trim()}
                className="bg-red-600 hover:bg-red-700"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel & Refund All
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ============================================ */}
      {/* EMERGENCY CONTROLS - For Active Competitions */}
      {/* ============================================ */}
      {isActive && (
        <div className="space-y-3 pt-4 border-t border-gray-700">
          <h4 className="text-sm font-semibold text-orange-400 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Emergency Controls
          </h4>

          {/* Paused Status Banner */}
          {isPaused && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <div className="flex items-center gap-2 mb-1">
                <Pause className="h-4 w-4 text-yellow-400" />
                <span className="text-sm font-semibold text-yellow-400">PAUSED</span>
              </div>
              <p className="text-xs text-yellow-300/70">{pauseReason || 'Trading is frozen'}</p>
            </div>
          )}

          {/* Pause/Resume Button */}
          {!isPaused ? (
            <Dialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline"
                  className="w-full border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause Competition
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-700">
                <DialogHeader>
                  <DialogTitle className="text-yellow-400 flex items-center gap-2">
                    <Pause className="h-5 w-5" />
                    Pause Competition
                  </DialogTitle>
                  <DialogDescription className="text-gray-400">
                    Temporarily freeze all trading activity in this competition.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-300">
                      <strong>This will:</strong>
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-yellow-300/80 list-disc list-inside">
                      <li>Prevent any new orders from being placed</li>
                      <li>Prevent any positions from being closed</li>
                      <li>Notify all participants</li>
                      <li>Extend end time when resumed</li>
                    </ul>
                  </div>

                  <div>
                    <Label htmlFor="pauseReason" className="text-gray-300">
                      Reason for pausing *
                    </Label>
                    <Textarea
                      id="pauseReason"
                      value={newPauseReason}
                      onChange={(e) => setNewPauseReason(e.target.value)}
                      placeholder="e.g., Price feed issues, Technical problems, Investigating suspicious activity..."
                      className="mt-2 bg-gray-800 border-gray-600 text-gray-100"
                      rows={3}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setPauseDialogOpen(false)}
                    className="border-gray-600"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePauseCompetition}
                    disabled={isPausing || !newPauseReason.trim()}
                    className="bg-yellow-500 hover:bg-yellow-600 text-gray-900"
                  >
                    {isPausing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Pausing...
                      </>
                    ) : (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Pause Competition
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button 
              onClick={handleResumeCompetition}
              disabled={isPausing}
              className="w-full bg-green-500 hover:bg-green-600"
            >
              {isPausing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resuming...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Resume Competition
                </>
              )}
            </Button>
          )}

          {/* Emergency Cancel */}
          <Dialog open={emergencyCancelDialogOpen} onOpenChange={setEmergencyCancelDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="destructive" 
                className="w-full bg-red-600 hover:bg-red-700"
              >
                <ShieldAlert className="h-4 w-4 mr-2" />
                Emergency Cancel
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-700">
              <DialogHeader>
                <DialogTitle className="text-red-400 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  Emergency Cancel Competition
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  This is for critical situations only. All positions will be closed at current prices.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-300">
                    <strong>⚠️ CRITICAL ACTION:</strong> This will:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-red-300/80 list-disc list-inside">
                    <li>Immediately close ALL open positions at current market prices</li>
                    <li>Calculate and record all P&L</li>
                    <li>Refund all participants their FULL entry fees</li>
                    <li>Mark competition as emergency cancelled</li>
                    <li>This action CANNOT be undone</li>
                  </ul>
                </div>

                <div>
                  <Label htmlFor="emergencyCancelReason" className="text-gray-300">
                    Reason for emergency cancellation *
                  </Label>
                  <Textarea
                    id="emergencyCancelReason"
                    value={emergencyCancelReason}
                    onChange={(e) => setEmergencyCancelReason(e.target.value)}
                    placeholder="e.g., Critical price feed failure, System compromise, Unfair conditions detected..."
                    className="mt-2 bg-gray-800 border-gray-600 text-gray-100"
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEmergencyCancelDialogOpen(false)}
                  className="border-gray-600"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleEmergencyCancel}
                  disabled={isEmergencyCancelling || !emergencyCancelReason.trim()}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isEmergencyCancelling ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-4 w-4 mr-2" />
                      Emergency Cancel & Refund
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Emergency Ended Status */}
      {isEmergencyEnded && (
        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-orange-400" />
            <div>
              <p className="text-sm font-semibold text-orange-400">EMERGENCY ENDED</p>
              <p className="text-xs text-orange-300/70">Competition was terminated due to critical issues</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

