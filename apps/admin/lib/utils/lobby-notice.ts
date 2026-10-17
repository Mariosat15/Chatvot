/**
 * The read-only "lobby opens N minutes before the start" sentence on the wizards'
 * schedule step, for an everyone-at-once (scheduled) game contest.
 *
 * Reason: owner, 2 Oct 2026. The lobby length lives on the GAME and is copied onto the
 * competition when it is created, and neither wizard said so - a Game Master saw a
 * one-minute lobby and could not tell where the minute came from. Informational only: the
 * value is changed on the game's own settings, never per contest.
 *
 * Model-free and client-reachable (R58). Mirrored byte-for-byte into
 * `apps/admin/lib/utils/`; `check:mirrors` compares models only, so a text-comparison test
 * holds the two together.
 */

/** "5 minutes", "1 minute", "90 seconds". Whole minutes read as minutes. */
export function formatLobbyLead(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s % 60 === 0) {
    const m = s / 60;
    return `${m} ${m === 1 ? "minute" : "minutes"}`;
  }
  return `${s} ${s === 1 ? "second" : "seconds"}`;
}

/**
 * The sentence, or `null` when there is nothing true to say: any shape other than
 * `scheduled` has no lobby, and an absent or non-finite value is not guessed at.
 */
export function lobbyNotice(
  playMode: string | undefined,
  lobbySeconds: number | undefined,
): string | null {
  if (playMode !== "scheduled") return null;
  if (typeof lobbySeconds !== "number" || !Number.isFinite(lobbySeconds)) return null;
  return `Lobby opens ${formatLobbyLead(lobbySeconds)} before the start. This is set on the game and copied when you create the competition.`;
}
