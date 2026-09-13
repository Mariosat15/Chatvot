/**
 * Shared response helper for webhook handlers that detect a bad HMAC / API
 * signature. Centralizing this means every PSP integration gets the same
 * security posture by default:
 *
 *   - Standardized 401 response (not 200, which historically hid attacks).
 *   - Persistent SecurityAlert record for admin review.
 *   - Non-leaky error body (no details about which check failed).
 *   - Consistent `🚨 SECURITY` log line format for SIEM / alerting.
 *
 * IMPORTANT: Returning 401 instructs the PSP "authorization of this request
 * failed" which is semantically correct. Many PSPs will NOT retry on 401 (they
 * treat it as terminal), which prevents attacker-replayed forged webhooks
 * from tying up webhook processors. Legitimate PSP integrations should never
 * see this response because their HMAC signatures are always valid.
 */

import { NextResponse } from "next/server";
import { recordSecurityAlert } from "./security-alert.service";

export interface WebhookSignatureFailureInput {
  /** Provider slug for the SecurityAlert record (e.g., "nuvei", "stripe"). */
  provider: string;
  /** The request object — used to extract IP / UA for alerting. */
  request: Request;
  /** Short human-readable failure reason. Logged and stored. */
  reason: string;
  /** Source endpoint path (e.g., "/api/nuvei/webhook"). */
  source: string;
  /** Optional non-sensitive metadata to store with the alert. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

function extractClientIp(req: Request): string | undefined {
  // Cloudflare / standard proxies
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return undefined;
}

/**
 * Record the event and return a 401 NextResponse. Always use this from a
 * PSP webhook handler's "bad signature" branch. Never return 200 on a forged
 * request.
 */
export async function reportWebhookSignatureFailure(
  input: WebhookSignatureFailureInput,
): Promise<NextResponse> {
  const ip = extractClientIp(input.request);
  const userAgent = input.request.headers.get("user-agent") ?? undefined;

  // Fire-and-forget alert write — we don't await the DB here because the
  // caller must respond quickly even if MongoDB is momentarily slow.
  // The service itself swallows errors and always logs to console.
  void recordSecurityAlert({
    alertType: "webhook_signature_failure",
    severity: "critical",
    source: input.source,
    provider: input.provider,
    ip,
    userAgent,
    reason: input.reason,
    metadata: input.metadata,
  });

  // Return a generic 401 body. Do not reveal which verification step failed.
  return NextResponse.json(
    {
      error: "Unauthorized",
    },
    { status: 401 },
  );
}
