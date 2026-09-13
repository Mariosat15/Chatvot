import { NextResponse } from "next/server";
import { getFraudSettings } from "@/lib/services/fraud-settings.service";

/**
 * GET /api/security/challenge-config
 *
 * Public, non-sensitive registration-challenge config for the sign-up page.
 * Returns only the provider + PUBLIC site key (never the secret). Used by the
 * client CAPTCHA widget to know which challenge (if any) to render.
 */
export async function GET() {
  try {
    const settings = await getFraudSettings();

    const enabled =
      !!settings.registrationChallengeEnabled &&
      settings.registrationChallengeProvider !== "none" &&
      !!settings.registrationChallengeKey;

    return NextResponse.json({
      enabled,
      provider: enabled ? settings.registrationChallengeProvider : "none",
      siteKey: enabled ? settings.registrationChallengeKey : "",
    });
  } catch (error) {
    console.error("challenge-config error:", error);
    // Fail open: never block the sign-up page from rendering.
    return NextResponse.json({ enabled: false, provider: "none", siteKey: "" });
  }
}
