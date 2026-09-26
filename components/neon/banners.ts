import type { NeonHeroBanner } from "@/components/neon/Hero";

/**
 * Which banner a contest wears.
 *
 * PREFERENCE ORDER (since Sep 2026): operator / catalogue `bannerUrl` from Games & Trading
 * page settings first, then the neon map keyed by game code, then the championship trophy.
 * Play pages already preferred the catalogue upload; lobbies and results now share the same
 * helper so a title's artwork is one decision everywhere a hero appears.
 *
 * `thumbnailUrl` IS DELIBERATELY NOT USED AS A FALLBACK. A thumbnail is roughly square and a
 * hero is roughly four to one, so using one stretches a portrait into a letterbox - which looks
 * like a bug rather than like a missing asset, and is worse than the generic banner.
 *
 * AND THE REASON A HARD-CODED MAP IS ACCEPTABLE AS A FALLBACK when a hard-coded game list is
 * banned elsewhere: the rule that matters - no aggregate may enumerate game types - exists
 * because an aggregate that misses a game keeps computing, keeps rendering, and is silently
 * wrong. A game with no artwork falls through to a trophy, which is *visibly* generic to anyone
 * who looks at the page. The failure announces itself, so a fallback is a real answer rather
 * than a hidden defect. **Do not extend this reasoning to anything that produces a number.**
 */

/*
  THE FILENAMES CARRY A REVISION SUFFIX AND THAT IS DELIBERATE. These three were redrawn on 11
  September 2026 to match the owner's arena reference, and a replacement written over the old
  filename is answered from a returning visitor's browser cache for as long as the edge's
  browser TTL says - four hours, on the evidence of R54, which is what it took to work out why
  a fixed game would not start. A new name is fetched immediately by everybody. `trading` keeps
  its original name because its artwork was not touched: the trading lobby was not part of the
  request, and changing how it looks in the same commit would smuggle an unasked-for change into
  a game fix.
*/
const CHAMPIONSHIP: NeonHeroBanner = {
  src: "/assets/neon/banner-championship-r2.webp",
  alt: "A golden championship trophy beside three glowing neon podium blocks on a dark circuit background",
};

const TRADING: NeonHeroBanner = {
  src: "/assets/neon/banner-trading.webp",
  alt: "A violet and magenta nebula with a rising candlestick chart formed from starlight",
};

/*
  Keyed by the provider's own game code. A `Map` rather than an object because the key arrives
  from a database document and object indexing walks the prototype chain, so `__proto__` returns
  something truthy that survives a null check and fails later on a missing property.
*/
const BY_GAME_CODE = new Map<string, NeonHeroBanner>([
  [
    "circuit-sprint",
    {
      /*
        `-r3`, redrawn 11 September 2026 from the owner's hero crop. Two things changed and
        both were in the reference: the terminals are drawn as the game's own lit orbs rather
        than as abstract circuitry, and the right third carries the trophy and the pot, which
        is what says "there is money on this" before a player has read a word.

        The middle stays near-black on purpose - see the scrim note in `GameArenaLayout`. The
        artwork carries NO lettering, although the reference's does: the platform writes the
        contest's own name over this space, and painted text would be a second heading, wrong
        in every locale and impossible to change.
      */
      src: "/assets/neon/banner-circuit-sprint-r3.webp",
      alt: "Glowing neon circuit terminals joined by energy paths, beside a golden trophy spilling coins",
    },
  ],
  [
    "circuit-perfect",
    {
      src: "/assets/neon/banner-circuit-perfect-r2.webp",
      alt: "A glowing neon puzzle grid with energy paths linking its nodes, beside a neon stopwatch",
    },
  ],
]);

/** The banner for a trading contest. */
export function tradingBanner(): NeonHeroBanner {
  return TRADING;
}

/**
 * Prefer the Trading page content banner (Games & Trading settings), else neon trading art.
 */
export function resolveTradingBanner(
  bannerUrl?: string | null,
): NeonHeroBanner {
  const url = typeof bannerUrl === "string" ? bannerUrl.trim() : "";
  if (url) {
    return { src: url, alt: "Trading contest banner" };
  }
  return tradingBanner();
}

/**
 * The banner for a provider contest.
 *
 * Takes the game code rather than the contest, so this file never learns what a contest is and
 * stays a plain lookup that a test can exhaust.
 */
export function providerBanner(gameCode?: string | null): NeonHeroBanner {
  if (!gameCode) return CHAMPIONSHIP;
  return BY_GAME_CODE.get(gameCode) ?? CHAMPIONSHIP;
}

/**
 * Prefer catalogue / operator `bannerUrl`, else the neon map for the game code.
 *
 * ONE DEFINITION for lobby, play and results — a screen that resolves the banner itself is a
 * second place the next title's artwork can be forgotten.
 */
export function resolveProviderBanner(opts: {
  bannerUrl?: string | null;
  gameName?: string | null;
  gameCode?: string | null;
}): NeonHeroBanner {
  const url = typeof opts.bannerUrl === "string" ? opts.bannerUrl.trim() : "";
  if (url) {
    return {
      src: url,
      alt: (opts.gameName && opts.gameName.trim()) || "Contest banner",
    };
  }
  return providerBanner(opts.gameCode);
}

/** Exposed so a test can assert every banner in the map resolves to a file that exists. */
export function allNeonBanners(): NeonHeroBanner[] {
  return [CHAMPIONSHIP, TRADING, ...BY_GAME_CODE.values()];
}
