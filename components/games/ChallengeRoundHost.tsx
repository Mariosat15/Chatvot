"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ProviderGameFrame } from "./ProviderGameFrame";
import { RoundPreflight } from "./RoundPreflight";
import { ChallengeRoundResultPanel } from "./ChallengeRoundResultPanel";
import type { PlayState, PlayerRoundView } from "./play-state";

/**
 * The challenge-side sibling of `ProviderRoundHost.tsx` - see that file's header for why
 * launching is a click rather than a page load, why the result is polled rather than trusted
 * from the frame's own message, and why the poll is bounded.
 *
 * WHY A SEPARATE FILE RATHER THAN A `basePath` PROP ON THE COMPETITION HOST. `RoundPreflight`
 * and `ProviderGameFrame` are already fully generic - neither reads a contest id or imports
 * anything competition-specific - and are reused UNCHANGED below. The only competition-specific
 * things in `ProviderRoundHost` are the hardcoded `/api/competitions/${id}/rounds` URL and the
 * `RoundResultPanel` it renders, whose back-link destination is pinned by an existing test. Both
 * are cheap to restate here and doing so leaves the tested competition file untouched.
 */

const POLL_INTERVAL_MS = 3000;
const POLL_ATTEMPTS = 20;
const PREFLIGHT_REFRESH_MS = 20000;

type ConfirmReason = "finished" | "left";

type Phase =
  | { name: "preflight" }
  | { name: "launching" }
  | { name: "playing"; launchUrl: string; roundId: string; resumed: boolean }
  | { name: "confirming"; roundId: string; reason: ConfirmReason }
  | { name: "settled"; round: PlayerRoundView | null };

interface ChallengeRoundHostProps {
  challengeId: string;
  challengeName: string;
  gameName: string;
  initialState: PlayState;
}

export function ChallengeRoundHost({
  challengeId,
  challengeName,
  gameName,
  initialState,
}: ChallengeRoundHostProps) {
  const router = useRouter();
  const [state, setState] = useState<PlayState>(initialState);
  const [phase, setPhase] = useState<Phase>({ name: "preflight" });
  const [refusal, setRefusal] = useState<string | null>(null);

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const readState = useCallback(async (): Promise<PlayState | null> => {
    try {
      const response = await fetch(`/api/challenges/${challengeId}/rounds`);
      const data = await response.json();
      if (!response.ok || !data.success) return null;
      return data as PlayState;
    } catch {
      return null;
    }
  }, [challengeId]);

  useEffect(() => {
    if (phase.name !== "preflight") return;

    const timer = setInterval(() => {
      void (async () => {
        const refreshed = await readState();
        if (refreshed) setState(refreshed);
      })();
    }, PREFLIGHT_REFRESH_MS);

    return () => clearInterval(timer);
  }, [phase.name, readState]);

  const launch = useCallback(async () => {
    setRefusal(null);
    setPhase({ name: "launching" });

    try {
      const response = await fetch(`/api/challenges/${challengeId}/rounds`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setRefusal(data.error ?? "Something went wrong. Please contact support.");
        setPhase({ name: "preflight" });
        const refreshed = await readState();
        if (refreshed) setState(refreshed);
        return;
      }

      setPhase({
        name: "playing",
        launchUrl: data.launchUrl,
        roundId: data.roundId,
        resumed: Boolean(data.resumed),
      });

      if (data.resumed) {
        toast.info("Reopening the round you already started.");
      }
    } catch {
      setRefusal("Something went wrong. Please contact support.");
      setPhase({ name: "preflight" });
    }
  }, [challengeId, readState]);

  const confirmResult = useCallback(
    (roundId: string) => {
      let polls = 0;

      const tick = async () => {
        polls += 1;

        const refreshed = await readState();
        if (refreshed) {
          setState(refreshed);
          const round = refreshed.rounds.find((r) => r.roundId === roundId);
          if (round && !round.isLive) {
            setPhase({ name: "settled", round });
            // Reason: the challenge page shows the result and the player's standing, both of
            // which have just changed. Without this they see a stale view.
            router.refresh();
            return;
          }
        }

        if (polls >= POLL_ATTEMPTS) {
          setPhase({ name: "settled", round: null });
          return;
        }

        pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
      };

      void tick();
    },
    [readState, router],
  );

  const handleFinished = useCallback(() => {
    if (phase.name !== "playing") return;
    const roundId = phase.roundId;
    setPhase({ name: "confirming", roundId, reason: "finished" });
    confirmResult(roundId);
  }, [phase, confirmResult]);

  const handleExit = useCallback(() => {
    if (phase.name === "playing") {
      setPhase({ name: "confirming", roundId: phase.roundId, reason: "left" });
      confirmResult(phase.roundId);
    }
  }, [phase, confirmResult]);

  const handleUntrustedOrigin = useCallback((origin: string) => {
    console.error(
      `❌ The game frame sent a message from an unexpected origin (${origin}). Ignored.`,
    );
  }, []);

  if (phase.name === "playing") {
    return (
      <ProviderGameFrame
        launchUrl={phase.launchUrl}
        gameName={gameName}
        onFinished={handleFinished}
        onExit={handleExit}
        onUntrustedOrigin={handleUntrustedOrigin}
      />
    );
  }

  if (phase.name === "confirming" || phase.name === "settled") {
    return (
      <ChallengeRoundResultPanel
        challengeId={challengeId}
        challengeName={challengeName}
        confirming={phase.name === "confirming"}
        confirmReason={phase.name === "confirming" ? phase.reason : null}
        round={phase.name === "settled" ? phase.round : null}
        state={state}
        onPlayAgain={() => setPhase({ name: "preflight" })}
      />
    );
  }

  return (
    <RoundPreflight
      gameName={gameName}
      state={state}
      launching={phase.name === "launching"}
      refusal={refusal}
      onLaunch={launch}
    />
  );
}
