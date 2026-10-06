"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChartNoAxesColumn,
  Gift,
  GraduationCap,
  Infinity as InfinityIcon,
  Loader2,
  Play,
  UserRound,
} from "lucide-react";
import { ProviderGameFrame } from "./ProviderGameFrame";
import { PracticeRecentList } from "./PracticeRecentList";
import { Button } from "@/components/ui/button";
import { neonButtonClasses } from "@/components/neon/Buttons";
import { NEON_PANEL_LIT } from "@/components/neon/tokens";
import type { GameScoreType } from "@/lib/utils/format-game-score";
import type { PracticeRoundView } from "./practice-state";

/**
 * The practice area for any provider game.
 *
 * The round is created by a CLICK (a POST), never by rendering. When the game posts
 * `finished`, the host pulls the score and KEEPS the iframe open so the player can read the
 * in-game result page (owner, 6 Oct 2026). Closing that screen (`exit`) returns to Start.
 * Leaving mid-round voids the attempt. Nothing here names a game.
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

const FEATURES = [
  { label: "Solo Mode", icon: UserRound, tone: "text-sky-300" },
  { label: "Free to Play", icon: Gift, tone: "text-violet-300" },
  { label: "No Ranking Impact", icon: ChartNoAxesColumn, tone: "text-cyan-300" },
  { label: "Unlimited Practice", icon: InfinityIcon, tone: "text-fuchsia-300" },
] as const;

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
      if (id && scoredRoundId.current !== id) endRound(id);
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
      // Keep the iframe up so Circuit / Stack / Velocity can show their own result screen.
      scoredRoundId.current = roundId;
      liveRoundId.current = null;
      try {
        const response = await fetch(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roundId }),
        });
        const data = await response.json();
        if (response.ok && data.success && data.round) {
          setRounds((previous) => {
            const rest = previous.filter((row) => row.roundId !== roundId);
            return [data.round as PracticeRoundView, ...rest].slice(0, 5);
          });
          return;
        }
      } catch {
        /* Fall through to a full refresh. */
      }
      await refreshRounds();
    },
    [endpoint, refreshRounds],
  );

  const handleExit = useCallback(
    (roundId: string) => {
      const alreadyScored = scoredRoundId.current === roundId;
      liveRoundId.current = null;
      scoredRoundId.current = null;
      if (!alreadyScored) {
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
      } else {
        void refreshRounds();
      }
      setPhase({ name: "idle" });
    },
    [endRound, refreshRounds],
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
      // Reason: Velocity never posts resize; a tall stage gives flex-1 room so the race is
      // not stuck in a 320px strip. Circuit and Stack still drive height via resize.
      <div className="flex min-h-[min(85vh,900px)] flex-col">
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

  return (
    <div className="space-y-5">
      <div className={`${NEON_PANEL_LIT} p-6 text-center sm:p-8`}>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/15 shadow-[0_0_24px_rgba(167,139,250,0.35)]">
          <GraduationCap className="h-7 w-7 text-violet-300" aria-hidden />
        </div>
        <h2 className="mt-4 text-xl font-bold text-white sm:text-2xl">
          {`Practice ${gameName}`}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-300">
          Only you play. It is free, it does not count towards any ranking, and there is no
          prize. Play as many practice rounds as you like.
        </p>
        <ul className="mx-auto mt-5 flex max-w-lg flex-wrap items-center justify-center gap-2">
          {FEATURES.map(({ label, icon: Icon, tone }) => (
            <li
              key={label}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-200"
            >
              <Icon className={`h-3.5 w-3.5 ${tone}`} aria-hidden />
              {label}
            </li>
          ))}
        </ul>
        {refusal ? (
          <p role="alert" className="mx-auto mt-3 max-w-md text-sm text-rose-300">
            {refusal}
          </p>
        ) : null}
        <Button
          type="button"
          onClick={launch}
          disabled={launching}
          className={`mx-auto mt-6 h-12 min-w-[14rem] gap-2 whitespace-nowrap rounded-xl px-8 ${neonButtonClasses("action")}`}
        >
          {launching ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Play className="h-4 w-4" aria-hidden />
          )}
          {launching ? "Starting…" : "Start practice"}
        </Button>
      </div>

      <PracticeRecentList
        rounds={rounds}
        scoreType={scoreType}
        onForget={forgetRound}
        onClearAll={clearAll}
        busy={historyBusy}
      />

      <p className="text-center text-sm">
        <Link
          href={`/games/${slug}`}
          className="inline-flex items-center gap-1.5 text-cyan-300 hover:text-cyan-200"
        >
          ← Back to the game page
        </Link>
      </p>
    </div>
  );
}
