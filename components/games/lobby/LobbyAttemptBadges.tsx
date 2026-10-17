import { describeAttempts } from "@/components/games/preflight-parts";
import type { PlayState } from "@/components/games/play-state";
import { LobbyRuleBadge } from "./LobbyCenterStage";

/** The attempt and start-time pills under the game name on the centre stage. */
export function LobbyAttemptBadges({
  state,
  attemptsPolicy,
  playMode,
  modeLabel,
}: {
  state: PlayState | null;
  attemptsPolicy: string;
  playMode: "anytime" | "scheduled";
  modeLabel: string;
}) {
  return (
    <>
      {state ? (
        <LobbyRuleBadge tone="warn">{describeAttempts(state)}</LobbyRuleBadge>
      ) : attemptsPolicy === "single" ? (
        <LobbyRuleBadge tone="warn">You have one attempt.</LobbyRuleBadge>
      ) : null}
      <LobbyRuleBadge>
        {playMode === "anytime" ? "Jump in whenever you're ready! 🎮" : modeLabel}
      </LobbyRuleBadge>
    </>
  );
}
