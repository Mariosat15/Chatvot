import { CalendarClock, Swords, Trophy } from "lucide-react";
import { NeonNote, NeonPanel } from "@/components/neon/Cards";
import { NeonButton } from "@/components/neon/Buttons";
import { NEON_HEADING } from "@/components/neon/tokens";
import type { BrowsableGame } from "@/lib/services/games/player-catalogue.service";

/**
 * Designed empty state for a game page with no live/upcoming contests.
 *
 * Chapter 16: never a blank page. Offer challenges when the title supports 1v1, and always
 * a path back to the competitions hub / catalogue.
 */

export function GameEmptyContests({ game }: { game: BrowsableGame }) {
  const canChallenge =
    game.kind === "trading" || game.supportsOneVsOne === true;

  return (
    <NeonPanel className="space-y-4 p-6">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
        <div className="space-y-1">
          <h2 className={`${NEON_HEADING} text-lg`}>No contests open yet</h2>
          <p className="text-sm text-gray-400">
            There are no live or upcoming contests for {game.displayName} right
            now. Check back soon, or browse everything that is starting across
            the platform.
          </p>
        </div>
      </div>
      <NeonNote>
        Contests for this game appear here as soon as an operator publishes one.
        Existing lobbies always stay reachable from Competitions.
      </NeonNote>
      <div className="grid gap-3 sm:grid-cols-2">
        <NeonButton
          href="/competitions"
          tone="outline"
          icon={Trophy}
          label="Browse all contests"
          sublabel="What starts soonest"
        />
        {canChallenge ? (
          <NeonButton
            href="/challenges"
            tone="quiet"
            icon={Swords}
            label="1v1 Challenges"
            sublabel={
              game.kind === "provider"
                ? `Challenge someone at ${game.displayName}`
                : "Challenge another trader"
            }
          />
        ) : null}
      </div>
    </NeonPanel>
  );
}
