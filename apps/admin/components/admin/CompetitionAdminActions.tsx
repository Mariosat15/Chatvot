"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  XCircle,
  Clock,
  Loader2,
  Pause,
  Play,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { contestControlCopy } from "@/lib/admin/contest-control-copy";
import HubWithheldAction from "@/components/admin/incidents/HubWithheldAction";

interface CompetitionAdminActionsProps {
  competitionId: string;
  competitionName: string;
  status: string;
  startTime: string;
  endTime: string;
  participantCount: number;
  isPaused?: boolean;
  pauseReason?: string;
  /*
    THE EMERGENCY FACTS, WHICH ARE FIELDS AND NOT A STATUS.

    `emergencyCancelActiveCompetition` stores `status: "cancelled"` and puts these three
    alongside it. They are passed in rather than the component testing for an
    `"emergency_ended"` status, because nothing has ever written that status - see the cancelled
    card below.
  */
  emergencyEndedAt?: string | Date | null;
  emergencyEndReason?: string | null;
  emergencyEndedBy?: string | null;
  /**
   * Derived server-side from the stored game label by `hasProviderGameLabel`.
   *
   * Defaults to false so an unlabelled contest gets the trading wording, which is what
   * invariant 5 says an absent label means. Passing the game *type* string instead would let
   * this component decide what a provider contest is, and there would then be two answers to
   * that question in the admin app.
   */
  isProviderGame?: boolean;
}

export default function CompetitionAdminActions({
  competitionId,
  competitionName,
  status,
  startTime,
  endTime,
  participantCount,
  isPaused: initialIsPaused = false,
  pauseReason: initialPauseReason = "",
  emergencyEndedAt,
  emergencyEndReason,
  emergencyEndedBy,
  isProviderGame = false,
}: CompetitionAdminActionsProps) {
  const router = useRouter();
  const copy = contestControlCopy(isProviderGame);
  const [countdown, setCountdown] = useState("");

  // Emergency controls state
  const [isPaused, setIsPaused] = useState(initialIsPaused);
  const [pauseReason, setPauseReason] = useState(initialPauseReason);
  const [isPausing, setIsPausing] = useState(false);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [newPauseReason, setNewPauseReason] = useState("");

  const isUpcoming = status === "upcoming";
  const isActive = status === "active";
  const isCancelled = status === "cancelled";
  const isCompleted = status === "completed";
  /*
    Reason: keyed on `emergencyEndedAt` rather than on a status. A cancellation is an emergency
    one exactly when the emergency writer ran, and that writer's evidence is this timestamp -
    it sets no distinguishing status. Testing `emergencyEndReason` instead would be wrong in the
    one direction that matters: the reason is operator free text, so a blank one would silently
    downgrade a genuine emergency end to an ordinary cancellation.
  */
  const wasEmergencyEnded = isCancelled && Boolean(emergencyEndedAt);

  // Live countdown
  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date();
      const target = isUpcoming ? new Date(startTime) : new Date(endTime);
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown(isUpcoming ? "Starting..." : "Ended");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
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

  // Pause/Resume handlers
  const handlePauseCompetition = async () => {
    if (!newPauseReason.trim()) {
      toast.error("Please provide a reason for pausing");
      return;
    }

    setIsPausing(true);
    try {
      const response = await fetch(`/api/competitions/${competitionId}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause", reason: newPauseReason }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to pause competition");
      }

      toast.success(copy.pausedToast);
      setIsPaused(true);
      setPauseReason(newPauseReason);
      setPauseDialogOpen(false);
      setNewPauseReason("");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to pause competition",
      );
    } finally {
      setIsPausing(false);
    }
  };

  const handleResumeCompetition = async () => {
    setIsPausing(true);
    try {
      const response = await fetch(`/api/competitions/${competitionId}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to resume competition");
      }

      // The play window is named explicitly for a provider contest because extending only the
      // end time was the defect: `endTime` gates nothing a player plays inside, so an operator
      // told "end time extended" had no way to know whether the compensation had reached the
      // window that actually matters.
      toast.success(
        isProviderGame
          ? `Competition resumed! Play window and end time extended by ${Math.round(data.extensionMinutes)} minutes.`
          : `Competition resumed! End time extended by ${Math.round(data.extensionMinutes)} minutes.`,
      );
      setIsPaused(false);
      setPauseReason("");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to resume competition",
      );
    } finally {
      setIsPausing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Live Countdown */}
      {(isUpcoming || isActive) && (
        <div
          className={`p-4 rounded-xl border ${
            isUpcoming
              ? "bg-yellow-500/10 border-yellow-500/30"
              : "bg-blue-500/10 border-blue-500/30"
          }`}
        >
          <div className="flex items-center gap-3">
            <Clock
              className={`h-5 w-5 ${isUpcoming ? "text-yellow-400" : "text-blue-400"} animate-pulse`}
            />
            <div>
              <p
                className={`text-xs font-semibold ${isUpcoming ? "text-yellow-400" : "text-blue-400"}`}
              >
                {isUpcoming ? "⏳ STARTS IN" : "⏱️ TIME REMAINING"}
              </p>
              <p
                className={`text-2xl font-black tabular-nums ${isUpcoming ? "text-yellow-300" : "text-blue-300"}`}
              >
                {countdown}
              </p>
            </div>
          </div>
        </div>
      )}

      {/*
        CANCELLED, AND WHETHER IT WAS AN EMERGENCY.

        This used to be two cards: a red CANCELLED one here and an orange EMERGENCY ENDED one at
        the foot of the file, gated on `status === "emergency_ended"`. That status is declared on
        the model and written by nothing, so the orange card could never render and an operator
        who had just emergency-cancelled a contest was shown the generic red card - never told it
        was an emergency, by whom, or why, although all three facts are on the document in
        `emergencyEndedAt` / `emergencyEndReason` / `emergencyEndedBy`.

        The fix reads the fields the writer actually writes rather than a status nobody stores.
        One card, because an emergency end IS a cancellation and both mean the same thing about
        the money: every entry fee has been refunded. Keeping two cards would mean the emergency
        one has to repeat that sentence or drop it, and dropping it is what the old orange card
        did - the operator lost the one line that mattered at the moment it mattered most.
      */}
      {isCancelled && (
        <div
          className={`p-4 rounded-xl ${wasEmergencyEnded ? "bg-orange-500/10 border border-orange-500/30" : "bg-red-500/10 border border-red-500/30"}`}
        >
          <div className="flex items-start gap-3">
            {wasEmergencyEnded ? (
              <ShieldAlert className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p
                className={`text-sm font-semibold ${wasEmergencyEnded ? "text-orange-400" : "text-red-400"}`}
              >
                {wasEmergencyEnded ? "EMERGENCY ENDED" : "CANCELLED"}
              </p>
              <p
                className={`text-xs ${wasEmergencyEnded ? "text-orange-300/70" : "text-red-300/70"}`}
              >
                All participants have been refunded
              </p>
              {emergencyEndReason && (
                <p className="text-xs text-orange-200/80 mt-2 break-words">
                  Reason: {emergencyEndReason}
                </p>
              )}
              {emergencyEndedAt && (
                <p className="text-[11px] text-orange-300/60 mt-1">
                  Ended {new Date(emergencyEndedAt).toLocaleString()}
                  {emergencyEndedBy ? ` by ${emergencyEndedBy}` : ""}
                </p>
              )}
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
              <p className="text-xs text-green-300/70">
                Contest has ended. A rank or a prize is corrected from Incident
                Management, which records the reason.
              </p>
            </div>
          </div>
        </div>
      )}

      {isUpcoming && (
        <HubWithheldAction
          action="Cancelling this contest and refunding entry fees"
          detail={`${participantCount} participant(s) of ${competitionName} are refunded from Incident Management.`}
        />
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
                <span className="text-sm font-semibold text-yellow-400">
                  PAUSED
                </span>
              </div>
              <p className="text-xs text-yellow-300/70">
                {pauseReason || copy.pausedBannerFallback}
              </p>
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
                    {copy.pauseDialogDescription}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-300">
                      <strong>This will:</strong>
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-yellow-300/80 list-disc list-inside">
                      {copy.pauseConsequences.map((consequence) => (
                        <li key={consequence}>{consequence}</li>
                      ))}
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

          <HubWithheldAction
            action="Emergency-cancelling this contest"
            detail={`${competitionName} is ended and refunded from Incident Management.`}
          />
        </div>
      )}

    </div>
  );
}
