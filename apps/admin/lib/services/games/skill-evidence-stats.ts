/**
 * Skill evidence for a game title, computed from settled contest results.
 *
 * Section 9 item 4 of `legal/ChartVolt-Preliminary-Legal-Opinion.html` asks for three
 * measures, "score stability for repeat players, correlation between experience and
 * winning, spread of winners", because they are what a regulator asks when deciding
 * whether skill or chance predominates. Each one has a chance baseline, and the screen
 * shows the baseline beside the figure. A number with nothing to compare it against is
 * not evidence.
 *
 * PURE. There is no I/O here, so every figure can be checked against a hand-built
 * contest list. The service reads the database and passes plain rows in.
 *
 * Positions are normalised to a PERCENTILE so contests of different sizes can be
 * compared: 1 is first place, 0 is last. A raw rank cannot be compared, because 3rd of
 * 4 and 3rd of 40 are opposite results. A contest with fewer than two ranked players
 * says nothing about relative skill and is left out.
 */
// Reason: every flagged access indexes an array with a numeric loop counter; no key comes
// from a request or a stored document, so there is nothing to walk the prototype chain.
/* eslint-disable security/detect-object-injection */

export interface SettledEntry {
  userId: string;
  rank: number;
}

export interface SettledContest {
  contestId: string;
  endedAt: Date;
  entries: SettledEntry[];
}

export interface ExperienceBucket {
  label: string;
  entries: number;
  meanPercentile: number | null;
  winRate: number | null;
  /** The win rate pure chance would give these same entries: the mean of 1/n. */
  chanceWinRate: number | null;
}

export interface SkillEvidence {
  contests: number;
  entries: number;
  players: number;
  repeatPlayers: number;
  stability: { pairs: number; correlation: number | null };
  experience: { correlation: number | null; buckets: ExperienceBucket[] };
  winners: {
    wins: number;
    distinctWinners: number;
    repeatWinners: number;
    /** Expected number of players winning twice or more if every result were a lottery. */
    expectedRepeatWinnersByChance: number;
    /** Expected number of different winners under a lottery. Far fewer means wins concentrate. */
    expectedDistinctWinnersByChance: number;
    topWinnerShare: number | null;
  };
  /** Below this, a correlation is noise. The screen shows the figure but labels it. */
  sufficient: boolean;
}

/** Fewer consecutive pairs than this and a correlation should not be quoted. */
export const MIN_PAIRS_FOR_EVIDENCE = 30;

const BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "First contest", min: 0, max: 0 },
  { label: "2-5 contests", min: 1, max: 4 },
  { label: "6-15 contests", min: 5, max: 14 },
  { label: "16+ contests", min: 15, max: Infinity },
];

function percentile(rank: number, size: number): number {
  return 1 - (rank - 1) / (size - 1);
}

/** Pearson's r, or null when it is undefined (under three points, or no variance). */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** Ranks with ties averaged, so Spearman's rho is Pearson's r over these. */
function averageRanks(values: number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[order[k][1]] = avg;
    i = j + 1;
  }
  return out;
}

export function spearman(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length) return null;
  return pearson(averageRanks(xs), averageRanks(ys));
}

/** P(at least two successes) for independent trials with the given probabilities. */
function probabilityAtLeastTwo(ps: number[]): number {
  let none = 1;
  for (const p of ps) none *= 1 - p;
  let exactlyOne = 0;
  for (let i = 0; i < ps.length; i++) {
    let term = ps[i];
    for (let j = 0; j < ps.length; j++) if (j !== i) term *= 1 - ps[j];
    exactlyOne += term;
  }
  return Math.max(0, 1 - none - exactlyOne);
}

/** P(at least one success) for independent trials with the given probabilities. */
function probabilityAtLeastOne(ps: number[]): number {
  let none = 1;
  for (const p of ps) none *= 1 - p;
  return 1 - none;
}

export function computeSkillEvidence(input: SettledContest[]): SkillEvidence {
  const contests = input
    .filter((c) => c.entries.length >= 2)
    .sort((a, b) => a.endedAt.getTime() - b.endedAt.getTime());

  const history = new Map<string, number[]>();
  const winChances = new Map<string, number[]>();
  const winsByPlayer = new Map<string, number>();
  const experienceX: number[] = [];
  const outcomeY: number[] = [];
  const bucketRows = BUCKETS.map(() => ({ n: 0, pct: 0, wins: 0, chance: 0 }));
  let entries = 0;
  let wins = 0;

  for (const contest of contests) {
    const size = contest.entries.length;
    const seen = new Set<string>();
    for (const entry of contest.entries) {
      if (seen.has(entry.userId)) continue;
      seen.add(entry.userId);
      entries++;

      const pct = percentile(entry.rank, size);
      const won = entry.rank === 1;
      const prior = history.get(entry.userId) ?? [];

      experienceX.push(prior.length);
      outcomeY.push(pct);
      const b = BUCKETS.findIndex((bk) => prior.length >= bk.min && prior.length <= bk.max);
      const row = bucketRows[b];
      row.n++;
      row.pct += pct;
      row.chance += 1 / size;
      if (won) row.wins++;

      history.set(entry.userId, [...prior, pct]);
      winChances.set(entry.userId, [...(winChances.get(entry.userId) ?? []), 1 / size]);
      if (won) {
        wins++;
        winsByPlayer.set(entry.userId, (winsByPlayer.get(entry.userId) ?? 0) + 1);
      }
    }
  }

  const stabilityX: number[] = [];
  const stabilityY: number[] = [];
  let repeatPlayers = 0;
  for (const series of history.values()) {
    if (series.length < 2) continue;
    repeatPlayers++;
    for (let i = 1; i < series.length; i++) {
      stabilityX.push(series[i - 1]);
      stabilityY.push(series[i]);
    }
  }

  let expectedRepeatWinnersByChance = 0;
  let expectedDistinctWinnersByChance = 0;
  for (const ps of winChances.values()) {
    expectedRepeatWinnersByChance += probabilityAtLeastTwo(ps);
    expectedDistinctWinnersByChance += probabilityAtLeastOne(ps);
  }

  const winCounts = [...winsByPlayer.values()].sort((a, b) => b - a);
  const topN = Math.max(1, Math.ceil(winCounts.length * 0.1));
  const topWins = winCounts.slice(0, topN).reduce((a, b) => a + b, 0);

  return {
    contests: contests.length,
    entries,
    players: history.size,
    repeatPlayers,
    stability: { pairs: stabilityX.length, correlation: pearson(stabilityX, stabilityY) },
    experience: {
      correlation: spearman(experienceX, outcomeY),
      buckets: BUCKETS.map((bk, i) => {
        const row = bucketRows[i];
        return {
          label: bk.label,
          entries: row.n,
          meanPercentile: row.n ? row.pct / row.n : null,
          winRate: row.n ? row.wins / row.n : null,
          chanceWinRate: row.n ? row.chance / row.n : null,
        };
      }),
    },
    winners: {
      wins,
      distinctWinners: winCounts.length,
      repeatWinners: winCounts.filter((w) => w >= 2).length,
      expectedRepeatWinnersByChance: Math.round(expectedRepeatWinnersByChance * 100) / 100,
      expectedDistinctWinnersByChance: Math.round(expectedDistinctWinnersByChance * 100) / 100,
      topWinnerShare: wins ? topWins / wins : null,
    },
    sufficient: stabilityX.length >= MIN_PAIRS_FOR_EVIDENCE,
  };
}
