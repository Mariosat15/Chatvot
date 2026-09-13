/**
 * Entry Fraud Gate
 *
 * Central risk gate for competition / challenge ENTRY:
 *   - blockVPN / blockProxy / blockTor / blockDatacenterIPs → block entry by IP
 *   - maxEntriesPerHour            → throttle rapid competition entries
 *   - deviceFingerprintBlockThreshold → block entry from a high-risk device
 *
 * Design: capability/threshold-driven, backward-compatible (does nothing until
 * an admin raises a threshold below 100 or turns a block on), and FAILS OPEN on
 * any internal error so a detection hiccup never blocks a legitimate player.
 *
 * What this gate deliberately does NOT do: refuse entry on the strength of a
 * user's suspicion score. `entryBlockThreshold` is an alert/review threshold,
 * not a block. Section 4 below explains why at length - it is the one thing
 * about this file most likely to get "helpfully" put back.
 *
 * Every refusal here is transient and self-clearing: a different network, an
 * hour's wait, or a device whose risk an admin resets. Nothing in this gate can
 * lock an account out indefinitely. Indefinite blocks belong to
 * `UserRestriction`, where they are visible to admins and can be lifted.
 */

import { getFraudSettings } from "@/lib/services/fraud-settings.service";
import { evaluateIpRisk } from "@/lib/services/ip-detection.service";

export interface EntryGateResult {
  allowed: boolean;
  reason?: string;
  code?: string;
}

/**
 * Evaluate whether a user may enter a competition / challenge right now.
 */
export async function assertEntryFraudGate(params: {
  userId: string;
  ip?: string;
}): Promise<EntryGateResult> {
  const { userId, ip } = params;

  try {
    const settings = await getFraudSettings();

    // 1. IP block toggles (VPN / Proxy / Tor / Datacenter). Whitelisted IPs and
    //    detection errors pass automatically (evaluateIpRisk fails open).
    if (ip) {
      const ipGate = await evaluateIpRisk(ip, settings);
      if (ipGate.blocked) {
        return {
          allowed: false,
          reason:
            ipGate.reason ||
            "Entry is not allowed from your current network connection.",
          code: "IP_BLOCKED",
        };
      }
    }

    // 2. Per-hour entry throttle (competition participants created in last hour).
    const maxPerHour = settings.maxEntriesPerHour ?? 0;
    if (maxPerHour > 0) {
      try {
        const CompetitionParticipant = (
          await import(
            "@/database/models/trading/competition-participant.model"
          )
        ).default;
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentEntries = await CompetitionParticipant.countDocuments({
          userId,
          createdAt: { $gte: oneHourAgo },
        });
        if (recentEntries >= maxPerHour) {
          return {
            allowed: false,
            reason: `You've reached the maximum of ${maxPerHour} entries per hour. Please try again later.`,
            code: "ENTRY_RATE_LIMIT",
          };
        }
      } catch (err) {
        console.warn("⚠️ Entry gate: hourly-entry count failed (skipping):", err);
      }
    }

    // 3. Device-risk block — highest-risk device fingerprint for this user.
    const deviceThreshold = settings.deviceFingerprintBlockThreshold ?? 100;
    if (settings.deviceFingerprintingEnabled && deviceThreshold < 100) {
      try {
        const DeviceFingerprint = (
          await import("@/database/models/fraud/device-fingerprint.model")
        ).default;
        const riskiest = await DeviceFingerprint.findOne({ userId })
          .sort({ riskScore: -1 })
          .select({ riskScore: 1 })
          .lean();
        const deviceRisk =
          (riskiest as { riskScore?: number } | null)?.riskScore ?? 0;
        if (deviceRisk >= deviceThreshold) {
          return {
            allowed: false,
            reason:
              "Entry is temporarily blocked due to a security review of your device. Please contact support.",
            code: "DEVICE_RISK_BLOCKED",
          };
        }
      } catch (err) {
        console.warn("⚠️ Entry gate: device-risk check failed (skipping):", err);
      }
    }

    // 4. Suspicion score: DELIBERATELY DOES NOT BLOCK. See below.
    //
    // Reason: until 2 September 2026 this returned RISK_SCORE_BLOCKED whenever
    // `SuspicionScore.totalScore` exceeded `entryBlockThreshold` (default 70).
    // That was removed because it was an *invisible, irreversible* block, and it
    // locked a real player out of the platform with no way for an admin to
    // release them:
    //
    //   - it created no UserRestriction, so the account appeared nowhere on the
    //     admin's Restricted Users screen and the "Lift" action did not apply;
    //   - it sent the player no notification - the refusal existed only as a
    //     toast at the moment they tried to enter;
    //   - the dashboard's account-status card only renders while a fraud alert
    //     is pending or investigating, so dismissing the alert made the last
    //     remaining explanation disappear while the block stayed;
    //   - nothing in the admin UI could lower a score. The only score endpoint
    //     the UI calls is a recalculate, which can only raise it;
    //   - and it ignored `autoSuspendEnabled`, so an admin who had deliberately
    //     left automatic suspension OFF still got automatic lockouts.
    //
    // Blocking entry is now the sole job of `UserRestriction`, which is
    // visible, notifies the player, and can be lifted. A high score raises an
    // alert for a human to judge, and - only when the admin has turned
    // `autoSuspendEnabled` on - creates a real restriction via
    // `SuspicionScoringService.checkAndAutoRestrictUser`.
    //
    // Do not reintroduce a score-based refusal here. If automatic action is
    // wanted, raise the restriction instead, so it stays reversible.

    return { allowed: true };
  } catch (error) {
    // Fail open — never block a legitimate entry because the gate errored.
    console.error("⚠️ Entry fraud gate error (allowing entry):", error);
    return { allowed: true };
  }
}
