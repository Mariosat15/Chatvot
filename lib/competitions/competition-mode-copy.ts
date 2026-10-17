/**
 * Player-facing explanation for any value shown in the competition Mode box.
 *
 * The catalogue may supply title-specific modes, so unknown values receive an
 * honest generic explanation rather than a hard-coded per-game guess.
 */
export function describeCompetitionMode(value: string): string {
  const normalized = value.trim().toLowerCase().replaceAll("_", " ");

  if (
    normalized === "anytime" ||
    normalized === "play anytime" ||
    normalized === "independent"
  ) {
    return "Anytime means each player may start during the competition's open play window.";
  }

  if (
    normalized === "scheduled" ||
    normalized === "synchronised" ||
    normalized === "synchronized"
  ) {
    return "Scheduled means players share a set start time; joining late may leave less time to play.";
  }

  return `${value} is the game mode configured for this competition and controls how its rounds are played.`;
}
