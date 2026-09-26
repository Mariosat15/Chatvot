/**
 * Persist SecurityAlerts for chapter 06 s10 events that fire at ingestion time.
 *
 * "Any occurrence" alerts belong here rather than on a 1-minute poller: a poller either
 * misses the event (already processed) or re-alerts forever from stored rows.
 *
 * Fire-and-forget: the provider callback must not wait on alert persistence (same rule as
 * `recordSecurityAlert` itself).
 */

import { recordSecurityAlert } from "@/lib/services/security/security-alert.service";
import type { EventProcessingResult } from "@/database/models/games/provider-event.model";

/** Outcomes that chapter 06 s10 treats as an invalid signature (Critical). */
const SIGNATURE_RESULTS = new Set<EventProcessingResult>(["signature_invalid"]);

export function voidIngestSecurityAlerts(input: {
  providerKey: string;
  result: EventProcessingResult;
  eventId?: string;
  roundId?: string;
  integrityFlags?: string[];
  scoreOutOfRange?: boolean;
}): void {
  void raiseIngestSecurityAlerts(input).catch((err) => {
    console.error(
      "⚠️ [PROVIDER INGEST ALERT] Failed to record SecurityAlert:",
      err instanceof Error ? err.message : err,
    );
  });
}

async function raiseIngestSecurityAlerts(input: {
  providerKey: string;
  result: EventProcessingResult;
  eventId?: string;
  roundId?: string;
  integrityFlags?: string[];
  scoreOutOfRange?: boolean;
}): Promise<void> {
  const { providerKey, result, eventId, roundId, integrityFlags } = input;

  if (SIGNATURE_RESULTS.has(result)) {
    await recordSecurityAlert({
      alertType: "provider_signature_invalid",
      severity: "critical",
      source: "provider-callback",
      provider: providerKey,
      reason: `Invalid signature on provider callback from "${providerKey}". Either credentials are wrong or someone is probing the endpoint.`,
      metadata: { eventId: eventId ?? null, roundId: roundId ?? null, result },
    });
  }

  // Chapter table: High. Ingestion still returns alert:"critical" for ops log urgency;
  // the stored severity matches the table so the admin queue can filter correctly.
  if (result === "score_out_of_range" || input.scoreOutOfRange) {
    await recordSecurityAlert({
      alertType: "provider_score_out_of_range",
      severity: "high",
      source: "provider-callback",
      provider: providerKey,
      reason: `Score outside the declared range for a round from "${providerKey}".`,
      metadata: { eventId: eventId ?? null, roundId: roundId ?? null, result },
    });
  }

  if (integrityFlags && integrityFlags.length > 0) {
    await recordSecurityAlert({
      alertType: "provider_integrity_flag",
      severity: "medium",
      source: "provider-callback",
      provider: providerKey,
      reason: `Provider raised integrity flag(s) on round ${roundId ?? "(unknown)"}: ${integrityFlags.join(", ")}.`,
      metadata: {
        eventId: eventId ?? null,
        roundId: roundId ?? null,
        integrityFlags,
      },
    });
  }
}
