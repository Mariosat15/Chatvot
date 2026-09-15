/**
 * The terminology token catalogue (X6.5, chapter 14 section 2).
 *
 * There is no i18n layer in this codebase - no `next-intl`, no `react-i18next`. This is a
 * token dictionary for the shared shell, which gets most of the benefit of one for a
 * fraction of the cost. A token is a DISPLAY WORD and nothing else.
 *
 * FOUR BOUNDARIES, each of which is load-bearing and each of which the obvious version of
 * this file gets wrong.
 *
 * 1. NO TRADING VOCABULARY IS A TOKEN, deliberately. Chapter 14 section 5 guarantees that
 *    "a trader should not be able to tell this programme happened" - every screen under
 *    `/trade`, the whole `components/trading/` stack, the trading help guide and the
 *    trading notification types keep their own words. If those words were tokens, an
 *    operator could rename them from a settings screen and break that guarantee from
 *    outside the codebase. Their ABSENCE here is what makes the guarantee structural
 *    rather than a promise, so do not add `position`, `trade`, `pnl` or `margin` on
 *    consistency grounds.
 *
 * 2. NO CREDIT OR CURRENCY TOKEN. What a competition amount is written in is already
 *    decided once, by `AppSettings.credits.symbol` (default the lightning glyph) through
 *    `lib/utils/format-volts.ts`, and what one credit is worth by `lib/utils/credit-value.ts`
 *    (R74). A `credits` token would be a second definition of a money label, which is the
 *    "one rule, two copies" shape behind `referenceId`, `failedReason`, `challengeId` and
 *    the Game Master `||` - and the copy that drifts is the one in front of a player
 *    deciding whether to pay.
 *
 * 3. NOTHING HERE IS AN IDENTIFIER. Chapter 14 section 6 lists what may never be renamed:
 *    API routes, model names, ledger enums, ranking method ids, restriction keys, status
 *    values, badge ids, notification template keys, settings keys and `gameKey`. A token
 *    value is read by a human and by nothing else. So `contests` may render as
 *    "Tournaments" while the route stays `/api/competitions/*` and the ledger row stays
 *    `competition_entry` - renaming either of those orphans financial history (R13).
 *
 * 4. SINGULAR AND PLURAL ARE SEPARATE TOKENS, never derived. Deriving one from the other
 *    means running string surgery on a word an operator typed, and `replace(/s$/, "")` on
 *    a configured value is the mistake the credit-symbol work had to remove: a glyph has
 *    no plural and neither does every noun in every deployment.
 *
 * THE DEFAULTS ARE THE TARGET WORDS, NOT TODAY'S WORDS. Installing this file is not a
 * no-op: the point of the pass is that a screen reading "Trader" starts reading "Player".
 * Where today's word is already neutral - "Competition" - the default matches it and
 * nothing moves.
 *
 * This module is MODEL-FREE and therefore client-reachable (R58). It must never import a
 * Mongoose model; the accessor that reads the platform override is a separate service.
 *
 * This docblock used to end "and the browser receives resolved tokens through
 * `AppSettingsProvider`", restating chapter 14. THAT IS FALSE and the correction is left
 * visible rather than tidied into the present tense, because it was believed for long enough
 * to be written down twice: `apps/admin` mounts `AppSettingsProvider` nowhere, so tokens
 * delivered that way would have arrived as defaults on every admin screen with nothing
 * failing and nothing logged. The browser receives them from
 * `apps/admin/contexts/TerminologyContext.tsx`, seeded by `getTerms()` in the admin root
 * layout.
 */

export const TERMS = {
  // ---- Contest vocabulary -------------------------------------------------
  // `contest` is the platform-neutral noun for the many-player paid format. The default is
  // "Competition" because that is what every screen and every route already says, so the
  // token changes nothing until an operator asks it to.
  contest: "Competition",
  contests: "Competitions",

  // A challenge is exactly two players. The word is fixed by a hard constraint in the
  // programme rules: use "challenge", NEVER "duel" - there is a `Challenge` model,
  // `/challenges` routes, a `challengesEnabled` flag and `challenge_entry` /
  // `challenge_refund` ledger values, and nine remaining `duel` strings elsewhere in the
  // codebase are a separate migration (`13` s9.1a), not a wording preference.
  challenge: "Challenge",
  challenges: "Challenges",

  // The only single-player mode, and it is free, unranked and prize-less.
  practice: "Practice",

  // ---- People -------------------------------------------------------------
  // "Player" replaces "Trader" across the shared shell. Chapter 14 section 4 lists the
  // specific sites: the sidebar fallback name, the user dropdown, `/api/user/level`'s
  // default title and `LiveStatsBar`'s "Active Traders".
  player: "Player",
  players: "Players",
  opponent: "Opponent",

  // ---- Performance --------------------------------------------------------
  // `score` is the cross-game ranking value. It is NOT a synonym for profit and loss: a
  // puzzle has no P&L, which is why `05` section 10 forbids any aggregate that silently
  // means trading only.
  score: "Score",
  leaderboard: "Leaderboard",
  rank: "Rank",

  // ---- Money LABELS, never amounts ----------------------------------------
  // These are the words beside a figure. The figure itself, its unit and its formatting
  // belong to `format-volts.ts` - see boundary 2 above.
  entryFee: "Entry Fee",
  prizePool: "Prize Pool",
  // `prize` was the only noun here with no plural, which is the one shape that forces a
  // consumer to derive one - and a derived plural is what rule 2 above forbids, because
  // `replace(/$/, "s")` on an operator's own word is us editing their vocabulary. A
  // section heading covering several ranks legitimately needs the plural.
  prize: "Prize",
  prizes: "Prizes",

  // ---- Play structure -----------------------------------------------------
  // A round is one go at a game; an attempt is a round a player is entitled to. They are
  // two words because they are two facts: `attemptsPolicy` governs how many attempts a
  // contest grants, and an attempt is consumed when a round is CREATED (`03` s1.3).
  round: "Round",
  rounds: "Rounds",
  attempt: "Attempt",
  attempts: "Attempts",

  // ---- Catalogue ----------------------------------------------------------
  game: "Game",
  games: "Games",

  // ---- Progression --------------------------------------------------------
  level: "Level",
  levels: "Levels",
  points: "Points",
} as const;

/**
 * The token names. Derived from `TERMS` rather than written out, so a token cannot be
 * referenced that does not exist and a new token needs no second edit.
 */
export type TerminologyToken = keyof typeof TERMS;

/**
 * A complete set of resolved tokens. Every token is present - resolution always falls
 * through to the default - so a consumer never has to handle an absent word.
 */
export type TerminologyPack = Record<TerminologyToken, string>;

/**
 * A partial set, which is the shape an override is stored in.
 *
 * Partial is the whole point: an operator renaming "Competition" to "Tournament" says so
 * about one token and inherits the other twenty-two. A stored full pack would freeze
 * today's defaults into the database, so a later correction to a default would reach every
 * deployment except the ones that had ever opened the settings screen.
 */
export type TerminologyOverrides = Partial<Record<TerminologyToken, string>>;

/** Every token name, for iteration - an admin form, a validator, a test. */
export const TERMINOLOGY_TOKENS = Object.keys(TERMS) as TerminologyToken[];

/**
 * True when `token` is a token this catalogue declares.
 *
 * Overrides arrive from an admin form and are read back out of a stored document, so the
 * key is caller-supplied on both paths. The check is a `Set` rather than `token in TERMS`
 * or a truthiness test on `TERMS[token]`, because both `in` and object indexing walk the
 * prototype chain: `"toString"` and `"__proto__"` would pass, and `TERMS["__proto__"]`
 * returns `Object.prototype`, which is truthy and survives a `!value` test before failing
 * somewhere unrelated. Fifth instance of this in the codebase, after the round-inspector
 * action map, the contest-edit field list, the Game Master allow-list and
 * `UNSCORED_CONTEST_POLICY_COPY`.
 */
const TOKEN_NAMES = new Set<string>(TERMINOLOGY_TOKENS);

export function isTerminologyToken(token: string): token is TerminologyToken {
  return TOKEN_NAMES.has(token);
}

/**
 * Resolve a pack from an optional override layer.
 *
 * Resolution order is override, then default, per chapter 14 section 2. Two readings are
 * deliberate and both are the opposite of the obvious one:
 *
 *   - An empty or whitespace-only override is treated as ABSENT, not as an empty word. A
 *     blank field is what a cleared input, a half-run migration or a bad edit leaves
 *     behind, and no legitimate writer means "this noun has no name" - so taking it
 *     literally renders a heading with a word missing from the middle of it. Same reading
 *     as `resolveAllowedGameTypes` on an empty array.
 *   - An unrecognised key is IGNORED rather than refused. This runs on every render of
 *     every screen, and a stored key that is no longer a token - because the catalogue was
 *     trimmed - must not take a page down months later. The refusal belongs at the write,
 *     where an operator is present to read it.
 */
export function resolveTerms(overrides?: TerminologyOverrides | null): TerminologyPack {
  const pack = { ...TERMS } as TerminologyPack;
  if (!overrides) return pack;

  for (const [token, value] of Object.entries(overrides)) {
    if (!isTerminologyToken(token)) continue;
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    // Reason: `token` has been narrowed to a TerminologyToken by the guard above, so this is
    // not a caller-named path. Rule-scoped rather than a file-wide disable: the next write
    // into this module should have to justify itself the same way.
    // eslint-disable-next-line security/detect-object-injection
    pack[token] = trimmed;
  }

  return pack;
}
