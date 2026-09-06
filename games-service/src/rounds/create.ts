import crypto from "crypto";

import { loadConfig } from "../config";
import { findTitle, resolveConfig, type RoundConfig } from "../games/titles";
import { Round, type RoundDoc, type RoundDocument } from "../store/round.model";
import { ApiError, badRequest, roundConflict, unknownGame } from "../http/errors";

/**
 * `POST /v1/rounds` - endpoint 2 of the specification.
 *
 * This is the endpoint where a mistake costs a player money. Two rules from section 11 decide
 * its whole shape: the same `roundId` must return the same round rather than creating a second
 * one, because "a player double-tapping Play must not consume two paid attempts"; and the same
 * `roundId` with different parameters must be refused with a `409`, because that is an
 * identifier collision the platform would rather hear about than have guessed at.
 */

/** How long a launch URL lives. Short is correct and expected, per section 7. */
const LAUNCH_URL_TTL_MS = 10 * 60 * 1000;

export interface CreateRoundInput {
  roundId?: unknown;
  gameCode?: unknown;
  mode?: unknown;
  player?: unknown;
  config?: unknown;
  contentSeed?: unknown;
  expiresAt?: unknown;
  resultCallbackUrl?: unknown;
  returnUrl?: unknown;
}

export interface CreateRoundOutput {
  roundId: string;
  providerRoundId: string;
  launchUrl: string;
  launchUrlExpiresAt: string;
  status: "created";
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw badRequest(`'${field}' is required and must be a non-empty string.`);
  }
  return value.trim();
}

function requireDate(value: unknown, field: string): Date {
  const raw = requireString(value, field);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(`'${field}' is not a valid ISO 8601 timestamp.`);
  }
  return parsed;
}

/**
 * Validates a URL we will later POST to.
 *
 * A provider that posts results to whatever URL it is handed has built a request-forgery tool
 * for anyone who obtains its API key. The caller here is authenticated, so this is defence in
 * depth rather than the primary control - but the primary control is a shared secret, and the
 * whole point of defence in depth is that shared secrets leak.
 *
 * The allowlist is optional because a provider cannot know its customer's hostnames in advance.
 * When it is set it is enforced, which is what makes it worth offering.
 */
function requireDeliverableUrl(value: unknown, field: string): string {
  const raw = requireString(value, field);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw badRequest(`'${field}' is not a valid URL.`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw badRequest(`'${field}' must be an http or https URL.`);
  }

  const allowlist = (process.env.GAMES_CALLBACK_HOST_ALLOWLIST ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0);

  if (allowlist.length > 0 && !allowlist.includes(parsed.hostname.toLowerCase())) {
    throw badRequest(`'${field}' host '${parsed.hostname}' is not an allowed callback host.`);
  }

  return parsed.toString();
}

/**
 * A stable hash of the parameters that decide what the player faces.
 *
 * WHAT COUNTS AS A "PARAMETER" IS NOT IN THE DOCUMENT
 * --------------------------------------------------
 * Section 11 requires a `409` for "the same `roundId` but different parameters" without saying
 * which fields are parameters, and the choice matters in both directions. Fingerprint too much
 * and an ordinary retry whose `expiresAt` was recomputed a second later is refused as an
 * identifier collision - a false alarm that fails a paid round. Fingerprint too little and a
 * genuine collision, two different players issued the same id, is accepted silently and one of
 * them plays the other's round.
 *
 * The line drawn here is: anything that changes the content, the scoring or whose round it is.
 * Game, mode, player, seed and the resolved config. Deliberately excluded are `expiresAt`,
 * `returnUrl` and `resultCallbackUrl`, none of which change what the player faces.
 *
 * The config is hashed AFTER resolution, not as sent. Reason: two requests asking for
 * `durationSeconds: 120` and omitting it entirely describe the same round, because the default
 * is 120 - and refusing the second as a collision would be wrong.
 */
function fingerprint(parts: {
  gameCode: string;
  mode: string;
  playerId: string;
  contentSeed?: string;
  config: RoundConfig;
}): string {
  const canonical = JSON.stringify([
    parts.gameCode,
    parts.mode,
    parts.playerId,
    parts.contentSeed ?? null,
    // Object key order is not guaranteed across callers, so the config is flattened into sorted
    // pairs rather than stringified directly. A hash that depends on key order is a hash that
    // reports collisions at random.
    Object.entries(parts.config as unknown as Record<string, unknown>)
      .map(([key, value]) => [key, value] as const)
      .sort((a, b) => a[0].localeCompare(b[0])),
  ]);
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

function launchUrlFor(token: string): string {
  return `${loadConfig().publicUrl}/play?t=${token}`;
}

function respond(round: RoundDoc): CreateRoundOutput {
  return {
    roundId: round.roundId,
    providerRoundId: round.providerRoundId,
    launchUrl: launchUrlFor(round.launchToken),
    launchUrlExpiresAt: round.launchUrlExpiresAt.toISOString(),
    // Echoed because the specification's response example carries it, even though its own field
    // table never mentions it. Ambiguity A8: a field in an example is a field a provider will
    // send, and a platform that validates strictly against the table would reject this response.
    status: "created",
  };
}

/**
 * Returns the existing round for a repeated call, or refuses the call as a collision.
 *
 * The launch URL is returned byte-identical whenever it is still alive, which is the case the
 * rule is actually about - a double-tapped Play button retries within seconds. A fresh token is
 * minted only once the stored one has expired, and that is a deliberate, recorded deviation from
 * the literal words "the same launch URL": returning a dead URL would satisfy the sentence and
 * defeat its purpose, which is that the platform gets a working way into the round it already
 * paid for without a second attempt being consumed. Ambiguity A3.
 */
async function reuse(
  existing: RoundDocument,
  expected: string,
  now: Date,
): Promise<CreateRoundOutput> {
  if (existing.fingerprint !== expected) {
    throw roundConflict(existing.roundId);
  }

  if (existing.launchUrlExpiresAt.getTime() > now.getTime()) {
    return respond(existing);
  }

  existing.launchToken = crypto.randomBytes(24).toString("hex");
  existing.launchUrlExpiresAt = new Date(
    Math.min(now.getTime() + LAUNCH_URL_TTL_MS, existing.expiresAt.getTime()),
  );
  await existing.save();
  return respond(existing);
}

export async function createRound(input: CreateRoundInput): Promise<CreateRoundOutput> {
  const now = new Date();

  const roundId = requireString(input.roundId, "roundId");
  const gameCode = requireString(input.gameCode, "gameCode");

  const title = findTitle(gameCode);
  if (!title) throw unknownGame(gameCode);
  if (title.status === "maintenance") {
    // 503 with `retryable: true` rather than a 400: the request is perfectly valid and will
    // succeed later, and the specification's error table reserves 400 for requests that will
    // never work.
    throw new ApiError(
      503,
      "GAME_UNAVAILABLE",
      `'${gameCode}' is temporarily unavailable.`,
      true,
    );
  }

  const mode = requireString(input.mode, "mode");
  if (mode !== "ranked" && mode !== "practice") {
    throw badRequest("'mode' must be 'ranked' or 'practice'.");
  }

  const player = (input.player ?? {}) as Record<string, unknown>;
  const playerId = requireString(player.playerId, "player.playerId");

  const requestedConfig =
    input.config && typeof input.config === "object" && !Array.isArray(input.config)
      ? (input.config as Record<string, unknown>)
      : {};
  const { config, corrected } = resolveConfig(title, requestedConfig);

  if (corrected.length > 0) {
    // Not an error, deliberately. `resolveConfig` clamps rather than refusing because the value
    // arriving at all means the platform and this service disagree about the schema, and
    // refusing a paid round mid-contest is worse than playing a slightly different one. The
    // disagreement is still worth a log line on both sides.
    console.warn(
      `⚠️ [create-round] ${roundId}: config corrected for ${gameCode} - ${corrected.join(", ")}`,
    );
  }

  const expiresAt = requireDate(input.expiresAt, "expiresAt");
  if (expiresAt.getTime() <= now.getTime()) {
    // Refusing beats creating a round that is born expired. Section 14 says a 400 makes the
    // platform "fail immediately, no retry", and section 11 says a failed creation does not
    // consume the player's attempt - so refusing here returns the attempt, where accepting and
    // immediately reporting `expired` would burn it on a round nobody could ever have played.
    throw badRequest("'expiresAt' is in the past.");
  }

  const resultCallbackUrl = requireDeliverableUrl(input.resultCallbackUrl, "resultCallbackUrl");
  const returnUrl =
    input.returnUrl === undefined || input.returnUrl === null
      ? undefined
      : requireString(input.returnUrl, "returnUrl");

  const rawSeed = input.contentSeed;
  if (rawSeed !== undefined && rawSeed !== null && typeof rawSeed !== "string") {
    throw badRequest("'contentSeed' must be a string when present.");
  }
  const contentSeed = typeof rawSeed === "string" && rawSeed.length > 0 ? rawSeed : undefined;

  if (mode === "ranked" && !contentSeed) {
    // Fail closed on the fairness guarantee.
    //
    // The document never states that `contentSeed` is mandatory on a ranked round, so a
    // permissive provider would generate its own content and the round would work perfectly. It
    // would also be a paid contest in which players faced different puzzles of unknown relative
    // difficulty - which section 12 calls the single most important guarantee in the document,
    // and which the platform's regulatory position depends on. There is no error, no log line
    // and no visible symptom for that; the contest simply is not the comparison it claims to be.
    // Refusing is the only outcome that cannot silently be wrong. Ambiguity A5.
    throw badRequest("'contentSeed' is required for a ranked round.");
  }

  const expected = fingerprint({ gameCode, mode, playerId, contentSeed, config });

  const existing = await Round.findOne({ roundId });
  if (existing) return reuse(existing, expected, now);

  const providerRoundId = `cvg_r_${crypto.randomBytes(9).toString("hex")}`;
  const launchToken = crypto.randomBytes(24).toString("hex");

  try {
    const created = await Round.create({
      roundId,
      providerRoundId,
      gameCode,
      mode,
      playerId,
      displayName: typeof player.displayName === "string" ? player.displayName : undefined,
      locale: typeof player.locale === "string" ? player.locale : undefined,
      country: typeof player.country === "string" ? player.country : undefined,
      config: config as unknown as Record<string, unknown>,
      requestedConfig,
      configCorrections: corrected,
      contentSeed,
      // Practice content varies per round on purpose: it is free and unranked, so there is
      // nothing to compare between players and variety is worth more than reproducibility.
      // Ranked rounds never reach this branch, because the guard above refuses them.
      presentationSeed: providerRoundId,
      fingerprint: expected,
      expiresAt,
      launchToken,
      launchUrlExpiresAt: new Date(
        Math.min(now.getTime() + LAUNCH_URL_TTL_MS, expiresAt.getTime()),
      ),
      resultCallbackUrl,
      returnUrl,
      status: "created",
      boards: [],
      sandbox: {},
      delivery: { attempts: 0 },
    });

    return respond(created);
  } catch (error) {
    // The double-tap that arrives twice in the same instant.
    //
    // Both requests miss the `findOne` and both try to insert, so the unique index on `roundId`
    // rejects one of them. That loser must not surface as a 500: the round exists, it is the
    // right round, and the correct answer is the same one the first request got. Handling this
    // only in the pre-flight check leaves exactly the hole the pre-flight check was added for -
    // the same two-place fix the platform needed for duplicate contest entry.
    if (isDuplicateKey(error)) {
      const raced = await Round.findOne({ roundId });
      if (raced) return reuse(raced, expected, now);
    }
    throw error;
  }
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}
