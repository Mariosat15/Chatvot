"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GraduationCap, Loader2, Play } from "lucide-react";
import { ProviderGameFrame } from "./ProviderGameFrame";
import { Button } from "@/components/ui/button";
import { neonButtonClasses } from "@/components/neon/Buttons";
import { NEON_PANEL } from "@/components/neon/tokens";
import { formatGameScore, type GameScoreType } from "@/lib/utils/format-game-score";
import type { PracticeRoundView } from "./practice-state";

/**
 * The practice area for any provider game.
 *
 * The round is created by a CLICK (a POST), never by rendering. Practice keeps no result
 * (owner, 28 Sep 2026: "no need to calculate any results just exit"), so leaving or finishing
 * a round closes it (a DELETE) and returns straight to Start - there is nothing to wait for.
 * Nothing here names a game.
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

const STATUS_LABELS = new Map<string, string>([
  ["voided", "Ended"],
  ["completed", "Finished"],
  ["expired", "Time ran out"],
  ["abandoned", "Left early"],
]);

export function PracticeRoundHost({
  slug,
  gameName,
  scoreType,
  initialRounds,
}: PracticeRoundHostProps) {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [rounds, setRounds] = useState<PracticeRoundView[]>(initialRounds);
  const [refusal, setRefusal] = useState<string | null>(null);
  const liveRoundId = useRef<string | null>(null);
  const endpoint = `/api/games/${encodeURIComponent(slug)}/practice/rounds`;

  // Reason: `keepalive` lets the request finish when the player navigates away mid-round,
  // which is the one moment the component cannot wait for a response.
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

  useEffect(() => {
    // Reason: React's unmount cleanup does not run when the player closes the tab or
    // kills the app. `pagehide` (and `beforeunload` as a fallback) is what actually fires
    // then, and `keepalive` on the DELETE keeps the request alive after the document goes.
    // Without this, a practice round stays `launched` until an operator ends it by hand.
    const endIfLive = () => {
      if (liveRoundId.current) endRound(liveRoundId.current);
    };
    window.addEventListener("pagehide", endIfLive);
    window.addEventListener("beforeunload", endIfLive);
    return () => {
      window.removeEventListener("pagehide", endIfLive);
      window.removeEventListener("beforeunload", endIfLive);
      endIfLive();
    };
  }, [endRound]);

  const launch = useCallback(async () => {
    setRefusal(null);
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

  const leave = useCallback(
    (roundId: string) => {
      liveRoundId.current = null;
      endRound(roundId);
      setRounds((previous) =>
        previous.some((round) => round.roundId === roundId)
          ? previous
          : [{ roundId, status: "voided", isLive: false }, ...previous].slice(0, 5),
      );
      setPhase({ name: "idle" });
    },
    [endRound],
  );

  const handleUntrustedOrigin = useCallback((origin: string) => {
    console.error(`❌ The game frame sent a message from an unexpected origin (${origin}). Ignored.`);
  }, []);

  if (phase.name === "playing") {
    return (
      <ProviderGameFrame
        launchUrl={phase.launchUrl}
        gameName={gameName}
        onFinished={() => leave(phase.roundId)}
        onExit={() => leave(phase.roundId)}
        onUntrustedOrigin={handleUntrustedOrigin}
      />
    );
  }

  const launching = phase.name === "launching";

  return (
    <div className="space-y-5">
      <div className={`${NEON_PANEL} p-6 text-center`}>
        <GraduationCap className="mx-auto h-10 w-10 text-violet-400" aria-hidden />
        <h2 className="mt-3 text-lg font-bold text-white">{`Practise ${gameName}`}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
          Only you play. It is free, it does not count towards any ranking, and there is no
          prize. Play as many practice rounds as you like.
        </p>
        {refusal ? (
          <p role="alert" className="mx-auto mt-3 max-w-md text-sm text-rose-300">
            {refusal}
          </p>
        ) : null}
        <Button
          type="button"
          onClick={launch}
          disabled={launching}
          className={`mx-auto mt-5 h-12 min-w-[14rem] gap-2 whitespace-nowrap rounded-xl px-8 ${neonButtonClasses("action")}`}
        >
          {launching ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Play className="h-4 w-4" aria-hidden />
          )}
          {launching ? "Starting…" : "Start practice"}
        </Button>
      </div>

      {rounds.length > 0 ? (
        <div className={`${NEON_PANEL} p-5`}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Your recent practice rounds
          </h3>
          <ul className="mt-3 space-y-2">
            {rounds.map((round) => (
              <li key={round.roundId} className="flex items-center justify-between text-sm">
                <span className="text-gray-400">
                  {round.isLive ? "In progress" : (STATUS_LABELS.get(round.status) ?? round.status)}
                </span>
                <span className="font-mono text-white">
                  {formatGameScore(round.score, scoreType)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-center text-sm">
        <Link href={`/games/${slug}`} className="text-cyan-300 hover:text-cyan-200">
          Back to the game page
        </Link>
      </p>
    </div>
  );
}
