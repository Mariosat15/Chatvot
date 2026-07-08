/**
 * Entry Fraud Gate
 *
 * Central risk gate for competition / challenge ENTRY. Wires up several fraud
 * settings that previously existed but were enforced nowhere:
 *   - entryBlockThreshold          → block entry when the user's risk score is high
 *   - deviceFingerprintBlockThreshold → block entry from a high-risk device
 *   - maxEntriesPerHour            → throttle rapid competition entries
 *   - blockVPN / blockProxy / blockTor / blockDatacenterIPs → block entry by IP
 *
 * Design: capability/threshold-driven, backward-compatible (does nothing until
 * an admin raises a threshold below 100 or turns a block on), and FAILS OPEN on
 * any internal error so a detection hiccup never blocks a legitimate player.
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

    // 4. Overall suspicion-score block (entryBlockThreshold).
    const entryThreshold = settings.entryBlockThreshold ?? 100;
    if (entryThreshold < 100) {
      try {
        const SuspicionScore = (
          await import("@/database/models/fraud/suspicion-score.model")
        ).default;
        const score = await SuspicionScore.findOne({ userId })
          .select({ totalScore: 1 })
          .lean();
        const totalScore =
          (score as { totalScore?: number } | null)?.totalScore ?? 0;
        if (totalScore > entryThreshold) {
          return {
            allowed: false,
            reason:
              "Entry is temporarily blocked while your account is under review. Please contact support.",
            code: "RISK_SCORE_BLOCKED",
          };
        }
      } catch (err) {
        console.warn("⚠️ Entry gate: suspicion-score check failed (skipping):", err);
      }
    }

    return { allowed: true };
  } catch (error) {
    // Fail open — never block a legitimate entry because the gate errored.
    console.error("⚠️ Entry fraud gate error (allowing entry):", error);
    return { allowed: true };
  }
}
