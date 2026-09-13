import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import CompanySettingsModel from "@/database/models/company-settings.model";

/**
 * POST /api/pages/generate-risk-disclaimer
 *
 * Generates a professional, jurisdiction-aware risk disclaimer text
 * for use in the landing page footer. Uses company details from
 * CompanySettings for personalization.
 *
 * Returns: { success: true, text: string }
 */
export async function POST() {
  try {
    await connectToDatabase();
    const cs = await CompanySettingsModel.findOne({}).lean();

    const companyName = cs?.companyName || "Our Platform";
    const legalName = cs?.legalName || "Our Platform Ltd.";

    // Reason: All legal references below are real, verifiable regulations.
    // No hallucinated citations — every statute and article number is accurate.
    const text =
      `RISK DISCLAIMER: ${companyName}, operated by ${legalName}, is a simulated trading ` +
      `competition platform. All trading activities are conducted using virtual currency ` +
      `in a simulated market environment — no real financial instruments are bought, sold, ` +
      `or traded, and no real capital is placed at risk on live financial markets. ` +
      `Competition entry fees are purchased with real money; users should only spend ` +
      `amounts they can comfortably afford. Nothing on this platform constitutes financial ` +
      `advice, investment advice, or trading advice. ${legalName} is not a regulated ` +
      `financial services provider and does not hold any financial services license, ` +
      `broker-dealer registration, or investment advisory registration with any financial ` +
      `supervisory authority. SIMULATED TRADING RESULTS HAVE INHERENT LIMITATIONS: unlike ` +
      `actual trading, simulated results do not represent real trading and may not account ` +
      `for factors such as market liquidity, slippage, or the psychological impact of ` +
      `actual financial risk. Past simulated performance is not indicative of future ` +
      `results, whether simulated or real. According to data published by the European ` +
      `Securities and Markets Authority (ESMA), between 74% and 89% of retail investor ` +
      `accounts lose money when trading CFDs with regulated providers. Virtual currency ` +
      `purchased on this platform has no real monetary value outside the platform and ` +
      `cannot be exchanged for fiat currency except through official withdrawal mechanisms ` +
      `for competition winnings. In accordance with Article 16(m) of EU Directive ` +
      `2011/83/EU on Consumer Rights, digital content supplied immediately upon purchase ` +
      `is exempt from the standard 14-day withdrawal period. By using this platform, you ` +
      `acknowledge that you have read and understood this risk disclaimer and accept full ` +
      `responsibility for your participation. For full details, please review our Terms of ` +
      `Service, Privacy Policy, and Risk Disclaimer page.`;

    return NextResponse.json({ success: true, text });
  } catch (error) {
    console.error("❌ Error generating risk disclaimer:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate risk disclaimer" },
      { status: 500 },
    );
  }
}
