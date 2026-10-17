/**
 * Guards the internal-authentication boundary.
 *
 * Reason: the simulator routes act on behalf of an arbitrary user id and can
 * credit wallets. A regression here is directly exploitable, so the "header
 * alone is not enough" property is asserted rather than assumed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isSimulatorRequest,
  isSimulatorEnabled,
  guardSimulatorRoute,
  createSimulatorHeaders,
} from "@/lib/services/simulator/simulator-mode";
import { verifyInternalSecret } from "@/lib/utils/internal-auth";

const VALID_SECRET = "a".repeat(32);
const WRONG_SECRET = "b".repeat(32);

/** Build a Request carrying the given headers. */
function req(headers: Record<string, string>): Request {
  return new Request("https://example.test/api/simulator/deposit", {
    method: "POST",
    headers,
  });
}

/**
 * Put the process in the interesting state: a production deployment that has
 * opted into the simulator and configured a strong secret.
 */
function stubProductionSimulator(): void {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ENABLE_SIMULATOR", "true");
  vi.stubEnv("INTERNAL_API_SECRET", VALID_SECRET);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("simulator request authentication", () => {
  beforeEach(stubProductionSimulator);

  it("rejects the declaring header on its own", () => {
    expect(isSimulatorRequest(req({ "X-Simulator-Mode": "true" }))).toBe(false);
  });

  it("rejects a named user id on its own", () => {
    // This was the exploit: the user header alone selected the identity branch.
    expect(
      isSimulatorRequest(req({ "X-Simulator-User-Id": "victim-user-id" })),
    ).toBe(false);
  });

  it("rejects a wrong secret", () => {
    expect(
      isSimulatorRequest(
        req({
          "X-Simulator-Mode": "true",
          "X-Internal-Secret": WRONG_SECRET,
        }),
      ),
    ).toBe(false);
  });

  it("accepts the declaring header plus the correct secret", () => {
    expect(
      isSimulatorRequest(
        req({
          "X-Simulator-Mode": "true",
          "X-Internal-Secret": VALID_SECRET,
        }),
      ),
    ).toBe(true);
  });

  it("fails closed when the secret is not configured", () => {
    vi.stubEnv("INTERNAL_API_SECRET", undefined);
    expect(
      isSimulatorRequest(
        req({
          "X-Simulator-Mode": "true",
          "X-Internal-Secret": VALID_SECRET,
        }),
      ),
    ).toBe(false);
  });

  it("fails closed when the configured secret is too short to be protection", () => {
    vi.stubEnv("INTERNAL_API_SECRET", "short");
    expect(
      isSimulatorRequest(
        req({ "X-Simulator-Mode": "true", "X-Internal-Secret": "short" }),
      ),
    ).toBe(false);
  });

  it("refuses simulator traffic unless the deployment opts in", () => {
    vi.stubEnv("ENABLE_SIMULATOR", undefined);
    expect(isSimulatorEnabled()).toBe(false);
    expect(
      isSimulatorRequest(
        req({
          "X-Simulator-Mode": "true",
          "X-Internal-Secret": VALID_SECRET,
        }),
      ),
    ).toBe(false);
  });

  it("accepts headers built by createSimulatorHeaders", () => {
    const headers = createSimulatorHeaders("some-user-id");
    expect(isSimulatorRequest(req(headers))).toBe(true);
  });
});

describe("guardSimulatorRoute", () => {
  beforeEach(stubProductionSimulator);

  it("returns a 403 for an unauthenticated caller", () => {
    const response = guardSimulatorRoute(req({ "X-Simulator-Mode": "true" }));
    expect(response).not.toBeNull();
    expect(response?.status).toBe(403);
  });

  it("returns null for an authenticated internal caller", () => {
    const response = guardSimulatorRoute(req(createSimulatorHeaders()));
    expect(response).toBeNull();
  });

  it("allows local development without headers", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(guardSimulatorRoute(req({}))).toBeNull();
  });
});

/**
 * Route-level coverage. The unit tests above prove the decision function is
 * correct; these prove the routes actually call it.
 *
 * The two money routes outside /api/simulator (competition join and challenge
 * create) are covered by the `isSimulatorRequest` tests instead — importing
 * them here pulls in a prebuilt better-auth bundle that cannot resolve the "@/"
 * alias under vitest.
 */
describe("privileged simulator routes reject a header-only caller", () => {
  beforeEach(stubProductionSimulator);

  const routes: Array<[string, () => Promise<{ POST: unknown }>]> = [
    ["deposit", () => import("@/app/api/simulator/deposit/route")],
    ["deposit-batch", () => import("@/app/api/simulator/deposit-batch/route")],
    ["payments/approve", () => import("@/app/api/simulator/payments/approve/route")],
    ["competitions", () => import("@/app/api/simulator/competitions/route")],
    ["competitions/join-batch", () => import("@/app/api/simulator/competitions/join-batch/route")],
    ["challenges", () => import("@/app/api/simulator/challenges/route")],
    ["admin", () => import("@/app/api/simulator/admin/route")],
    ["fraud", () => import("@/app/api/simulator/fraud/route")],
    ["orders", () => import("@/app/api/simulator/orders/route")],
    ["positions/tpsl", () => import("@/app/api/simulator/positions/tpsl/route")],
  ];

  it.each(routes)("%s returns 403 without the internal secret", async (name, load) => {
    const mod = await load();
    const handler = mod.POST as (r: Request) => Promise<Response>;

    const response = await handler(
      new Request(`https://example.test/api/simulator/${name}`, {
        method: "POST",
        headers: {
          "X-Simulator-Mode": "true",
          "X-Simulator-User-Id": "victim-user-id",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: "victim-user-id", amount: 1_000_000 }),
      }),
    );

    expect(response.status).toBe(403);
  });
});

describe("verifyInternalSecret", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  it("does not accept the old literal fallbacks", () => {
    // Nothing configured: the previously accepted literals must now fail.
    expect(verifyInternalSecret("simulator-cleanup", [undefined])).toBe(false);
    expect(verifyInternalSecret("internal-key", [undefined, undefined])).toBe(
      false,
    );
  });

  it("accepts a matching configured secret", () => {
    expect(verifyInternalSecret(VALID_SECRET, [VALID_SECRET])).toBe(true);
    expect(verifyInternalSecret(WRONG_SECRET, [VALID_SECRET])).toBe(false);
  });

  it("ignores a candidate too short to be protection", () => {
    expect(verifyInternalSecret("short", ["short"])).toBe(false);
  });

  it("falls back through the candidates in order", () => {
    expect(verifyInternalSecret(VALID_SECRET, [undefined, VALID_SECRET])).toBe(
      true,
    );
    // The first usable candidate wins; a later one is not also accepted.
    expect(
      verifyInternalSecret(WRONG_SECRET, [VALID_SECRET, WRONG_SECRET]),
    ).toBe(false);
  });

  it("rejects null and empty credentials", () => {
    expect(verifyInternalSecret(null, [VALID_SECRET])).toBe(false);
    expect(verifyInternalSecret(undefined, [VALID_SECRET])).toBe(false);
    expect(verifyInternalSecret("", [VALID_SECRET])).toBe(false);
  });
});
