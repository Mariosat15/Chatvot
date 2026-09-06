/**
 * The ChartVolt Games adapter (X4a, chapter 21).
 *
 * The first adapter that talks to something real. `MockProviderAdapter` answers from memory;
 * this one signs an HTTP request, sends it to a service that shares no code with this
 * repository, and has to cope with whatever comes back.
 *
 * WHAT IT IS FOR, IN THE ORDER THAT MATTERS
 * -----------------------------------------
 * 1. It proves the seam. Chapter 09 section 7 records risk X6: with only a mock and one real
 *    provider, "a second provider costs one file" is a claim nothing has tested. The mock cannot
 *    test it, because the mock was written by the same person as the interface and never
 *    disagrees with it.
 * 2. It is the hedge. Risk X8 - if the provider search or the pricing fails, the platform has
 *    funded the whole programme and has one game. This is that game.
 * 3. It is the conformance rehearsal. Every place the issued specification is ambiguous shows up
 *    here as a decision somebody had to make, which is what makes those ambiguities fixable
 *    before a real provider hits them.
 *
 * It is a PROVIDER GAME THAT HAPPENS TO BE OURS, not an in-house game module. It arrives through
 * the seam that already exists, which is why it costs none of the module architecture that
 * `New games plan` P1 and P2 would have.
 *
 * WHY IT READS SETTINGS ON EVERY CALL RATHER THAN AT CONSTRUCTION
 * --------------------------------------------------------------
 * The registry instantiates every adapter at module load, in a process that may have no database
 * connection yet, and an operator can change a base URL or rotate a secret at any time. An
 * adapter that captured its configuration once would keep using a rotated credential until the
 * next deploy - and the symptom would be a 401 that looks like the provider's fault.
 */

import type {
  CallbackVerification,
  CreateRoundRequest,
  CreateRoundResponse,
  GameProviderAdapter,
  NormalisedRoundResult,
  ProviderCapabilities,
  ProviderCatalogueGame,
  ProviderGameFamily,
  ProviderGameStatus,
  ProviderResult,
  ProviderScoreDirection,
  ProviderScoreType,
} from "../contract";
// Imported from the mirrored folder rather than `lib/services/games/callback-verification`,
// which is main-app only. See `callback-headers.ts` for why the helpers live there.
import { checkTimestamp, normaliseHeaders } from "../callback-headers";
import {
  CHARTVOLT_GAMES_PROVIDER_KEY,
  loadConnection,
} from "./chartvolt-games/connection";
import { normaliseResultBody } from "./chartvolt-games/normalise";
import { call } from "./chartvolt-games/transport";

export const CHARTVOLT_GAMES_KEY = CHARTVOLT_GAMES_PROVIDER_KEY;

/** One entry of the provider's `GET /v1/games` response. Every field is an input. */
interface CatalogueEntryPayload {
  gameCode?: unknown;
  displayName?: unknown;
  description?: unknown;
  thumbnailUrl?: unknown;
  category?: unknown;
  family?: unknown;
  supportsCompetition?: unknown;
  supportsOneVsOne?: unknown;
  supportsPractice?: unknown;
  supportsContentSeed?: unknown;
  scoreDirection?: unknown;
  scoreType?: unknown;
  scoreRange?: { min?: unknown; max?: unknown };
  typicalDurationSeconds?: unknown;
  maxDurationSeconds?: unknown;
  configSchema?: unknown;
  status?: unknown;
}

const SCORE_TYPES: ProviderScoreType[] = ["integer", "decimal", "duration_ms"];
const GAME_STATUSES: ProviderGameStatus[] = ["active", "deprecated", "maintenance"];

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function flag(value: unknown): boolean {
  // Strictly `true`, never truthiness. A provider sending the string "false" - which happens,
  // because form encodings and some JSON generators do it - would otherwise enable a capability
  // they declared off, and `supportsContentSeed` decides whether a title may take entry fees.
  return value === true;
}

function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * One catalogue entry, normalised.
 *
 * Returns `null` for a title we cannot use rather than throwing or substituting defaults. A
 * catalogue is a list, and one unusable row must not cost the other rows - the sync would then
 * report a total failure and leave the whole cache stale because of a single bad title.
 *
 * The required set is exactly what `provider_game` declares `required: true`. Defaulting any of
 * them would create a row the schema accepts and the platform cannot schedule: a title with a
 * guessed `scoreDirection` ranks a real contest, and a guessed `family` decides which formats
 * the admin panel offers.
 */
function normaliseCatalogueEntry(
  entry: CatalogueEntryPayload,
): ProviderCatalogueGame | null {
  const gameCode = text(entry.gameCode);
  const displayName = text(entry.displayName);
  const family = text(entry.family);
  const scoreDirection = text(entry.scoreDirection);
  const scoreType = text(entry.scoreType);

  if (!gameCode || !displayName) return null;
  if (family !== "independent" && family !== "head_to_head") return null;
  if (
    scoreDirection !== "higher_is_better" &&
    scoreDirection !== "lower_is_better"
  ) {
    return null;
  }
  if (!SCORE_TYPES.includes(scoreType as ProviderScoreType)) return null;

  const status = GAME_STATUSES.includes(text(entry.status) as ProviderGameStatus)
    ? (text(entry.status) as ProviderGameStatus)
    : // An unrecognised status becomes `maintenance`, not `active`. Fail closed: the cost of
      // being wrong downward is a title an operator has to re-enable, and upward is an untested
      // game in front of paying players.
      "maintenance";

  const game: ProviderCatalogueGame = {
    gameCode,
    displayName,
    family: family as ProviderGameFamily,
    supportsCompetition: flag(entry.supportsCompetition),
    supportsOneVsOne: flag(entry.supportsOneVsOne),
    supportsPractice: flag(entry.supportsPractice),
    supportsContentSeed: flag(entry.supportsContentSeed),
    scoreDirection: scoreDirection as ProviderScoreDirection,
    scoreType: scoreType as ProviderScoreType,
    status,
  };

  const description = text(entry.description);
  if (description) game.description = description;
  const thumbnailUrl = text(entry.thumbnailUrl);
  if (thumbnailUrl) game.thumbnailUrl = thumbnailUrl;
  const category = text(entry.category);
  if (category) game.category = category;

  const min = count(entry.scoreRange?.min);
  const max = count(entry.scoreRange?.max);
  if (min !== undefined || max !== undefined) {
    game.scoreRange = {};
    if (min !== undefined) game.scoreRange.min = min;
    if (max !== undefined) game.scoreRange.max = max;
  }

  const typical = count(entry.typicalDurationSeconds);
  if (typical !== undefined) game.typicalDurationSeconds = typical;
  const maximum = count(entry.maxDurationSeconds);
  if (maximum !== undefined) game.maxDurationSeconds = maximum;

  if (
    typeof entry.configSchema === "object" &&
    entry.configSchema !== null &&
    !Array.isArray(entry.configSchema)
  ) {
    game.configSchema = entry.configSchema as Record<string, unknown>;
  }

  return game;
}

export class ChartVoltGamesAdapter implements GameProviderAdapter {
  // Annotated `string` rather than left to infer the literal. The interface declares `string`,
  // and inferring a literal makes the class impossible to subclass - TS2416, which only appears
  // when somebody writes the second implementation.
  readonly providerKey: string = CHARTVOLT_GAMES_PROVIDER_KEY;
  readonly displayName: string = "ChartVolt Games";

  /**
   * What the PROTOCOL supports, which is not the same question as what a title supports.
   *
   * `supportsMatches` is false while both titles declare `supportsOneVsOne: true`, and that is
   * not a contradiction. A one-against-one contest here is two independent rounds whose scores
   * are compared - which the platform already knows how to run. `supportsMatches` means the
   * provider hosts a shared match object with an endpoint to create it, and there is no such
   * endpoint. Declaring it true would let the admin panel offer a format the provider would
   * refuse at play time, which is the failure shape of enabling a provider with no adapter.
   */
  capabilities(): ProviderCapabilities {
    return {
      supportsVoid: true,
      supportsMatches: false,
      supportsPractice: true,
      supportsSeeding: true,
    };
  }

  async listGames(): Promise<ProviderResult<ProviderCatalogueGame[]>> {
    const connection = await loadConnection(this.providerKey);
    if (!connection.ok) {
      return { success: false, error: connection.reason, retryable: false };
    }

    const response = await call<{ games?: unknown }>({
      connection: connection.connection,
      method: "GET",
      path: "/v1/games",
    });
    if (!response.success) return response;

    const raw = response.data.games;
    if (!Array.isArray(raw)) {
      return {
        success: false,
        error: "Catalogue response did not contain a games array.",
        code: "MALFORMED_CATALOGUE",
        retryable: true,
      };
    }

    const games: ProviderCatalogueGame[] = [];
    let rejected = 0;
    for (const entry of raw) {
      const normalised =
        typeof entry === "object" && entry !== null
          ? normaliseCatalogueEntry(entry as CatalogueEntryPayload)
          : null;
      if (normalised) games.push(normalised);
      else rejected++;
    }

    if (rejected > 0) {
      // Reported, not swallowed. A title silently dropped from a catalogue is a game an operator
      // is waiting for and cannot find, with nothing anywhere saying why.
      console.warn(
        `⚠️ [${this.providerKey}] ${rejected} catalogue ${
          rejected === 1 ? "entry was" : "entries were"
        } unusable and skipped.`,
      );
    }

    if (games.length === 0 && raw.length > 0) {
      // Every row unusable is a different fault from an empty catalogue, and must not be handed
      // to the sync as a success - the sync would then report every existing title as missing
      // from the provider.
      return {
        success: false,
        error: "Every catalogue entry was unusable.",
        code: "MALFORMED_CATALOGUE",
        retryable: true,
      };
    }

    return { success: true, data: games };
  }

  /**
   * Opens a round.
   *
   * IDEMPOTENCY IS THE PROVIDER'S JOB AND IS NOT RE-IMPLEMENTED HERE. Chapter 01 section 4.1
   * makes `roundId` the idempotency key, so the same id returns the same round and the same
   * launch URL. Caching responses in this process would be worse than useless: there are
   * several server processes, so a cache would be per-instance, and the one case that matters -
   * a retry landing on a different instance - is exactly the case it would miss.
   */
  async createRound(
    request: CreateRoundRequest,
  ): Promise<ProviderResult<CreateRoundResponse>> {
    const connection = await loadConnection(this.providerKey);
    if (!connection.ok) {
      return { success: false, error: connection.reason, retryable: false };
    }

    const response = await call<{
      roundId?: unknown;
      providerRoundId?: unknown;
      launchUrl?: unknown;
      launchUrlExpiresAt?: unknown;
    }>({
      connection: connection.connection,
      method: "POST",
      path: "/v1/rounds",
      body: {
        roundId: request.roundId,
        gameCode: request.gameCode,
        mode: request.mode,
        player: {
          playerId: request.player.playerId,
          displayName: request.player.displayName,
          locale: request.player.locale,
          country: request.player.country,
        },
        config: request.config,
        contentSeed: request.contentSeed,
        // ISO 8601 with a timezone, per chapter 01 section 14. `Date.toJSON` would produce the
        // same string, but relying on it means a plain object with a string date silently
        // serialises differently from a real Date.
        expiresAt: request.expiresAt.toISOString(),
        resultCallbackUrl: request.resultCallbackUrl,
        returnUrl: request.returnUrl,
      },
    });
    if (!response.success) return response;

    const launchUrl = text(response.data.launchUrl);
    const providerRoundId = text(response.data.providerRoundId);
    if (!launchUrl || !providerRoundId) {
      return {
        success: false,
        error: "Provider created a round without a launch URL or a provider round id.",
        code: "MALFORMED_ROUND",
        // NOT retryable: the round may well exist on their side, and retrying would be a second
        // create for a round we already cannot launch. This needs a human, and the round is
        // recoverable by fetching it.
        retryable: false,
      };
    }

    const created: CreateRoundResponse = {
      // Ours, echoed. Taken from the request rather than the response so a provider echoing the
      // wrong id cannot repoint our round record at something else.
      roundId: request.roundId,
      providerRoundId,
      launchUrl,
    };

    const expires = text(response.data.launchUrlExpiresAt);
    if (expires) {
      const parsed = new Date(expires);
      if (!Number.isNaN(parsed.getTime())) created.launchUrlExpiresAt = parsed;
    }

    return { success: true, data: created };
  }

  async fetchRound(
    roundId: string,
  ): Promise<ProviderResult<NormalisedRoundResult>> {
    const connection = await loadConnection(this.providerKey);
    if (!connection.ok) {
      return { success: false, error: connection.reason, retryable: false };
    }

    const response = await call<unknown>({
      connection: connection.connection,
      method: "GET",
      path: `/v1/rounds/${encodeURIComponent(roundId)}`,
    });
    if (!response.success) return response;

    return normaliseResultBody(response.data);
  }

  async voidRound(roundId: string): Promise<ProviderResult<void>> {
    const connection = await loadConnection(this.providerKey);
    if (!connection.ok) {
      return { success: false, error: connection.reason, retryable: false };
    }

    const response = await call<unknown>({
      connection: connection.connection,
      method: "POST",
      path: `/v1/rounds/${encodeURIComponent(roundId)}/void`,
      body: { reason: "Voided by ChartVolt." },
    });
    if (!response.success) return response;

    return { success: true, data: undefined };
  }

  /**
   * The adapter's own callback check (gate 5b).
   *
   * WHAT THIS CAN AND CANNOT DO, STATED PLAINLY BECAUSE THE GAP IS THE FINDING
   * --------------------------------------------------------------------------
   * `verifyCallback` is SYNCHRONOUS in `GameProviderAdapter`, and this provider's secrets live
   * in `WhiteLabel.gameProviderCredentials` behind `select: false`. So there is no way to
   * recompute an HMAC here - that needs a database read, and the signature cannot be awaited.
   * The mock can do it only because its secret is a field on the instance.
   *
   * Gate 5 has already verified the HMAC with the stored secret, and gate 3 the bearer token, so
   * nothing is unchecked. But returning `{ valid: true }` from here would be a review failure by
   * the ingestion service's own words - it "turns this gate into a formality" - so this performs
   * the checks that are genuinely possible without a secret:
   *
   *   - all three transport headers are present, which distinguishes a provider that forgot one
   *     from a signature that does not match, and those send an operator to different places;
   *   - the signature is `sha256=` followed by 64 hex characters, so a truncated or
   *     double-encoded header is named as such rather than reported as a mismatch;
   *   - the timestamp is inside the five-minute window, using the same shared helper as gate 4
   *     rather than a second copy of the arithmetic.
   */
  verifyCallback(
    rawBody: string,
    headers: Record<string, string>,
  ): CallbackVerification {
    const map = normaliseHeaders(headers);

    if (!rawBody || rawBody.trim().length === 0) {
      return { valid: false, reason: "Callback body is empty." };
    }

    if (!map.get("authorization")) {
      return { valid: false, reason: "Authorization header missing." };
    }

    const signature = map.get("x-signature");
    if (!signature) {
      return { valid: false, reason: "X-Signature header missing." };
    }
    if (!/^sha256=[0-9a-f]{64}$/i.test(signature)) {
      return {
        valid: false,
        reason: "X-Signature is not sha256= followed by 64 hex characters.",
      };
    }

    const timestamp = checkTimestamp(map.get("x-timestamp"));
    if (!timestamp.valid) {
      return { valid: false, reason: timestamp.reason };
    }

    return { valid: true };
  }

  parseCallback(rawBody: string): ProviderResult<NormalisedRoundResult> {
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return {
        success: false,
        error: "Callback body is not valid JSON.",
        code: "MALFORMED_RESULT",
        retryable: false,
      };
    }

    // The same parser the fetch uses. See `normalise.ts` for why there is exactly one.
    return normaliseResultBody(payload);
  }
}
