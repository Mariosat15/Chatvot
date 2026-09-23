"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gamepad2, Loader2 } from "lucide-react";
import { formatVolts } from "@/lib/utils/format-volts";

interface Suggestion {
  gameKey: string;
  competitionId: string;
  name: string;
  entryFee: number;
  startTime: string;
  status: string;
}

/**
 * Contests suggested from games the player has actually played (X11.5).
 * Never invites anyone - suggestions only (X14).
 */
export default function GameSuggestionsCard({
  creditSymbol = "⚡",
}: {
  creditSymbol?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [contests, setContests] = useState<Suggestion[]>([]);
  const [interests, setInterests] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/games/suggestions");
        const data = await res.json();
        if (cancelled || !res.ok || !data.success) return;
        setContests(Array.isArray(data.contests) ? data.contests : []);
        setInterests(Array.isArray(data.interests) ? data.interests : []);
      } catch {
        // Silent - suggestions are additive chrome, not a required surface.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (contests.length === 0) {
    if (interests.length === 0) return null;
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-200">
          <Gamepad2 className="h-4 w-4 text-cyan-400" />
          Based on games you play
        </div>
        <p className="text-xs text-gray-500">
          No open contests for your games right now. Check back soon or browse
          all competitions.
        </p>
        <Link
          href="/competitions"
          className="mt-2 inline-block text-xs text-cyan-400 hover:underline"
        >
          Browse competitions
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-200">
        <Gamepad2 className="h-4 w-4 text-cyan-400" />
        Suggested for you
      </div>
      <ul className="space-y-2">
        {contests.map((c) => (
          <li key={c.competitionId}>
            <Link
              href={`/competitions/${c.competitionId}`}
              className="flex items-center justify-between rounded-lg border border-gray-800/80 bg-gray-950/40 px-3 py-2 text-sm hover:border-cyan-800/60"
            >
              <span className="truncate text-gray-100">{c.name}</span>
              <span className="ml-2 shrink-0 text-xs text-gray-400">
                {formatVolts(c.entryFee, { symbol: creditSymbol })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
