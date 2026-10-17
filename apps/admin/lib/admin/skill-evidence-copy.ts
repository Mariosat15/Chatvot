/**
 * Plain-English wording for the Skill Evidence report, shared by the admin screen and the
 * PDF sent to regulators.
 *
 * One definition, because the two must say the same thing about the same figure. A screen
 * calling 0.24 "a weak sign of skill" while the PDF calls it "moderate" is an inconsistency
 * an opposing expert would quote.
 *
 * Model-free and client-reachable (R58): it imports types only.
 *
 * The verdicts are fixed rules, never AI output. The AI writes the narrative around them,
 * but a figure's verdict must be reproducible by anyone holding the same number.
 */

import type { SkillEvidence } from "../services/games/skill-evidence-stats";

export type Tone = "skill" | "weak" | "chance" | "inverse" | "none";

export interface Verdict {
  label: string;
  tone: Tone;
}

export interface Nouns {
  player: string;
  players: string;
  contests: string;
}

const DEFAULT_NOUNS: Nouns = { player: "player", players: "players", contests: "contests" };

/** The same thresholds the screen has always used, now with words a novice can read. */
export function correlationVerdict(r: number | null): Verdict {
  if (r === null) return { label: "Not enough data yet", tone: "none" };
  if (r >= 0.3) return { label: "Clear sign of skill", tone: "skill" };
  if (r >= 0.1) return { label: "Weak sign of skill", tone: "weak" };
  if (r > -0.1) return { label: "Looks like luck", tone: "chance" };
  return { label: "Opposite of skill - investigate", tone: "inverse" };
}

/**
 * Do the same people win more often than luck would allow? Compares observed repeat
 * winners with the number a lottery would produce for the same entries.
 */
export function spreadVerdict(w: SkillEvidence["winners"]): Verdict {
  if (w.wins < 2) return { label: "Not enough data yet", tone: "none" };
  const expected = w.expectedRepeatWinnersByChance;
  // Reason: checked first. One player taking every win gives a single repeat winner,
  // which the repeat count alone would read as "less than luck" - the opposite of true.
  if (w.wins >= 5 && w.distinctWinners <= w.expectedDistinctWinnersByChance * 0.5) {
    return { label: "Wins concentrate in fewer players than luck would give", tone: "skill" };
  }
  if (w.repeatWinners >= expected * 1.5 + 1) {
    return { label: "Winners repeat more than luck would give", tone: "skill" };
  }
  if (w.repeatWinners <= expected * 0.5 - 1) {
    return { label: "Winners repeat less than luck would give", tone: "inverse" };
  }
  return { label: "About what luck would give", tone: "chance" };
}

export const pct = (v: number | null) => (v === null ? "-" : `${Math.round(v * 100)}%`);
export const corr = (v: number | null) => (v === null ? "-" : v.toFixed(2));

/** The three cards, each with a question heading, a one-line reading and a "?" tooltip. */
export function evidenceCards(e: SkillEvidence, nouns: Nouns = DEFAULT_NOUNS) {
  return [
    {
      id: "stability",
      question: `Do good ${nouns.players} stay good?`,
      technical: "Score stability (repeat players)",
      value: corr(e.stability.correlation),
      verdict: correlationVerdict(e.stability.correlation),
      reading:
        e.stability.correlation === null
          ? `Needs ${nouns.players} who have played at least twice.`
          : `Compares where each ${nouns.player} finished with where they finished next time (${e.stability.pairs} comparisons). 0 = pure luck, 1 = same order every time.`,
      help:
        `If skill decides results, a ${nouns.player} who finishes near the top tends to finish near the top again. ` +
        "We pair each result with the same person's next result and measure how closely they match (a correlation). " +
        "0 means no link at all, which is what pure luck gives. Above 0.3 is a clear sign of skill.",
    },
    {
      id: "experience",
      question: "Does practice help?",
      technical: "Experience vs winning",
      value: corr(e.experience.correlation),
      verdict: correlationVerdict(e.experience.correlation),
      reading:
        e.experience.correlation === null
          ? "Needs more results before it can be measured."
          : `Checks whether ${nouns.players} with more ${nouns.contests} behind them finish higher. 0 = experience makes no difference.`,
      help:
        "In a game of skill, people improve with practice, so experienced players should finish higher than newcomers. " +
        "We rank every entry by how many contests that person had already played and compare it with where they finished. " +
        "In a game of luck, experience does not matter and the figure stays near 0.",
    },
    {
      id: "spread",
      question: "Do the same people keep winning?",
      technical: "Spread of winners",
      value: `${e.winners.distinctWinners} / ${e.winners.wins}`,
      verdict: spreadVerdict(e.winners),
      reading:
        e.winners.wins === 0
          ? "No wins recorded yet."
          : `${e.winners.wins} wins shared by ${e.winners.distinctWinners} ${nouns.players}. ${e.winners.repeatWinners} won more than once; pure luck would give about ${e.winners.expectedRepeatWinnersByChance} repeat winners and about ${e.winners.expectedDistinctWinnersByChance} different winners.`,
      help:
        "If results were a lottery, wins would be shared out by chance. We work out how many people would win twice or more " +
        "by luck alone, given the same contests and the same number of entrants, and compare it with what actually happened. " +
        "Noticeably more repeat winners than luck predicts points to skill.",
    },
  ];
}

export const TABLE_HELP = {
  experience: "How many contests the person had already played when they entered this one.",
  entries: "How many entries fall into this group.",
  meanPosition:
    "Average finishing place, as a percentage: 100% = always first, 0% = always last, 50% = what luck gives.",
  winRate: "How often entries in this group actually won.",
  chanceWinRate:
    "How often they would win if the winner were drawn at random (1 divided by the number of entrants, averaged).",
};

export function smallSampleWarning(pairs: number, minPairs: number): string {
  return `Not enough games yet: only ${pairs} back-to-back results from the same ${DEFAULT_NOUNS.players} (we need at least ${minPairs}). Treat these numbers as early signs, not proof.`;
}

/** Fixed method text for the PDF. Written by us, never by the AI, so it cannot drift. */
export const METHOD_PARAGRAPHS = [
  "Source. Every figure is computed from the final, settled leaderboard of each completed competition - the ranking prizes were actually paid on. Live or provisional scores are never used.",
  "Exclusions. Disqualified entries and entries with no recorded result are removed before ranking, so they cannot make a title look more skill-based than it is. Contests with fewer than two ranked players are ignored. Trading competitions are assessed separately and are not included.",
  "Comparable positions. Finishing places are converted to a percentage (100% first, 0% last) so contests of different sizes can be compared.",
  "Three measures, each against a luck baseline. (1) Score stability: correlation between a player's finishing position and their next one; luck gives 0. (2) Experience vs winning: rank correlation between contests already played and finishing position; luck gives 0. (3) Spread of winners: players winning two or more times compared with the number expected if every winner were drawn at random from that contest's entrants.",
  "Reading the correlations. 0.30 or above: clear sign of skill. 0.10 to 0.30: weak sign of skill. -0.10 to 0.10: indistinguishable from luck. Below -0.10: inverse, to be investigated.",
];
