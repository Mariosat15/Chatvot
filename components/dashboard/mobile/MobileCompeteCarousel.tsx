"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { Loader2, Shield, Swords, Trophy } from "lucide-react";
import ProfileImage from "@/components/ui/ProfileImage";
import ProfileCard from "@/components/profile/ProfileCard";
import ChallengeCreateDialog from "@/components/challenges/ChallengeCreateDialog";
import {
  mapMatches,
  type CompeteMatch,
} from "@/components/dashboard/overview/OverviewCompete";
import { OVERVIEW_COMPETE_MATCH_LIMIT } from "@/lib/services/games/overview-types";
import { OVERVIEW_COMPETE_ART } from "@/lib/services/games/overview-assets";
import { useOverviewLive } from "@/hooks/useDashboardOverview";
import { PERFORMANCE_INTERVALS } from "@/lib/utils/performance";
import MobileSection, { MOBILE_CARD, MOBILE_CAROUSEL } from "./MobileSection";

/**
 * Compete — one opponent card per swipe with a large Challenge button (spec s14).
 *
 * Reason: same endpoints and `mapMatches` as the desktop strip, but gated on
 * `useOverviewLive("mobile")` — the desktop tree is CSS-hidden yet mounted,
 * so each tree polls only on its own viewport and never both at once.
 */
export default function MobileCompeteCarousel() {
  const live = useOverviewLive("mobile");
  const [matches, setMatches] = useState<CompeteMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [challengeTarget, setChallengeTarget] = useState<{
    userId: string;
    username: string;
  } | null>(null);
  const [profileTarget, setProfileTarget] = useState<CompeteMatch | null>(null);

  const idsKey = useMemo(() => matches.map((m) => m.userId).join(","), [matches]);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/matchmaking?action=ranked&limit=${OVERVIEW_COMPETE_MATCH_LIMIT}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error("matchmaking failed");
        const json = await res.json();
        if (!cancelled) setMatches(mapMatches(json));
      } catch {
        if (!cancelled) setMatches([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [live]);

  useEffect(() => {
    if (!live || !idsKey) return;
    let cancelled = false;
    const t = setInterval(async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(
          `/api/user/presence?userIds=${encodeURIComponent(idsKey)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          statuses?: Array<{ userId: string; isOnline: boolean }>;
        };
        const map = new Map((json.statuses ?? []).map((s) => [s.userId, s.isOnline]));
        if (!cancelled && map.size > 0) {
          setMatches((prev) =>
            prev.map((m) =>
              map.has(m.userId) ? { ...m, isOnline: Boolean(map.get(m.userId)) } : m,
            ),
          );
        }
      } catch {
        // keep last known presence
      }
    }, PERFORMANCE_INTERVALS.DASHBOARD_REFRESH);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [live, idsKey]);

  return (
    <MobileSection
      title="Compete"
      href="/leaderboard?board=trading&view=cards"
      linkLabel="Matching cards"
    >
      {loading ? (
        <div className={`${MOBILE_CARD} flex items-center justify-center gap-2 p-6 text-sm text-gray-400`}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Finding matches…
        </div>
      ) : matches.length === 0 ? (
        <div className={`${MOBILE_CARD} p-4 text-center text-sm text-gray-400`}>
          No challenge matches yet. Play contests to build a standing.
        </div>
      ) : (
        <ul className={MOBILE_CAROUSEL}>
          {matches.map((m) => (
            <li key={m.userId} className="w-[86%] shrink-0 snap-start">
              <article className={`${MOBILE_CARD} flex flex-col gap-3 border-cyan-400/45 p-4`}>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setProfileTarget(m)}
                    className="relative h-14 w-14 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                    aria-label={`Open ${m.username}'s card`}
                  >
                    <div className="absolute inset-[10%] overflow-hidden rounded-full bg-[#0A1528]">
                      <ProfileImage
                        src={m.profileImage}
                        alt={m.username}
                        fallbackLetter={(m.username || "?").charAt(0).toUpperCase()}
                        size="md"
                        className="!h-full !w-full"
                      />
                    </div>
                    <Image
                      src={OVERVIEW_COMPETE_ART.avatarRing}
                      alt=""
                      fill
                      sizes="56px"
                      className="pointer-events-none object-contain"
                    />
                    <span
                      className={`absolute bottom-[2px] right-[2px] h-2.5 w-2.5 rounded-full border border-[#070E1C] ${
                        m.isOnline ? "bg-emerald-400" : "bg-gray-500"
                      }`}
                      aria-label={m.isOnline ? "Online" : "Offline"}
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setProfileTarget(m)}
                      className="block min-h-[28px] max-w-full truncate text-left text-base font-semibold text-gray-100"
                    >
                      {m.username}
                    </button>
                    <p className="text-[11px] font-semibold text-cyan-300/90">
                      Lv. {m.profileLevel}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums text-cyan-300">
                      {m.matchScore}%
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/85">
                      Match
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <Stat icon={<Shield className="mx-auto h-3 w-3 text-cyan-300" aria-hidden />} value={m.overallScore} label="Score" />
                  <Stat
                    icon={<Trophy className="mx-auto h-3 w-3 text-amber-300" aria-hidden />}
                    value={`${m.competitionsWon}/${m.competitionsEntered}`}
                    label="Competitions"
                  />
                  <Stat
                    icon={<Swords className="mx-auto h-3 w-3 text-violet-300" aria-hidden />}
                    value={`${m.challengesWon}/${m.challengesEntered}`}
                    label="1v1"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setChallengeTarget({ userId: m.userId, username: m.username })}
                  className="relative h-14 w-full active:scale-95 motion-reduce:active:scale-100"
                  aria-label={`Challenge ${m.username}`}
                >
                  <Image
                    src={OVERVIEW_COMPETE_ART.challenge}
                    alt=""
                    fill
                    sizes="86vw"
                    className="object-contain"
                  />
                  <span className="sr-only">Challenge</span>
                </button>
              </article>
            </li>
          ))}
        </ul>
      )}

      <ChallengeCreateDialog
        open={!!challengeTarget}
        onOpenChange={(open) => {
          if (!open) setChallengeTarget(null);
        }}
        challengedUser={challengeTarget}
      />

      {profileTarget && (
        <ProfileCard
          show={!!profileTarget}
          userId={profileTarget.userId}
          username={profileTarget.username}
          stats={{
            winRate: profileTarget.winRate,
            totalTrades: profileTarget.totalTrades,
            totalPnl: profileTarget.totalPnl,
            competitionsEntered: profileTarget.competitionsEntered,
            competitionsWon: profileTarget.competitionsWon,
            challengesEntered: profileTarget.challengesEntered,
            challengesWon: profileTarget.challengesWon,
            totalBadges: profileTarget.totalBadges,
            overallScore: profileTarget.overallScore,
            userTitle: profileTarget.userTitle,
            userTitleIcon: profileTarget.userTitleIcon,
            userTitleColor: profileTarget.userTitleColor,
          }}
          showChallengeButton
          onChallenge={() => {
            setChallengeTarget({ userId: profileTarget.userId, username: profileTarget.username });
            setProfileTarget(null);
          }}
          onClose={() => setProfileTarget(null)}
        />
      )}
    </MobileSection>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: string }) {
  return (
    <div className="rounded-lg border border-cyan-400/20 bg-[#07101f]/90 px-1.5 py-1.5">
      {icon}
      <p className="mt-0.5 truncate text-sm font-bold tabular-nums text-gray-100">{value}</p>
      <span className="block truncate text-[9px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </span>
    </div>
  );
}
