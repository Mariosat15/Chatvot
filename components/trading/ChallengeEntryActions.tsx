"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Swords, Check, X, RefreshCw, Clock, Trophy } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import ActionTermsDialog, {
  ACTION_TERM_SLUGS,
} from "@/components/ActionTermsDialog";

interface ChallengeEntryActionsProps {
  challengeId: string;
  status: string;
  isChallenger: boolean;
  isChallenged: boolean;
  /*
    Reason: this component always said "trading" and always linked to `/trade`, regardless
    of `challenge.gameType` - the same trading-shaped-control mistake `matchmaking.service.ts`
    and `GettingStartedCard.tsx` made elsewhere. A provider challenge has no trades to make,
    so the active state must read "play" and route to `/play`. Defaults to false (trading)
    so every existing caller is unaffected.
  */
  isProviderGame?: boolean;
  /*
    Reason: an OPEN challenge names nobody, so a prospective accepter is neither the
    challenger nor the challenged and fell through every branch below to the terminal
    panel - which told them a pending challenge "is no longer active" and offered no way
    to take the seat. Defaults to false so every existing caller is unaffected.
  */
  openSeat?: boolean;
}

export default function ChallengeEntryActions({
  challengeId,
  status,
  isChallenger,
  isChallenged,
  isProviderGame = false,
  openSeat = false,
}: ChallengeEntryActionsProps) {
  const [responding, setResponding] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const router = useRouter();

  // Reason: Show terms dialog before accepting a challenge
  const handleAccept = async () => {
    setShowTerms(true);
  };

  /** Called after user accepts terms — proceeds with challenge acceptance */
  const proceedAfterTerms = async () => {
    setShowTerms(false);
    setResponding(true);
    try {
      const res = await fetch(`/api/challenges/${challengeId}/accept`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to accept");
      }

      toast.success("Challenge accepted! The battle begins NOW!");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to accept challenge",
      );
    } finally {
      setResponding(false);
    }
  };

  const handleDecline = async () => {
    setResponding(true);
    try {
      const res = await fetch(`/api/challenges/${challengeId}/decline`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to decline");
      }

      toast.success("Challenge declined");
      router.push("/challenges");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to decline challenge",
      );
    } finally {
      setResponding(false);
    }
  };

  // Pending - show accept/decline for challenged user
  if (status === "pending" && isChallenged) {
    return (
      <>
        <div className="rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border border-yellow-500/30 p-6">
          <h3 className="text-lg font-semibold text-yellow-400 mb-4 flex items-center gap-2">
            ⚔️ Challenge Received!
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            {isProviderGame
              ? "You've been challenged to a 1v1 battle. Accept to start playing immediately!"
              : "You've been challenged to a 1v1 trading battle. Accept to start trading immediately!"}
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleAccept}
              disabled={responding}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-6"
            >
              {responding ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Check className="h-5 w-5 mr-2" />
                  Accept Challenge
                </>
              )}
            </Button>
            <Button
              onClick={handleDecline}
              disabled={responding}
              variant="outline"
              className="flex-1 border-2 border-red-600 text-red-400 hover:bg-red-500 hover:text-white font-bold py-6"
            >
              <X className="h-5 w-5 mr-2" />
              Decline
            </Button>
          </div>
        </div>

        {/* Action Terms Dialog — shown before accepting a challenge */}
        <ActionTermsDialog
          slug={ACTION_TERM_SLUGS.CHALLENGE}
          open={showTerms}
          onAccept={proceedAfterTerms}
          onDecline={() => setShowTerms(false)}
        />
      </>
    );
  }

  // Pending - show waiting message for challenger
  if (status === "pending" && isChallenger) {
    return (
      <div className="rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30 p-6">
        <h3 className="text-lg font-semibold text-blue-400 mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Awaiting Response
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          {openSeat
            ? "Your challenge is open to anyone. Waiting for a player to take the seat..."
            : "Your challenge has been sent. Waiting for your opponent to accept..."}
        </p>
        <Button
          disabled
          className="w-full bg-gray-700 text-gray-400 font-bold py-6 cursor-not-allowed"
        >
          <Clock className="h-5 w-5 mr-2 animate-pulse" />
          Waiting for Response...
        </Button>
      </div>
    );
  }

  /*
    Pending, open, and the viewer is neither player - offer the seat. Deliberately no
    Decline button: declining is refusing an invitation addressed to you, and the decline
    route refuses a caller who is not the named opponent, so the control would appear to
    work and do nothing.
  */
  if (status === "pending" && openSeat) {
    return (
      <>
        <div className="rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border border-yellow-500/30 p-6">
          <h3 className="text-lg font-semibold text-yellow-400 mb-4 flex items-center gap-2">
            ⚔️ Open Challenge
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            {isProviderGame
              ? "Nobody has taken this seat yet. Take it to start playing immediately!"
              : "Nobody has taken this seat yet. Take it to start trading immediately!"}
          </p>
          <Button
            onClick={handleAccept}
            disabled={responding}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-6"
          >
            {responding ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Check className="h-5 w-5 mr-2" />
                Take This Seat
              </>
            )}
          </Button>
        </div>

        <ActionTermsDialog
          slug={ACTION_TERM_SLUGS.CHALLENGE}
          open={showTerms}
          onAccept={proceedAfterTerms}
          onDecline={() => setShowTerms(false)}
        />
      </>
    );
  }

  // Active - show trade button
  if (status === "active") {
    return (
      <div className="rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30 p-6">
        <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
          <Swords className="h-5 w-5" />
          Challenge In Progress!
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          {isProviderGame
            ? "The battle has begun! Play now to beat your opponent."
            : "The battle has begun! Trade now to beat your opponent."}
        </p>
        <Link
          href={`/challenges/${challengeId}/${isProviderGame ? "play" : "trade"}`}
        >
          <Button className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-black py-6 text-lg">
            <Swords className="h-5 w-5 mr-2" />
            {isProviderGame ? "Play Now" : "Trade Now"}
          </Button>
        </Link>
      </div>
    );
  }

  // Completed - show view results
  if (status === "completed") {
    return (
      <div className="rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-500/10 border border-purple-500/30 p-6">
        <h3 className="text-lg font-semibold text-purple-400 mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Challenge Complete
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          {isProviderGame
            ? "This challenge has ended. View your final results above."
            : "This challenge has ended. View your trading history and final results above."}
        </p>
        <Link href="/challenges">
          <Button
            variant="outline"
            className="w-full border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white font-bold py-6"
          >
            <Swords className="h-5 w-5 mr-2" />
            Back to Challenges
          </Button>
        </Link>
      </div>
    );
  }

  // Declined/Expired/Cancelled - show info
  return (
    <div className="rounded-xl bg-gradient-to-br from-gray-600/20 to-gray-500/10 border border-gray-600/30 p-6">
      <h3 className="text-lg font-semibold text-gray-400 mb-4 flex items-center gap-2">
        🚫 Challenge {status.charAt(0).toUpperCase() + status.slice(1)}
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        This challenge is no longer active.
      </p>
      <Link href="/challenges">
        <Button
          variant="outline"
          className="w-full border-gray-600 text-gray-400 hover:bg-gray-700 font-bold py-6"
        >
          Back to Challenges
        </Button>
      </Link>
    </div>
  );
}
