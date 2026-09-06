/**
 * A deterministic pseudo-random number generator.
 *
 * WHY NOT Math.random()
 * --------------------
 * Section 12 of the ChartVolt specification is the strictest requirement in the document:
 * the same `contentSeed` and the same `config` must produce identical content, every time,
 * *indefinitely*. `Math.random()` cannot do that, and the failure is silent - two players in
 * one contest get different puzzles, both play happily, and the ranking that decides real
 * prize money is comparing two different tests.
 *
 * "Indefinitely" is the part that constrains the implementation. It rules out anything whose
 * output could change with a Node upgrade or a dependency bump, so this is a hand-written
 * generator with a fixed algorithm rather than a library call. A puzzle generated today must
 * regenerate byte-identically in two years when a player disputes a prize.
 *
 * ALGORITHM
 * ---------
 * xmur3 to hash the seed string into a 32-bit state, then sfc32 to produce the stream. Both
 * are small, well-documented public-domain constructions with no dependencies. The specific
 * choice matters less than it being pinned and never changed.
 *
 * DO NOT "IMPROVE" THE CONSTANTS OR THE MIXING. Any change reseeds every puzzle that has ever
 * been generated, which breaks reproducibility for historical rounds - the one thing section
 * 12 requires forever.
 */

/**
 * Hash an arbitrary seed string into four 32-bit integers.
 *
 * Reason for hashing rather than parsing: `contentSeed` is an opaque platform identifier
 * (`cv_ctst_774219`), not a number, and adjacent contest ids must not produce adjacent
 * puzzle streams - otherwise two different contests look suspiciously similar.
 */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function next(): number {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

export class SeededRandom {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: string) {
    const hash = xmur3(seed);
    this.a = hash();
    this.b = hash();
    this.c = hash();
    this.d = hash();
  }

  /** Float in [0, 1). sfc32. */
  next(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  /** Integer in [0, max). */
  int(max: number): number {
    return Math.floor(this.next() * max);
  }

  /** Integer in [min, max] inclusive. */
  between(min: number, max: number): number {
    return min + this.int(max - min + 1);
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)];
  }

  /**
   * Fisher-Yates, in place, using this stream.
   *
   * Used for two very different jobs, and the distinction is worth keeping in mind: shuffling
   * *content* (which must be identical for every player in a contest, so it uses the contest
   * seed) and shuffling *presentation* (which is per player, so it uses a per-round seed).
   * Section 12 permits the second and forbids the first.
   */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      // Both indices are loop counters bounded by the array length; no external input reaches
      // them. Note the disable must be the LAST line before the code - wrapping its reason
      // onto a second comment line makes "next line" mean the comment, and the silence is
      // then present in the diff and absent in effect.
      // eslint-disable-next-line security/detect-object-injection
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}

/**
 * Derive a sub-seed for one puzzle within a round's set.
 *
 * Reason: a round plays several puzzles, and each needs its own independent stream. Reusing
 * one generator sequentially would work but couples the puzzles - regenerating puzzle 4 alone,
 * which support has to do when a player disputes it, would require replaying the first three.
 */
export function derive(seed: string, ...parts: (string | number)[]): string {
  return [seed, ...parts].join("|");
}
