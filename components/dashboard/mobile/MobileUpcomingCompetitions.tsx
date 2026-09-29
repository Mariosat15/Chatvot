"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Users, Zap } from "lucide-react";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import { formatVolts } from "@/lib/utils/format-volts";
import MobileSection, { MOBILE_CARD, MOBILE_CAROUSEL } from "./MobileSection";

interface ContestCard {
  id: string;
  name: string;
  /** The moment the countdown counts to. */
  target: Date;
  targetLabel: "Starts in" | "Ends in";
  players: number | null;
  entryFee: number;
  action: "Join" | "Open";
}

interface Suggestion {
  competitionId: string;
  name: string;
  entryFee: number;
  startTime: string;
}

function countdown(target: Date, now: number | null): string {
  if (now == null) return "-";
  const ms = target.getTime() - now;
  if (!Number.isFinite(ms)) return "-";
  if (ms <= 0) return "Now";
  const mins = Math.floor(ms / 60_000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(m, 1)}m`;
}

/**
 * Upcoming competitions — one card per swipe (spec s13).
 *
 * Contests the player is already in come first ("Open"), then open contests
 * suggested from the games they play ("Join"), from the same
 * `/api/games/suggestions` the desktop Games tab reads.
 */
export default function MobileUpcomingCompetitions() {
  const { data, viewport } = useDashboardOverview();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  // Reason: null on the server render so the countdown cannot cause a
  // hydration mismatch; the first effect tick fills it in.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Reason: CSS-hidden on desktop but still mounted — only fetch on phones.
    if (viewport !== "mobile") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/games/suggestions");
        const json = await res.json();
        if (!cancelled && res.ok && json.success && Array.isArray(json.contests)) {
          setSuggestions(json.contests);
        }
      } catch {
        // Additive chrome — entered contests still render without it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewport]);

  const entered: ContestCard[] = [
    ...data.competitions.active,
    ...data.competitions.upcoming,
  ].map((c) => {
    const isActive = c.status === "active";
    return {
      id: c.id,
      name: c.name,
      target: new Date(isActive ? c.endTime : c.startTime),
      targetLabel: isActive ? "Ends in" : "Starts in",
      players: Number.isFinite(c.totalParticipants) ? c.totalParticipants : null,
      entryFee: c.entryFee,
      action: "Open",
    };
  });
  const enteredIds = new Set(entered.map((c) => c.id));
  const joinable: ContestCard[] = suggestions
    .filter((s) => !enteredIds.has(s.competitionId))
    .map((s) => ({
      id: s.competitionId,
      name: s.name,
      target: new Date(s.startTime),
      targetLabel: "Starts in",
      players: null,
      entryFee: s.entryFee,
      action: "Join",
    }));
  const cards = [...entered, ...joinable].slice(0, 8);

  return (
    <MobileSection title="Upcoming competitions" href="/competitions">
      {cards.length === 0 ? (
        <div className={`${MOBILE_CARD} flex items-center justify-between gap-3 p-4`}>
          <p className="text-sm text-gray-400">No competitions lined up yet.</p>
          <Link
            href="/competitions"
            className="inline-flex h-11 shrink-0 items-center rounded-full border border-cyan-400/50 px-4 text-xs font-bold text-cyan-200"
          >
            Browse
          </Link>
        </div>
      ) : (
        <ul className={MOBILE_CAROUSEL}>
          {cards.map((c) => (
            <li key={c.id} className="w-[86%] shrink-0 snap-start">
              <div className={`${MOBILE_CARD} border-amber-400/35 p-4`}>
                <p className="truncate text-base font-bold text-white">{c.name}</p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <dt className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-gray-500">
                      <Users className="h-3 w-3" aria-hidden /> Players
                    </dt>
                    <dd className="mt-0.5 text-sm font-bold tabular-nums text-gray-100">
                      {c.players ?? "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-gray-500">
                      <Clock className="h-3 w-3" aria-hidden /> {c.targetLabel}
                    </dt>
                    <dd className="mt-0.5 text-sm font-bold tabular-nums text-cyan-200">
                      {countdown(c.target, now)}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-gray-500">
                      <Zap className="h-3 w-3" aria-hidden /> Entry
                    </dt>
                    <dd className="mt-0.5 text-sm font-bold tabular-nums text-amber-200">
                      {c.entryFee > 0 ? formatVolts(c.entryFee) : "Free"}
                    </dd>
                  </div>
                </dl>
                <Link
                  href={`/competitions/${c.id}`}
                  className={`mt-3 flex h-11 w-full items-center justify-center rounded-full text-sm font-bold ${
                    c.action === "Join"
                      ? "bg-amber-400 text-[#1A1003]"
                      : "border border-cyan-400/50 text-cyan-200"
                  }`}
                >
                  {c.action === "Join" ? "JOIN" : "Open"}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </MobileSection>
  );
}
