"use client";

/**
 * Cross-game standing on the profile (X7 step 3). Reads props already loaded
 * from UserGameStats — does not fetch or recompute.
 */

import type { ReactNode } from "react";
import { Trophy, Swords, Medal, Sparkles } from "lucide-react";
import type { PlayerGameProfile } from "@/lib/services/games/player-game-stats.service";

interface CrossGameStandingProps {
  profile: PlayerGameProfile;
  /** Lifetime prizes from the wallet — credits, not trading P&L. */
  totalWinnings: number;
  creditSymbol: string;
  creditDecimals: number;
  level: number;
  xp: number;
  title: string;
}

export default function CrossGameStanding({
  profile,
  totalWinnings,
  creditSymbol,
  creditDecimals,
  level,
  xp,
  title,
}: CrossGameStandingProps) {
  const overall = profile.overall ?? {
    contestsEntered: 0,
    contestsCompleted: 0,
    wins: 0,
    podiums: 0,
    totalPoints: 0,
    seasonPoints: 0,
    bestRank: 0,
    currentStreak: 0,
  };

  return (
    <section className="rounded-xl border border-border/60 bg-card/40 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Cross-game standing
          </p>
          <p className="text-3xl font-semibold tabular-nums mt-1">
            {Math.round(overall.totalPoints)}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              normalised points
            </span>
          </p>
        </div>
        <p className="text-sm text-muted-foreground max-w-md">
          {profile.startsFromCaption}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Mini
          icon={<Swords className="w-4 h-4" />}
          label="Contests entered"
          value={String(overall.contestsEntered)}
        />
        <Mini
          icon={<Trophy className="w-4 h-4" />}
          label="Wins"
          value={String(overall.wins)}
        />
        <Mini
          icon={<Medal className="w-4 h-4" />}
          label="Podiums"
          value={String(overall.podiums)}
        />
        <Mini
          icon={<Sparkles className="w-4 h-4" />}
          label="Total winnings"
          value={`${totalWinnings.toFixed(creditDecimals)} ${creditSymbol}`}
        />
        <Mini
          icon={<Trophy className="w-4 h-4" />}
          label="Level"
          value={`${level}`}
        />
        <Mini
          icon={<Sparkles className="w-4 h-4" />}
          label="XP"
          value={`${xp}`}
          sub={title}
        />
      </div>

      {profile.perGame.length > 0 ? (
        <div className="space-y-2 pt-2 border-t border-border/40">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            By game
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {profile.perGame.map((game) => (
              <div
                key={game.gameKey}
                className="rounded-lg border border-border/50 bg-background/40 px-3 py-2.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium truncate">{game.label}</p>
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {Math.round(game.totalPoints)} pts
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {game.wins} wins · {game.contestsEntered} entered
                  {!game.isTrading
                    ? ` · rating ${Math.round(game.rating)}`
                    : " · trading P&L stays in Trading below"}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground border-t border-border/40 pt-3">
          No per-game rows yet. Finish a contest after cross-game scoring began
          and it will show here. Your trading history is unchanged below.
        </p>
      )}
    </section>
  );
}

function Mini({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg bg-background/50 px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 font-semibold tabular-nums text-sm sm:text-base">
        {value}
      </p>
      {sub ? (
        <p className="text-xs text-muted-foreground truncate">{sub}</p>
      ) : null}
    </div>
  );
}
