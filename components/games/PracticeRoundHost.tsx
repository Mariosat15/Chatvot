"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProviderGameFrame } from "./ProviderGameFrame";
import { DesktopPracticeLobby } from "./practice/DesktopPracticeLobby";
import { MobilePracticeArea } from "./practice/MobilePracticeArea";
import type { GameScoreType } from "@/lib/utils/format-game-score";
import type { PracticeRoundView } from "./practice-state";
import "./practice-area.css";

/**
 * The practice area for any provider game.
 *
 * The round is created by a CLICK (a POST), never by rendering. When the game posts
 * `finished`, the host pulls the score and KEEPS the iframe open so Circuit / Stack can show
 * their in-game result page; Close/`exit` returns to Start. Velocity tears its board down and
 * posts `exit` itself after a short hand-off so practice is not stuck on "being confirmed"
 * (owner, 6 Oct 2026). Leaving mid-round voids the attempt. Nothing here names a game.
 *
 * Idle UI (8 Oct 2026): desktop cyber HUD lobby and a separate touch-first mobile lobby
 * share this controller — APIs and history only, not layout (owner mobile plan).
 */

type Phase =
  | { name: "idle" }
  | { name: "launching" }
  | { name: "playing"; launchUrl: string; roundId: string };

interface PracticeRoundHostProps {
  slug: string;
  gameName: string;
  scoreType?: GameScoreType;
  initialRounds: PracticeRoundView[];
}

/** Race-server result can lag the frame's `finished` by a beat; retry before giving up. */
const FINISH_PULL_ATTEMPTS = 6;
const FINISH_PULL_GAP_MS = 500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function PracticeRoundHost({
  slug,
  gameName,
  scoreType,
  initialRounds,
}: PracticeRoundHostProps) {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [rounds, setRounds] = useState<PracticeRoundView[]>(initialRounds);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const liveRoundId = useRef<string | null>(null);
  // Reason: after `finished` the score is pulled and must not be voided by pagehide / exit.
  const scoredRoundId = useRef<string | null>(null);
  // Reason: Velocity posts exit ~1s after finished; voiding during the pull made Ended/- rows.
  const finishingRoundId = useRef<string | null>(null);
  const endpoint = `/api/games/${encodeURIComponent(slug)}/practice/rounds`;

  const endRound = useCallback(
    (roundId: string) => {
      void fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId }),
        keepalive: true,
      }).catch(() => undefined);
    },
    [endpoint],
  );

  const refreshRounds = useCallback(async () => {
    try {
      const response = await fetch(endpoint);
      const data = await response.json();
      if (response.ok && data.success && Array.isArray(data.rounds)) {
        setRounds(data.rounds);
      }
    } catch {
      /* List refresh is best-effort; the next Start still works. */
    }
  }, [endpoint]);

  useEffect(() => {
    // Reason: React's unmount cleanup does not run when the player closes the tab.
    // Only void a round that has NOT been scored - voiding a finished practice wipe the
    // result the list exists to show.
    const endIfLiveUnscored = () => {
      const id = liveRoundId.current;
      if (!id) return;
      if (scoredRoundId.current === id || finishingRoundId.current === id) return;
      endRound(id);
    };
    window.addEventListener("pagehide", endIfLiveUnscored);
    window.addEventListener("beforeunload", endIfLiveUnscored);
    return () => {
      window.removeEventListener("pagehide", endIfLiveUnscored);
      window.removeEventListener("beforeunload", endIfLiveUnscored);
      endIfLiveUnscored();
    };
  }, [endRound]);

  const launch = useCallback(async () => {
    setRefusal(null);
    scoredRoundId.current = null;
    finishingRoundId.current = null;
    setPhase({ name: "launching" });
    try {
      const response = await fetch(endpoint, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setRefusal(data.error ?? "Something went wrong. Please contact support.");
        setPhase({ name: "idle" });
        return;
      }
      liveRoundId.current = data.roundId;
      setPhase({ name: "playing", launchUrl: data.launchUrl, roundId: data.roundId });
    } catch {
      setRefusal("Something went wrong. Please contact support.");
      setPhase({ name: "idle" });
    }
  }, [endpoint]);

  const handleFinished = useCallback(
    async (roundId: string) => {
      // Keep the iframe up for Circuit / Stack Close. Do NOT mark scored until a pull lands
      // a closed round - marking early then voiding on a premature exit made Ended/- rows.
      finishingRoundId.current = roundId;
      try {
        for (let attempt = 0; attempt < FINISH_PULL_ATTEMPTS; attempt++) {
          try {
            const response = await fetch(endpoint, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ roundId }),
            });
            const data = await response.json();
            if (response.ok && data.success && data.round) {
              const view = data.round as PracticeRoundView;
              setRounds((previous) => {
                const rest = previous.filter((row) => row.roundId !== roundId);
                return [view, ...rest].slice(0, 5);
              });
              if (!view.isLive) {
                scoredRoundId.current = roundId;
                liveRoundId.current = null;
                return;
              }
            }
          } catch {
            /* Retry - race-server receipt can lag the frame. */
          }
          if (attempt < FINISH_PULL_ATTEMPTS - 1) await wait(FINISH_PULL_GAP_MS);
        }
        await refreshRounds();
      } finally {
        if (finishingRoundId.current === roundId) finishingRoundId.current = null;
      }
    },
    [endpoint, refreshRounds],
  );

  const handleExit = useCallback(
    (roundId: string) => {
      const goIdleAfterResult = async () => {
        // Reason: Velocity exits while the finish pull may still be retrying.
        for (let i = 0; i < 24 && finishingRoundId.current === roundId; i++) {
          await wait(125);
        }
        if (scoredRoundId.current !== roundId && liveRoundId.current === roundId) {
          // Last chance pull before returning - never void a race that just finished.
          try {
            const response = await fetch(endpoint, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ roundId }),
            });
            const data = await response.json();
            if (response.ok && data.success && data.round && !data.round.isLive) {
              scoredRoundId.current = roundId;
              setRounds((previous) => {
                const rest = previous.filter((row) => row.roundId !== roundId);
                return [data.round as PracticeRoundView, ...rest].slice(0, 5);
              });
            } else {
              await refreshRounds();
            }
          } catch {
            await refreshRounds();
          }
        } else {
          await refreshRounds();
        }
        liveRoundId.current = null;
        scoredRoundId.current = null;
        finishingRoundId.current = null;
        setPhase({ name: "idle" });
      };

      const alreadyScored = scoredRoundId.current === roundId;
      const stillFinishing = finishingRoundId.current === roundId;
      if (alreadyScored || stillFinishing) {
        void goIdleAfterResult();
        return;
      }

      liveRoundId.current = null;
      scoredRoundId.current = null;
      finishingRoundId.current = null;
      endRound(roundId);
      setRounds((previous) =>
        previous.some((round) => round.roundId === roundId)
          ? previous.map((round) =>
              round.roundId === roundId
                ? { ...round, status: "voided", isLive: false, score: undefined }
                : round,
            )
          : [{ roundId, status: "voided", isLive: false }, ...previous].slice(0, 5),
      );
      setPhase({ name: "idle" });
    },
    [endRound, endpoint, refreshRounds],
  );

  const forgetRound = useCallback(
    async (roundId: string) => {
      setHistoryBusy(true);
      try {
        const response = await fetch(endpoint, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roundId, forget: true }),
        });
        if (response.ok) {
          setRounds((previous) => previous.filter((round) => round.roundId !== roundId));
        }
      } finally {
        setHistoryBusy(false);
      }
    },
    [endpoint],
  );

  const clearAll = useCallback(async () => {
    setHistoryBusy(true);
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearAll: true }),
      });
      if (response.ok) {
        setRounds((previous) => previous.filter((round) => round.isLive));
      }
    } finally {
      setHistoryBusy(false);
    }
  }, [endpoint]);

  const handleUntrustedOrigin = useCallback((origin: string) => {
    console.error(`❌ The game frame sent a message from an unexpected origin (${origin}). Ignored.`);
  }, []);

  if (phase.name === "playing") {
    return (
      // Reason: Velocity hangar needs full stage width; Circuit / Stack still drive height.
      <div className="flex min-h-[min(90vh,980px)] w-full max-w-[min(100%,88rem)] flex-col">
        <ProviderGameFrame
          launchUrl={phase.launchUrl}
          gameName={gameName}
          onFinished={() => void handleFinished(phase.roundId)}
          onExit={() => handleExit(phase.roundId)}
          onUntrustedOrigin={handleUntrustedOrigin}
        />
      </div>
    );
  }

  const launching = phase.name === "launching";
  const lobbyProps = {
    slug,
    gameName,
    scoreType,
    rounds,
    launching,
    refusal,
    historyBusy,
    onLaunch: () => void launch(),
    onForget: (roundId: string) => void forgetRound(roundId),
    onClearAll: () => void clearAll(),
  };

  return (
    <>
      {/* Reason: desktop and mobile are separate trees — share APIs only (mobile plan s2). */}
      <div className="hidden md:block">
        <DesktopPracticeLobby {...lobbyProps} />
      </div>
      <div className="block md:hidden">
        <MobilePracticeArea {...lobbyProps} />
      </div>
    </>
  );
}
