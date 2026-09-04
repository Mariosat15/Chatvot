/**
 * The external game provider contract (X2, chapter 02 section 4).
 *
 * This is the boundary. Everything provider-specific stops here: a provider's vocabulary,
 * their status names, their score units, their HTTP quirks. Downstream, the contest engine
 * sees participants with scores and nothing else (chapter 02 section 10 rule 1, and
 * invariant 7 in chapter 11 section 5 - "provider concepts never leak past the adapter").
 *
 * WHY THIS LIVES IN `lib/services/` AND NOT `lib/games/provider/`
 * ---------------------------------------------------------------
 * Chapter 11 section 3 sketched the provider module at `lib/games/provider/adapters/`,
 * while chapter 02 section 9 put it at `lib/services/game-providers/`. Invariant 2 settles
 * it: X1 step 6 added an ESLint rule banning anything inside a game module folder (one
 * level below `lib/games/`) from importing
 * a model or the database connection. The registry reads provider settings and the
 * catalogue service writes `provider_game`, so they cannot live in a game module without
 * either breaking that rule or weakening it.
 *
 * The split that results is the correct one anyway, and worth stating because it is the
 * whole shape of the phase:
 *
 *   lib/services/game-providers/   talks to the outside world, touches the database
 *   lib/games/provider/            pure scoring and settlement for a provider contest,
 *                                  arriving with X5, no I/O of any kind
 *
 * EVERY METHOD RETURNS A RESULT AND NEVER THROWS
 * ----------------------------------------------
 * Same reason as `assertGameEnabled` and every server action in this codebase: Next.js
 * strips thrown error messages in production builds, so a throw reaches a player as
 * "An error occurred in Server Components render" instead of something actionable. It also
 * matters more here than usual - a provider is a network dependency that WILL fail, and
 * chapter 07 section 1 requires that its failure degrade the experience without ever
 * corrupting money.
 */

/** Which way is better. A race time ranks ascending; a points total ranks descending. */
export type ProviderScoreDirection = "higher_is_better" | "lower_is_better";

/** Chapter 01 section 3. `duration_ms` is why `scoreDirection` cannot be assumed. */
export type ProviderScoreType = "integer" | "decimal" | "duration_ms";

/** Chapter 01 section 3. Family A plays alone and is ranked; Family B plays an opponent. */
export type ProviderGameFamily = "independent" | "head_to_head";

/** What the provider says about a title, as distinct from whether WE have enabled it. */
export type ProviderGameStatus = "active" | "deprecated" | "maintenance";

/** Chapter 01 section 4.2. A practice round is free, unranked and pays nothing. */
export type ProviderRoundMode = "ranked" | "practice";

/** Chapter 01 section 5.1. The terminal states a round can reach. */
export type ProviderRoundStatus =
  | "completed"
  | "abandoned"
  | "expired"
  | "voided";

/**
 * The uniform result shape. `success: false` always carries a reason.
 *
 * `retryable` is separate from the message because the caller's decision depends on it and
 * must not be inferred by matching on text. Chapter 01 section 6a makes the provider's own
 * `retryable` flag authoritative when present; where it is absent the adapter decides from
 * the HTTP status.
 */
export type ProviderResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string; retryable?: boolean };

/** One title as the catalogue reports it, already normalised to our vocabulary. */
export interface ProviderCatalogueGame {
  gameCode: string;
  displayName: string;
  description?: string;
  thumbnailUrl?: string;
  category?: string;
  family: ProviderGameFamily;
  supportsCompetition: boolean;
  supportsOneVsOne: boolean;
  supportsPractice: boolean;
  supportsContentSeed: boolean;
  scoreDirection: ProviderScoreDirection;
  scoreType: ProviderScoreType;
  scoreRange?: { min?: number; max?: number };
  typicalDurationSeconds?: number;
  maxDurationSeconds?: number;
  configSchema?: Record<string, unknown>;
  status: ProviderGameStatus;
}

/** Chapter 01 section 4. What we send to open a round. */
export interface CreateRoundRequest {
  /** OUR identifier, and the idempotency key. Chapter 01 section 4.1. */
  roundId: string;
  gameCode: string;
  mode: ProviderRoundMode;
  player: {
    /** Pseudonymous. A provider never receives an email, a name or a wallet. */
    playerId: string;
    displayName?: string;
    locale?: string;
    country?: string;
  };
  /** Validated against the title's `configSchema` before it gets here. */
  config?: Record<string, unknown>;
  /**
   * Makes every player in one contest face identical content.
   *
   * Reason: without it, players get different questions or different puzzles and the
   * contest is not a fair comparison - which collapses the skill argument the regulatory
   * position depends on. Required for competitions, chapter 01 section 3.
   */
  contentSeed?: string;
  expiresAt: Date;
  resultCallbackUrl: string;
  returnUrl: string;
}

export interface CreateRoundResponse {
  roundId: string;
  providerRoundId: string;
  launchUrl: string;
  launchUrlExpiresAt?: Date;
}

/**
 * A finished round, in our units and our vocabulary (chapter 02 section 4.1).
 *
 * `rawScore` is the only field that may influence ranking. `breakdown` is display-only,
 * and chapter 01 section 5.4 is explicit about it - ranking on a breakdown component would
 * make the result depend on data we never agreed a meaning for.
 */
export interface NormalisedRoundResult {
  roundId: string;
  providerRoundId: string;
  status: ProviderRoundStatus;
  rawScore: number;
  scoreDirection: ProviderScoreDirection;
  /** Display only. NEVER used for ranking. */
  breakdown?: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  /** For dispute handling. */
  replayUrl?: string;
  /** Provider-side suspicion signals. Advisory - our fraud layer decides. */
  integrityFlags?: string[];
  /** The provider's own event timestamp, used to order late and duplicate callbacks. */
  occurredAt?: Date;
}

/** What a provider supports, so the admin panel cannot offer an impossible format. */
export interface ProviderCapabilities {
  supportsVoid: boolean;
  supportsMatches: boolean;
  supportsPractice: boolean;
  supportsSeeding: boolean;
}

export interface CallbackVerification {
  valid: boolean;
  /** Present when invalid, so the rejection can be logged and alerted with a cause. */
  reason?: string;
}

/**
 * The interface every provider adapter implements.
 *
 * A second provider costs one file implementing this and one registry entry. That claim is
 * the entire justification for the abstraction, and chapter 09 section 7 requires a second
 * adapter skeleton in X9 - even unused - because with only a mock and one real provider the
 * claim is never actually tested (risk X6).
 */
export interface GameProviderAdapter {
  /** Stable, unique, and embedded in every `gameKey`. Never renamed. */
  readonly providerKey: string;

  /** Shown to operators. Never used as an identifier. */
  readonly displayName: string;

  capabilities(): ProviderCapabilities;

  /** The catalogue, normalised. Cached by the catalogue service; not called per request. */
  listGames(): Promise<ProviderResult<ProviderCatalogueGame[]>>;

  /**
   * Open a round and return a launch URL.
   *
   * MUST be idempotent on `roundId` (chapter 01 section 4.1): the same id returns the same
   * round and the same launch URL, not a second round. This is what makes a double-clicked
   * Play button harmless, and what stops a retried request consuming a second attempt.
   */
  createRound(
    request: CreateRoundRequest,
  ): Promise<ProviderResult<CreateRoundResponse>>;

  /**
   * Pull a round's current state.
   *
   * The fallback when a callback never arrives, and the basis of reconciliation. Chapter 07
   * section 2 builds a four-stage safety net on this: callback, poll, final sweep, then the
   * unresolved policy.
   */
  fetchRound(roundId: string): Promise<ProviderResult<NormalisedRoundResult>>;

  /** Cancel a round. Only meaningful when `capabilities().supportsVoid`. */
  voidRound(roundId: string): Promise<ProviderResult<void>>;

  /**
   * Verify a callback's signature and timestamp.
   *
   * Takes the RAW body bytes, not a parsed object. Reason: a signature is computed over
   * exact bytes, and `JSON.parse` followed by re-serialisation does not reproduce them -
   * key order, whitespace and number formatting all shift. Verifying a re-serialised body
   * fails for valid requests and, worse, can be made to pass for crafted ones.
   *
   * Must reject anything older than 5 minutes (chapter 01 section 2) and compare in
   * constant time.
   */
  verifyCallback(
    rawBody: string,
    headers: Record<string, string>,
  ): CallbackVerification;

  /** Translate a verified provider payload into our shape. */
  parseCallback(rawBody: string): ProviderResult<NormalisedRoundResult>;
}
