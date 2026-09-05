"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ProviderGameFrame } from "./ProviderGameFrame";
import { RoundPreflight } from "./RoundPreflight";
import { RoundResultPanel } from "./RoundResultPanel";
import type { PlayState, PlayerRoundView } from "./play-state";

/**
 * The player's side of a provider round: decide, launch, play, then find out what happened.
 *
 * WHY LAUNCHING IS A CLICK AND NEVER A PAGE LOAD. An attempt is consumed when the round is
 * CREATED, deliberately - otherwise a player abandons a bad round and retries free for ever
 * (chapter 03 section 1.3). So creation must never be a side effect of rendering: Next.js
 * prefetches `<Link>` targets on hover, browsers re-issue GETs, and a server component that
 * launched on render would burn a paying player's only attempt because they moused over a
 * button. The page renders a pre-flight panel; the POST happens on the click.
 *
 * WHY IT POLLS INSTEAD OF BELIEVING THE FRAME. `finished` arrives from the provider's iframe,
 * which is attacker-controlled by construction - the player has a developer console. The real
 * result comes from the provider's servers to the signed callback. So `finished` only means
 * "stop showing the game and go ask our own database", which is what `refresh()` does.
 *
 * WHY POLLING IS BOUNDED. A round can legitimately never resolve - that is the entire reason
 * the reconciliation net and the unresolved-round policies exist. An unbounded poll would spin
 * for ever against a contest that has already settled the player at zero. After the budget is
 * spent the player is told the result is still being confirmed, which is the truth, rather than
 * being left watching a spinner that means nothing.
 */

/** How long to wait for the signed result before telling the player it is still coming. */
const POLL_INTERVAL_MS = 3000;
const POLL_ATTEMPTS = 20;

type Phase =
  | { name: "preflight" }
  | { name: "launching" }
  | { name: "playing"; launchUrl: string; roundId: string; resumed: boolean }
  | { name: "confirming"; roundId: string }
  | { name: "settled"; round: PlayerRoundView | null };

interface ProviderRoundHostProps {
  competitionId: string;
  competitionName: string;
  gameName: string;
  initialState: PlayState;
}

export function ProviderRoundHost({
  competitionId,
  competitionName,
  gameName,
  initialState,
}: ProviderRoundHostProps) {
  const router = useRouter();
  const [state, setState] = useState<PlayState>(initialState);
  const [phase, setPhase] = useState<Phase>({ name: "preflight" });
  const [refusal, setRefusal] = useState<string | null>(null);

  // Reason for the ref: the poll loop is started from an effect and must be cancellable when
  // the component unmounts mid-round, or it keeps fetching against a page nobody is looking at.
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const readState = useCallback(async (): Promise<PlayState | null> => {
    try {
      const response = await fetch(`/api/competitions/${competitionId}/rounds`);
      const data = await response.json();
      if (!response.ok || !data.success) return null;
      return data as PlayState;
    } catch {
      return null;
    }
  }, [competitionId]);

  const launch = useCallback(async () => {
    setRefusal(null);
    setPhase({ name: "launching" });

    try {
      const response = await fetch(`/api/competitions/${competitionId}/rounds`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        // The refusal codes are distinguished on purpose and the player sees the specific
        // message: "you have used all your attempts" is a completely normal end state, not an
        // error, and showing "something went wrong" for it would be a lie.
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

      // Reason the wording differs: a double-click must not announce a new attempt. The route
      // returns `resumed` precisely so the UI can tell the two apart.
      if (data.resumed) {
        toast.info("Reopening the round you already started.");
      }
    } catch {
      setRefusal("Something went wrong. Please contact support.");
      setPhase({ name: "preflight" });
    }
  }, [competitionId, readState]);

  /**
   * Ask the server, repeatedly, whether the signed result has landed.
   *
   * Stops on the first non-live status, which is the answer. Note `voided` and `abandoned` are
   * answers too - not failures - and the result panel says what each means for the player.
   */
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
            // Reason: the contest page shows the leaderboard and the player's standing, both
            // of which have just changed. Without this they see a stale position.
            router.refresh();
            return;
          }
        }

        if (polls >= POLL_ATTEMPTS) {
          // Truthful rather than reassuring: the round genuinely has not resolved yet, and the
          // reconciliation net owns it from here under the contest's unresolved-round policy.
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
    setPhase({ name: "confirming", roundId });
    confirmResult(roundId);
  }, [phase, confirmResult]);

  const handleExit = useCallback(() => {
    // Reason it goes to the result panel rather than straight back to the contest: leaving does
    // NOT return the attempt, and a player who assumes it does will be surprised by their own
    // score. The round stays live until the provider reports or the reconciliation net resolves
    // it, so the honest screen to show is the one that says the result is still coming.
    if (phase.name === "playing") {
      setPhase({ name: "confirming", roundId: phase.roundId });
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
      <RoundResultPanel
        competitionId={competitionId}
        competitionName={competitionName}
        confirming={phase.name === "confirming"}
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
