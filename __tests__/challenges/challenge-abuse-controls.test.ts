import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RateLimiters, checkRateLimit } from "@/lib/utils/rate-limiter";

/**
 * X15 mitigations 1 and 2 (`20` s2.3) - the abuse controls that ship with
 * "challenge any user" whether or not the owner answers open question 15.
 *
 *   1. Honour `BlockedUser.isBlockedByEither` on create AND accept.
 *   2. Rate-limit invitations via `RateLimiters.challengeInvite`.
 *
 * Behavioural coverage for accept lives in `challenge-accept-guards.test.ts`
 * (refuses across a reverse-direction block with no debit). Create is structural
 * here: wiring a full create fixture for one guard is disproportionate when the
 * accept path already proves the helper, and a create that calls the wrong
 * helper (`isBlocked`) is the defect these assertions catch.
 */

const ROOT = process.cwd();

/** Strip block and line comments so prose naming the anti-pattern cannot satisfy a match. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function read(relPath: string): string {
  return stripComments(
    readFileSync(join(ROOT, relPath), "utf8"),
  );
}

const CREATE = "app/api/challenges/route.ts";
const ACCEPT = "app/api/challenges/[id]/accept/route.ts";

describe("X15 challenge abuse controls", () => {
  describe("mitigation 1 - block list on both sides", () => {
    it("create calls isBlockedByEither, never the directional isBlocked", () => {
      const src = read(CREATE);
      // Reason: count the call - an import alone satisfies toContain and is green
      // when the call is deleted (the "import is not a use" trap).
      const eitherCalls = src.match(/BlockedUser\.isBlockedByEither\s*\(/g) ?? [];
      expect(eitherCalls.length).toBeGreaterThanOrEqual(1);
      // Directional form must not appear as a call. The name may still appear in
      // comments (already stripped) or as documentation of why we refuse it.
      expect(src).not.toMatch(/BlockedUser\.isBlocked\s*\(/);
    });

    it("accept calls isBlockedByEither before any wallet read", () => {
      const src = read(ACCEPT);
      const eitherAt = src.indexOf("BlockedUser.isBlockedByEither");
      expect(eitherAt).toBeGreaterThan(-1);
      // Reason: a refusal after a debit leaves one of two wallets charged. Match a
      // *call*, not the import - `indexOf("CreditWallet")` finds the import first
      // and every correct file fails (import-is-not-a-use trap inverted).
      const walletRead = /CreditWallet\.(?:find(?:One)?(?:AndUpdate)?|updateOne|create)\s*\(/.exec(
        src,
      );
      expect(walletRead).not.toBeNull();
      expect(walletRead!.index).toBeGreaterThan(eitherAt);
      expect(src).not.toMatch(/BlockedUser\.isBlocked\s*\(/);
    });

    it("create withholds the block check for an open challenge", () => {
      // Reason: an open challenge has nobody to compare against at create time;
      // the check moves to accept when the seat is claimed. Collapsing the open
      // branch into a directed check would refuse every open challenge forever
      // (challengedId absent) or invent an opponent.
      const src = read(CREATE);
      const callAt = src.indexOf("BlockedUser.isBlockedByEither");
      expect(callAt).toBeGreaterThan(-1);
      const window = src.slice(Math.max(0, callAt - 180), callAt);
      expect(window).toMatch(/!isOpenChallenge/);
    });
  });

  describe("mitigation 2 - invitation rate limit", () => {
    it("exposes RateLimiters.challengeInvite as a preset", () => {
      expect(typeof RateLimiters.challengeInvite).toBe("function");
      // Distinct keyPrefix from deposit/login so a flood of invites cannot burn
      // a player's deposit budget, and the reverse.
      const a = RateLimiters.challengeInvite(`x15-probe-${Date.now()}`);
      expect(a.success).toBe(true);
      expect(a.remaining).toBe(9);
    });

    it("refuses the eleventh invite in the window", () => {
      const id = `x15-flood-${Date.now()}-${Math.random()}`;
      for (let i = 0; i < 10; i++) {
        expect(RateLimiters.challengeInvite(id).success).toBe(true);
      }
      const blocked = RateLimiters.challengeInvite(id);
      expect(blocked.success).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it("create route calls challengeInvite and returns 429", () => {
      const src = read(CREATE);
      expect(src).toMatch(/RateLimiters\.challengeInvite\s*\(/);
      // Status must be the rate-limit code, not a generic 400 that invites retry.
      expect(src).toMatch(/status:\s*429/);
      // Simulator must skip - attack harnesses fire repeatedly on purpose.
      const inviteAt = src.indexOf("RateLimiters.challengeInvite");
      const before = src.slice(Math.max(0, inviteAt - 250), inviteAt);
      expect(before).toMatch(/!isInSimulatorMode/);
    });

    it("reuses checkRateLimit rather than a second limiter", () => {
      // Reason: chapter `20` s2.3 - "Reuse checkRateLimit; do not write a second
      // limiter." The preset is the only addition.
      const limiterSrc = read("lib/utils/rate-limiter.ts");
      expect(limiterSrc).toMatch(/challengeInvite/);
      expect(limiterSrc).toMatch(/keyPrefix:\s*["']challenge_invite["']/);
      // Sanity: the exported helper still exists for the preset to call.
      expect(typeof checkRateLimit).toBe("function");
    });
  });
});
