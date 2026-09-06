/**
 * The mock provider adapter (X2, chapter 09 E1).
 *
 * NOT throwaway scaffolding. Chapter 09 E1 makes this the basis of every automated test and
 * the reason seven of nine phases can proceed without a provider granting sandbox access -
 * which is risk X1, the single thing most likely to stall the programme.
 *
 * Its real job is to be a good LIAR. A provider that always works proves nothing; the tests
 * that matter are the ones in chapter 07 where the provider withholds a callback, sends two
 * different scores for one round, replays an old event, or reports a score outside its own
 * declared range. Every one of those is configurable here.
 *
 * It touches no money, no wallet and no balance, and there is a test asserting that this
 * file imports nothing that could (chapter 07 section 6 invariant 6).
 */

import crypto from "crypto";
import type {
  CallbackVerification,
  CreateRoundRequest,
  CreateRoundResponse,
  GameProviderAdapter,
  NormalisedRoundResult,
  ProviderCapabilities,
  ProviderCatalogueGame,
  ProviderResult,
} from "../contract";

export const MOCK_PROVIDER_KEY = "mock";

/**
 * The failure modes the mock can be told to exhibit, drawn from chapter 07.
 *
 * Named rather than boolean-per-case so a test reads as a scenario ("behave as if the
 * provider is down") instead of a pile of flags whose combinations are undefined.
 */
export type MockFailureMode =
  /** Chapter 07 s3: every call fails. Drives health degradation and the kill switch. */
  | "provider_down"
  /** Chapter 07 s7: catalogue sync fails. Must serve the cached catalogue, no money impact. */
  | "catalogue_unavailable"
  /** Chapter 07 s7: round creation fails. Must NOT consume an attempt. */
  | "round_creation_fails"
  /** Chapter 01 s6a: 429. Retryable, honours backoff. */
  | "rate_limited"
  /** Chapter 01 s6a: 401/403. NOT retryable, critical alert - credentials are wrong. */
  | "unauthorized"
  /** Chapter 07 s2: the round is created and then simply never reports. */
  | "callback_never_arrives"
  /** Chapter 07 s4: a score outside the title's declared `scoreRange`. Must be rejected. */
  | "impossible_score"
  /** Chapter 07 s4: signature does not verify. Must be rejected and alerted. */
  | "bad_signature"
  /** Chapter 18 tier 4: an event older than the 5-minute window. Must be rejected. */
  | "stale_timestamp";

export interface MockAdapterConfig {
  /** Fixed score to report. Omitted means a deterministic value derived from `roundId`. */
  score?: number;
  /** Artificial latency in ms, for timeout and slow-provider tests. */
  latencyMs?: number;
  /** Active failure modes. Empty means a well-behaved provider. */
  failureModes?: MockFailureMode[];
  /** Overrides the catalogue, for testing capability-driven admin behaviour. */
  catalogue?: ProviderCatalogueGame[];
  /** Shared secret used to sign and verify mock callbacks. */
  callbackSecret?: string;
}

const DEFAULT_CALLBACK_SECRET = "mock-callback-secret";

/** Two titles: one independent and scored high, one head-to-head scored on time. */
const DEFAULT_CATALOGUE: ProviderCatalogueGame[] = [
  {
    gameCode: "mock-trivia",
    displayName: "Mock Trivia",
    description: "A fixture title used by the automated tests.",
    category: "quiz",
    family: "independent",
    supportsCompetition: true,
    supportsOneVsOne: false,
    supportsPractice: true,
    supportsContentSeed: true,
    scoreDirection: "higher_is_better",
    scoreType: "integer",
    scoreRange: { min: 0, max: 1000 },
    typicalDurationSeconds: 120,
    maxDurationSeconds: 300,
    status: "active",
  },
  {
    // Reason: deliberately lower_is_better and duration_ms. A catalogue of only
    // higher-is-better titles lets a ranking sign error pass every test, and that error
    // pays the slowest player first.
    gameCode: "mock-sprint",
    displayName: "Mock Sprint",
    description: "A fixture title scored on elapsed time, where lower wins.",
    category: "reflex",
    family: "head_to_head",
    supportsCompetition: true,
    supportsOneVsOne: true,
    supportsPractice: false,
    supportsContentSeed: true,
    scoreDirection: "lower_is_better",
    scoreType: "duration_ms",
    scoreRange: { min: 500, max: 60_000 },
    typicalDurationSeconds: 30,
    maxDurationSeconds: 90,
    status: "active",
  },
];

export class MockProviderAdapter implements GameProviderAdapter {
  // Reason: annotated `string` rather than left to infer the literal "mock". The interface
  // declares `string`, and inferring `"mock"` makes the class impossible to subclass - a
  // second adapter overriding the key fails with TS2416. Found by the X9 second-adapter
  // test, which is exactly what that test is for.
  readonly providerKey: string = MOCK_PROVIDER_KEY;
  readonly displayName: string = "Mock Provider (testing)";

  private config: MockAdapterConfig;
  /** Rounds this instance has created, so `createRound` can be idempotent. */
  private rounds = new Map<string, CreateRoundResponse>();

  constructor(config: MockAdapterConfig = {}) {
    this.config = { ...config };
  }

  /** Reconfigure between assertions without rebuilding the registry. */
  configure(config: MockAdapterConfig): void {
    this.config = { ...this.config, ...config };
  }

  /** Clears remembered rounds and failure modes. Call between tests. */
  reset(): void {
    this.config = {};
    this.rounds.clear();
  }

  private has(mode: MockFailureMode): boolean {
    return this.config.failureModes?.includes(mode) ?? false;
  }

  private async delay(): Promise<void> {
    const ms = this.config.latencyMs ?? 0;
    if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * The failures that apply to every call, checked before any per-method logic.
   *
   * Returns the result object rather than throwing so each method can hand it straight
   * back, preserving the never-throws guarantee.
   */
  private globalFailure(): ProviderResult<never> | null {
    if (this.has("provider_down")) {
      return {
        success: false,
        error: "Provider is unreachable.",
        code: "PROVIDER_DOWN",
        retryable: true,
      };
    }
    if (this.has("unauthorized")) {
      // Reason: NOT retryable. Retrying a credential failure just multiplies the 401s and
      // delays the only fix, which is an operator correcting the key (chapter 01 s6a).
      return {
        success: false,
        error: "Provider rejected our credentials.",
        code: "UNAUTHORIZED",
        retryable: false,
      };
    }
    if (this.has("rate_limited")) {
      return {
        success: false,
        error: "Provider rate limit reached.",
        code: "RATE_LIMITED",
        retryable: true,
      };
    }
    return null;
  }

  capabilities(): ProviderCapabilities {
    return {
      supportsVoid: true,
      supportsMatches: true,
      supportsPractice: true,
      supportsSeeding: true,
    };
  }

  async listGames(): Promise<ProviderResult<ProviderCatalogueGame[]>> {
    await this.delay();
    const failure = this.globalFailure();
    if (failure) return failure;

    if (this.has("catalogue_unavailable")) {
      return {
        success: false,
        error: "Catalogue is temporarily unavailable.",
        code: "CATALOGUE_UNAVAILABLE",
        retryable: true,
      };
    }

    return { success: true, data: this.config.catalogue ?? DEFAULT_CATALOGUE };
  }

  async createRound(
    request: CreateRoundRequest,
  ): Promise<ProviderResult<CreateRoundResponse>> {
    await this.delay();
    const failure = this.globalFailure();
    if (failure) return failure;

    if (this.has("round_creation_fails")) {
      return {
        success: false,
        error: "Round could not be created.",
        code: "ROUND_CREATE_FAILED",
        retryable: true,
      };
    }

    // Reason: idempotency on roundId is contractual (chapter 01 s4.1) and this is where a
    // real provider's bug would show up, so the mock models it faithfully - the same id
    // returns the SAME round and the SAME launch URL, never a second round. Without this
    // the mock would let a double-click bug through every test that uses it.
    const existing = this.rounds.get(request.roundId);
    if (existing) return { success: true, data: existing };

    const response: CreateRoundResponse = {
      roundId: request.roundId,
      providerRoundId: `mock_${request.roundId}`,
      launchUrl: `https://mock.provider.test/play/${encodeURIComponent(request.roundId)}`,
      launchUrlExpiresAt: request.expiresAt,
    };
    this.rounds.set(request.roundId, response);
    return { success: true, data: response };
  }

  async fetchRound(
    roundId: string,
  ): Promise<ProviderResult<NormalisedRoundResult>> {
    await this.delay();
    const failure = this.globalFailure();
    if (failure) return failure;

    if (this.has("callback_never_arrives")) {
      // Reason: the round exists and is simply still running. This is what makes the
      // reconciliation tests meaningful - polling has to distinguish "not finished yet"
      // from "finished and we missed it", and returning an error here would collapse them.
      return {
        success: false,
        error: "Round has not reported a result yet.",
        code: "ROUND_PENDING",
        retryable: true,
      };
    }

    return { success: true, data: this.buildResult(roundId) };
  }

  async voidRound(roundId: string): Promise<ProviderResult<void>> {
    await this.delay();
    const failure = this.globalFailure();
    if (failure) return failure;
    this.rounds.delete(roundId);
    return { success: true, data: undefined };
  }

  verifyCallback(
    rawBody: string,
    headers: Record<string, string>,
  ): CallbackVerification {
    if (this.has("bad_signature")) {
      return { valid: false, reason: "Signature mismatch." };
    }
    if (this.has("stale_timestamp")) {
      return { valid: false, reason: "Event timestamp is outside the accepted window." };
    }

    const provided = headers["x-mock-signature"] ?? headers["X-Mock-Signature"];
    if (!provided) return { valid: false, reason: "Signature header missing." };

    const expected = this.sign(rawBody);

    // Reason: constant-time comparison, and length-checked first because timingSafeEqual
    // THROWS on a length mismatch rather than returning false - which would turn a
    // malformed signature into a 500 and, in a route that reports errors, into an oracle.
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return { valid: false, reason: "Signature mismatch." };
    if (!crypto.timingSafeEqual(a, b)) {
      return { valid: false, reason: "Signature mismatch." };
    }
    return { valid: true };
  }

  parseCallback(rawBody: string): ProviderResult<NormalisedRoundResult> {
    let payload: { roundId?: string; score?: number; status?: string };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { success: false, error: "Callback body is not valid JSON.", retryable: false };
    }

    if (!payload.roundId) {
      return { success: false, error: "Callback is missing roundId.", retryable: false };
    }

    const result = this.buildResult(payload.roundId);
    if (typeof payload.score === "number") result.rawScore = payload.score;
    if (payload.status) {
      result.status = payload.status as NormalisedRoundResult["status"];
    }
    return { success: true, data: result };
  }

  /** Signs a body the way the mock expects. Exposed so tests can forge valid callbacks. */
  sign(rawBody: string): string {
    const secret = this.config.callbackSecret ?? DEFAULT_CALLBACK_SECRET;
    return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  }

  private buildResult(roundId: string): NormalisedRoundResult {
    const now = new Date();
    return {
      roundId,
      providerRoundId: `mock_${roundId}`,
      status: "completed",
      rawScore: this.resolveScore(roundId),
      scoreDirection: "higher_is_better",
      breakdown: { correct: 8, total: 10 },
      startedAt: new Date(now.getTime() - 60_000),
      completedAt: now,
      durationMs: 60_000,
      occurredAt: now,
    };
  }

  private resolveScore(roundId: string): number {
    if (this.has("impossible_score")) {
      // Reason: far outside mock-trivia's declared 0-1000, so ingestion's range check has
      // something unambiguous to reject. A value just over the bound would also test the
      // boundary, but a wildly wrong one distinguishes "range check missing" from
      // "range check off by one", which are different bugs.
      return 999_999;
    }
    if (typeof this.config.score === "number") return this.config.score;

    // Reason: derived from the roundId rather than random, so a failing test reproduces.
    const digest = crypto.createHash("sha256").update(roundId).digest();
    return digest.readUInt16BE(0) % 1001;
  }
}
