import { formatGameScore } from "@/lib/utils/format-game-score";
import type { GameScoreType } from "@/lib/utils/format-game-score";
import type { PlayerRoundView } from "@/components/games/play-state";
import { MobileLobbyCard } from "@/components/competitions/lobby/mobile/MobileLobbyCard";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";

/**
 * Your rounds list (guide §17). Reads the play-state rounds already loaded for
 * the lobby — no new API.
 */

function statusLabel(status: string, isLive: boolean): string {
  if (isLive) return "In progress";
  switch (status) {
    case "completed":
      return "Completed";
    case "expired":
      return "Timed out";
    case "abandoned":
      return "Left early";
    case "voided":
      return "Voided";
    case "unresolved":
      return "Unresolved";
    default:
      return status || "Round";
  }
}

export function MobileGameLobbyRounds({
  rounds,
  scoreType,
  scoreLabel = "Score",
}: {
  rounds: PlayerRoundView[];
  scoreType?: GameScoreType;
  scoreLabel?: string;
}) {
  if (rounds.length === 0) {
    return (
      <MobileLobbyCard title="Your rounds" iconSrc={COMPETITION_ICON.gamepad}>
        <p className="text-center text-[13px] text-gray-400">
          No rounds yet. Start a round when you are ready to play.
        </p>
      </MobileLobbyCard>
    );
  }

  const ordered = [...rounds].sort(
    (a, b) => (b.attemptNumber ?? 0) - (a.attemptNumber ?? 0),
  );

  return (
    <MobileLobbyCard title="Your rounds" iconSrc={COMPETITION_ICON.gamepad}>
      <ul className="space-y-2">
        {ordered.map((round) => (
          <li
            key={round.roundId}
            className="flex min-h-11 min-w-0 items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white">
                Round {round.attemptNumber}
              </p>
              <p className="text-[12px] text-gray-400">
                {statusLabel(round.status, round.isLive)}
              </p>
            </div>
            <p className="shrink-0 text-[14px] font-bold tabular-nums text-cyan-200">
              {formatGameScore(round.score, scoreType)}
              <span className="ml-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                {scoreLabel}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </MobileLobbyCard>
  );
}
