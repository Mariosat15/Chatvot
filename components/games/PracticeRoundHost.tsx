"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GraduationCap, Loader2, Play, RotateCcw } from "lucide-react";
import { ProviderGameFrame } from "./ProviderGameFrame";
import { neonButtonClasses } from "@/components/neon/Buttons";
import { NEON_PANEL } from "@/components/neon/tokens";
import { formatGameScore, type GameScoreType } from "@/lib/utils/format-game-score";
import { humanizeMetric } from "@/lib/utils/humanize-metric";
import type { PracticeRoundView } from "./practice-state";

/**
 * The practice area for any provider game - the practice sibling of `ChallengeRoundHost`.
 *
 * Same three rules as the contest hosts: the round is created by a CLICK (a POST), never by
 * rendering; the result is read back from our own server rather than trusted from the frame's
 * message; and that read is bounded. Nothing here names a game.
 */

const POLL_INTERVAL_MS = 3000;
const POLL_ATTEMPTS = 20;

type Phase =
  | { name: "idle" }
  | { name: "launching" }
  | { name: "playing"; launchUrl: string; roundId: string }
  | { name: "confirming"; roundId: string }
  | { name: "done"; round: PracticeRoundView | null };

interface PracticeRoundHostProps {
  slug: string;
  gameName: string;
  scoreType?: GameScoreType;
  initialRounds: PracticeRoundView[];
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
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endpoint = `/api/games/${encodeURIComponent(slug)}/practice/rounds`;

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const readRounds = useCallback(async (): Promise<PracticeRoundView[] | null> => {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) return null;
      return data.rounds as PracticeRoundView[];
    } catch {
      return null;
    }
  }, [endpoint]);

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
      setPhase({ name: "playing", launchUrl: data.launchUrl, roundId: data.roundId });
    } catch {
      setRefusal("Something went wrong. Please contact support.");
      setPhase({ name: "idle" });
    }
  }, [endpoint]);

  const confirm = useCallback(
    (roundId: string) => {
      setPhase({ name: "confirming", roundId });
      let polls = 0;
      const tick = async () => {
        polls += 1;
        const latest = await readRounds();
        if (latest) {
          setRounds(latest);
          const round = latest.find((r) => r.roundId === roundId);
          if (round && !round.isLive) {
            setPhase({ name: "done", round });
            return;
          }
        }
        if (polls >= POLL_ATTEMPTS) {
          setPhase({ name: "done", round: null });
          return;
        }
        pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
      };
      void tick();
    },
    [readRounds],
  );

  const handleUntrustedOrigin = useCallback((origin: string) => {
    console.error(`❌ The game frame sent a message from an unexpected origin (${origin}). Ignored.`);
  }, []);

  if (phase.name === "playing") {
    return (
      <ProviderGameFrame
        launchUrl={phase.launchUrl}
        gameName={gameName}
        onFinished={() => confirm(phase.roundId)}
        onExit={() => confirm(phase.roundId)}
        onUntrustedOrigin={handleUntrustedOrigin}
      />
    );
  }

  const launching = phase.name === "launching";

  return (
    <div className="space-y-5">
      <div className={`${NEON_PANEL} p-6 text-center`}>
        <GraduationCap className="mx-auto h-10 w-10 text-violet-400" aria-hidden />
        <h2 className="mt-3 text-lg font-bold text-white">
          {phase.name === "confirming"
            ? "Checking your practice result…"
            : phase.name === "done"
              ? "Practice round finished"
              : `Practise ${gameName}`}
        </h2>

        {phase.name === "confirming" ? (
          <Loader2 className="mx-auto mt-4 h-6 w-6 animate-spin text-cyan-300" aria-hidden />
        ) : null}

        {phase.name === "done" ? <PracticeResult round={phase.round} scoreType={scoreType} /> : null}

        {phase.name !== "confirming" ? (
          <>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
              Only you play. It is free, it does not count towards any ranking, and there is no
              prize. Play as many practice rounds as you like.
            </p>
            {refusal ? (
              <p role="alert" className="mx-auto mt-3 max-w-md text-sm text-rose-300">
                {refusal}
              </p>
            ) : null}
            <button
              type="button"
              onClick={launch}
              disabled={launching}
              className={`mx-auto mt-5 max-w-xs ${neonButtonClasses("action")}`}
            >
              {launching ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : phase.name === "done" ? (
                <RotateCcw className="h-4 w-4" aria-hidden />
              ) : (
                <Play className="h-4 w-4" aria-hidden />
              )}
              {launching ? "Starting…" : phase.name === "done" ? "Practise again" : "Start practice"}
            </button>
          </>
        ) : null}
      </div>

      {rounds.length > 0 ? (
        <div className={`${NEON_PANEL} p-5`}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Your recent practice rounds
          </h3>
          <ul className="mt-3 space-y-2">
            {rounds.map((round) => (
              <li key={round.roundId} className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{round.isLive ? "In progress" : round.status}</span>
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

function PracticeResult({
  round,
  scoreType,
}: {
  round: PracticeRoundView | null;
  scoreType?: GameScoreType;
}) {
  if (!round) {
    return (
      <p className="mx-auto mt-3 max-w-md text-sm text-gray-400">
        The game has not reported this round yet. It will appear under your recent rounds when
        it does.
      </p>
    );
  }
  const breakdown = Object.entries(round.scoreBreakdown ?? {}).filter(
    ([, value]) => value !== null && value !== undefined,
  );
  return (
    <div className="mt-4 space-y-3">
      <p className="text-3xl font-bold text-cyan-300">{formatGameScore(round.score, scoreType)}</p>
      {breakdown.length > 0 ? (
        <dl className="mx-auto grid max-w-sm grid-cols-2 gap-x-6 gap-y-1 text-left text-sm">
          {breakdown.map(([key, value]) => {
            const metric = humanizeMetric(key, value);
            return (
              <div key={key} className="contents">
                <dt className="text-gray-400">{metric.label}</dt>
                <dd className="text-right text-white">{metric.value}</dd>
              </div>
            );
          })}
        </dl>
      ) : null}
    </div>
  );
}
